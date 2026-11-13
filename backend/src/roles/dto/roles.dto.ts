import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({ example: 'unit_manager' })
  @IsString({ message: 'کد نقش الزامی است.' })
  @MaxLength(60)
  code: string;

  @ApiProperty({ example: 'مدیر واحد' })
  @IsString({ message: 'نام نقش الزامی است.' })
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiProperty({ type: [String], description: 'کدهای مجوز' })
  @IsArray({ message: 'فهرست مجوزها الزامی است.' })
  @ArrayNotEmpty({ message: 'حداقل یک مجوز انتخاب کنید.' })
  @IsString({ each: true })
  permissions: string[];
}

export class UpdateRoleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;
}

export class PermissionQueryDto {
  @ApiPropertyOptional({ description: 'فیلتر بر اساس گروه' })
  @IsOptional()
  @IsString()
  group?: string;
}
