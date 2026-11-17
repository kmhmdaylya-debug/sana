import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationDto {
  @ApiPropertyOptional({ description: 'شماره صفحه (از ۱)', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'شماره صفحه باید عدد صحیح باشد.' })
  @Min(1, { message: 'شماره صفحه باید حداقل ۱ باشد.' })
  page: number = 1;

  @ApiPropertyOptional({ description: 'تعداد رکورد در هر صفحه', default: 20, minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'تعداد رکورد در صفحه باید عدد صحیح باشد.' })
  @Min(1, { message: 'تعداد رکورد در صفحه باید حداقل ۱ باشد.' })
  @Max(200, { message: 'حداکثر تعداد رکورد در صفحه ۲۰۰ است.' })
  limit: number = 20;

  @ApiPropertyOptional({ description: 'عبارت جستجو', nullable: true })
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'فیلد مرتب‌سازی', nullable: true })
  @IsOptional()
  sortBy?: string;

  @ApiPropertyOptional({ description: 'جهت مرتب‌سازی: asc یا desc', default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'], { message: 'جهت مرتب‌سازی نامعتبر است.' })
  sortOrder: 'asc' | 'desc' = 'desc';

  /** برای cursor-based pagination: شناسه آخرین رکورد دریافت‌شده */
  @ApiPropertyOptional({ description: 'شناسه مکان‌نما (cursor) برای صفحه‌بندی کارا', nullable: true })
  @IsOptional()
  cursor?: string;

  get skip(): number {
    return (this.page - 1) * this.limit;
  }
}

export class CursorPaginationDto {
  @ApiPropertyOptional({ description: 'تعداد رکورد در هر صفحه', default: 20, minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'تعداد رکورد در صفحه باید عدد صحیح باشد.' })
  @Min(1, { message: 'تعداد رکورد در صفحه باید حداقل ۱ باشد.' })
  @Max(200, { message: 'حداکثر تعداد رکورد در صفحه ۲۰۰ است.' })
  limit: number = 20;

  @ApiPropertyOptional({ description: 'شناسه مکان‌نما (cursor) برای صفحه‌بندی کارا', nullable: true })
  @IsOptional()
  cursor?: string;

  @ApiPropertyOptional({ description: 'جهت مرتب‌سازی: asc یا desc', default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'], { message: 'جهت مرتب‌سازی نامعتبر است.' })
  sortOrder: 'asc' | 'desc' = 'desc';
}

export class PaginatedResult<T> {
  @ApiProperty({ isArray: true })
  data: T[];

  @ApiProperty()
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
    /** برای cursor-based pagination */
    nextCursor?: string | null;
  };

  @ApiProperty()
  success: true = true;

  @ApiProperty()
  timestamp: string = new Date().toISOString();
}
