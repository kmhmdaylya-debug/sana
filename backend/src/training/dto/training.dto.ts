import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

// ---------------------------------------------------------------------------
// دوره آموزشی
// ---------------------------------------------------------------------------

export class CreateCourseDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  companyId: string;

  @ApiProperty({ example: 'TR-001' })
  @IsString()
  @MaxLength(40)
  code: string;

  @ApiProperty({ example: 'ایمنی صنعتی پایه' })
  @IsString()
  @MaxLength(160)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  instructor?: string;

  @ApiPropertyOptional({ default: 8 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  durationHours?: number;

  @ApiPropertyOptional({ description: 'هزینه دوره (ریال)' })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  cost?: number;

  @ApiPropertyOptional({ type: [String], format: 'uuid', description: 'دوره‌های پیش‌نیاز' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  prerequisiteIds?: string[];
}

export class UpdateCourseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  instructor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  durationHours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  cost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SetPrerequisitesDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  prerequisiteIds: string[];
}

export class CourseQueryDto extends PaginationDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  companyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  isActive?: string;
}

// ---------------------------------------------------------------------------
// سوابق آموزش
// ---------------------------------------------------------------------------

export class CreateTrainingRecordDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  courseId: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  employeeId: string;

  @ApiProperty()
  @IsDateString({}, { message: 'تاریخ حضور الزامی است.' })
  attendanceDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({})
  endDate?: string;

  @ApiPropertyOptional({ enum: ['COMPLETED', 'IN_PROGRESS', 'FAILED', 'DROPPED'] })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  result?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  score?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100, description: 'اثربخشی آموزش (٪)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  effectivenessScore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class TrainingRecordQueryDto extends PaginationDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  employeeId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  courseId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  status?: string;
}

// ---------------------------------------------------------------------------
// گواهینامه
// ---------------------------------------------------------------------------

export class CreateCertificateDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  employeeId: string;

  @ApiProperty()
  @IsString()
  @MaxLength(160)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  issuingBody?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({})
  issueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({})
  expiryDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  filePath?: string;
}

export class CertificateQueryDto extends PaginationDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  employeeId?: string;

  @ApiPropertyOptional({ default: false, description: 'فقط گواهینامه‌های در حال انقضا (۹۰ روز)' })
  @IsOptional()
  @IsString()
  expiring?: string;
}
