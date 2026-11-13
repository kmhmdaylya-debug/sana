import { Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { BackupService } from './backup.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { BackupQueryDto } from './dto/backup.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('backup')
@Controller('backup')
export class BackupController {
  constructor(private readonly service: BackupService) {}

  @Get('history')
  @RequirePermissions(PERMISSIONS.BACKUP_MANAGE)
  @ApiOperation({ summary: 'تاریخچه پشتیبان‌گیری' })
  listHistory(@Query() query: BackupQueryDto, @Query() pagination: PaginationDto) {
    return this.service.listHistory(query, pagination);
  }

  @Post('run')
  @RequirePermissions(PERMISSIONS.BACKUP_MANAGE)
  @ApiOperation({ summary: 'اجرای پشتیبان‌گیری' })
  runBackup(@CurrentUser() user: AuthenticatedUser) {
    return this.service.runBackup(user);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.BACKUP_MANAGE)
  @ApiOperation({ summary: 'جزئیات رکورد پشتیبان' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(id);
  }
}
