import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ShiftKind } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class CreateShiftDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  companyId: string;

  @ApiProperty({ example: 'M1' })
  @IsString()
  @MaxLength(40)
  code: string;

  @ApiProperty({ example: 'شیفت صبح' })
  @IsString()
  @MaxLength(120)
  name: string;

  @ApiProperty({ enum: ShiftKind, default: ShiftKind.MORNING })
  @IsOptional()
  @IsEnum(ShiftKind)
  kind?: ShiftKind;

  @ApiProperty({ example: '08:00' })
  @IsString({ message: 'ساعت شروع الزامی است.' })
  @Matches(HHMM, { message: 'ساعت شروع باید با قالب HH:mm باشد.' })
  startTime: string;

  @ApiProperty({ example: '16:00' })
  @IsString({ message: 'ساعت پایان الزامی است.' })
  @Matches(HHMM, { message: 'ساعت پایان باید با قالب HH:mm باشد.' })
  endTime: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  crossMidnight?: boolean;

  @ApiPropertyOptional({ default: 480 })
  @IsOptional()
  @IsInt()
  @Min(1)
  durationMinutes?: number;

  @ApiPropertyOptional({ default: 60 })
  @IsOptional()
  @IsInt()
  @Min(0)
  breakMinutes?: number;

  @ApiPropertyOptional({ default: 0, description: 'ظرفیت (۰ = بدون محدودیت)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  capacity?: number;

  @ApiPropertyOptional({ default: 12 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxDailyHours?: number;

  @ApiPropertyOptional({ default: 480 })
  @IsOptional()
  @IsInt()
  @Min(0)
  restAfterMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  requiredCertificate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  color?: string;
}

export class UpdateShiftDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ enum: ShiftKind })
  @IsOptional()
  @IsEnum(ShiftKind)
  kind?: ShiftKind;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(HHMM, { message: 'ساعت شروع باید با قالب HH:mm باشد.' })
  startTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(HHMM, { message: 'ساعت پایان باید با قالب HH:mm باشد.' })
  endTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  crossMidnight?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  durationMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  breakMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  capacity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;
}

export class ShiftQueryDto extends PaginationDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  companyId?: string;

  @ApiPropertyOptional({ enum: ShiftKind })
  @IsOptional()
  @IsEnum(ShiftKind)
  kind?: ShiftKind;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;
}

// ---------------------------------------------------------------------------
// تخصیص شیفت
// ---------------------------------------------------------------------------

export class AssignmentEntryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  employeeId: string;

  @ApiProperty({ example: '2026-05-01' })
  @IsDateString({}, { message: 'قالب تاریخ کاری نامعتبر است.' })
  workDate: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  shiftId: string;
}

export class BulkAssignDto {
  @ApiProperty({ type: [AssignmentEntryDto] })
  @IsArray({ message: 'فهرست تخصیص‌ها الزامی است.' })
  @ValidateNested({ each: true })
  @Type(() => AssignmentEntryDto)
  assignments: AssignmentEntryDto[];
}

export class AssignmentQueryDto extends PaginationDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  employeeId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  shiftId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  orgUnitId?: string;

  @ApiProperty({ example: '2026-05-01' })
  @IsDateString({}, { message: 'قالب تاریخ از نامعتبر است.' })
  from: string;

  @ApiProperty({ example: '2026-05-07' })
  @IsDateString({}, { message: 'قالب تاریخ تا نامعتبر است.' })
  to: string;
}

// ---------------------------------------------------------------------------
// تعویض شیفت
// ---------------------------------------------------------------------------

export class CreateSwapDto {
  @ApiProperty({ format: 'uuid', description: 'تخصیص منبع (شیفت خودم)' })
  @IsUUID('4')
  sourceAssignmentId: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'تخصیص هدف (شیفت همکار) — در تعویض دوطرفه' })
  @IsOptional()
  @IsUUID('4')
  targetAssignmentId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'نیروی هدف در تحویل تک‌طرفه' })
  @IsOptional()
  @IsUUID('4')
  toEmployeeId?: string;

  @ApiProperty()
  @IsString({ message: 'دلیل تعویض الزامی است.' })
  @MaxLength(500)
  reason: string;
}

export class DecideSwapDto {
  @ApiProperty({ enum: ['APPROVE', 'REJECT'] })
  @IsIn(['APPROVE', 'REJECT'], { message: 'تصمیم باید تأیید یا رد باشد.' })
  decision: 'APPROVE' | 'REJECT';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}

export class SwapQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ['PENDING', 'APPROVED', 'REJECTED'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ default: false, description: 'فقط درخواست‌های من' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  mine?: boolean;
}
