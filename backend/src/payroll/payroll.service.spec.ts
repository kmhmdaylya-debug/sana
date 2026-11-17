import { PayrollService } from './payroll.service';
import { AccessService } from '../common/access/access.service';
import { AuditService } from '../common/audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';

const actor = {
  id: 'actor-a', username: 'actor.a', fullName: 'Test Actor', email: 'actor@test.com',
  mobile: null, isSuperAdmin: false, employeeId: 'emp-a', roleIds: [], roleCodes: [],
  permissions: ['payroll.view', 'payroll.create', 'payroll.update', 'payroll.approve'],
  scope: { unrestricted: false, companyIds: ['company-a'], branchIds: [], orgUnitIds: [], employeeIds: [], ownEmployeeId: 'emp-a' },
} as unknown as AuthenticatedUser;

describe('PayrollService', () => {
  let prisma: any;
  let access: any;
  let audit: any;
  let service: PayrollService;

  beforeEach(() => {
    prisma = {
      payrollPeriod: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), create: jest.fn(), update: jest.fn() },
      payComponent: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
      payrollItem: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn(), findUnique: jest.fn() },
      payslip: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), create: jest.fn(), update: jest.fn() },
      employee: { findUnique: jest.fn().mockResolvedValue({ id: 'emp-a', companyId: 'company-a', deletedAt: null }) },
      $transaction: jest.fn(work => work(prisma)),
    };
    access = { allowedCompanyIds: jest.fn().mockResolvedValue(['company-a']), assertCompanyAccess: jest.fn().mockResolvedValue(undefined), assertEmployeeAccess: jest.fn().mockResolvedValue(undefined) };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    service = new PayrollService(prisma, access, audit);
  });

  describe('listPayrollPeriods', () => {
    it('returns paginated payroll periods', async () => {
      prisma.payrollPeriod.count.mockResolvedValue(2);
      prisma.payrollPeriod.findMany.mockResolvedValue([{ id: 'pp1', year: 2026, month: 1, status: 'DRAFT' }, { id: 'pp2', year: 2026, month: 2, status: 'LOCKED' }]);
      const result = await service.listPayrollPeriods({ page: 1, limit: 10, skip: 0 } as any, actor);
      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });
  });

  describe('createPayrollPeriod', () => {
    it('creates payroll period', async () => {
      prisma.payrollPeriod.findFirst.mockResolvedValue(null);
      prisma.payrollPeriod.create.mockResolvedValue({ id: 'pp1', year: 2026, month: 1, status: 'DRAFT', companyId: 'company-a' });
      const result = await service.createPayrollPeriod({ year: 2026, month: 1 } as any, actor);
      expect(result.year).toBe(2026);
      expect(result.month).toBe(1);
      expect(audit.record).toHaveBeenCalled();
    });

    it('rejects duplicate period for same year/month', async () => {
      prisma.payrollPeriod.findFirst.mockResolvedValue({ id: 'pp1', year: 2026, month: 1, deletedAt: null });
      await expect(service.createPayrollPeriod({ year: 2026, month: 1 } as any, actor)).rejects.toThrow(ConflictException);
    });
  });

  describe('getPayrollPeriod', () => {
    it('returns payroll period by id', async () => {
      prisma.payrollPeriod.findUnique.mockResolvedValue({ id: 'pp1', year: 2026, month: 1, deletedAt: null });
      const result = await service.getPayrollPeriod('pp1', actor);
      expect(result.id).toBe('pp1');
    });

    it('throws NotFoundException for non-existent period', async () => {
      prisma.payrollPeriod.findUnique.mockResolvedValue(null);
      await expect(service.getPayrollPeriod('pp1', actor)).rejects.toThrow(NotFoundException);
    });
  });

  describe('lockPayrollPeriod', () => {
    it('locks payroll period', async () => {
      prisma.payrollPeriod.findUnique.mockResolvedValue({ id: 'pp1', year: 2026, month: 1, status: 'DRAFT', companyId: 'company-a', deletedAt: null });
      prisma.payrollPeriod.update.mockResolvedValue({ id: 'pp1', status: 'LOCKED', lockedAt: new Date() });
      const result = await service.lockPayrollPeriod('pp1', actor);
      expect(result.status).toBe('LOCKED');
    });

    it('rejects locking already locked period', async () => {
      prisma.payrollPeriod.findUnique.mockResolvedValue({ id: 'pp1', year: 2026, month: 1, status: 'LOCKED', companyId: 'company-a', deletedAt: null });
      await expect(service.lockPayrollPeriod('pp1', actor)).rejects.toThrow(BadRequestException);
    });
  });

  describe('generatePayrollItems', () => {
    it('generates payroll items for employees', async () => {
      prisma.payrollPeriod.findUnique.mockResolvedValue({ id: 'pp1', year: 2026, month: 1, status: 'DRAFT', companyId: 'company-a' });
      prisma.employee.findMany.mockResolvedValue([{ id: 'emp1', companyId: 'company-a', deletedAt: null }]);
      prisma.payComponent.findMany.mockResolvedValue([{ id: 'pc1', code: 'BASE_SALARY', type: 'EARNING', calculationType: 'FIXED', amount: 50000000 }]);
      prisma.payrollItem.findMany.mockResolvedValue([]);
      prisma.payrollItem.create.mockResolvedValue({ id: 'pi1' });
      const result = await service.generatePayrollItems('pp1', actor);
      expect(result.created).toBeGreaterThanOrEqual(0);
      expect(audit.record).toHaveBeenCalled();
    });
  });

  describe('payslip', () => {
    it('creates payslip for employee', async () => {
      prisma.payrollPeriod.findUnique.mockResolvedValue({ id: 'pp1', year: 2026, month: 1, status: 'LOCKED', companyId: 'company-a' });
      prisma.employee.findUnique.mockResolvedValue({ id: 'emp-a', companyId: 'company-a', deletedAt: null });
      prisma.payslip.findUnique.mockResolvedValue(null);
      prisma.payslip.create.mockResolvedValue({ id: 'ps1', employeeId: 'emp-a', grossAmount: 50000000, netAmount: 45000000 });
      const result = await service.createPayslip('pp1', 'emp-a', actor);
      expect(result.employeeId).toBe('emp-a');
      expect(audit.record).toHaveBeenCalled();
    });

    it('rejects payslip for unlocked period', async () => {
      prisma.payrollPeriod.findUnique.mockResolvedValue({ id: 'pp1', year: 2026, month: 1, status: 'DRAFT', companyId: 'company-a' });
      await expect(service.createPayslip('pp1', 'emp-a', actor)).rejects.toThrow(BadRequestException);
    });
  });

  describe('publishPayslip', () => {
    it('publishes payslip', async () => {
      prisma.payslip.findUnique.mockResolvedValue({ id: 'ps1', employeeId: 'emp-a', status: 'DRAFT', periodId: 'pp1' });
      prisma.payrollPeriod.findUnique.mockResolvedValue({ id: 'pp1', status: 'LOCKED', companyId: 'company-a' });
      prisma.payslip.update.mockResolvedValue({ id: 'ps1', status: 'PUBLISHED', publishedAt: new Date() });
      const result = await service.publishPayslip('ps1', actor);
      expect(result.status).toBe('PUBLISHED');
    });
  });

  describe('deletePayrollPeriod', () => {
    it('rejects deleting period with payslips', async () => {
      prisma.payrollPeriod.findUnique.mockResolvedValue({ id: 'pp1', year: 2026, month: 1, status: 'DRAFT', companyId: 'company-a', deletedAt: null });
      prisma.payslip.count.mockResolvedValue(3);
      await expect(service.deletePayrollPeriod('pp1', actor)).rejects.toThrow(BadRequestException);
    });

    it('soft deletes empty draft period', async () => {
      prisma.payrollPeriod.findUnique.mockResolvedValue({ id: 'pp1', year: 2026, month: 1, status: 'DRAFT', companyId: 'company-a', deletedAt: null });
      prisma.payslip.count.mockResolvedValue(0);
      prisma.payrollPeriod.update.mockResolvedValue({ id: 'pp1', deletedAt: new Date() });
      const result = await service.deletePayrollPeriod('pp1', actor);
      expect(result.success).toBe(true);
    });
  });
});
