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
  Min,
} from 'class-validator';
import { AssetHandoverType, AssetStatus } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class CreateAssetDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  companyId: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  orgUnitId?: string;

  @ApiProperty({ example: 'AST-0012' })
  @IsString({ message: 'کد دارایی الزامی است.' })
  @MaxLength(40)
  code: string;

  @ApiProperty({ example: 'لپ‌تاپ لنوو T14' })
  @IsString({ message: 'نام دارایی الزامی است.' })
  @MaxLength(160)
  name: string;

  @ApiProperty({ example: 'EQUIPMENT' })
  @IsString({ message: 'دسته‌بندی الزامی است.' })
  @MaxLength(60)
  category: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  brand?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  model?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  serialNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({})
  purchaseDate?: string;

  @ApiPropertyOptional({ description: 'قیمت خرید (ریال)' })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  purchasePrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({})
  warrantyEnd?: string;

  @ApiPropertyOptional({ enum: AssetStatus, default: AssetStatus.IN_STOCK })
  @IsOptional()
  @IsEnum(AssetStatus)
  status?: AssetStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  condition?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class UpdateAssetDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  brand?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  model?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  serialNumber?: string;

  @ApiPropertyOptional({ enum: AssetStatus })
  @IsOptional()
  @IsEnum(AssetStatus)
  status?: AssetStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  condition?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  orgUnitId?: string;
}

export class AssetQueryDto extends PaginationDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  companyId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  orgUnitId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  holderId?: string;

  @ApiPropertyOptional({ enum: AssetStatus })
  @IsOptional()
  @IsEnum(AssetStatus)
  status?: AssetStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string;
}

export class CreateHandoverDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  assetId: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'تحویل‌دهنده (خودکار از وضعیت فعلی)' })
  @IsOptional()
  @IsUUID('4')
  fromEmployeeId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'تحویل‌گیرنده' })
  @IsOptional()
  @IsUUID('4')
  toEmployeeId?: string;

  @ApiProperty({ enum: AssetHandoverType })
  @IsEnum(AssetHandoverType, { message: 'نوع تحویل معتبر نیست.' })
  handoverType: AssetHandoverType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  condition?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class CreateMaintenanceDto {
  @ApiProperty({ enum: ['REPAIR', 'PREVENTIVE', 'CALIBRATION'] })
  @IsString()
  @MaxLength(30)
  maintenanceType: string;

  @ApiProperty()
  @IsDateString({}, { message: 'تاریخ انجام الزامی است.' })
  performedAt: string;

  @ApiPropertyOptional({ description: 'هزینه (ریال)' })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  cost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  vendor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({})
  nextDueDate?: string;
}

export class CreateDepreciationDto {
  @ApiProperty({ minimum: 1300 })
  @IsInt()
  @Min(1300)
  periodYear: number;

  @ApiProperty({ minimum: 1, maximum: 12 })
  @IsInt()
  @Min(1)
  periodMonth: number;

  @ApiProperty({ description: 'مبلغ استهلاک دوره (ریال)' })
  @Type(() => Number)
  @Min(0)
  amount: number;

  @ApiProperty({ description: 'ارزش دفتری پس از استهلاک (ریال)' })
  @Type(() => Number)
  @Min(0)
  bookValue: number;
}
