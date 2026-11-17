import { RolesService } from './roles.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';

const actor = {
  id: 'actor-a', username: 'actor.a', fullName: 'Test Actor', email: 'actor@test.com',
  mobile: null, isSuperAdmin: false, employeeId: null, roleIds: [], roleCodes: [],
  permissions: ['roles.view', 'roles.create', 'roles.update', 'roles.delete', 'users.manage.superadmin'],
  scope: { unrestricted: false, companyIds: ['company-a'], branchIds: [], orgUnitIds: [], employeeIds: [], ownEmployeeId: null },
} as unknown as AuthenticatedUser;

describe('RolesService', () => {
  let prisma: any;
  let service: RolesService;

  beforeEach(() => {
    prisma = {
      role: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), create: jest.fn(), update: jest.fn() },
      rolePermission: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn(), delete: jest.fn(), deleteMany: jest.fn() },
      permission: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
      userRole: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
      $transaction: jest.fn(work => work(prisma)),
    };
    service = new RolesService(prisma);
  });

  describe('listRoles', () => {
    it('returns paginated roles', async () => {
      prisma.role.count.mockResolvedValue(2);
      prisma.role.findMany.mockResolvedValue([{ id: 'r1', code: 'EMPLOYEE', name: 'Employee', isSystem: false }, { id: 'r2', code: 'MANAGER', name: 'Manager', isSystem: false }]);
      const result = await service.listRoles({ page: 1, limit: 10, skip: 0 } as any);
      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });

    it('filters by active status', async () => {
      await service.listRoles({ page: 1, limit: 10, skip: 0, isActive: true } as any);
      const where = prisma.role.findMany.mock.calls[0][0].where;
      expect(where.isActive).toBe(true);
    });
  });

  describe('createRole', () => {
    it('creates role with permissions', async () => {
      prisma.role.findFirst.mockResolvedValue(null);
      prisma.role.create.mockResolvedValue({ id: 'r1', code: 'CUSTOM', name: 'Custom Role', isSystem: false });
      prisma.permission.findMany.mockResolvedValue([{ id: 'p1', code: 'employees.view' }, { id: 'p2', code: 'employees.create' }]);
      prisma.rolePermission.create.mockResolvedValue({ id: 'rp1' });
      const result = await service.createRole({ code: 'CUSTOM', name: 'Custom Role', permissionIds: ['p1', 'p2'] } as any, actor);
      expect(result.code).toBe('CUSTOM');
      expect(prisma.role.create).toHaveBeenCalled();
    });

    it('rejects duplicate role code', async () => {
      prisma.role.findFirst.mockResolvedValue({ id: 'r1', code: 'EMPLOYEE', deletedAt: null });
      await expect(service.createRole({ code: 'EMPLOYEE', name: 'Employee' } as any, actor)).rejects.toThrow(ConflictException);
    });

    it('rejects invalid permission ids', async () => {
      prisma.role.findFirst.mockResolvedValue(null);
      prisma.permission.findMany.mockResolvedValue([{ id: 'p1', code: 'employees.view' }]);
      await expect(service.createRole({ code: 'CUSTOM', name: 'Custom', permissionIds: ['p1', 'invalid'] } as any, actor)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getRole', () => {
    it('returns role by id', async () => {
      prisma.role.findUnique.mockResolvedValue({ id: 'r1', code: 'EMPLOYEE', deletedAt: null });
      const result = await service.getRole('r1');
      expect(result.id).toBe('r1');
    });

    it('throws NotFoundException for non-existent role', async () => {
      prisma.role.findUnique.mockResolvedValue(null);
      await expect(service.getRole('r1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateRole', () => {
    it('updates role permissions', async () => {
      prisma.role.findUnique.mockResolvedValue({ id: 'r1', code: 'CUSTOM', name: 'Custom', isSystem: false, deletedAt: null });
      prisma.permission.findMany.mockResolvedValue([{ id: 'p1', code: 'employees.view' }]);
      prisma.role.update.mockResolvedValue({ id: 'r1', code: 'CUSTOM', name: 'Updated' });
      const result = await service.updateRole('r1', { name: 'Updated', permissionIds: ['p1'] } as any, actor);
      expect(result.name).toBe('Updated');
    });

    it('rejects modifying system role', async () => {
      prisma.role.findUnique.mockResolvedValue({ id: 'r1', code: 'SUPER_ADMIN', name: 'Super Admin', isSystem: true, deletedAt: null });
      await expect(service.updateRole('r1', { name: 'Modified' } as any, actor)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteRole', () => {
    it('soft deletes non-system role', async () => {
      prisma.role.findUnique.mockResolvedValue({ id: 'r1', code: 'CUSTOM', name: 'Custom', isSystem: false, deletedAt: null });
      prisma.userRole.count.mockResolvedValue(0);
      prisma.role.update.mockResolvedValue({ id: 'r1', deletedAt: new Date() });
      const result = await service.deleteRole('r1', actor);
      expect(result.success).toBe(true);
    });

    it('rejects deleting system role', async () => {
      prisma.role.findUnique.mockResolvedValue({ id: 'r1', code: 'SUPER_ADMIN', name: 'Super Admin', isSystem: true, deletedAt: null });
      await expect(service.deleteRole('r1', actor)).rejects.toThrow(ForbiddenException);
    });

    it('rejects role with assigned users', async () => {
      prisma.role.findUnique.mockResolvedValue({ id: 'r1', code: 'CUSTOM', name: 'Custom', isSystem: false, deletedAt: null });
      prisma.userRole.count.mockResolvedValue(5);
      await expect(service.deleteRole('r1', actor)).rejects.toThrow(BadRequestException);
    });
  });

  describe('assignRoleToUser', () => {
    it('assigns role to user', async () => {
      prisma.userRole.findFirst.mockResolvedValue(null);
      prisma.userRole.create.mockResolvedValue({ id: 'ur1', userId: 'u1', roleId: 'r1' });
      const result = await service.assignRoleToUser('u1', 'r1', actor);
      expect(result.userId).toBe('u1');
    });

    it('rejects duplicate role assignment', async () => {
      prisma.userRole.findFirst.mockResolvedValue({ id: 'ur1', userId: 'u1', roleId: 'r1' });
      await expect(service.assignRoleToUser('u1', 'r1', actor)).rejects.toThrow(ConflictException);
    });
  });

  describe('revokeRoleFromUser', () => {
    it('revokes role from user', async () => {
      prisma.userRole.findUnique.mockResolvedValue({ id: 'ur1', userId: 'u1', roleId: 'r1' });
      prisma.userRole.delete.mockResolvedValue({ id: 'ur1' });
      const result = await service.revokeRoleFromUser('u1', 'r1', actor);
      expect(result.success).toBe(true);
    });
  });
});
