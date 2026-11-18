import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { randomBytes, randomUUID } from 'crypto';
import request = require('supertest');
import { AccessService } from '../common/access/access.service';
import { AuditService } from '../common/audit/audit.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { NotificationService } from '../common/notifications/notification.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { hashPassword, verifyPassword } from '../common/utils/password.util';
import { hashToken } from '../common/utils/crypto.util';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

// HTTP/guard/crypto integration with an in-memory repository, not a database test.
describe('Authentication security', () => {
  let app: INestApplication;
  let service: AuthService;
  let jwt: JwtService;
  let user: any;
  let db: any;
  let tokens: any[];
  let sessions: any[];
  let blockedTokens: { tokenId: string; expiresAt: Date }[];
  let passwordHash: string;
  const password = 'Test-only!Password987';
  const headers = { 'user-agent': 'security-tests' };
  const req: any = { headers, ip: '127.0.0.1' };
  const configValues: Record<string, unknown> = {
    'app.jwt.accessSecret': randomBytes(48).toString('hex'),
    'app.jwt.issuer': 'sana-security-tests',
    'app.jwt.accessExpiresIn': '15m',
    'app.jwt.refreshGraceSeconds': 60,
    'app.security.maxLoginAttempts': 3,
    'app.security.loginLockoutMinutes': 15,
  };
  const config = { get: (key: string) => configValues[key] };
  const matches = (row: any, where: any): boolean => Object.entries(where ?? {}).every(([key, value]: [string, any]) => {
    if (key === 'OR') return value.some((part: any) => matches(row, part));
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      if ('gt' in value) return row[key] != null && row[key] > value.gt;
      if ('equals' in value) return String(row[key]).toLowerCase() === value.equals.toLowerCase();
    }
    return row[key] === value;
  });
  const updateMany = (rows: any[], args: any) => {
    const selected = rows.filter(row => matches(row, args.where));
    selected.forEach(row => Object.assign(row, args.data));
    return { count: selected.length };
  };
  const cookieToken = (response: request.Response) => {
    const cookies = response.headers['set-cookie'] as unknown as string[];
    return decodeURIComponent(cookies.find(value => value.startsWith('refresh_token='))!.split(';')[0].slice('refresh_token='.length));
  };
  const login = () => request(app.getHttpServer()).post('/auth/login').send({ username: 'AUDIT.USER', password });

  beforeAll(async () => { passwordHash = await hashPassword(password); });
  beforeEach(async () => {
    tokens = [];
    sessions = [];
    blockedTokens = [];
    user = { id: randomUUID(), username: 'Audit.User', passwordHash, fullName: 'Test user', status: 'ACTIVE', deletedAt: null, lockedUntil: null, failedLoginCount: 0, userRoles: [], employee: null };
    db = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      $executeRaw: jest.fn().mockResolvedValue(0),
      accessTokenBlocklist: {
        findUnique: jest.fn(async ({ where }) => blockedTokens.find(row => row.tokenId === where.tokenId) ?? null),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      user: {
        findFirst: jest.fn(async ({ where }) => matches(user, where) ? { ...user } : null),
        findUnique: jest.fn(async () => ({ ...user })),
        findUniqueOrThrow: jest.fn(async () => ({ ...user })),
        update: jest.fn(async ({ data }) => Object.assign(user, data)),
      },
      refreshToken: {
        findUnique: jest.fn(async ({ where }) => tokens.find(row => matches(row, where)) ?? null),
        findUniqueOrThrow: jest.fn(async ({ where }) => ({ ...tokens.find(row => matches(row, where)), user: { ...user } })),
        findFirst: jest.fn(async ({ where }) => tokens.find(row => matches(row, where)) ?? null),
        create: jest.fn(async ({ data }) => { const row = { id: randomUUID(), createdAt: new Date(), revokedAt: null, replacedBy: null, ...data }; tokens.push(row); return row; }),
        update: jest.fn(async ({ where, data }) => Object.assign(tokens.find(row => matches(row, where)), data)),
        updateMany: jest.fn(async args => updateMany(tokens, args)),
      },
      userSession: {
        create: jest.fn(async ({ data }) => { const row = { revokedAt: null, ...data }; sessions.push(row); return row; }),
        findFirst: jest.fn(async ({ where }) => sessions.find(row => matches(row, where)) ?? null),
        update: jest.fn(async ({ where, data }) => Object.assign(sessions.find(row => matches(row, where)), data)),
        updateMany: jest.fn(async args => updateMany(sessions, args)),
        findMany: jest.fn(async () => sessions.filter(row => !row.revokedAt)),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    db.$transaction = jest.fn(async callback => callback(db));
    const module = await Test.createTestingModule({
      imports: [PassportModule.register({ defaultStrategy: 'jwt' }), JwtModule.register({})],
      controllers: [AuthController],
      providers: [AuthService, JwtStrategy,
        { provide: PrismaService, useValue: db },
        { provide: ConfigService, useValue: config },
        { provide: AccessService, useValue: { buildAuthUser: jest.fn(async () => user.status === 'ACTIVE' && !user.deletedAt ? { id: user.id, permissions: [], scope: {} } : null) } },
        { provide: AuditService, useValue: { extractIp: () => '127.0.0.1', contextFrom: () => ({}), record: jest.fn() } },
        { provide: NotificationService, useValue: {} },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalGuards(new JwtAuthGuard(module.get(Reflector)));
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    service = module.get(AuthService);
    jwt = module.get(JwtService);
  });
  afterEach(async () => { await app.close(); });

  it('binds signed access tokens to a stored revocable session and supports case-insensitive login', async () => {
    const response = await login().expect(200);
    const claims = jwt.decode(response.body.accessToken) as any;
    expect(claims).toMatchObject({ sub: user.id, sid: sessions[0].id, type: 'access' });
    expect(tokens[0].family).toBe(sessions[0].id);
    expect(tokens[0].tokenHash).not.toBe(cookieToken(response));
    await request(app.getHttpServer()).get('/auth/me').auth(response.body.accessToken, { type: 'bearer' }).expect(200);
  });

  it('rejects the exact same access JWT immediately after public cookie logout', async () => {
    const response = await login().expect(200);
    const refreshToken = cookieToken(response);
    await request(app.getHttpServer()).post('/auth/logout').send({ refreshToken }).expect(200);
    expect(sessions[0].revokedAt).toBeInstanceOf(Date);
    await request(app.getHttpServer()).get('/auth/me').auth(response.body.accessToken, { type: 'bearer' }).expect(401);
    await request(app.getHttpServer()).post('/auth/refresh').send({ refreshToken }).expect(401);
  });

  it('rejects a blocklisted access token without revoking a different device', async () => {
    const first = await login().expect(200);
    const second = await login().expect(200);
    const claims = jwt.decode(first.body.accessToken) as { jti: string };
    blockedTokens.push({ tokenId: claims.jti, expiresAt: new Date(Date.now() + 60_000) });
    await request(app.getHttpServer()).get('/auth/me').auth(first.body.accessToken, { type: 'bearer' }).expect(401);
    await request(app.getHttpServer()).get('/auth/me').auth(second.body.accessToken, { type: 'bearer' }).expect(200);
  });

  it('accepts a live session when its blocklist entry has expired', async () => {
    const response = await login().expect(200);
    const claims = jwt.decode(response.body.accessToken) as { jti: string };
    blockedTokens.push({ tokenId: claims.jti, expiresAt: new Date(Date.now() - 1_000) });
    await request(app.getHttpServer()).get('/auth/me').auth(response.body.accessToken, { type: 'bearer' }).expect(200);
  });

  it('revokes a Bearer-only logout without a refresh cookie and leaves other devices active', async () => {
    const first = await login().expect(200);
    const other = await login().expect(200);
    await request(app.getHttpServer()).post('/auth/logout').auth(first.body.accessToken, { type: 'bearer' }).expect(200);
    await request(app.getHttpServer()).get('/auth/me').auth(first.body.accessToken, { type: 'bearer' }).expect(401);
    await request(app.getHttpServer()).post('/auth/refresh').send({ refreshToken: cookieToken(first) }).expect(401);
    await request(app.getHttpServer()).get('/auth/me').auth(other.body.accessToken, { type: 'bearer' }).expect(200);
  });
  it('does not revoke a session through forged signatures or wrong-type logout tokens', async () => {
    const initial = await login().expect(200);
    const options = { secret: configValues['app.jwt.accessSecret'] as string, issuer: configValues['app.jwt.issuer'] as string };
    const claims = { sub: user.id, sid: sessions[0].id, type: 'access' };
    const invalid = [jwt.sign(claims, { ...options, secret: randomBytes(48).toString('hex') }), jwt.sign({ ...claims, type: 'refresh' }, options), jwt.sign(claims, { ...options, issuer: 'untrusted-issuer' })];
    for (const token of invalid) await request(app.getHttpServer()).post('/auth/logout').auth(token, { type: 'bearer' }).expect(200);
    expect(sessions[0].revokedAt).toBeNull();
    await request(app.getHttpServer()).get('/auth/me').auth(initial.body.accessToken, { type: 'bearer' }).expect(200);
  });
  it('rotates once and handles concurrent old-cookie refresh without forking or extending expiry', async () => {
    const initial = await login().expect(200);
    const refreshToken = cookieToken(initial);
    const expiresAt = tokens[0].expiresAt.getTime();
    await request(app.getHttpServer()).post('/auth/refresh').send({ refreshToken }).expect(200);
    expect(tokens).toHaveLength(2);
    expect(tokens[0].replacedBy).toBe(tokens[1].id);
    expect(tokens[1].expiresAt.getTime()).toBe(expiresAt);
    const duplicate = await request(app.getHttpServer()).post('/auth/refresh').send({ refreshToken }).expect(200);
    expect(duplicate.body.accessToken).toBeTruthy();
    expect(duplicate.headers['set-cookie']).toBeUndefined();
    expect(tokens).toHaveLength(2);
  });

  it.each(['INACTIVE', 'DELETED', 'EXPIRED'])('does not bypass %s checks through rotation grace', async status => {
    const initial = await login().expect(200);
    const refreshToken = cookieToken(initial);
    await request(app.getHttpServer()).post('/auth/refresh').send({ refreshToken }).expect(200);
    if (status === 'INACTIVE') user.status = 'INACTIVE';
    if (status === 'DELETED') user.deletedAt = new Date();
    if (status === 'EXPIRED') tokens.forEach(row => { row.expiresAt = new Date(Date.now() - 1); });
    await request(app.getHttpServer()).post('/auth/refresh').send({ refreshToken }).expect(401);
    expect(tokens).toHaveLength(2);
    await request(app.getHttpServer()).get('/auth/me').auth(initial.body.accessToken, { type: 'bearer' }).expect(401);
  });

  it('commits family revocation when replay occurs outside grace', async () => {
    const initial = await login().expect(200);
    const refreshToken = cookieToken(initial);
    const rotated = await request(app.getHttpServer()).post('/auth/refresh').send({ refreshToken }).expect(200);
    tokens[0].revokedAt = new Date(Date.now() - 61_000);
    await request(app.getHttpServer()).post('/auth/refresh').send({ refreshToken }).expect(401);
    expect(tokens.every(row => row.revokedAt)).toBe(true);
    await request(app.getHttpServer()).get('/auth/me').auth(rotated.body.accessToken, { type: 'bearer' }).expect(401);
  });

  it('logs out one device without revoking a different device', async () => {
    const first = await login().expect(200);
    const second = await login().expect(200);
    await service.logout(undefined, cookieToken(first), req);
    await request(app.getHttpServer()).get('/auth/me').auth(first.body.accessToken, { type: 'bearer' }).expect(401);
    await request(app.getHttpServer()).get('/auth/me').auth(second.body.accessToken, { type: 'bearer' }).expect(200);
  });

  it('revokes all devices on password change and does not audit credentials', async () => {
    const initial = await login().expect(200);
    await login().expect(200);
    const next = 'Another!TestPassword456';
    await request(app.getHttpServer()).post('/auth/change-password').auth(initial.body.accessToken, { type: 'bearer' }).send({ currentPassword: password, newPassword: next }).expect(200);
    expect(await verifyPassword(user.passwordHash, next)).toBe(true);
    expect(sessions.every(row => row.revokedAt)).toBe(true);
    expect(tokens.every(row => row.revokedAt)).toBe(true);
    await request(app.getHttpServer()).get('/auth/me').auth(initial.body.accessToken, { type: 'bearer' }).expect(401);
    const auditData = JSON.stringify(db.auditLog.create.mock.calls);
    expect(auditData).not.toContain(password);
    expect(auditData).not.toContain(next);
    expect(auditData).not.toContain(user.passwordHash);
  });

  it('counts failed attempts under a user lock and rejects a locked account', async () => {
    for (let n = 0; n < 3; n++) await request(app.getHttpServer()).post('/auth/login').send({ username: user.username, password: 'incorrect' }).expect(401);
    expect(db.$executeRaw).toHaveBeenCalledTimes(3);
    expect(user.lockedUntil).toBeInstanceOf(Date);
    await login().expect(403);
    expect(tokens).toHaveLength(0);
  });

  it('rejects wrong token type and legacy JWT without sid even with a valid signature', async () => {
    const options = { secret: configValues['app.jwt.accessSecret'] as string, issuer: configValues['app.jwt.issuer'] as string };
    for (const claims of [{ sub: user.id, type: 'access' }, { sub: user.id, sid: randomUUID(), type: 'refresh' }]) {
      await request(app.getHttpServer()).get('/auth/me').auth(jwt.sign(claims, options), { type: 'bearer' }).expect(401);
    }
  });

  it('rejects non-string refresh input without a server error', async () => {
    await request(app.getHttpServer()).post('/auth/refresh').send({ refreshToken: { token: 'invalid' } }).expect(401);
  });
});
