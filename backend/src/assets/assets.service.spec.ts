import { AssetsService } from './assets.service';
import { AccessService } from '../common/access/access.service';
import { AuditService } from '../common/audit/audit.service';
import { NotificationService } from '../common/notifications/notification.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { NotFoundException, ConflictException, ForbiddenException, BadRequestException } from '@nestjs/common';

const actor = {
  id: 'actor-a', username: 'actor.a', fullName: 'Test Actor', email: 'actor@test.com',
  mobile: null, isSuperAdmin: false, employeeId: null, roleIds: [], roleCodes: [],
  permissions: ['assets.view', 'assets.create', 'assets.update', 'assets.delete'],
  scope: { unrestricted: false, companyIds: ['company-a'], branchIds: [], orgUnitIds: [], employeeIds: [], ownEmployeeId: null },
} as unknown as AuthenticatedUser;

describe('AssetsService', () => {
  let prisma: any;
  let access: any;
  let audit: any;
  let notifications: any;
  let service: AssetsService;

  beforeEach(() => {
    prisma = {
      asset: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), create: jest.fn(), update: jest.fn() },
      orgUnit: { findUnique: jest.fn() },
      $transaction: jest.fn(work => work(prisma)),
    };
    access = { allowedCompanyIds: jest.fn().mockResolvedValue(['company-a']), employeeWhereFor: jest.fn().mockResolvedValue({}) };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    notifications = { notify: jest.fn().mockResolvedValue(undefined) };
    service = new AssetsService(prisma, access, audit, notifications);
  });

  describe('list', () => {
    it('returns paginated assets', async () => {
      prisma.asset.count.mockResolvedValue(2);
      prisma.asset.findMany.mockResolvedValue([{ id: 'a1', code: 'AST-1' }, { id: 'a2', code: 'AST-2' }]);
      const result = await service.list({ page: 1, limit: 10, skip: 0 } as any, { page: 1, limit: 10 } as any, actor);
      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });

    it('applies scope filter for non-super admin', async () => {
      await service.list({ page: 1, limit: 10, skip: 0 } as any, { page: 1, limit: 10 } as any, actor);
      const where = prisma.asset.findMany.mock.calls[0][0].where;
      expect(where.AND).toBeDefined();
    });

    it('filters by status', async () => {
      await service.list({ page: 1, limit: 10, skip: 0, status: 'IN_STOCK' } as any, { page: 1, limit: 10 } as any, actor);
      const where = prisma.asset.findMany.mock.calls[0][0].where;
      expect(where.status).toBe('IN_STOCK');
    });

    it('filters by category', async () => {
      await service.list({ page: 1, limit: 10, skip: 0, category: 'EQUIPMENT' } as any, { page: 1, limit: 10 } as any, actor);
      const where = prisma.asset.findMany.mock.calls[0][0].where;
      expect(where.category).toEqual({ contains: 'EQUIPMENT', mode: 'insensitive' });
    });
  });

  describe('create', () => {
    it('creates asset with company resolution', async () => {
      prisma.asset.findFirst.mockResolvedValue(null);
      prisma.asset.create.mockResolvedValue({ id: 'a1', code: 'AST-001', name: 'Laptop', companyId: 'company-a' });
      const result = await service.create({ code: 'AST-001', name: 'Laptop', category: 'EQUIPMENT', companyId: 'company-a', purchasePrice: 1000 } as any, actor);
      expect(result.code).toBe('AST-001');
      expect(prisma.asset.create).toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalled();
    });

    it('rejects duplicate asset code', async () => {
      prisma.asset.findFirst.mockResolvedValue({ id: 'a1', code: 'AST-001', deletedAt: null });
      await expect(service.create({ code: 'AST-001', name: 'Laptop', category: 'EQUIPMENT' } as any, actor)).rejects.toThrow(ConflictException);
    });
  });

  describe('get', () => {
    it('returns asset by id', async () => {
      prisma.asset.findUnique.mockResolvedValue({ id: 'a1', code: 'AST-001', deletedAt: null });
      const result = await service.get('a1', actor);
      expect(result.id).toBe('a1');
    });

    it('throws NotFoundException for non-existent asset', async () => {
      prisma.asset.findUnique.mockResolvedValue(null);
      await expect(service.get('a1', actor)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates asset', async () => {
      prisma.asset.findUnique.mockResolvedValue({ id: 'a1', code: 'AST-001', name: 'Old', deletedAt: null });
      prisma.asset.update.mockResolvedValue({ id: 'a1', code: 'AST-001', name: 'New' });
      const result = await service.update('a1', { name: 'New' } as any, actor);
      expect(result.name).toBe('New');
    });
  });

  describe('delete', () => {
    it('soft deletes asset', async () => {
      prisma.asset.findUnique.mockResolvedValue({ id: 'a1', code: 'AST-001', deletedAt: null });
      prisma.asset.update.mockResolvedValue({ id: 'a1', deletedAt: new Date() });
      const result = await service.delete('a1', actor);
      expect(result.success).toBe(true);
    });
  });

  describe('createHandover', () => {
    it('creates asset handover', async () => {
      prisma.asset.findUnique.mockResolvedValue({ id: 'a1', code: 'AST-001', currentHolderId: null, deletedAt: null });
      prisma.asset.update.mockResolvedValue({ id: 'a1', currentHolderId: 'emp1' });
      const result = await service.createHandover('a1', { toEmployeeId: 'emp1', handoverType: 'DELIVER' } as any, actor);
      expect(result.toEmployeeId).toBe('emp1');
      expect(audit.record).toHaveBeenCalled();
    });
  });
});
