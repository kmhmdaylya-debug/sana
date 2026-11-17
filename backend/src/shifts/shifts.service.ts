import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AuditAction, Prisma, Shift } from "@prisma/client";
import { PrismaService } from "../common/prisma/prisma.service";
import { AccessService } from "../common/access/access.service";
import { AuditService } from "../common/audit/audit.service";
import { NotificationService } from "../common/notifications/notification.service";
import { AuthenticatedUser } from "../common/decorators/current-user.decorator";
import { toDateOnly, timeToMinutes } from "../attendance/jalali.util";
import { PaginationDto } from "../common/dto/pagination.dto";
import {
  AssignmentQueryDto,
  BulkAssignDto,
  CreateShiftDto,
  CreateSwapDto,
  DecideSwapDto,
  ShiftQueryDto,
  SwapQueryDto,
  UpdateShiftDto,
} from "./dto/shifts.dto";

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

  async list(
    query: ShiftQueryDto,
    pagination: PaginationDto,
    user: AuthenticatedUser,
  ) {
    const where: Prisma.ShiftWhereInput = {
      AND: [await this.access.companyWhereFor(user)],
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" } },
              { code: { contains: query.search, mode: "insensitive" } },
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
        orderBy: [{ startTime: "asc" }, { code: "asc" }],
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

  async get(id: string, user: AuthenticatedUser) {
    const row = await this.prisma.shift.findUnique({
      where: { id },
      include: { company: { select: { id: true, code: true, name: true } } },
    });
    if (!row) throw new NotFoundException("شیفت موردنظر یافت نشد.");
    await this.access.assertCompanyAccess(user, row.companyId);
    return {
      data: row,
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  async create(dto: CreateShiftDto, user: AuthenticatedUser) {
    const actorId = user.id;
    await this.access.assertCompanyAccess(user, dto.companyId);
    const duplicate = await this.prisma.shift.findUnique({
      where: {
        companyId_code: { companyId: dto.companyId, code: dto.code.trim() },
      },
    });
    if (duplicate)
      throw new BadRequestException(
        `کد شیفت «${dto.code}» در این شرکت قبلاً ثبت شده است.`,
      );

    const duration =
      dto.durationMinutes ??
      this.minutesBetween(
        dto.startTime,
        dto.endTime,
        dto.crossMidnight ?? false,
      );
    const row = await this.prisma.shift.create({
      data: {
        companyId: dto.companyId,
        code: dto.code.trim(),
        name: dto.name.trim(),
        kind: dto.kind ?? "MORNING",
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
      entity: "Shift",
      entityId: row.id,
      after: { code: row.code, name: row.name },
    });

    return {
      data: { id: row.id },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  async update(id: string, dto: UpdateShiftDto, user: AuthenticatedUser) {
    const actorId = user.id;
    await this.get(id, user);
    const row = await this.prisma.shift.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.kind !== undefined ? { kind: dto.kind } : {}),
        ...(dto.startTime !== undefined ? { startTime: dto.startTime } : {}),
        ...(dto.endTime !== undefined ? { endTime: dto.endTime } : {}),
        ...(dto.crossMidnight !== undefined
          ? { crossMidnight: dto.crossMidnight }
          : {}),
        ...(dto.durationMinutes !== undefined
          ? { durationMinutes: dto.durationMinutes }
          : {}),
        ...(dto.breakMinutes !== undefined
          ? { breakMinutes: dto.breakMinutes }
          : {}),
        ...(dto.capacity !== undefined ? { capacity: dto.capacity } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
    await this.audit.record(actorId, {
      action: AuditAction.UPDATE,
      entity: "Shift",
      entityId: id,
      after: { code: row.code, isActive: row.isActive },
    });
    return {
      data: { id: row.id },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  private minutesBetween(
    start: string,
    end: string,
    crossMidnight: boolean,
  ): number {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
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
    if (from > to) throw new BadRequestException("بازه تاریخ نامعتبر است.");

    const employeeWhere = this.access.employeeWhereFor(user);
    const employees = await this.prisma.employee.findMany({
      where: {
        AND: [employeeWhere],
        deletedAt: null,
        status: { not: "TERMINATED" },
        ...(query.orgUnitId ? { orgUnitId: query.orgUnitId } : {}),
        ...(query.employeeId ? { id: query.employeeId } : {}),
      },
      select: { id: true, code: true, firstName: true, lastName: true },
      orderBy: { code: "asc" },
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
        shift: {
          select: {
            id: true,
            code: true,
            name: true,
            color: true,
            startTime: true,
            endTime: true,
          },
        },
      },
      orderBy: [{ workDate: "asc" }],
    });

    const byEmployee = new Map<string, any[]>();
    for (const a of assignments) {
      const list = byEmployee.get(a.employeeId) ?? [];
      list.push({
        id: a.id,
        workDate: a.workDate,
        status: a.status,
        shift: a.shift,
      });
      byEmployee.set(a.employeeId, list);
    }

    const days: string[] = [];
    for (
      let d = new Date(from);
      d <= to;
      d = new Date(d.getTime() + 86_400_000)
    ) {
      days.push(d.toISOString().slice(0, 10));
    }

    const shifts = await this.prisma.shift.findMany({
      where: { isActive: true, AND: [await this.access.companyWhereFor(user)] },
      select: {
        id: true,
        code: true,
        name: true,
        color: true,
        startTime: true,
        endTime: true,
      },
      orderBy: { startTime: "asc" },
    });

    return {
      data: {
        days,
        shifts,
        rows: employees.map((e) => ({
          employee: e,
          assignments: byEmployee.get(e.id) ?? [],
        })),
      },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  /** تخصیص گروهی شیفت با اعتبارسنجی ظرفیت و هم‌پوشانی */
  async bulkAssign(dto: BulkAssignDto, user: AuthenticatedUser) {
    const results: Array<{
      employeeId: string;
      workDate: string;
      status: string;
      message?: string;
    }> = [];
    let created = 0;
    let failed = 0;

    for (const entry of dto.assignments) {
      const ok = await this.access.canAccessEmployee(user, entry.employeeId);
      if (!ok) {
        failed += 1;
        results.push({
          ...entry,
          status: "FORBIDDEN",
          message: "بدون دسترسی به این نیرو",
        });
        continue;
      }
      const workDate = new Date(`${entry.workDate}T00:00:00.000Z`);
      try {
        const status = await this.prisma.$transaction(
          async (db) => {
            await db.$queryRaw`SELECT id FROM "Employee" WHERE id = ${entry.employeeId}::uuid FOR UPDATE`;
            await db.$queryRaw`SELECT id FROM "Shift" WHERE id = ${entry.shiftId}::uuid FOR UPDATE`;
            const shift = await db.shift.findUnique({
              where: { id: entry.shiftId },
            });
            if (!shift || !shift.isActive)
              throw new BadRequestException("شیفت فعال یافت نشد.");
            await this.access.assertCompanyMember(user, shift.companyId, {
              employeeId: entry.employeeId,
            });
            const current = await db.shiftAssignment.findMany({
              where: { employeeId: entry.employeeId, workDate },
              include: { attendanceRecord: { select: { lockedAt: true } } },
            });
            if (current.length > 1)
              throw new BadRequestException(
                "این روز چند تخصیص دارد؛ ابتدا برنامه را اصلاح کنید.",
              );
            const existing = current[0];
            if (existing) {
              if (existing.shiftId === entry.shiftId) return "DUPLICATE";
              if (existing.attendanceRecord?.lockedAt)
                throw new BadRequestException("رکورد حضور این شیفت قفل است.");
              if (
                await db.shiftSwapRequest.count({
                  where: {
                    status: "PENDING",
                    OR: [
                      { sourceAssignmentId: existing.id },
                      { targetAssignmentId: existing.id },
                    ],
                  },
                })
              )
                throw new BadRequestException(
                  "برای این تخصیص درخواست تعویض در انتظار وجود دارد.",
                );
            }
            await this.assertAssignmentAllowed(
              db,
              entry.employeeId,
              shift,
              workDate,
              existing ? [existing.id] : [],
            );
            let assignmentId: string;
            if (existing) {
              await db.shiftAssignment.update({
                where: { id: existing.id },
                data: { shiftId: entry.shiftId, status: "PLANNED" },
              });
              assignmentId = existing.id;
            } else {
              const assignment = await db.shiftAssignment.create({
                data: {
                  shiftId: entry.shiftId,
                  employeeId: entry.employeeId,
                  workDate,
                },
              });
              assignmentId = assignment.id;
            }
            await this.audit.recordInTransaction(db, user.id, {
              action: existing ? AuditAction.UPDATE : AuditAction.CREATE,
              entity: "ShiftAssignment",
              entityId: assignmentId,
              after: { shiftId: shift.id, workDate },
            });
            return existing ? "REPLACED" : "CREATED";
          },
          { maxWait: 10000, timeout: 30000 },
        );
        if (status !== "DUPLICATE") created += 1;
        results.push({ ...entry, status });
      } catch (error) {
        failed += 1;
        results.push({
          ...entry,
          status: "FAILED",
          message:
            error instanceof BadRequestException
              ? error.message
              : "خطا در ثبت تخصیص",
        });
      }
    }

    await this.audit.record(user.id, {
      action: AuditAction.IMPORT,
      entity: "ShiftAssignment",
      after: { created, failed },
      note: "تخصیص گروهی شیفت",
    });

    return {
      data: { created, failed, results },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  private async assertAssignmentAllowed(
    db: Prisma.TransactionClient,
    employeeId: string,
    shift: Shift,
    workDate: Date,
    excludedIds: string[] = [],
  ) {
    if (!shift.isActive) throw new BadRequestException("شیفت غیرفعال است.");
    if (shift.durationMinutes > shift.maxDailyHours * 60)
      throw new BadRequestException("مدت شیفت از سقف ساعات روزانه بیشتر است.");
    const eligible = await db.employee.findFirst({
      where: {
        id: employeeId,
        companyId: shift.companyId,
        deletedAt: null,
        status: { not: "TERMINATED" },
      },
      select: { id: true },
    });
    if (!eligible)
      throw new BadRequestException("نیروی فعال متعلق به شرکت شیفت یافت نشد.");
    if (
      shift.requiredCertificate &&
      !(await db.certificate.findFirst({
        where: {
          employeeId,
          name: { equals: shift.requiredCertificate, mode: "insensitive" },
          AND: [
            { OR: [{ issueDate: null }, { issueDate: { lte: workDate } }] },
            { OR: [{ expiryDate: null }, { expiryDate: { gte: workDate } }] },
          ],
        },
        select: { id: true },
      }))
    ) {
      throw new BadRequestException(
        "گواهینامه معتبر موردنیاز شیفت موجود نیست.",
      );
    }
    if (shift.capacity > 0) {
      const count = await db.shiftAssignment.count({
        where: {
          shiftId: shift.id,
          workDate,
          id: { notIn: excludedIds },
          status: { not: "CANCELLED" },
        },
      });
      if (count >= shift.capacity)
        throw new BadRequestException("ظرفیت شیفت تکمیل است.");
    }
    const maxRest = await db.shift.aggregate({
      where: { companyId: shift.companyId },
      _max: { restAfterMinutes: true },
    });
    const window =
      (Math.ceil(
        Math.max(shift.restAfterMinutes, maxRest._max.restAfterMinutes ?? 0) /
          1440,
      ) +
        2) *
      86400000;
    const others = await db.shiftAssignment.findMany({
      where: {
        employeeId,
        id: { notIn: excludedIds },
        status: { not: "CANCELLED" },
        workDate: {
          gte: new Date(workDate.getTime() - window),
          lte: new Date(workDate.getTime() + window),
        },
      },
      include: { shift: true },
    });
    const candidate = this.shiftInterval(shift, workDate);
    for (const other of others) {
      if (other.workDate.getTime() === workDate.getTime())
        throw new BadRequestException("نیرو در این روز شیفت دیگری دارد.");
      const interval = this.shiftInterval(other.shift, other.workDate);
      const gap =
        candidate.start >= interval.end
          ? candidate.start - interval.end
          : interval.start - candidate.end;
      const requiredRest =
        candidate.start >= interval.end
          ? other.shift.restAfterMinutes
          : shift.restAfterMinutes;
      if (gap < requiredRest * 60000)
        throw new BadRequestException(
          "هم‌پوشانی یا فاصله استراحت ناکافی بین شیفت‌ها وجود دارد.",
        );
    }
  }

  private shiftInterval(shift: Shift, workDate: Date) {
    const start = workDate.getTime() + timeToMinutes(shift.startTime) * 60000;
    const end =
      workDate.getTime() +
      (timeToMinutes(shift.endTime) + (shift.crossMidnight ? 1440 : 0)) * 60000;
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      end <= start ||
      end - start > 86400000
    )
      throw new BadRequestException("بازه ساعت شیفت نامعتبر است.");
    return { start, end };
  }

  async removeAssignment(id: string, user: AuthenticatedUser) {
    return this.prisma.$transaction(
      async (db) => {
        const reference = await db.shiftAssignment.findUnique({
          where: { id },
          select: { employeeId: true },
        });
        if (!reference) throw new NotFoundException("تخصیص یافت نشد.");
        await db.$queryRaw`SELECT id FROM "Employee" WHERE id = ${reference.employeeId}::uuid FOR UPDATE`;

        const row = await db.shiftAssignment.findUnique({
          where: { id },
          include: {
            employee: { select: { id: true, userId: true } },
            attendanceRecord: { select: { lockedAt: true } },
          },
        });
        if (!row) throw new NotFoundException("تخصیص شیفت یافت نشد.");
        if (row.employeeId !== reference.employeeId)
          throw new BadRequestException(
            "تخصیص تغییر کرده است؛ دوباره تلاش کنید.",
          );
        if (row.attendanceRecord?.lockedAt)
          throw new BadRequestException("رکورد حضور این شیفت قفل است.");
        if (
          await db.shiftSwapRequest.count({
            where: {
              status: "PENDING",
              OR: [{ sourceAssignmentId: id }, { targetAssignmentId: id }],
            },
          })
        )
          throw new BadRequestException(
            "این تخصیص دارای درخواست تعویض در انتظار است.",
          );
        const ok = await this.access.canAccessEmployee(user, row.employeeId);
        if (!ok) throw new ForbiddenException("به این نیرو دسترسی ندارید.");

        await db.shiftAssignment.delete({ where: { id } });
        await this.audit.recordInTransaction(db, user.id, {
          action: AuditAction.DELETE,
          entity: "ShiftAssignment",
          entityId: id,
          before: { workDate: row.workDate },
        });
        return { success: true, timestamp: new Date().toISOString() };
      },
      { maxWait: 10000, timeout: 30000 },
    );
  }

  // =========================================================================
  // تعویض شیفت
  // =========================================================================

  async createSwap(dto: CreateSwapDto, user: AuthenticatedUser) {
    const source = await this.prisma.shiftAssignment.findUnique({
      where: { id: dto.sourceAssignmentId },
      include: {
        shift: true,
        employee: { select: { id: true, userId: true } },
      },
    });
    if (!source) throw new NotFoundException("تخصیص منبع یافت نشد.");

    // فقط خود نیرو یا مدیر مجازش درخواست تعویض می‌دهد
    const isSelf = source.employeeId === user.employeeId;
    const ok = await this.access.canAccessEmployee(user, source.employeeId);
    if (!isSelf && !ok)
      throw new ForbiddenException(
        "فقط صاحب شیفت یا سرپرست او می‌تواند درخواست تعویض ثبت کند.",
      );

    let target: {
      id: string;
      employeeId: string;
      employee: { userId: string | null };
    } | null = null;
    if (dto.targetAssignmentId) {
      const found = await this.prisma.shiftAssignment.findUnique({
        where: { id: dto.targetAssignmentId },
        include: { employee: { select: { id: true, userId: true } } },
      });
      if (!found) throw new NotFoundException("تخصیص هدف یافت نشد.");
      await this.access.assertCompanyMember(user, source.shift.companyId, {
        employeeId: found.employeeId,
      });
      const targetShift = await this.prisma.shift.findUnique({
        where: { id: found.shiftId },
      });
      if (targetShift?.companyId !== source.shift.companyId)
        throw new BadRequestException("شرکت شیفت‌های تعویض باید یکسان باشد.");
      if (found.employeeId === source.employeeId) {
        throw new BadRequestException(
          "تخصیص هدف نباید متعلق به همان نیرو باشد.",
        );
      }
      target = found;
    } else if (dto.toEmployeeId) {
      const toEmp = await this.prisma.employee.findUnique({
        where: { id: dto.toEmployeeId },
        select: { id: true, userId: true },
      });
      if (!toEmp) throw new NotFoundException("نیروی هدف یافت نشد.");
      await this.access.assertCompanyMember(user, source.shift.companyId, {
        employeeId: toEmp.id,
      });
      if (toEmp.id === source.employeeId)
        throw new BadRequestException("نیروی هدف باید متفاوت باشد.");
      // تحویل تک‌طرفه: شیفت منبع به نیروی هدف منتقل می‌شود
      target = {
        id: "",
        employeeId: toEmp.id,
        employee: { userId: toEmp.userId },
      };
    } else {
      throw new BadRequestException(
        "یکی از targetAssignmentId یا toEmployeeId الزامی است.",
      );
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
      entity: "ShiftSwapRequest",
      entityId: swap.id,
      after: { from: source.employeeId, to: target.employeeId },
    });

    // اطلاع به نیروی هدف و تأییدکننده احتمالی (مدیر واحد)
    if (target.employee?.userId && target.employee.userId !== user.id) {
      await this.notifications.notify(target.employee.userId, {
        type: "SHIFT_CHANGED",
        title: "درخواست تعویض شیفت",
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

  async listSwaps(
    query: SwapQueryDto,
    pagination: PaginationDto,
    user: AuthenticatedUser,
  ) {
    // نیروهای در محدوده دسترسی — مدل Swap رابطه مستقیم با Employee ندارد
    const scopedEmployees = await this.prisma.employee.findMany({
      where: { AND: [this.access.employeeWhereFor(user)] },
      select: { id: true },
    });
    const scopedIds = scopedEmployees.map((e) => e.id);

    const where: Prisma.ShiftSwapRequestWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.mine
        ? {
            AND: [
              {
                OR: [
                  { fromEmployeeId: user.employeeId ?? { in: [] } },
                  { toEmployeeId: user.employeeId ?? { in: [] } },
                ],
              },
            ],
          }
        : {}),
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
        orderBy: { createdAt: "desc" },
        include: {
          sourceAssignment: {
            include: {
              shift: { select: { name: true, startTime: true, endTime: true } },
              employee: {
                select: { code: true, firstName: true, lastName: true },
              },
            },
          },
          targetAssignment: {
            include: {
              shift: { select: { name: true, startTime: true, endTime: true } },
              employee: {
                select: { code: true, firstName: true, lastName: true },
              },
            },
          },
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
  async decideSwap(
    id: string,
    dto: DecideSwapDto,
    user: AuthenticatedUser,
    transaction?: Prisma.TransactionClient,
  ) {
    const run = async (tx: Prisma.TransactionClient) => {
      await tx.$queryRaw`SELECT id FROM "ShiftSwapRequest" WHERE id = ${id}::uuid FOR UPDATE`;
      const swap = await tx.shiftSwapRequest.findUnique({
        where: { id },
        include: { sourceAssignment: { include: { shift: true } } },
      });
      if (!swap) throw new NotFoundException("درخواست تعویض یافت نشد.");
      await this.access.assertCompanyMember(
        user,
        swap.sourceAssignment.shift.companyId,
        { employeeId: swap.fromEmployeeId },
      );
      await this.access.assertCompanyMember(
        user,
        swap.sourceAssignment.shift.companyId,
        { employeeId: swap.toEmployeeId },
      );
      if (swap.status !== "PENDING")
        throw new BadRequestException("این درخواست قبلاً بررسی شده است.");
      if (
        swap.fromEmployeeId === user.employeeId ||
        swap.toEmployeeId === user.employeeId
      ) {
        if (!user.isSuperAdmin) {
          throw new ForbiddenException(
            "هیچ‌کس اجازه تأیید تعویض شیفت خودش را ندارد.",
          );
        }
      }

      // کاربران طرفین برای اطلاع‌رسانی
      const parties = await tx.employee.findMany({
        where: {
          id: { in: [swap.fromEmployeeId, swap.toEmployeeId].filter(Boolean) },
        },
        select: { id: true, userId: true },
      });
      const userIdOf = (employeeId: string) =>
        parties.find((p) => p.id === employeeId)?.userId ?? null;

      const approved = dto.decision === "APPROVE";
      await tx.$queryRaw`SELECT id FROM "Employee" WHERE id IN (${swap.fromEmployeeId}::uuid, ${swap.toEmployeeId}::uuid) ORDER BY id FOR UPDATE`;
      const assignmentIds = [
        swap.sourceAssignmentId,
        ...(swap.targetAssignmentId ? [swap.targetAssignmentId] : []),
      ];
      await tx.$queryRaw`SELECT id FROM "ShiftAssignment" WHERE id::text IN (${Prisma.join(assignmentIds)}) ORDER BY id FOR UPDATE`;
      const source = await tx.shiftAssignment.findUniqueOrThrow({
        where: { id: swap.sourceAssignmentId },
      });
      const target = swap.targetAssignmentId
        ? await tx.shiftAssignment.findUnique({
            where: { id: swap.targetAssignmentId },
          })
        : null;
      if (
        source.employeeId !== swap.fromEmployeeId ||
        (swap.targetAssignmentId && target?.employeeId !== swap.toEmployeeId)
      )
        throw new BadRequestException(
          "تخصیص‌ها تغییر کرده‌اند؛ درخواست تازه ثبت کنید.",
        );
      if (target) {
        const targetShift = await tx.shift.findUniqueOrThrow({
          where: { id: target.shiftId },
        });
        if (targetShift.companyId !== swap.sourceAssignment.shift.companyId)
          throw new BadRequestException("شرکت شیفت‌ها یکسان نیست.");
      }
      await tx.shiftSwapRequest.update({
        where: { id },
        data: {
          status: approved ? "APPROVED" : "REJECTED",
          approvedById: approved ? user.id : null,
          decidedAt: new Date(),
        },
      });

      const sameShiftAndDay =
        target &&
        source.shiftId === target.shiftId &&
        source.workDate.getTime() === target.workDate.getTime();
      if (approved && !sameShiftAndDay) {
        const sourceShift = await tx.shift.findUniqueOrThrow({
          where: { id: source.shiftId },
        });
        await this.assertAssignmentAllowed(
          tx,
          swap.toEmployeeId,
          sourceShift,
          source.workDate,
          assignmentIds,
        );
        if (target) {
          const targetShift = await tx.shift.findUniqueOrThrow({
            where: { id: target.shiftId },
          });
          await this.assertAssignmentAllowed(
            tx,
            swap.fromEmployeeId,
            targetShift,
            target.workDate,
            assignmentIds,
          );
        }
      }
      if (approved && swap.targetAssignmentId && !sameShiftAndDay) {
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
      for (const userId of [
        userIdOf(swap.fromEmployeeId),
        userIdOf(swap.toEmployeeId),
      ]) {
        if (userId && userId !== user.id) {
          await tx.notification.create({
            data: {
              userId,
              status: "SENT",
              type: "SHIFT_CHANGED",
              title: approved
                ? "درخواست تعویض شیفت تأیید شد"
                : "درخواست تعویض شیفت رد شد",
              link: `/shifts/swaps/${id}`,
            },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: approved ? AuditAction.APPROVE : AuditAction.REJECT,
          entity: "ShiftSwapRequest",
          entityId: id,
          after: JSON.stringify({ decision: dto.decision }),
        },
      });

      return {
        data: { id, status: approved ? "APPROVED" : "REJECTED" },
        success: true,
        timestamp: new Date().toISOString(),
      };
    };
    return transaction
      ? run(transaction)
      : this.prisma.$transaction(run, { maxWait: 10000, timeout: 30000 });
  }
}
