import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PayCalculationType, PayComponentType, PayrollStatus } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

/** تبدیل امن مقدار بولی (پارامترهای رشته‌ای هم درست تفسیر می‌شوند) */
const ToBoolean = () =>
  Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
    return Boolean(value);
  });

// ---------------------------------------------------------------------------
// اجزای حقوق (PayComponent)
// ---------------------------------------------------------------------------

export class CreatePayComponentDto {
  @ApiProperty({ example: 'BASE_SALARY', description: 'کد یکتای جزء حقوق در سطح شرکت' })
  @IsString({ message: 'کد جزء حقوق الزامی است.' })
  @MaxLength(40)
  code: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'شرکت (در صورت تک‌شرکت بودن حساب اختیاری است)' })
  @IsOptional()
  @IsUUID('4', { message: 'شناسه شرکت معتبر نیست.' })
  companyId?: string;

  @ApiProperty({ example: 'حقوق پایه' })
  @IsString({ message: 'عنوان جزء حقوق الزامی است.' })
  @MaxLength(120)
  name: string;

  @ApiProperty({ enum: PayComponentType, description: 'پرداختی / کسورات / هزینه شرکت' })
  @IsEnum(PayComponentType, { message: 'نوع جزء حقوق معتبر نیست.' })
  type: PayComponentType;

  @ApiPropertyOptional({ enum: PayCalculationType, default: PayCalculationType.FIXED })
  @IsOptional()
  @IsEnum(PayCalculationType, { message: 'نوع محاسبه معتبر نیست.' })
  calculationType?: PayCalculationType;

  @ApiPropertyOptional({ description: 'مبلغ پایه به ریال (عدد صحیح)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'مبلغ باید عدد صحیح باشد.' })
  @Min(0, { message: 'مبلغ نمی‌تواند منفی باشد.' })
  amount?: number;

  @ApiPropertyOptional({ description: 'عبارت محاسباتی (برای نوع FORMULA)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  formula?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @ToBoolean()
  isTaxable?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @ToBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'ترتیب نمایش باید عدد صحیح باشد.' })
  sortOrder?: number;
}

export class UpdatePayComponentDto {
  @ApiPropertyOptional({ example: 'حقوق پایه' })
  @IsOptional()
  @IsString({ message: 'عنوان جزء حقوق نمی‌تواند خالی باشد.' })
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ enum: PayComponentType })
  @IsOptional()
  @IsEnum(PayComponentType, { message: 'نوع جزء حقوق معتبر نیست.' })
  type?: PayComponentType;

  @ApiPropertyOptional({ enum: PayCalculationType })
  @IsOptional()
  @IsEnum(PayCalculationType, { message: 'نوع محاسبه معتبر نیست.' })
  calculationType?: PayCalculationType;

  @ApiPropertyOptional({ description: 'مبلغ پایه به ریال' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'مبلغ باید عدد صحیح باشد.' })
  @Min(0, { message: 'مبلغ نمی‌تواند منفی باشد.' })
  amount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  formula?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ToBoolean()
  isTaxable?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @ToBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'ترتیب نمایش باید عدد صحیح باشد.' })
  sortOrder?: number;
}

export class PayComponentQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: PayComponentType })
  @IsOptional()
  @IsEnum(PayComponentType, { message: 'نوع جزء حقوق معتبر نیست.' })
  type?: PayComponentType;

  @ApiPropertyOptional({ description: 'فقط اجزای فعال' })
  @IsOptional()
  @ToBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: 'شناسه شرکت معتبر نیست.' })
  companyId?: string;
}

// ---------------------------------------------------------------------------
// نسخه‌های قاعده محاسبه (PayRuleVersion)
// ---------------------------------------------------------------------------

export class CreatePayRuleVersionDto {
  @ApiProperty({ example: '2026-01-01', description: 'تاریخ شروع اعتبار (میلادی)' })
  @IsString({ message: 'تاریخ شروع اعتبار الزامی است.' })
  @MaxLength(30)
  effectiveFrom: string;

  @ApiPropertyOptional({ example: '2026-12-31', description: 'تاریخ پایان اعتبار (میلادی)' })
  @IsOptional()
  @IsString({ message: 'قالب تاریخ پایان اعتبار نامعتبر است.' })
  @MaxLength(30)
  effectiveTo?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'پیکربندی قاعده (JSON) — مثلاً { "multiplier": 1.4, "cap": 5000000 }',
  })
  @IsOptional()
  @IsObject({ message: 'پیکربندی قاعده باید شیء باشد.' })
  configJson?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'توضیح نسخه' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}

// ---------------------------------------------------------------------------
// دوره حقوق (PayrollPeriod)
// ---------------------------------------------------------------------------

export class CreatePayrollPeriodDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4', { message: 'شناسه شرکت معتبر نیست.' })
  companyId: string;

  @ApiProperty({ example: 1404, description: 'سال شمسی' })
  @Type(() => Number)
  @IsInt({ message: 'سال باید عدد صحیح باشد.' })
  @Min(1300, { message: 'سال شمسی معتبر نیست.' })
  year: number;

  @ApiProperty({ example: 5, description: 'ماه شمسی (۱ تا ۱۲)' })
  @Type(() => Number)
  @IsInt({ message: 'ماه باید عدد صحیح باشد.' })
  @Min(1, { message: 'ماه باید بین ۱ تا ۱۲ باشد.' })
  @Max(12, { message: 'ماه باید بین ۱ تا ۱۲ باشد.' })
  month: number;
}

export class PayrollPeriodQueryDto extends PaginationDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: 'شناسه شرکت معتبر نیست.' })
  companyId?: string;

  @ApiPropertyOptional({ example: 1404 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'سال باید عدد صحیح باشد.' })
  year?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'ماه باید عدد صحیح باشد.' })
  month?: number;

  @ApiPropertyOptional({ enum: PayrollStatus })
  @IsOptional()
  @IsEnum(PayrollStatus, { message: 'وضعیت دوره معتبر نیست.' })
  status?: PayrollStatus;
}

// ---------------------------------------------------------------------------
// اصلاحیه حقوق (PayrollAmendment)
// ---------------------------------------------------------------------------

export class AmendmentItemDto {
  @ApiProperty({ format: 'uuid', description: 'شناسه جزء حقوق' })
  @IsUUID('4', { message: 'شناسه جزء حقوق معتبر نیست.' })
  componentId: string;

  @ApiProperty({ description: 'مبلغ اصلاحی به ریال (می‌تواند منفی باشد)' })
  @Type(() => Number)
  @IsInt({ message: 'مبلغ باید عدد صحیح باشد.' })
  amount: number;

  @ApiPropertyOptional({ description: 'توضیح ردیف اصلاحیه' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}

export class CreatePayrollAmendmentDto {
  @ApiProperty({ format: 'uuid', description: 'شناسه دوره اصلی (تغییر همیشه روی همین دوره اعمال می‌شود)' })
  @IsUUID('4', { message: 'شناسه دوره معتبر نیست.' })
  periodId: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4', { message: 'شناسه پرسنلی معتبر نیست.' })
  employeeId: string;

  @ApiProperty({ example: 'اصلاح اضافه‌کاری ماه فروردین بر اساس اصلاح حضور و غیاب' })
  @IsString({ message: 'علت اصلاحیه الزامی است.' })
  @MaxLength(500)
  reason: string;

  @ApiProperty({ type: [AmendmentItemDto], description: 'اقلام اصلاحی' })
  @IsArray({ message: 'اقلام اصلاحیه باید آرایه باشد.' })
  @ArrayMinSize(1, { message: 'حداقل یک قلم اصلاحیه لازم است.' })
  @ValidateNested({ each: true })
  @Type(() => AmendmentItemDto)
  items: AmendmentItemDto[];
}

export class RejectPayrollAmendmentDto {
  @ApiProperty({ example: 'عدم تأیید مدارک پیوست' })
  @IsString({ message: 'علت رد اصلاحیه الزامی است.' })
  @MaxLength(500)
  reason: string;
}

// ---------------------------------------------------------------------------
// گزارش‌ها
// ---------------------------------------------------------------------------

export class PayrollReportQueryDto {
  @ApiPropertyOptional({
    enum: ['json', 'csv', 'xlsx'],
    default: 'json',
    description: 'قالب خروجی — برای csv/xlsx مجوز payroll.export لازم است.',
  })
  @IsOptional()
  @IsIn(['json', 'csv', 'xlsx'], { message: 'قالب خروجی معتبر نیست.' })
  format: 'json' | 'csv' | 'xlsx' = 'json';

  @ApiPropertyOptional({ format: 'uuid', description: 'فقط گزارش یک کارمند' })
  @IsOptional()
  @IsUUID('4', { message: 'شناسه پرسنلی معتبر نیست.' })
  employeeId?: string;
}

export class PayrollCompareQueryDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'فقط مقایسه یک کارمند' })
  @IsOptional()
  @IsUUID('4', { message: 'شناسه پرسنلی معتبر نیست.' })
  employeeId?: string;
}
