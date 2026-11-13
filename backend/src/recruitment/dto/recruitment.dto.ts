import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import {
  ApplicantStatus,
  EmploymentType,
  InterviewStatus,
  OfferStatus,
} from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

// ---------------------------------------------------------------------------
// درخواست جذب
// ---------------------------------------------------------------------------

export class CreateRequisitionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  companyId: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  orgUnitId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  workLocationId?: string;

  @ApiProperty({ example: 'درخواست جذب کارشناس منابع انسانی' })
  @IsString({ message: 'عنوان الزامی است.' })
  @MaxLength(160)
  title: string;

  @ApiProperty({ default: 1 })
  @IsInt()
  @Min(1)
  headcount: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional({ description: 'بودجه مصوب (ریال)' })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  budget?: number;
}

export class RequisitionQueryDto extends PaginationDto {
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
// آگهی استخدام
// ---------------------------------------------------------------------------

export class CreateOpeningDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  requisitionId: string;

  @ApiProperty()
  @IsString({ message: 'عنوان آگهی الزامی است.' })
  @MaxLength(160)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  requiredSkills?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  preferredSkills?: string;

  @ApiProperty({ enum: EmploymentType })
  @IsEnum(EmploymentType, { message: 'نوع استخدام معتبر نیست.' })
  employmentType: EmploymentType;

  @ApiPropertyOptional({ description: 'حداقل حقوق پیشنهادی (ریال)' })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  salaryMin?: number;

  @ApiPropertyOptional({ description: 'حداکثر حقوق پیشنهادی (ریال)' })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  salaryMax?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({})
  applicationDeadline?: string;
}

export class OpeningQueryDto extends PaginationDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  requisitionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  status?: string;
}

// ---------------------------------------------------------------------------
// داوطلب
// ---------------------------------------------------------------------------

export class CreateApplicantDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  openingId: string;

  @ApiProperty()
  @IsString({ message: 'نام الزامی است.' })
  @MaxLength(80)
  firstName: string;

  @ApiProperty()
  @IsString({ message: 'نام خانوادگی الزامی است.' })
  @MaxLength(80)
  lastName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  mobile?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  nationalId?: string;

  @ApiPropertyOptional({ description: 'مسیر رزومه آپلودشده' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  resumePath?: string;

  @ApiPropertyOptional({ example: 'SITE' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  source?: string;
}

export class UpdateApplicantStatusDto {
  @ApiProperty({ enum: ApplicantStatus })
  @IsEnum(ApplicantStatus, { message: 'وضعیت داوطلب معتبر نیست.' })
  status: ApplicantStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  stageNote?: string;
}

export class ApplicantQueryDto extends PaginationDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  openingId?: string;

  @ApiPropertyOptional({ enum: ApplicantStatus })
  @IsOptional()
  @IsEnum(ApplicantStatus)
  status?: ApplicantStatus;
}

// ---------------------------------------------------------------------------
// مصاحبه
// ---------------------------------------------------------------------------

export class CreateInterviewDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  applicantId: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  openingId: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'مصاحبه‌گر' })
  @IsOptional()
  @IsUUID('4')
  interviewerId?: string;

  @ApiProperty()
  @IsDateString({}, { message: 'زمان مصاحبه الزامی است.' })
  scheduledAt: string;

  @ApiPropertyOptional({ default: 'ONSITE' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  mode?: string;
}

export class UpdateInterviewDto {
  @ApiPropertyOptional({ enum: InterviewStatus })
  @IsOptional()
  @IsEnum(InterviewStatus, { message: 'وضعیت مصاحبه معتبر نیست.' })
  status?: InterviewStatus;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  score?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({})
  scheduledAt?: string;
}

export class CreateInterviewFeedbackDto {
  @ApiProperty({ description: 'امتیازها به‌صورت JSON' })
  @IsString()
  scoresJson: string;

  @ApiPropertyOptional({ example: 'HIRE', description: 'HIRE / NO_HIRE / MAYBE' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  recommendation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comment?: string;
}

// ---------------------------------------------------------------------------
// پیشنهاد استخدام
// ---------------------------------------------------------------------------

export class CreateOfferDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  applicantId: string;

  @ApiProperty({ description: 'حقوق پیشنهادی (ریال)' })
  @Type(() => Number)
  @Min(0)
  salary: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({})
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({})
  expiresAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateOfferStatusDto {
  @ApiProperty({ enum: OfferStatus })
  @IsEnum(OfferStatus, { message: 'وضعیت پیشنهاد معتبر نیست.' })
  status: OfferStatus;
}

export class OfferQueryDto extends PaginationDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  applicantId?: string;

  @ApiPropertyOptional({ enum: OfferStatus })
  @IsOptional()
  @IsEnum(OfferStatus)
  status?: OfferStatus;
}

export class RequisitionIdsDto {
  @ApiProperty({ type: [String], format: 'uuid' })
  @IsArray()
  @IsUUID('4', { each: true })
  ids: string[];
}
