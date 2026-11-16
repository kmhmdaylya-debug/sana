import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { RestoreBackupDto } from './dto/backup.dto';
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
  listHistory(@Query() query: BackupQueryDto, @Query() pagination: PaginationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.listHistory(query, pagination, user);
  }

  @Post('run')
  @RequirePermissions(PERMISSIONS.BACKUP_MANAGE)
  @ApiOperation({ summary: 'اجرای پشتیبان‌گیری' })
  runBackup(@CurrentUser() user: AuthenticatedUser) {
    return this.service.runBackup(user);
  }

  @Post('restore')
  @RequirePermissions(PERMISSIONS.BACKUP_MANAGE)
  restore(@Body() dto: RestoreBackupDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.restore(dto, user);
  }

  @Get(':id/download')
  @RequirePermissions(PERMISSIONS.BACKUP_MANAGE)
  async download(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser, @Res() response: Response) {
    const result = await this.service.download(id, user);
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Type', 'application/octet-stream');
    response.attachment(result.fileName);
    return response.send(result.buffer);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.BACKUP_MANAGE)
  @ApiOperation({ summary: 'جزئیات رکورد پشتیبان' })
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.get(id, user);
  }
}
