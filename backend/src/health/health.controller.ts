import { Controller, Get } from '@nestjs/common';
import { DatabaseHealthIndicator } from './database.health';
import { ConfigService } from '@nestjs/config';
import { Public } from '../common/decorators/public.decorator';

/**
 * مسیر سلامت برای Probeهای Docker / CI / مانیتورینگ.
 *
 * @Public(): فقط همین کنترلر از JwtAuthGuard و PermissionsGuard مستثنا می‌شود تا
 * health بدون توکن قابل بررسی باشد؛ تمام APIهای دیگر همچنان تحت احراز هویت می‌مانند.
 * پاسخ شامل وضعیت دیتابیس/مهاجرت/دیسک است و هیچ دادهٔ پرسنلی، نام کاربر یا جزئیات اتصال نشان نمی‌دهد.
 */
@Public()
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

    // آمادگی backend فقط به سرویس‌های درونی خودش بستگی دارد؛
    // بررسی frontend اطلاعاتی است (origin مرورگر از داخل کانتینر backend قابل دسترسی نیست).
    const isHealthy = 
      database.database?.status === 'up' &&
      migrations.migrations?.status === 'up' &&
      disk.disk?.status === 'up';

    return {
      success: isHealthy,
      timestamp: new Date().toISOString(),
      checks: {
        database,
        migrations,
        disk,
        frontend: { ...frontend.frontend, informational: true },
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
    // HEALTH_FRONTEND_URL: مسیر قابل‌دسترسی از داخل کانتینر backend (nginx سرویس frontend).
    // CORS_ORIGINS مربوط به مرورگر است و از داخل کانتینر backend قابل رزولوشن نیست.
    const frontendUrl =
      this.config.get<string>('HEALTH_FRONTEND_URL') ??
      this.config.get<string>('CORS_ORIGINS')?.split(',')[0] ??
      'http://localhost:5183';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(frontendUrl, { method: 'HEAD', signal: controller.signal });
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
    } finally {
      // timer must be cleared on every path or the probe keeps the event loop alive
      clearTimeout(timeoutId);
    }
  }
}