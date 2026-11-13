import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { CustomFieldEntity } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

// ---------------------------------------------------------------------------
// تنظیمات سیستمی
// ---------------------------------------------------------------------------

export class UpdateSettingDto {
  @ApiProperty({ description: 'مقدار جدید تنظیم' })
  @IsString({ message: 'مقدار الزامی است.' })
  value: string;
}

export class SettingQueryDto extends PaginationDto {
  @ApiPropertyOptional({ example: 'GENERAL' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  group?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  key?: string;
}

// ---------------------------------------------------------------------------
// فیلدهای سفارشی
// ---------------------------------------------------------------------------

export class CreateCustomFieldDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  companyId: string;

  @ApiProperty({ enum: CustomFieldEntity })
  @IsEnum(CustomFieldEntity, { message: 'موجودیت معتبر نیست.' })
  entity: CustomFieldEntity;

  @ApiProperty({ example: 'shirtSize' })
  @IsString({ message: 'کد فیلد الزامی است.' })
  @MaxLength(60)
  code: string;

  @ApiProperty({ example: 'سایز پیراهن' })
  @IsString({ message: 'برچسب الزامی است.' })
  @MaxLength(160)
  label: string;

  @ApiPropertyOptional({ default: 'text', description: 'text / number / date / select' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  dataType?: string;

  @ApiPropertyOptional({ description: 'گزینه‌ها برای select — جدا با |' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  options?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isRequired?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class CustomFieldQueryDto extends PaginationDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  companyId?: string;

  @ApiPropertyOptional({ enum: CustomFieldEntity })
  @IsOptional()
  @IsEnum(CustomFieldEntity)
  entity?: CustomFieldEntity;
}

// ---------------------------------------------------------------------------
// فیلترهای ذخیره‌شده
// ---------------------------------------------------------------------------

export class CreateSavedFilterDto {
  @ApiProperty({ example: 'employees', description: 'حوزه فیلتر (نام صفحه/ماژول)' })
  @IsString({ message: 'حوزه الزامی است.' })
  @MaxLength(60)
  scope: string;

  @ApiProperty()
  @IsString({ message: 'نام فیلتر الزامی است.' })
  @MaxLength(120)
  name: string;

  @ApiProperty({ description: 'پارامترهای فیلتر به‌صورت JSON' })
  @IsString()
  params: string;
}

export class SavedFilterQueryDto extends PaginationDto {
  @ApiPropertyOptional({ example: 'employees' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  scope?: string;
}
