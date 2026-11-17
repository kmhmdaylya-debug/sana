import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  LeaveRequestStatus,
  LeaveTransactionType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AccessService } from '../common/access/access.service';
import { AuditService } from '../common/audit/audit.service';
import { NotificationService } from '../common/notifications/notification.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { jalaliToGregorian } from '../attendance/jalali.util';
import { PaginationDto } from '../common/dto/pagination.dto';
import {
  AdjustBalanceDto,
  CreateLeavePolicyDto,
  CreateLeaveRequestDto,
  CreateLeaveTypeDto,
  DecideLeaveRequestDto,
  LeaveBalanceQueryDto,
  LeaveRequestQueryDto,
  LeaveTransactionQueryDto,
  LeaveTypeQueryDto,
  UpdateLeaveTypeDto,
} from './dto/leaves.dto';

/** وضعیت‌هایی که درخواست در آن‌ها قابل تصمیم است */
const DECIDABLE: LeaveRequestStatus[] = [
  LeaveRequestStatus.SUBMITTED,
  LeaveRequestStatus.PENDING_SUPERVISOR,
  LeaveRequestStatus.PENDING_MANAGER,
  LeaveRequestStatus.PENDING_HR,
];

@Injectable()
export class LeavesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
  ) {}

  // =========================================================================
  // انواع مرخصی
  // =========================================================================

  async listTypes(query: LeaveTypeQueryDto, pagination: PaginationDto, user: AuthenticatedUser) {
    let employeeCompanyId: string | undefined;
    if (query.employeeId) {
      await this.access.assertEmployeeAccess(user, query.employeeId);
      employeeCompanyId = (await this.prisma.employee.findUniqueOrThrow({ where: { id: query.employeeId }, select: { companyId: true } })).companyId;
    }
    const where: Prisma.LeaveTypeWhereInput = {
      AND: [await this.access.companyWhereFor(user), ...(employeeCompanyId ? [{ companyId: employeeCompanyId }] : [])],
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    };
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const [total, rows] = await Promise.all([
      this.prisma.leaveType.count({ where }),
      this.prisma.leaveType.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: 'asc' },
        include: { company: { select: { id: true, code: true, name: true } } },
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

  async createType(dto: CreateLeaveTypeDto, user: AuthenticatedUser) {
    const actorId = user.id;
    await this.access.assertCompanyAccess(user, dto.companyId);
    const duplicate = await this.prisma.leaveType.findUnique({
      where: { companyId_code: { companyId: dto.companyId, code: dto.code } },
    });
    if (duplicate) throw new BadRequestException('نوع مرخصی با همین کد قبلاً ثبت شده است.');

    const row = await this.prisma.leaveType.create({
      data: {
        companyId: dto.companyId,
        code: dto.code,
        name: dto.name.trim(),
        isPaid: dto.isPaid ?? true,
        annualQuotaMinutes: dto.annualQuotaMinutes ?? 0,
        carryoverLimitMinutes: dto.carryoverLimitMinutes ?? 0,
        monthlyGrantMinutes: dto.monthlyGrantMinutes ?? 0,
        maxDailyMinutes: dto.maxDailyMinutes ?? 480,
        requiresDocument: dto.requiresDocument ?? false,
        color: dto.color ?? null,
      },
    });
    await this.audit.record(actorId, {
      action: AuditAction.CREATE,
      entity: 'LeaveType',
      entityId: row.id,
      after: { code: row.code, name: row.name },
    });
    return {
      data: { id: row.id },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  async updateType(id: string, dto: UpdateLeaveTypeDto, user: AuthenticatedUser) {
    const actorId = user.id;
    const type = await this.prisma.leaveType.findUnique({ where: { id } });
    if (!type) throw new NotFoundException('نوع مرخصی یافت نشد.');
    await this.access.assertCompanyAccess(user, type.companyId);
    const row = await this.prisma.leaveType.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.isPaid !== undefined ? { isPaid: dto.isPaid } : {}),
        ...(dto.annualQuotaMinutes !== undefined ? { annualQuotaMinutes: dto.annualQuotaMinutes } : {}),
        ...(dto.carryoverLimitMinutes !== undefined ? { carryoverLimitMinutes: dto.carryoverLimitMinutes } : {}),
        ...(dto.monthlyGrantMinutes !== undefined ? { monthlyGrantMinutes: dto.monthlyGrantMinutes } : {}),
        ...(dto.maxDailyMinutes !== undefined ? { maxDailyMinutes: dto.maxDailyMinutes } : {}),
        ...(dto.requiresDocument !== undefined ? { requiresDocument: dto.requiresDocument } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
    await this.audit.record(actorId, {
      action: AuditAction.UPDATE,
      entity: 'LeaveType',
      entityId: id,
      after: { code: row.code, isActive: row.isActive },
    });
    return {
      data: { id: row.id },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  // =========================================================================
  // سیاست مرخصی
  // =========================================================================

  async listPolicies(leaveTypeId: string, user: AuthenticatedUser) {
    const type = await this.prisma.leaveType.findUnique({ where: { id: leaveTypeId } });
    if (!type) throw new NotFoundException('نوع مرخصی یافت نشد.');
    await this.access.assertCompanyAccess(user, type.companyId);
    const rows = await this.prisma.leavePolicy.findMany({
      where: { leaveTypeId },
      orderBy: { employmentType: 'asc' },
    });
    return {
      data: rows,
      meta: { total: rows.length, page: 1, limit: rows.length, totalPages: 1, hasNext: false, hasPrev: false },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  async upsertPolicy(dto: CreateLeavePolicyDto, user: AuthenticatedUser) {
    const actorId = user.id;
    const type = await this.prisma.leaveType.findUnique({ where: { id: dto.leaveTypeId } });
    if (!type) throw new NotFoundException('نوع مرخصی یافت نشد.');
    await this.access.assertCompanyAccess(user, type.companyId);

    const row = await this.prisma.leavePolicy.upsert({
      where: { leaveTypeId_employmentType: { leaveTypeId: dto.leaveTypeId, employmentType: dto.employmentType } },
      create: {
        leaveTypeId: dto.leaveTypeId,
        employmentType: dto.employmentType,
        minSeniorityMonths: dto.minSeniorityMonths ?? 0,
        monthlyGrantMinutes: dto.monthlyGrantMinutes ?? 0,
        annualQuotaMinutes: dto.annualQuotaMinutes ?? 0,
      },
      update: {
        minSeniorityMonths: dto.minSeniorityMonths ?? 0,
        monthlyGrantMinutes: dto.monthlyGrantMinutes ?? 0,
        annualQuotaMinutes: dto.annualQuotaMinutes ?? 0,
      },
    });
    await this.audit.record(actorId, {
      action: AuditAction.UPDATE,
      entity: 'LeavePolicy',
      entityId: row.id,
      after: { employmentType: dto.employmentType },
    });
    return {
      data: { id: row.id },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  // =========================================================================
  // درخواست مرخصی
  // =========================================================================

  async listRequests(query: LeaveRequestQueryDto, pagination: PaginationDto, user: AuthenticatedUser) {
    const where: Prisma.LeaveRequestWhereInput = {
      employee: this.access.employeeWhereFor(user),
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.leaveTypeId ? { leaveTypeId: query.leaveTypeId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.mine && user.employeeId ? { employeeId: user.employeeId } : {}),
      ...(query.from || query.to
        ? {
            AND: [
              ...(query.from ? [{ startAt: { gte: new Date(`${query.from}T00:00:00.000Z`) } }] : []),
              ...(query.to ? [{ startAt: { lte: new Date(`${query.to}T23:59:59.999Z`) } }] : []),
            ],
          }
        : {}),
    };

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const [total, rows] = await Promise.all([
      this.prisma.leaveRequest.count({ where }),
      this.prisma.leaveRequest.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          employee: { select: { id: true, code: true, firstName: true, lastName: true } },
          leaveType: { select: { id: true, name: true, code: true, color: true, isPaid: true } },
          events: { orderBy: { createdAt: 'asc' }, take: 5 },
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

  /** ثبت و ارسال درخواست مرخصی */
  async createRequest(dto: CreateLeaveRequestDto, user: AuthenticatedUser) {
    return this.prisma.$transaction(async (db) => {
    // Employee locking serializes overlap checks, balance reservations and decisions.
    await this.access.assertEmployeeAccess(user, dto.employeeId);
    await db.$queryRaw`SELECT id FROM "Employee" WHERE id = ${dto.employeeId}::uuid FOR UPDATE`;
    const start = new Date(dto.startAt);
    const end = new Date(dto.endAt);
    if (start >= end) throw new BadRequestException('زمان پایان مرخصی باید بعد از شروع باشد.');

    const employee = await db.employee.findFirst({
      where: { id: dto.employeeId, deletedAt: null, AND: [this.access.employeeWhereFor(user)] },
      include: { user: { select: { id: true } } },
    });
    if (!employee) throw new NotFoundException('نیروی موردنظر یافت نشد.');

    const leaveType = await db.leaveType.findUnique({ where: { id: dto.leaveTypeId } });
    if (!leaveType || !leaveType.isActive) throw new NotFoundException('نوع مرخصی یافت نشد یا غیرفعال است.');
    if (leaveType.companyId !== employee.companyId) throw new BadRequestException('نوع مرخصی متعلق به شرکت این نیرو نیست.');

    const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60_000);
    if (durationMinutes > leaveType.maxDailyMinutes * 30) {
      throw new BadRequestException('طول مرخصی بیش از حد مجاز (۳۰ روز) است.');
    }

    // هم‌پوشانی با درخواست فعال دیگر
    const overlap = await db.leaveRequest.findFirst({
      where: {
        employeeId: dto.employeeId,
        status: { in: [...DECIDABLE, LeaveRequestStatus.APPROVED] },
        startAt: { lt: end },
        endAt: { gt: start },
      },
      select: { id: true },
    });
    if (overlap) throw new BadRequestException('برای این بازه درخواست مرخصی فعال دیگری وجود دارد.');

    // بررسی مانده برای انواع دارای سهمیه
    const balance = await this.balanceOf(dto.employeeId, dto.leaveTypeId, this.jalaliYear(start), db);
    if (leaveType.annualQuotaMinutes > 0 && durationMinutes > balance.remaining) {
      throw new BadRequestException(
        `مانده مرخصی کافی نیست (مانده: ${Math.round(balance.remaining / 60)} ساعت)`,
      );
    }

    const request = await db.leaveRequest.create({
      data: {
        employeeId: dto.employeeId,
        leaveTypeId: dto.leaveTypeId,
        startAt: start,
        endAt: end,
        durationMinutes,
        reason: dto.reason ?? null,
        status: LeaveRequestStatus.PENDING_SUPERVISOR,
        events: {
          create: {
            action: 'SUBMIT',
            fromStatus: LeaveRequestStatus.DRAFT,
            toStatus: LeaveRequestStatus.PENDING_SUPERVISOR,
            actorId: user.id,
          },
        },
      },
    });

    // رزرو موقت مانده
    await db.leaveTransaction.create({
      data: {
        employeeId: dto.employeeId,
        leaveTypeId: dto.leaveTypeId,
        type: LeaveTransactionType.RESERVE,
        minutes: durationMinutes,
        sourceType: 'LeaveRequest',
        sourceId: request.id,
        occurredAt: start,
        note: 'رزرو برای درخواست مرخصی',
        createdById: user.id,
      },
    });

    await this.audit.recordInTransaction(db, user.id, {
      action: AuditAction.CREATE,
      entity: 'LeaveRequest',
      entityId: request.id,
      after: { employeeId: dto.employeeId, durationMinutes },
    });

    if (employee.userId && employee.userId !== user.id) {
      await db.notification.create({ data: { userId: employee.userId, type: 'REQUEST_RESULT', status: 'SENT', title: 'درخواست مرخصی ثبت شد', link: `/leaves/${request.id}` } });
    }

    return {
      data: { id: request.id, status: request.status, durationMinutes },
      success: true,
      timestamp: new Date().toISOString(),
    };
    }, { maxWait: 10000, timeout: 30000 });
  }

  async getRequest(id: string, user: AuthenticatedUser) {
    const request = await this.prisma.leaveRequest.findFirst({
      where: { id, employee: this.access.employeeWhereFor(user) },
      include: {
        employee: { select: { id: true, code: true, firstName: true, lastName: true } },
        leaveType: true,
        events: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!request) throw new NotFoundException('درخواست مرخصی یافت نشد.');
    return {
      data: request,
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  /** تصمیم روی درخواست — قاعده سرور: هیچ‌کس درخواست خودش را تأیید نمی‌کند */
  async decide(id: string, dto: DecideLeaveRequestDto, user: AuthenticatedUser, transaction?: Prisma.TransactionClient) {
    const run = async (tx: Prisma.TransactionClient) => {
    const reference = await tx.leaveRequest.findUnique({ where: { id }, select: { employeeId: true } });
    if (!reference) throw new NotFoundException('درخواست مرخصی یافت نشد.');
    await this.access.assertEmployeeAccess(user, reference.employeeId);
    await tx.$queryRaw`SELECT id FROM "Employee" WHERE id = ${reference.employeeId}::uuid FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "LeaveRequest" WHERE id = ${id}::uuid FOR UPDATE`;
    const request = await tx.leaveRequest.findUnique({
      where: { id },
      include: {
        employee: { select: { id: true, userId: true, code: true, firstName: true, lastName: true } },
        leaveType: true,
      },
    });
    if (!request) throw new NotFoundException('درخواست مرخصی یافت نشد.');
    if (!DECIDABLE.includes(request.status)) {
      throw new BadRequestException('این درخواست در مرحله قابل تصمیم نیست.');
    }
    if (request.employeeId === user.employeeId && !user.isSuperAdmin) {
      throw new ForbiddenException('هیچ‌کس اجازه تأیید مرخصی خودش را ندارد.');
    }

    const toStatus =
      dto.decision === 'APPROVE'
        ? LeaveRequestStatus.APPROVED
        : dto.decision === 'REJECT'
          ? LeaveRequestStatus.REJECTED
          : LeaveRequestStatus.NEEDS_REVISION;

      await tx.leaveRequest.update({
        where: { id },
        data: { status: toStatus, decidedAt: new Date() },
      });
      await tx.leaveRequestEvent.create({
        data: {
          requestId: id,
          action: dto.decision,
          fromStatus: request.status,
          toStatus,
          actorId: user.id,
          comment: dto.comment ?? null,
        },
      });

      // رد یا نیاز به اصلاح → آزادسازی رزرو؛ تأیید → تبدیل رزرو به مصرف
      const reserve = await tx.leaveTransaction.findFirst({
        where: { sourceId: id, type: LeaveTransactionType.RESERVE },
      });
      if (reserve) {
        if (toStatus === LeaveRequestStatus.APPROVED) {
          await tx.leaveTransaction.create({
            data: {
              employeeId: request.employeeId,
              leaveTypeId: request.leaveTypeId,
              type: LeaveTransactionType.CONSUME,
              minutes: request.durationMinutes,
              sourceType: 'LeaveRequest',
              sourceId: id,
              occurredAt: reserve.occurredAt,
              note: 'مصرف مرخصی تأییدشده',
              createdById: user.id,
            },
          });
          await tx.leaveTransaction.delete({ where: { id: reserve.id } });
        } else {
          await tx.leaveTransaction.delete({ where: { id: reserve.id } });
        }
      }
    if (request.employee.userId) {
      await tx.notification.create({ data: {
        userId: request.employee.userId,
        status: 'SENT',
        type: 'REQUEST_RESULT',
        title:
          toStatus === LeaveRequestStatus.APPROVED
            ? 'درخواست مرخصی تأیید شد'
            : toStatus === LeaveRequestStatus.REJECTED
              ? 'درخواست مرخصی رد شد'
              : 'درخواست مرخصی نیاز به اصلاح دارد',
        link: `/leaves/${id}`,
      } });
    }

    await this.audit.recordInTransaction(tx, user.id, {
      action: toStatus === LeaveRequestStatus.APPROVED ? AuditAction.APPROVE : AuditAction.REJECT,
      entity: 'LeaveRequest',
      entityId: id,
      after: { status: toStatus },
    });

    return {
      data: { id, status: toStatus },
      success: true,
      timestamp: new Date().toISOString(),
    };
    };
    return transaction ? run(transaction) : this.prisma.$transaction(run, { maxWait: 10000, timeout: 30000 });
  }

  /** لغو درخواست توسط درخواست‌دهنده (قبل از تأیید) */
  async cancel(id: string, user: AuthenticatedUser, transaction?: Prisma.TransactionClient) {
    const run = async (tx: Prisma.TransactionClient) => {
    const reference = await tx.leaveRequest.findUnique({ where: { id }, select: { employeeId: true } });
    if (!reference) throw new NotFoundException('درخواست مرخصی یافت نشد.');
    await this.access.assertEmployeeAccess(user, reference.employeeId);
    await tx.$queryRaw`SELECT id FROM "Employee" WHERE id = ${reference.employeeId}::uuid FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "LeaveRequest" WHERE id = ${id}::uuid FOR UPDATE`;
    const request = await tx.leaveRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('درخواست مرخصی یافت نشد.');
    const ok = await this.access.canAccessEmployee(user, request.employeeId);
    if (!ok) throw new ForbiddenException('به این درخواست دسترسی ندارید.');
    const undecidable: LeaveRequestStatus[] = [
      LeaveRequestStatus.APPROVED,
      LeaveRequestStatus.CANCELLED,
      LeaveRequestStatus.REJECTED,
    ];
    if (undecidable.includes(request.status)) {
      throw new BadRequestException('این درخواست قابل لغو نیست.');
    }
    if (request.employeeId === user.employeeId || user.isSuperAdmin || user.permissions.includes('leaves.approve')) {
      // مجاز
    } else {
      throw new ForbiddenException('فقط درخواست‌دهنده یا سرپرست می‌تواند لغو کند.');
    }

      await tx.leaveRequest.update({
        where: { id },
        data: { status: LeaveRequestStatus.CANCELLED, decidedAt: new Date() },
      });
      await tx.leaveRequestEvent.create({
        data: {
          requestId: id,
          action: 'CANCEL',
          fromStatus: request.status,
          toStatus: LeaveRequestStatus.CANCELLED,
          actorId: user.id,
        },
      });
      const reserve = await tx.leaveTransaction.findFirst({
        where: { sourceId: id, type: LeaveTransactionType.RESERVE },
      });
      if (reserve) await tx.leaveTransaction.delete({ where: { id: reserve.id } });
    await this.audit.recordInTransaction(tx, user.id, {
      action: AuditAction.CANCEL,
      entity: 'LeaveRequest',
      entityId: id,
      before: { status: request.status },
    });

    return {
      data: { id, status: LeaveRequestStatus.CANCELLED },
      success: true,
      timestamp: new Date().toISOString(),
    };
    };
    return transaction ? run(transaction) : this.prisma.$transaction(run, { maxWait: 10000, timeout: 30000 });
  }

  // =========================================================================
  // مانده و تراکنش‌ها
  // =========================================================================

  /** مانده مرخصی نیرو برای یک نوع در سال جاری */
  private jalaliYear(date = new Date()): number {
    return Number(new Intl.DateTimeFormat('en-US-u-ca-persian', { year: 'numeric', timeZone: 'Asia/Tehran' }).formatToParts(date).find(p => p.type === 'year')!.value);
  }

  private async balanceOf(employeeId: string, leaveTypeId: string, jalaliYear: number, db: Prisma.TransactionClient = this.prisma) {
    // ابتدای سال شمسی
    const yearStart = jalaliToGregorian(jalaliYear, 1, 1);
    const from = new Date(Date.UTC(yearStart.getFullYear(), yearStart.getMonth(), yearStart.getDate()));
    const next = jalaliToGregorian(jalaliYear + 1, 1, 1);
    const to = new Date(Date.UTC(next.getFullYear(), next.getMonth(), next.getDate()) - 1);

    const granted = await db.leaveTransaction.aggregate({
      where: {
        employeeId,
        leaveTypeId,
        occurredAt: { gte: from, lte: to },
        type: { in: [LeaveTransactionType.GRANT, LeaveTransactionType.REFUND, LeaveTransactionType.TRANSFER, LeaveTransactionType.RELEASE] },
      },
      _sum: { minutes: true },
    });
    const consumed = await db.leaveTransaction.aggregate({
      where: {
        employeeId,
        leaveTypeId,
        occurredAt: { gte: from, lte: to },
        type: { in: [LeaveTransactionType.CONSUME, LeaveTransactionType.RESERVE, LeaveTransactionType.EXPIRE] },
      },
      _sum: { minutes: true },
    });
    const adjusted = await db.leaveTransaction.aggregate({
      where: {
        employeeId,
        leaveTypeId,
        occurredAt: { gte: from, lte: to },
        type: LeaveTransactionType.ADJUST,
      },
      _sum: { minutes: true },
    });

    const total = (granted._sum.minutes ?? 0) + (adjusted._sum.minutes ?? 0);
    const used = consumed._sum.minutes ?? 0;
    return { total, used, remaining: total - used, yearStart: from, yearEnd: to };
  }

  async balance(query: LeaveBalanceQueryDto, user: AuthenticatedUser) {
    const ok = await this.access.canAccessEmployee(user, query.employeeId);
    if (!ok) throw new ForbiddenException('به مانده این نیرو دسترسی ندارید.');

    const employee = await this.prisma.employee.findUnique({ where: { id: query.employeeId } });
    if (!employee) throw new NotFoundException('نیروی موردنظر یافت نشد.');

    const types = await this.prisma.leaveType.findMany({
      where: { companyId: employee.companyId, isActive: true },
      orderBy: { name: 'asc' },
    });

    const rows = [];
    for (const t of types) {
      const b = await this.balanceOf(query.employeeId, t.id, query.year ?? this.jalaliYear());
      rows.push({ leaveType: { id: t.id, code: t.code, name: t.name, color: t.color, isPaid: t.isPaid }, ...b });
    }

    return {
      data: { employeeId: query.employeeId, year: query.year ?? this.jalaliYear(), balances: rows },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  /** ثبت تراکنش دستی مانده (مدیر منابع انسانی) */
  async adjustBalance(dto: AdjustBalanceDto, user: AuthenticatedUser) {
    return this.prisma.$transaction(async (db) => {
    const ok = await this.access.canAccessEmployee(user, dto.employeeId);
    if (!ok) throw new ForbiddenException('به مانده این نیرو دسترسی ندارید.');
    await db.$queryRaw`SELECT id FROM "Employee" WHERE id = ${dto.employeeId}::uuid FOR UPDATE`;
    const employee = await db.employee.findUnique({ where: { id: dto.employeeId }, select: { companyId: true } });
    const type = await db.leaveType.findUnique({ where: { id: dto.leaveTypeId }, select: { companyId: true } });
    if (!employee || !type || employee.companyId !== type.companyId) throw new BadRequestException('نوع مرخصی متعلق به شرکت این نیرو نیست.');
    if (dto.type === LeaveTransactionType.RESERVE || dto.type === LeaveTransactionType.CONSUME) {
      throw new BadRequestException('این نوع تراکنش به‌صورت سیستمی ثبت می‌شود.');
    }

    const row = await db.leaveTransaction.create({
      data: {
        employeeId: dto.employeeId,
        leaveTypeId: dto.leaveTypeId,
        type: dto.type,
        minutes: dto.minutes,
        sourceType: 'MANUAL',
        note: dto.note ?? null,
        createdById: user.id,
      },
    });

    await this.audit.recordInTransaction(db, user.id, {
      action: AuditAction.CREATE,
      entity: 'LeaveTransaction',
      entityId: row.id,
      after: { employeeId: dto.employeeId, type: dto.type, minutes: dto.minutes },
    });

    return {
      data: { id: row.id },
      success: true,
      timestamp: new Date().toISOString(),
    };
    }, { maxWait: 10000, timeout: 30000 });
  }

  async listTransactions(query: LeaveTransactionQueryDto, pagination: PaginationDto, user: AuthenticatedUser) {
    const where: Prisma.LeaveTransactionWhereInput = {
      employee: this.access.employeeWhereFor(user),
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.leaveTypeId ? { leaveTypeId: query.leaveTypeId } : {}),
    };
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 50;
    const [total, rows] = await Promise.all([
      this.prisma.leaveTransaction.count({ where }),
      this.prisma.leaveTransaction.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { occurredAt: 'desc' },
        include: {
          leaveType: { select: { code: true, name: true, color: true } },
          employee: { select: { code: true, firstName: true, lastName: true } },
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
}
