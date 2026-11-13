import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';

export interface ApiResponse<T> {
  success: true;
  data: T;
  message?: string;
  timestamp: string;
  meta?: Record<string, unknown>;
}

/** پاسخ‌های موفق را به یک ساختار یکدست تبدیل می‌کند */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T> | T> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<any> {
    const response = context.switchToHttp().getResponse();
    const isFileStream =
      typeof response?.send === 'function' && response.headersSent === false && context.getType() === 'http';

    return next.handle().pipe(
      map((data) => {
        // اگر خود پاسخ ساختار استاندارد دارد، بدون تغییر برگردان
        if (data && typeof data === 'object' && 'success' in (data as any)) return data;
        // مسیرهایی که خودشان قالب پاسخ دارند (مثل paginated) شناسایی می‌شوند
        if (data && typeof data === 'object' && 'data' in (data as any) && 'meta' in (data as any)) {
          return data;
        }
        if (isFileStream && Buffer.isBuffer(data)) return data;
        return {
          success: true,
          data,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
