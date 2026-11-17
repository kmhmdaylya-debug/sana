import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { Public } from '../common/decorators/public.decorator';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok' };
    } catch {
      throw new ServiceUnavailableException('سرویس آماده پاسخ‌گویی نیست.');
    }
  }
}
