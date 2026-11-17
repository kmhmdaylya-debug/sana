import { ApprovalsService } from './approvals.service';
import { AccessService } from '../common/access/access.service';
import { AuditService } from '../common/audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';

const actor = {
  id: 'actor-a', username: 'actor.a', fullName: 'Test Actor', email: 'actor@test.com',
  mobile: null, isSuperAdmin: false, employeeId: null, roleIds: [], roleCodes: [],
  permissions: ['approvals.view', 'approvals.create', 'approvals.update', 'approvals.approve'],
  scope: { unrestricted: false, companyIds: ['company-a'], branchIds: [], orgUnitIds: [], employeeIds: [], ownEmployeeId: null },
} as unknown as AuthenticatedUser;

describe('ApprovalsService', () => {
  let prisma: any;
  let access: any;
  let audit: any;
  let service: ApprovalsService;

  beforeEach(() => {
    prisma = {
      approvalFlow: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), create: jest.fn(), update: jest.fn() },
      approvalStep: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn(), findUnique: jest.fn() },
      approvalInstance: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), create: jest.fn(), update: jest.fn() },
      approvalTask: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), create: jest.fn(), update: jest.fn() },
      employee: { findUnique: jest.fn().mockResolvedValue({ id: 'emp-a', companyId: 'company-a', deletedAt: null }) },
      $transaction: jest.fn(work => work(prisma)),
    };
    access = { allowedCompanyIds: jest.fn().mockResolvedValue(['company-a']), assertCompanyAccess: jest.fn().mockResolvedValue(undefined) };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    service = new ApprovalsService(prisma, access, audit);
  });

  describe('listApprovalFlows', () => {
    it('returns paginated approval flows', async () => {
      prisma.approvalFlow.count.mockResolvedValue(2);
      prisma.approvalFlow.findMany.mockResolvedValue([{ id: 'f1', code: 'LEAVE_APPROVAL', name: 'Leave Approval', subjectType: 'LEAVE' }, { id: 'f2', code: 'MISSION_APPROVAL', name: 'Mission Approval', subjectType: 'MISSION' }]);
      const result = await service.listApprovalFlows({ page: 1, limit: 10, skip: 0 } as any, actor);
      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });

    it('filters by subject type', async () => {
      await service.listApprovalFlows({ page: 1, limit: 10, skip: 0, subjectType: 'LEAVE' } as any, actor);
      const where = prisma.approvalFlow.findMany.mock.calls[0][0].where;
      expect(where.subjectType).toBe('LEAVE');
    });
  });

  describe('createApprovalFlow', () => {
    it('creates approval flow with steps', async () => {
      prisma.approvalFlow.findFirst.mockResolvedValue(null);
      prisma.approvalFlow.create.mockResolvedValue({ id: 'f1', code: 'CUSTOM_APPROVAL', name: 'Custom Approval', subjectType: 'PURCHASE', companyId: 'company-a' });
      prisma.approvalStep.create.mockResolvedValue({ id: 's1', stepOrder: 1, name: 'Step 1' });
      const result = await service.createApprovalFlow({ code: 'CUSTOM_APPROVAL', name: 'Custom Approval', subjectType: 'PURCHASE', steps: [{ stepOrder: 1, name: 'Step 1', approverType: 'ROLE' }] } as any, actor);
      expect(result.code).toBe('CUSTOM_APPROVAL');
      expect(audit.record).toHaveBeenCalled();
    });

    it('rejects duplicate flow code', async () => {
      prisma.approvalFlow.findFirst.mockResolvedValue({ id: 'f1', code: 'LEAVE_APPROVAL', deletedAt: null });
      await expect(service.createApprovalFlow({ code: 'LEAVE_APPROVAL', name: 'Leave Approval', subjectType: 'LEAVE' } as any, actor)).rejects.toThrow(ConflictException);
    });
  });

  describe('getApprovalFlow', () => {
    it('returns flow by id with steps', async () => {
      prisma.approvalFlow.findUnique.mockResolvedValue({ id: 'f1', code: 'LEAVE_APPROVAL', deletedAt: null });
      prisma.approvalStep.findMany.mockResolvedValue([{ id: 's1', flowId: 'f1', stepOrder: 1, name: 'Supervisor Approval' }]);
      const result = await service.getApprovalFlow('f1', actor);
      expect(result.id).toBe('f1');
      expect(result.steps).toHaveLength(1);
    });

    it('throws NotFoundException for non-existent flow', async () => {
      prisma.approvalFlow.findUnique.mockResolvedValue(null);
      await expect(service.getApprovalFlow('f1', actor)).rejects.toThrow(NotFoundException);
    });
  });

  describe('createApprovalInstance', () => {
    it('creates approval instance', async () => {
      prisma.approvalFlow.findUnique.mockResolvedValue({ id: 'f1', code: 'LEAVE_APPROVAL', subjectType: 'LEAVE', version: 1, deletedAt: null });
      prisma.approvalInstance.create.mockResolvedValue({ id: 'i1', flowId: 'f1', status: 'PENDING', currentStepOrder: 1 });
      const result = await service.createApprovalInstance({ flowId: 'f1', subjectType: 'LEAVE', subjectId: 'lr1', initiatedById: 'actor-a' } as any, actor);
      expect(result.flowId).toBe('f1');
      expect(result.status).toBe('PENDING');
      expect(audit.record).toHaveBeenCalled();
    });

    it('rejects non-existent flow', async () => {
      prisma.approvalFlow.findUnique.mockResolvedValue(null);
      await expect(service.createApprovalInstance({ flowId: 'f1', subjectType: 'LEAVE', subjectId: 'lr1' } as any, actor)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getApprovalInstance', () => {
    it('returns instance by id with tasks', async () => {
      prisma.approvalInstance.findUnique.mockResolvedValue({ id: 'i1', flowId: 'f1', status: 'PENDING', deletedAt: null });
      prisma.approvalTask.findMany.mockResolvedValue([{ id: 't1', instanceId: 'i1', stepOrder: 1, status: 'PENDING' }]);
      const result = await service.getApprovalInstance('i1', actor);
      expect(result.id).toBe('i1');
      expect(result.tasks).toHaveLength(1);
    });

    it('throws NotFoundException for non-existent instance', async () => {
      prisma.approvalInstance.findUnique.mockResolvedValue(null);
      await expect(service.getApprovalInstance('i1', actor)).rejects.toThrow(NotFoundException);
    });
  });

  describe('decideApprovalTask', () => {
    it('approves task', async () => {
      prisma.approvalTask.findUnique.mockResolvedValue({ id: 't1', instanceId: 'i1', stepOrder: 1, status: 'PENDING', assigneeUserId: 'actor-a', deletedAt: null });
      prisma.approvalTask.update.mockResolvedValue({ id: 't1', status: 'APPROVED', decision: 'APPROVE', decidedById: 'actor-a' });
      const result = await service.decideApprovalTask('t1', { decision: 'APPROVE', comment: 'Looks good' } as any, actor);
      expect(result.status).toBe('APPROVED');
      expect(result.decision).toBe('APPROVE');
    });

    it('rejects task not assigned to user', async () => {
      prisma.approvalTask.findUnique.mockResolvedValue({ id: 't1', instanceId: 'i1', stepOrder: 1, status: 'PENDING', assigneeUserId: 'other-user', deletedAt: null });
      await expect(service.decideApprovalTask('t1', { decision: 'APPROVE' } as any, actor)).rejects.toThrow(ForbiddenException);
    });

    it('rejects already decided task', async () => {
      prisma.approvalTask.findUnique.mockResolvedValue({ id: 't1', instanceId: 'i1', stepOrder: 1, status: 'APPROVED', assigneeUserId: 'actor-a', deletedAt: null });
      await expect(service.decideApprovalTask('t1', { decision: 'APPROVE' } as any, actor)).rejects.toThrow(BadRequestException);
    });
  });

  describe('listPendingApprovals', () => {
    it('returns pending approvals for user', async () => {
      prisma.approvalTask.count.mockResolvedValue(3);
      prisma.approvalTask.findMany.mockResolvedValue([{ id: 't1', status: 'PENDING', assigneeUserId: 'actor-a' }, { id: 't2', status: 'PENDING', assigneeUserId: 'actor-a' }, { id: 't3', status: 'PENDING', assigneeUserId: 'actor-a' }]);
      const result = await service.listPendingApprovals('actor-a', { page: 1, limit: 10, skip: 0 } as any);
      expect(result.data).toHaveLength(3);
      expect(result.meta.total).toBe(3);
    });
  });

  describe('deleteApprovalFlow', () => {
    it('soft deletes flow', async () => {
      prisma.approvalFlow.findUnique.mockResolvedValue({ id: 'f1', code: 'CUSTOM_APPROVAL', isSystem: false, deletedAt: null });
      prisma.approvalInstance.count.mockResolvedValue(0);
      prisma.approvalFlow.update.mockResolvedValue({ id: 'f1', deletedAt: new Date() });
      const result = await service.deleteApprovalFlow('f1', actor);
      expect(result.success).toBe(true);
    });

    it('rejects deleting system flow', async () => {
      prisma.approvalFlow.findUnique.mockResolvedValue({ id: 'f1', code: 'LEAVE_APPROVAL', isSystem: true, deletedAt: null });
      await expect(service.deleteApprovalFlow('f1', actor)).rejects.toThrow(ForbiddenException);
    });

    it('rejects flow with active instances', async () => {
      prisma.approvalFlow.findUnique.mockResolvedValue({ id: 'f1', code: 'CUSTOM_APPROVAL', isSystem: false, deletedAt: null });
      prisma.approvalInstance.count.mockResolvedValue(5);
      await expect(service.deleteApprovalFlow('f1', actor)).rejects.toThrow(BadRequestException);
    });
  });
});