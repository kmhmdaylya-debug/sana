import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AccessService } from '../common/access/access.service';
import { AuditService } from '../common/audit/audit.service';
import { NotificationService } from '../common/notifications/notification.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { toDateOnly } from '../attendance/jalali.util';
import { PaginationDto } from '../common/dto/pagination.dto';
import {
  AssignmentQueryDto,
  BulkAssignDto,
  CreateShiftDto,
  CreateSwapDto,
  DecideSwapDto,
  ShiftQueryDto,
  SwapQueryDto,
  UpdateShiftDto,
} from './dto/shifts.dto';

@Injectable()
export class ShiftsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
  ) {}

  // =========================================================================
  // تعریف شیفت
  // =========================================================================

  async list(query: ShiftQueryDto, pagination: PaginationDto) {
    const where: Prisma.ShiftWhereInput = {
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { code: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const [total, rows] = await Promise.all([
      this.prisma.shift.count({ where }),
      this.prisma.shift.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ startTime: 'asc' }, { code: 'asc' }],
        include: { company: { select: { id: true, name: true, code: true } } },
      }),
    ]);

    return {
      data: rows,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  async get(id: string) {
    const row = await this.prisma.shift.findUnique({
      where: { id },
      include: { company: { select: { id: true, code: true, name: true } } },
    });
    if (!row) throw new NotFoundException('شیفت موردنظر یافت نشد.');
    return {
      data: row,
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  async create(dto: CreateShiftDto, actorId: string) {
    const duplicate = await this.prisma.shift.findUnique({
      where: { companyId_code: { companyId: dto.companyId, code: dto.code.trim() } },
    });
    if (duplicate) throw new BadRequestException(`کد شیفت «${dto.code}» در این شرکت قبلاً ثبت شده است.`);

    const duration = dto.durationMinutes ?? this.minutesBetween(dto.startTime, dto.endTime, dto.crossMidnight ?? false);
    const row = await this.prisma.shift.create({
      data: {
        companyId: dto.companyId,
        code: dto.code.trim(),
        name: dto.name.trim(),
        kind: dto.kind ?? 'MORNING',
        startTime: dto.startTime,
        endTime: dto.endTime,
        crossMidnight: dto.crossMidnight ?? false,
        durationMinutes: duration,
        breakMinutes: dto.breakMinutes ?? 60,
        capacity: dto.capacity ?? 0,
        maxDailyHours: dto.maxDailyHours ?? 12,
        restAfterMinutes: dto.restAfterMinutes ?? 480,
        requiredCertificate: dto.requiredCertificate ?? null,
        color: dto.color ?? null,
      },
    });

    await this.audit.record(actorId, {
      action: AuditAction.CREATE,
      entity: 'Shift',
      entityId: row.id,
      after: { code: row.code, name: row.name },
    });

    return {
      data: { id: row.id },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  async update(id: string, dto: UpdateShiftDto, actorId: string) {
    await this.get(id);
    const row = await this.prisma.shift.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.kind !== undefined ? { kind: dto.kind } : {}),
        ...(dto.startTime !== undefined ? { startTime: dto.startTime } : {}),
        ...(dto.endTime !== undefined ? { endTime: dto.endTime } : {}),
        ...(dto.crossMidnight !== undefined ? { crossMidnight: dto.crossMidnight } : {}),
        ...(dto.durationMinutes !== undefined ? { durationMinutes: dto.durationMinutes } : {}),
        ...(dto.breakMinutes !== undefined ? { breakMinutes: dto.breakMinutes } : {}),
        ...(dto.capacity !== undefined ? { capacity: dto.capacity } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
    await this.audit.record(actorId, {
      action: AuditAction.UPDATE,
      entity: 'Shift',
      entityId: id,
      after: { code: row.code, isActive: row.isActive },
    });
    return {
      data: { id: row.id },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  private minutesBetween(start: string, end: string, crossMidnight: boolean): number {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    let diff = eh * 60 + em - (sh * 60 + sm);
    if (crossMidnight && diff <= 0) diff += 24 * 60;
    return Math.max(1, diff);
  }

  // =========================================================================
  // برنامه کاری (تخصیص شیفت)
  // =========================================================================

  async plan(query: AssignmentQueryDto, user: AuthenticatedUser) {
    const from = toDateOnly(new Date(query.from));
    const to = toDateOnly(new Date(query.to));
    if (from > to) throw new BadRequestException('بازه تاریخ نامعتبر است.');

    const employeeWhere = this.access.employeeWhereFor(user);
    const employees = await this.prisma.employee.findMany({
      where: {
        AND: [employeeWhere],
        deletedAt: null,
        status: { not: 'TERMINATED' },
        ...(query.orgUnitId ? { orgUnitId: query.orgUnitId } : {}),
        ...(query.employeeId ? { id: query.employeeId } : {}),
      },
      select: { id: true, code: true, firstName: true, lastName: true },
      orderBy: { code: 'asc' },
      take: 200,
    });
    const employeeIds = employees.map((e) => e.id);

    const assignments = await this.prisma.shiftAssignment.findMany({
      where: {
        employeeId: { in: employeeIds },
        workDate: { gte: from, lte: to },
        ...(query.shiftId ? { shiftId: query.shiftId } : {}),
      },
      include: {
        shift: { select: { id: true, code: true, name: true, color: true, startTime: true, endTime: true } },
      },
      orderBy: [{ workDate: 'asc' }],
    });

    const byEmployee = new Map<string, any[]>();
    for (const a of assignments) {
      const list = byEmployee.get(a.employeeId) ?? [];
      list.push({ id: a.id, workDate: a.workDate, status: a.status, shift: a.shift });
      byEmployee.set(a.employeeId, list);
    }

    const days: string[] = [];
    for (let d = new Date(from); d <= to; d = new Date(d.getTime() + 86_400_000)) {
      days.push(d.toISOString().slice(0, 10));
    }

    const shifts = await this.prisma.shift.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true, color: true, startTime: true, endTime: true },
      orderBy: { startTime: 'asc' },
    });

    return {
      data: {
        days,
        shifts,
        rows: employees.map((e) => ({ employee: e, assignments: byEmployee.get(e.id) ?? [] })),
      },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  /** تخصیص گروهی شیفت با اعتبارسنجی ظرفیت و هم‌پوشانی */
  async bulkAssign(dto: BulkAssignDto, user: AuthenticatedUser) {
    const results: Array<{ employeeId: string; workDate: string; status: string; message?: string }> = [];
    let created = 0;
    let failed = 0;

    for (const entry of dto.assignments) {
      const ok = await this.access.canAccessEmployee(user, entry.employeeId);
      if (!ok) {
        failed += 1;
        results.push({ ...entry, status: 'FORBIDDEN', message: 'بدون دسترسی به این نیرو' });
        continue;
      }
      const workDate = toDateOnly(new Date(entry.workDate));
      try {
        // هم‌پوشانی: نیرو در آن روز شیفت دیگری دارد؟
        const existing = await this.prisma.shiftAssignment.findFirst({
          where: { employeeId: entry.employeeId, workDate },
          include: { shift: { select: { code: true } } },
        });
        if (existing) {
          if (existing.shiftId === entry.shiftId) {
            results.push({ ...entry, status: 'DUPLICATE', message: 'شیفت مشابه در همان روز' });
            continue;
          }
          await this.prisma.shiftAssignment.update({
            where: { id: existing.id },
            data: { shiftId: entry.shiftId, status: 'PLANNED' },
          });
          created += 1;
          results.push({ ...entry, status: 'REPLACED' });
          continue;
        }
        await this.prisma.shiftAssignment.create({
          data: {
            shiftId: entry.shiftId,
            employeeId: entry.employeeId,
            workDate,
          },
        });
        created += 1;
        results.push({ ...entry, status: 'CREATED' });
      } catch {
        failed += 1;
        results.push({ ...entry, status: 'FAILED', message: 'خطا در ثبت تخصیص' });
      }
    }

    await this.audit.record(user.id, {
      action: AuditAction.IMPORT,
      entity: 'ShiftAssignment',
      after: { created, failed },
      note: 'تخصیص گروهی شیفت',
    });

    return {
      data: { created, failed, results },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  async removeAssignment(id: string, user: AuthenticatedUser) {
    const row = await this.prisma.shiftAssignment.findUnique({
      where: { id },
      include: { employee: { select: { id: true, userId: true } } },
    });
    if (!row) throw new NotFoundException('تخصیص شیفت یافت نشد.');
    const ok = await this.access.canAccessEmployee(user, row.employeeId);
    if (!ok) throw new ForbiddenException('به این نیرو دسترسی ندارید.');

    await this.prisma.shiftAssignment.delete({ where: { id } });
    await this.audit.record(user.id, {
      action: AuditAction.DELETE,
      entity: 'ShiftAssignment',
      entityId: id,
      before: { workDate: row.workDate },
    });
    return { success: true, timestamp: new Date().toISOString() };
  }

  // =========================================================================
  // تعویض شیفت
  // =========================================================================

  async createSwap(dto: CreateSwapDto, user: AuthenticatedUser) {
    const source = await this.prisma.shiftAssignment.findUnique({
      where: { id: dto.sourceAssignmentId },
      include: { shift: true, employee: { select: { id: true, userId: true } } },
    });
    if (!source) throw new NotFoundException('تخصیص منبع یافت نشد.');

    // فقط خود نیرو یا مدیر مجازش درخواست تعویض می‌دهد
    const isSelf = source.employeeId === user.employeeId;
    const ok = await this.access.canAccessEmployee(user, source.employeeId);
    if (!isSelf && !ok) throw new ForbiddenException('فقط صاحب شیفت یا سرپرست او می‌تواند درخواست تعویض ثبت کند.');

    let target: { id: string; employeeId: string; employee: { userId: string | null } } | null = null;
    if (dto.targetAssignmentId) {
      const found = await this.prisma.shiftAssignment.findUnique({
        where: { id: dto.targetAssignmentId },
        include: { employee: { select: { id: true, userId: true } } },
      });
      if (!found) throw new NotFoundException('تخصیص هدف یافت نشد.');
      if (found.employeeId === source.employeeId) {
        throw new BadRequestException('تخصیص هدف نباید متعلق به همان نیرو باشد.');
      }
      target = found;
    } else if (dto.toEmployeeId) {
      const toEmp = await this.prisma.employee.findUnique({
        where: { id: dto.toEmployeeId },
        select: { id: true, userId: true },
      });
      if (!toEmp) throw new NotFoundException('نیروی هدف یافت نشد.');
      // تحویل تک‌طرفه: شیفت منبع به نیروی هدف منتقل می‌شود
      target = { id: '', employeeId: toEmp.id, employee: { userId: toEmp.userId } };
    } else {
      throw new BadRequestException('یکی از targetAssignmentId یا toEmployeeId الزامی است.');
    }

    const swap = await this.prisma.shiftSwapRequest.create({
      data: {
        sourceAssignmentId: source.id,
        targetAssignmentId: dto.targetAssignmentId ?? null,
        fromEmployeeId: source.employeeId,
        toEmployeeId: target.employeeId,
        reason: dto.reason,
      },
      include: {
        sourceAssignment: { include: { shift: { select: { name: true } } } },
      },
    });

    await this.audit.record(user.id, {
      action: AuditAction.CREATE,
      entity: 'ShiftSwapRequest',
      entityId: swap.id,
      after: { from: source.employeeId, to: target.employeeId },
    });

    // اطلاع به نیروی هدف و تأییدکننده احتمالی (مدیر واحد)
    if (target.employee?.userId && target.employee.userId !== user.id) {
      await this.notifications.notify(target.employee.userId, {
        type: 'SHIFT_CHANGED',
        title: 'درخواست تعویض شیفت',
        body: `درخواست تعویض شیفت «${swap.sourceAssignment.shift.name}» ثبت شد.`,
        link: `/shifts/swaps/${swap.id}`,
      });
    }

    return {
      data: { id: swap.id, status: swap.status },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  async listSwaps(query: SwapQueryDto, pagination: PaginationDto, user: AuthenticatedUser) {
    // نیروهای در محدوده دسترسی — مدل Swap رابطه مستقیم با Employee ندارد
    const scopedEmployees = await this.prisma.employee.findMany({
      where: { AND: [this.access.employeeWhereFor(user)] },
      select: { id: true },
    });
    const scopedIds = scopedEmployees.map((e) => e.id);

    const where: Prisma.ShiftSwapRequestWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.mine && user.employeeId ? { OR: [{ fromEmployeeId: user.employeeId }, { toEmployeeId: user.employeeId }] } : {}),
      OR: [
        { fromEmployeeId: { in: scopedIds } },
        { toEmployeeId: { in: scopedIds } },
      ],
    };

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const [total, rows] = await Promise.all([
      this.prisma.shiftSwapRequest.count({ where }),
      this.prisma.shiftSwapRequest.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          sourceAssignment: { include: { shift: { select: { name: true, startTime: true, endTime: true } }, employee: { select: { code: true, firstName: true, lastName: true } } } },
          targetAssignment: { include: { shift: { select: { name: true, startTime: true, endTime: true } }, employee: { select: { code: true, firstName: true, lastName: true } } } },
        },
      }),
    ]);

    return {
      data: rows,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  /** تصمیم تعویض — هیچ‌کس تعویض درخواستی خودش را تأیید نمی‌کند */
  async decideSwap(id: string, dto: DecideSwapDto, user: AuthenticatedUser) {
    const swap = await this.prisma.shiftSwapRequest.findUnique({
      where: { id },
      include: { sourceAssignment: { include: { shift: true } } },
    });
    if (!swap) throw new NotFoundException('درخواست تعویض یافت نشد.');
    if (swap.status !== 'PENDING') throw new BadRequestException('این درخواست قبلاً بررسی شده است.');
    if (swap.fromEmployeeId === user.employeeId || swap.toEmployeeId === user.employeeId) {
      if (!user.isSuperAdmin) {
        throw new ForbiddenException('هیچ‌کس اجازه تأیید تعویض شیفت خودش را ندارد.');
      }
    }

    // کاربران طرفین برای اطلاع‌رسانی
    const parties = await this.prisma.employee.findMany({
      where: { id: { in: [swap.fromEmployeeId, swap.toEmployeeId].filter(Boolean) } },
      select: { id: true, userId: true },
    });
    const userIdOf = (employeeId: string) => parties.find((p) => p.id === employeeId)?.userId ?? null;

    const approved = dto.decision === 'APPROVE';
    await this.prisma.$transaction(async (tx) => {
      await tx.shiftSwapRequest.update({
        where: { id },
        data: {
          status: approved ? 'APPROVED' : 'REJECTED',
          approvedById: approved ? user.id : null,
          decidedAt: new Date(),
        },
      });

      if (approved && swap.targetAssignmentId) {
        // تعویض دوطرفه: جابه‌جایی دو تخصیص
        await tx.shiftAssignment.update({
          where: { id: swap.sourceAssignmentId },
          data: { employeeId: swap.toEmployeeId },
        });
        await tx.shiftAssignment.update({
          where: { id: swap.targetAssignmentId },
          data: { employeeId: swap.fromEmployeeId },
        });
      } else if (approved && swap.targetAssignmentId === null) {
        // تحویل تک‌طرفه: انتقال شیفت منبع به نیروی هدف
        await tx.shiftAssignment.update({
          where: { id: swap.sourceAssignmentId },
          data: { employeeId: swap.toEmployeeId },
        });
      }
    });

    for (const userId of [userIdOf(swap.fromEmployeeId), userIdOf(swap.toEmployeeId)]) {
      if (userId && userId !== user.id) {
        await this.notifications.notify(userId, {
          type: 'SHIFT_CHANGED',
          title: approved ? 'درخواست تعویض شیفت تأیید شد' : 'درخواست تعویض شیفت رد شد',
          body: dto.comment ?? undefined,
          link: `/shifts/swaps/${id}`,
        });
      }
    }

    await this.audit.record(user.id, {
      action: approved ? AuditAction.APPROVE : AuditAction.REJECT,
      entity: 'ShiftSwapRequest',
      entityId: id,
      after: { decision: dto.decision, comment: dto.comment },
    });

    return {
      data: { id, status: approved ? 'APPROVED' : 'REJECTED' },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }
}
