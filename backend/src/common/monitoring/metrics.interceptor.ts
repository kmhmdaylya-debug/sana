import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Inject } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    // Skip metrics endpoint itself to avoid recursion
    if (request.path === '/metrics' || request.path === '/metrics/health') {
      return next.handle();
    }

    const startTime = process.hrtime.bigint();
    const method = request.method;
    const route = this.normalizeRoute(request.route?.path ?? request.path);

    return next.handle().pipe(
      tap({
        next: () => {
          const durationNs = Number(process.hrtime.bigint() - startTime);
          const durationSeconds = durationNs / 1e9;
          const statusCode = response.statusCode;

          this.metricsService.incrementHttpRequests(method, route, statusCode);
          this.metricsService.observeHttpDuration(method, route, statusCode, durationSeconds);
        },
        error: (error) => {
          const durationNs = Number(process.hrtime.bigint() - startTime);
          const durationSeconds = durationNs / 1e9;
          const statusCode = error.status ?? 500;

          this.metricsService.incrementHttpRequests(method, this.normalizeRoute(request.path), statusCode);
          this.metricsService.observeHttpDuration(method, this.normalizeRoute(request.path), statusCode, durationSeconds);
        },
      }),
    );
  }

  private normalizeRoute(path: string): string {
    // Replace UUIDs and numeric IDs with placeholders for route grouping
    return path
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:uuid')
      .replace(/\/[0-9]+/g, '/:id')
      .replace(/\/[a-zA-Z0-9_-]{20,}/g, '/:token');
  }
}