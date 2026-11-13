import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { SurveyStatus, SuggestionStatus } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

// ---------------------------------------------------------------------------
// مکاتبات اداری
// ---------------------------------------------------------------------------

export class CreateCorrespondenceDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  companyId: string;

  @ApiProperty({ example: 'COR-1405-001' })
  @IsString({ message: 'شماره نامه الزامی است.' })
  @MaxLength(40)
  referenceNo: string;

  @ApiPropertyOptional({ enum: ['INCOMING', 'OUTGOING'], default: 'INCOMING' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  direction?: string;

  @ApiProperty()
  @IsDateString({}, { message: 'تاریخ نامه الزامی است.' })
  letterDate: string;

  @ApiProperty()
  @IsString({ message: 'موضوع نامه الزامی است.' })
  @MaxLength(300)
  subject: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  senderName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  senderOrg?: string;

  @ApiPropertyOptional({ enum: ['NORMAL', 'CONFIDENTIAL', 'SECRET'], default: 'NORMAL' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  classification?: string;

  @ApiPropertyOptional({ description: 'مهلت پاسخ' })
  @IsOptional()
  @IsDateString({})
  deadline?: string;
}

export class UpdateCorrespondenceDto {
  @ApiPropertyOptional({ enum: ['REGISTERED', 'IN_PROGRESS', 'ANSWERED', 'ARCHIVED'] })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({})
  deadline?: string;
}

export class CorrespondenceQueryDto extends PaginationDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  companyId?: string;

  @ApiPropertyOptional({ enum: ['INCOMING', 'OUTGOING'] })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  direction?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  status?: string;
}

export class CreateReferralDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'کاربر مقصد' })
  @IsOptional()
  @IsUUID('4')
  toUserId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'نیروی مقصد' })
  @IsOptional()
  @IsUUID('4')
  toEmployeeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({})
  dueAt?: string;
}

export class RespondReferralDto {
  @ApiProperty()
  @IsString({ message: 'متن پاسخ الزامی است.' })
  response: string;
}

// ---------------------------------------------------------------------------
// جلسات
// ---------------------------------------------------------------------------

export class MeetingParticipantDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'نیروی شرکت‌کننده' })
  @IsOptional()
  @IsUUID('4')
  employeeId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'کاربر شرکت‌کننده' })
  @IsOptional()
  @IsUUID('4')
  userId?: string;
}

export class CreateMeetingDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  companyId: string;

  @ApiProperty()
  @IsString({ message: 'عنوان جلسه الزامی است.' })
  @MaxLength(200)
  title: string;

  @ApiProperty()
  @IsDateString({}, { message: 'زمان جلسه الزامی است.' })
  scheduledAt: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({})
  endAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  agenda?: string;

  @ApiProperty({ type: [MeetingParticipantDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MeetingParticipantDto)
  participants: MeetingParticipantDto[];
}

export class UpdateMeetingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({})
  scheduledAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  minutes?: string;

  @ApiPropertyOptional({ enum: ['PLANNED', 'HELD', 'CANCELLED'] })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  status?: string;
}

export class MeetingActionDto {
  @ApiProperty()
  @IsString()
  @MaxLength(300)
  title: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'نیروی مسئول' })
  @IsOptional()
  @IsUUID('4')
  responsibleId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'کاربر مسئول' })
  @IsOptional()
  @IsUUID('4')
  responsibleUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({})
  dueDate?: string;
}

export class MeetingQueryDto extends PaginationDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  companyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  status?: string;
}

// ---------------------------------------------------------------------------
// نظرسنجی
// ---------------------------------------------------------------------------

export class SurveyQuestionDto {
  @ApiProperty()
  @IsString({ message: 'متن سؤال الزامی است.' })
  @MaxLength(500)
  text: string;

  @ApiPropertyOptional({ default: 'SCALE', description: 'SCALE / TEXT / CHOICE' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  questionType?: string;

  @ApiPropertyOptional({ description: 'گزینه‌ها برای CHOICE — جدا با |' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  options?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class CreateSurveyDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  companyId: string;

  @ApiProperty()
  @IsString({ message: 'عنوان نظرسنجی الزامی است.' })
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isAnonymous?: boolean;

  @ApiProperty({ type: [SurveyQuestionDto] })
  @IsArray({ message: 'سؤالات الزامی است.' })
  @ValidateNested({ each: true })
  @Type(() => SurveyQuestionDto)
  questions: SurveyQuestionDto[];
}

export class UpdateSurveyDto {
  @ApiPropertyOptional({ enum: SurveyStatus })
  @IsOptional()
  @IsEnum(SurveyStatus, { message: 'وضعیت نظرسنجی معتبر نیست.' })
  status?: SurveyStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({})
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({})
  endDate?: string;
}

export class SubmitSurveyResponseDto {
  @ApiProperty({ description: 'پاسخ‌ها: { questionId: value }' })
  @IsString()
  answersJson: string;
}

export class SurveyQueryDto extends PaginationDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  companyId?: string;

  @ApiPropertyOptional({ enum: SurveyStatus })
  @IsOptional()
  @IsEnum(SurveyStatus)
  status?: SurveyStatus;
}

// ---------------------------------------------------------------------------
// پیشنهادها
// ---------------------------------------------------------------------------

export class CreateSuggestionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  companyId: string;

  @ApiProperty()
  @IsString({ message: 'عنوان پیشنهاد الزامی است.' })
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'IMPROVEMENT' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @ApiPropertyOptional({ default: false, description: 'ارسال ناشناس' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isAnonymous?: boolean;
}

export class DecideSuggestionDto {
  @ApiProperty({ enum: SuggestionStatus })
  @IsEnum(SuggestionStatus, { message: 'وضعیت معتبر نیست.' })
  status: SuggestionStatus;

  @ApiPropertyOptional({ format: 'uuid', description: 'مسئول پیگیری' })
  @IsOptional()
  @IsUUID('4')
  responsibleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  response?: string;
}

export class SuggestionQueryDto extends PaginationDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  companyId?: string;

  @ApiPropertyOptional({ enum: SuggestionStatus })
  @IsOptional()
  @IsEnum(SuggestionStatus)
  status?: SuggestionStatus;
}

// ---------------------------------------------------------------------------
// گزارش محرمانه
// ---------------------------------------------------------------------------

export class CreateConfidentialReportDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  companyId: string;

  @ApiProperty()
  @IsString({ message: 'عنوان الزامی است.' })
  @MaxLength(200)
  title: string;

  @ApiProperty()
  @IsString({ message: 'شرح گزارش الزامی است.' })
  description: string;

  @ApiPropertyOptional({ enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'MEDIUM' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  severity?: string;
}

export class UpdateConfidentialReportDto {
  @ApiPropertyOptional({ enum: ['NEW', 'INVESTIGATING', 'RESOLVED', 'CLOSED'] })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  investigation?: string;
}

export class ConfidentialReportQueryDto extends PaginationDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  companyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  status?: string;
}
