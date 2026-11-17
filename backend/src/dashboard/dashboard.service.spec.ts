import { DashboardService } from './dashboard.service';
import { AccessService } from '../common/access/access.service';
import { DailyAttendanceService } from '../attendance/daily-attendance.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

const manager = {
  id: 'manager-a', username: 'manager.a', fullName: 'Test Manager', email: 'manager@test.com',
  mobile: null, isSuperAdmin: false, employeeId: 'emp-manager', roleIds: [], roleCodes: [],
  permissions: ['dashboard.view.management', 'dashboard.view'],
  scope: { unrestricted: false, companyIds: ['company-a'], branchIds: [], orgUnitIds: [], employeeIds: [], ownEmployeeId: 'emp-manager' },
} as unknown as AuthenticatedUser;

const employee = {
  id: 'emp-a', username: 'emp.a', fullName: 'Test Employee', email: 'emp@test.com',
  mobile: null, isSuperAdmin: false, employeeId: 'emp-a', roleIds: [], roleCodes: [],
  permissions: ['dashboard.view'],
  scope: { unrestricted: false, companyIds: ['company-a'], branchIds: [], orgUnitIds: [], employeeIds: [], ownEmployeeId: 'emp-a' },
} as unknown as AuthenticatedUser;

describe('DashboardService', () => {
  let prisma: any;
  let access: any;
  let daily: any;
  let service: DashboardService;

  beforeEach(() => {
    prisma = {
      employee: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), groupBy: jest.fn().mockResolvedValue([]) },
      task: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
      leaveRequest: { count: jest.fn().mockResolvedValue(0) },
      attendanceCorrection: { count: jest.fn().mockResolvedValue(0) },
      mission: { count: jest.fn().mockResolvedValue(0) },
      shiftSwapRequest: { count: jest.fn().mockResolvedValue(0) },
      contract: { count: jest.fn().mockResolvedValue(0) },
      attendanceRecord: { count: jest.fn().mockResolvedValue(0), aggregate: jest.fn().mockResolvedValue({ _count: { _all: 0 }, _sum: { workMinutes: 0, overtimeMinutes: 0, lateMinutes: 0 } }) },
      loan: { count: jest.fn().mockResolvedValue(0) },
      notification: { count: jest.fn().mockResolvedValue(0) },
      $transaction: jest.fn(work => work(prisma)),
    };
    access = { employeeWhereFor: jest.fn().mockResolvedValue({}) };
    daily = { teamStatus: jest.fn().mockResolvedValue({ present: 0, absent: 0, total: 0 }) };
    service = new DashboardService(prisma, access, daily);
  });

  describe('teamWork', () => {
    it('returns team work items for manager', async () => {
      prisma.task.findMany.mockResolvedValue([{ id: 't1', title: 'Task 1', status: 'NEW', createdById: 'manager-a' }]);
      const result = await service.teamWork(manager);
      expect(result.data).toHaveLength(1);
      expect(result.success).toBe(true);
    });

    it('filters by manager scope', async () => {
      await service.teamWork(manager);
      expect(prisma.task.findMany.mock.calls[0][0].where).toBeDefined();
    });

    it('returns empty for unrestricted super admin', async () => {
      const superAdmin = { ...manager, isSuperAdmin: true, scope: { ...manager.scope, unrestricted: true } };
      await service.teamWork(superAdmin);
      expect(prisma.task.findMany.mock.calls[0][0].where).toEqual({});
    });
  });

  describe('todayAttendance', () => {
    it('returns today attendance for scoped employees', async () => {
      prisma.employee.findMany.mockResolvedValue([{ id: 'emp1' }, { id: 'emp2' }]);
      daily.teamStatus.mockResolvedValue({ present: 2, absent: 0, total: 2 });
      const result = await service.todayAttendance(manager);
      expect(result.present).toBe(2);
      expect(result.total).toBe(2);
    });

    it('returns empty for no scoped employees', async () => {
      access.employeeWhereFor.mockResolvedValue({ id: '__none__' });
      const result = await service.todayAttendance(manager);
      expect(daily.teamStatus).toHaveBeenCalledWith([]);
    });
  });

  describe('myDashboard', () => {
    it('returns personal dashboard for employee', async () => {
      prisma.notification.count.mockResolvedValue(3);
      prisma.leaveRequest.count.mockResolvedValue(1);
      prisma.task.count.mockResolvedValue(2);
      prisma.shiftSwapRequest.count.mockResolvedValue(1);
      const result = await service.myDashboard(employee);
      expect(result.data.unreadNotifications).toBe(3);
      expect(result.data.myActiveLeaves).toBe(1);
      expect(result.data.myOpenTasks).toBe(2);
      expect(result.data.myPendingSwaps).toBe(1);
    });

    it('returns zeros for user without employee profile', async () => {
      const noEmployee = { ...employee, employeeId: null };
      prisma.notification.count.mockResolvedValue(0);
      const result = await service.myDashboard(noEmployee);
      expect(result.data.myActiveLeaves).toBe(0);
      expect(result.data.myOpenTasks).toBe(0);
      expect(result.data.myPendingSwaps).toBe(0);
    });
  });

  describe('managementDashboard', () => {
    it('returns management dashboard for manager', async () => {
      prisma.employee.count.mockResolvedValue(10);
      prisma.employee.count.mockResolvedValueOnce(10).mockResolvedValueOnce(8);
      prisma.leaveRequest.count.mockResolvedValue(3);
      prisma.attendanceCorrection.count.mockResolvedValue(2);
      prisma.mission.count.mockResolvedValue(1);
      prisma.shiftSwapRequest.count.mockResolvedValue(2);
      prisma.contract.count.mockResolvedValue(5);
      prisma.attendanceRecord.count.mockResolvedValue(0);
      prisma.task.count.mockResolvedValue(10);
      prisma.loan.count.mockResolvedValue(1);
      prisma.employee.groupBy.mockResolvedValue([{ status: 'ACTIVE', _count: { _all: 8 } }, { status: 'ON_LEAVE', _count: { _all: 2 } }]);
      prisma.attendanceRecord.aggregate.mockResolvedValue({ _count: { _all: 20 }, _sum: { workMinutes: 9600, overtimeMinutes: 480, lateMinutes: 120 } });
      const result = await service.managementDashboard(manager);
      expect(result.data.employees.total).toBe(10);
      expect(result.data.employees.active).toBe(8);
      expect(result.data.pending.leaves).toBe(3);
      expect(result.data.pending.corrections).toBe(2);
      expect(result.data.monthAttendance.records).toBe(20);
    });

    it('filters by manager scope', async () => {
      await service.managementDashboard(manager);
      expect(prisma.employee.count).toHaveBeenCalled();
      expect(access.employeeWhereFor).toHaveBeenCalledWith(manager);
    });

    it('rejects non-manager access', async () => {
      const nonManager = { ...employee, permissions: [] };
      await expect(service.managementDashboard(nonManager)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('leaveTrend', () => {
    it('returns leave trend for last 6 months', async () => {
      prisma.leaveRequest.groupBy.mockResolvedValue([{ status: 'APPROVED', _count: { _all: 5 } }, { status: 'PENDING_SUPERVISOR', _count: { _all: 2 } }]);
      const result = await service.leaveTrend(manager);
      expect(result.data).toHaveLength(2);
      expect(result.data[0].status).toBe('APPROVED');
      expect(result.data[0].count).toBe(5);
    });

    it('filters by manager scope', async () => {
      await service.leaveTrend(manager);
      expect(prisma.leaveRequest.groupBy.mock.calls[0][0].where.employee).toBeDefined();
    });
  });

  describe('employeeWhereFor edge cases', () => {
    it('handles unrestricted user', async () => {
      const superAdmin = { ...manager, isSuperAdmin: true, scope: { ...manager.scope, unrestricted: true } };
      access.employeeWhereFor.mockResolvedValue({});
      await service.teamWork(superAdmin);
      expect(access.employeeWhereFor).toHaveBeenCalledWith(superAdmin);
    });

    it('handles user with no scope', async () => {
      const noScope = { ...employee, scope: { ...employee.scope, companyIds: [], branchIds: [], orgUnitIds: [], employeeIds: [] } };
      access.employeeWhereFor.mockResolvedValue({ id: { in: [] } });
      await service.todayAttendance(noScope);
      expect(access.employeeWhereFor).toHaveBeenCalledWith(noScope);
    });
  });
});