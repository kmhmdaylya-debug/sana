import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { NotificationQueryDto } from './dto/notifications.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.NOTIFICATIONS_VIEW)
  @ApiOperation({ summary: 'فهرست اعلان‌های من' })
  list(@Query() query: NotificationQueryDto, @Query() pagination: PaginationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.list(query, pagination, user);
  }

  @Get('unread-count')
  @RequirePermissions(PERMISSIONS.NOTIFICATIONS_VIEW)
  @ApiOperation({ summary: 'شمار اعلان‌های خوانده‌نشده' })
  unreadCount(@CurrentUser() user: AuthenticatedUser) {
    return this.service.unreadCount(user);
  }

  @Post(':id/read')
  @RequirePermissions(PERMISSIONS.NOTIFICATIONS_VIEW)
  @ApiOperation({ summary: 'علامت‌گذاری اعلان به‌عنوان خوانده‌شده' })
  markRead(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.markRead(id, user);
  }

  @Post('read-all')
  @RequirePermissions(PERMISSIONS.NOTIFICATIONS_VIEW)
  @ApiOperation({ summary: 'خواندن همه اعلان‌ها' })
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.service.markAllRead(user);
  }
}
