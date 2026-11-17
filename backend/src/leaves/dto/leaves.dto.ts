import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import {
  EmploymentType,
  LeaveRequestStatus,
  LeaveTransactionType,
  LeaveTypeCode,
} from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

// ---------------------------------------------------------------------------
// نوع مرخصی
// ---------------------------------------------------------------------------

export class CreateLeaveTypeDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  companyId: string;

  @ApiProperty({ enum: LeaveTypeCode })
  @IsEnum(LeaveTypeCode, { message: 'کد نوع مرخصی معتبر نیست.' })
  code: LeaveTypeCode;

  @ApiProperty({ example: 'مرخصی استحقاقی' })
  @IsString()
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isPaid?: boolean;

  @ApiPropertyOptional({ default: 0, description: 'سهمیه سالانه (دقیقه)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  annualQuotaMinutes?: number;

  @ApiPropertyOptional({ default: 0, description: 'سقف انتقال به سال بعد (دقیقه)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  carryoverLimitMinutes?: number;

  @ApiPropertyOptional({ default: 0, description: 'واگذاری ماهانه پیش‌فرض (دقیقه)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  monthlyGrantMinutes?: number;

  @ApiPropertyOptional({ default: 480 })
  @IsOptional()
  @IsInt()
  @Min(30)
  maxDailyMinutes?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  requiresDocument?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  color?: string;
}

export class UpdateLeaveTypeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isPaid?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  annualQuotaMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  carryoverLimitMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  monthlyGrantMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(30)
  maxDailyMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  requiresDocument?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;
}

export class LeaveTypeQueryDto extends PaginationDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  employeeId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  companyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;
}

// ---------------------------------------------------------------------------
// سیاست مرخصی
// ---------------------------------------------------------------------------

export class CreateLeavePolicyDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  leaveTypeId: string;

  @ApiProperty({ enum: EmploymentType })
  @IsEnum(EmploymentType)
  employmentType: EmploymentType;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  minSeniorityMonths?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  monthlyGrantMinutes?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  annualQuotaMinutes?: number;
}

// ---------------------------------------------------------------------------
// درخواست مرخصی
// ---------------------------------------------------------------------------

export class CreateLeaveRequestDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  employeeId: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  leaveTypeId: string;

  @ApiProperty({ example: '2026-05-10T08:00:00.000Z' })
  @IsDateString({}, { message: 'قالب شروع مرخصی نامعتبر است.' })
  startAt: string;

  @ApiProperty({ example: '2026-05-12T16:00:00.000Z' })
  @IsDateString({}, { message: 'قالب پایان مرخصی نامعتبر است.' })
  endAt: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class DecideLeaveRequestDto {
  @ApiProperty({ enum: ['APPROVE', 'REJECT', 'NEEDS_REVISION'] })
  @IsIn(['APPROVE', 'REJECT', 'NEEDS_REVISION'], { message: 'تصمیم نامعتبر است.' })
  decision: 'APPROVE' | 'REJECT' | 'NEEDS_REVISION';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}

export class LeaveRequestQueryDto extends PaginationDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  employeeId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  leaveTypeId?: string;

  @ApiPropertyOptional({ enum: LeaveRequestStatus })
  @IsOptional()
  @IsEnum(LeaveRequestStatus)
  status?: LeaveRequestStatus;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsDateString({})
  from?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString({})
  to?: string;

  @ApiPropertyOptional({ default: false, description: 'فقط درخواست‌های خودم' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  mine?: boolean;
}

// ---------------------------------------------------------------------------
// مانده مرخصی
// ---------------------------------------------------------------------------

export class LeaveBalanceQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  employeeId: string;

  @ApiPropertyOptional({ description: 'سال جلالی — پیش‌فرض سال جاری' })
  @IsOptional()
  @IsInt()
  @Min(1300)
  year?: number;
}

export class AdjustBalanceDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  employeeId: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  leaveTypeId: string;

  @ApiProperty({ enum: LeaveTransactionType })
  @IsEnum(LeaveTransactionType, { message: 'نوع تراکنش معتبر نیست.' })
  type: LeaveTransactionType;

  @ApiProperty({ description: 'مقدار تغییر (دقیقه — مثبت/منفی)' })
  @IsInt({ message: 'مقدار باید عدد صحیح باشد.' })
  minutes: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class LeaveTransactionQueryDto extends PaginationDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  employeeId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  leaveTypeId?: string;
}
