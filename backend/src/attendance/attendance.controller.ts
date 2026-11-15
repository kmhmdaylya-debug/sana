import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import { DailyAttendanceService } from './daily-attendance.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import {
  AttendanceRecordQueryDto,
  ComputeAttendanceDto,
  CorrectionQueryDto,
  CreateCorrectionDto,
  CreateDeviceDto,
  DecideCorrectionDto,
  DeviceQueryDto,
  IngestEventsDto,
  MonthlySheetDto,
  MyAttendanceQueryDto,
  UpdateDeviceDto,
} from './dto/attendance.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('attendance')
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly service: AttendanceService, private readonly daily: DailyAttendanceService) {}

  @Get('daily')
  dailyStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.daily.status(user);
  }

  // =========================================================================
  // دستگاه‌ها
  // =========================================================================

  @Get('devices')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_VIEW)
  @ApiOperation({ summary: 'فهرست دستگاه‌های حضور' })
  listDevices(@Query() query: DeviceQueryDto, @Query() pagination: PaginationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.listDevices(query, pagination, user);
  }
  @Post('devices')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_CREATE)
  @ApiOperation({ summary: 'ثبت دستگاه حضور' })
  createDevice(@Body() dto: CreateDeviceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createDevice(dto, user.id);
  }
  @Patch('devices/:id')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_UPDATE)
  @ApiOperation({ summary: 'ویرایش دستگاه' })
  updateDevice(@Param('id') id: string, @Body() dto: UpdateDeviceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.updateDevice(id, dto, user.id);
  }
  @Delete('devices/:id')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_UPDATE)
  @ApiOperation({ summary: 'غیرفعال‌سازی دستگاه' })
  deleteDevice(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.deleteDevice(id, user.id);
  }
  @Post('events')
  @Public()
  @ApiOperation({ summary: 'دریافت رویدادهای حضور از دستگاه (احراز هویت با X-Device-Code و X-Device-Secret)' })
  ingest(
    @Body() dto: IngestEventsDto,
    @Headers('x-device-code') deviceCode: string,
    @Headers('x-device-secret') deviceSecret: string,
  ) {
    return this.service.ingestFromDevice(dto, deviceCode, deviceSecret);
  }
  @Post('compute')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_CREATE)
  @ApiOperation({ summary: 'محاسبه کارکرد بازه مشخص' })
  compute(@Body() dto: ComputeAttendanceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.compute(dto, user);
  }
  @Get('records')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_VIEW)
  @ApiOperation({ summary: 'فهرست رکوردهای حضور' })
  listRecords(
    @Query() query: AttendanceRecordQueryDto,
    @Query() pagination: PaginationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.listRecords(query, pagination, user);
  }
  @Get('me')
  @ApiOperation({ summary: 'حضور و غیاب خود کاربر' })
  myAttendance(@Query() query: MyAttendanceQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.myAttendance(query, user);
  }
  @Get('sheet')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_VIEW)
  @ApiOperation({ summary: 'کارت ماهانه حضور (ماه شمسی)' })
  monthlySheet(@Query() query: MonthlySheetDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.monthlySheet(query, user);
  }
  @Get('corrections')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_VIEW)
  @ApiOperation({ summary: 'فهرست اصلاحیه‌های حضور' })
  listCorrections(
    @Query() query: CorrectionQueryDto,
    @Query() pagination: PaginationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.listCorrections(query, pagination, user);
  }
  @Post('corrections')
  @ApiOperation({ summary: 'ثبت اصلاحیه حضور' })
  createCorrection(@Body() dto: CreateCorrectionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createCorrection(dto, user);
  }
  @Post('corrections/:id/decide')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_APPROVE)
  @ApiOperation({ summary: 'بررسی اصلاحیه (تأیید/رد)' })
  decideCorrection(@Param('id') id: string, @Body() dto: DecideCorrectionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.decideCorrection(id, dto, user);
  }
  @Get('devices/:id')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_VIEW)
  @ApiOperation({ summary: 'جزئیات دستگاه' })
  getDevice(@Param('id') id: string) {
    return this.service.getDevice(id);
  }
}
