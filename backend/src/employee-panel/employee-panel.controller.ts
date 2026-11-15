import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { EmployeePanelService } from './employee-panel.service';
import {
  CheckInDto,
  PanelLeaveRequestDto,
  PanelMissionExpenseDto,
  PanelTaskResultDto,
} from './dto/employee-panel.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('employee-panel')
@Controller('panel')
export class EmployeePanelController {
  constructor(private readonly service: EmployeePanelService) {}

  @Get('tasks')
  @RequirePermissions(PERMISSIONS.PANEL_VIEW)
  @ApiOperation({ summary: 'وظایف واگذارشده به من' })
  myTasks(@Query() query: PaginationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.myTasks(query, user);
  }

  @Post('tasks/:taskId/result')
  @RequirePermissions(PERMISSIONS.PANEL_VIEW)
  @ApiOperation({ summary: 'ثبت نتیجهٔ وظیفهٔ واگذارشده به من' })
  taskResult(@Param('taskId', ParseUUIDPipe) taskId: string, @Body() dto: PanelTaskResultDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.taskResult(taskId, dto, user);
  }

  @Post('tasks/:taskId/dismiss')
  @RequirePermissions(PERMISSIONS.PANEL_VIEW)
  @ApiOperation({ summary: 'حذف کار انجام‌شده فقط از فهرست شخصی کارمند' })
  dismissTask(@Param('taskId', ParseUUIDPipe) taskId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.dismissTask(taskId, user);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.PANEL_VIEW)
  @ApiOperation({ summary: 'خلاصهٔ پنل کارمند' })
  summary(@CurrentUser() user: AuthenticatedUser) {
    return this.service.summary(user);
  }

  @Get('projects')
  @RequirePermissions(PERMISSIONS.PANEL_VIEW)
  @ApiOperation({ summary: 'پروژه‌ها و مراحل من' })
  myProjects(@CurrentUser() user: AuthenticatedUser) {
    return this.service.myProjects(user);
  }

  @Post('tasks/:taskId/check-in')
  @RequirePermissions(PERMISSIONS.PANEL_ATTENDANCE, PERMISSIONS.DASHBOARD_VIEW_MANAGEMENT, PERMISSIONS.ATTENDANCE_CREATE)
  @ApiOperation({ summary: 'ثبت حضور روی مرحلهٔ پروژه' })
  checkIn(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: CheckInDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.checkIn(taskId, dto, user);
  }

  @Get('attendance')
  @RequirePermissions(PERMISSIONS.PANEL_VIEW)
  @ApiOperation({ summary: 'حضور و غیاب من (ماه جاری)' })
  myAttendance(@CurrentUser() user: AuthenticatedUser) {
    return this.service.myAttendance(user);
  }

  @Get('leaves')
  @RequirePermissions(PERMISSIONS.PANEL_VIEW)
  @ApiOperation({ summary: 'درخواست‌های مرخصی من' })
  myLeaves(@CurrentUser() user: AuthenticatedUser) {
    return this.service.myLeaves(user);
  }

  @Post('leaves')
  @RequirePermissions(PERMISSIONS.PANEL_LEAVE_REQUEST)
  @ApiOperation({ summary: 'ثبت درخواست مرخصی' })
  requestLeave(@Body() dto: PanelLeaveRequestDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.requestLeave(dto, user);
  }

  @Get('leave-types')
  @RequirePermissions(PERMISSIONS.PANEL_VIEW)
  @ApiOperation({ summary: 'انواع مرخصی' })
  leaveTypes() {
    return this.service.leaveTypes();
  }

  @Get('missions')
  @RequirePermissions(PERMISSIONS.PANEL_VIEW)
  @ApiOperation({ summary: 'مأموریت‌های من' })
  myMissions(@CurrentUser() user: AuthenticatedUser) {
    return this.service.myMissions(user);
  }

  @Post('missions/:id/expenses')
  @RequirePermissions(PERMISSIONS.PANEL_ATTENDANCE)
  @ApiOperation({ summary: 'ثبت هزینهٔ مأموریت' })
  addMissionExpense(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PanelMissionExpenseDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.addMissionExpense(id, dto, user);
  }

  @Get('payslips')
  @RequirePermissions(PERMISSIONS.PANEL_VIEW)
  @ApiOperation({ summary: 'فیش‌های حقوقی من' })
  myPayslips(@CurrentUser() user: AuthenticatedUser) {
    return this.service.myPayslips(user);
  }

  @Get('payment-schedule')
  @RequirePermissions(PERMISSIONS.PANEL_VIEW)
  @ApiOperation({ summary: 'زمان‌بندی پرداخت حقوق' })
  paymentSchedule(@CurrentUser() user: AuthenticatedUser) {
    return this.service.paymentSchedule(user);
  }

  @Get('profile')
  @RequirePermissions(PERMISSIONS.PANEL_VIEW)
  @ApiOperation({ summary: 'پروندهٔ پرسنلی من' })
  myProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.service.myProfile(user);
  }

}
