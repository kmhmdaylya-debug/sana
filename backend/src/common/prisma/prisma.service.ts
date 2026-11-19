
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import { Prisma, PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { MetricsService } from '../monitoring/metrics.service';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly metricsService: MetricsService,
  ) {
    super({
      datasources: {
        db: {
          url: config.get<string>('app.database.url'),
        },
      },

      // ثبت Query بدون ذخیره پارامترهای حساس
      log: [
        {
          emit: 'event',
          level: 'query',
        },
      ],
    });

    // Database query metrics
    this.$on('query', (event) => {
      try {
        const durationSeconds = event.duration / 1000;

        this.metricsService.observeDbQueryDuration(
          'query',
          'unknown',
          durationSeconds,
        );
      } catch (error) {
        this.logger.warn(
          'Failed to record database query metrics.',
        );
      }
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();

    this.logger.log('اتصال به پایگاه داده برقرار شد.');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();

    this.logger.log('اتصال به پایگاه داده قطع شد.');
  }

  /**
   * قفل سطری برای جلوگیری از تغییرات هم‌زمان
   */
  async lockRow(table: string, id: string): Promise<void> {
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(table)) {
      throw new Error('نام جدول نامعتبر است.');
    }

    await this.$executeRawUnsafe(
      `SELECT id FROM "${table}" WHERE id = $1::uuid FOR UPDATE`,
      id,
    );
  }

  get client(): PrismaClient {
    return this;
  }
}

export { Prisma };
