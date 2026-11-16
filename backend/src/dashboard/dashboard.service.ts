import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ContractStatus,
  EmployeeStatus,
  LeaveRequestStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AccessService } from '../common/access/access.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { DailyAttendanceService } from '../attendance/daily-attendance.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly daily: DailyAttendanceService,
  ) {}

  async teamWork(user: AuthenticatedUser) {
    const scope = this.access.employeeWhereFor(user);
    const employees = user.scope.unrestricted || user.isSuperAdmin ? [] : await this.prisma.employee.findMany({
      where: { AND: [scope], deletedAt: null }, select: { id: true },
    });
    const where: Prisma.TaskWhereInput = user.scope.unrestricted || user.isSuperAdmin ? {} : {
      OR: [
        { createdById: user.id },
        { assignees: { some: { OR: [{ userId: user.id }, { employeeId: { in: employees.map((employee) => employee.id) } }] } } },
        ...(user.scope.companyIds.length ? [{ companyId: { in: user.scope.companyIds } }] : []),
      ],
    };
    const data = await this.prisma.task.findMany({
      where, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      select: {
        id: true, title: true, description: true, status: true, dueDate: true, delayReason: true,
        category: true, retryStatus: true, retryRequestedAt: true, retryRequester: { select: { fullName: true } },
        createdAt: true, completedAt: true, createdBy: { select: { fullName: true } },
        assignees: { select: { user: { select: { fullName: true } }, employee: { select: { firstName: true, lastName: true } } } },
        comments: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { id: true, content: true, createdAt: true, author: { select: { fullName: true } } } },
      },
    });
    return { data, success: true };
  }

  async todayAttendance(user: AuthenticatedUser) {
    const scope = this.access.employeeWhereFor(user);
    if (scope.id === '__none__') return this.daily.teamStatus([]);
    const employees = await this.prisma.employee.findMany({ where: { AND: [scope], deletedAt: null, status: 'ACTIVE' }, select: { id: true } });
    return this.daily.teamStatus(employees.map((employee) => employee.id));
  }

  /** داشبورد شخصی هر کاربر */
  async myDashboard(user: AuthenticatedUser) {
    const employeeWhere = this.access.employeeWhereFor(user);
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from.getTime() + 86_400_000);

    const [unreadNotifications, myLeaves, myTasks, mySwaps] = await Promise.all([
      this.prisma.notification.count({ where: { userId: user.id, readAt: null } }),
      user.employeeId
        ? this.prisma.leaveRequest.count({
            where: { employeeId: user.employeeId, status: { in: [...PENDING_STATUSES, LeaveRequestStatus.APPROVED] } },
          })
        : Promise.resolve(0),
      user.employeeId
        ? this.prisma.task.count({
            where: { assignees: { some: { employeeId: user.employeeId } }, status: { not: 'DONE' } },
          })
        : Promise.resolve(0),
      user.employeeId
        ? this.prisma.shiftSwapRequest.count({
            where: {
              OR: [{ fromEmployeeId: user.employeeId }, { toEmployeeId: user.employeeId }],
              status: 'PENDING',
            },
          })
        : Promise.resolve(0),
    ]);

    return {
      data: {
        unreadNotifications,
        myActiveLeaves: myLeaves,
        myOpenTasks: myTasks,
        myPendingSwaps: mySwaps,
      },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  /** داشبورد مدیریتی با شمارش‌های کلیدی (محدود به حوزه دسترسی) */
  async managementDashboard(user: AuthenticatedUser) {
    const scope = this.access.employeeWhereFor(user);
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from.getTime() + 86_400_000);

    // نیروهای در محدوده دسترسی — برای فیلترهایی که relation ندارند
    const scopedEmployees = await this.prisma.employee.findMany({
      where: { AND: [scope] },
      select: { id: true },
    });
    const scopedEmployeeIds = scopedEmployees.map((e) => e.id);

    const expiringTo = new Date();
    expiringTo.setDate(expiringTo.getDate() + 30);

    const [
      totalEmployees,
      activeEmployees,
      pendingLeaves,
      pendingCorrections,
      pendingMissions,
      pendingSwaps,
      expiringContracts,
      absentToday,
      openTasks,
      pendingLoans,
    ] = await Promise.all([
      this.prisma.employee.count({ where: { deletedAt: null, AND: [scope] } }),
      this.prisma.employee.count({ where: { deletedAt: null, status: EmployeeStatus.ACTIVE, AND: [scope] } }),
      this.prisma.leaveRequest.count({ where: { status: { in: PENDING_STATUSES }, employee: scope } }),
      this.prisma.attendanceCorrection.count({ where: { status: 'PENDING', employee: scope } }),
      this.prisma.mission.count({
        where: { status: { in: ['REQUESTED', 'PENDING_APPROVAL'] as never }, employee: scope },
      }),
      this.prisma.shiftSwapRequest.count({
        where: {
          status: 'PENDING',
          OR: [{ fromEmployeeId: { in: scopedEmployeeIds } }, { toEmployeeId: { in: scopedEmployeeIds } }],
        },
      }),
      this.prisma.contract.count({
        where: {
          deletedAt: null,
          status: { in: [ContractStatus.ACTIVE, ContractStatus.EXPIRING] },
          employee: scope,
          versions: { some: { endDate: { gte: from, lte: expiringTo } } },
        },
      }),
      this.prisma.attendanceRecord.count({
        where: { workDate: { gte: from, lt: to }, status: 'ABSENT', employee: scope },
      }),
      this.prisma.task.count({ where: { status: { notIn: ['DONE', 'CANCELLED'] as never } } }),
      this.prisma.loan.count({ where: { status: 'PENDING_APPROVAL', employee: scope } }),
    ]);

    // توزیع نیروها بر اساس وضعیت
    const byStatus = await this.prisma.employee.groupBy({
      by: ['status'],
      where: { deletedAt: null, AND: [scope] },
      _count: { _all: true },
    });

    // آمار حضور ماه جاری
    const monthFrom = new Date();
    monthFrom.setDate(1);
    monthFrom.setHours(0, 0, 0, 0);
    const attendanceAgg = await this.prisma.attendanceRecord.aggregate({
      where: { workDate: { gte: monthFrom }, employee: scope },
      _sum: { workMinutes: true, overtimeMinutes: true, lateMinutes: true },
      _count: { _all: true },
    });

    return {
      data: {
        employees: { total: totalEmployees, active: activeEmployees },
        byStatus: byStatus.map((s) => ({ status: s.status, count: s._count._all })),
        pending: {
          leaves: pendingLeaves,
          corrections: pendingCorrections,
          missions: pendingMissions,
          swaps: pendingSwaps,
          loans: pendingLoans,
        },
        expiringContracts,
        absentToday,
        openTasks,
        monthAttendance: {
          records: attendanceAgg._count._all,
          workMinutes: attendanceAgg._sum.workMinutes ?? 0,
          overtimeMinutes: attendanceAgg._sum.overtimeMinutes ?? 0,
          lateMinutes: attendanceAgg._sum.lateMinutes ?? 0,
        },
      },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  /** نمودار مرخصی‌های آخرین ۶ ماه (برای نمودار داشبورد) */
  async leaveTrend(user: AuthenticatedUser) {
    const from = new Date();
    from.setMonth(from.getMonth() - 6);
    const rows = await this.prisma.leaveRequest.groupBy({
      by: ['status'],
      where: {
        startAt: { gte: from },
        employee: this.access.employeeWhereFor(user),
      },
      _count: { _all: true },
    });

    return {
      data: rows.map((r) => ({ status: r.status, count: r._count._all })),
      success: true,
      timestamp: new Date().toISOString(),
    };
  }
}

const PENDING_STATUSES: LeaveRequestStatus[] = [
  LeaveRequestStatus.SUBMITTED,
  LeaveRequestStatus.PENDING_SUPERVISOR,
  LeaveRequestStatus.PENDING_MANAGER,
  LeaveRequestStatus.PENDING_HR,
];
