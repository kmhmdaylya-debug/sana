import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ScopeType, UserStatus } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class ScopeAssignmentDto {
  @ApiProperty({ enum: ScopeType })
  @IsEnum(ScopeType, { message: 'نوع حوزه معتبر نیست.' })
  scopeType: ScopeType;

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
  employeeId?: string;
}

export class CreateUserDto {
  @ApiProperty({ example: 'hr.manager' })
  @IsString({ message: 'نام کاربری الزامی است.' })
  @MaxLength(64)
  username: string;

  @ApiProperty({ example: 'مدیر منابع انسانی' })
  @IsString({ message: 'نام و نام خانوادگی الزامی است.' })
  @MaxLength(160)
  fullName: string;

  @ApiProperty()
  @IsString({ message: 'رمز عبور الزامی است.' })
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail({}, { message: 'قالب ایمیل معتبر نیست.' })
  @MaxLength(160)
  email?: string;

  @ApiPropertyOptional({ example: '09121234567' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  mobile?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  employeeId?: string;

  @ApiPropertyOptional({ type: [String], description: 'شناسه نقش‌ها' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  roleIds?: string[];

  @ApiPropertyOptional({ type: [ScopeAssignmentDto] })
  @IsOptional()
  @IsArray()
  @Type(() => ScopeAssignmentDto)
  scope?: ScopeAssignmentDto[];

  @ApiPropertyOptional({ description: 'کاربر باید در اولین ورود رمز را تغییر دهد' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  mustChangePassword?: boolean;
}

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  fullName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail({}, { message: 'قالب ایمیل معتبر نیست.' })
  @MaxLength(160)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  mobile?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  employeeId?: string;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus, { message: 'وضعیت کاربر معتبر نیست.' })
  status?: UserStatus;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  roleIds?: string[];

  @ApiPropertyOptional({ type: [ScopeAssignmentDto] })
  @IsOptional()
  @IsArray()
  @Type(() => ScopeAssignmentDto)
  scope?: ScopeAssignmentDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  mfaEnabled?: boolean;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString({ message: 'رمز عبور جدید الزامی است.' })
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  mustChangePassword?: boolean;
}

export class UserQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  roleId?: string;
}
