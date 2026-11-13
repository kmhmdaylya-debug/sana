import { ArgumentMetadata, ValidationPipe, ValidationPipeOptions, type PipeTransform } from '@nestjs/common';

/**
 * اعتبارسنجی سراسری برنامه.
 *
 * نکته: در کنترلرها، DTO فیلتر و PaginationDto هر دو به‌عنوان پارامتر `@Query()`
 * تعریف شده‌اند و NestJS هر دو را با *همان* آبجکت خام query اعتبارسنجی می‌کند.
 * چون ValidationPipe سراسری `forbidNonWhitelisted` دارد، پارامترهای فیلتر برای
 * PaginationDto «ناشناخته» تلقی می‌شدند (و برعکس) و درخواست‌ها با خطای 400 رد می‌شدند.
 *
 * راه‌حل: برای پارامترهای query، اعتبارسنجی بدون forbidNonWhitelisted انجام
 * می‌شود تا پارامترهای اضافی (مثل page/limit یا فیلترهای هم‌زمان) رد نشوند و
 * فقط فیلدهای ناشناختهٔ نادیده گرفته شوند؛ بدنه و سایر پارامترها سخت‌گیرانه می‌مانند
 * تا فیلدهای ناشناختهٔ بدنه گزارش شوند.
 */
export class AppValidationPipe implements PipeTransform {
  private readonly strictPipe: ValidationPipe;
  private readonly lenientPipe: ValidationPipe;

  constructor(options?: ValidationPipeOptions) {
    const base: ValidationPipeOptions = {
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      whitelist: true,
      forbidNonWhitelisted: true,
      ...options,
    };
    this.strictPipe = new ValidationPipe(base);
    this.lenientPipe = new ValidationPipe({ ...base, forbidNonWhitelisted: false });
  }

  async transform(value: unknown, metadata: ArgumentMetadata) {
    const pipe = metadata.type === 'query' ? this.lenientPipe : this.strictPipe;
    return pipe.transform(value, metadata);
  }
}
