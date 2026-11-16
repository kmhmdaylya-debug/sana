import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
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

export class RestoreBackupDto {
  @IsUUID('4')
  backupId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(256)
  currentPassword: string;

  @IsString()
  @MaxLength(100)
  confirmationDatabase: string;
}
