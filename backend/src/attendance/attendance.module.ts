import { Module } from '@nestjs/common';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { DailyAttendanceService } from './daily-attendance.service';

@Module({
  controllers: [AttendanceController],
  providers: [AttendanceService, DailyAttendanceService],
  exports: [AttendanceService, DailyAttendanceService],
})
export class AttendanceModule {}
