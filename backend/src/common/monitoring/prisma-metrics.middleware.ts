import { PrismaClient } from '@prisma/client';

export function createPrismaMetricsMiddleware(metricsService: any) {
  return async (params: any, next: (params: any) => Promise<any>) => {
    const startTime = process.hrtime.bigint();
    const model = params.model ?? 'unknown';
    const action = params.action;

    try {
      const result = await next(params);
      return result;
    } finally {
      const durationNs = Number(process.hrtime.bigint() - startTime);
      const durationSeconds = durationNs / 1e9;

      const queryType = mapActionToQueryType(action);
      const table = model;

      metricsService.observeDbQueryDuration(queryType, table, durationSeconds);
    }
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

export function applyMetricsMiddleware(prisma: any, metricsService: any): void {
  prisma.$use(createPrismaMetricsMiddleware(metricsService));
}