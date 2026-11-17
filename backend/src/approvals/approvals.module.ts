import { Module } from '@nestjs/common';
import { ApprovalsController } from './approvals.controller';
import { ApprovalsService } from './approvals.service';
import { LeavesModule } from '../leaves/leaves.module';
import { ShiftsModule } from '../shifts/shifts.module';
import { MissionsModule } from '../missions/missions.module';
import { LoansModule } from '../loans/loans.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { LifecycleModule } from '../lifecycle/lifecycle.module';
import { PayrollModule } from '../payroll/payroll.module';

@Module({
  imports: [LeavesModule, ShiftsModule, MissionsModule, LoansModule, AttendanceModule, LifecycleModule, PayrollModule],
  controllers: [ApprovalsController],
  providers: [ApprovalsService],
  exports: [ApprovalsService],
})
export class ApprovalsModule {}
