import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApprovalsService } from './approvals.service';
import {
  ApprovalFlowQueryDto,
  ApprovalInstanceQueryDto,
  CreateApprovalFlowDto,
  CreateApprovalInstanceDto,
  DecideTaskDto,
  ExpireOverdueDto,
  InboxQueryDto,
  UpdateApprovalFlowDto,
} from './dto/approvals.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('approvals')
@Controller('approvals')
export class ApprovalsController {
  constructor(private readonly service: ApprovalsService) {}

  // =========================================================================
  // گردش‌های تأیید
  // =========================================================================

  @Get('flows')
  @RequirePermissions(PERMISSIONS.APPROVALS_VIEW)
  @ApiOperation({ summary: 'فهرست گردش‌های تأیید' })
  listFlows(@Query() query: ApprovalFlowQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.listFlows(query, user);
  }
  @Post('flows')
  @RequirePermissions(PERMISSIONS.APPROVALS_MANAGE)
  @ApiOperation({ summary: 'تعریف گردش تأیید جدید' })
  createFlow(@Body() dto: CreateApprovalFlowDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createFlow(dto, user);
  }
  @Patch('flows/:id')
  @RequirePermissions(PERMISSIONS.APPROVALS_MANAGE)
  @ApiOperation({ summary: 'ویرایش گردش تأیید (نسخه جدید می‌سازد)' })
  updateFlow(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateApprovalFlowDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.updateFlow(id, dto, user);
  }
  @Delete('flows/:id')
  @RequirePermissions(PERMISSIONS.APPROVALS_MANAGE)
  @ApiOperation({ summary: 'غیرفعال‌سازی گردش تأیید' })
  deactivateFlow(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.deactivateFlow(id, user);
  }
  @Post('flows/seed-defaults')
  @RequirePermissions(PERMISSIONS.APPROVALS_MANAGE)
  @ApiOperation({ summary: 'ساخت گردش‌های پیش‌فرض سامانه' })
  seedDefaults(@CurrentUser() user: AuthenticatedUser) {
    return this.service.ensureDefaultFlows(user);
  }
  @Post('instances')
  @RequirePermissions(PERMISSIONS.APPROVALS_VIEW)
  @ApiOperation({ summary: 'آغاز نمونه گردش تأیید برای موضوع مشخص' })
  createInstance(@Body() dto: CreateApprovalInstanceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createInstance(dto, user);
  }
  @Get('instances')
  @RequirePermissions(PERMISSIONS.APPROVALS_VIEW)
  @ApiOperation({ summary: 'فهرست نمونه‌های گردش' })
  listInstances(@Query() query: ApprovalInstanceQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.listInstances(query, user);
  }
  @Get('inbox')
  @RequirePermissions(PERMISSIONS.APPROVALS_VIEW)
  @ApiOperation({ summary: 'صندوق ورودی تأیید کاربر جاری' })
  inbox(@Query() query: InboxQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.inbox(query, user);
  }
  @Post('tasks/:id/decide')
  @RequirePermissions(PERMISSIONS.APPROVALS_DECIDE)
  @ApiOperation({ summary: 'تصمیم روی task تأیید (تأیید/رد/اصلاح/ارجاع)' })
  decide(@Param('id', ParseUUIDPipe) taskId: string, @Body() dto: DecideTaskDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.decideTask(taskId, dto, user);
  }
  @Post('expire-overdue')
  @RequirePermissions(PERMISSIONS.APPROVALS_MANAGE)
  @ApiOperation({ summary: 'انقضای task عقب‌افتاده از SLA' })
  expireOverdue(@Body() dto: ExpireOverdueDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.expireOverdue(dto, user);
  }
  @Get('flows/:id')
  @RequirePermissions(PERMISSIONS.APPROVALS_VIEW)
  @ApiOperation({ summary: 'جزئیات گردش تأیید با مراحل' })
  getFlow(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.getFlow(id, user);
  }
  @Get('instances/:id')
  @RequirePermissions(PERMISSIONS.APPROVALS_VIEW)
  @ApiOperation({ summary: 'جزئیات نمونه گردش' })
  getInstance(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.getInstance(id, user);
  }
}
