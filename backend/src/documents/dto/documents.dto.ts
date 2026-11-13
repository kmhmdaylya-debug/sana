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
import { DocumentType } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class CreateDocumentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4', { message: 'شناسه نیرو معتبر نیست.' })
  employeeId: string;

  @ApiProperty({ enum: DocumentType })
  @IsEnum(DocumentType, { message: 'نوع مدرک معتبر نیست.' })
  docType: DocumentType;

  @ApiProperty({ example: 'قرارداد استخدام ۱۴۰۵' })
  @IsString({ message: 'عنوان مدرک الزامی است.' })
  @MaxLength(160)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  documentNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({})
  issueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({})
  expiryDate?: string;

  @ApiPropertyOptional({ enum: ['NORMAL', 'CONFIDENTIAL', 'SECRET'], default: 'NORMAL' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  confidentiality?: string;
}

export class UpdateDocumentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  documentNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({})
  issueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({})
  expiryDate?: string;

  @ApiPropertyOptional({ enum: ['NORMAL', 'CONFIDENTIAL', 'SECRET'] })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  confidentiality?: string;
}

export class DocumentQueryDto extends PaginationDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  employeeId?: string;

  @ApiPropertyOptional({ enum: DocumentType })
  @IsOptional()
  @IsEnum(DocumentType)
  docType?: DocumentType;

  @ApiPropertyOptional({ default: false, description: 'فقط مدارک دارای تاریخ انقضا در ۶۰ روز آینده' })
  @IsOptional()
  @IsString()
  expiring?: string;

  @ApiPropertyOptional({ enum: ['NORMAL', 'CONFIDENTIAL', 'SECRET'] })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  confidentiality?: string;
}

export class DocumentNoteDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class DocumentIdParamDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  id: string;
}

export class VersionNoteDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @IsInt()
  @Min(0)
  version?: number;
}
