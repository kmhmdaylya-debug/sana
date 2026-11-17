import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AuditOutbox } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditOutboxProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuditOutboxProcessor.name);
  private timer?: ReturnType<typeof setInterval>;
  private running: Promise<void> | null = null;
  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.run(), 30000);
    this.timer.unref();
  }
  async onModuleDestroy() {
    clearInterval(this.timer);
    await this.running;
  }
  private run() {
    if (this.running) return this.running;
    this.running = this.processOutbox().then(() => this.cleanupProcessed()).catch(() => {
      this.logger.warn('Audit outbox processing failed; diagnostics suppressed.');
    }).finally(() => { this.running = null; });
    return this.running;
  }
  async processOutbox() {
    for (let i = 0; i < 100; i++) {
      let selected: AuditOutbox | undefined;
      try {
        const processed = await this.prisma.$transaction(async db => {
          // Row locks prevent another server from delivering the same event twice.
          const [entry] = await db.$queryRaw<AuditOutbox[]>`SELECT * FROM "AuditOutbox" WHERE "processedAt" IS NULL AND "retryCount" < 10 ORDER BY "createdAt" LIMIT 1 FOR UPDATE SKIP LOCKED`;
          if (!entry) return false;
          selected = entry;
          const { id, retryCount, processedAt, ...data } = entry;
          await db.auditLog.create({ data });
          await db.auditOutbox.update({ where: { id }, data: { processedAt: new Date() } });
          return true;
        });
        if (!processed) break;
      } catch {
        if (!selected) throw new Error('Audit outbox unavailable');
        await this.prisma.auditOutbox.updateMany({
          where: { id: selected.id, processedAt: null, retryCount: selected.retryCount },
          data: { retryCount: { increment: 1 } },
        });
        this.logger.warn('Audit outbox delivery failed; confidential diagnostics suppressed.');
        break;
      }
    }
  }
  async retryFailed() { await this.processOutbox(); }
  async cleanupProcessed() {
    await this.prisma.auditOutbox.deleteMany({ where: { processedAt: { lt: new Date(Date.now() - 30 * 86400000) } } });
  }
}
