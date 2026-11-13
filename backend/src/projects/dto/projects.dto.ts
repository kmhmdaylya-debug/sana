import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ProjectPriority, ProjectStatus } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

// ---------------------------------------------------------------------------
// پروژه
// ---------------------------------------------------------------------------

export class CreateProjectDto {
  @ApiProperty({ example: 'PRJ-1404-01' })
  @IsString({ message: 'کد پروژه الزامی است.' })
  @MaxLength(40)
  code: string;

  @ApiProperty({ example: 'راه‌اندازی سامانهٔ حضور و غیاب' })
  @IsString({ message: 'عنوان پروژه الزامی است.' })
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ example: '2026-11-01' })
  @IsDateString({}, { message: 'قالب تاریخ شروع معتبر نیست.' })
  startDate: string;

  @ApiProperty({ example: '2026-12-30' })
  @IsDateString({}, { message: 'قالب تاریخ پایان معتبر نیست.' })
  endDate: string;

  @ApiPropertyOptional({ enum: ProjectStatus, default: ProjectStatus.PLANNING })
  @IsOptional()
  @IsEnum(ProjectStatus, { message: 'وضعیت پروژه معتبر نیست.' })
  status?: ProjectStatus;

  @ApiPropertyOptional({ enum: ProjectPriority, default: ProjectPriority.MEDIUM })
  @IsOptional()
  @IsEnum(ProjectPriority, { message: 'اولویت پروژه معتبر نیست.' })
  priority?: ProjectPriority;

  @ApiPropertyOptional({ default: 0, minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt({ message: 'درصد پیشرفت باید عدد صحیح باشد.' })
  @Min(0)
  @Max(100)
  progress?: number;

  @ApiPropertyOptional({ example: '#2563eb' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  color?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'مدیر پروژه' })
  @IsOptional()
  @IsUUID('4', { message: 'شناسهٔ مدیر پروژه معتبر نیست.' })
  managerId?: string;

  @ApiPropertyOptional({ type: [String], format: 'uuid', description: 'اعضای پروژه' })
  @IsOptional()
  @IsUUID('4', { each: true })
  memberIds?: string[];
}

export class UpdateProjectDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({}, { message: 'قالب تاریخ شروع معتبر نیست.' })
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({}, { message: 'قالب تاریخ پایان معتبر نیست.' })
  endDate?: string;

  @ApiPropertyOptional({ enum: ProjectStatus })
  @IsOptional()
  @IsEnum(ProjectStatus, { message: 'وضعیت پروژه معتبر نیست.' })
  status?: ProjectStatus;

  @ApiPropertyOptional({ enum: ProjectPriority })
  @IsOptional()
  @IsEnum(ProjectPriority, { message: 'اولویت پروژه معتبر نیست.' })
  priority?: ProjectPriority;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  progress?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  color?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: 'شناسهٔ مدیر پروژه معتبر نیست.' })
  managerId?: string;

  @ApiPropertyOptional({ type: [String], format: 'uuid' })
  @IsOptional()
  @IsUUID('4', { each: true })
  memberIds?: string[];
}

export class ProjectQueryDto extends PaginationDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  companyId?: string;

  @ApiPropertyOptional({ enum: ProjectStatus })
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @ApiPropertyOptional({ enum: ProjectPriority })
  @IsOptional()
  @IsEnum(ProjectPriority)
  priority?: ProjectPriority;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  managerId?: string;
}

export class TimelineQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  companyId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'فقط پروژهٔ مشخص' })
  @IsOptional()
  @IsUUID('4')
  projectId?: string;

  @ApiPropertyOptional({ description: 'از تاریخ (میلادی)' })
  @IsOptional()
  @IsDateString({}, { message: 'قالب تاریخ از معتبر نیست.' })
  from?: string;

  @ApiPropertyOptional({ description: 'تا تاریخ (میلادی)' })
  @IsOptional()
  @IsDateString({}, { message: 'قالب تاریخ تا معتبر نیست.' })
  to?: string;
}

// ---------------------------------------------------------------------------
// وظیفهٔ پروژه (بخش گانت چارت)
// ---------------------------------------------------------------------------

export class CreateProjectTaskDto {
  @ApiProperty({ example: 'طراحی رابط کاربری' })
  @IsString({ message: 'عنوان وظیفه الزامی است.' })
  @MinLength(2)
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ example: 'تحلیل و طراحی' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  phase?: string;

  @ApiProperty({ example: '2026-11-05' })
  @IsDateString({}, { message: 'قالب تاریخ شروع معتبر نیست.' })
  startDate: string;

  @ApiProperty({ example: '2026-11-15' })
  @IsDateString({}, { message: 'قالب تاریخ پایان معتبر نیست.' })
  endDate: string;

  @ApiPropertyOptional({ default: 0, minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  progress?: number;

  @ApiPropertyOptional({ default: 'PENDING' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  status?: string;

  @ApiPropertyOptional({ default: 'MEDIUM' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  priority?: string;

  @ApiPropertyOptional({ example: '#0ea5e9' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  color?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'مسئول اجرا' })
  @IsOptional()
  @IsUUID('4', { message: 'شناسهٔ مسئول معتبر نیست.' })
  assigneeId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'وظیفهٔ پیش‌نیاز (برای خط وابستگی)' })
  @IsOptional()
  @IsUUID('4', { message: 'شناسهٔ پیش‌نیاز معتبر نیست.' })
  dependsOnId?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateProjectTaskDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  phase?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({}, { message: 'قالب تاریخ شروع معتبر نیست.' })
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({}, { message: 'قالب تاریخ پایان معتبر نیست.' })
  endDate?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  progress?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  priority?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  color?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  assigneeId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  dependsOnId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
