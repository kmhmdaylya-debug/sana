import 'reflect-metadata';
import { HealthController } from './health.controller';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';

const healthyIndicator = {
  isHealthy: jest.fn().mockResolvedValue({ database: { status: 'up', latency: '2ms' } }),
  migrationStatus: jest.fn().mockResolvedValue({ migrations: { status: 'up', appliedMigrations: 12, pendingMigrations: 0, incompleteMigrations: 0, totalMigrations: 12 } }),
  diskSpace: jest.fn().mockResolvedValue({ disk: { status: 'up' } }),
};

const config = { get: jest.fn().mockReturnValue('http://localhost:8080') } as never;

describe('Health endpoints', () => {
  beforeEach(() => jest.clearAllMocks());

  it('is marked @Public so probes work without a token while other APIs stay protected', () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, HealthController)).toBe(true);
  });

  it('reports database, migrations and disk status without connection or user data', async () => {
    const controller = new HealthController(healthyIndicator as never, config);
    const result = await controller.check();

    expect(result.success).toBe(true);
    expect(result.checks.database.database).toMatchObject({ status: 'up' });
    expect(result.checks.migrations.migrations).toMatchObject({ status: 'up', pendingMigrations: 0, totalMigrations: 12 });
    expect(result.checks.disk.disk).toMatchObject({ status: 'up' });
    expect(healthyIndicator.isHealthy).toHaveBeenCalledTimes(1);
    // frontend check is informational: the browser origin is not reachable from the api container
    expect(result.checks.frontend).toMatchObject({ informational: true });
    expect(JSON.stringify(result)).not.toMatch(/postgres:\/\//);
    expect(JSON.stringify(result)).not.toMatch(/password/i);
  });

  it('keeps the full report green when only the informational frontend probe fails', async () => {
    const controller = new HealthController(
      { ...healthyIndicator, diskSpace: jest.fn().mockResolvedValue({ disk: { status: 'up' } }) } as never,
      { get: jest.fn().mockReturnValue('http://unreachable-origin:1') } as never,
    );
    const result = await controller.check();
    expect(result.success).toBe(true);
    expect(result.checks.frontend).toMatchObject({ status: 'down', informational: true });
  });

  it('marks readiness down when the database is unreachable', async () => {
    const controller = new HealthController(
      { ...healthyIndicator, isHealthy: jest.fn().mockResolvedValue({ database: { status: 'down', error: 'database unreachable' } }) } as never,
      config,
    );
    const result = await controller.ready();
    expect(result.success).toBe(false);
    expect(result.checks.database.database).toMatchObject({ status: 'down' });
    expect(JSON.stringify(result)).not.toMatch(/synthetic-private-connection/);
  });

  it('marks readiness down when migrations are pending or incomplete', async () => {
    const controller = new HealthController(
      { ...healthyIndicator, migrationStatus: jest.fn().mockResolvedValue({ migrations: { status: 'degraded', pendingMigrations: 1, incompleteMigrations: 1, totalMigrations: 12 } }) } as never,
      config,
    );
    const result = await controller.ready();
    expect(result.success).toBe(false);
    expect(result.checks.migrations.migrations).toMatchObject({ status: 'degraded' });
  });

  it('liveness reports database connectivity only', async () => {
    const controller = new HealthController(healthyIndicator as never, config);
    const result = await controller.live();
    expect(result).toMatchObject({ success: true });
    expect(Object.keys(result.checks)).toEqual(['database']);
    expect(healthyIndicator.migrationStatus).not.toHaveBeenCalled();
  });
});
