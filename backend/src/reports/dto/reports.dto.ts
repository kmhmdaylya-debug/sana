import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class RunReportDto {
  @ApiProperty({ example: 'employees.directory', description: 'کد گزارش' })
  @IsString({ message: 'کد گزارش الزامی است.' })
  @MaxLength(60)
  reportCode: string;

  @ApiPropertyOptional({ enum: ['csv', 'xlsx'], default: 'csv' })
  @IsOptional()
  @IsIn(['csv', 'xlsx'], { message: 'فرمت خروجی معتبر نیست.' })
  format?: 'csv' | 'xlsx';

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  companyId?: string;

  @ApiPropertyOptional({ example: '2026-05-01' })
  @IsOptional()
  @IsDateString({})
  from?: string;

  @ApiPropertyOptional({ example: '2026-05-31' })
  @IsOptional()
  @IsDateString({})
  to?: string;

  @ApiPropertyOptional({ description: 'سال جلالی (برای گزارش‌های ماهانه)' })
  @IsOptional()
  @Type(() => Number)
  year?: number;

  @ApiPropertyOptional({ description: 'ماه جلالی ۱ تا ۱۲' })
  @IsOptional()
  @Type(() => Number)
  month?: number;
}

export class ReportRunQueryDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  reportCode?: string;
}
