import { ShiftsService } from './shifts.service';
import { AccessService } from '../common/access/access.service';
import { AuditService } from '../common/audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';

const actor = {
  id: 'actor-a', username: 'actor.a', fullName: 'Test Actor', email: 'actor@test.com',
  mobile: null, isSuperAdmin: false, employeeId: null, roleIds: [], roleCodes: [],
  permissions: ['shifts.view', 'shifts.create', 'shifts.update', 'shifts.delete'],
  scope: { unrestricted: false, companyIds: ['company-a'], branchIds: [], orgUnitIds: [], employeeIds: [], ownEmployeeId: null },
} as unknown as AuthenticatedUser;

describe('ShiftsService', () => {
  let prisma: any;
  let access: any;
  let audit: any;
  let service: ShiftsService;

  beforeEach(() => {
    prisma = {
      shift: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), create: jest.fn(), update: jest.fn() },
      shiftAssignment: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
      $transaction: jest.fn(work => work(prisma)),
    };
    access = { allowedCompanyIds: jest.fn().mockResolvedValue(['company-a']), assertCompanyAccess: jest.fn().mockResolvedValue(undefined), assertEmployeeAccess: jest.fn().mockResolvedValue(undefined) };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    service = new ShiftsService(prisma, access, audit);
  });

  describe('listShifts', () => {
    it('returns paginated shifts', async () => {
      prisma.shift.count.mockResolvedValue(2);
      prisma.shift.findMany.mockResolvedValue([{ id: 's1', code: 'STD-08', name: 'Standard 8h' }, { id: 's2', code: 'NIGHT', name: 'Night Shift' }]);
      const result = await service.listShifts({ page: 1, limit: 10, skip: 0 } as any, actor);
      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });

    it('filters by company and active status', async () => {
      await service.listShifts({ page: 1, limit: 10, skip: 0, isActive: true } as any, actor);
      const where = prisma.shift.findMany.mock.calls[0][0].where;
      expect(where.isActive).toBe(true);
    });
  });

  describe('createShift', () => {
    it('creates shift for company', async () => {
      prisma.shift.findFirst.mockResolvedValue(null);
      prisma.shift.create.mockResolvedValue({ id: 's1', code: 'STD-08', name: 'Standard 8h', companyId: 'company-a' });
      const result = await service.createShift({ companyId: 'company-a', code: 'STD-08', name: 'Standard 8h', startTime: '08:00', endTime: '16:00', durationMinutes: 480 } as any, actor);
      expect(result.code).toBe('STD-08');
      expect(prisma.shift.create).toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalled();
    });

    it('rejects duplicate shift code', async () => {
      prisma.shift.findFirst.mockResolvedValue({ id: 's1', code: 'STD-08', deletedAt: null });
      await expect(service.createShift({ companyId: 'company-a', code: 'STD-08', name: 'Standard 8h' } as any, actor)).rejects.toThrow(ConflictException);
    });
  });

  describe('getShift', () => {
    it('returns shift by id', async () => {
      prisma.shift.findUnique.mockResolvedValue({ id: 's1', code: 'STD-08', deletedAt: null });
      const result = await service.getShift('s1', actor);
      expect(result.id).toBe('s1');
    });

    it('throws NotFoundException for non-existent shift', async () => {
      prisma.shift.findUnique.mockResolvedValue(null);
      await expect(service.getShift('s1', actor)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateShift', () => {
    it('updates shift', async () => {
      prisma.shift.findUnique.mockResolvedValue({ id: 's1', code: 'STD-08', name: 'Old Name', deletedAt: null });
      prisma.shift.findFirst.mockResolvedValue(null);
      prisma.shift.update.mockResolvedValue({ id: 's1', code: 'STD-08', name: 'New Name' });
      const result = await service.updateShift('s1', { name: 'New Name' } as any, actor);
      expect(result.name).toBe('New Name');
    });
  });

  describe('deleteShift', () => {
    it('soft deletes shift', async () => {
      prisma.shift.findUnique.mockResolvedValue({ id: 's1', code: 'STD-08', deletedAt: null });
      prisma.shift.update.mockResolvedValue({ id: 's1', deletedAt: new Date() });
      const result = await service.deleteShift('s1', actor);
      expect(result.success).toBe(true);
    });

    it('rejects shift with active assignments', async () => {
      prisma.shift.findUnique.mockResolvedValue({ id: 's1', code: 'STD-08', deletedAt: null });
      prisma.shiftAssignment.count.mockResolvedValue(5);
      await expect(service.deleteShift('s1', actor)).rejects.toThrow(BadRequestException);
    });
  });

  describe('createShiftAssignment', () => {
    it('creates shift assignment', async () => {
      prisma.shift.findUnique.mockResolvedValue({ id: 's1', companyId: 'company-a', deletedAt: null });
      prisma.employee = { findUnique: jest.fn().mockResolvedValue({ id: 'emp1', companyId: 'company-a', deletedAt: null }) };
      prisma.shiftAssignment.findFirst.mockResolvedValue(null);
      prisma.shiftAssignment.create.mockResolvedValue({ id: 'sa1', shiftId: 's1', employeeId: 'emp1' });
      const result = await service.createShiftAssignment({ shiftId: 's1', employeeId: 'emp1', workDate: '2026-01-01' } as any, actor);
      expect(result.shiftId).toBe('s1');
    });
  });

  describe('listShiftAssignments', () => {
    it('returns shift assignments for date range', async () => {
      prisma.shiftAssignment.findMany.mockResolvedValue([{ id: 'sa1', shiftId: 's1', employeeId: 'emp1', workDate: new Date() }]);
      const result = await service.listShiftAssignments({ page: 1, limit: 10, skip: 0, from: '2026-01-01', to: '2026-01-31' } as any, actor);
      expect(result.data).toHaveLength(1);
    });
  });
});