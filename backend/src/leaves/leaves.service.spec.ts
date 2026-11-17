import { LeavesService } from './leaves.service';
import { AccessService } from '../common/access/access.service';
import { AuditService } from '../common/audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';

const actor = {
  id: 'actor-a', username: 'actor.a', fullName: 'Test Actor', email: 'actor@test.com',
  mobile: null, isSuperAdmin: false, employeeId: 'emp-a', roleIds: [], roleCodes: [],
  permissions: ['leaves.view', 'leaves.create', 'leaves.update', 'leaves.delete'],
  scope: { unrestricted: false, companyIds: ['company-a'], branchIds: [], orgUnitIds: [], employeeIds: [], ownEmployeeId: 'emp-a' },
} as unknown as AuthenticatedUser;

describe('LeavesService', () => {
  let prisma: any;
  let access: any;
  let audit: any;
  let service: LeavesService;

  beforeEach(() => {
    prisma = {
      leaveType: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
      leaveRequest: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), create: jest.fn(), update: jest.fn() },
      leaveTransaction: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
      employee: { findUnique: jest.fn().mockResolvedValue({ id: 'emp-a', companyId: 'company-a', deletedAt: null }) },
      $transaction: jest.fn(work => work(prisma)),
    };
    access = { allowedCompanyIds: jest.fn().mockResolvedValue(['company-a']), canAccessEmployee: jest.fn().mockResolvedValue(true), assertCompanyAccess: jest.fn().mockResolvedValue(undefined), assertEmployeeAccess: jest.fn().mockResolvedValue(undefined) };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    service = new LeavesService(prisma, access, audit);
  });

  describe('listLeaveTypes', () => {
    it('returns active leave types for company', async () => {
      prisma.leaveType.findMany.mockResolvedValue([{ id: 'lt1', code: 'ANNUAL', name: 'Annual Leave', companyId: 'company-a' }]);
      const result = await service.listLeaveTypes({ page: 1, limit: 10, skip: 0 } as any, actor);
      expect(result.data).toHaveLength(1);
    });
  });

  describe('createLeaveRequest', () => {
    it('creates leave request with validation', async () => {
      prisma.leaveType.findUnique.mockResolvedValue({ id: 'lt1', code: 'ANNUAL', annualQuotaMinutes: 12480, isPaid: true });
      prisma.leaveRequest.findMany.mockResolvedValue([]);
      prisma.leaveRequest.create.mockResolvedValue({ id: 'lr1', status: 'DRAFT', employeeId: 'emp-a' });
      prisma.leaveTransaction.create.mockResolvedValue({ id: 'lt1' });
      const result = await service.createLeaveRequest({ employeeId: 'emp-a', leaveTypeId: 'lt1', startAt: '2026-01-01', endAt: '2026-01-05', durationMinutes: 3840, reason: 'Vacation' } as any, actor);
      expect(result.status).toBe('DRAFT');
      expect(prisma.leaveRequest.create).toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalled();
    });

    it('rejects invalid date range', async () => {
      await expect(service.createLeaveRequest({ employeeId: 'emp-a', leaveTypeId: 'lt1', startAt: '2026-01-05', endAt: '2026-01-01', durationMinutes: 3840 } as any, actor)).rejects.toThrow(BadRequestException);
    });

    it('rejects unauthorized employee access', async () => {
      access.canAccessEmployee.mockResolvedValue(false);
      await expect(service.createLeaveRequest({ employeeId: 'emp-other', leaveTypeId: 'lt1', startAt: '2026-01-01', endAt: '2026-01-05', durationMinutes: 3840 } as any, actor)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('approveLeaveRequest', () => {
    it('approves pending leave request', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue({ id: 'lr1', employeeId: 'emp-a', status: 'PENDING_SUPERVISOR', leaveTypeId: 'lt1' });
      prisma.leaveRequest.update.mockResolvedValue({ id: 'lr1', status: 'APPROVED' });
      prisma.leaveType.findUnique.mockResolvedValue({ id: 'lt1', annualQuotaMinutes: 12480 });
      prisma.leaveTransaction.findMany.mockResolvedValue([]);
      const result = await service.approveLeaveRequest('lr1', { approved: true } as any, actor);
      expect(result.status).toBe('APPROVED');
    });

    it('rejects non-existent leave request', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue(null);
      await expect(service.approveLeaveRequest('lr1', { approved: true } as any, actor)).rejects.toThrow(NotFoundException);
    });
  });

  describe('rejectLeaveRequest', () => {
    it('rejects pending leave request with reason', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue({ id: 'lr1', employeeId: 'emp-a', status: 'PENDING_SUPERVISOR' });
      prisma.leaveRequest.update.mockResolvedValue({ id: 'lr1', status: 'REJECTED' });
      const result = await service.rejectLeaveRequest('lr1', { reason: 'Not eligible' } as any, actor);
      expect(result.status).toBe('REJECTED');
    });

    it('requires reason for rejection', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue({ id: 'lr1', employeeId: 'emp-a', status: 'PENDING_SUPERVISOR' });
      await expect(service.rejectLeaveRequest('lr1', { reason: '' } as any, actor)).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancelLeaveRequest', () => {
    it('cancels draft leave request', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue({ id: 'lr1', employeeId: 'emp-a', status: 'DRAFT' });
      prisma.leaveRequest.update.mockResolvedValue({ id: 'lr1', status: 'CANCELLED' });
      const result = await service.cancelLeaveRequest('lr1', actor);
      expect(result.status).toBe('CANCELLED');
    });

    it('rejects cancelling approved leave request', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue({ id: 'lr1', employeeId: 'emp-a', status: 'APPROVED' });
      await expect(service.cancelLeaveRequest('lr1', actor)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getLeaveBalance', () => {
    it('returns leave balance for employee', async () => {
      prisma.leaveTransaction.findMany.mockResolvedValue([{ type: 'GRANT', minutes: 480 }, { type: 'CONSUME', minutes: 240 }]);
      const result = await service.getLeaveBalance('emp-a', 'lt1', actor);
      expect(result.granted).toBe(480);
      expect(result.consumed).toBe(240);
      expect(result.remaining).toBe(240);
    });
  });

  describe('deleteLeaveRequest', () => {
    it('soft deletes leave request', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue({ id: 'lr1', employeeId: 'emp-a', status: 'DRAFT', deletedAt: null });
      prisma.leaveRequest.update.mockResolvedValue({ id: 'lr1', deletedAt: new Date() });
      const result = await service.deleteLeaveRequest('lr1', actor);
      expect(result.success).toBe(true);
    });
  });
});