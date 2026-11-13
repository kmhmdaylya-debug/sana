import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, MissionStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AccessService } from '../common/access/access.service';
import { AuditService } from '../common/audit/audit.service';
import { NotificationService } from '../common/notifications/notification.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { dateOnlyKey, toDateOnly } from '../attendance/jalali.util';
import { PaginationDto } from '../common/dto/pagination.dto';
import {
  AttendanceImpactQueryDto,
  CompleteMissionDto,
  CreateMissionDto,
  CreateMissionExpenseDto,
  DecideExpenseDto,
  MissionQueryDto,
  UpdateMissionDto,
} from './dto/missions.dto';

@Injectable()
export class MissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
  ) {}

  /** دریافت مأموریت با بررسی دسترسی */
  private async getMissionEntity(id: string) {
    const mission = await this.prisma.mission.findUnique({
      where: { id },
      include: {
        employee: { select: { id: true, code: true, firstName: true, lastName: true, userId: true } },
        orgUnit: { select: { id: true, name: true } },
        expenses: { orderBy: { spentAt: 'desc' } },
      },
    });
    if (!mission) throw new NotFoundException('مأموریت موردنظر یافت نشد.');
    return mission;
  }

  /** فهرست مأموریت‌ها با فیلتر و محدوده دسترسی */
  async list(query: MissionQueryDto, pagination: PaginationDto, user: AuthenticatedUser) {
    const where: Prisma.MissionWhereInput = {
      employee: this.access.employeeWhereFor(user),
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.from ? { startAt: { gte: new Date(query.from) } } : {}),
      ...(query.to ? { endAt: { lte: new Date(`${query.to}T23:59:59.999Z`) } } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { destination: { contains: query.search, mode: 'insensitive' } },
              { projectName: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const [total, rows] = await Promise.all([
      this.prisma.mission.count({ where }),
      this.prisma.mission.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { startAt: 'desc' },
        include: {
          employee: { select: { id: true, code: true, firstName: true, lastName: true } },
          orgUnit: { select: { id: true, name: true } },
          _count: { select: { expenses: true } },
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

  async get(id: string, user: AuthenticatedUser) {
    const mission = await this.getMissionEntity(id);
    const canAccess = await this.access.canAccessEmployee(user, mission.employeeId);
    if (!canAccess) throw new ForbiddenException('به مأموریت این نیرو دسترسی ندارید.');
    return {
      data: this.publicMission(mission),
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  private publicMission(mission: any) {
    return {
      ...mission,
      estimatedCost: Number(mission.estimatedCost ?? 0),
      actualCost: Number(mission.actualCost ?? 0),
      expenses: (mission.expenses ?? []).map((e: any) => ({ ...e, amount: Number(e.amount ?? 0) })),
    };
  }

  /** ثبت درخواست مأموریت */
  async create(dto: CreateMissionDto, user: AuthenticatedUser) {
    if (new Date(dto.startAt) >= new Date(dto.endAt)) {
      throw new BadRequestException('زمان شروع مأموریت باید قبل از زمان پایان باشد.');
    }
    const employee = await this.prisma.employee.findUnique({ where: { id: dto.employeeId } });
    if (!employee || employee.deletedAt) throw new NotFoundException('نیروی موردنظر یافت نشد.');
    const canAccess = await this.access.canAccessEmployee(user, dto.employeeId);
    if (!canAccess) throw new ForbiddenException('به پرونده این نیرو دسترسی ندارید.');

    // هم‌پوشانی با مأموریت فعال دیگر
    const overlap = await this.prisma.mission.findFirst({
      where: {
        employeeId: dto.employeeId,
        status: { in: [MissionStatus.REQUESTED, MissionStatus.PENDING_APPROVAL, MissionStatus.APPROVED, MissionStatus.IN_PROGRESS] },
        startAt: { lt: new Date(dto.endAt) },
        endAt: { gt: new Date(dto.startAt) },
      },
      select: { id: true },
    });
    if (overlap) throw new BadRequestException('برای این نیرو در این بازه مأموریت فعالی ثبت شده است.');

    const mission = await this.prisma.mission.create({
      data: {
        employeeId: dto.employeeId,
        orgUnitId: dto.orgUnitId ?? employee.orgUnitId,
        title: dto.title.trim(),
        destination: dto.destination.trim(),
        purpose: dto.purpose ?? null,
        startAt: new Date(dto.startAt),
        endAt: new Date(dto.endAt),
        transport: dto.transport ?? null,
        projectName: dto.projectName ?? null,
        estimatedCost: BigInt(dto.estimatedCost ?? 0),
        isAttendanceExempt: dto.isAttendanceExempt ?? true,
        status: MissionStatus.REQUESTED,
      },
    });

    await this.audit.record(user.id, {
      action: AuditAction.CREATE,
      entity: 'Mission',
      entityId: mission.id,
      after: { title: mission.title, destination: mission.destination },
    });

    // اطلاع به مأمور (اگر درخواست توسط دیگری ثبت شده باشد)
    const empUser = await this.prisma.employee.findUnique({
      where: { id: dto.employeeId },
      select: { userId: true },
    });
    if (empUser?.userId && empUser.userId !== user.id) {
      await this.notifications.notify(empUser.userId, {
        type: 'SYSTEM',
        title: 'درخواست مأموریت ثبت شد',
        body: `مأموریت «${mission.title}» برای شما ثبت شد و در انتظار تأیید است.`,
        link: `/missions/${mission.id}`,
      });
    }

    return {
      data: { id: mission.id, status: mission.status },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  /** ویرایش مأموریت — فقط در وضعیت‌های پیش از تأیید */
  async update(id: string, dto: UpdateMissionDto, user: AuthenticatedUser) {
    const mission = await this.getMissionEntity(id);
    const editable: MissionStatus[] = [
      MissionStatus.REQUESTED,
      MissionStatus.PENDING_APPROVAL,
      MissionStatus.REJECTED,
    ];
    if (!editable.includes(mission.status)) {
      throw new BadRequestException('مأموریت تأییدشده قابل ویرایش نیست.');
    }
    const updated = await this.prisma.mission.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.destination !== undefined ? { destination: dto.destination.trim() } : {}),
        ...(dto.purpose !== undefined ? { purpose: dto.purpose } : {}),
        ...(dto.startAt !== undefined ? { startAt: new Date(dto.startAt) } : {}),
        ...(dto.endAt !== undefined ? { endAt: new Date(dto.endAt) } : {}),
        ...(dto.transport !== undefined ? { transport: dto.transport } : {}),
        ...(dto.projectName !== undefined ? { projectName: dto.projectName } : {}),
        ...(dto.estimatedCost !== undefined ? { estimatedCost: BigInt(dto.estimatedCost) } : {}),
        ...(dto.isAttendanceExempt !== undefined ? { isAttendanceExempt: dto.isAttendanceExempt } : {}),
      },
    });
    await this.audit.record(user.id, {
      action: AuditAction.UPDATE,
      entity: 'Mission',
      entityId: id,
      before: { title: mission.title, status: mission.status },
      after: { title: updated.title },
    });
    return { data: { id: updated.id }, success: true, timestamp: new Date().toISOString() };
  }

  /** تصمیم تأیید — هیچ‌کس مأموریت خودش را تأیید نمی‌کند */
  async decide(id: string, decision: 'APPROVE' | 'REJECT', comment: string | undefined, user: AuthenticatedUser) {
    const mission = await this.getMissionEntity(id);
    if (mission.status !== MissionStatus.REQUESTED && mission.status !== MissionStatus.PENDING_APPROVAL) {
      throw new BadRequestException('این مأموریت در مرحله قابل تصمیم نیست.');
    }
    if (mission.employee.userId === user.id && !user.isSuperAdmin) {
      throw new ForbiddenException('هیچ‌کس اجازه تأیید مأموریت خودش را ندارد.');
    }

    const status = decision === 'APPROVE' ? MissionStatus.APPROVED : MissionStatus.REJECTED;
    await this.prisma.mission.update({
      where: { id },
      data: { status, approvedById: decision === 'APPROVE' ? user.id : null },
    });

    if (mission.employee.userId) {
      await this.notifications.notify(mission.employee.userId, {
        type: 'REQUEST_RESULT',
        title: decision === 'APPROVE' ? 'مأموریت شما تأیید شد' : 'درخواست مأموریت رد شد',
        body: comment ?? undefined,
        link: `/missions/${id}`,
      });
    }

    await this.audit.record(user.id, {
      action: decision === 'APPROVE' ? AuditAction.APPROVE : AuditAction.REJECT,
      entity: 'Mission',
      entityId: id,
      after: { status, comment },
    });

    return { data: { id, status }, success: true, timestamp: new Date().toISOString() };
  }

  /** شروع و پایان مأموریت توسط مأمور */
  async setStatus(id: string, status: MissionStatus, user: AuthenticatedUser) {
    const mission = await this.getMissionEntity(id);
    if (mission.status !== MissionStatus.APPROVED && status === MissionStatus.IN_PROGRESS) {
      throw new BadRequestException('فقط مأموریت تأییدشده قابل شروع است.');
    }
    await this.prisma.mission.update({ where: { id }, data: { status } });
    await this.audit.record(user.id, {
      action: AuditAction.UPDATE,
      entity: 'Mission',
      entityId: id,
      after: { status },
    });
    return { data: { id, status }, success: true, timestamp: new Date().toISOString() };
  }

  /** تکمیل مأموریت با گزارش نهایی */
  async complete(id: string, dto: CompleteMissionDto, user: AuthenticatedUser) {
    const mission = await this.getMissionEntity(id);
    const completable: MissionStatus[] = [MissionStatus.APPROVED, MissionStatus.IN_PROGRESS];
    if (!completable.includes(mission.status)) {
      throw new BadRequestException('این مأموریت در وضعیت قابل تکمیل نیست.');
    }
    await this.prisma.mission.update({
      where: { id },
      data: {
        status: MissionStatus.COMPLETED,
        report: dto.report,
        actualCost: BigInt(dto.actualCost ?? mission.actualCost),
      },
    });
    await this.audit.record(user.id, {
      action: AuditAction.UPDATE,
      entity: 'Mission',
      entityId: id,
      after: { status: MissionStatus.COMPLETED },
    });
    return { data: { id, status: MissionStatus.COMPLETED }, success: true, timestamp: new Date().toISOString() };
  }

  /** لغو مأموریت */
  async cancel(id: string, user: AuthenticatedUser) {
    const mission = await this.getMissionEntity(id);
    if (mission.status === MissionStatus.COMPLETED) {
      throw new BadRequestException('مأموریت تکمیل‌شده قابل لغو نیست.');
    }
    await this.prisma.mission.update({ where: { id }, data: { status: MissionStatus.CANCELLED } });
    await this.audit.record(user.id, {
      action: AuditAction.CANCEL,
      entity: 'Mission',
      entityId: id,
      before: { status: mission.status },
    });
    return { data: { id, status: MissionStatus.CANCELLED }, success: true, timestamp: new Date().toISOString() };
  }

  // =========================================================================
  // هزینه‌های مأموریت
  // =========================================================================

  async addExpense(id: string, dto: CreateMissionExpenseDto, user: AuthenticatedUser) {
    const mission = await this.getMissionEntity(id);
    const expense = await this.prisma.missionExpense.create({
      data: {
        missionId: id,
        description: dto.description.trim(),
        amount: BigInt(dto.amount),
        spentAt: toDateOnly(new Date(dto.spentAt)),
        receiptPath: dto.receiptPath ?? null,
        status: 'PENDING',
      },
    });
    await this.audit.record(user.id, {
      action: AuditAction.CREATE,
      entity: 'MissionExpense',
      entityId: expense.id,
      after: { missionId: id, amount: dto.amount },
    });
    return { data: { id: expense.id, amount: Number(expense.amount) }, success: true, timestamp: new Date().toISOString() };
  }

  /** تصمیم روی هزینه — تأییدکننده نباید درخواست‌دهنده همان مأموریت باشد */
  async decideExpense(expenseId: string, dto: DecideExpenseDto, user: AuthenticatedUser) {
    const expense = await this.prisma.missionExpense.findUnique({
      where: { id: expenseId },
      include: { mission: { include: { employee: { select: { userId: true } } } } },
    });
    if (!expense) throw new NotFoundException('هزینه موردنظر یافت نشد.');
    if (expense.status !== 'PENDING') throw new BadRequestException('این هزینه قبلاً بررسی شده است.');
    if (expense.mission.employee.userId === user.id && !user.isSuperAdmin) {
      throw new ForbiddenException('هیچ‌کس اجازه تأیید هزینه مأموریت خودش را ندارد.');
    }

    const approved = dto.decision === 'APPROVE';
    await this.prisma.missionExpense.update({
      where: { id: expenseId },
      data: {
        status: approved ? 'APPROVED' : 'REJECTED',
        approvedById: user.id,
      },
    });
    if (expense.mission.employee.userId) {
      await this.notifications.notify(expense.mission.employee.userId, {
        type: 'REQUEST_RESULT',
        title: approved ? 'هزینه مأموریت تأیید شد' : 'هزینه مأموریت رد شد',
        body: dto.comment ?? undefined,
        link: `/missions/${expense.missionId}`,
      });
    }
    await this.audit.record(user.id, {
      action: approved ? AuditAction.APPROVE : AuditAction.REJECT,
      entity: 'MissionExpense',
      entityId: expenseId,
      after: { decision: dto.decision, comment: dto.comment },
    });
    return { data: { id: expenseId, status: approved ? 'APPROVED' : 'REJECTED' }, success: true, timestamp: new Date().toISOString() };
  }

  /** تأثیر مأموریت‌ها بر حضور (روزهای معاف) */
  async attendanceImpact(query: AttendanceImpactQueryDto, user: AuthenticatedUser) {
    const canAccess = await this.access.canAccessEmployee(user, query.employeeId);
    if (!canAccess) throw new ForbiddenException('به پرونده این نیرو دسترسی ندارید.');

    const missions = await this.prisma.mission.findMany({
      where: {
        employeeId: query.employeeId,
        status: { in: [MissionStatus.APPROVED, MissionStatus.IN_PROGRESS, MissionStatus.COMPLETED] },
        isAttendanceExempt: true,
        startAt: { lte: new Date(`${query.to}T23:59:59.999Z`) },
        endAt: { gte: new Date(query.from) },
      },
      select: { id: true, title: true, startAt: true, endAt: true },
    });

    const days: string[] = [];
    const from = toDateOnly(new Date(query.from));
    const to = toDateOnly(new Date(query.to));
    for (const m of missions) {
      let cursor = toDateOnly(new Date(Math.max(m.startAt.getTime(), from.getTime())));
      const end = toDateOnly(new Date(Math.min(m.endAt.getTime(), to.getTime())));
      while (cursor <= end) {
        days.push(dateOnlyKey(cursor));
        cursor = new Date(cursor.getTime() + 86_400_000);
      }
    }

    return {
      data: { employeeId: query.employeeId, exemptDays: [...new Set(days)].sort(), missions },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }
}
