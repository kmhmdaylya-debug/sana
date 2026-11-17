import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';

describe('Readiness health endpoint', () => {
  it('checks the database and returns no connection or user information', async () => {
    const query = jest.fn().mockResolvedValue([{ '?column?': 1 }]);
    const controller = new HealthController({ $queryRaw: query } as never);
    expect(await controller.check()).toEqual({ status: 'ok' });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('returns unavailable without disclosing database errors', async () => {
    const controller = new HealthController({ $queryRaw: jest.fn().mockRejectedValue(new Error('synthetic-private-connection')) } as never);
    await expect(controller.check()).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(controller.check()).rejects.not.toThrow('synthetic-private-connection');
  });
});
