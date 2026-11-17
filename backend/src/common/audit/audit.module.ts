import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditOutboxProcessor } from './audit-outbox.processor';

@Global()
@Module({
  providers: [AuditService, AuditOutboxProcessor],
  exports: [AuditService],
})
export class AuditModule {}
