import { ContractsService } from './contracts.service';
import { AccessService } from '../common/access/access.service';
import { AuditService } from '../common/audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';

const actor = {
  id: 'actor-a', username: 'actor.a', fullName: 'Test Actor', email: 'actor@test.com',
  mobile: null, isSuperAdmin: false, employeeId: 'emp-a', roleIds: [], roleCodes: [],
  permissions: ['contracts.view', 'contracts.create', 'contracts.update', 'contracts.delete', 'contracts.approve'],
  scope: { unrestricted: false, companyIds: ['company-a'], branchIds: [], orgUnitIds: [], employeeIds: [], ownEmployeeId: 'emp-a' },
} as unknown as AuthenticatedUser;

describe('ContractsService', () => {
  let prisma: any;
  let access: any;
  let audit: any;
  let service: ContractsService;

  beforeEach(() => {
    prisma = {
      contract: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), create: jest.fn(), update: jest.fn() },
      contractVersion: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn(), findUnique: jest.fn() },
      employee: { findUnique: jest.fn().mockResolvedValue({ id: 'emp-a', companyId: 'company-a', deletedAt: null }) },
      $transaction: jest.fn(work => work(prisma)),
    };
    access = { allowedCompanyIds: jest.fn().mockResolvedValue(['company-a']), canAccessEmployee: jest.fn().mockResolvedValue(true), assertCompanyAccess: jest.fn().mockResolvedValue(undefined), assertEmployeeAccess: jest.fn().mockResolvedValue(undefined) };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    service = new ContractsService(prisma, access, audit);
  });

  describe('listContracts', () => {
    it('returns paginated contracts', async () => {
      prisma.contract.count.mockResolvedValue(2);
      prisma.contract.findMany.mockResolvedValue([{ id: 'c1', code: 'CT-001', status: 'ACTIVE' }, { id: 'c2', code: 'CT-002', status: 'DRAFT' }]);
      const result = await service.listContracts({ page: 1, limit: 10, skip: 0 } as any, actor);
      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });

    it('filters by employee', async () => {
      await service.listContracts({ page: 1, limit: 10, skip: 0, employeeId: 'emp-a' } as any, actor);
      const where = prisma.contract.findMany.mock.calls[0][0].where;
      expect(where.employeeId).toBe('emp-a');
    });

    it('filters by status', async () => {
      await service.listContracts({ page: 1, limit: 10, skip: 0, status: 'ACTIVE' } as any, actor);
      const where = prisma.contract.findMany.mock.calls[0][0].where;
      expect(where.status).toBe('ACTIVE');
    });
  });

  describe('createContract', () => {
    it('creates contract for employee', async () => {
      prisma.employee.findUnique.mockResolvedValue({ id: 'emp-a', companyId: 'company-a', deletedAt: null });
      prisma.contract.findFirst.mockResolvedValue(null);
      prisma.contract.create.mockResolvedValue({ id: 'c1', code: 'CT-001', status: 'DRAFT', employeeId: 'emp-a', companyId: 'company-a' });
      prisma.contractVersion.create.mockResolvedValue({ id: 'cv1', version: 1 });
      const result = await service.createContract({ employeeId: 'emp-a', contractType: 'PERMANENT', startDate: '2026-01-01', baseSalary: 50000000 } as any, actor);
      expect(result.code).toBe('CT-001');
      expect(audit.record).toHaveBeenCalled();
    });

    it('rejects contract for non-existent employee', async () => {
      prisma.employee.findUnique.mockResolvedValue(null);
      await expect(service.createContract({ employeeId: 'emp-other', contractType: 'PERMANENT' } as any, actor)).rejects.toThrow(NotFoundException);
    });

    it('rejects unauthorized employee access', async () => {
      access.canAccessEmployee.mockResolvedValue(false);
      await expect(service.createContract({ employeeId: 'emp-other', contractType: 'PERMANENT' } as any, actor)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getContract', () => {
    it('returns contract by id', async () => {
      prisma.contract.findUnique.mockResolvedValue({ id: 'c1', code: 'CT-001', deletedAt: null });
      const result = await service.getContract('c1', actor);
      expect(result.id).toBe('c1');
    });

    it('throws NotFoundException for non-existent contract', async () => {
      prisma.contract.findUnique.mockResolvedValue(null);
      await expect(service.getContract('c1', actor)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateContract', () => {
    it('updates contract', async () => {
      prisma.contract.findUnique.mockResolvedValue({ id: 'c1', code: 'CT-001', status: 'DRAFT', employeeId: 'emp-a', deletedAt: null });
      prisma.contract.update.mockResolvedValue({ id: 'c1', code: 'CT-001', status: 'PENDING_APPROVAL' });
      const result = await service.updateContract('c1', { status: 'PENDING_APPROVAL' } as any, actor);
      expect(result.status).toBe('PENDING_APPROVAL');
    });
  });

  describe('createContractVersion', () => {
    it('creates contract version', async () => {
      prisma.contract.findUnique.mockResolvedValue({ id: 'c1', currentVersion: 1, employeeId: 'emp-a', companyId: 'company-a', deletedAt: null });
      prisma.contractVersion.findFirst.mockResolvedValue(null);
      prisma.contractVersion.create.mockResolvedValue({ id: 'cv1', version: 2 });
      prisma.contract.update.mockResolvedValue({ id: 'c1', currentVersion: 2 });
      const result = await service.createContractVersion('c1', { version: 2, contractType: 'PERMANENT', baseSalary: 55000000 } as any, actor);
      expect(result.version).toBe(2);
    });

    it('rejects duplicate version number', async () => {
      prisma.contract.findUnique.mockResolvedValue({ id: 'c1', currentVersion: 1, employeeId: 'emp-a', companyId: 'company-a', deletedAt: null });
      prisma.contractVersion.findFirst.mockResolvedValue({ id: 'cv1', version: 2 });
      await expect(service.createContractVersion('c1', { version: 2 } as any, actor)).rejects.toThrow(ConflictException);
    });
  });

  describe('approveContract', () => {
    it('approves contract', async () => {
      prisma.contract.findUnique.mockResolvedValue({ id: 'c1', status: 'PENDING_APPROVAL', employeeId: 'emp-a', companyId: 'company-a', deletedAt: null });
      prisma.contract.update.mockResolvedValue({ id: 'c1', status: 'ACTIVE' });
      const result = await service.approveContract('c1', actor);
      expect(result.status).toBe('ACTIVE');
    });

    it('rejects non-pending contract', async () => {
      prisma.contract.findUnique.mockResolvedValue({ id: 'c1', status: 'ACTIVE', employeeId: 'emp-a', companyId: 'company-a', deletedAt: null });
      await expect(service.approveContract('c1', actor)).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteContract', () => {
    it('soft deletes contract', async () => {
      prisma.contract.findUnique.mockResolvedValue({ id: 'c1', code: 'CT-001', status: 'DRAFT', employeeId: 'emp-a', deletedAt: null });
      prisma.contract.update.mockResolvedValue({ id: 'c1', deletedAt: new Date() });
      const result = await service.deleteContract('c1', actor);
      expect(result.success).toBe(true);
    });

    it('rejects deleting active contract', async () => {
      prisma.contract.findUnique.mockResolvedValue({ id: 'c1', code: 'CT-001', status: 'ACTIVE', employeeId: 'emp-a', deletedAt: null });
      await expect(service.deleteContract('c1', actor)).rejects.toThrow(BadRequestException);
    });
  });
});
