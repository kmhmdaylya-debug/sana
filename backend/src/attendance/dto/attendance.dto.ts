import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  ArrayMaxSize,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { AttendanceEventType, AttendanceRecordStatus, AttendanceSource } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

/** فیلدهای قابل اصلاح در رکورد حضور و غیاب */
export const CORRECTABLE_FIELDS = [
  'firstIn',
  'lastOut',
  'workMinutes',
  'lateMinutes',
  'earlyLeaveMinutes',
  'overtimeMinutes',
  'absenceMinutes',
  'status',
  'note',
] as const;

export type CorrectableField = (typeof CORRECTABLE_FIELDS)[number];

// ---------------------------------------------------------------------------
// دستگاه‌های حضور و غیاب
// ---------------------------------------------------------------------------

export class CreateDeviceDto {
  @ApiProperty({ format: 'uuid', description: 'شناسه شرکت' })
  @IsUUID('4', { message: 'شناسه شرکت معتبر نیست.' })
  companyId: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'شناسه شعبه' })
  @IsOptional()
  @IsUUID('4', { message: 'شناسه شعبه معتبر نیست.' })
  branchId?: string;

  @ApiProperty({ example: 'DEV-001', description: 'کد یکتای دستگاه' })
  @IsString({ message: 'کد دستگاه الزامی است.' })
  @MaxLength(40, { message: 'کد دستگاه حداکثر ۴۰ نویسه است.' })
  code: string;

  @ApiProperty({ example: 'کارت‌خوان ورودی ساختمان مرکزی' })
  @IsString({ message: 'نام دستگاه الزامی است.' })
  @MaxLength(120, { message: 'نام دستگاه حداکثر ۱۲۰ نویسه است.' })
  name: string;

  @ApiPropertyOptional({ example: 'CARD_READER', description: 'نوع دستگاه' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  deviceType?: string;

  @ApiPropertyOptional({ description: 'آدرس سرویس همگام‌سازی دستگاه' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  apiUrl?: string;

  @ApiPropertyOptional({ description: 'کلید امن ارتباط با دستگاه' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  secret?: string;
}

export class UpdateDeviceDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: 'شناسه شعبه معتبر نیست.' })
  branchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120, { message: 'نام دستگاه حداکثر ۱۲۰ نویسه است.' })
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  deviceType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  apiUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  secret?: string;

  @ApiPropertyOptional({ description: 'فعال بودن دستگاه' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;
}

export class DeviceQueryDto extends PaginationDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'فقط دستگاه‌های یک شرکت' })
  @IsOptional()
  @IsUUID('4')
  companyId?: string;

  @ApiPropertyOptional({ description: 'فقط دستگاه‌های فعال' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;
}

// ---------------------------------------------------------------------------
// رویدادهای حضور و غیاب
// ---------------------------------------------------------------------------

export class AttendanceEventDto {
  @ApiProperty({ format: 'uuid', description: 'کارمند' })
  @IsUUID('4', { message: 'شناسه کارمند معتبر نیست.' })
  employeeId: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'دستگاه ثبت‌کننده رویداد' })
  @IsOptional()
  @IsUUID('4', { message: 'شناسه دستگاه معتبر نیست.' })
  deviceId?: string;

  @ApiProperty({ enum: AttendanceEventType, description: 'نوع رویداد: ورود یا خروج' })
  @IsEnum(AttendanceEventType, { message: 'نوع رویداد معتبر نیست.' })
  type: AttendanceEventType;

  @ApiProperty({ example: '2026-11-12T08:15:00.000Z', description: 'زمان ثبت‌شده روی دستگاه' })
  @IsDateString({}, { message: 'قالب زمان رویداد معتبر نیست.' })
  eventTime: string;

  @ApiProperty({ enum: AttendanceSource, description: 'منبع ثبت رویداد' })
  @IsEnum(AttendanceSource, { message: 'منبع رویداد معتبر نیست.' })
  source: AttendanceSource;

  @ApiPropertyOptional({ description: 'کلید یکتای درخواست (در صورت ارسال، جایگزین کلید خودکار می‌شود)' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  idempotencyKey?: string;

  @ApiPropertyOptional({ description: 'عرض جغرافیایی' })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ description: 'طول جغرافیایی' })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional({ description: 'نام محل ثبت' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  locationName?: string;

  @ApiPropertyOptional({ description: 'داده خام دریافتی از دستگاه' })
  @IsOptional()
  @IsString()
  rawPayload?: string;
}

/** درخواست ثبت رویداد — هم تکی و هم گروهی پذیرفته می‌شود. */
export class IngestEventsDto {
  @ApiPropertyOptional({ type: [AttendanceEventDto], description: 'فهرست رویدادها برای ثبت گروهی' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => AttendanceEventDto)
  events?: AttendanceEventDto[];

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: 'شناسه کارمند معتبر نیست.' })
  employeeId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: 'شناسه دستگاه معتبر نیست.' })
  deviceId?: string;

  @ApiPropertyOptional({ enum: AttendanceEventType })
  @IsOptional()
  @IsEnum(AttendanceEventType, { message: 'نوع رویداد معتبر نیست.' })
  type?: AttendanceEventType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({}, { message: 'قالب زمان رویداد معتبر نیست.' })
  eventTime?: string;

  @ApiPropertyOptional({ enum: AttendanceSource })
  @IsOptional()
  @IsEnum(AttendanceSource, { message: 'منبع رویداد معتبر نیست.' })
  source?: AttendanceSource;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  idempotencyKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  locationName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rawPayload?: string;
}

// ---------------------------------------------------------------------------
// محاسبه و گزارش‌ها
// ---------------------------------------------------------------------------

export class ComputeAttendanceDto {
  @ApiPropertyOptional({ type: [String], format: 'uuid', description: 'کارمندان مشخص برای محاسبه' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true, message: 'شناسه کارمند معتبر نیست.' })
  employeeIds?: string[];

  @ApiPropertyOptional({ format: 'uuid', description: 'واحد سازمانی' })
  @IsOptional()
  @IsUUID('4', { message: 'شناسه واحد سازمانی معتبر نیست.' })
  orgUnitId?: string;

  @ApiProperty({ example: '2026-11-01', description: 'تاریخ شروع بازه' })
  @IsDateString({}, { message: 'قالب تاریخ شروع معتبر نیست.' })
  from: string;

  @ApiProperty({ example: '2026-11-30', description: 'تاریخ پایان بازه' })
  @IsDateString({}, { message: 'قالب تاریخ پایان معتبر نیست.' })
  to: string;
}

export class AttendanceRecordQueryDto extends PaginationDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: 'شناسه کارمند معتبر نیست.' })
  employeeId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: 'شناسه واحد سازمانی معتبر نیست.' })
  orgUnitId?: string;

  @ApiPropertyOptional({ example: '2026-11-01' })
  @IsOptional()
  @IsDateString({}, { message: 'قالب تاریخ شروع معتبر نیست.' })
  from?: string;

  @ApiPropertyOptional({ example: '2026-11-30' })
  @IsOptional()
  @IsDateString({}, { message: 'قالب تاریخ پایان معتبر نیست.' })
  to?: string;

  @ApiPropertyOptional({ enum: AttendanceRecordStatus })
  @IsOptional()
  @IsEnum(AttendanceRecordStatus, { message: 'وضعیت حضور معتبر نیست.' })
  status?: AttendanceRecordStatus;
}

export class MyAttendanceQueryDto {
  @ApiProperty({ example: '2026-11-01' })
  @IsDateString({}, { message: 'قالب تاریخ شروع معتبر نیست.' })
  from: string;

  @ApiProperty({ example: '2026-11-30' })
  @IsDateString({}, { message: 'قالب تاریخ پایان معتبر نیست.' })
  to: string;
}

export class MonthlySheetDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'شرکت' })
  @IsOptional()
  @IsUUID('4', { message: 'شناسه شرکت معتبر نیست.' })
  companyId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'واحد سازمانی' })
  @IsOptional()
  @IsUUID('4', { message: 'شناسه واحد سازمانی معتبر نیست.' })
  orgUnitId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'کارمند مشخص' })
  @IsOptional()
  @IsUUID('4', { message: 'شناسه کارمند معتبر نیست.' })
  employeeId?: string;

  @ApiProperty({ example: 1404, description: 'سال شمسی' })
  @Type(() => Number)
  @IsInt({ message: 'سال باید عدد صحیح باشد.' })
  @Min(1300, { message: 'سال شمسی نامعتبر است.' })
  @Max(1500, { message: 'سال شمسی نامعتبر است.' })
  year: number;

  @ApiProperty({ example: 7, description: 'ماه شمسی (۱ تا ۱۲)' })
  @Type(() => Number)
  @IsInt({ message: 'ماه باید عدد صحیح باشد.' })
  @Min(1, { message: 'ماه باید بین ۱ تا ۱۲ باشد.' })
  @Max(12, { message: 'ماه باید بین ۱ تا ۱۲ باشد.' })
  month: number;
}

// ---------------------------------------------------------------------------
// اصلاحیه‌های حضور و غیاب
// ---------------------------------------------------------------------------

export class CreateCorrectionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4', { message: 'شناسه کارمند معتبر نیست.' })
  employeeId: string;

  @ApiProperty({ example: '2026-11-12', description: 'روز کاری مورد اصلاح' })
  @IsDateString({}, { message: 'قالب تاریخ کاری معتبر نیست.' })
  workDate: string;

  @ApiProperty({
    enum: CORRECTABLE_FIELDS,
    description: 'فیلد مورد اصلاح',
  })
  @IsIn(CORRECTABLE_FIELDS, { message: 'فیلد قابل اصلاح معتبر نیست.' })
  field: CorrectableField;

  @ApiProperty({ example: '2026-11-12T08:30:00.000Z', description: 'مقدار جدید' })
  @IsString({ message: 'مقدار جدید الزامی است.' })
  @MaxLength(120, { message: 'مقدار جدید حداکثر ۱۲۰ نویسه است.' })
  newValue: string;

  @ApiProperty({ example: 'اختلاف ساعت ثبت دستگاه با ساعت ورود واقعی' })
  @IsString({ message: 'علت اصلاح الزامی است.' })
  @MinLength(3, { message: 'علت اصلاح باید حداقل ۳ نویسه باشد.' })
  @MaxLength(500, { message: 'علت اصلاح حداکثر ۵۰۰ نویسه است.' })
  reason: string;
}

export class DecideCorrectionDto {
  @ApiProperty({ enum: ['APPROVE', 'REJECT'], description: 'نتیجه بررسی' })
  @IsIn(['APPROVE', 'REJECT'], { message: 'نتیجه بررسی معتبر نیست.' })
  decision: 'APPROVE' | 'REJECT';

  @ApiPropertyOptional({ description: 'توضیح بررسی‌کننده' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}

export class CorrectionQueryDto extends PaginationDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  employeeId?: string;

  @ApiPropertyOptional({ description: 'وضعیت اصلاحیه' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  status?: string;
}
