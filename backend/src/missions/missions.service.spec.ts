import { MissionsService } from './missions.service';
import { AccessService } from '../common/access/access.service';
import { AuditService } from '../common/audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';

const actor = {
  id: 'actor-a', username: 'actor.a', fullName: 'Test Actor', email: 'actor@test.com',
  mobile: null, isSuperAdmin: false, employeeId: 'emp-a', roleIds: [], roleCodes: [],
  permissions: ['missions.view', 'missions.create', 'missions.update', 'missions.delete', 'missions.approve'],
  scope: { unrestricted: false, companyIds: ['company-a'], branchIds: [], orgUnitIds: [], employeeIds: [], ownEmployeeId: 'emp-a' },
} as unknown as AuthenticatedUser;

describe('MissionsService', () => {
  let prisma: any;
  let access: any;
  let audit: any;
  let service: MissionsService;

  beforeEach(() => {
    prisma = {
      mission: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), create: jest.fn(), update: jest.fn() },
      missionExpense: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn() },
      employee: { findUnique: jest.fn().mockResolvedValue({ id: 'emp-a', companyId: 'company-a', deletedAt: null }) },
      $transaction: jest.fn(work => work(prisma)),
    };
    access = { allowedCompanyIds: jest.fn().mockResolvedValue(['company-a']), canAccessEmployee: jest.fn().mockResolvedValue(true), assertCompanyAccess: jest.fn().mockResolvedValue(undefined), assertEmployeeAccess: jest.fn().mockResolvedValue(undefined) };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    service = new MissionsService(prisma, access, audit);
  });

  describe('listMissions', () => {
    it('returns paginated missions', async () => {
      prisma.mission.count.mockResolvedValue(2);
      prisma.mission.findMany.mockResolvedValue([{ id: 'm1', title: 'Mission 1', status: 'REQUESTED' }, { id: 'm2', title: 'Mission 2', status: 'APPROVED' }]);
      const result = await service.listMissions({ page: 1, limit: 10, skip: 0 } as any, actor);
      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });

    it('filters by employee', async () => {
      await service.listMissions({ page: 1, limit: 10, skip: 0, employeeId: 'emp-a' } as any, actor);
      const where = prisma.mission.findMany.mock.calls[0][0].where;
      expect(where.employeeId).toBe('emp-a');
    });

    it('filters by status', async () => {
      await service.listMissions({ page: 1, limit: 10, skip: 0, status: 'REQUESTED' } as any, actor);
      const where = prisma.mission.findMany.mock.calls[0][0].where;
      expect(where.status).toBe('REQUESTED');
    });
  });

  describe('createMission', () => {
    it('creates mission for employee', async () => {
      prisma.employee.findUnique.mockResolvedValue({ id: 'emp-a', companyId: 'company-a', deletedAt: null });
      prisma.mission.create.mockResolvedValue({ id: 'm1', title: 'Business Trip', status: 'REQUESTED', employeeId: 'emp-a', companyId: 'company-a' });
      const result = await service.createMission({ employeeId: 'emp-a', title: 'Business Trip', destination: 'Tehran', startAt: '2026-01-01', endAt: '2026-01-05', estimatedCost: 5000000 } as any, actor);
      expect(result.title).toBe('Business Trip');
      expect(result.status).toBe('REQUESTED');
      expect(audit.record).toHaveBeenCalled();
    });

    it('rejects mission for non-existent employee', async () => {
      prisma.employee.findUnique.mockResolvedValue(null);
      await expect(service.createMission({ employeeId: 'emp-other', title: 'Trip' } as any, actor)).rejects.toThrow(NotFoundException);
    });

    it('rejects unauthorized employee access', async () => {
      access.canAccessEmployee.mockResolvedValue(false);
      await expect(service.createMission({ employeeId: 'emp-other', title: 'Trip' } as any, actor)).rejects.toThrow(ForbiddenException);
    });

    it('rejects reversed dates', async () => {
      prisma.employee.findUnique.mockResolvedValue({ id: 'emp-a', companyId: 'company-a', deletedAt: null });
      await expect(service.createMission({ employeeId: 'emp-a', title: 'Trip', startAt: '2026-01-05', endAt: '2026-01-01' } as any, actor)).rejects.toThrow(BadRequestException);
    });

    it('rejects negative estimated cost', async () => {
      prisma.employee.findUnique.mockResolvedValue({ id: 'emp-a', companyId: 'company-a', deletedAt: null });
      await expect(service.createMission({ employeeId: 'emp-a', title: 'Trip', startAt: '2026-01-01', endAt: '2026-01-05', estimatedCost: -1000 } as any, actor)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getMission', () => {
    it('returns mission by id', async () => {
      prisma.mission.findUnique.mockResolvedValue({ id: 'm1', title: 'Business Trip', deletedAt: null });
      const result = await service.getMission('m1', actor);
      expect(result.id).toBe('m1');
    });

    it('throws NotFoundException for non-existent mission', async () => {
      prisma.mission.findUnique.mockResolvedValue(null);
      await expect(service.getMission('m1', actor)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateMission', () => {
    it('updates mission', async () => {
      prisma.mission.findUnique.mockResolvedValue({ id: 'm1', title: 'Old Title', status: 'REQUESTED', employeeId: 'emp-a', deletedAt: null });
      prisma.mission.update.mockResolvedValue({ id: 'm1', title: 'New Title', status: 'REQUESTED' });
      const result = await service.updateMission('m1', { title: 'New Title' } as any, actor);
      expect(result.title).toBe('New Title');
    });

    it('rejects updating non-requested mission', async () => {
      prisma.mission.findUnique.mockResolvedValue({ id: 'm1', title: 'Title', status: 'APPROVED', employeeId: 'emp-a', deletedAt: null });
      await expect(service.updateMission('m1', { title: 'New Title' } as any, actor)).rejects.toThrow(BadRequestException);
    });
  });

  describe('approveMission', () => {
    it('approves mission request', async () => {
      prisma.mission.findUnique.mockResolvedValue({ id: 'm1', status: 'REQUESTED', employeeId: 'emp-a', deletedAt: null });
      prisma.mission.update.mockResolvedValue({ id: 'm1', status: 'APPROVED', approvedById: 'actor-a' });
      const result = await service.approveMission('m1', actor);
      expect(result.status).toBe('APPROVED');
      expect(result.approvedById).toBe('actor-a');
    });

    it('rejects non-requested mission', async () => {
      prisma.mission.findUnique.mockResolvedValue({ id: 'm1', status: 'APPROVED', employeeId: 'emp-a', deletedAt: null });
      await expect(service.approveMission('m1', actor)).rejects.toThrow(BadRequestException);
    });
  });

  describe('rejectMission', () => {
    it('rejects mission request', async () => {
      prisma.mission.findUnique.mockResolvedValue({ id: 'm1', status: 'REQUESTED', employeeId: 'emp-a', deletedAt: null });
      prisma.mission.update.mockResolvedValue({ id: 'm1', status: 'REJECTED' });
      const result = await service.rejectMission('m1', { reason: 'Budget exceeded' } as any, actor);
      expect(result.status).toBe('REJECTED');
    });
  });

  describe('addMissionExpense', () => {
    it('adds mission expense', async () => {
      prisma.mission.findUnique.mockResolvedValue({ id: 'm1', status: 'APPROVED', employeeId: 'emp-a', deletedAt: null });
      prisma.missionExpense.create.mockResolvedValue({ id: 'e1', missionId: 'm1', description: 'Transport', amount: 2000000 });
      const result = await service.addMissionExpense('m1', { description: 'Transport', amount: 2000000, spentAt: '2026-01-02' } as any, actor);
      expect(result.description).toBe('Transport');
      expect(result.amount).toBe(2000000);
    });

    it('rejects expense for non-approved mission', async () => {
      prisma.mission.findUnique.mockResolvedValue({ id: 'm1', status: 'REQUESTED', employeeId: 'emp-a', deletedAt: null });
      await expect(service.addMissionExpense('m1', { description: 'Transport', amount: 2000000 } as any, actor)).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteMission', () => {
    it('soft deletes mission', async () => {
      prisma.mission.findUnique.mockResolvedValue({ id: 'm1', title: 'Trip', status: 'REQUESTED', employeeId: 'emp-a', deletedAt: null });
      prisma.mission.update.mockResolvedValue({ id: 'm1', deletedAt: new Date() });
      const result = await service.deleteMission('m1', actor);
      expect(result.success).toBe(true);
    });

    it('rejects deleting completed mission', async () => {
      prisma.mission.findUnique.mockResolvedValue({ id: 'm1', title: 'Trip', status: 'COMPLETED', employeeId: 'emp-a', deletedAt: null });
      await expect(service.deleteMission('m1', actor)).rejects.toThrow(BadRequestException);
    });
  });

  describe('completeMission', () => {
    it('completes mission with report', async () => {
      prisma.mission.findUnique.mockResolvedValue({ id: 'm1', status: 'IN_PROGRESS', employeeId: 'emp-a', deletedAt: null });
      prisma.mission.update.mockResolvedValue({ id: 'm1', status: 'COMPLETED', report: 'Mission completed successfully' });
      const result = await service.completeMission('m1', { report: 'Mission completed successfully', actualCost: 4500000 } as any, actor);
      expect(result.status).toBe('COMPLETED');
      expect(result.report).toBe('Mission completed successfully');
    });

    it('requires report for completion', async () => {
      prisma.mission.findUnique.mockResolvedValue({ id: 'm1', status: 'IN_PROGRESS', employeeId: 'emp-a', deletedAt: null });
      await expect(service.completeMission('m1', { actualCost: 4500000 } as any, actor)).rejects.toThrow(BadRequestException);
    });
  });
});
