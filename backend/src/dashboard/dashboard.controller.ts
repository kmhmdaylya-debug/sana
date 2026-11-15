import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('team-work')
  @RequirePermissions(PERMISSIONS.DASHBOARD_VIEW_MANAGEMENT)
  teamWork(@CurrentUser() user: AuthenticatedUser) {
    return this.service.teamWork(user);
  }

  @Get('attendance-today')
  @RequirePermissions(PERMISSIONS.DASHBOARD_VIEW_MANAGEMENT)
  @ApiOperation({ summary: 'وضعیت حضور امروز کارکنان در حوزهٔ دسترسی مدیر' })
  todayAttendance(@CurrentUser() user: AuthenticatedUser) {
    return this.service.todayAttendance(user);
  }

  @Get('me')
  @RequirePermissions(PERMISSIONS.DASHBOARD_VIEW)
  @ApiOperation({ summary: 'داشبورد شخصی کاربر' })
  myDashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.service.myDashboard(user);
  }

  @Get('management')
  @RequirePermissions(PERMISSIONS.DASHBOARD_VIEW_MANAGEMENT)
  @ApiOperation({ summary: 'داشبورد مدیریتی (شمارش‌های کلیدی)' })
  managementDashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.service.managementDashboard(user);
  }

  @Get('leave-trend')
  @RequirePermissions(PERMISSIONS.DASHBOARD_VIEW_MANAGEMENT)
  @ApiOperation({ summary: 'روند مرخصی‌های ۶ ماه اخیر' })
  leaveTrend(@CurrentUser() user: AuthenticatedUser) {
    return this.service.leaveTrend(user);
  }
}
