import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { MissionStatus } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class CreateMissionDto {
  @ApiProperty({ format: 'uuid', description: 'کارمند مأمور' })
  @IsUUID('4', { message: 'شناسه کارمند معتبر نیست.' })
  employeeId: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'واحد سازمانی' })
  @IsOptional()
  @IsUUID('4', { message: 'شناسه واحد سازمانی معتبر نیست.' })
  orgUnitId?: string;

  @ApiProperty({ example: 'بازدید از کارخانه تهران' })
  @IsString({ message: 'عنوان مأموریت الزامی است.' })
  @MinLength(3, { message: 'عنوان مأموریت باید حداقل ۳ نویسه باشد.' })
  @MaxLength(200, { message: 'عنوان مأموریت حداکثر ۲۰۰ نویسه است.' })
  title: string;

  @ApiProperty({ example: 'تهران، شهرک صنعتی' })
  @IsString({ message: 'مقصد مأموریت الزامی است.' })
  @MinLength(2, { message: 'مقصد مأموریت باید حداقل ۲ نویسه باشد.' })
  @MaxLength(200, { message: 'مقصد مأموریت حداکثر ۲۰۰ نویسه است.' })
  destination: string;

  @ApiPropertyOptional({ description: 'هدف و شرح مأموریت' })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'هدف مأموریت حداکثر ۵۰۰ نویسه است.' })
  purpose?: string;

  @ApiProperty({ example: '2026-11-12T08:00:00.000Z', description: 'زمان شروع' })
  @IsDateString({}, { message: 'قالب زمان شروع معتبر نیست.' })
  startAt: string;

  @ApiProperty({ example: '2026-11-13T16:00:00.000Z', description: 'زمان پایان' })
  @IsDateString({}, { message: 'قالب زمان پایان معتبر نیست.' })
  endAt: string;

  @ApiPropertyOptional({ example: 'خودروی سازمانی', description: 'وسیله سفر' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  transport?: string;

  @ApiPropertyOptional({ example: 'پروژه توسعه خط سه', description: 'نام پروژه' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  projectName?: string;

  @ApiPropertyOptional({ example: 5000000, description: 'هزینه تخمینی (ریال)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'هزینه تخمینی باید عدد صحیح باشد.' })
  @Min(0, { message: 'هزینه تخمینی نمی‌تواند منفی باشد.' })
  estimatedCost?: number;

  @ApiPropertyOptional({
    description: 'معافیت حضور و غیاب در روزهای مأموریت (پیش‌فرض: بله)',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isAttendanceExempt?: boolean;
}

export class UpdateMissionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  destination?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  purpose?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({}, { message: 'قالب زمان شروع معتبر نیست.' })
  startAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({}, { message: 'قالب زمان پایان معتبر نیست.' })
  endAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  transport?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  projectName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'هزینه تخمینی باید عدد صحیح باشد.' })
  @Min(0, { message: 'هزینه تخمینی نمی‌تواند منفی باشد.' })
  estimatedCost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isAttendanceExempt?: boolean;
}

export class MissionQueryDto extends PaginationDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: 'شناسه کارمند معتبر نیست.' })
  employeeId?: string;

  @ApiPropertyOptional({ enum: MissionStatus })
  @IsOptional()
  @IsEnum(MissionStatus, { message: 'وضعیت مأموریت معتبر نیست.' })
  status?: MissionStatus;

  @ApiPropertyOptional({ example: '2026-11-01', description: 'از تاریخ' })
  @IsOptional()
  @IsDateString({}, { message: 'قالب تاریخ شروع معتبر نیست.' })
  from?: string;

  @ApiPropertyOptional({ example: '2026-11-30', description: 'تا تاریخ' })
  @IsOptional()
  @IsDateString({}, { message: 'قالب تاریخ پایان معتبر نیست.' })
  to?: string;
}

export class CompleteMissionDto {
  @ApiProperty({ description: 'گزارش نهایی مأموریت' })
  @IsString({ message: 'گزارش مأموریت الزامی است.' })
  @MinLength(3, { message: 'گزارش مأموریت باید حداقل ۳ نویسه باشد.' })
  report: string;

  @ApiPropertyOptional({ example: 4800000, description: 'هزینه واقعی (ریال)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'هزینه واقعی باید عدد صحیح باشد.' })
  @Min(0, { message: 'هزینه واقعی نمی‌تواند منفی باشد.' })
  actualCost?: number;
}

export class CreateMissionExpenseDto {
  @ApiProperty({ example: 'هزینه سوخت و ایاب و ذهاب' })
  @IsString({ message: 'شرح هزینه الزامی است.' })
  @MinLength(2, { message: 'شرح هزینه باید حداقل ۲ نویسه باشد.' })
  @MaxLength(300, { message: 'شرح هزینه حداکثر ۳۰۰ نویسه است.' })
  description: string;

  @ApiProperty({ example: 1500000, description: 'مبلغ هزینه (ریال)' })
  @Type(() => Number)
  @IsInt({ message: 'مبلغ هزینه باید عدد صحیح باشد.' })
  @Min(0, { message: 'مبلغ هزینه نمی‌تواند منفی باشد.' })
  amount: number;

  @ApiProperty({ example: '2026-11-12', description: 'تاریخ انجام هزینه' })
  @IsDateString({}, { message: 'قالب تاریخ هزینه معتبر نیست.' })
  spentAt: string;

  @ApiPropertyOptional({ description: 'مسیر فایل رسید' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  receiptPath?: string;
}

export class DecideExpenseDto {
  @ApiProperty({ enum: ['APPROVE', 'REJECT'], description: 'نتیجه بررسی هزینه' })
  @IsIn(['APPROVE', 'REJECT'], { message: 'نتیجه بررسی معتبر نیست.' })
  decision: 'APPROVE' | 'REJECT';

  @ApiPropertyOptional({ description: 'توضیح بررسی‌کننده' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}

export class AttendanceImpactQueryDto {
  @ApiProperty({ format: 'uuid', description: 'کارمند' })
  @IsUUID('4', { message: 'شناسه کارمند معتبر نیست.' })
  employeeId: string;

  @ApiProperty({ example: '2026-11-01' })
  @IsDateString({}, { message: 'قالب تاریخ شروع معتبر نیست.' })
  from: string;

  @ApiProperty({ example: '2026-11-30' })
  @IsDateString({}, { message: 'قالب تاریخ پایان معتبر نیست.' })
  to: string;
}
