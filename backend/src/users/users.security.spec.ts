import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import request = require('supertest');
import { AccessService } from '../common/access/access.service';
import { AuditService } from '../common/audit/audit.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { PrismaService } from '../common/prisma/prisma.service';
import { hashPassword, verifyPassword } from '../common/utils/password.util';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('User management authorization API', () => {
  let app: INestApplication;
  let actor: AuthenticatedUser;
  let db: any;
  let rows: any[];
  let admin: any;
  let normal: any;
  let otherTenant: any;
  let hash: string;
  const adminPassword = 'Audit-only!AdminPassword123';
  const newPassword = 'Audit-only!NewPassword456';
  beforeAll(async () => { hash = await hashPassword(adminPassword); });
  beforeEach(async () => {
    const account = (isSuperAdmin = false, employeeId: string | null = randomUUID()) => ({ id: randomUUID(), username: randomUUID(), fullName: 'Test user', passwordHash: hash, isSuperAdmin, employeeId, status: 'ACTIVE', deletedAt: null, userRoles: [], scopeAssignments: [], employee: null });
    admin = account(true);
    normal = account();
    otherTenant = account();
    rows = [admin, normal, otherTenant];
    actor = { id: randomUUID(), username: 'audit.manager', fullName: 'Test manager', email: null, mobile: null, isSuperAdmin: false, employeeId: null, roleIds: [], roleCodes: [], permissions: ['users.view', 'users.update', 'users.delete', 'users.create', 'users.manage.sessions', 'users.manage.roles'], scope: { unrestricted: false, companyIds: ['company-a'], branchIds: [], orgUnitIds: [], employeeIds: [], ownEmployeeId: null } };
    db = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      user: {
        findUnique: jest.fn(async ({ where }) => rows.find(row => row.id === where.id) ?? null),
        update: jest.fn(async ({ where, data }) => Object.assign(rows.find(row => row.id === where.id), data)),
        count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(),
      },
      employee: { findFirst: jest.fn(async ({ where }) => where.AND?.[0]?.id === normal.employeeId ? { id: normal.employeeId } : null), findMany: jest.fn().mockResolvedValue([]) },
      role: { findMany: jest.fn().mockResolvedValue([{ id: 'privileged', code: 'SUPER_ADMIN', rolePermissions: [{ permission: { code: '*' } }] }]) },
      userRole: { deleteMany: jest.fn(), createMany: jest.fn() },
      scopeAssignment: { deleteMany: jest.fn(), createMany: jest.fn() },
      refreshToken: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      userSession: { updateMany: jest.fn().mockResolvedValue({ count: 1 }), findMany: jest.fn().mockResolvedValue([]) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    db.$transaction = jest.fn(async callback => callback(db));
    const module = await Test.createTestingModule({ controllers: [UsersController], providers: [UsersService, AccessService, { provide: PrismaService, useValue: db }, { provide: AuditService, useValue: {} }] }).compile();
    app = module.createNestApplication();
    app.use((req: any, _res: any, next: () => void) => { req.user = actor; next(); });
    app.useGlobalGuards(new PermissionsGuard(module.get(Reflector)));
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
  });
  afterEach(async () => { await app.close(); });

  it.each(['reset-password', 'revoke-sessions', 'update', 'delete'])('denies a tenant administrator protected-account %s', async operation => {
    const api = request(app.getHttpServer());
    if (operation === 'update') await api.patch(`/users/${admin.id}`).send({ fullName: 'Changed' }).expect(403);
    else if (operation === 'delete') await api.delete(`/users/${admin.id}`).expect(403);
    else await api.post(`/users/${admin.id}/${operation}`).send(operation === 'reset-password' ? { password: newPassword } : {}).expect(403);
    expect(db.user.update).not.toHaveBeenCalled();
    expect(db.refreshToken.updateMany).not.toHaveBeenCalled();
  });

  it.each(['SUPER_ADMIN', '*', 'users.manage.superadmin'])('protects a privileged role account without relying only on the superadmin flag (%s)', async permission => {
    normal.userRoles = [{ roleId: 'role', role: { code: permission === 'SUPER_ADMIN' ? permission : 'CUSTOM', rolePermissions: [{ permission: { code: permission } }] } }];
    await request(app.getHttpServer()).post(`/users/${normal.id}/reset-password`).send({ password: newPassword }).expect(403);
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it('requires password reauthentication even for a real superadmin', async () => {
    actor = { ...actor, id: admin.id, isSuperAdmin: true };
    await request(app.getHttpServer()).post(`/users/${admin.id}/reset-password`).send({ password: newPassword }).expect(403);
    await request(app.getHttpServer()).post(`/users/${admin.id}/reset-password`).send({ password: newPassword, currentPassword: 'wrong' }).expect(403);
    expect(db.user.update).not.toHaveBeenCalled();
    await request(app.getHttpServer()).post(`/users/${admin.id}/reset-password`).send({ password: newPassword, currentPassword: adminPassword }).expect(201);
    expect(await verifyPassword(admin.passwordHash, newPassword)).toBe(true);
    expect(db.refreshToken.updateMany).toHaveBeenCalled();
    expect(db.userSession.updateMany).toHaveBeenCalled();
    expect(JSON.stringify(db.auditLog.create.mock.calls)).not.toContain(newPassword);
  });

  it('does not allow deactivating the superadmin through PATCH even after reauthentication', async () => {
    actor = { ...actor, id: admin.id, isSuperAdmin: true };
    await request(app.getHttpServer()).patch(`/users/${admin.id}`).send({ status: 'INACTIVE', currentPassword: adminPassword }).expect(403);
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it('denies other-company detail and writes by changing a URL identifier', async () => {
    const api = request(app.getHttpServer());
    await api.get(`/users/${otherTenant.id}`).expect(403);
    await api.patch(`/users/${otherTenant.id}`).send({ fullName: 'Changed' }).expect(403);
    await api.post(`/users/${otherTenant.id}/reset-password`).send({ password: newPassword }).expect(403);
    await api.delete(`/users/${otherTenant.id}`).expect(403);
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it('keeps search OR conditions separate from the tenant restriction', async () => {
    await request(app.getHttpServer()).get('/users').query({ search: 'admin' }).expect(200);
    const where = db.user.findMany.mock.calls[0][0].where;
    expect(where.AND[0].OR).toHaveLength(2);
    expect(where.AND[0].OR[1].employee.is.OR[0]).toEqual({ companyId: { in: ['company-a'] } });
    expect(where.OR).toHaveLength(2);
  });

  it('allows an authorized in-scope password reset and atomically audits/revokes sessions', async () => {
    await request(app.getHttpServer()).post(`/users/${normal.id}/reset-password`).send({ password: newPassword }).expect(201);
    expect(await verifyPassword(normal.passwordHash, newPassword)).toBe(true);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.$queryRaw).toHaveBeenCalled();
    expect(db.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'PASSWORD_CHANGE', userId: actor.id, entityId: normal.id }) });
  });

  it('rechecks protected-account policy inside the write lock', async () => {
    db.$queryRaw.mockImplementation(async () => { normal.isSuperAdmin = true; return []; });
    await request(app.getHttpServer()).post(`/users/${normal.id}/reset-password`).send({ password: newPassword }).expect(403);
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it('does not allow users.update alone to grant roles or scopes', async () => {
    actor.permissions = ['users.update'];
    await request(app.getHttpServer()).patch(`/users/${normal.id}`).send({ roleIds: [] }).expect(403);
    await request(app.getHttpServer()).patch(`/users/${normal.id}`).send({ scope: [] }).expect(403);
    expect(db.userRole.deleteMany).not.toHaveBeenCalled();
  });

  it('validates nested scope fields and rejects privilege flags from the request', async () => {
    await request(app.getHttpServer()).patch(`/users/${normal.id}`).send({ scope: [{ scopeType: 'UNKNOWN', companyId: 'invalid' }] }).expect(400);
    await request(app.getHttpServer()).patch(`/users/${normal.id}`).send({ isSuperAdmin: true }).expect(400);
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it('requires the endpoint permission, regardless of valid tenant scope', async () => {
    actor.permissions = [];
    await request(app.getHttpServer()).post(`/users/${normal.id}/reset-password`).send({ password: newPassword }).expect(403);
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });
});
