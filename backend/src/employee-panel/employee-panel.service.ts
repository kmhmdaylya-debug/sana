import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { NotificationService } from '../common/notifications/notification.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import {
  CheckInDto,
  PanelLeaveRequestDto,
  PanelMissionExpenseDto,
  PanelTaskResultDto,
} from './dto/employee-panel.dto';

const DAY = 86_400_000;

/**
 * پنل اختصاصی کارمند: همهٔ داده‌ها فقط مربوط به خودِ کاربر است
 * (پروندهٔ پرسنلی، پروژه‌های من، مرخصی، مأموریت، حقوق و حضور).
 */
@Injectable()
export class EmployeePanelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
  ) {}

  /** شناسهٔ پروندهٔ پرسنلی کاربر جاری (اجباری برای پنل) */
  private async requireEmployee(user: AuthenticatedUser): Promise<string> {
    if (!user.employeeId) {
      throw new ForbiddenException('برای این کاربر پروندهٔ پرسنلی تعریف نشده است.');
    }
    return user.employeeId;
  }

  private dateOnly(d: Date): Date {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  async myTasks(query: PaginationDto, user: AuthenticatedUser) {
    const employeeId = await this.requireEmployee(user);
    const where: Prisma.TaskWhereInput = {
      assignees: { some: { OR: [{ userId: user.id }, { employeeId }] } },
      OR: [
        { status: { not: 'DONE' } },
        { assignees: { some: { dismissedAt: null, OR: [{ userId: user.id }, { employeeId }] } } },
      ],
      ...(query.search ? { title: { contains: query.search, mode: 'insensitive' } } : {}),
    };
    const data = await this.prisma.task.findMany({
        where,
        orderBy: [{ status: 'asc' }, { dueDate: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }, { id: 'asc' }],
        select: { id: true, title: true, description: true, status: true, priority: true, dueDate: true, projectName: true, delayReason: true, category: true, retryStatus: true, retryRequestedAt: true },
    });
    // Stable partition keeps active work pinned without disturbing its deadline order.
    data.sort((a, b) => {
      const aPinned = a.status === 'IN_PROGRESS' && !a.delayReason;
      const bPinned = b.status === 'IN_PROGRESS' && !b.delayReason;
      return Number(bPinned) - Number(aPinned);
    });
    return { data, meta: { total: data.length, page: 1, limit: data.length, totalPages: 1 }, success: true };
  }

  async taskResult(taskId: string, dto: PanelTaskResultDto, user: AuthenticatedUser) {
    const employeeId = await this.requireEmployee(user);
    const reason = dto.reason?.trim();
    if (dto.result === 'UNABLE' && !reason) throw new BadRequestException('دلیل انجام نشدن کار را بنویسید.');
    const assignment = { taskId, OR: [{ userId: user.id }, { employeeId }] };
    const completed = dto.result === 'DONE';
    const task = await this.prisma.$transaction(async (tx) => {
      const before = await tx.task.findFirst({ where: { id: taskId, assignees: { some: assignment } } });
      if (!before) throw new ForbiddenException('این task به شما واگذار نشده است.');
      if (['CANCELLED', 'DONE'].includes(before.status)) throw new BadRequestException('نتیجهٔ این task قبلاً نهایی شده است.');
      if (before.delayReason && dto.result !== 'UNABLE') throw new BadRequestException('برای ادامهٔ این کار، ابتدا درخواست انجام دوباره را ثبت کنید و منتظر تأیید مدیر بمانید.');
      if (before.retryStatus === 'PENDING') throw new BadRequestException('درخواست انجام دوباره در انتظار بررسی مدیر است.');
      if (dto.result === 'START' && before.status === 'IN_PROGRESS' && !before.delayReason) {
        throw new BadRequestException('این کار قبلاً شروع شده است.');
      }
      const updated = await tx.task.updateMany({
        where: { id: taskId, status: before.status, delayReason: before.delayReason ?? null, retryStatus: before.retryStatus ?? null, assignees: { some: assignment } },
        data: { status: completed ? 'DONE' : 'IN_PROGRESS', delayReason: dto.result === 'UNABLE' ? reason : null, completedAt: completed ? new Date() : null, retryStatus: null, retryRequestedAt: null, retryRequestedById: null, ...(completed ? { progress: 100 } : {}) },
      });
      if (!updated.count) throw new BadRequestException('task تغییر کرده است؛ صفحه را تازه کنید.');
      await tx.taskAssignee.updateMany({ where: assignment, data: { completedAt: completed ? new Date() : null } });
      if (completed) await tx.taskAssignee.updateMany({ where: { taskId }, data: { dismissedAt: null } });
      const content = dto.result === 'START' ? (before.delayReason ? 'مشکل برطرف شد؛ کار از سر گرفته شد.' : 'کار شروع شد.') : completed ? 'کار انجام شد.' : `کار انجام نشد: ${reason}`;
      await tx.taskComment.create({ data: { taskId, authorId: user.id, content } });
      return before;
    });
    await this.audit.record(user.id, { action: AuditAction.UPDATE, entity: 'Task', entityId: taskId, before: { status: task.status, reason: task.delayReason }, after: { status: completed ? 'DONE' : 'IN_PROGRESS', result: dto.result, reason: dto.result === 'UNABLE' ? reason : null } });
    if (dto.result !== 'START' && task.createdById && task.createdById !== user.id) {
      await this.notifications.notify(task.createdById, { title: completed ? 'task انجام شد' : 'دلیل انجام نشدن task ثبت شد', body: `${task.title}${completed ? '' : `: ${reason}`}`, link: '/tasks' });
    }
    return { success: true };
  }

  async dismissTask(taskId: string, user: AuthenticatedUser) {
    const employeeId = await this.requireEmployee(user);
    const updated = await this.prisma.taskAssignee.updateMany({
      where: { taskId, OR: [{ userId: user.id }, { employeeId }], task: { status: 'DONE' } },
      data: { dismissedAt: new Date() },
    });
    if (!updated.count) throw new BadRequestException('فقط کار انجام‌شده و واگذارشده به خودتان قابل حذف از فهرست است.');
    return { success: true };
  }

  async requestRetry(taskId: string, user: AuthenticatedUser) {
    const employeeId = await this.requireEmployee(user);
    const assignment = { taskId, OR: [{ userId: user.id }, { employeeId }] };
    const before = await this.prisma.$transaction(async tx => {
      const task = await tx.task.findFirst({ where: { id: taskId, assignees: { some: assignment } } });
      if (!task) throw new ForbiddenException('این task به شما واگذار نشده است.');
      if (!task.delayReason || ['DONE', 'CANCELLED'].includes(task.status)) throw new BadRequestException('فقط برای کار انجام‌نشده می‌توانید درخواست انجام دوباره بدهید.');
      if (task.retryStatus === 'PENDING') throw new BadRequestException('درخواست قبلی هنوز در انتظار بررسی مدیر است.');
      const result = await tx.task.updateMany({
        where: { id: taskId, status: task.status, delayReason: task.delayReason, retryStatus: task.retryStatus ?? null, assignees: { some: assignment } },
        data: { retryStatus: 'PENDING', retryRequestedAt: new Date(), retryRequestedById: user.id },
      });
      if (!result.count) throw new BadRequestException('task تغییر کرده است؛ صفحه را تازه کنید.');
      await tx.taskComment.create({ data: { taskId, authorId: user.id, content: 'درخواست انجام دوبارهٔ کار برای مدیر ارسال شد.' } });
      return task;
    });
    await this.audit.record(user.id, { action: AuditAction.UPDATE, entity: 'Task', entityId: taskId, after: { retryStatus: 'PENDING' } });
    if (before.createdById && before.createdById !== user.id) {
      await this.notifications.notify(before.createdById, { title: 'درخواست انجام دوبارهٔ کار', body: before.title, link: '/tasks' });
    }
    return { success: true };
  }

  // =========================================================================
  // خلاصهٔ پنل
  // =========================================================================
  async summary(user: AuthenticatedUser) {
    const employeeId = await this.requireEmployee(user);
    const today = this.dateOnly(new Date());
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

    const [
      myProjects,
      openStages,
      attendedToday,
      monthAttendance,
      pendingLeaves,
      approvedLeaves,
      myMissions,
      lastPayslip,
      nextPayment,
      leaveBalance,
      contracts,
    ] = await Promise.all([
      this.prisma.projectMember.count({ where: { employeeId } }),
      this.prisma.projectTask.count({
        where: {
          assigneeId: employeeId,
          status: { notIn: ['DONE', 'CANCELLED'] },
        },
      }),
      this.prisma.projectAttendance.count({ where: { employeeId, workDate: today } }),
      this.prisma.attendanceRecord.aggregate({
        where: { employeeId, workDate: { gte: monthStart, lt: nextMonth } },
        _sum: { workMinutes: true, overtimeMinutes: true, lateMinutes: true, absenceMinutes: true },
        _count: { _all: true },
      }),
      this.prisma.leaveRequest.count({
        where: { employeeId, status: { in: ['SUBMITTED', 'PENDING_SUPERVISOR', 'PENDING_MANAGER', 'PENDING_HR'] } },
      }),
      this.prisma.leaveRequest.count({
        where: { employeeId, status: 'APPROVED', startAt: { gte: today } },
      }),
      this.prisma.mission.count({
        where: { employeeId, status: { in: ['REQUESTED', 'PENDING_APPROVAL', 'APPROVED', 'IN_PROGRESS'] } },
      }),
      this.prisma.payslip.findFirst({
        where: { employeeId },
        orderBy: [{ period: { year: 'desc' } }, { period: { month: 'desc' } }],
        include: { period: true },
      }),
      this.prisma.payslip.findFirst({
        where: { employeeId, publishedAt: { gte: today } },
        orderBy: { publishedAt: 'asc' },
        include: { period: true },
      }),
      this.prisma.leaveTransaction.aggregate({
        where: { employeeId, type: { in: ['GRANT', 'CONSUME', 'ADJUST'] } },
        _sum: { minutes: true },
      }),
      this.prisma.contract.count({
        where: { employeeId, status: { in: ['ACTIVE', 'EXPIRING'] } },
      }),
    ]);

    return {
      data: {
        myProjects,
        openStages,
        attendedToday,
        monthAttendance: {
          days: monthAttendance._count._all,
          workMinutes: monthAttendance._sum.workMinutes ?? 0,
          overtimeMinutes: monthAttendance._sum.overtimeMinutes ?? 0,
          lateMinutes: monthAttendance._sum.lateMinutes ?? 0,
          absenceMinutes: monthAttendance._sum.absenceMinutes ?? 0,
        },
        pendingLeaves,
        approvedLeaves,
        myMissions,
        leaveBalanceMinutes: leaveBalance._sum.minutes ?? 0,
        activeContracts: contracts,
        lastPayslip: lastPayslip
          ? {
              grossAmount: lastPayslip.grossAmount,
              deductionAmount: lastPayslip.deductionAmount,
              netAmount: lastPayslip.netAmount,
              status: lastPayslip.status,
              publishedAt: lastPayslip.publishedAt,
              period: { year: lastPayslip.period.year, month: lastPayslip.period.month, status: lastPayslip.period.status },
            }
          : null,
        nextPayment: nextPayment
          ? {
              netAmount: nextPayment.netAmount,
              publishedAt: nextPayment.publishedAt,
              period: { year: nextPayment.period.year, month: nextPayment.period.month },
            }
          : null,
      },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  // =========================================================================
  // پروژه‌های من + ثبت حضور روی مراحل
  // =========================================================================
  async myProjects(user: AuthenticatedUser) {
    const employeeId = await this.requireEmployee(user);
    const today = this.dateOnly(new Date());

    const projects = await this.prisma.project.findMany({
      where: {
        deletedAt: null,
        OR: [
          { members: { some: { employeeId } } },
          { managerId: employeeId },
          { tasks: { some: { assigneeId: employeeId } } },
        ],
      },
      orderBy: [{ status: 'asc' }, { startDate: 'asc' }],
      include: {
        manager: { select: { id: true, firstName: true, lastName: true } },
        members: {
          include: {
            employee: { select: { id: true, code: true, firstName: true, lastName: true } },
          },
        },
        tasks: {
          orderBy: { sortOrder: 'asc' },
          include: {
            assignee: { select: { id: true, firstName: true, lastName: true } },
            dependsOn: { select: { id: true, title: true } },
            attendance: {
              where: { employeeId },
              orderBy: { workDate: 'desc' },
            },
          },
        },
      },
    });

    return {
      data: projects.map((p) => ({
        ...p,
        tasks: p.tasks.map((t) => ({
          ...t,
          isMine: t.assigneeId === employeeId,
          attendedToday: t.attendance.some((a) => a.workDate.getTime() === today.getTime()),
          totalMinutes: t.attendance.reduce((s, a) => s + a.minutes, 0),
        })),
      })),
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  /** ثبت حضور روی یک مرحلهٔ پروژه (در طول روز قابل به‌روزرسانی است) */
  async checkIn(taskId: string, dto: CheckInDto, user: AuthenticatedUser) {
    const employeeId = await this.requireEmployee(user);
    const task = await this.prisma.projectTask.findUnique({
      where: { id: taskId },
      include: { project: { select: { id: true, title: true, members: true } } },
    });
    if (!task) throw new NotFoundException('مرحله یافت نشد.');

    const isMember = task.project.members.some((m) => m.employeeId === employeeId);
    if (task.assigneeId !== employeeId && !isMember) {
      throw new ForbiddenException('شما عضو این پروژه نیستید.');
    }

    const workDate = dto.workDate ? this.dateOnly(new Date(dto.workDate)) : this.dateOnly(new Date());
    const minutes = Math.max(0, Math.min(1440, dto.minutes ?? 480));

    const record = await this.prisma.projectAttendance.upsert({
      where: { taskId_employeeId_workDate: { taskId, employeeId, workDate } },
      update: { minutes, note: dto.note ?? null },
      create: { taskId, employeeId, workDate, minutes, note: dto.note ?? null },
    });

    // به‌روزرسانی پیشرفت مرحله بر اساس روزهای کارکردشده
    const attended = await this.prisma.projectAttendance.aggregate({
      where: { taskId },
      _sum: { minutes: true },
      _count: { _all: true },
    });
    const totalDays = Math.max(
      1,
      Math.round((task.endDate.getTime() - task.startDate.getTime()) / DAY) + 1,
    );
    const workedDays = attended._count._all;
    const progress = Math.min(100, Math.round((workedDays / totalDays) * 100));
    await this.prisma.projectTask.update({
      where: { id: taskId },
      data: { progress, status: progress >= 100 ? 'DONE' : workedDays > 0 ? 'IN_PROGRESS' : 'PENDING' },
    });

    await this.audit.record(
      user.id,
      {
        action: AuditAction.UPDATE,
        entity: 'ProjectTask',
        entityId: taskId,
        after: { minutes, workDate: workDate.toISOString(), progress },
      },
      { note: 'ثبت حضور روی مرحلهٔ پروژه' },
    );

    return { data: record, success: true, timestamp: new Date().toISOString() };
  }

  async myAttendance(user: AuthenticatedUser) {
    const employeeId = await this.requireEmployee(user);
    const from = new Date();
    from.setDate(1);
    from.setHours(0, 0, 0, 0);

    const [records, projectAttendance] = await Promise.all([
      this.prisma.attendanceRecord.findMany({
        where: { employeeId, workDate: { gte: from } },
        orderBy: { workDate: 'desc' },
      }),
      this.prisma.projectAttendance.findMany({
        where: { employeeId, workDate: { gte: from } },
        orderBy: { workDate: 'desc' },
        include: { task: { select: { id: true, title: true, project: { select: { title: true } } } } },
      }),
    ]);

    return {
      data: { records, projectAttendance },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  // =========================================================================
  // مرخصی
  // =========================================================================
  async myLeaves(user: AuthenticatedUser) {
    const employeeId = await this.requireEmployee(user);
    const rows = await this.prisma.leaveRequest.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'desc' },
      include: {
        leaveType: { select: { id: true, code: true, name: true, color: true } },
        events: { orderBy: { createdAt: 'asc' } },
      },
    });
    return { data: rows, success: true, timestamp: new Date().toISOString() };
  }

  async requestLeave(dto: PanelLeaveRequestDto, user: AuthenticatedUser) {
    const employeeId = await this.requireEmployee(user);
    const start = new Date(dto.startAt);
    const end = new Date(dto.endAt);
    if (end.getTime() < start.getTime()) {
      throw new BadRequestException('تاریخ پایان نمی‌تواند پیش از تاریخ شروع باشد.');
    }
    const leaveType = await this.prisma.leaveType.findFirst({
      where: { id: dto.leaveTypeId, isActive: true },
    });
    if (!leaveType) throw new NotFoundException('نوع مرخصی یافت نشد.');

    const overlapping = await this.prisma.leaveRequest.findFirst({
      where: {
        employeeId,
        status: { notIn: ['REJECTED', 'CANCELLED'] },
        startAt: { lte: end },
        endAt: { gte: start },
      },
    });
    if (overlapping) {
      throw new BadRequestException('در این بازه یک درخواست مرخصی فعال دارید.');
    }

    const minutes = Math.max(
      30,
      Math.round((end.getTime() - start.getTime()) / 60000) + (end.getHours() > start.getHours() ? 0 : 0),
    );

    const row = await this.prisma.leaveRequest.create({
      data: {
        employeeId,
        leaveTypeId: dto.leaveTypeId,
        startAt: start,
        endAt: end,
        durationMinutes: minutes,
        status: 'SUBMITTED',
        reason: dto.reason ?? null,
      },
      include: { leaveType: { select: { id: true, code: true, name: true, color: true } } },
    });

    await this.audit.record(user.id, {
      action: AuditAction.CREATE,
      entity: 'LeaveRequest',
      entityId: row.id,
      after: { startAt: start.toISOString(), endAt: end.toISOString(), leaveTypeId: dto.leaveTypeId },
    });

    // اطلاع‌رسانی به مدیر مستقیم و مدیر منابع انسانی
    const recipients = await this.prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        userRoles: { some: { role: { code: { in: ['HR_ADMIN', 'MANAGER'] } } } },
      },
      select: { id: true },
    });
    for (const r of recipients) {
      await this.notifications.notify(r.id, {
        type: 'REQUEST_RESULT',
        title: 'درخواست مرخصی جدید',
        body: `${row.leaveType.name} — از ${start.toLocaleDateString('fa-IR')} تا ${end.toLocaleDateString('fa-IR')}`,
        senderId: user.id,
      });
    }

    return { data: row, success: true, timestamp: new Date().toISOString() };
  }

  // =========================================================================
  // مأموریت‌ها
  // =========================================================================
  async myMissions(user: AuthenticatedUser) {
    const employeeId = await this.requireEmployee(user);
    const rows = await this.prisma.mission.findMany({
      where: { employeeId },
      orderBy: { startAt: 'desc' },
      include: {
        expenses: { orderBy: { spentAt: 'desc' } },
        orgUnit: { select: { id: true, name: true } },
      },
    });
    return { data: rows, success: true, timestamp: new Date().toISOString() };
  }

  async addMissionExpense(missionId: string, dto: PanelMissionExpenseDto, user: AuthenticatedUser) {
    const employeeId = await this.requireEmployee(user);
    const mission = await this.prisma.mission.findFirst({ where: { id: missionId, employeeId } });
    if (!mission) throw new NotFoundException('مأموریت یافت نشد.');

    const expense = await this.prisma.missionExpense.create({
      data: {
        missionId,
        description: dto.description,
        amount: BigInt(dto.amount),
        spentAt: dto.spentAt ? new Date(dto.spentAt) : new Date(),
        status: 'PENDING',
      },
    });
    return { data: expense, success: true, timestamp: new Date().toISOString() };
  }

  // =========================================================================
  // حقوق و دستمزد
  // =========================================================================
  async myPayslips(user: AuthenticatedUser) {
    const employeeId = await this.requireEmployee(user);
    const rows = await this.prisma.payslip.findMany({
      where: { employeeId },
      orderBy: [{ period: { year: 'desc' } }, { period: { month: 'desc' } }],
      include: { period: true },
    });
    // ریز اقلام حقوقی هر فیش (اقلام به دوره و نیرو گره خورده‌اند)
    const items = await this.prisma.payrollItem.findMany({
      where: {
        employeeId,
        periodId: { in: rows.map((r) => r.periodId) },
      },
      include: { component: { select: { code: true, name: true, type: true } } },
      orderBy: { component: { sortOrder: 'asc' } },
    });
    const itemsByPeriod = new Map<string, typeof items>();
    for (const item of items) {
      const list = itemsByPeriod.get(item.periodId) ?? [];
      list.push(item);
      itemsByPeriod.set(item.periodId, list);
    }

    return {
      data: rows.map((r) => ({ ...r, items: itemsByPeriod.get(r.periodId) ?? [] })),
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  /** زمان‌بندی پرداخت حقوق (دوره‌های جاری و آینده) */
  async paymentSchedule(user: AuthenticatedUser) {
    const employeeId = await this.requireEmployee(user);
    const today = new Date();
    const periods = await this.prisma.payrollPeriod.findMany({
      where: {
        status: { in: ['REVIEWED', 'LOCKED'] },
        OR: [{ items: { some: { employeeId } } }, { items: { none: {} } }],
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      take: 6,
    });
    const payslips = await this.prisma.payslip.findMany({
      where: { employeeId },
      orderBy: [{ period: { year: 'desc' } }, { period: { month: 'desc' } }],
      take: 12,
      include: { period: true },
    });
    return {
      data: {
        periods: periods.map((p) => ({
          id: p.id,
          year: p.year,
          month: p.month,
          status: p.status,
          generatedAt: p.generatedAt,
          lockedAt: p.lockedAt,
          publishedAt: p.lockedAt && p.status === 'LOCKED' ? p.lockedAt : null,
        })),
        payslips,
        today: today.toISOString(),
      },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  // =========================================================================
  // پروندهٔ من
  // =========================================================================
  async myProfile(user: AuthenticatedUser) {
    const employeeId = await this.requireEmployee(user);
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        position: { select: { id: true, title: true } },
        orgUnit: { select: { id: true, name: true } },
        contracts: {
          orderBy: { createdAt: 'desc' },
          include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
        },
        bankAccounts: { where: { isPrimary: true } },
        skills: { orderBy: { level: 'desc' } },
        dependents: true,
        documents: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } },
        shiftAssignments: {
          where: { workDate: { gte: new Date(Date.now() - 14 * DAY) } },
          orderBy: { workDate: 'desc' },
          include: { shift: { select: { id: true, name: true, startTime: true, endTime: true } } },
        },
      },
    });
    if (!employee) throw new NotFoundException('پروندهٔ پرسنلی یافت نشد.');

    const leaveBalances = await this.prisma.leaveTransaction.groupBy({
      by: ['leaveTypeId'],
      where: { employeeId, type: { in: ['GRANT', 'CONSUME', 'ADJUST'] } },
      _sum: { minutes: true },
    });
    const types = await this.prisma.leaveType.findMany({ where: { isActive: true } });
    const typeMap = new Map(types.map((t) => [t.id, t]));

    return {
      data: {
        ...employee,
        leaveBalances: leaveBalances.map((b) => ({
          leaveType: typeMap.get(b.leaveTypeId)
            ? {
                id: b.leaveTypeId,
                code: typeMap.get(b.leaveTypeId)!.code,
                name: typeMap.get(b.leaveTypeId)!.name,
                color: typeMap.get(b.leaveTypeId)!.color,
              }
            : { id: b.leaveTypeId },
          minutes: b._sum.minutes ?? 0,
        })),
      },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  /** فهرست انواع مرخصی برای فرم درخواست */
  async leaveTypes() {
    const rows = await this.prisma.leaveType.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    return { data: rows, success: true, timestamp: new Date().toISOString() };
  }

}
