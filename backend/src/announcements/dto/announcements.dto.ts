import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class CreateAnnouncementDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  companyId: string;

  @ApiProperty()
  @IsString({ message: 'عنوان اعلامیه الزامی است.' })
  @MaxLength(240)
  title: string;

  @ApiProperty()
  @IsString({ message: 'متن اعلامیه الزامی است.' })
  body: string;

  @ApiPropertyOptional({ default: 'ALL', description: 'ALL / ORG_UNIT / BRANCH / POSITION' })
  @IsOptional()
  @IsString()
  @IsIn(['ALL', 'ORG_UNIT', 'BRANCH', 'POSITION'])
  @MaxLength(30)
  targetType?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'شناسه مخاطب هدف (واحد/شعبه/سمت)' })
  @IsOptional()
  @IsUUID('4')
  targetId?: string;

  @ApiPropertyOptional({ default: false, description: 'نیاز به تأیید مطالعه' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  requiresAck?: boolean;

  @ApiPropertyOptional({ description: 'مسیر فایل پیوست' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  attachmentPath?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({})
  expiresAt?: string;
}

export class AnnouncementQueryDto extends PaginationDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  companyId?: string;

  @ApiPropertyOptional({ default: false, description: 'فقط اعلامیه‌های نیازمند تأیید من' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  pendingAck?: boolean;
}
