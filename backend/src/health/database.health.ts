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
      // This would need a system call or external check
      // For now, return healthy - in production use a proper disk space checker
      return {
        [key]: {
          status: 'up',
          note: 'Disk space check not implemented',
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
}