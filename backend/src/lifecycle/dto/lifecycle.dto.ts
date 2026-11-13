import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
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
  ValidateNested,
} from 'class-validator';
import { ChecklistItemStatus, ChecklistStatus, EmploymentType } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

// ---------------------------------------------------------------------------
// قالب چک‌لیست ورود
// ---------------------------------------------------------------------------

export class CreateTemplateItemDto {
  @ApiProperty()
  @IsString({ message: 'عنوان الزامی است.' })
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isRequired?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  requiresDocument?: boolean;
}

export class CreateOnboardingTemplateDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  companyId: string;

  @ApiProperty()
  @IsString({ message: 'نام قالب الزامی است.' })
  @MaxLength(160)
  name: string;

  @ApiPropertyOptional({ enum: EmploymentType, description: 'برای نوع استخدام خاص (اختیاری)' })
  @IsOptional()
  @IsEnum(EmploymentType)
  appliesTo?: EmploymentType;

  @ApiProperty({ type: [CreateTemplateItemDto] })
  @IsArray({ message: 'اقلام چک‌لیست الزامی است.' })
  @ValidateNested({ each: true })
  @Type(() => CreateTemplateItemDto)
  items: CreateTemplateItemDto[];
}

export class OnboardingTemplateQueryDto extends PaginationDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  companyId?: string;
}

// ---------------------------------------------------------------------------
// چک‌لیست ورود نیرو
// ---------------------------------------------------------------------------

export class StartOnboardingDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  employeeId: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  templateId: string;
}

export class UpdateChecklistItemDto {
  @ApiProperty({ enum: ChecklistItemStatus })
  @IsEnum(ChecklistItemStatus, { message: 'وضعیت اقلام معتبر نیست.' })
  status: ChecklistItemStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  evidencePath?: string;
}

export class ChecklistQueryDto extends PaginationDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  employeeId?: string;

  @ApiPropertyOptional({ enum: ChecklistStatus })
  @IsOptional()
  @IsEnum(ChecklistStatus)
  status?: ChecklistStatus;
}

// ---------------------------------------------------------------------------
// چک‌لیست خروج
// ---------------------------------------------------------------------------

export class CreateOffboardingItemDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  title: string;
}

export class CreateOffboardingDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  employeeId: string;

  @ApiProperty({ example: 'RESIGNATION', description: 'استعفا / بازنشستگی / خاتمه قرارداد' })
  @IsString({ message: 'دلیل خروج الزامی است.' })
  @MaxLength(120)
  reason: string;

  @ApiProperty()
  @IsDateString({}, { message: 'تاریخ خاتمه الزامی است.' })
  terminationDate: string;

  @ApiPropertyOptional({ type: [CreateOffboardingItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOffboardingItemDto)
  items?: CreateOffboardingItemDto[];
}

// ---------------------------------------------------------------------------
// درخواست خاتمه همکاری
// ---------------------------------------------------------------------------

export class CreateTerminationRequestDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  employeeId: string;

  @ApiProperty({ example: 'RESIGNATION' })
  @IsString({ message: 'دلیل الزامی است.' })
  @MaxLength(60)
  reason: string;

  @ApiProperty()
  @IsDateString({}, { message: 'تاریخ خاتمه الزامی است.' })
  terminationDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class DecideTerminationDto {
  @ApiProperty({ enum: ['APPROVE', 'REJECT'] })
  @IsIn(['APPROVE', 'REJECT'], { message: 'تصمیم نامعتبر است.' })
  decision: 'APPROVE' | 'REJECT';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}

export class TerminationQueryDto extends PaginationDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  employeeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  status?: string;
}
