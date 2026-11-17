import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Max,
  Min,
} from 'class-validator';
import { ContractStatus, EmploymentType } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class CreateContractDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4', { message: 'شناسه نیرو معتبر نیست.' })
  employeeId: string;

  @ApiProperty({ example: 'PERMANENT' })
  @IsString({ message: 'نوع قرارداد الزامی است.' })
  @MaxLength(40)
  contractType: string;

  @ApiProperty({ example: '2026-01-01' })
  @IsDateString({}, { message: 'قالب تاریخ شروع نامعتبر است.' })
  startDate: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString({}, { message: 'قالب تاریخ پایان نامعتبر است.' })
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({})
  effectiveDate?: string;

  @ApiPropertyOptional({ example: 45000000, description: 'حقوق پایه ماهانه (ریال)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Max(Number.MAX_SAFE_INTEGER)
  @Min(0)
  baseSalary?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Max(Number.MAX_SAFE_INTEGER)
  @Min(0)
  housingAllowance?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Max(Number.MAX_SAFE_INTEGER)
  @Min(0)
  foodAllowance?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Max(Number.MAX_SAFE_INTEGER)
  @Min(0)
  childAllowance?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Max(Number.MAX_SAFE_INTEGER)
  @Min(0)
  seniorityPay?: number;

  @ApiPropertyOptional({ default: 8 })
  @IsOptional()
  @IsInt()
  @Min(1)
  workHoursPerDay?: number;

  @ApiPropertyOptional({ default: 220 })
  @IsOptional()
  @IsInt()
  @Min(1)
  workHoursPerMonth?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  terms?: string;

  @ApiPropertyOptional({ enum: EmploymentType, description: 'برای به‌روزرسانی نوع استخدام نیرو' })
  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;
}

export class CreateContractVersionDto {
  @ApiProperty()
  @IsString()
  @MaxLength(40)
  contractType: string;

  @ApiProperty()
  @IsDateString({}, { message: 'قالب تاریخ شروع نامعتبر است.' })
  startDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({})
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({})
  effectiveDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Max(Number.MAX_SAFE_INTEGER)
  @Min(0)
  baseSalary?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Max(Number.MAX_SAFE_INTEGER)
  @Min(0)
  housingAllowance?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Max(Number.MAX_SAFE_INTEGER)
  @Min(0)
  foodAllowance?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Max(Number.MAX_SAFE_INTEGER)
  @Min(0)
  childAllowance?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Max(Number.MAX_SAFE_INTEGER)
  @Min(0)
  seniorityPay?: number;

  @ApiPropertyOptional({ default: 8 })
  @IsOptional()
  @IsInt()
  @Min(1)
  workHoursPerDay?: number;

  @ApiPropertyOptional({ default: 220 })
  @IsOptional()
  @IsInt()
  @Min(1)
  workHoursPerMonth?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  terms?: string;

  @ApiProperty({ description: 'دلیل ایجاد نسخه جدید (مثلاً تمدید/ارتقا)' })
  @IsString({ message: 'دلیل تغییر نسخه الزامی است.' })
  @MaxLength(500)
  changeReason: string;
}

export class UpdateContractDto {
  @ApiPropertyOptional({ enum: ContractStatus })
  @IsOptional()
  @IsEnum(ContractStatus, { message: 'وضعیت قرارداد معتبر نیست.' })
  status?: ContractStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ContractQueryDto extends PaginationDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  employeeId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  companyId?: string;

  @ApiPropertyOptional({ enum: ContractStatus })
  @IsOptional()
  @IsEnum(ContractStatus)
  status?: ContractStatus;

  @ApiPropertyOptional({ default: false, description: 'فقط قراردادهای در حال انقضا (۳۰ روز)' })
  @IsOptional()
  @IsString()
  expiring?: string;
}
