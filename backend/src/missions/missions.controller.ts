import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MissionsService } from './missions.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import {
  AttendanceImpactQueryDto,
  CompleteMissionDto,
  CreateMissionDto,
  CreateMissionExpenseDto,
  DecideExpenseDto,
  MissionQueryDto,
  UpdateMissionDto,
} from './dto/missions.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('missions')
@Controller('missions')
export class MissionsController {
  constructor(private readonly service: MissionsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.MISSIONS_VIEW)
  @ApiOperation({ summary: 'فهرست مأموریت‌ها' })
  list(@Query() query: MissionQueryDto, @Query() pagination: PaginationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.list(query, pagination, user);
  }
  @Get('impact')
  @RequirePermissions(PERMISSIONS.MISSIONS_VIEW)
  @ApiOperation({ summary: 'روزهای معافیت حضور به دلیل مأموریت' })
  impact(@Query() query: AttendanceImpactQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.attendanceImpact(query, user);
  }
  @Post()
  @RequirePermissions(PERMISSIONS.MISSIONS_CREATE)
  @ApiOperation({ summary: 'ثبت درخواست مأموریت' })
  create(@Body() dto: CreateMissionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(dto, user);
  }
  @Patch(':id')
  @RequirePermissions(PERMISSIONS.MISSIONS_CREATE)
  @ApiOperation({ summary: 'ویرایش مأموریت (قبل از تأیید)' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMissionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.update(id, dto, user);
  }
  @Post(':id/approve')
  @RequirePermissions(PERMISSIONS.MISSIONS_APPROVE)
  @ApiOperation({ summary: 'تأیید مأموریت' })
  approve(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.decide(id, 'APPROVE', undefined, user);
  }
  @Post(':id/reject')
  @RequirePermissions(PERMISSIONS.MISSIONS_APPROVE)
  @ApiOperation({ summary: 'رد مأموریت' })
  reject(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.decide(id, 'REJECT', undefined, user);
  }
  @Post(':id/start')
  @RequirePermissions(PERMISSIONS.MISSIONS_VIEW)
  @ApiOperation({ summary: 'شروع مأموریت' })
  start(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.setStatus(id, 'IN_PROGRESS', user);
  }
  @Post(':id/complete')
  @RequirePermissions(PERMISSIONS.MISSIONS_VIEW)
  @ApiOperation({ summary: 'تکمیل مأموریت با گزارش' })
  complete(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CompleteMissionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.complete(id, dto, user);
  }
  @Delete(':id')
  @RequirePermissions(PERMISSIONS.MISSIONS_CREATE)
  @ApiOperation({ summary: 'لغو مأموریت' })
  cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.cancel(id, user);
  }
  @Post(':id/expenses')
  @RequirePermissions(PERMISSIONS.MISSIONS_VIEW)
  @ApiOperation({ summary: 'ثبت هزینه مأموریت' })
  addExpense(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateMissionExpenseDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.addExpense(id, dto, user);
  }
  @Post('expenses/:expenseId/decide')
  @RequirePermissions(PERMISSIONS.MISSIONS_APPROVE)
  @ApiOperation({ summary: 'بررسی هزینه مأموریت' })
  decideExpense(@Param('expenseId', ParseUUIDPipe) expenseId: string, @Body() dto: DecideExpenseDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.decideExpense(expenseId, dto, user);
  }
  @Get(':id')
  @RequirePermissions(PERMISSIONS.MISSIONS_VIEW)
  @ApiOperation({ summary: 'جزئیات مأموریت' })
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.get(id, user);
  }
}
