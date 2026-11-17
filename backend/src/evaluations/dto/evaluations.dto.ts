import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

/** انواع مقیاس نمره‌دهی سؤال ارزیابی */
export const EVALUATION_SCALE_TYPES = ['NUMERIC', 'QUALITATIVE', 'MIXED'] as const;
export type EvaluationScaleType = (typeof EVALUATION_SCALE_TYPES)[number];

/** انواع دوره ارزیابی */
export const EVALUATION_PERIOD_TYPES = ['MONTHLY', 'QUARTERLY', 'YEARLY', 'ADHOC'] as const;
export type EvaluationPeriodType = (typeof EVALUATION_PERIOD_TYPES)[number];

/** وضعیت دوره ارزیابی */
export const EVALUATION_CYCLE_STATUSES = ['PLANNED', 'ACTIVE', 'CLOSED', 'CANCELLED'] as const;
export type EvaluationCycleStatus = (typeof EVALUATION_CYCLE_STATUSES)[number];

/** نوع ارزیابی (خودارزیابی / ارزیابی سرپرست) */
export const EVALUATION_TYPES = ['SELF', 'SUPERVISOR'] as const;
export type EvaluationType = (typeof EVALUATION_TYPES)[number];

/** وضعیت رکورد ارزیابی */
export const EVALUATION_STATUSES = [
  'PENDING',
  'SELF_ASSESSED',
  'SUPERVISOR_ASSESSED',
  'FINALIZED',
  'CANCELLED',
] as const;
export type EvaluationStatus = (typeof EVALUATION_STATUSES)[number];

/** نوع هدف (KPI / OKR) */
export const GOAL_TYPES = ['KPI', 'OKR'] as const;
export type GoalType = (typeof GOAL_TYPES)[number];

/** وضعیت هدف */
export const GOAL_STATUSES = ['OPEN', 'IN_PROGRESS', 'ACHIEVED', 'CANCELLED'] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

/** مجموع وزن سؤالات یک فرم ارزیابی */
export const EVALUATION_FORM_WEIGHT_TOTAL = 100;

// ---------------------------------------------------------------------------
// فرم و سؤال ارزیابی
// ---------------------------------------------------------------------------

export class EvaluationItemInputDto {
  @ApiProperty({ example: 'کیفیت انجام کار' })
  @IsString({ message: 'عنوان سؤال الزامی است.' })
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ example: 30, description: 'وزن سؤال (مجموع وزن سؤالات فرم باید ۱۰۰ باشد).' })
  @IsInt({ message: 'وزن سؤال باید عدد صحیح باشد.' })
  @Min(0, { message: 'وزن سؤال نمی‌تواند منفی باشد.' })
  @Max(100, { message: 'وزن سؤال نمی‌تواند بیش از ۱۰۰ باشد.' })
  weight: number;

  @ApiPropertyOptional({ enum: EVALUATION_SCALE_TYPES, default: 'NUMERIC' })
  @IsOptional()
  @IsIn(EVALUATION_SCALE_TYPES, { message: 'نوع مقیاس نمره‌دهی معتبر نیست.' })
  scaleType?: EvaluationScaleType;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt({ message: 'حداقل نمره باید عدد صحیح باشد.' })
  @Min(0, { message: 'حداقل نمره نمی‌تواند منفی باشد.' })
  minScore?: number;

  @ApiPropertyOptional({ default: 5 })
  @IsOptional()
  @IsInt({ message: 'حداکثر نمره باید عدد صحیح باشد.' })
  @Min(1, { message: 'حداکثر نمره باید حداقل ۱ باشد.' })
  maxScore?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isKPI?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  evidenceRequired?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class ReplaceEvaluationItemsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => EvaluationItemInputDto)
  items: EvaluationItemInputDto[];
}

export class CreateEvaluationFormDto {
  @ApiProperty({ example: 'فرم ارزیابی عملکرد سالانه' })
  @IsString({ message: 'نام فرم الزامی است.' })
  @MaxLength(160)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'شرکت مالک فرم' })
  @IsOptional()
  @IsUUID('4', { message: 'شناسه شرکت معتبر نیست.' })
  companyId?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;

  @ApiPropertyOptional({ type: [EvaluationItemInputDto], description: 'سؤالات فرم (مجموع وزن باید ۱۰۰ باشد).' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EvaluationItemInputDto)
  items?: EvaluationItemInputDto[];
}

export class UpdateEvaluationFormDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;

  @ApiPropertyOptional({ type: [EvaluationItemInputDto], description: 'جایگزینی کامل سؤالات فرم.' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EvaluationItemInputDto)
  items?: EvaluationItemInputDto[];
}

export class UpdateEvaluationItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt({ message: 'وزن سؤال باید عدد صحیح باشد.' })
  @Min(0, { message: 'وزن سؤال نمی‌تواند منفی باشد.' })
  @Max(100, { message: 'وزن سؤال نمی‌تواند بیش از ۱۰۰ باشد.' })
  weight?: number;

  @ApiPropertyOptional({ enum: EVALUATION_SCALE_TYPES })
  @IsOptional()
  @IsIn(EVALUATION_SCALE_TYPES, { message: 'نوع مقیاس نمره‌دهی معتبر نیست.' })
  scaleType?: EvaluationScaleType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0, { message: 'حداقل نمره نمی‌تواند منفی باشد.' })
  minScore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1, { message: 'حداکثر نمره باید حداقل ۱ باشد.' })
  maxScore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isKPI?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  evidenceRequired?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class EvaluationFormQueryDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;
}

// ---------------------------------------------------------------------------
// دوره ارزیابی
// ---------------------------------------------------------------------------

export class CreateEvaluationCycleDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4', { message: 'شناسه فرم ارزیابی معتبر نیست.' })
  formId: string;

  @ApiProperty({ example: 'ارزیابی عملکرد سه‌ماهه اول ۱۴۰۵' })
  @IsString({ message: 'نام دوره الزامی است.' })
  @MaxLength(160)
  name: string;

  @ApiPropertyOptional({ enum: EVALUATION_PERIOD_TYPES, default: 'QUARTERLY' })
  @IsOptional()
  @IsIn(EVALUATION_PERIOD_TYPES, { message: 'نوع دوره معتبر نیست.' })
  periodType?: EvaluationPeriodType;

  @ApiProperty({ example: '2026-01-01' })
  @IsDateString({}, { message: 'قالب تاریخ شروع معتبر نیست.' })
  startDate: string;

  @ApiProperty({ example: '2026-03-31' })
  @IsDateString({}, { message: 'قالب تاریخ پایان معتبر نیست.' })
  endDate: string;

  @ApiPropertyOptional({ example: '2026-04-10' })
  @IsOptional()
  @IsDateString({}, { message: 'قالب تاریخ سررسید معتبر نیست.' })
  dueDate?: string;

  @ApiPropertyOptional({ enum: EVALUATION_CYCLE_STATUSES, default: 'PLANNED' })
  @IsOptional()
  @IsIn(EVALUATION_CYCLE_STATUSES, { message: 'وضعیت دوره معتبر نیست.' })
  status?: EvaluationCycleStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: 'شناسه شرکت معتبر نیست.' })
  companyId?: string;
}

export class UpdateEvaluationCycleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @ApiPropertyOptional({ enum: EVALUATION_PERIOD_TYPES })
  @IsOptional()
  @IsIn(EVALUATION_PERIOD_TYPES, { message: 'نوع دوره معتبر نیست.' })
  periodType?: EvaluationPeriodType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({}, { message: 'قالب تاریخ شروع معتبر نیست.' })
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({}, { message: 'قالب تاریخ پایان معتبر نیست.' })
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({}, { message: 'قالب تاریخ سررسید معتبر نیست.' })
  dueDate?: string;

  @ApiPropertyOptional({ enum: EVALUATION_CYCLE_STATUSES })
  @IsOptional()
  @IsIn(EVALUATION_CYCLE_STATUSES, { message: 'وضعیت دوره معتبر نیست.' })
  status?: EvaluationCycleStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: 'شناسه فرم ارزیابی معتبر نیست.' })
  formId?: string;
}

export class EvaluationCycleQueryDto extends PaginationDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  formId?: string;

  @ApiPropertyOptional({ enum: EVALUATION_CYCLE_STATUSES })
  @IsOptional()
  @IsIn(EVALUATION_CYCLE_STATUSES, { message: 'وضعیت دوره معتبر نیست.' })
  status?: EvaluationCycleStatus;

  @ApiPropertyOptional({ enum: EVALUATION_PERIOD_TYPES })
  @IsOptional()
  @IsIn(EVALUATION_PERIOD_TYPES, { message: 'نوع دوره معتبر نیست.' })
  periodType?: EvaluationPeriodType;
}

export class StartEvaluationCycleDto {
  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description: 'در صورت خالی بودن، همه کارکنان فعال شرکت در ارزیابی شرکت می‌کنند.',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true, message: 'شناسه کارمند معتبر نیست.' })
  employeeIds?: string[];
}

// ---------------------------------------------------------------------------
// نمره‌دهی و بازخورد
// ---------------------------------------------------------------------------

export class EvaluationScoreInputDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4', { message: 'شناسه سؤال معتبر نیست.' })
  itemId: string;

  @ApiProperty({ example: 4 })
  @IsNumber({}, { message: 'نمره باید عدد باشد.' })
  score: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;

  @ApiPropertyOptional({ description: 'مستندات/شواهد ارائه‌شده' })
  @IsOptional()
  @IsString()
  evidence?: string;
}

export class SelfAssessDto {
  @ApiProperty({ type: [EvaluationScoreInputDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'حداقل یک نمره باید ثبت شود.' })
  @ValidateNested({ each: true })
  @Type(() => EvaluationScoreInputDto)
  scores: EvaluationScoreInputDto[];
}

export class SupervisorAssessDto {
  @ApiProperty({ type: [EvaluationScoreInputDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'حداقل یک نمره باید ثبت شود.' })
  @ValidateNested({ each: true })
  @Type(() => EvaluationScoreInputDto)
  scores: EvaluationScoreInputDto[];
}

export class CreateEvaluationFeedbackDto {
  @ApiProperty({ example: 'در سه‌ماهه گذشته عملکرد مناسبی در پروژه X داشته است.' })
  @IsString({ message: 'متن بازخورد الزامی است.' })
  @MaxLength(4000)
  content: string;
}

export class EmployeeResponseDto {
  @ApiProperty({ example: 'از بازخورد شما سپاسگزارم و در ماه آینده این مورد را بهبود می‌دهم.' })
  @IsString({ message: 'پاسخ کارمند الزامی است.' })
  @MaxLength(4000)
  response: string;
}

// ---------------------------------------------------------------------------
// ارزیابی‌ها
// ---------------------------------------------------------------------------

export class EvaluationQueryDto extends PaginationDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  cycleId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  employeeId?: string;

  @ApiPropertyOptional({ enum: EVALUATION_STATUSES })
  @IsOptional()
  @IsIn(EVALUATION_STATUSES, { message: 'وضعیت ارزیابی معتبر نیست.' })
  status?: EvaluationStatus;

  @ApiPropertyOptional({ enum: EVALUATION_TYPES })
  @IsOptional()
  @IsIn(EVALUATION_TYPES, { message: 'نوع ارزیابی معتبر نیست.' })
  evaluationType?: EvaluationType;
}

export class EmployeeParamDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4', { message: 'شناسه کارمند معتبر نیست.' })
  employeeId: string;
}

// ---------------------------------------------------------------------------
// اهداف (KPI / OKR)
// ---------------------------------------------------------------------------

export class CreateGoalDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4', { message: 'شناسه کارمند معتبر نیست.' })
  employeeId: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: 'شناسه دوره ارزیابی معتبر نیست.' })
  cycleId?: string;

  @ApiProperty({ example: 'افزایش رضایت مشتری به ۹۰٪' })
  @IsString({ message: 'عنوان هدف الزامی است.' })
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: GOAL_TYPES, default: 'KPI' })
  @IsOptional()
  @IsIn(GOAL_TYPES, { message: 'نوع هدف معتبر نیست.' })
  goalType?: GoalType;

  @ApiPropertyOptional({ example: 90 })
  @IsOptional()
  @IsNumber()
  targetValue?: number;

  @ApiPropertyOptional({ example: 'درصد' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  unit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({}, { message: 'قالب تاریخ شروع معتبر نیست.' })
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({}, { message: 'قالب تاریخ پایان معتبر نیست.' })
  endDate?: string;

  @ApiPropertyOptional({ default: 0, minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt({ message: 'درصد پیشرفت باید عدد صحیح باشد.' })
  @Min(0, { message: 'درصد پیشرفت نمی‌تواند منفی باشد.' })
  @Max(100, { message: 'درصد پیشرفت نمی‌تواند بیش از ۱۰۰ باشد.' })
  progress?: number;

  @ApiPropertyOptional({ enum: GOAL_STATUSES, default: 'OPEN' })
  @IsOptional()
  @IsIn(GOAL_STATUSES, { message: 'وضعیت هدف معتبر نیست.' })
  status?: GoalStatus;
}

export class UpdateGoalDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  cycleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: GOAL_TYPES })
  @IsOptional()
  @IsIn(GOAL_TYPES, { message: 'نوع هدف معتبر نیست.' })
  goalType?: GoalType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  targetValue?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  unit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({}, { message: 'قالب تاریخ شروع معتبر نیست.' })
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({}, { message: 'قالب تاریخ پایان معتبر نیست.' })
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt({ message: 'درصد پیشرفت باید عدد صحیح باشد.' })
  @Min(0, { message: 'درصد پیشرفت نمی‌تواند منفی باشد.' })
  @Max(100, { message: 'درصد پیشرفت نمی‌تواند بیش از ۱۰۰ باشد.' })
  progress?: number;

  @ApiPropertyOptional({ enum: GOAL_STATUSES })
  @IsOptional()
  @IsIn(GOAL_STATUSES, { message: 'وضعیت هدف معتبر نیست.' })
  status?: GoalStatus;
}

export class GoalQueryDto extends PaginationDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  employeeId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  cycleId?: string;

  @ApiPropertyOptional({ enum: GOAL_TYPES })
  @IsOptional()
  @IsIn(GOAL_TYPES, { message: 'نوع هدف معتبر نیست.' })
  goalType?: GoalType;

  @ApiPropertyOptional({ enum: GOAL_STATUSES })
  @IsOptional()
  @IsIn(GOAL_STATUSES, { message: 'وضعیت هدف معتبر نیست.' })
  status?: GoalStatus;
}
