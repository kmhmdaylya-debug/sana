import { Injectable } from '@nestjs/common';
import { HealthIndicatorResult } from '@nestjs/terminus';
import { PrismaService } from '../common/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DatabaseHealthIndicator {
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
      return {
        [key]: {
          status: 'down',
          error: error.message,
        },
      };
    }
  }

  async migrationStatus(key: string): Promise<HealthIndicatorResult> {
    try {
      // Check if there are pending migrations
      const migrations = await this.prisma.$queryRaw<Array<{ name: string; applied: boolean }>>`
        SELECT name, applied_at IS NOT NULL as applied
        FROM "_prisma_migrations"
        ORDER BY finished_at DESC
      `;

      const pending = migrations.filter(m => !m.applied).length;
      const isHealthy = pending === 0;

      return {
        [key]: {
          status: isHealthy ? 'up' : 'degraded',
          pendingMigrations: pending,
          totalMigrations: migrations.length,
        },
      };
    } catch (error) {
      // Table might not exist in fresh DB
      return {
        [key]: {
          status: 'up',
          note: 'Migration table not found (fresh DB)',
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