import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { EmployeeStatus, EmploymentType, Gender, MaritalStatus } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

// ---------------------------------------------------------------------------
// پرونده پرسنلی
// ---------------------------------------------------------------------------

export class CreateEmployeeDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4', { message: 'شناسه شرکت معتبر نیست.' })
  companyId: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  branchId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  workLocationId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  costCenterId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  orgUnitId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  positionId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'مدیر مستقیم' })
  @IsOptional()
  @IsUUID('4')
  managerId?: string;

  @ApiProperty({ example: 'EMP-1024' })
  @IsString({ message: 'کد پرسنلی الزامی است.' })
  @MaxLength(30)
  code: string;

  @ApiProperty({ example: '0012345678' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  nationalId?: string;

  @ApiProperty({ example: 'علی' })
  @IsString({ message: 'نام الزامی است.' })
  @MaxLength(80)
  firstName: string;

  @ApiProperty({ example: 'رضایی' })
  @IsString({ message: 'نام خانوادگی الزامی است.' })
  @MaxLength(80)
  lastName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  fatherName?: string;

  @ApiPropertyOptional({ example: '1994-05-10' })
  @IsOptional()
  @IsDateString({}, { message: 'قالب تاریخ تولد نامعتبر است.' })
  birthDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  birthPlace?: string;

  @ApiPropertyOptional({ enum: Gender })
  @IsOptional()
  @IsEnum(Gender, { message: 'جنسیت معتبر نیست.' })
  gender?: Gender;

  @ApiPropertyOptional({ enum: MaritalStatus })
  @IsOptional()
  @IsEnum(MaritalStatus, { message: 'وضعیت تأهل معتبر نیست.' })
  maritalStatus?: MaritalStatus;

  @ApiPropertyOptional({ example: '09121234567' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  mobile?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail({}, { message: 'قالب ایمیل معتبر نیست.' })
  @MaxLength(160)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(400)
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  emergencyName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  emergencyPhone?: string;

  @ApiProperty({ enum: EmploymentType })
  @IsEnum(EmploymentType, { message: 'نوع استخدام معتبر نیست.' })
  employmentType: EmploymentType;

  @ApiProperty({ example: '2025-06-01' })
  @IsDateString({}, { message: 'قالب تاریخ استخدام نامعتبر است.' })
  hireDate: string;

  @ApiPropertyOptional({ example: '50000000', description: 'حقوق پایه ماهانه (ریال)' })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  monthlyBaseSalary?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isContractor?: boolean;

  @ApiPropertyOptional({ format: 'uuid', description: 'اتصال به حساب کاربری' })
  @IsOptional()
  @IsUUID('4')
  userId?: string;
}

export class UpdateEmployeeDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  branchId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  workLocationId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  costCenterId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  orgUnitId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  positionId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  managerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  nationalId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  fatherName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({})
  birthDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  birthPlace?: string;

  @ApiPropertyOptional({ enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({ enum: MaritalStatus })
  @IsOptional()
  @IsEnum(MaritalStatus)
  maritalStatus?: MaritalStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  mobile?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail({})
  @MaxLength(160)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(400)
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  emergencyName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  emergencyPhone?: string;

  @ApiPropertyOptional({ enum: EmploymentType })
  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;

  @ApiPropertyOptional({ enum: EmployeeStatus })
  @IsOptional()
  @IsEnum(EmployeeStatus, { message: 'وضعیت نیرو معتبر نیست.' })
  status?: EmployeeStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({})
  terminationDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  monthlyBaseSalary?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  photoUrl?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  userId?: string;
}

export class EmployeeQueryDto extends PaginationDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  companyId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  branchId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  orgUnitId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  positionId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  managerId?: string;

  @ApiPropertyOptional({ enum: EmployeeStatus })
  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;

  @ApiPropertyOptional({ enum: EmploymentType })
  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;

  @ApiPropertyOptional({ default: false, description: 'فقط کارکنان با پیوند کاربری' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  hasUser?: boolean;

  @ApiPropertyOptional({ default: false, description: 'نمایش نیروهای حذف‌شده' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  includeDeleted?: boolean;
}

// ---------------------------------------------------------------------------
// زیرمجموعه‌های پرونده
// ---------------------------------------------------------------------------

export class CreateDependentDto {
  @ApiProperty({ example: 'همسر' })
  @IsString()
  @MaxLength(40)
  relation: string;

  @ApiProperty()
  @IsString()
  @MaxLength(120)
  fullName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  nationalId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({})
  birthDate?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isUnderCover?: boolean;
}

export class CreateSkillDto {
  @ApiProperty()
  @IsString()
  @MaxLength(120)
  skill: string;

  @ApiPropertyOptional({ default: 1, minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  level?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}

export class CreateBankAccountDto {
  @ApiProperty()
  @IsString()
  @MaxLength(120)
  bankName: string;

  @ApiProperty()
  @IsString()
  @MaxLength(40)
  accountNumber: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(34)
  sheba?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  cardNumber?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isPrimary?: boolean;
}

export class CreateEmploymentEventDto {
  @ApiProperty({ example: 'PROMOTION' })
  @IsString()
  @MaxLength(40)
  eventType: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({})
  fromDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({})
  toDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
