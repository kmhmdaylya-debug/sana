import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApprovalDecision, ApprovalSubjectType } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

/**
 * تبدیل مقدار متنی/عددی به boolean.
 * برای پارامترهای پرس‌وجو لازم است چون «false» به‌صورت رشته دریافت می‌شود.
 */
export const ToBoolean = (): PropertyDecorator =>
  Transform(({ value }) => value === true || value === 'true' || value === '1' || value === 1);

/** انواع تعیین‌کننده تأییدکننده در یک مرحله */
export enum ApproverType {
  ROLE = 'ROLE',
  MANAGER = 'MANAGER',
  HR = 'HR',
  FINANCE = 'FINANCE',
  SUPERVISOR = 'SUPERVISOR',
  USER = 'USER',
}

/** اقدام در صورت عدم اقدام تأییدکننده در مهلت SLA */
export enum TimeoutAction {
  ESCALATE = 'ESCALATE',
  SKIP = 'SKIP',
  REJECT = 'REJECT',
}

/** یک مرحله از گردش تأیید */
export class ApprovalStepDto {
  @ApiProperty({ example: 1, description: 'ترتیب مرحله — از ۱ شروع می‌شود' })
  @Type(() => Number)
  @IsInt({ message: 'شماره مرحله باید عدد صحیح باشد.' })
  @Min(1, { message: 'شماره مرحله باید حداقل ۱ باشد.' })
  stepOrder: number;

  @ApiProperty({ example: 'سرپرست' })
  @IsString({ message: 'نام مرحله الزامی است.' })
  @MaxLength(120)
  name: string;

  @ApiProperty({ enum: ApproverType, example: ApproverType.SUPERVISOR })
  @IsEnum(ApproverType, { message: 'نوع تأییدکننده معتبر نیست.' })
  approverType: ApproverType;

  @ApiPropertyOptional({ example: 'hr.manager', description: 'کد نقش — برای نوع ROLE' })
  @IsOptional()
  @IsString({ message: 'کد نقش باید رشته باشد.' })
  @MaxLength(60)
  approverRoleCode?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'کاربر مشخص — برای نوع USER' })
  @IsOptional()
  @IsUUID('4', { message: 'شناسه کاربر معتبر نیست.' })
  approverUserId?: string;

  @ApiPropertyOptional({
    description: 'شرط اجرای مرحله به‌صورت JSON — مثال: { "field": "days", "operator": "gt", "value": 3 }',
    type: Object,
    additionalProperties: true,
  })
  @IsOptional()
  conditionJson?: string | Record<string, unknown>;

  @ApiPropertyOptional({ default: 48, description: 'مهلت پاسخ‌گویی به ساعت' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'مهلت پاسخ‌گویی باید عدد صحیح باشد.' })
  @Min(1, { message: 'مهلت پاسخ‌گویی باید حداقل ۱ ساعت باشد.' })
  @Max(720, { message: 'مهلت پاسخ‌گویی حداکثر ۷۲۰ ساعت است.' })
  slaHours?: number;

  @ApiPropertyOptional({ enum: TimeoutAction, default: TimeoutAction.ESCALATE })
  @IsOptional()
  @IsEnum(TimeoutAction, { message: 'اقدام در صورت اتمام مهلت معتبر نیست.' })
  onTimeout?: TimeoutAction;

  @ApiPropertyOptional({ default: true, description: 'مرحله الزامی است یا خیر' })
  @IsOptional()
  @IsBoolean()
  @ToBoolean()
  required?: boolean;
}

export class CreateApprovalFlowDto {
  @ApiProperty({ example: 'LEAVE_REQUEST' })
  @IsString({ message: 'کد گردش تأیید الزامی است.' })
  @MaxLength(60)
  code: string;

  @ApiProperty({ example: 'گردش تأیید مرخصی' })
  @IsString({ message: 'نام گردش تأیید الزامی است.' })
  @MaxLength(160)
  name: string;

  @ApiProperty({ enum: ApprovalSubjectType, example: ApprovalSubjectType.LEAVE })
  @IsEnum(ApprovalSubjectType, { message: 'نوع موضوع گردش تأیید معتبر نیست.' })
  subjectType: ApprovalSubjectType;

  @ApiPropertyOptional({ example: 'سرپرست ← مدیر واحد ← منابع انسانی' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: 'شناسه شرکت معتبر نیست.' })
  companyId?: string;

  @ApiProperty({ type: [ApprovalStepDto] })
  @IsArray({ message: 'حداقل یک مرحله تعریف کنید.' })
  @ValidateNested({ each: true })
  @Type(() => ApprovalStepDto)
  steps: ApprovalStepDto[];
}

/** ویرایش گردش تأیید — نسخه جدید ساخته می‌شود و نسخه قبلی غیرفعال می‌گردد. */
export class UpdateApprovalFlowDto {
  @ApiPropertyOptional({ example: 'گردش تأیید مرخصی (نسخه ۲)' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  @ToBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ type: [ApprovalStepDto], description: 'مراحل نسخه جدید' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApprovalStepDto)
  steps?: ApprovalStepDto[];
}

export class ApprovalFlowQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ApprovalSubjectType })
  @IsOptional()
  @IsEnum(ApprovalSubjectType, { message: 'نوع موضوع معتبر نیست.' })
  subjectType?: ApprovalSubjectType;

  @ApiPropertyOptional({ example: 'LEAVE' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @ToBoolean()
  isActive?: boolean;
}

export class CreateApprovalInstanceDto {
  @ApiProperty({ example: 'LEAVE_REQUEST' })
  @IsString({ message: 'کد گردش تأیید الزامی است.' })
  @MaxLength(60)
  flowCode: string;

  @ApiProperty({ enum: ApprovalSubjectType, example: ApprovalSubjectType.LEAVE })
  @IsEnum(ApprovalSubjectType, { message: 'نوع موضوع معتبر نیست.' })
  subjectType: ApprovalSubjectType;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4', { message: 'شناسه رکورد موضوع معتبر نیست.' })
  subjectId: string;

  @ApiPropertyOptional({ description: 'اطلاعات تکمیلی برای شرط‌های مرحله — به‌صورت JSON', type: Object })
  @IsOptional()
  payloadJson?: string | Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ApprovalInstanceQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ApprovalSubjectType })
  @IsOptional()
  @IsEnum(ApprovalSubjectType, { message: 'نوع موضوع معتبر نیست.' })
  subjectType?: ApprovalSubjectType;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: 'شناسه رکورد موضوع معتبر نیست.' })
  subjectId?: string;

  @ApiPropertyOptional({ enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED', 'NEEDS_REVISION', 'REFERRED'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'فقط نمونه‌هایی که task باز برای من دارند' })
  @IsOptional()
  @IsBoolean()
  @ToBoolean()
  myTasksOnly?: boolean;

  @ApiPropertyOptional({ description: 'فقط نمونه‌هایی که من ثبت کرده‌ام' })
  @IsOptional()
  @IsBoolean()
  @ToBoolean()
  initiatedByMe?: boolean;
}

export class InboxQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'فقط task سررسیدشده' })
  @IsOptional()
  @IsBoolean()
  @ToBoolean()
  overdueOnly?: boolean;
}

/** تصمیم‌گیری درباره یک task تأیید */
export class DecideTaskDto {
  @ApiProperty({ enum: ApprovalDecision, example: ApprovalDecision.APPROVE })
  @IsEnum(ApprovalDecision, { message: 'نوع تصمیم معتبر نیست.' })
  decision: ApprovalDecision;

  @ApiPropertyOptional({ example: 'تأیید شد.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'کاربر مقصد ارجاع — برای تصمیم REFER' })
  @IsOptional()
  @IsUUID('4', { message: 'شناسه کاربر ارجاع معتبر نیست.' })
  referredToUserId?: string;
}

export class ExpireOverdueDto {
  @ApiPropertyOptional({ default: 100, description: 'حداکثر تعداد task پردازش‌شده در هر بار' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'تعداد باید عدد صحیح باشد.' })
  @Min(1)
  @Max(500)
  limit?: number;
}
