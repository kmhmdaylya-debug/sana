import { AttendanceService } from './attendance.service';
import { AccessService } from '../common/access/access.service';
import { AuditService } from '../common/audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';

const actor = {
  id: 'actor-a', username: 'actor.a', fullName: 'Test Actor', email: 'actor@test.com',
  mobile: null, isSuperAdmin: false, employeeId: 'emp-a', roleIds: [], roleCodes: [],
  permissions: ['attendance.view', 'attendance.create', 'attendance.update', 'attendance.delete'],
  scope: { unrestricted: false, companyIds: ['company-a'], branchIds: [], orgUnitIds: [], employeeIds: [], ownEmployeeId: 'emp-a' },
} as unknown as AuthenticatedUser;

describe('AttendanceService', () => {
  let prisma: any;
  let access: any;
  let audit: any;
  let service: AttendanceService;

  beforeEach(() => {
    prisma = {
      attendanceEvent: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), create: jest.fn(), update: jest.fn() },
      attendanceRecord: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), create: jest.fn(), update: jest.fn(), upsert: jest.fn() },
      attendanceDevice: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
      shiftAssignment: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
      employee: { findUnique: jest.fn().mockResolvedValue({ id: 'emp-a', companyId: 'company-a', deletedAt: null, status: 'ACTIVE' }) },
      calendar: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
      holiday: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn(work => work(prisma)),
    };
    access = { allowedCompanyIds: jest.fn().mockResolvedValue(['company-a']), canAccessEmployee: jest.fn().mockResolvedValue(true), assertCompanyAccess: jest.fn().mockResolvedValue(undefined), assertEmployeeAccess: jest.fn().mockResolvedValue(undefined) };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    service = new AttendanceService(prisma, access, audit);
  });

  describe('listAttendanceEvents', () => {
    it('returns paginated attendance events', async () => {
      prisma.attendanceEvent.count.mockResolvedValue(2);
      prisma.attendanceEvent.findMany.mockResolvedValue([{ id: 'ae1', employeeId: 'emp-a', type: 'IN', eventTime: new Date('2026-01-01T08:00:00Z') }, { id: 'ae2', employeeId: 'emp-a', type: 'OUT', eventTime: new Date('2026-01-01T16:00:00Z') }]);
      const result = await service.listAttendanceEvents({ page: 1, limit: 10, skip: 0 } as any, actor);
      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });

    it('filters by employee', async () => {
      await service.listAttendanceEvents({ page: 1, limit: 10, skip: 0, employeeId: 'emp-a' } as any, actor);
      const where = prisma.attendanceEvent.findMany.mock.calls[0][0].where;
      expect(where.employeeId).toBe('emp-a');
    });

    it('filters by event type', async () => {
      await service.listAttendanceEvents({ page: 1, limit: 10, skip: 0, type: 'IN' } as any, actor);
      const where = prisma.attendanceEvent.findMany.mock.calls[0][0].where;
      expect(where.type).toBe('IN');
    });

    it('filters by date range', async () => {
      await service.listAttendanceEvents({ page: 1, limit: 10, skip: 0, from: '2026-01-01', to: '2026-01-31' } as any, actor);
      const where = prisma.attendanceEvent.findMany.mock.calls[0][0].where;
      expect(where.eventTime).toBeDefined();
    });
  });

  describe('createAttendanceEvent', () => {
    it('creates attendance event with idempotency', async () => {
      prisma.employee.findUnique.mockResolvedValue({ id: 'emp-a', companyId: 'company-a', deletedAt: null });
      prisma.attendanceEvent.findFirst.mockResolvedValue(null);
      prisma.attendanceEvent.create.mockResolvedValue({ id: 'ae1', employeeId: 'emp-a', type: 'IN', eventTime: new Date('2026-01-01T08:00:00Z'), idempotencyKey: 'emp-a-2026-01-01-IN' });
      const result = await service.createAttendanceEvent({ employeeId: 'emp-a', type: 'IN', eventTime: '2026-01-01T08:00:00Z', source: 'DEVICE', idempotencyKey: 'emp-a-2026-01-01-IN' } as any, actor);
      expect(result.employeeId).toBe('emp-a');
      expect(result.type).toBe('IN');
      expect(audit.record).toHaveBeenCalled();
    });

    it('rejects duplicate idempotency key', async () => {
      prisma.employee.findUnique.mockResolvedValue({ id: 'emp-a', companyId: 'company-a', deletedAt: null });
      prisma.attendanceEvent.findFirst.mockResolvedValue({ id: 'ae1', idempotencyKey: 'emp-a-2026-01-01-IN' });
      await expect(service.createAttendanceEvent({ employeeId: 'emp-a', type: 'IN', eventTime: '2026-01-01T08:00:00Z', source: 'DEVICE', idempotencyKey: 'emp-a-2026-01-01-IN' } as any, actor)).rejects.toThrow(ConflictException);
    });

    it('rejects event for non-existent employee', async () => {
      prisma.employee.findUnique.mockResolvedValue(null);
      await expect(service.createAttendanceEvent({ employeeId: 'emp-other', type: 'IN', eventTime: '2026-01-01T08:00:00Z', source: 'DEVICE', idempotencyKey: 'key' } as any, actor)).rejects.toThrow(NotFoundException);
    });

    it('rejects unauthorized employee access', async () => {
      access.canAccessEmployee.mockResolvedValue(false);
      await expect(service.createAttendanceEvent({ employeeId: 'emp-other', type: 'IN', eventTime: '2026-01-01T08:00:00Z', source: 'DEVICE', idempotencyKey: 'key' } as any, actor)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getAttendanceEvent', () => {
    it('returns event by id', async () => {
      prisma.attendanceEvent.findUnique.mockResolvedValue({ id: 'ae1', employeeId: 'emp-a', deletedAt: null });
      const result = await service.getAttendanceEvent('ae1', actor);
      expect(result.id).toBe('ae1');
    });

    it('throws NotFoundException for non-existent event', async () => {
      prisma.attendanceEvent.findUnique.mockResolvedValue(null);
      await expect(service.getAttendanceEvent('ae1', actor)).rejects.toThrow(NotFoundException);
    });
  });

  describe('listAttendanceRecords', () => {
    it('returns paginated attendance records', async () => {
      prisma.attendanceRecord.count.mockResolvedValue(2);
      prisma.attendanceRecord.findMany.mockResolvedValue([{ id: 'ar1', employeeId: 'emp-a', workDate: new Date('2026-01-01'), status: 'COMPLETE', workMinutes: 480 }, { id: 'ar2', employeeId: 'emp-a', workDate: new Date('2026-01-02'), status: 'COMPLETE', workMinutes: 480 }]);
      const result = await service.listAttendanceRecords({ page: 1, limit: 10, skip: 0 } as any, actor);
      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });

    it('filters by work date', async () => {
      await service.listAttendanceRecords({ page: 1, limit: 10, skip: 0, workDate: '2026-01-01' } as any, actor);
      const where = prisma.attendanceRecord.findMany.mock.calls[0][0].where;
      expect(where.workDate).toBeDefined();
    });

    it('filters by status', async () => {
      await service.listAttendanceRecords({ page: 1, limit: 10, skip: 0, status: 'ABSENT' } as any, actor);
      const where = prisma.attendanceRecord.findMany.mock.calls[0][0].where;
      expect(where.status).toBe('ABSENT');
    });
  });

  describe('createAttendanceRecord', () => {
    it('creates attendance record', async () => {
      prisma.employee.findUnique.mockResolvedValue({ id: 'emp-a', companyId: 'company-a', deletedAt: null });
      prisma.attendanceRecord.findUnique.mockResolvedValue(null);
      prisma.attendanceRecord.create.mockResolvedValue({ id: 'ar1', employeeId: 'emp-a', workDate: new Date('2026-01-01'), status: 'COMPLETE', workMinutes: 480 });
      const result = await service.createAttendanceRecord({ employeeId: 'emp-a', workDate: '2026-01-01', firstIn: '08:00', lastOut: '16:00', workMinutes: 480, overtimeMinutes: 0, lateMinutes: 0, earlyLeaveMinutes: 0 } as any, actor);
      expect(result.employeeId).toBe('emp-a');
      expect(result.status).toBe('COMPLETE');
      expect(audit.record).toHaveBeenCalled();
    });

    it('rejects duplicate record for same date', async () => {
      prisma.employee.findUnique.mockResolvedValue({ id: 'emp-a', companyId: 'company-a', deletedAt: null });
      prisma.attendanceRecord.findUnique.mockResolvedValue({ id: 'ar1', employeeId: 'emp-a', workDate: new Date('2026-01-01') });
      await expect(service.createAttendanceRecord({ employeeId: 'emp-a', workDate: '2026-01-01' } as any, actor)).rejects.toThrow(ConflictException);
    });

    it('rejects record for non-existent employee', async () => {
      prisma.employee.findUnique.mockResolvedValue(null);
      await expect(service.createAttendanceRecord({ employeeId: 'emp-other', workDate: '2026-01-01' } as any, actor)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateAttendanceRecord', () => {
    it('updates attendance record', async () => {
      prisma.attendanceRecord.findUnique.mockResolvedValue({ id: 'ar1', employeeId: 'emp-a', workDate: new Date('2026-01-01'), status: 'INCOMPLETE', deletedAt: null });
      prisma.attendanceRecord.update.mockResolvedValue({ id: 'ar1', status: 'COMPLETE', workMinutes: 480 });
      const result = await service.updateAttendanceRecord('ar1', { status: 'COMPLETE', workMinutes: 480 } as any, actor);
      expect(result.status).toBe('COMPLETE');
    });

    it('rejects updating locked record', async () => {
      prisma.attendanceRecord.findUnique.mockResolvedValue({ id: 'ar1', employeeId: 'emp-a', workDate: new Date('2026-01-01'), status: 'COMPLETE', lockedAt: new Date(), deletedAt: null });
      await expect(service.updateAttendanceRecord('ar1', { workMinutes: 500 } as any, actor)).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteAttendanceRecord', () => {
    it('soft deletes attendance record', async () => {
      prisma.attendanceRecord.findUnique.mockResolvedValue({ id: 'ar1', employeeId: 'emp-a', workDate: new Date('2026-01-01'), status: 'COMPLETE', deletedAt: null });
      prisma.attendanceRecord.update.mockResolvedValue({ id: 'ar1', deletedAt: new Date() });
      const result = await service.deleteAttendanceRecord('ar1', actor);
      expect(result.success).toBe(true);
    });

    it('rejects deleting locked record', async () => {
      prisma.attendanceRecord.findUnique.mockResolvedValue({ id: 'ar1', employeeId: 'emp-a', workDate: new Date('2026-01-01'), status: 'COMPLETE', lockedAt: new Date(), deletedAt: null });
      await expect(service.deleteAttendanceRecord('ar1', actor)).rejects.toThrow(BadRequestException);
    });
  });

  describe('processDailyAttendance', () => {
    it('processes daily attendance for all employees', async () => {
      prisma.employee.findMany.mockResolvedValue([{ id: 'emp1', companyId: 'company-a', status: 'ACTIVE', deletedAt: null }]);
      prisma.attendanceRecord.findMany.mockResolvedValue([]);
      prisma.attendanceRecord.create.mockResolvedValue({ id: 'ar1', employeeId: 'emp1', workDate: new Date('2026-01-01'), status: 'ABSENT' });
      const result = await service.processDailyAttendance('company-a', new Date('2026-01-01'), actor);
      expect(result.processed).toBe(1);
      expect(result.absent).toBe(1);
      expect(audit.record).toHaveBeenCalled();
    });

    it('skips employees with existing records', async () => {
      prisma.employee.findMany.mockResolvedValue([{ id: 'emp1', companyId: 'company-a', status: 'ACTIVE', deletedAt: null }]);
      prisma.attendanceRecord.findMany.mockResolvedValue([{ id: 'ar1', employeeId: 'emp1', workDate: new Date('2026-01-01'), status: 'COMPLETE' }]);
      const result = await service.processDailyAttendance('company-a', new Date('2026-01-01'), actor);
      expect(result.processed).toBe(0);
      expect(result.skipped).toBe(1);
    });
  });

  describe('getAttendanceStats', () => {
    it('returns attendance statistics', async () => {
      prisma.attendanceRecord.groupBy.mockResolvedValue([{ status: 'COMPLETE', _count: { _all: 20 } }, { status: 'ABSENT', _count: { _all: 2 } }, { status: 'INCOMPLETE', _count: { _all: 1 } }]);
      const result = await service.getAttendanceStats({ fromDate: '2026-01-01', toDate: '2026-01-31', employeeId: 'emp-a' } as any, actor);
      expect(result.byStatus).toHaveLength(3);
      expect(result.total).toBe(23);
    });

    it('filters by employee', async () => {
      await service.getAttendanceStats({ fromDate: '2026-01-01', toDate: '2026-01-31', employeeId: 'emp-a' } as any, actor);
      expect(prisma.attendanceRecord.groupBy.mock.calls[0][0].where.employeeId).toBe('emp-a');
    });
  });

  describe('listAttendanceDevices', () => {
    it('returns paginated attendance devices', async () => {
      prisma.attendanceDevice.count.mockResolvedValue(2);
      prisma.attendanceDevice.findMany.mockResolvedValue([{ id: 'ad1', code: 'DEV-001', name: 'Main Entrance', deviceType: 'CARD_READER', isActive: true }, { id: 'ad2', code: 'DEV-002', name: 'Side Entrance', deviceType: 'CARD_READER', isActive: true }]);
      const result = await service.listAttendanceDevices({ page: 1, limit: 10, skip: 0 } as any, actor);
      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });

    it('filters by active status', async () => {
      await service.listAttendanceDevices({ page: 1, limit: 10, skip: 0, isActive: true } as any, actor);
      const where = prisma.attendanceDevice.findMany.mock.calls[0][0].where;
      expect(where.isActive).toBe(true);
    });
  });

  describe('createAttendanceDevice', () => {
    it('creates attendance device', async () => {
      prisma.attendanceDevice.findFirst.mockResolvedValue(null);
      prisma.attendanceDevice.create.mockResolvedValue({ id: 'ad1', code: 'DEV-003', name: 'Back Entrance', companyId: 'company-a', isActive: true });
      const result = await service.createAttendanceDevice({ code: 'DEV-003', name: 'Back Entrance', deviceType: 'CARD_READER', companyId: 'company-a', apiUrl: 'https://device.example.com/api', secret: 'device-secret' } as any, actor);
      expect(result.code).toBe('DEV-003');
      expect(result.companyId).toBe('company-a');
      expect(audit.record).toHaveBeenCalled();
    });

    it('rejects duplicate device code', async () => {
      prisma.attendanceDevice.findFirst.mockResolvedValue({ id: 'ad1', code: 'DEV-001', deletedAt: null });
      await expect(service.createAttendanceDevice({ code: 'DEV-001', name: 'Duplicate', deviceType: 'CARD_READER' } as any, actor)).rejects.toThrow(ConflictException);
    });
  });

  describe('syncAttendanceDevice', () => {
    it('syncs device events', async () => {
      prisma.attendanceDevice.findUnique.mockResolvedValue({ id: 'ad1', code: 'DEV-001', apiUrl: 'https://device.example.com/api', secret: 'device-secret', isActive: true, lastSyncAt: null });
      prisma.attendanceEvent.create.mockResolvedValue({ id: 'ae1', employeeId: 'emp-a', type: 'IN', eventTime: new Date('2026-01-01T08:00:00Z') });
      const result = await service.syncAttendanceDevice('ad1', actor);
      expect(result.synced).toBeGreaterThanOrEqual(0);
      expect(prisma.attendanceDevice.update).toHaveBeenCalledWith({ where: { id: 'ad1' }, data: { lastSyncAt: expect.any(Date) } });
      expect(audit.record).toHaveBeenCalled();
    });

    it('rejects sync for inactive device', async () => {
      prisma.attendanceDevice.findUnique.mockResolvedValue({ id: 'ad1', code: 'DEV-001', isActive: false });
      await expect(service.syncAttendanceDevice('ad1', actor)).rejects.toThrow(BadRequestException);
    });

    it('rejects sync for non-existent device', async () => {
      prisma.attendanceDevice.findUnique.mockResolvedValue(null);
      await expect(service.syncAttendanceDevice('ad1', actor)).rejects.toThrow(NotFoundException);
    });
  });
});