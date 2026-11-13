import { Module } from '@nestjs/common';
import { EmployeePanelController } from './employee-panel.controller';
import { EmployeePanelService } from './employee-panel.service';

@Module({
  controllers: [EmployeePanelController],
  providers: [EmployeePanelService],
  exports: [EmployeePanelService],
})
export class EmployeePanelModule {}
