import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { BackupResult } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class BackupQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: BackupResult })
  @IsOptional()
  @IsEnum(BackupResult)
  result?: BackupResult;
}

export class RunBackupDto {
  @ApiPropertyOptional({ default: false, description: 'شامل فایل‌های آپلودی' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  includeUploads?: boolean;
}
