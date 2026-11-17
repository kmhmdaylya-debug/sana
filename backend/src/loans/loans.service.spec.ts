import { LoansService } from './loans.service';
import { AccessService } from '../common/access/access.service';
import { AuditService } from '../common/audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';

const actor = {
  id: 'actor-a', username: 'actor.a', fullName: 'Test Actor', email: 'actor@test.com',
  mobile: null, isSuperAdmin: false, employeeId: 'emp-a', roleIds: [], roleCodes: [],
  permissions: ['loans.view', 'loans.create', 'loans.update', 'loans.delete', 'loans.approve'],
  scope: { unrestricted: false, companyIds: ['company-a'], branchIds: [], orgUnitIds: [], employeeIds: [], ownEmployeeId: 'emp-a' },
} as unknown as AuthenticatedUser;

describe('LoansService', () => {
  let prisma: any;
  let access: any;
  let audit: any;
  let service: LoansService;

  beforeEach(() => {
    prisma = {
      loan: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), create: jest.fn(), update: jest.fn() },
      loanInstallment: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn(), update: jest.fn() },
      loanInstallmentPayment: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
      payrollPeriod: { findUnique: jest.fn() },
      employee: { findUnique: jest.fn().mockResolvedValue({ id: 'emp-a', companyId: 'company-a', deletedAt: null }) },
      $transaction: jest.fn(work => work(prisma)),
    };
    access = { allowedCompanyIds: jest.fn().mockResolvedValue(['company-a']), canAccessEmployee: jest.fn().mockResolvedValue(true), assertCompanyAccess: jest.fn().mockResolvedValue(undefined), assertEmployeeAccess: jest.fn().mockResolvedValue(undefined) };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    service = new LoansService(prisma, access, audit);
  });

  describe('listLoans', () => {
    it('returns paginated loans', async () => {
      prisma.loan.count.mockResolvedValue(2);
      prisma.loan.findMany.mockResolvedValue([{ id: 'l1', loanType: 'LOAN', status: 'REQUESTED', amount: 10000000 }, { id: 'l2', loanType: 'LOAN', status: 'APPROVED', amount: 20000000 }]);
      const result = await service.listLoans({ page: 1, limit: 10, skip: 0 } as any, actor);
      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });

    it('filters by employee', async () => {
      await service.listLoans({ page: 1, limit: 10, skip: 0, employeeId: 'emp-a' } as any, actor);
      const where = prisma.loan.findMany.mock.calls[0][0].where;
      expect(where.employeeId).toBe('emp-a');
    });

    it('filters by status', async () => {
      await service.listLoans({ page: 1, limit: 10, skip: 0, status: 'APPROVED' } as any, actor);
      const where = prisma.loan.findMany.mock.calls[0][0].where;
      expect(where.status).toBe('APPROVED');
    });
  });

  describe('createLoan', () => {
    it('creates loan for employee', async () => {
      prisma.employee.findUnique.mockResolvedValue({ id: 'emp-a', companyId: 'company-a', deletedAt: null });
      prisma.loan.create.mockResolvedValue({ id: 'l1', loanType: 'LOAN', amount: 10000000, installmentCount: 12, status: 'REQUESTED', employeeId: 'emp-a' });
      const result = await service.createLoan({ employeeId: 'emp-a', loanType: 'LOAN', amount: 10000000, installmentCount: 12, interestRate: 0, purpose: 'Personal' } as any, actor);
      expect(result.amount).toBe(10000000);
      expect(result.status).toBe('REQUESTED');
      expect(audit.record).toHaveBeenCalled();
    });

    it('rejects loan for non-existent employee', async () => {
      prisma.employee.findUnique.mockResolvedValue(null);
      await expect(service.createLoan({ employeeId: 'emp-other', amount: 10000000 } as any, actor)).rejects.toThrow(NotFoundException);
    });

    it('rejects unauthorized employee access', async () => {
      access.canAccessEmployee.mockResolvedValue(false);
      await expect(service.createLoan({ employeeId: 'emp-other', amount: 10000000 } as any, actor)).rejects.toThrow(ForbiddenException);
    });

    it('rejects non-positive loan amount', async () => {
      prisma.employee.findUnique.mockResolvedValue({ id: 'emp-a', companyId: 'company-a', deletedAt: null });
      await expect(service.createLoan({ employeeId: 'emp-a', amount: 0 } as any, actor)).rejects.toThrow(BadRequestException);
    });

    it('rejects negative installment count', async () => {
      prisma.employee.findUnique.mockResolvedValue({ id: 'emp-a', companyId: 'company-a', deletedAt: null });
      await expect(service.createLoan({ employeeId: 'emp-a', amount: 10000000, installmentCount: -1 } as any, actor)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getLoan', () => {
    it('returns loan by id', async () => {
      prisma.loan.findUnique.mockResolvedValue({ id: 'l1', loanType: 'LOAN', deletedAt: null });
      const result = await service.getLoan('l1', actor);
      expect(result.id).toBe('l1');
    });

    it('throws NotFoundException for non-existent loan', async () => {
      prisma.loan.findUnique.mockResolvedValue(null);
      await expect(service.getLoan('l1', actor)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateLoan', () => {
    it('updates loan', async () => {
      prisma.loan.findUnique.mockResolvedValue({ id: 'l1', loanType: 'LOAN', status: 'REQUESTED', employeeId: 'emp-a', deletedAt: null });
      prisma.loan.update.mockResolvedValue({ id: 'l1', loanType: 'LOAN', status: 'PENDING_APPROVAL' });
      const result = await service.updateLoan('l1', { status: 'PENDING_APPROVAL' } as any, actor);
      expect(result.status).toBe('PENDING_APPROVAL');
    });
  });

  describe('approveLoan', () => {
    it('approves loan request', async () => {
      prisma.loan.findUnique.mockResolvedValue({ id: 'l1', status: 'REQUESTED', employeeId: 'emp-a', deletedAt: null });
      prisma.loan.update.mockResolvedValue({ id: 'l1', status: 'APPROVED', approvedById: 'actor-a' });
      const result = await service.approveLoan('l1', actor);
      expect(result.status).toBe('APPROVED');
      expect(result.approvedById).toBe('actor-a');
    });

    it('rejects non-requested loan', async () => {
      prisma.loan.findUnique.mockResolvedValue({ id: 'l1', status: 'APPROVED', employeeId: 'emp-a', deletedAt: null });
      await expect(service.approveLoan('l1', actor)).rejects.toThrow(BadRequestException);
    });
  });

  describe('rejectLoan', () => {
    it('rejects loan request', async () => {
      prisma.loan.findUnique.mockResolvedValue({ id: 'l1', status: 'REQUESTED', employeeId: 'emp-a', deletedAt: null });
      prisma.loan.update.mockResolvedValue({ id: 'l1', status: 'REJECTED' });
      const result = await service.rejectLoan('l1', { reason: 'Insufficient credit' } as any, actor);
      expect(result.status).toBe('REJECTED');
    });
  });

  describe('disburseLoan', () => {
    it('disburses approved loan', async () => {
      prisma.loan.findUnique.mockResolvedValue({ id: 'l1', status: 'APPROVED', employeeId: 'emp-a', deletedAt: null });
      prisma.loan.update.mockResolvedValue({ id: 'l1', status: 'DISBURSED', disbursedAt: new Date() });
      const result = await service.disburseLoan('l1', actor);
      expect(result.status).toBe('DISBURSED');
      expect(result.disbursedAt).toBeDefined();
    });

    it('rejects non-approved loan disbursement', async () => {
      prisma.loan.findUnique.mockResolvedValue({ id: 'l1', status: 'REQUESTED', employeeId: 'emp-a', deletedAt: null });
      await expect(service.disburseLoan('l1', actor)).rejects.toThrow(BadRequestException);
    });
  });

  describe('createLoanInstallment', () => {
    it('creates loan installments', async () => {
      prisma.loan.findUnique.mockResolvedValue({ id: 'l1', loanType: 'LOAN', amount: 10000000, installmentCount: 12, monthlyAmount: 833333, status: 'DISBURSED', employeeId: 'emp-a', deletedAt: null });
      prisma.loanInstallment.create.mockResolvedValue({ id: 'li1', loanId: 'l1', dueDate: '2026-02-01', amount: 833333 });
      const result = await service.createLoanInstallments('l1', actor);
      expect(result.created).toBeGreaterThan(0);
      expect(audit.record).toHaveBeenCalled();
    });

    it('rejects installments for non-disbursed loan', async () => {
      prisma.loan.findUnique.mockResolvedValue({ id: 'l1', loanType: 'LOAN', status: 'REQUESTED', employeeId: 'emp-a', deletedAt: null });
      await expect(service.createLoanInstallments('l1', actor)).rejects.toThrow(BadRequestException);
    });
  });

  describe('payLoanInstallment', () => {
    it('pays loan installment', async () => {
      prisma.loanInstallment.findUnique.mockResolvedValue({ id: 'li1', loanId: 'l1', dueDate: '2026-02-01', amount: 833333, paidAmount: 0, status: 'PENDING' });
      prisma.payrollPeriod.findUnique.mockResolvedValue({ id: 'pp1', year: 2026, month: 2, status: 'LOCKED' });
      prisma.loanInstallmentPayment.create.mockResolvedValue({ id: 'lip1', amount: 833333, fullyPaid: true });
      prisma.loanInstallment.update.mockResolvedValue({ id: 'li1', paidAmount: 833333, status: 'SETTLED' });
      const result = await service.payLoanInstallment('li1', { payrollPeriodId: 'pp1', amount: 833333 } as any, actor);
      expect(result.fullyPaid).toBe(true);
    });

    it('rejects overpayment', async () => {
      prisma.loanInstallment.findUnique.mockResolvedValue({ id: 'li1', loanId: 'l1', amount: 833333, paidAmount: 0, status: 'PENDING' });
      await expect(service.payLoanInstallment('li1', { amount: 833334 } as any, actor)).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteLoan', () => {
    it('soft deletes loan', async () => {
      prisma.loan.findUnique.mockResolvedValue({ id: 'l1', loanType: 'LOAN', status: 'REQUESTED', employeeId: 'emp-a', deletedAt: null });
      prisma.loan.update.mockResolvedValue({ id: 'l1', deletedAt: new Date() });
      const result = await service.deleteLoan('l1', actor);
      expect(result.success).toBe(true);
    });

    it('rejects deleting disbursed loan', async () => {
      prisma.loan.findUnique.mockResolvedValue({ id: 'l1', loanType: 'LOAN', status: 'DISBURSED', employeeId: 'emp-a', deletedAt: null });
      await expect(service.deleteLoan('l1', actor)).rejects.toThrow(BadRequestException);
    });
  });
});
