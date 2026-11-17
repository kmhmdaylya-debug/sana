import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { JwtStrategy } from '../../auth/jwt.strategy';
import { swaggerAccess } from './swagger-access';
describe('Swagger access middleware', () => {
  const jwt = { verify: jest.fn() };
  const strategy = { validate: jest.fn() };
  beforeEach(() => { jest.resetAllMocks(); });
  async function call(url: string, authorization?: string) {
    const next = jest.fn();
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await swaggerAccess(new ConfigService({ app: { swaggerAllowedIps: [], jwt: { issuer: 'synthetic' } } }), jwt as unknown as JwtService, strategy as unknown as JwtStrategy)({ originalUrl: url, headers: { authorization }, socket: {} } as never, res as never, next);
    return { res, next };
  }
  it.each(['/api/docs', '/api/docs/', '/api/docs-json', '/api/docs-yaml', '/api/docs/swagger-ui-init.js'])('protects %s', async url => {
    const { res, next } = await call(url);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
  it('requires a live administrator session, not just a signed token', async () => {
    jwt.verify.mockReturnValue({});
    strategy.validate.mockRejectedValue(new Error('Revoked'));
    expect((await call('/api/docs-json', 'Bearer synthetic')).res.status).toHaveBeenCalledWith(401);
    strategy.validate.mockResolvedValue({ isSuperAdmin: false });
    expect((await call('/api/docs-json', 'Bearer synthetic')).res.status).toHaveBeenCalledWith(403);
    strategy.validate.mockResolvedValue({ isSuperAdmin: true });
    expect((await call('/api/docs-json', 'Bearer synthetic')).next).toHaveBeenCalledTimes(1);
  });
});
