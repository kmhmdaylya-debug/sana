import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsOptional } from 'class-validator';
import { NotificationStatus } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class NotificationQueryDto extends PaginationDto {
  @IsOptional()
  @IsIn(['true', 'false'])
  isRead?: string;

  @ApiPropertyOptional({ enum: NotificationStatus })
  @IsOptional()
  @IsEnum(NotificationStatus)
  status?: NotificationStatus;

  @ApiPropertyOptional({ default: false, description: 'فقط خوانده‌نشده‌ها' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  unread?: boolean;
}
