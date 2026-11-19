import { Injectable, Logger } from '@nestjs/common';
import { HealthIndicatorResult } from '@nestjs/terminus';
import { PrismaService } from '../common/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

/** پیام خطای دیتابیس بدون افشای رشتهٔ اتصال یا جزئیات داخلی */
const publicErrorMessage = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/postgres(?:ql)?:\/\/[^\s'"]+/gi, 'postgresql://[redacted]')
    .slice(0, 200);
};

@Injectable()
export class DatabaseHealthIndicator {
  private readonly logger = new Logger(DatabaseHealthIndicator.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      // Test database connection
      await this.prisma.$queryRaw`SELECT 1`;
      
      // Check if we can reach the database within timeout
      const start = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      const latency = Date.now() - start;

      const isHealthy = latency < 5000; // 5 second threshold

      return {
        [key]: {
          status: isHealthy ? 'up' : 'degraded',
          latency: `${latency}ms`,
        },
      };
    } catch (error) {
      this.logger.error(`Database health check failed: ${publicErrorMessage(error)}`);
      return {
        [key]: {
          status: 'down',
          error: 'database unreachable',
        },
      };
    }
  }

  async migrationStatus(key: string): Promise<HealthIndicatorResult> {
    try {
      // ستون‌های واقعی جدول _prisma_migrations (نام مهاجرت + وضعیت اجرا)
      const rows = await this.prisma.$queryRaw<
        Array<{ migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }>
      >`
        SELECT migration_name, finished_at, rolled_back_at
        FROM "_prisma_migrations"
        ORDER BY started_at
      `;

      const applied = new Set<string>();
      const failed: string[] = [];
      for (const row of rows) {
        if (row.finished_at && !row.rolled_back_at) applied.add(row.migration_name);
        if (!row.finished_at && !row.rolled_back_at && !failed.includes(row.migration_name)) failed.push(row.migration_name);
      }

      const total = new Set(rows.map((row) => row.migration_name)).size;
      const pending = total - applied.size;
      const isHealthy = pending === 0 && failed.length === 0;

      if (!isHealthy) {
        this.logger.warn(`Migration health degraded: applied=${applied.size} pending=${pending} incomplete=${failed.length}`);
      }

      return {
        [key]: {
          status: isHealthy ? 'up' : 'degraded',
          appliedMigrations: applied.size,
          pendingMigrations: pending,
          incompleteMigrations: failed.length,
          totalMigrations: total,
        },
      };
    } catch (error) {
      // فقط «نبودِ جدول» یعنی دیتابیس تازه؛ خطای دیگر نباید سلامت کاذب گزارش شود
      const message = error instanceof Error ? error.message : String(error);
      const missingTable = /_prisma_migrations/.test(message) && /does not exist|not exist|undefined/i.test(message);
      if (missingTable) {
        return {
          [key]: {
            status: 'up',
            note: 'Migration table not found (fresh DB)',
          },
        };
      }
      this.logger.error(`Migration status check failed: ${publicErrorMessage(error)}`);
      return {
        [key]: {
          status: 'down',
          error: 'migration status unavailable',
        },
      };
    }
  }

  async diskSpace(key: string): Promise<HealthIndicatorResult> {
    try {
      // Check disk space for uploads and backups directories
      const { execSync } = require('child_process');
      const uploadsPath = this.config.get<string>('app.backup.dir') ?? './uploads';
      const backupsPath = this.config.get<string>('app.backup.dir') ?? './backups';
      
      const checkDisk = (path: string) => {
        try {
          const output = execSync(`df -k ${path} | tail -1`, { encoding: 'utf8', timeout: 5000 });
          const parts = output.trim().split(/\s+/);
          const available = parseInt(parts[3], 10); // KB available
          const total = parseInt(parts[1], 10); // KB total
          const usedPercent = ((total - available) / total) * 100;
          
          return {
            available: `${Math.round(available / 1024)}MB`,
            total: `${Math.round(total / 1024)}MB`,
            usedPercent: `${usedPercent.toFixed(1)}%`,
            healthy: usedPercent < 90,
          };
        } catch {
          return { healthy: true, note: 'Disk check unavailable' };
        }
      };

      const uploads = checkDisk(uploadsPath);
      const backups = checkDisk(backupsPath);
      const healthy = uploads.healthy && backups.healthy;

      return {
        [key]: {
          status: healthy ? 'up' : 'degraded',
          uploads,
          backups,
        },
      };
    } catch (error) {
      return {
        [key]: {
          status: 'up',
          note: 'Disk space check not available',
        },
      };
    }
  }
}