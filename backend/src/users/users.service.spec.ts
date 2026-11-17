import { UsersService } from './users.service';
import { AccessService } from '../common/access/access.service';
import { AuditService } from '../common/audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';

const actor = {
  id: 'actor-a', username: 'actor.a', fullName: 'Test Actor', email: 'actor@test.com',
  mobile: null, isSuperAdmin: false, employeeId: 'emp-a', roleIds: [], roleCodes: [],
  permissions: ['users.view', 'users.create', 'users.update', 'users.delete', 'users.manage.superadmin'],
  scope: { unrestricted: false, companyIds: ['company-a'], branchIds: [], orgUnitIds: [], employeeIds: [], ownEmployeeId: 'emp-a' },
} as unknown as AuthenticatedUser;

describe('UsersService', () => {
  let prisma: any;
  let access: any;
  let audit: any;
  let service: UsersService;

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), create: jest.fn(), update: jest.fn() },
      userRole: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn(), delete: jest.fn(), findUnique: jest.fn() },
      role: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
      scopeAssignment: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]), delete: jest.fn() },
      employee: { findUnique: jest.fn().mockResolvedValue({ id: 'emp-a', companyId: 'company-a', deletedAt: null }) },
      $transaction: jest.fn(work => work(prisma)),
    };
    access = { allowedCompanyIds: jest.fn().mockResolvedValue(['company-a']), canAccessEmployee: jest.fn().mockResolvedValue(true), assertCompanyAccess: jest.fn().mockResolvedValue(undefined), assertEmployeeAccess: jest.fn().mockResolvedValue(undefined), assertGrantableRoles: jest.fn().mockResolvedValue(undefined), assertGrantableScopes: jest.fn().mockResolvedValue(undefined) };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    service = new UsersService(prisma, access, audit);
  });

  describe('listUsers', () => {
    it('returns paginated users', async () => {
      prisma.user.count.mockResolvedValue(2);
      prisma.user.findMany.mockResolvedValue([{ id: 'u1', username: 'user1', status: 'ACTIVE' }, { id: 'u2', username: 'user2', status: 'INACTIVE' }]);
      const result = await service.listUsers({ page: 1, limit: 10, skip: 0 } as any, actor);
      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });

    it('filters by status', async () => {
      await service.listUsers({ page: 1, limit: 10, skip: 0, status: 'ACTIVE' } as any, actor);
      const where = prisma.user.findMany.mock.calls[0][0].where;
      expect(where.status).toBe('ACTIVE');
    });

    it('filters by username search', async () => {
      await service.listUsers({ page: 1, limit: 10, skip: 0, search: 'user1' } as any, actor);
      const where = prisma.user.findMany.mock.calls[0][0].where;
      expect(where.username).toEqual({ contains: 'user1', mode: 'insensitive' });
    });
  });

  describe('createUser', () => {
    it('creates user with roles and scopes', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.employee.findUnique.mockResolvedValue({ id: 'emp-a', companyId: 'company-a', deletedAt: null });
      prisma.user.create.mockResolvedValue({ id: 'u1', username: 'newuser', status: 'ACTIVE', employeeId: 'emp-a' });
      prisma.role.findMany.mockResolvedValue([{ id: 'r1', code: 'EMPLOYEE', isActive: true, deletedAt: null, rolePermissions: [{ permission: { code: 'employees.view' } }] }]);
      const result = await service.createUser({ username: 'newuser', password: 'SecureP@ssw0rd!', employeeId: 'emp-a', roleIds: ['r1'], scopes: [{ scopeType: 'EMPLOYEE', employeeId: 'emp-a' }] } as any, actor);
      expect(result.username).toBe('newuser');
      expect(audit.record).toHaveBeenCalled();
    });

    it('rejects duplicate username', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'u1', username: 'existing', deletedAt: null });
      await expect(service.createUser({ username: 'existing', password: 'SecureP@ssw0rd!' } as any, actor)).rejects.toThrow(ConflictException);
    });

    it('rejects weak password', async () => {
      await expect(service.createUser({ username: 'newuser', password: '123' } as any, actor)).rejects.toThrow(BadRequestException);
    });

    it('rejects assigning superadmin role to non-superadmin', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.employee.findUnique.mockResolvedValue({ id: 'emp-a', companyId: 'company-a', deletedAt: null });
      access.assertGrantableRoles.mockRejectedValue(new ForbiddenException('Cannot assign superadmin'));
      await expect(service.createUser({ username: 'newuser', password: 'SecureP@ssw0rd!', roleIds: ['super-admin'] } as any, actor)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getUser', () => {
    it('returns user by id', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', username: 'user1', deletedAt: null });
      const result = await service.getUser('u1', actor);
      expect(result.id).toBe('u1');
    });

    it('throws NotFoundException for non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.getUser('u1', actor)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateUser', () => {
    it('updates user', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', username: 'user1', status: 'ACTIVE', deletedAt: null });
      prisma.user.update.mockResolvedValue({ id: 'u1', username: 'user1', status: 'INACTIVE' });
      const result = await service.updateUser('u1', { status: 'INACTIVE' } as any, actor);
      expect(result.status).toBe('INACTIVE');
    });

    it('rejects self-deactivation', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'actor-a', username: 'actor.a', status: 'ACTIVE', deletedAt: null });
      await expect(service.updateUser('actor-a', { status: 'INACTIVE' } as any, actor)).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteUser', () => {
    it('soft deletes user', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', username: 'user1', status: 'ACTIVE', deletedAt: null, isSuperAdmin: false });
      prisma.user.update.mockResolvedValue({ id: 'u1', deletedAt: new Date() });
      const result = await service.deleteUser('u1', actor);
      expect(result.success).toBe(true);
    });

    it('rejects deleting super admin', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', username: 'admin', status: 'ACTIVE', deletedAt: null, isSuperAdmin: true });
      await expect(service.deleteUser('u1', actor)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('assignRolesToUser', () => {
    it('assigns roles to user', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', username: 'user1', deletedAt: null });
      prisma.role.findMany.mockResolvedValue([{ id: 'r1', code: 'EMPLOYEE', isActive: true, deletedAt: null, rolePermissions: [{ permission: { code: 'employees.view' } }] }]);
      access.assertGrantableRoles.mockResolvedValue(undefined);
      prisma.userRole.create.mockResolvedValue({ id: 'ur1', userId: 'u1', roleId: 'r1' });
      const result = await service.assignRolesToUser('u1', ['r1'], actor);
      expect(result.assigned).toBe(1);
    });

    it('rejects ungrantable roles', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', username: 'user1', deletedAt: null });
      access.assertGrantableRoles.mockRejectedValue(new ForbiddenException('Cannot assign role'));
      await expect(service.assignRolesToUser('u1', ['r1'], actor)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('assignScopesToUser', () => {
    it('assigns scopes to user', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', username: 'user1', deletedAt: null });
      access.assertGrantableScopes.mockResolvedValue(undefined);
      prisma.scopeAssignment.create.mockResolvedValue({ id: 'sa1', userId: 'u1', scopeType: 'COMPANY', companyId: 'company-a' });
      const result = await service.assignScopesToUser('u1', [{ scopeType: 'COMPANY', companyId: 'company-a' }], actor);
      expect(result.assigned).toBe(1);
    });

    it('rejects ungrantable scopes', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', username: 'user1', deletedAt: null });
      access.assertGrantableScopes.mockRejectedValue(new ForbiddenException('Cannot assign scope'));
      await expect(service.assignScopesToUser('u1', [{ scopeType: 'ALL' }], actor)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('changePassword', () => {
    it('changes user password', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', username: 'user1', passwordHash: '$argon2id$v=19$m=19456,t=2,p=1$hash', deletedAt: null, status: 'ACTIVE' });
      prisma.user.update.mockResolvedValue({ id: 'u1', passwordChangedAt: new Date() });
      const result = await service.changePassword('u1', { currentPassword: 'OldP@ssw0rd!', newPassword: 'NewSecureP@ssw0rd!' } as any, actor);
      expect(result.success).toBe(true);
    });

    it('rejects same password', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', username: 'user1', passwordHash: '$argon2id$v=19$m=19456,t=2,p=1$hash', deletedAt: null, status: 'ACTIVE' });
      await expect(service.changePassword('u1', { currentPassword: 'OldP@ssw0rd!', newPassword: 'OldP@ssw0rd!' } as any, actor)).rejects.toThrow(BadRequestException);
    });
  });

  describe('lockUser', () => {
    it('locks user account', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', username: 'user1', status: 'ACTIVE', deletedAt: null, isSuperAdmin: false });
      prisma.user.update.mockResolvedValue({ id: 'u1', lockedUntil: new Date(Date.now() + 900000) });
      const result = await service.lockUser('u1', actor);
      expect(result.lockedUntil).toBeDefined();
    });

    it('rejects locking super admin', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', username: 'admin', status: 'ACTIVE', deletedAt: null, isSuperAdmin: true });
      await expect(service.lockUser('u1', actor)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('unlockUser', () => {
    it('unlocks user account', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', username: 'user1', status: 'ACTIVE', deletedAt: null, lockedUntil: new Date() });
      prisma.user.update.mockResolvedValue({ id: 'u1', lockedUntil: null, failedLoginCount: 0 });
      const result = await service.unlockUser('u1', actor);
      expect(result.lockedUntil).toBeNull();
      expect(result.failedLoginCount).toBe(0);
    });
  });
});