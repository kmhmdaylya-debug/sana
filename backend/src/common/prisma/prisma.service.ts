import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(private readonly config: ConfigService) {
    super({
      datasources: {
        db: { url: config.get<string>('app.database.url') },
      },
      log: config.get<boolean>('app.database.logQueries')
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'stdout', level: 'warn' },
            { emit: 'stdout', level: 'error' },
          ]
        : [{ emit: 'stdout', level: 'warn' }, { emit: 'stdout', level: 'error' }],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('اتصال به پایگاه داده برقرار شد.');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * قفل سطری روی رکورد — برای جلوگیری از بازنویسی تغییرات هم‌زمان.
   */
  async lockRow(table: string, id: string): Promise<void> {
    // نام جدول فقط می‌تواند شناسهٔ ساده باشد (جلوگیری از تزریق SQL)
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(table)) {
      throw new Error('نام جدول نامعتبر است.');
    }
    await this.$executeRawUnsafe(`SELECT id FROM "${table}" WHERE id = $1::uuid FOR UPDATE`, id);
  }


  get client(): PrismaClient {
    return this;
  }
}

export { Prisma };
