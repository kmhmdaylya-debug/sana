import { DatabaseHealthIndicator } from './database.health';

describe('DatabaseHealthIndicator', () => {
  const config = { get: jest.fn().mockReturnValue('./backups') } as never;

  it('reports migrations as applied only when finished and not rolled back', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([
        { migration_name: 'init', finished_at: new Date(), rolled_back_at: null },
        { migration_name: 'indexes', finished_at: null, rolled_back_at: new Date() }, // failed attempt, later re-applied below
        { migration_name: 'indexes', finished_at: new Date(), rolled_back_at: null },
        { migration_name: 'broken', finished_at: null, rolled_back_at: null }, // started, never finished
      ]),
    };
    const indicator = new DatabaseHealthIndicator(prisma as never, config);
    const result = await indicator.migrationStatus('migrations');

    expect(result.migrations).toMatchObject({
      status: 'degraded',
      totalMigrations: 3,
      appliedMigrations: 2,
      pendingMigrations: 1,
      incompleteMigrations: 1,
    });
  });

  it('reports migrations as up when every migration has a successful run', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([
        { migration_name: 'init', finished_at: new Date(), rolled_back_at: null },
        { migration_name: 'old', finished_at: null, rolled_back_at: new Date() }, // rolled-back duplicate of an applied migration
        { migration_name: 'old', finished_at: new Date(), rolled_back_at: null },
      ]),
    };
    const indicator = new DatabaseHealthIndicator(prisma as never, config);
    expect(await indicator.migrationStatus('migrations')).toEqual({
      migrations: { status: 'up', appliedMigrations: 2, pendingMigrations: 0, incompleteMigrations: 0, totalMigrations: 2 },
    });
  });

  it('accepts a fresh database without the migration table but never masks other errors', async () => {
    const fresh = new DatabaseHealthIndicator({ $queryRaw: jest.fn().mockRejectedValue(new Error('The table `public._prisma_migrations` does not exist')) } as never, config);
    expect(await fresh.migrationStatus('migrations')).toEqual({ migrations: { status: 'up', note: 'Migration table not found (fresh DB)' } });

    const broken = new DatabaseHealthIndicator({ $queryRaw: jest.fn().mockRejectedValue(new Error('connection terminated unexpectedly')) } as never, config);
    const result = await broken.migrationStatus('migrations');
    expect(result.migrations).toMatchObject({ status: 'down', error: 'migration status unavailable' });
    expect(JSON.stringify(result)).not.toContain('connection terminated');
  });

  it('never returns raw database error text from the connectivity check', async () => {
    const indicator = new DatabaseHealthIndicator(
      { $queryRaw: jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED postgresql://user:secret@db:5432')) } as never,
      config,
    );
    const result = await indicator.isHealthy('database');
    expect(result.database).toEqual({ status: 'down', error: 'database unreachable' });
  });

  it('reports latency for a reachable database', async () => {
    const indicator = new DatabaseHealthIndicator({ $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) } as never, config);
    const result = await indicator.isHealthy('database');
    expect(result.database).toMatchObject({ status: 'up' });
    expect(String((result.database as { latency?: string }).latency)).toMatch(/ms$/);
  });
});
