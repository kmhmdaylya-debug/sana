import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

interface ErrorBody {
  success: false;
  statusCode: number;
  message: string;
  errors?: Record<string, string[]> | string[];
  path: string;
  timestamp: string;
  stack?: string;
}

/** فیلتر یکپارچه برای مدیریت خطاها و بازگرداندن پاسخ استاندارد فارسی */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'خطای غیرمنتظره‌ای در سامانه رخ داد. لطفاً دوباره تلاش کنید.';
    let errors: ErrorBody['errors'];

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const payload = exception.getResponse();
      if (typeof payload === 'string') {
        message = payload;
      } else if (payload && typeof payload === 'object') {
        const p = payload as Record<string, any>;
        const raw = p.message;
        if (Array.isArray(raw)) {
          errors = raw as string[];
          message = raw.join('، ');
        } else if (typeof raw === 'string') {
          message = raw;
        } else {
          message = 'درخواست نامعتبر است.';
        }
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      ({ status, message, errors } = this.mapPrismaError(exception));
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'داده‌های ارسالی با ساختار پایگاه داده مطابقت ندارد.';
    } else if (exception instanceof Prisma.PrismaClientInitializationError) {
      status = HttpStatus.SERVICE_UNAVAILABLE;
      message = 'اتصال به پایگاه داده برقرار نشد. سرویس را بررسی کنید.';
    }

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status} :: ${(exception as Error)?.message ?? exception}`,
        (exception as Error)?.stack,
      );
    } else {
      this.logger.warn(`${request.method} ${request.url} -> ${status} :: ${message}`);
    }

    const body: ErrorBody = {
      success: false,
      statusCode: status,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    };
    if (errors) body.errors = errors;
    if (process.env.NODE_ENV !== 'production' && exception instanceof Error) {
      body.stack = exception.stack;
    }

    response.status(status).json(body);
  }

  private mapPrismaError(e: Prisma.PrismaClientKnownRequestError): {
    status: number;
    message: string;
    errors?: ErrorBody['errors'];
  } {
    switch (e.code) {
      case 'P2002': {
        const target = (e.meta?.target as string[] | undefined) ?? [];
        const fields = target.length ? target.join('، ') : 'این مقدار';
        return {
          status: HttpStatus.CONFLICT,
          message: `مقدار تکراری است. فیلد «${fields}» قبلاً ثبت شده است.`,
        };
      }
      case 'P2003':
        return {
          status: HttpStatus.CONFLICT,
          message: 'به دلیل وجود رکوردهای وابسته، این عملیات مجاز نیست.',
        };
      case 'P2025':
        return { status: HttpStatus.NOT_FOUND, message: 'رکورد موردنظر یافت نشد.' };
      case 'P2014':
        return {
          status: HttpStatus.CONFLICT,
          message: 'نقش وابسته این رکورد هنوز استفاده می‌شود و قابل حذف نیست.',
        };
      default:
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'خطا در ارتباط با پایگاه داده رخ داد.',
        };
    }
  }
}
