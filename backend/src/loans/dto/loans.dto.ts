import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
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
  ValidateNested,
} from 'class-validator';
import { BenefitStatus } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

// ---------------------------------------------------------------------------
// وام و مساعده
// ---------------------------------------------------------------------------

export class CreateLoanDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  employeeId: string;

  @ApiPropertyOptional({ default: 'LOAN', example: 'LOAN' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  loanType?: string;

  @ApiProperty({ description: 'مبلغ وام (ریال)' })
  @Type(() => Number)
  @IsInt()
  @Max(Number.MAX_SAFE_INTEGER)
  @Min(1)
  amount: number;

  @ApiProperty({ default: 1, description: 'تعداد اقساط' })
  @IsInt()
  @Min(1)
  installmentCount: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  interestRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  purpose?: string;

  @ApiPropertyOptional({ description: 'تاریخ شروع قسط اول (پیچ پیش‌فرض: ماه بعد)' })
  @IsOptional()
  @IsDateString({})
  firstDueDate?: string;
}

export class DecideLoanDto {
  @ApiProperty({ enum: ['APPROVE', 'REJECT'] })
  @IsIn(['APPROVE', 'REJECT'], { message: 'تصمیم نامعتبر است.' })
  decision: 'APPROVE' | 'REJECT';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}

export class DisburseLoanDto {
  @ApiProperty()
  @IsDateString({}, { message: 'تاریخ پرداخت الزامی است.' })
  disbursedAt: string;
}

export class PayInstallmentDto {
  @ApiProperty({ format: 'uuid', description: 'کلید یکتای درخواست؛ در تلاش مجدد تغییر نکند' })
  @IsUUID('4')
  idempotencyKey: string;

  @ApiProperty({ description: 'مبلغ پرداختی این قسط (ریال)' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  amount: number;

  @ApiProperty({ format: 'uuid', description: 'دوره حقوق و دستمبرد مرتبط' })
  @IsUUID('4')
  payrollPeriodId: string;
}

export class LoanQueryDto extends PaginationDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  employeeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  loanType?: string;
}

// ---------------------------------------------------------------------------
// انواع مزایا و بسته‌ها
// ---------------------------------------------------------------------------

export class CreateBenefitTypeDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  companyId: string;

  @ApiProperty({ example: 'FUEL' })
  @IsString({ message: 'کد مزایا الزامی است.' })
  @MaxLength(40)
  code: string;

  @ApiProperty({ example: 'کمک هزینه سوخت' })
  @IsString({ message: 'نام مزایا الزامی است.' })
  @MaxLength(160)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateBenefitTypeDto {
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
}

export class CreatePackageItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  benefitTypeId: string;

  @ApiPropertyOptional({ description: 'سهم شرکت (ریال)' })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  companyShare?: number;

  @ApiPropertyOptional({ description: 'سهم کارمند (ریال)' })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  employeeShare?: number;

  @ApiPropertyOptional({ description: 'سقف مبلغ (ریال)' })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  capAmount?: number;

  @ApiPropertyOptional({ example: 'MONTHLY' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  period?: string;
}

export class CreateBenefitPackageDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  companyId: string;

  @ApiProperty()
  @IsString({ message: 'نام بسته الزامی است.' })
  @MaxLength(160)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ type: [CreatePackageItemDto] })
  @IsArray({ message: 'اقلام بسته الزامی است.' })
  @ValidateNested({ each: true })
  @Type(() => CreatePackageItemDto)
  items: CreatePackageItemDto[];
}

export class BenefitTypeQueryDto extends PaginationDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  companyId?: string;
}

// ---------------------------------------------------------------------------
// مزایای نیرو
// ---------------------------------------------------------------------------

export class AssignBenefitDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  employeeId: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'نوع مزایا مستقیم' })
  @IsOptional()
  @IsUUID('4')
  benefitTypeId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'بسته مزایا' })
  @IsOptional()
  @IsUUID('4')
  packageId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({})
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({})
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class UpdateBenefitStatusDto {
  @ApiProperty({ enum: BenefitStatus })
  @IsEnum(BenefitStatus, { message: 'وضعیت مزایا معتبر نیست.' })
  status: BenefitStatus;
}

export class EmployeeBenefitQueryDto extends PaginationDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  employeeId?: string;

  @ApiPropertyOptional({ enum: BenefitStatus })
  @IsOptional()
  @IsEnum(BenefitStatus)
  status?: BenefitStatus;
}
