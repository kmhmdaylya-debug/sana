import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsDateString, IsOptional, IsUUID, MaxLength } from 'class-validator';

export class IdParamDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4', { message: 'شناسه معتبر نیست.' })
  id: string;
}

export class DateRangeDto {
  @ApiPropertyOptional({ example: '2026-01-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString({}, { message: 'قالب تاریخ شروع نامعتبر است.' })
  from?: string;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.999Z' })
  @IsOptional()
  @IsDateString({}, { message: 'قالب تاریخ پایان نامعتبر است.' })
  to?: string;

  get fromDate(): Date | undefined {
    return this.from ? new Date(this.from) : undefined;
  }

  get toDate(): Date | undefined {
    return this.to ? new Date(this.to) : undefined;
  }
}

export class BulkIdsDto {
  @ApiProperty({ type: [String], format: 'uuid' })
  @IsArray()
  @IsUUID('4', { each: true, message: 'شناسه‌های ارسالی معتبر نیستند.' })
  ids: string[];
}

export class IdempotentRequestDto {
  @ApiPropertyOptional({ description: 'کلید یکتای درخواست برای جلوگیری از ثبت تکراری' })
  @IsOptional()
  @MaxLength(128)
  idempotencyKey?: string;
}

/**
 * DTO عمومی برای فیلتر حوزه‌ای (شرکت/شعبه/واحد).
 */
export class ScopeFilterDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  companyId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  branchId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  orgUnitId?: string;
}

export class ActiveFlagDto {
  @ApiPropertyOptional({ description: 'فقط رکوردهای فعال' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  activeOnly?: boolean;
}
