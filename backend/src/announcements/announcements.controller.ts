import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AnnouncementsService } from './announcements.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { AnnouncementQueryDto, CreateAnnouncementDto } from './dto/announcements.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('announcements')
@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly service: AnnouncementsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ANNOUNCEMENTS_VIEW)
  @ApiOperation({ summary: 'فهرست اعلامیه‌ها' })
  list(@Query() query: AnnouncementQueryDto, @Query() pagination: PaginationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.list(query, pagination, user);
  }
  @Post()
  @RequirePermissions(PERMISSIONS.ANNOUNCEMENTS_MANAGE)
  @ApiOperation({ summary: 'انتشار اعلامیه' })
  create(@Body() dto: CreateAnnouncementDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(dto, user);
  }
  @Post(':id/acknowledge')
  @RequirePermissions(PERMISSIONS.ANNOUNCEMENTS_VIEW)
  @ApiOperation({ summary: 'تأیید مطالعه اعلامیه' })
  acknowledge(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.acknowledge(id, user);
  }
  @Delete(':id')
  @RequirePermissions(PERMISSIONS.ANNOUNCEMENTS_MANAGE)
  @ApiOperation({ summary: 'حذف اعلامیه' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.remove(id, user);
  }
  @Get(':id')
  @RequirePermissions(PERMISSIONS.ANNOUNCEMENTS_VIEW)
  @ApiOperation({ summary: 'جزئیات اعلامیه' })
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.get(id, user);
  }
}
