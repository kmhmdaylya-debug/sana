import { Controller, Get } from '@nestjs/common';
import { DatabaseHealthIndicator } from './database.health';
import { ConfigService } from '@nestjs/config';

@Controller('health')
export class HealthController {
  constructor(
    private readonly db: DatabaseHealthIndicator,
    private readonly config: ConfigService,
  ) {}

  @Get()
  async check() {
    const [database, migrations, disk, frontend] = await Promise.all([
      this.db.isHealthy('database'),
      this.db.migrationStatus('migrations'),
      this.db.diskSpace('disk'),
      this.checkFrontend(),
    ]);

    const isHealthy = 
      database.database?.status === 'up' &&
      migrations.migrations?.status === 'up' &&
      disk.disk?.status === 'up' &&
      frontend.frontend?.status === 'up';

    return {
      success: isHealthy,
      timestamp: new Date().toISOString(),
      checks: {
        database,
        migrations,
        disk,
        frontend,
      },
    };
  }

  @Get('ready')
  async ready() {
    const [database, migrations, disk] = await Promise.all([
      this.db.isHealthy('database'),
      this.db.migrationStatus('migrations'),
      this.db.diskSpace('disk'),
    ]);

    const isReady = 
      database.database?.status === 'up' &&
      migrations.migrations?.status === 'up' &&
      disk.disk?.status === 'up';

    return {
      success: isReady,
      timestamp: new Date().toISOString(),
      checks: {
        database,
        migrations,
        disk,
      },
    };
  }

  @Get('live')
  async live() {
    const database = await this.db.isHealthy('database');

    return {
      success: database.database?.status === 'up',
      timestamp: new Date().toISOString(),
      checks: {
        database,
      },
    };
  }

  private async checkFrontend() {
    try {
      const frontendUrl = this.config.get<string>('CORS_ORIGINS')?.split(',')[0] ?? 'http://localhost:5183';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(frontendUrl, { method: 'HEAD', signal: controller.signal });
      clearTimeout(timeoutId);
      return {
        frontend: {
          status: response.ok ? 'up' : 'down',
          url: frontendUrl,
        },
      };
    } catch {
      return {
        frontend: {
          status: 'down',
          error: 'Frontend unreachable',
        },
      };
    }
  }
}