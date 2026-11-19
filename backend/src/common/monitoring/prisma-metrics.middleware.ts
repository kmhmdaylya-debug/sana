import { PrismaClient } from '@prisma/client';

/**
 * Prisma 6 دیگر client middleware (پرچم `$use`) را ندارد؛ جایگزین رسمی Client Extensions است.
 * این extension زمان اجرای عملیات مدل‌ها را می‌سنجد و به Prometheus گزارش می‌دهد.
 */
export function createPrismaMetricsExtension(metricsService: any) {
  return {
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }: any) {
          const startTime = process.hrtime.bigint();
          try {
            return await query(args);
          } finally {
            const durationNs = Number(process.hrtime.bigint() - startTime);
            const durationSeconds = durationNs / 1e9;
            metricsService.observeDbQueryDuration(mapActionToQueryType(operation), model ?? 'unknown', durationSeconds);
          }
        },
      },
    },
  };
}

function mapActionToQueryType(action: string): string {
  switch (action) {
    case 'findUnique':
    case 'findFirst':
    case 'findMany':
    case 'findFirstOrThrow':
    case 'findUniqueOrThrow':
      return 'select';
    case 'create':
    case 'createMany':
      return 'insert';
    case 'update':
    case 'updateMany':
    case 'upsert':
      return 'update';
    case 'delete':
    case 'deleteMany':
      return 'delete';
    case 'count':
      return 'count';
    case 'aggregate':
    case 'groupBy':
      return 'aggregate';
    case '$queryRaw':
    case '$queryRawUnsafe':
    case '$executeRaw':
    case '$executeRawUnsafe':
      return 'raw';
    case '$transaction':
      return 'transaction';
    default:
      return action.toLowerCase();
  }
}

/**
 * extension را روی client اعمال می‌کند و delegateهای آن را روی همان instance می‌گذارد؛
 * بنابراین تمام call siteهای موجود (`this.prisma.xxx` و `tx.xxx` داخل تراکنش) بدون تغییر کار می‌کنند.
 * (Prisma 6 `$use` را حذف کرده است؛ `$extends` جایگزین رسمی آن است.)
 */
export function applyMetricsMiddleware(prisma: any, metricsService: any): void {
  const extended = (prisma as PrismaClient).$extends(createPrismaMetricsExtension(metricsService));
  for (const key of Object.keys(extended)) {
    // `constructor` کلاس واقعی را بازنویسی نکند
    if (key === 'constructor') continue;
    prisma[key] = (extended as any)[key];
  }
}
