import { EmployeePanelService } from './employee-panel.service';
import { AccessService } from '../common/access/access.service';
import { AuditService } from '../common/audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';

const actor = {
  id: 'actor-a', username: 'actor.a', fullName: 'Test Actor', email: 'actor@test.com',
  mobile: null, isSuperAdmin: false, employeeId: 'emp-a', roleIds: [], roleCodes: [],
  permissions: ['panel.view', 'panel.attendance', 'panel.leave.request'],
  scope: { unrestricted: false, companyIds: ['company-a'], branchIds: [], orgUnitIds: [], employeeIds: [], ownEmployeeId: 'emp-a' },
} as unknown as AuthenticatedUser;

describe('EmployeePanelService', () => {
  let prisma: any;
  let access: any;
  let audit: any;
  let service: EmployeePanelService;

  beforeEach(() => {
    prisma = {
      task: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), update: jest.fn() },
      taskAssignee: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), update: jest.fn(), updateMany: jest.fn() },
      taskComment: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
      project: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
      projectMember: { findMany: jest.fn().mockResolvedValue([]) },
      projectTask: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
      projectAttendance: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn(), update: jest.fn() },
      leaveRequest: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), create: jest.fn(), update: jest.fn() },
      mission: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), create: jest.fn(), update: jest.fn() },
      payslip: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
      attendanceRecord: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
      employee: { findUnique: jest.fn().mockResolvedValue({ id: 'emp-a', companyId: 'company-a', deletedAt: null, status: 'ACTIVE' }) },
      $transaction: jest.fn(work => work(prisma)),
    };
    access = { allowedCompanyIds: jest.fn().mockResolvedValue(['company-a']), canAccessEmployee: jest.fn().mockResolvedValue(true), assertCompanyAccess: jest.fn().mockResolvedValue(undefined), assertEmployeeAccess: jest.fn().mockResolvedValue(undefined) };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    service = new EmployeePanelService(prisma, access, audit);
  });

  describe('listMyTasks', () => {
    it('returns paginated tasks for employee', async () => {
      prisma.taskAssignee.findMany.mockResolvedValue([{ taskId: 't1', employeeId: 'emp-a', isResponsible: true }, { taskId: 't2', employeeId: 'emp-a', isResponsible: true }]);
      prisma.task.findMany.mockResolvedValue([{ id: 't1', title: 'Task 1', status: 'NEW' }, { id: 't2', title: 'Task 2', status: 'IN_PROGRESS' }]);
      prisma.task.count.mockResolvedValue(2);
      const result = await service.listMyTasks('emp-a', { page: 1, limit: 10, skip: 0 } as any, actor);
      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });

    it('filters by status', async () => {
      await service.listMyTasks('emp-a', { page: 1, limit: 10, skip: 0, status: 'NEW' } as any, actor);
      const where = prisma.task.findMany.mock.calls[0][0].where;
      expect(where.status).toBe('NEW');
    });
  });

  describe('getMyTask', () => {
    it('returns task by id for assigned employee', async () => {
      prisma.taskAssignee.findUnique.mockResolvedValue({ taskId: 't1', employeeId: 'emp-a', isResponsible: true });
      prisma.task.findUnique.mockResolvedValue({ id: 't1', title: 'Task 1', status: 'NEW', deletedAt: null });
      const result = await service.getMyTask('t1', 'emp-a', actor);
      expect(result.id).toBe('t1');
    });

    it('throws NotFoundException for non-existent task', async () => {
      prisma.taskAssignee.findUnique.mockResolvedValue(null);
      await expect(service.getMyTask('t1', 'emp-a', actor)).rejects.toThrow(NotFoundException);
    });

    it('rejects accessing unassigned task', async () => {
      prisma.taskAssignee.findUnique.mockResolvedValue({ taskId: 't1', employeeId: 'emp-other', isResponsible: true });
      await expect(service.getMyTask('t1', 'emp-a', actor)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('startTask', () => {
    it('starts a task', async () => {
      prisma.task.findUnique.mockResolvedValue({ id: 't1', title: 'Task 1', status: 'NEW', deletedAt: null });
      prisma.taskAssignee.findUnique.mockResolvedValue({ taskId: 't1', employeeId: 'emp-a', isResponsible: true });
      prisma.task.update.mockResolvedValue({ id: 't1', status: 'IN_PROGRESS' });
      const result = await service.startTask('t1', 'emp-a', actor);
      expect(result.status).toBe('IN_PROGRESS');
      expect(audit.record).toHaveBeenCalled();
    });

    it('rejects starting already started task', async () => {
      prisma.task.findUnique.mockResolvedValue({ id: 't1', title: 'Task 1', status: 'IN_PROGRESS', deletedAt: null });
      await expect(service.startTask('t1', 'emp-a', actor)).rejects.toThrow(BadRequestException);
    });

    it('rejects starting completed task', async () => {
      prisma.task.findUnique.mockResolvedValue({ id: 't1', title: 'Task 1', status: 'DONE', deletedAt: null });
      await expect(service.startTask('t1', 'emp-a', actor)).rejects.toThrow(BadRequestException);
    });
  });

  describe('completeTask', () => {
    it('completes a task', async () => {
      prisma.task.findUnique.mockResolvedValue({ id: 't1', title: 'Task 1', status: 'IN_PROGRESS', deletedAt: null });
      prisma.taskAssignee.findUnique.mockResolvedValue({ taskId: 't1', employeeId: 'emp-a', isResponsible: true });
      prisma.task.update.mockResolvedValue({ id: 't1', status: 'DONE', completedAt: new Date() });
      const result = await service.completeTask('t1', 'emp-a', actor);
      expect(result.status).toBe('DONE');
      expect(result.completedAt).toBeDefined();
    });

    it('rejects completing not-started task', async () => {
      prisma.task.findUnique.mockResolvedValue({ id: 't1', title: 'Task 1', status: 'NEW', deletedAt: null });
      await expect(service.completeTask('t1', 'emp-a', actor)).rejects.toThrow(BadRequestException);
    });
  });

  describe('reportTaskIssue', () => {
    it('reports task issue with required reason', async () => {
      prisma.task.findUnique.mockResolvedValue({ id: 't1', title: 'Task 1', status: 'IN_PROGRESS', deletedAt: null });
      prisma.taskAssignee.findUnique.mockResolvedValue({ taskId: 't1', employeeId: 'emp-a', isResponsible: true });
      prisma.task.update.mockResolvedValue({ id: 't1', status: 'IN_PROGRESS', delayReason: 'Waiting for approval' });
      prisma.taskComment.create.mockResolvedValue({ id: 'tc1', taskId: 't1', content: 'Waiting for approval', authorId: 'actor-a' });
      const result = await service.reportTaskIssue('t1', 'emp-a', { reason: 'Waiting for approval' } as any, actor);
      expect(result.delayReason).toBe('Waiting for approval');
    });

    it('rejects reporting issue without reason', async () => {
      prisma.task.findUnique.mockResolvedValue({ id: 't1', title: 'Task 1', status: 'IN_PROGRESS', deletedAt: null });
      prisma.taskAssignee.findUnique.mockResolvedValue({ taskId: 't1', employeeId: 'emp-a', isResponsible: true });
      await expect(service.reportTaskIssue('t1', 'emp-a', { reason: '' } as any, actor)).rejects.toThrow(BadRequestException);
    });
  });

  describe('resolveTaskIssue', () => {
    it('resolves task issue and clears delay reason', async () => {
      prisma.task.findUnique.mockResolvedValue({ id: 't1', title: 'Task 1', status: 'IN_PROGRESS', delayReason: 'Waiting for approval', deletedAt: null });
      prisma.taskAssignee.findUnique.mockResolvedValue({ taskId: 't1', employeeId: 'emp-a', isResponsible: true });
      prisma.task.update.mockResolvedValue({ id: 't1', status: 'IN_PROGRESS', delayReason: null });
      const result = await service.resolveTaskIssue('t1', 'emp-a', actor);
      expect(result.delayReason).toBeNull();
    });

    it('rejects resolving task without issue', async () => {
      prisma.task.findUnique.mockResolvedValue({ id: 't1', title: 'Task 1', status: 'IN_PROGRESS', delayReason: null, deletedAt: null });
      await expect(service.resolveTaskIssue('t1', 'emp-a', actor)).rejects.toThrow(BadRequestException);
    });
  });

  describe('dismissTask', () => {
    it('dismisses completed task from employee list', async () => {
      prisma.task.findUnique.mockResolvedValue({ id: 't1', title: 'Task 1', status: 'DONE', deletedAt: null });
      prisma.taskAssignee.findUnique.mockResolvedValue({ taskId: 't1', employeeId: 'emp-a', isResponsible: true });
      prisma.taskAssignee.update.mockResolvedValue({ id: 'ta1', taskId: 't1', employeeId: 'emp-a', dismissedAt: new Date() });
      const result = await service.dismissTask('t1', 'emp-a', actor);
      expect(result.dismissedAt).toBeDefined();
    });

    it('rejects dismissing uncompleted task', async () => {
      prisma.task.findUnique.mockResolvedValue({ id: 't1', title: 'Task 1', status: 'IN_PROGRESS', deletedAt: null });
      await expect(service.dismissTask('t1', 'emp-a', actor)).rejects.toThrow(BadRequestException);
    });
  });

  describe('listMyLeaveRequests', () => {
    it('returns paginated leave requests for employee', async () => {
      prisma.leaveRequest.findMany.mockResolvedValue([{ id: 'lr1', employeeId: 'emp-a', status: 'PENDING_SUPERVISOR' }, { id: 'lr2', employeeId: 'emp-a', status: 'APPROVED' }]);
      prisma.leaveRequest.count.mockResolvedValue(2);
      const result = await service.listMyLeaveRequests('emp-a', { page: 1, limit: 10, skip: 0 } as any, actor);
      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });

    it('filters by status', async () => {
      await service.listMyLeaveRequests('emp-a', { page: 1, limit: 10, skip: 0, status: 'PENDING_SUPERVISOR' } as any, actor);
      const where = prisma.leaveRequest.findMany.mock.calls[0][0].where;
      expect(where.status).toBe('PENDING_SUPERVISOR');
    });
  });

  describe('createLeaveRequest', () => {
    it('creates leave request for employee', async () => {
      prisma.leaveRequest.findMany.mockResolvedValue([]);
      prisma.leaveRequest.create.mockResolvedValue({ id: 'lr1', employeeId: 'emp-a', status: 'DRAFT', leaveTypeId: 'lt1' });
      const result = await service.createLeaveRequest('emp-a', { leaveTypeId: 'lt1', startAt: '2026-01-01', endAt: '2026-01-05', durationMinutes: 3840, reason: 'Vacation' } as any, actor);
      expect(result.employeeId).toBe('emp-a');
      expect(result.status).toBe('DRAFT');
      expect(audit.record).toHaveBeenCalled();
    });

    it('rejects overlapping leave request', async () => {
      prisma.leaveRequest.findMany.mockResolvedValue([{ id: 'lr1', employeeId: 'emp-a', startAt: new Date('2026-01-03'), endAt: new Date('2026-01-07'), status: { in: ['SUBMITTED', 'PENDING_SUPERVISOR', 'APPROVED'] } }]);
      await expect(service.createLeaveRequest('emp-a', { leaveTypeId: 'lt1', startAt: '2026-01-05', endAt: '2026-01-10', durationMinutes: 3840 } as any, actor)).rejects.toThrow(BadRequestException);
    });
  });

  describe('listMyMissions', () => {
    it('returns paginated missions for employee', async () => {
      prisma.mission.findMany.mockResolvedValue([{ id: 'm1', employeeId: 'emp-a', status: 'REQUESTED' }, { id: 'm2', employeeId: 'emp-a', status: 'APPROVED' }]);
      prisma.mission.count.mockResolvedValue(2);
      const result = await service.listMyMissions('emp-a', { page: 1, limit: 10, skip: 0 } as any, actor);
      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });
  });

  describe('createMission', () => {
    it('creates mission for employee', async () => {
      prisma.mission.create.mockResolvedValue({ id: 'm1', employeeId: 'emp-a', title: 'Business Trip', status: 'REQUESTED' });
      const result = await service.createMission('emp-a', { title: 'Business Trip', destination: 'Tehran', startAt: '2026-01-01', endAt: '2026-01-05', estimatedCost: 5000000 } as any, actor);
      expect(result.employeeId).toBe('emp-a');
      expect(result.status).toBe('REQUESTED');
      expect(audit.record).toHaveBeenCalled();
    });

    it('rejects reversed mission dates', async () => {
      await expect(service.createMission('emp-a', { title: 'Trip', startAt: '2026-01-05', endAt: '2026-01-01' } as any, actor)).rejects.toThrow(BadRequestException);
    });
  });

  describe('listMyPayslips', () => {
    it('returns paginated payslips for employee', async () => {
      prisma.payslip.findMany.mockResolvedValue([{ id: 'ps1', employeeId: 'emp-a', periodId: 'pp1', status: 'PUBLISHED' }, { id: 'ps2', employeeId: 'emp-a', periodId: 'pp2', status: 'PUBLISHED' }]);
      prisma.payslip.count.mockResolvedValue(2);
      const result = await service.listMyPayslips('emp-a', { page: 1, limit: 10, skip: 0 } as any, actor);
      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });
  });

  describe('getMyPayslip', () => {
    it('returns payslip by id for employee', async () => {
      prisma.payslip.findUnique.mockResolvedValue({ id: 'ps1', employeeId: 'emp-a', status: 'PUBLISHED', deletedAt: null });
      const result = await service.getMyPayslip('ps1', 'emp-a', actor);
      expect(result.id).toBe('ps1');
    });

    it('rejects accessing other employee payslip', async () => {
      prisma.payslip.findUnique.mockResolvedValue({ id: 'ps1', employeeId: 'emp-other', status: 'PUBLISHED', deletedAt: null });
      await expect(service.getMyPayslip('ps1', 'emp-a', actor)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('listMyAttendance', () => {
    it('returns paginated attendance records for employee', async () => {
      prisma.attendanceRecord.findMany.mockResolvedValue([{ id: 'ar1', employeeId: 'emp-a', workDate: new Date('2026-01-01'), status: 'COMPLETE' }, { id: 'ar2', employeeId: 'emp-a', workDate: new Date('2026-01-02'), status: 'COMPLETE' }]);
      prisma.attendanceRecord.count.mockResolvedValue(2);
      const result = await service.listMyAttendance('emp-a', { page: 1, limit: 10, skip: 0, month: '2026-01' } as any, actor);
      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });
  });

  describe('getDashboardSummary', () => {
    it('returns dashboard summary for employee', async () => {
      prisma.task.count.mockResolvedValue(5);
      prisma.leaveRequest.count.mockResolvedValue(2);
      prisma.mission.count.mockResolvedValue(1);
      prisma.payslip.count.mockResolvedValue(1);
      const result = await service.getDashboardSummary('emp-a', actor);
      expect(result.openTasks).toBe(5);
      expect(result.pendingLeaves).toBe(2);
      expect(result.activeMissions).toBe(1);
      expect(result.publishedPayslips).toBe(1);
    });
  });
});