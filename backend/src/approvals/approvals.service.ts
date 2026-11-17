import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  ApprovalDecision,
  ApprovalStatus,
  ApprovalSubjectType,
  AttendanceRecordStatus,
  AuditAction,
  LeaveRequestStatus,
  LeaveTransactionType,
  NotificationType,
  Prisma,
  UserStatus,
} from "@prisma/client";
import { PrismaService } from "../common/prisma/prisma.service";
import { AuditService } from "../common/audit/audit.service";
import { AccessService } from "../common/access/access.service";
import { NotificationService } from "../common/notifications/notification.service";
import { AuthenticatedUser } from "../common/decorators/current-user.decorator";
import { LeavesService } from "../leaves/leaves.service";
import { ShiftsService } from "../shifts/shifts.service";
import { MissionsService } from "../missions/missions.service";
import { LoansService } from "../loans/loans.service";
import { AttendanceService } from "../attendance/attendance.service";
import { LifecycleService } from "../lifecycle/lifecycle.service";
import { PayrollService } from "../payroll/payroll.service";
import {
  ApprovalFlowQueryDto,
  ApprovalInstanceQueryDto,
  ApprovalStepDto,
  CreateApprovalFlowDto,
  CreateApprovalInstanceDto,
  DecideTaskDto,
  ExpireOverdueDto,
  InboxQueryDto,
  UpdateApprovalFlowDto,
} from "./dto/approvals.dto";

/* ==========================================================================
 * انواع کمکی
 * ========================================================================== */

/** پیامد یک رویداد گردش تأیید */
export type ApprovalOutcome =
  "APPROVED" | "REJECTED" | "NEEDS_REVISION" | "CANCELLED";

/** بافت ارسال‌شده به هندلر پایان گردش */
export interface ApprovalSubjectContext {
  transaction?: Prisma.TransactionClient;
  subjectType: string;
  subjectId: string;
  instanceId: string;
  outcome: ApprovalOutcome;
  actorId: string | null;
  comment?: string | null;
  stepOrder?: number;
}

/**
 * هندلر پایان گردش برای هر نوع موضوع.
 * ماژول‌های دیگر می‌توانند با `ApprovalsService.registerHandler(...)`
 * هندلر دلخواه خود را ثبت یا جایگزین کنند.
 */
export interface ApprovalSubjectHandler {
  onApproved?(ctx: ApprovalSubjectContext): Promise<void>;
  onRejected?(ctx: ApprovalSubjectContext): Promise<void>;
  onNeedsRevision?(ctx: ApprovalSubjectContext): Promise<void>;
  onCancelled?(ctx: ApprovalSubjectContext): Promise<void>;
  onStepAdvanced?(ctx: ApprovalSubjectContext): Promise<void>;
}

/** مرجع تأییدکننده — کاربر و نقش او */
interface ApproverRef {
  userId: string;
  roleCode: string | null;
}

/** بافت ارزیابی شرط مرحله */
interface StepContext {
  employeeId: string | null;
  payload: Record<string, unknown>;
}

const SEPARATOR = "__v";

/** نقش‌هایی که به‌عنوان «منابع انسانی» شناخته می‌شوند */
const HR_ROLE_CODES = ["hr.admin", "hr.manager", "hr.officer", "hr.user", "hr"];

/** نقش‌هایی که به‌عنوان «مالی» شناخته می‌شوند */
const FINANCE_ROLE_CODES = [
  "finance.manager",
  "finance.officer",
  "accountant",
  "finance",
];

/* ==========================================================================
 * سرویس گردش تأیید (موتور گردش عمومی)
 * ========================================================================== */
@Injectable()
export class ApprovalsService {
  private readonly logger = new Logger(ApprovalsService.name);

  /**
   * ثبت هندلرهای پایان گردش.
   * کلید: نوع موضوع (مثلاً LEAVE) — مقدار: هندلر.
   * این ثبت‌کننده به‌صورت static است تا ماژول‌های دیگر بدون وابستگی تزریقی
   * بتوانند هندلر خود را اضافه کنند (الگوی Registry).
   */
  private static readonly handlers = new Map<string, ApprovalSubjectHandler>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly access: AccessService,
    private readonly notification: NotificationService,
    private readonly leaves: LeavesService,
    private readonly shifts: ShiftsService,
    private readonly missions: MissionsService,
    private readonly loans: LoansService,
    private readonly attendance: AttendanceService,
    private readonly lifecycle: LifecycleService,
    private readonly payroll: PayrollService,
  ) {
    this.registerBuiltInHandlers();
  }

  /* ---------------------------------------------------------------------
   * ثبت هندلرها
   * ------------------------------------------------------------------ */

  /** ثبت/جایگزینی هندلر پایان گردش برای یک نوع موضوع */
  static registerHandler(
    subjectType: string,
    handler: ApprovalSubjectHandler,
  ): void {
    ApprovalsService.handlers.set(subjectType, handler);
  }

  /** دریافت هندلر ثبت‌شده یک نوع موضوع */
  static getHandler(subjectType: string): ApprovalSubjectHandler | undefined {
    return ApprovalsService.handlers.get(subjectType);
  }

  /**
   * هندلرهای پیش‌فرض سامانه.
   * اگر ماژول دیگری هندلری برای همان موضوع ثبت کرده باشد، دست‌نخورده می‌ماند.
   */
  private registerBuiltInHandlers(): void {
    for (const type of [
      ApprovalSubjectType.MISSION,
      ApprovalSubjectType.LOAN,
      ApprovalSubjectType.ATTENDANCE_CORRECTION,
      ApprovalSubjectType.TERMINATION,
      ApprovalSubjectType.PAYROLL,
    ]) {
      if (!ApprovalsService.handlers.has(type))
        ApprovalsService.registerHandler(type, {
          onApproved: (ctx) => this.applyDomainOutcome(ctx, "APPROVE"),
          ...(type === ApprovalSubjectType.PAYROLL
            ? {}
            : {
                onRejected: (ctx: ApprovalSubjectContext) =>
                  this.applyDomainOutcome(ctx, "REJECT"),
              }),
        });
    }
    if (!ApprovalsService.handlers.has(ApprovalSubjectType.LEAVE)) {
      ApprovalsService.registerHandler(ApprovalSubjectType.LEAVE, {
        onApproved: (ctx) => this.applyLeaveApproved(ctx),
        onRejected: (ctx) => this.applyLeaveRejected(ctx),
        onNeedsRevision: (ctx) => this.applyLeaveNeedsRevision(ctx),
        onCancelled: (ctx) => this.applyLeaveCancelled(ctx),
        onStepAdvanced: (ctx) => this.applyLeaveStepAdvanced(ctx),
      });
    }
    if (!ApprovalsService.handlers.has(ApprovalSubjectType.SHIFT_SWAP)) {
      ApprovalsService.registerHandler(ApprovalSubjectType.SHIFT_SWAP, {
        onApproved: (ctx) => this.applyShiftSwapApproved(ctx),
        onRejected: (ctx) => this.applyShiftSwapRejected(ctx),
      });
    }
  }

  /* ---------------------------------------------------------------------
   * گردش‌ها
   * ------------------------------------------------------------------ */

  /** فهرست گردش‌های تأیید همراه با مراحل */
  async listFlows(query: ApprovalFlowQueryDto, user: AuthenticatedUser) {
    const where: Prisma.ApprovalFlowWhereInput = {
      AND: [
        { OR: [{ companyId: null }, await this.access.companyWhereFor(user)] },
      ],
      ...(query.subjectType ? { subjectType: query.subjectType } : {}),
      ...(query.code ? { code: { contains: query.code } } : {}),
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

    const [total, rows] = await Promise.all([
      this.prisma.approvalFlow.count({ where }),
      this.prisma.approvalFlow.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
        include: {
          steps: { orderBy: { stepOrder: "asc" } },
          _count: { select: { instances: true } },
        },
      }),
    ]);

    return {
      data: rows.map((f) => this.toFlow(f)),
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
        hasNext: query.page * query.limit < total,
        hasPrev: query.page > 1,
      },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  /** جزئیات یک گردش تأیید */
  async getFlow(id: string, user: AuthenticatedUser) {
    const flow = await this.prisma.approvalFlow.findUnique({
      where: { id },
      include: {
        steps: { orderBy: { stepOrder: "asc" } },
        _count: { select: { instances: true } },
      },
    });
    if (!flow) throw new NotFoundException("گردش تأیید موردنظر یافت نشد.");
    if (flow.companyId)
      await this.access.assertCompanyAccess(user, flow.companyId);
    return this.toFlow(flow);
  }

  /** ایجاد گردش تأیید همراه با مراحل آن (در یک تراکنش) */
  async createFlow(dto: CreateApprovalFlowDto, user: AuthenticatedUser) {
    const actorId = user.id;
    await this.assertFlowWritable(dto.companyId, user);
    for (const step of dto.steps)
      if (step.approverUserId && dto.companyId)
        await this.access.assertCompanyMember(user, dto.companyId, {
          userId: step.approverUserId,
        });
    const code = dto.code.trim();
    const existing = await this.prisma.approvalFlow.findUnique({
      where: { code },
    });
    if (existing) throw new BadRequestException("کد گردش تأیید تکراری است.");

    const steps = this.normalizedSteps(dto.steps);

    const flow = await this.prisma.$transaction(async (tx) =>
      tx.approvalFlow.create({
        data: {
          code,
          name: dto.name.trim(),
          subjectType: dto.subjectType,
          description: dto.description ?? null,
          companyId: dto.companyId ?? null,
          version: 1,
          isActive: true,
          steps: { create: steps },
        },
        include: { steps: { orderBy: { stepOrder: "asc" } } },
      }),
    );

    await this.audit.record(actorId, {
      action: AuditAction.CREATE,
      entity: "ApprovalFlow",
      entityId: flow.id,
      after: {
        code: flow.code,
        name: flow.name,
        version: flow.version,
        steps: steps.length,
      },
    });

    return this.toFlow(flow);
  }

  /**
   * ویرایش گردش تأیید — نسخه جدید ساخته می‌شود.
   * گردشی که نمونه (instance) دارد هرگز تغییر داده نمی‌شود؛ نسخه قبلی غیرفعال
   * و نسخه جدید با شماره نسخه بالاتر ایجاد می‌گردد تا نمونه‌های قبلی
   * به نسخه صحیح خود اشاره داشته باشند.
   */
  async updateFlow(
    id: string,
    dto: UpdateApprovalFlowDto,
    user: AuthenticatedUser,
  ) {
    const actorId = user.id;
    const flow = await this.prisma.approvalFlow.findUnique({
      where: { id },
      include: { steps: { orderBy: { stepOrder: "asc" } } },
    });
    if (!flow) throw new NotFoundException("گردش تأیید موردنظر یافت نشد.");
    await this.assertFlowWritable(flow.companyId, user);
    for (const step of dto.steps ?? [])
      if (step.approverUserId && flow.companyId)
        await this.access.assertCompanyMember(user, flow.companyId, {
          userId: step.approverUserId,
        });

    const base = this.baseCode(flow.code);
    const version = flow.version + 1;
    const newCode = `${base}${SEPARATOR}${version}`;

    const steps = dto.steps
      ? this.normalizedSteps(dto.steps)
      : flow.steps.map((s) => ({
          stepOrder: s.stepOrder,
          name: s.name,
          approverType: s.approverType,
          approverRoleCode: s.approverRoleCode,
          approverUserId: s.approverUserId,
          conditionJson: s.conditionJson,
          slaHours: s.slaHours,
          onTimeout: s.onTimeout,
          required: s.required,
        }));

    const created = await this.prisma.$transaction(async (tx) => {
      await tx.approvalFlow.update({
        where: { id: flow.id },
        data: { isActive: false },
      });
      return tx.approvalFlow.create({
        data: {
          code: newCode,
          name: dto.name?.trim() ?? flow.name,
          subjectType: flow.subjectType,
          description: dto.description ?? flow.description,
          companyId: flow.companyId,
          version,
          isActive: dto.isActive ?? true,
          steps: { create: steps },
        },
        include: { steps: { orderBy: { stepOrder: "asc" } } },
      });
    });

    await this.audit.record(actorId, {
      action: AuditAction.UPDATE,
      entity: "ApprovalFlow",
      entityId: created.id,
      before: {
        code: flow.code,
        name: flow.name,
        version: flow.version,
        isActive: flow.isActive,
      },
      after: {
        code: created.code,
        name: created.name,
        version: created.version,
        isActive: created.isActive,
      },
    });

    return this.toFlow(created);
  }

  /** غیرفعال‌سازی گردش تأیید */
  async deactivateFlow(id: string, user: AuthenticatedUser) {
    const actorId = user.id;
    const flow = await this.prisma.approvalFlow.findUnique({ where: { id } });
    if (!flow) throw new NotFoundException("گردش تأیید موردنظر یافت نشد.");
    await this.assertFlowWritable(flow.companyId, user);

    await this.prisma.approvalFlow.update({
      where: { id },
      data: { isActive: false },
    });
    await this.audit.record(actorId, {
      action: AuditAction.DEACTIVATE,
      entity: "ApprovalFlow",
      entityId: id,
      before: {
        code: flow.code,
        version: flow.version,
        isActive: flow.isActive,
      },
    });
    return { success: true };
  }

  /* ---------------------------------------------------------------------
   * نمونه‌های گردش
   * ------------------------------------------------------------------ */

  /** ایجاد نمونه گردش و تولید task مرحله اول */
  async createInstance(
    dto: CreateApprovalInstanceDto,
    user: AuthenticatedUser,
  ) {
    return this.prisma.$transaction(
      async (db) => {
        await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${dto.subjectType}:${dto.subjectId}`}, 0))`;
        const actorId = user.id;
        const flow = await this.resolveFlowByCode(dto.flowCode);
        if (!flow) {
          throw new NotFoundException(
            `گردش تأییدی با کد «${dto.flowCode}» یافت نشد.`,
          );
        }
        if (!flow.isActive) {
          throw new BadRequestException("گردش تأیید انتخاب‌شده غیرفعال است.");
        }
        if (flow.subjectType !== dto.subjectType)
          throw new BadRequestException("نوع موضوع با گردش تأیید یکسان نیست.");
        if (!ApprovalsService.handlers.has(dto.subjectType))
          throw new BadRequestException(
            "اعمال نتیجه برای این نوع موضوع پیاده‌سازی نشده است.",
          );
        if (flow.companyId)
          await this.access.assertCompanyAccess(user, flow.companyId);
        const employeeId = await this.assertSubjectAccess(
          dto,
          user,
          flow.companyId,
          db,
        );

        let supplied: Record<string, unknown>;
        try {
          supplied =
            typeof dto.payloadJson === "string"
              ? JSON.parse(dto.payloadJson)
              : (dto.payloadJson ?? {});
        } catch {
          throw new BadRequestException("بافت گردش باید JSON معتبر باشد.");
        }
        if (
          !supplied ||
          typeof supplied !== "object" ||
          Array.isArray(supplied) ||
          JSON.stringify(supplied).length > 50000
        )
          throw new BadRequestException(
            "بافت گردش باید یک شیء معتبر با حجم مجاز باشد.",
          );
        if (supplied.employeeId && supplied.employeeId !== employeeId)
          throw new BadRequestException(
            "کارمند ارسال‌شده با مالک رکورد موضوع یکسان نیست.",
          );
        const payload = await this.subjectPayload(
          dto,
          employeeId,
          supplied,
          db,
        );
        if (
          await db.approvalInstance.findFirst({
            where: {
              subjectId: dto.subjectId,
              subjectType: dto.subjectType,
              status: ApprovalStatus.PENDING,
            },
            select: { id: true },
          })
        )
          throw new BadRequestException(
            "گردش فعال دیگری برای این موضوع وجود دارد.",
          );
        const ctx: StepContext = {
          employeeId,
          payload,
        };

        const executable = await this.resolveExecutableStep(
          flow.steps,
          0,
          ctx,
          db,
        );
        if (!executable) {
          throw new BadRequestException(
            "هیچ مرحله قابل اجرایی در این گردش تعریف نشده است.",
          );
        }

        const now = new Date();
        const instance = await (async (tx: Prisma.TransactionClient) => {
          const created = await tx.approvalInstance.create({
            data: {
              flowId: flow.id,
              subjectType: dto.subjectType,
              subjectId: dto.subjectId,
              flowVersion: flow.version,
              status: ApprovalStatus.PENDING,
              currentStepOrder: executable.step.stepOrder,
              initiatedById: actorId ?? null,
              initiatedAt: now,
              payloadJson: JSON.stringify(payload),
              note: dto.note ?? null,
            },
          });
          if (executable.approvers.length) {
            await tx.approvalTask.createMany({
              data: executable.approvers.map((a) =>
                this.taskData(created.id, executable.step, a, now),
              ),
            });
          }
          return created;
        })(db);

        await this.notifyAssignees(
          executable.approvers,
          instance,
          executable.step,
          db,
        );
        await this.audit.recordInTransaction(db, actorId, {
          action: AuditAction.CREATE,
          entity: "ApprovalInstance",
          entityId: instance.id,
          after: {
            flowCode: flow.code,
            flowVersion: flow.version,
            subjectType: instance.subjectType,
            subjectId: instance.subjectId,
            currentStepOrder: instance.currentStepOrder,
          },
        });

        return this.getInstance(instance.id, user, db);
      },
      { maxWait: 10000, timeout: 300000 },
    );
  }

  /** فهرست نمونه‌های گردش با فیلتر و محدوده دسترسی */
  async listInstances(
    query: ApprovalInstanceQueryDto,
    user: AuthenticatedUser,
  ) {
    const where: Prisma.ApprovalInstanceWhereInput = {
      ...(query.subjectType ? { subjectType: query.subjectType } : {}),
      ...(query.subjectId ? { subjectId: query.subjectId } : {}),
      ...(query.status ? { status: query.status as ApprovalStatus } : {}),
      ...(query.initiatedByMe ? { initiatedById: user.id } : {}),
      ...(query.myTasksOnly
        ? {
            tasks: {
              some: {
                status: ApprovalStatus.PENDING,
                OR: [
                  { assigneeUserId: user.id },
                  ...(user.roleCodes.length
                    ? [{ assigneeRoleCode: { in: user.roleCodes } }]
                    : []),
                ],
              },
            },
          }
        : {}),
      ...(await this.scopeFilter(user, query.subjectType)),
    };

    const [total, rows] = await Promise.all([
      this.prisma.approvalInstance.count({ where }),
      this.prisma.approvalInstance.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { initiatedAt: "desc" },
        include: {
          flow: { select: { id: true, code: true, name: true, version: true } },
          tasks: {
            orderBy: { createdAt: "asc" },
            include: {
              step: { select: { id: true, name: true, stepOrder: true } },
              assignee: {
                select: { id: true, fullName: true, username: true },
              },
            },
          },
        },
      }),
    ]);

    return {
      data: rows.map((i) => this.toInstance(i)),
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
        hasNext: query.page * query.limit < total,
        hasPrev: query.page > 1,
      },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  /** جزئیات نمونه گردش به‌همراه تاریخچه task */
  async getInstance(
    id: string,
    user?: AuthenticatedUser,
    db: Prisma.TransactionClient = this.prisma,
  ) {
    const instance = await db.approvalInstance.findUnique({
      where: { id },
      include: {
        flow: {
          select: {
            id: true,
            code: true,
            name: true,
            version: true,
            subjectType: true,
          },
        },
        initiator: { select: { id: true, fullName: true, username: true } },
        tasks: {
          orderBy: [{ stepOrder: "asc" }, { createdAt: "asc" }],
          include: {
            step: {
              select: {
                id: true,
                name: true,
                stepOrder: true,
                approverType: true,
              },
            },
            assignee: { select: { id: true, fullName: true, username: true } },
            decidedBy: { select: { id: true, fullName: true, username: true } },
          },
        },
      },
    });
    if (!instance)
      throw new NotFoundException("نمونه گردش تأیید موردنظر یافت نشد.");
    if (user) await this.assertInstanceVisible(instance, user, db);
    return this.toInstance(instance);
  }

  /** صندوق کار — task باز کاربر جاری */
  async inbox(query: InboxQueryDto, user: AuthenticatedUser) {
    const where: Prisma.ApprovalTaskWhereInput = {
      status: ApprovalStatus.PENDING,
      instance: {
        status: ApprovalStatus.PENDING,
        AND: [await this.scopeFilter(user)],
      },
      ...(query.overdueOnly ? { dueAt: { lt: new Date() } } : {}),
      OR: [
        { assigneeUserId: user.id },
        ...(user.roleCodes.length
          ? [{ assigneeRoleCode: { in: user.roleCodes } }]
          : []),
      ],
    };

    const [total, rows] = await Promise.all([
      this.prisma.approvalTask.count({ where }),
      this.prisma.approvalTask.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: [
          { dueAt: { sort: "asc", nulls: "last" } },
          { createdAt: "desc" },
        ],
        include: {
          step: {
            select: {
              id: true,
              name: true,
              stepOrder: true,
              approverType: true,
            },
          },
          assignee: { select: { id: true, fullName: true, username: true } },
          instance: {
            select: {
              id: true,
              subjectType: true,
              subjectId: true,
              status: true,
              currentStepOrder: true,
              initiatedAt: true,
              note: true,
              initiatedById: true,
              initiator: { select: { id: true, fullName: true } },
              flow: { select: { id: true, code: true, name: true } },
            },
          },
        },
      }),
    ]);

    return {
      data: rows.map((t) => this.toTask(t)),
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
        hasNext: query.page * query.limit < total,
        hasPrev: query.page > 1,
      },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  /* ---------------------------------------------------------------------
   * موتور تصمیم‌گیری
   * ------------------------------------------------------------------ */

  /**
   * ثبت تصمیم روی یک task تأیید.
   * قواعد:
   *  ۱) منع خودتأییدی — ثبت‌کننده درخواست و مالک رکورد موضوع نمی‌توانند تأیید کنند.
   *  ۲) فقط یک انتقال معتبر — با به‌روزرسانی شرطی (updateMany) تضمین می‌شود.
   *  ۳) مراحل موازی — تا تأیید همه task یک مرحله، پیشروی انجام نمی‌شود.
   */
  async decideTask(
    taskId: string,
    dto: DecideTaskDto,
    actor: AuthenticatedUser,
  ) {
    return this.prisma.$transaction(
      async (db) => {
        const reference = await db.approvalTask.findUnique({
          where: { id: taskId },
          select: { instanceId: true },
        });
        if (!reference) throw new NotFoundException("task تأیید یافت نشد.");
        await db.$queryRaw`SELECT id FROM "ApprovalInstance" WHERE id = ${reference.instanceId}::uuid FOR UPDATE`;
        await db.$queryRaw`SELECT id FROM "ApprovalTask" WHERE id = ${taskId}::uuid FOR UPDATE`;
        const task = await db.approvalTask.findUnique({
          where: { id: taskId },
          include: {
            step: true,
            instance: {
              include: {
                flow: { include: { steps: { orderBy: { stepOrder: "asc" } } } },
              },
            },
          },
        });
        if (!task) throw new NotFoundException("task تأیید موردنظر یافت نشد.");
        await this.assertSubjectAccess(
          task.instance,
          actor,
          task.instance.flow.companyId,
          db,
        );
        await this.assertInstanceVisible(task.instance, actor, db);
        if (dto.referredToUserId) {
          const target = await this.access.buildAuthUser(dto.referredToUserId);
          if (!target) throw new NotFoundException("کاربر مقصد فعال نیست.");
          await this.assertSubjectAccess(
            task.instance,
            target,
            task.instance.flow.companyId,
            db,
          );
        }
        if (task.status !== ApprovalStatus.PENDING) {
          throw new BadRequestException("این درخواست قبلاً بررسی شده است.");
        }
        if (task.instance.status !== ApprovalStatus.PENDING) {
          throw new BadRequestException("این درخواست قبلاً بررسی شده است.");
        }

        await this.assertNoSelfApproval(task, actor, db);
        this.assertTaskAssignee(task, actor);

        const instance = task.instance;
        const now = new Date();
        const comment = dto.comment ?? null;

        switch (dto.decision) {
          case ApprovalDecision.APPROVE:
            return this.applyApprove(task, dto, actor, now, db);
          case ApprovalDecision.REJECT:
            return this.applyReject(task, dto, actor, now, db);
          case ApprovalDecision.REQUEST_REVISION:
            return this.applyRequestRevision(task, dto, actor, now, db);
          case ApprovalDecision.REFER:
            return this.applyRefer(task, dto, actor, now, db);
          case ApprovalDecision.ESCALATE:
            return this.applyEscalate(task, dto, actor, now, db);
          default:
            throw new BadRequestException("نوع تصمیم معتبر نیست.");
        }
      },
      { maxWait: 10000, timeout: 300000 },
    );
  }

  /** تأیید */
  private async applyApprove(
    task: any,
    dto: DecideTaskDto,
    actor: AuthenticatedUser,
    now: Date,
    db: Prisma.TransactionClient = this.prisma,
  ) {
    const updated = await db.approvalTask.updateMany({
      where: { id: task.id, status: ApprovalStatus.PENDING },
      data: {
        status: ApprovalStatus.APPROVED,
        decision: ApprovalDecision.APPROVE,
        decidedById: actor.id,
        comment: dto.comment ?? null,
        decidedAt: now,
      },
    });
    if (updated.count === 0) {
      throw new BadRequestException("این درخواست قبلاً بررسی شده است.");
    }

    await this.audit.recordInTransaction(db, actor.id, {
      action: AuditAction.APPROVE,
      entity: "ApprovalTask",
      entityId: task.id,
      before: { status: task.status, decision: null },
      after: {
        status: ApprovalStatus.APPROVED,
        decision: ApprovalDecision.APPROVE,
        stepOrder: task.stepOrder,
      },
    });

    await this.maybeAdvance(task.instance, task.stepOrder, actor.id, db);

    return this.getInstance(task.instanceId, undefined, db);
  }

  /** رد */
  private async applyReject(
    task: any,
    dto: DecideTaskDto,
    actor: AuthenticatedUser,
    now: Date,
    db: Prisma.TransactionClient = this.prisma,
  ) {
    const updated = await db.approvalTask.updateMany({
      where: { id: task.id, status: ApprovalStatus.PENDING },
      data: {
        status: ApprovalStatus.REJECTED,
        decision: ApprovalDecision.REJECT,
        decidedById: actor.id,
        comment: dto.comment ?? null,
        decidedAt: now,
      },
    });
    if (updated.count === 0) {
      throw new BadRequestException("این درخواست قبلاً بررسی شده است.");
    }

    await this.closeInstance(task.instance, ApprovalStatus.REJECTED, now, db);

    await this.audit.recordInTransaction(db, actor.id, {
      action: AuditAction.REJECT,
      entity: "ApprovalInstance",
      entityId: task.instanceId,
      before: {
        status: task.instance.status,
        currentStepOrder: task.instance.currentStepOrder,
      },
      after: { status: ApprovalStatus.REJECTED },
    });

    await this.notifyInitiator(task.instance, "رد", dto.comment, db);
    await this.dispatch(
      "onRejected",
      {
        subjectType: task.instance.subjectType,
        subjectId: task.instance.subjectId,
        instanceId: task.instanceId,
        outcome: "REJECTED",
        actorId: actor.id,
        comment: dto.comment ?? null,
      },
      db,
    );

    return this.getInstance(task.instanceId, undefined, db);
  }

  /** بازگشت جهت اصلاح */
  private async applyRequestRevision(
    task: any,
    dto: DecideTaskDto,
    actor: AuthenticatedUser,
    now: Date,
    db: Prisma.TransactionClient = this.prisma,
  ) {
    const updated = await db.approvalTask.updateMany({
      where: { id: task.id, status: ApprovalStatus.PENDING },
      data: {
        status: ApprovalStatus.NEEDS_REVISION,
        decision: ApprovalDecision.REQUEST_REVISION,
        decidedById: actor.id,
        comment: dto.comment ?? null,
        decidedAt: now,
      },
    });
    if (updated.count === 0) {
      throw new BadRequestException("این درخواست قبلاً بررسی شده است.");
    }

    await this.closeInstance(
      task.instance,
      ApprovalStatus.NEEDS_REVISION,
      now,
      db,
    );

    await this.audit.recordInTransaction(db, actor.id, {
      action: AuditAction.UPDATE,
      entity: "ApprovalInstance",
      entityId: task.instanceId,
      before: { status: task.instance.status },
      after: { status: ApprovalStatus.NEEDS_REVISION },
    });

    await this.notifyInitiator(task.instance, "نیازمند اصلاح", dto.comment, db);
    await this.dispatch(
      "onNeedsRevision",
      {
        subjectType: task.instance.subjectType,
        subjectId: task.instance.subjectId,
        instanceId: task.instanceId,
        outcome: "NEEDS_REVISION",
        actorId: actor.id,
        comment: dto.comment ?? null,
      },
      db,
    );

    return this.getInstance(task.instanceId, undefined, db);
  }

  /** ارجاع به کاربر دیگر در همان مرحله */
  private async applyRefer(
    task: any,
    dto: DecideTaskDto,
    actor: AuthenticatedUser,
    now: Date,
    db: Prisma.TransactionClient = this.prisma,
  ) {
    if (!dto.referredToUserId) {
      throw new BadRequestException("برای ارجاع، کاربر مقصد را مشخص کنید.");
    }
    const target = await db.user.findFirst({
      where: {
        id: dto.referredToUserId,
        status: UserStatus.ACTIVE,
        deletedAt: null,
      },
      select: { id: true, fullName: true },
    });
    if (!target) throw new NotFoundException("کاربر مقصد ارجاع یافت نشد.");

    const updated = await db.approvalTask.updateMany({
      where: { id: task.id, status: ApprovalStatus.PENDING },
      data: {
        status: ApprovalStatus.REFERRED,
        decision: ApprovalDecision.REFER,
        decidedById: actor.id,
        referredToUserId: dto.referredToUserId,
        comment: dto.comment ?? null,
        decidedAt: now,
      },
    });
    if (updated.count === 0) {
      throw new BadRequestException("این درخواست قبلاً بررسی شده است.");
    }

    const created = await db.approvalTask.create({
      data: {
        instanceId: task.instanceId,
        stepId: task.stepId,
        stepOrder: task.stepOrder,
        status: ApprovalStatus.PENDING,
        assigneeUserId: target.id,
        dueAt: this.dueAt(task.step, now),
      },
    });

    await this.audit.recordInTransaction(db, actor.id, {
      action: AuditAction.UPDATE,
      entity: "ApprovalTask",
      entityId: task.id,
      before: { status: task.status },
      after: {
        status: ApprovalStatus.REFERRED,
        referredToUserId: dto.referredToUserId,
      },
    });

    await this.notification.notify(
      target.id,
      {
        type: NotificationType.TASK_ASSIGNED,
        title: "task تأیید ارجاع‌شده",
        body: `درخواست توسط ${actor.fullName} به شما ارجاع شد.${dto.comment ? ` یادداشت: ${dto.comment}` : ""}`,
        link: `/approvals/instances/${task.instanceId}`,
        senderId: actor.id,
      },
      db,
    );

    return {
      taskId: created.id,
      instance: await this.getInstance(task.instanceId, undefined, db),
    };
  }

  /** ارجاع به سطح بالاتر (سرپرست بالاتر) */
  private async applyEscalate(
    task: any,
    dto: DecideTaskDto,
    actor: AuthenticatedUser,
    now: Date,
    db: Prisma.TransactionClient = this.prisma,
  ) {
    const updated = await db.approvalTask.updateMany({
      where: { id: task.id, status: ApprovalStatus.PENDING },
      data: {
        status: ApprovalStatus.CANCELLED,
        decision: ApprovalDecision.ESCALATE,
        decidedById: actor.id,
        comment: dto.comment ?? null,
        decidedAt: now,
      },
    });
    if (updated.count === 0) {
      throw new BadRequestException("این درخواست قبلاً بررسی شده است.");
    }

    const target = await this.resolveEscalationTarget(task, db);
    if (!target) {
      if (task.step.required)
        throw new BadRequestException(
          "تأییدکننده مرحله الزامی مشخص نیست؛ مرحله رد نمی‌شود.",
        );
      // سطح بالاتری یافت نشد — مانند «رد کردن مرحله» عمل می‌شود.
      await this.maybeAdvance(task.instance, task.stepOrder, actor.id, db);
      await this.audit.recordInTransaction(db, actor.id, {
        action: AuditAction.UPDATE,
        entity: "ApprovalTask",
        entityId: task.id,
        before: { status: task.status },
        after: {
          status: ApprovalStatus.CANCELLED,
          decision: ApprovalDecision.ESCALATE,
          note: "سطح بالاتر یافت نشد",
        },
      });
      return this.getInstance(task.instanceId, undefined, db);
    }

    const targetUser = await this.access.buildAuthUser(target);
    if (!targetUser) throw new BadRequestException("تأییدکننده فعال یافت نشد.");
    await this.assertSubjectAccess(task.instance, targetUser, undefined, db);
    const created = await db.approvalTask.create({
      data: {
        instanceId: task.instanceId,
        stepId: task.stepId,
        stepOrder: task.stepOrder,
        status: ApprovalStatus.PENDING,
        assigneeUserId: target,
        dueAt: this.dueAt(task.step, now),
      },
    });

    await this.audit.recordInTransaction(db, actor.id, {
      action: AuditAction.UPDATE,
      entity: "ApprovalTask",
      entityId: task.id,
      before: { status: task.status },
      after: {
        status: ApprovalStatus.CANCELLED,
        decision: ApprovalDecision.ESCALATE,
        escalatedTo: target,
      },
    });

    await this.notification.notify(
      target,
      {
        type: NotificationType.TASK_ASSIGNED,
        title: "task تأیید ارجاع سطح بالاتر",
        body: `درخواست توسط ${actor.fullName} به شما ارجاع سطح بالاتر داده شد.`,
        link: `/approvals/instances/${task.instanceId}`,
        senderId: actor.id,
      },
      db,
    );

    return {
      taskId: created.id,
      instance: await this.getInstance(task.instanceId, undefined, db),
    };
  }

  /**
   * پیشروی گردش — تنها زمانی که همه task یک مرحله تعیین تکلیف شده باشند.
   * انتقال با به‌روزرسانی شرطی نمونه (currentStepOrder) انجام می‌شود تا در
   * حالت هم‌زمانی فقط یک انتقال معتبر باشد.
   */
  private async maybeAdvance(
    instance: any,
    stepOrder: number,
    actorId: string | null,
    db: Prisma.TransactionClient = this.prisma,
  ) {
    const remaining = await db.approvalTask.count({
      where: {
        instanceId: instance.id,
        stepOrder,
        status: ApprovalStatus.PENDING,
      },
    });
    if (remaining > 0) return; // مرحله موازی هنوز تکمیل نشده است.

    const steps = await db.approvalStep.findMany({
      where: { flowId: instance.flowId },
      orderBy: { stepOrder: "asc" },
    });
    const saved = this.parseJson<Record<string, unknown>>(
      instance.payloadJson,
      {},
    );
    const employeeId = await this.resolveSubjectEmployeeId(instance, db);
    const payload = await this.subjectPayload(
      instance,
      employeeId,
      (saved.metadata as Record<string, unknown>) ?? {},
      db,
    );
    const ctx: StepContext = {
      employeeId,
      payload,
    };
    const executable = await this.resolveExecutableStep(
      steps,
      stepOrder,
      ctx,
      db,
    );
    const now = new Date();

    const outcome = await (async (tx: Prisma.TransactionClient) => {
      const claimed = await tx.approvalInstance.updateMany({
        where: {
          id: instance.id,
          status: ApprovalStatus.PENDING,
          currentStepOrder: stepOrder,
        },
        data: executable
          ? { currentStepOrder: executable.step.stepOrder }
          : { status: ApprovalStatus.APPROVED, completedAt: now },
      });
      if (claimed.count === 0) return { claimed: false as const, next: null };

      if (executable && executable.approvers.length) {
        await tx.approvalTask.createMany({
          data: executable.approvers.map((a) =>
            this.taskData(instance.id, executable.step, a, now),
          ),
        });
      }
      return { claimed: true as const, next: executable };
    })(db);

    if (!outcome.claimed) return;

    if (outcome.next) {
      await this.notifyAssignees(
        outcome.next.approvers,
        instance,
        outcome.next.step,
        db,
      );
      await this.audit.recordInTransaction(db, actorId, {
        action: AuditAction.APPROVE,
        entity: "ApprovalInstance",
        entityId: instance.id,
        before: { status: ApprovalStatus.PENDING, currentStepOrder: stepOrder },
        after: {
          status: ApprovalStatus.PENDING,
          currentStepOrder: outcome.next.step.stepOrder,
        },
      });
      await this.dispatch(
        "onStepAdvanced",
        {
          subjectType: instance.subjectType,
          subjectId: instance.subjectId,
          instanceId: instance.id,
          outcome: "APPROVED",
          actorId,
          stepOrder: outcome.next.step.stepOrder,
        },
        db,
      );
      return;
    }
    await this.dispatch(
      "onApproved",
      {
        subjectType: instance.subjectType,
        subjectId: instance.subjectId,
        instanceId: instance.id,
        outcome: "APPROVED",
        actorId,
      },
      db,
    );
    await this.audit.recordInTransaction(db, actorId, {
      action: AuditAction.APPROVE,
      entity: "ApprovalInstance",
      entityId: instance.id,
      after: { status: ApprovalStatus.APPROVED },
    });
    await this.notifyInitiator(instance, "تأیید", undefined, db);
  }

  /* ---------------------------------------------------------------------
   * SLA — task سررسیدشده
   * ------------------------------------------------------------------ */

  /**
   * یافت task بازِ سررسیدشده و اجرای اقدام تعیین‌شده در مرحله:
   *  ESCALATE → ایجاد task برای سطح بالاتر
   *  SKIP     → عبور از مرحله
   *  REJECT   → رد نمونه گردش
   */
  async expireOverdue(dto: ExpireOverdueDto, user: AuthenticatedUser) {
    return this.prisma.$transaction(
      async (db) => {
        const actorId = user.id;
        const now = new Date();
        const limit = dto.limit ?? 100;
        const tasks = await db.approvalTask.findMany({
          where: {
            status: ApprovalStatus.PENDING,
            dueAt: { lt: now },
            instance: await this.scopeFilter(user, undefined, db),
          },
          include: { step: true, instance: true },
          orderBy: { dueAt: "asc" },
          take: limit,
        });

        const summary = { processed: 0, escalated: 0, skipped: 0, rejected: 0 };

        for (const task of tasks) {
          await db.$queryRaw`SELECT id FROM "ApprovalInstance" WHERE id = ${task.instanceId}::uuid FOR UPDATE`;
          const action = (task.step.onTimeout || "ESCALATE").toUpperCase();
          const claimed = await db.approvalTask.updateMany({
            where: { id: task.id, status: ApprovalStatus.PENDING },
            data: {
              status: ApprovalStatus.EXPIRED,
              decidedAt: now,
              comment: "مهلت پاسخ‌گویی به پایان رسید.",
            },
          });
          if (claimed.count === 0) continue;
          summary.processed += 1;

          await this.audit.recordInTransaction(db, actorId, {
            action: AuditAction.UPDATE,
            entity: "ApprovalTask",
            entityId: task.id,
            before: { status: ApprovalStatus.PENDING },
            after: { status: ApprovalStatus.EXPIRED, onTimeout: action },
          });

          if (action === "REJECT") {
            await this.closeInstance(
              task.instance,
              ApprovalStatus.REJECTED,
              now,
              db,
            );
            summary.rejected += 1;
            await this.notifyInitiator(
              task.instance,
              "رد (نقض مهلت)",
              null,
              db,
            );
            await this.dispatch(
              "onRejected",
              {
                subjectType: task.instance.subjectType,
                subjectId: task.instance.subjectId,
                instanceId: task.instanceId,
                outcome: "REJECTED",
                actorId,
                comment: "مهلت پاسخ‌گویی به پایان رسید.",
              },
              db,
            );
            continue;
          }

          if (action === "SKIP") {
            summary.skipped += 1;
            await this.maybeAdvance(task.instance, task.stepOrder, actorId, db);
            continue;
          }

          // ESCALATE
          const target = await this.resolveEscalationTarget(task, db);
          if (!target) {
            if (task.step.required)
              throw new BadRequestException(
                "مرحله الزامی بدون تأییدکننده جایگزین قابل عبور نیست.",
              );
            summary.skipped += 1;
            await this.maybeAdvance(task.instance, task.stepOrder, actorId, db);
            continue;
          }
          const targetUser = await this.access.buildAuthUser(target);
          if (!targetUser)
            throw new BadRequestException("تأییدکننده جایگزین فعال نیست.");
          await this.assertSubjectAccess(
            task.instance,
            targetUser,
            undefined,
            db,
          );
          await db.approvalTask.create({
            data: {
              instanceId: task.instanceId,
              stepId: task.stepId,
              stepOrder: task.stepOrder,
              status: ApprovalStatus.PENDING,
              assigneeUserId: target,
              dueAt: this.dueAt(task.step, now),
            },
          });
          summary.escalated += 1;
          await this.notification.notify(
            target,
            {
              type: NotificationType.TASK_OVERDUE,
              title: "task تأیید سررسیدشده",
              body: "مهلت پاسخ‌گویی یک task تأیید به پایان رسید و به شما واگذار شد.",
              link: `/approvals/instances/${task.instanceId}`,
            },
            db,
          );
        }

        return {
          ...summary,
          success: true,
          timestamp: new Date().toISOString(),
        };
      },
      { maxWait: 10000, timeout: 300000 },
    );
  }

  /* ---------------------------------------------------------------------
   * هندلر پایان گردش
   * ------------------------------------------------------------------ */

  /**
   * فراخوانی هندلر پایان گردش برای یک موضوع.
   * سایر ماژول‌ها می‌توانند هندلر خود را با `registerHandler` ثبت کنند.
   */
  async onApproved(
    subjectType: string,
    subjectId: string,
    instanceId: string,
    user?: AuthenticatedUser,
  ): Promise<void> {
    if (!user)
      throw new ForbiddenException("عامل معتبر برای اعمال نتیجه لازم است.");
    await this.prisma.$transaction(
      async (db) => {
        const instance = await db.approvalInstance.findUnique({
          where: { id: instanceId },
        });
        if (
          !instance ||
          instance.status !== ApprovalStatus.APPROVED ||
          instance.subjectType !== subjectType ||
          instance.subjectId !== subjectId
        )
          throw new BadRequestException("گردش تأییدشده معتبر یافت نشد.");
        await this.assertInstanceVisible(instance, user, db);
        await this.assertSubjectAccess(instance, user, undefined, db);
        await this.dispatch(
          "onApproved",
          {
            subjectType,
            subjectId,
            instanceId,
            outcome: "APPROVED",
            actorId: user.id,
          },
          db,
        );
      },
      { timeout: 300000 },
    );
  }

  /** اجرای هندلر ثبت‌شده برای یک پیامد */
  private async dispatch(
    method:
      | "onApproved"
      | "onRejected"
      | "onNeedsRevision"
      | "onCancelled"
      | "onStepAdvanced",
    ctx: ApprovalSubjectContext,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    const handler = ApprovalsService.handlers.get(ctx.subjectType);
    if (!handler) return;
    const fn = handler[method];
    if (!fn) return;
    try {
      await fn({ ...ctx, transaction: db === this.prisma ? undefined : db });
    } catch {
      throw new BadRequestException(
        "اعمال نتیجه گردش ناموفق بود؛ هیچ تغییری ثبت نشد.",
      );
    }
  }

  /* ---------------------------------------------------------------------
   * گردش‌های پیش‌فرض
   * ------------------------------------------------------------------ */

  /**
   * اطمینان از وجود گردش‌های پیش‌فرض سامانه.
   * این متد به‌صورت تنبل (lazily) فراخوانی می‌شود و ایمن است
   * (اجرای دوباره رکورد تکراری ایجاد نمی‌کند).
   */
  async ensureDefaultFlows(
    user: AuthenticatedUser,
  ): Promise<{ created: string[] }> {
    if (!user.isSuperAdmin)
      throw new ForbiddenException(
        "ساخت گردش‌های سراسری فقط برای مدیر ارشد مجاز است.",
      );
    const created: string[] = [];

    const defaults: Array<{
      code: string;
      name: string;
      subjectType: ApprovalSubjectType;
      description: string;
      steps: ApprovalStepDto[];
    }> = [
      {
        code: "LEAVE_REQUEST",
        name: "گردش تأیید مرخصی",
        subjectType: ApprovalSubjectType.LEAVE,
        description: "سرپرست ← مدیر واحد ← منابع انسانی (در صورت بیش از ۳ روز)",
        steps: [
          {
            stepOrder: 1,
            name: "سرپرست",
            approverType: "SUPERVISOR" as any,
            slaHours: 24,
            onTimeout: "ESCALATE" as any,
            required: true,
          },
          {
            stepOrder: 2,
            name: "مدیر واحد",
            approverType: "MANAGER" as any,
            slaHours: 24,
            onTimeout: "ESCALATE" as any,
            required: true,
          },
          {
            stepOrder: 3,
            name: "منابع انسانی",
            approverType: "HR" as any,
            slaHours: 48,
            onTimeout: "ESCALATE" as any,
            required: true,
            // «مرخصی بیش از ۳ روز نیازمند تأیید منابع انسانی است»
            conditionJson: { field: "days", operator: "gt", value: 3 },
          },
        ],
      },
      {
        code: "SHIFT_SWAP",
        name: "گردش تأیید تعویض شیفت",
        subjectType: ApprovalSubjectType.SHIFT_SWAP,
        description: "سرپرست ← تأیید تعویض شیفت",
        steps: [
          {
            stepOrder: 1,
            name: "سرپرست",
            approverType: "SUPERVISOR" as any,
            slaHours: 24,
            onTimeout: "ESCALATE" as any,
            required: true,
          },
        ],
      },
    ];

    for (const def of defaults) {
      const existing = await this.resolveFlowByCode(def.code);
      if (existing) continue;
      await this.prisma.approvalFlow.create({
        data: {
          code: def.code,
          name: def.name,
          subjectType: def.subjectType,
          description: def.description,
          version: 1,
          isActive: true,
          steps: { create: this.normalizedSteps(def.steps) },
        },
      });
      created.push(def.code);
    }

    if (created.length) {
      await this.audit.record(null, {
        action: AuditAction.CREATE,
        entity: "ApprovalFlow",
        after: { codes: created, note: "ایجاد خودکار گردش‌های پیش‌فرض سامانه" },
      });
    }

    return { created };
  }

  /* ---------------------------------------------------------------------
   * ابزارهای داخلی
   * ------------------------------------------------------------------ */

  /** کد پایه گردش (بدون پسوند نسخه) */
  private baseCode(code: string): string {
    const idx = code.lastIndexOf(SEPARATOR);
    return idx > 0 ? code.slice(0, idx) : code;
  }

  /** یافت گردش فعال بر اساس کد (نسخه‌های قدیمی نادیده گرفته می‌شوند) */
  private async resolveFlowByCode(code: string) {
    const base = this.baseCode(code.trim());
    const rows = await this.prisma.approvalFlow.findMany({
      where: {
        OR: [{ code: base }, { code: { startsWith: `${base}${SEPARATOR}` } }],
      },
      include: { steps: { orderBy: { stepOrder: "asc" } } },
      orderBy: { version: "desc" },
    });
    if (!rows.length) return null;
    return rows.find((f) => f.isActive) ?? rows[0];
  }

  /** یکسان‌سازی مراحل پیش از ذخیره */
  private normalizedSteps(steps: ApprovalStepDto[]) {
    const sorted = [...steps].sort((a, b) => a.stepOrder - b.stepOrder);
    return sorted.map((s) => ({
      stepOrder: s.stepOrder,
      name: s.name.trim(),
      approverType: s.approverType,
      approverRoleCode: s.approverRoleCode ?? null,
      approverUserId: s.approverUserId ?? null,
      conditionJson:
        s.conditionJson === undefined || s.conditionJson === null
          ? null
          : typeof s.conditionJson === "string"
            ? s.conditionJson
            : JSON.stringify(s.conditionJson),
      slaHours: s.slaHours ?? 48,
      onTimeout: s.onTimeout ?? "ESCALATE",
      required: s.required ?? true,
    }));
  }

  /**
   * یافتن نخستین مرحله قابل اجرا پس از یک ترتیب مشخص.
   * مرحله‌ای که شرط آن برقرار نیست یا تأییدکننده‌ای ندارد رد می‌شود.
   */
  private async resolveExecutableStep(
    steps: any[],
    fromOrder: number,
    ctx: StepContext,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<{ step: any; approvers: ApproverRef[] } | null> {
    const candidates = steps
      .filter((s) => s.stepOrder > fromOrder)
      .sort((a, b) => a.stepOrder - b.stepOrder);

    for (const step of candidates) {
      if (!this.evaluateCondition(step.conditionJson, ctx.payload)) continue;
      const candidates = await this.resolveApprovers(step, ctx, db);
      const approvers: ApproverRef[] = [];
      for (const candidate of candidates) {
        const user = await this.access.buildAuthUser(candidate.userId);
        if (
          user &&
          (!ctx.employeeId ||
            (await this.access.canAccessEmployee(user, ctx.employeeId)))
        )
          approvers.push(candidate);
      }
      if (!approvers.length) {
        if (step.required)
          throw new BadRequestException(
            "تأییدکننده‌ای در حوزه مجاز برای مرحله الزامی یافت نشد.",
          );
        this.logger.warn("Approval step has no approver.");
        continue;
      }
      return { step, approvers };
    }
    return null;
  }

  /** تعیین تأییدکنندگان یک مرحله */
  private async resolveApprovers(
    step: any,
    ctx: StepContext,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<ApproverRef[]> {
    const type = String(step.approverType || "ROLE").toUpperCase();
    switch (type) {
      case "USER": {
        if (!step.approverUserId) return [];
        const user = await db.user.findFirst({
          where: {
            id: step.approverUserId,
            status: UserStatus.ACTIVE,
            deletedAt: null,
          },
          select: { id: true },
        });
        return user ? [{ userId: user.id, roleCode: null }] : [];
      }
      case "ROLE": {
        if (!step.approverRoleCode) return [];
        return this.usersByRoleCodes([step.approverRoleCode], db);
      }
      case "HR":
        return this.usersByRoleCodes(HR_ROLE_CODES, db);
      case "FINANCE":
        return this.usersByRoleCodes(FINANCE_ROLE_CODES, db);
      case "SUPERVISOR": {
        if (!ctx.employeeId) return [];
        const employee = await db.employee.findUnique({
          where: { id: ctx.employeeId },
          select: { managerId: true },
        });
        if (!employee?.managerId) return [];
        return this.userByEmployee(employee.managerId, db);
      }
      case "MANAGER": {
        if (!ctx.employeeId) return [];
        const employee = await db.employee.findUnique({
          where: { id: ctx.employeeId },
          select: { orgUnitId: true, managerId: true },
        });
        if (employee?.orgUnitId) {
          const unit = await db.orgUnit.findUnique({
            where: { id: employee.orgUnitId },
            select: { managerId: true },
          });
          if (unit?.managerId) {
            const refs = await this.userByEmployee(unit.managerId, db);
            if (refs.length) return refs;
          }
        }
        if (employee?.managerId)
          return this.userByEmployee(employee.managerId, db);
        return [];
      }
      default:
        return [];
    }
  }

  /** کاربران فعال دارای یکی از نقش‌های داده‌شده */
  private async usersByRoleCodes(
    codes: string[],
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<ApproverRef[]> {
    if (!codes.length) return [];
    const users = await db.user.findMany({
      where: {
        status: UserStatus.ACTIVE,
        deletedAt: null,
        userRoles: {
          some: {
            role: { code: { in: codes }, isActive: true, deletedAt: null },
            validFrom: { lte: new Date() },
            OR: [{ validTo: null }, { validTo: { gt: new Date() } }],
          },
        },
      },
      select: {
        id: true,
        userRoles: { select: { role: { select: { code: true } } } },
      },
    });

    const map = new Map<string, ApproverRef>();
    for (const user of users) {
      for (const ur of user.userRoles) {
        if (!codes.includes(ur.role.code)) continue;
        if (!map.has(user.id))
          map.set(user.id, { userId: user.id, roleCode: ur.role.code });
      }
    }
    return [...map.values()];
  }

  /** کاربر فعال متناظر با یک کارمند */
  private async userByEmployee(
    employeeId: string,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<ApproverRef[]> {
    const user = await db.user.findFirst({
      where: { employeeId, status: UserStatus.ACTIVE, deletedAt: null },
      select: { id: true },
    });
    return user ? [{ userId: user.id, roleCode: null }] : [];
  }

  /** ساخت داده task تأیید */
  private taskData(
    instanceId: string,
    step: any,
    approver: ApproverRef,
    now: Date,
  ) {
    return {
      instanceId,
      stepId: step.id,
      stepOrder: step.stepOrder,
      status: ApprovalStatus.PENDING,
      assigneeUserId: approver.userId,
      assigneeRoleCode: approver.roleCode,
      dueAt: this.dueAt(step, now),
    };
  }

  /** مهلت پاسخ‌گویی (SLA) */
  private dueAt(step: any, from: Date): Date {
    const hours = step.slaHours && step.slaHours > 0 ? step.slaHours : 48;
    return new Date(from.getTime() + hours * 3_600_000);
  }

  /** بستن نمونه گردش (رد/نیازمند اصلاح) و لغو task باز */
  private async closeInstance(
    instance: any,
    status: ApprovalStatus,
    now: Date,
    db: Prisma.TransactionClient = this.prisma,
  ) {
    await (async (tx: Prisma.TransactionClient) => {
      await tx.approvalInstance.updateMany({
        where: { id: instance.id, status: ApprovalStatus.PENDING },
        data: { status, completedAt: now },
      });
      await tx.approvalTask.updateMany({
        where: { instanceId: instance.id, status: ApprovalStatus.PENDING },
        data: { status: ApprovalStatus.CANCELLED },
      });
    })(db);
  }

  /** منع خودتأییدی */
  private async assertNoSelfApproval(
    task: any,
    actor: AuthenticatedUser,
    db: Prisma.TransactionClient = this.prisma,
  ) {
    const instance = task.instance;

    // ۱) ثبت‌کننده درخواست
    if (instance.initiatedById && instance.initiatedById === actor.id) {
      throw new ForbiddenException(
        "شما نمی‌توانید درخواستی را که خودتان ثبت کرده‌اید تأیید کنید.",
      );
    }

    // ۲) مالک رکورد موضوع (مثلاً کارمند صاحب درخواست مرخصی)
    const ownerUserId = await this.resolveSubjectOwnerUserId(instance, db);
    if (ownerUserId && ownerUserId === actor.id) {
      throw new ForbiddenException(
        "شما نمی‌توانید درخواستی را که خودتان ثبت کرده‌اید تأیید کنید.",
      );
    }

    // ۳) task که به خودِ مالک درخواست تخصیص یافته است
    if (
      task.assigneeUserId &&
      task.assigneeUserId === actor.id &&
      task.assigneeUserId === ownerUserId
    ) {
      throw new ForbiddenException(
        "شما نمی‌توانید درخواستی را که خودتان ثبت کرده‌اید تأیید کنید.",
      );
    }
  }

  /** احراز صلاحیت تصمیم‌گیرنده */
  private assertTaskAssignee(task: any, actor: AuthenticatedUser) {
    const isAssignee = task.assigneeUserId === actor.id;
    const isRoleHolder =
      !!task.assigneeRoleCode &&
      actor.roleCodes.includes(task.assigneeRoleCode);
    if (!isAssignee && !isRoleHolder) {
      throw new ForbiddenException("این task تأیید به شما واگذار نشده است.");
    }
  }

  /** کاربری که مالک رکورد موضوع است */
  private async resolveSubjectOwnerUserId(
    instance: any,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<string | null> {
    const employeeId = await this.resolveSubjectEmployeeId(instance, db);
    if (!employeeId) return null;
    const user = await db.user.findFirst({
      where: { employeeId },
      select: { id: true },
    });
    return user?.id ?? null;
  }

  /** کارمند مرتبط با موضوع نمونه */
  private async resolveSubjectEmployeeId(
    instance: any,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<string | null> {
    try {
      switch (instance.subjectType) {
        case ApprovalSubjectType.LEAVE: {
          const r = await db.leaveRequest.findUnique({
            where: { id: instance.subjectId },
            select: { employeeId: true },
          });
          return r?.employeeId ?? null;
        }
        case ApprovalSubjectType.MISSION: {
          const r = await db.mission.findUnique({
            where: { id: instance.subjectId },
            select: { employeeId: true },
          });
          return r?.employeeId ?? null;
        }
        case ApprovalSubjectType.LOAN: {
          const r = await db.loan.findUnique({
            where: { id: instance.subjectId },
            select: { employeeId: true },
          });
          return r?.employeeId ?? null;
        }
        case ApprovalSubjectType.ATTENDANCE_CORRECTION: {
          const r = await db.attendanceCorrection.findUnique({
            where: { id: instance.subjectId },
            select: { employeeId: true },
          });
          return r?.employeeId ?? null;
        }
        case ApprovalSubjectType.TERMINATION: {
          const r = await db.terminationRequest.findUnique({
            where: { id: instance.subjectId },
            select: { employeeId: true },
          });
          return r?.employeeId ?? null;
        }
        case ApprovalSubjectType.SHIFT_SWAP: {
          const r = await db.shiftSwapRequest.findUnique({
            where: { id: instance.subjectId },
            select: { fromEmployeeId: true },
          });
          return r?.fromEmployeeId ?? null;
        }
        default:
          return null;
      }
    } catch {
      return null;
    }
  }

  /** سطح بالاتر برای ارجاع (سرپرستِ سرپرست یا مدیر کارمند موضوع) */
  private async resolveEscalationTarget(
    task: any,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<string | null> {
    if (task.assigneeUserId) {
      const managerOfAssignee = await this.managerUserIdOfUser(
        task.assigneeUserId,
        db,
      );
      if (managerOfAssignee) return managerOfAssignee;
    }
    const employeeId = await this.resolveSubjectEmployeeId(task.instance, db);
    if (employeeId) return this.managerUserIdOfEmployee(employeeId, db);
    return null;
  }

  /** کاربرِ مدیرِ مستقیم یک کاربر */
  private async managerUserIdOfUser(
    userId: string,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<string | null> {
    const user = await db.user.findFirst({
      where: { id: userId },
      select: { employeeId: true },
    });
    if (!user?.employeeId) return null;
    return this.managerUserIdOfEmployee(user.employeeId, db);
  }

  /** کاربرِ مدیرِ مستقیم یک کارمند */
  private async managerUserIdOfEmployee(
    employeeId: string,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<string | null> {
    const employee = await db.employee.findUnique({
      where: { id: employeeId },
      select: { managerId: true },
    });
    if (!employee?.managerId) return null;
    const user = await db.user.findFirst({
      where: { employeeId: employee.managerId },
      select: { id: true },
    });
    return user?.id ?? null;
  }

  /** ارزیابی شرط مرحله */
  private evaluateCondition(
    conditionJson: string | null,
    context: Record<string, unknown>,
  ): boolean {
    if (!conditionJson) return true;
    const node = this.parseJson<any>(conditionJson, null);
    if (!node) throw new BadRequestException("شرط گردش تأیید معتبر نیست.");
    return this.evaluateNode(node, context);
  }

  private evaluateNode(node: any, context: Record<string, unknown>): boolean {
    if (node === null || node === undefined) return true;
    if (Array.isArray(node.all)) {
      return node.all.every((n: any) => this.evaluateNode(n, context));
    }
    if (Array.isArray(node.any)) {
      return node.any.some((n: any) => this.evaluateNode(n, context));
    }
    if (node.not) return !this.evaluateNode(node.not, context);
    if (
      typeof node.field !== "string" ||
      node.field === "metadata" ||
      node.field.startsWith("metadata.")
    )
      throw new BadRequestException(
        "شرط تأیید باید از فیلدهای رکورد اصلی استفاده کند.",
      );

    const value = this.getFieldValue(context, node.field);
    const op = String(node.operator ?? "eq").toLowerCase();
    if (value === undefined && op !== "exists")
      throw new BadRequestException(
        "فیلد شرط گردش تأیید در رکورد اصلی موجود نیست.",
      );
    const target = node.value;

    switch (op) {
      case "eq":
        return (
          value === target ||
          (value != null && target != null && String(value) === String(target))
        );
      case "ne":
        return !(
          value === target ||
          (value != null && target != null && String(value) === String(target))
        );
      case "gt":
        return Number(value) > Number(target);
      case "gte":
        return Number(value) >= Number(target);
      case "lt":
        return Number(value) < Number(target);
      case "lte":
        return Number(value) <= Number(target);
      case "in":
        return (
          Array.isArray(target) &&
          target.some((t: any) => String(t) === String(value))
        );
      case "nin":
        return (
          Array.isArray(target) &&
          !target.some((t: any) => String(t) === String(value))
        );
      case "contains":
        return (
          typeof value === "string" && String(value).includes(String(target))
        );
      case "exists":
        return target
          ? value !== undefined && value !== null
          : value === undefined || value === null;
      case "truthy":
        return !!value;
      default:
        throw new BadRequestException("عملگر شرط گردش تأیید معتبر نیست.");
    }
  }

  private getFieldValue(context: Record<string, unknown>, path?: string): any {
    if (!path) return undefined;
    return path
      .split(".")
      .reduce<any>(
        (acc, part) =>
          acc === null ||
          acc === undefined ||
          !Object.prototype.hasOwnProperty.call(acc, part)
            ? undefined
            : acc[part],
        context,
      );
  }

  /** تجزیه امن JSON */
  private parseJson<T>(raw: string | null | undefined, fallback: T): T {
    if (raw === null || raw === undefined || raw === "") return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  /** اعلان به تأییدکنندگان مرحله */
  private async notifyAssignees(
    approvers: ApproverRef[],
    instance: any,
    step: any,
    db: Prisma.TransactionClient = this.prisma,
  ) {
    if (!approvers.length) return;
    await this.notification.notifyMany(
      approvers.map((a) => a.userId),
      {
        type: NotificationType.TASK_ASSIGNED,
        title: `task تأیید جدید — ${step.name}`,
        body: `برای شما task تأییدی در گردش «${instance.subjectType}» ایجاد شد.`,
        link: `/approvals/instances/${instance.id}`,
      },
      db,
    );
  }

  /** اعلان نتیجه به ثبت‌کننده درخواست */
  private async notifyInitiator(
    instance: any,
    result: string,
    comment?: string | null,
    db: Prisma.TransactionClient = this.prisma,
  ) {
    if (!instance.initiatedById) return;
    await this.notification.notify(
      instance.initiatedById,
      {
        type: NotificationType.REQUEST_RESULT,
        title: `نتیجه درخواست: ${result}`,
        body: comment
          ? `نتیجه: ${result} — ${comment}`
          : `نتیجه درخواست شما: ${result}.`,
        link: `/approvals/instances/${instance.id}`,
      },
      db,
    );
  }

  /* ---------------------------------------------------------------------
   * محدوده دسترسی
   * ------------------------------------------------------------------ */

  /**
   * محدودکردن نمونه‌های گردش به محدوده دسترسی کاربر.
   * نمونه‌هایی که موضوعشان یک رکورد پرسنلی است، از طریق پرونده کارمند فیلتر می‌شوند.
   */
  private async scopeFilter(
    user: AuthenticatedUser,
    subjectType?: ApprovalSubjectType,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<Prisma.ApprovalInstanceWhereInput> {
    if (user.isSuperAdmin || user.scope?.unrestricted) return {};

    const employeeWhere = this.access.employeeWhereFor(user);
    const branches: Prisma.ApprovalInstanceWhereInput[] = [];

    const add = async (type: ApprovalSubjectType, ids: string[]) => {
      if (!ids.length) return;
      branches.push({ subjectType: type, subjectId: { in: ids } });
    };

    const want = (t: ApprovalSubjectType) => !subjectType || subjectType === t;

    if (want(ApprovalSubjectType.LEAVE)) {
      const rows = await db.leaveRequest.findMany({
        where: { employee: employeeWhere },
        select: { id: true },
      });
      await add(
        ApprovalSubjectType.LEAVE,
        rows.map((r) => r.id),
      );
    }
    if (want(ApprovalSubjectType.MISSION)) {
      const rows = await db.mission.findMany({
        where: { employee: employeeWhere },
        select: { id: true },
      });
      await add(
        ApprovalSubjectType.MISSION,
        rows.map((r) => r.id),
      );
    }
    if (want(ApprovalSubjectType.LOAN)) {
      const rows = await db.loan.findMany({
        where: { employee: employeeWhere },
        select: { id: true },
      });
      await add(
        ApprovalSubjectType.LOAN,
        rows.map((r) => r.id),
      );
    }
    if (want(ApprovalSubjectType.ATTENDANCE_CORRECTION)) {
      const rows = await db.attendanceCorrection.findMany({
        where: { employee: employeeWhere },
        select: { id: true },
      });
      await add(
        ApprovalSubjectType.ATTENDANCE_CORRECTION,
        rows.map((r) => r.id),
      );
    }
    if (want(ApprovalSubjectType.TERMINATION)) {
      const rows = await db.terminationRequest.findMany({
        where: { employee: employeeWhere },
        select: { id: true },
      });
      await add(
        ApprovalSubjectType.TERMINATION,
        rows.map((r) => r.id),
      );
    }
    if (want(ApprovalSubjectType.SHIFT_SWAP)) {
      const emps = await db.employee.findMany({
        where: employeeWhere,
        select: { id: true },
      });
      const rows = await db.shiftSwapRequest.findMany({
        where: { fromEmployeeId: { in: emps.map((e) => e.id) } },
        select: { id: true },
      });
      await add(
        ApprovalSubjectType.SHIFT_SWAP,
        rows.map((r) => r.id),
      );
    }

    const company = await this.access.companyWhereFor(user);
    if (!subjectType || subjectType === ApprovalSubjectType.PAYROLL) {
      const periods = await db.payrollPeriod.findMany({
        where: { companyId: { in: user.scope.companyIds } },
        select: { id: true },
      });
      if (periods.length)
        branches.push({
          subjectType: ApprovalSubjectType.PAYROLL,
          subjectId: { in: periods.map((p) => p.id) },
        });
    }
    return {
      AND: [{ flow: { OR: [{ companyId: null }, company] } }, { OR: branches }],
    };
  }

  /** اطمینان از دسترسی کاربر به یک نمونه گردش */
  private async assertInstanceVisible(
    instance: any,
    user: AuthenticatedUser,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    if (user.isSuperAdmin || user.scope?.unrestricted) return;
    const visible = await db.approvalInstance.findFirst({
      where: {
        id: instance.id,
        AND: [await this.scopeFilter(user, undefined, db)],
      },
      select: { id: true },
    });
    if (!visible)
      throw new ForbiddenException("دسترسی به این درخواست مجاز نیست.");
    if (instance.initiatedById === user.id) return;

    const ownerUserId = await this.resolveSubjectOwnerUserId(instance, db);
    if (ownerUserId === user.id) return;

    const employeeId = await this.resolveSubjectEmployeeId(instance, db);
    if (employeeId && (await this.access.canAccessEmployee(user, employeeId)))
      return;

    // اگر کاربر task در این نمونه دارد اجازه مشاهده دارد.
    const hasTask = await db.approvalTask.findFirst({
      where: {
        instanceId: instance.id,
        OR: [
          { assigneeUserId: user.id },
          ...(user.roleCodes.length
            ? [{ assigneeRoleCode: { in: user.roleCodes } }]
            : []),
        ],
      },
      select: { id: true },
    });
    if (hasTask) return;

    throw new ForbiddenException("دسترسی به این درخواست مجاز نیست.");
  }

  private async assertFlowWritable(
    companyId: string | null | undefined,
    user: AuthenticatedUser,
  ): Promise<void> {
    if (!companyId) {
      if (!user.isSuperAdmin)
        throw new ForbiddenException(
          "تغییر گردش سراسری فقط برای مدیر ارشد مجاز است.",
        );
    } else await this.access.assertCompanyAccess(user, companyId);
  }

  private async assertSubjectAccess(
    subject: { subjectType: string; subjectId: string },
    user: AuthenticatedUser,
    flowCompanyId?: string | null,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<string | null> {
    const employeeId = await this.resolveSubjectEmployeeId(subject, db);
    if (employeeId) {
      await this.access.assertEmployeeAccess(user, employeeId);
      const employee = await db.employee.findUnique({
        where: { id: employeeId },
        select: { companyId: true },
      });
      if (!employee || (flowCompanyId && flowCompanyId !== employee.companyId))
        throw new BadRequestException("شرکت موضوع با گردش یکسان نیست.");
      if (subject.subjectType === ApprovalSubjectType.TERMINATION)
        await this.access.assertEmployeeMutable(user, employeeId, true);
      if (subject.subjectType === ApprovalSubjectType.SHIFT_SWAP) {
        const swap = await db.shiftSwapRequest.findUniqueOrThrow({
          where: { id: subject.subjectId },
        });
        await this.access.assertCompanyMember(user, employee.companyId, {
          employeeId: swap.toEmployeeId,
        });
      }
      return employeeId;
    }
    if (subject.subjectType === ApprovalSubjectType.PAYROLL) {
      const period = await db.payrollPeriod.findUnique({
        where: { id: subject.subjectId },
        select: { companyId: true },
      });
      if (!period) throw new NotFoundException("موضوع گردش یافت نشد.");
      await this.access.assertCompanyAccess(user, period.companyId);
      if (
        !user.isSuperAdmin &&
        !user.scope.unrestricted &&
        !user.scope.companyIds.includes(period.companyId)
      )
        throw new ForbiddenException(
          "گردش حقوق به دسترسی صریح کل شرکت نیاز دارد.",
        );
      if (flowCompanyId && flowCompanyId !== period.companyId)
        throw new BadRequestException("شرکت موضوع با گردش یکسان نیست.");
      return null;
    }
    if (!user.isSuperAdmin)
      throw new ForbiddenException("مالک موضوع قابل احراز نیست.");
    return null;
  }

  private async subjectPayload(
    subject: { subjectType: string; subjectId: string },
    employeeId: string | null,
    metadata: Record<string, unknown>,
    db: Prisma.TransactionClient,
  ): Promise<Record<string, unknown>> {
    const payload: Record<string, unknown> = { employeeId, metadata };
    const amount = (value: bigint) => {
      const result = Number(value);
      if (!Number.isSafeInteger(result))
        throw new BadRequestException(
          "مبلغ موضوع برای ارزیابی شرط عددی بیش از محدوده مجاز است.",
        );
      return result;
    };
    if (subject.subjectType === ApprovalSubjectType.LEAVE) {
      const row = await db.leaveRequest.findUniqueOrThrow({
        where: { id: subject.subjectId },
        select: { startAt: true, endAt: true, durationMinutes: true },
      });
      Object.assign(payload, {
        startAt: row.startAt.toISOString(),
        endAt: row.endAt.toISOString(),
        durationMinutes: row.durationMinutes,
        days: Math.ceil(row.durationMinutes / 1440),
      });
    } else if (subject.subjectType === ApprovalSubjectType.MISSION) {
      const row = await db.mission.findUniqueOrThrow({
        where: { id: subject.subjectId },
        select: { startAt: true, endAt: true, estimatedCost: true },
      });
      Object.assign(payload, {
        startAt: row.startAt.toISOString(),
        endAt: row.endAt.toISOString(),
        days: Math.ceil(
          (row.endAt.getTime() - row.startAt.getTime()) / 86400000,
        ),
        amount: amount(row.estimatedCost),
      });
    } else if (subject.subjectType === ApprovalSubjectType.LOAN) {
      const row = await db.loan.findUniqueOrThrow({
        where: { id: subject.subjectId },
        select: { amount: true, installmentCount: true },
      });
      Object.assign(payload, {
        amount: amount(row.amount),
        installmentCount: row.installmentCount,
      });
    } else if (subject.subjectType === ApprovalSubjectType.PAYROLL) {
      const row = await db.payrollPeriod.findUniqueOrThrow({
        where: { id: subject.subjectId },
        select: { year: true, month: true, totalNet: true },
      });
      Object.assign(payload, {
        year: row.year,
        month: row.month,
        amount: amount(row.totalNet),
      });
    }
    return payload;
  }

  private async outcomeActor(
    ctx: ApprovalSubjectContext,
  ): Promise<AuthenticatedUser> {
    const user = ctx.actorId
      ? await this.access.buildAuthUser(ctx.actorId)
      : null;
    const permissions: Record<string, string> = {
      LEAVE: "leaves.approve",
      SHIFT_SWAP: "shifts.approve",
      MISSION: "missions.approve",
      LOAN: "loans.approve",
      ATTENDANCE_CORRECTION: "attendance.approve",
      TERMINATION: "lifecycle.manage",
      PAYROLL: "payroll.approve",
    };
    if (
      !user ||
      !this.access.hasPermission(user, permissions[ctx.subjectType] ?? "")
    )
      throw new ForbiddenException(
        "مجوز عملیاتی برای اعمال نتیجه گردش را ندارید.",
      );
    return user;
  }

  private async applyDomainOutcome(
    ctx: ApprovalSubjectContext,
    decision: "APPROVE" | "REJECT",
  ): Promise<void> {
    const user = await this.outcomeActor(ctx);
    const db = ctx.transaction ?? this.prisma;
    const status = decision === "APPROVE" ? "APPROVED" : "REJECTED";
    const dto = { decision, comment: ctx.comment ?? undefined };
    if (ctx.subjectType === ApprovalSubjectType.MISSION) {
      const row = await db.mission.findUniqueOrThrow({
        where: { id: ctx.subjectId },
        select: { status: true },
      });
      if (row.status !== status)
        await this.missions.decide(
          ctx.subjectId,
          decision,
          dto.comment,
          user,
          ctx.transaction,
        );
    } else if (ctx.subjectType === ApprovalSubjectType.LOAN) {
      const row = await db.loan.findUniqueOrThrow({
        where: { id: ctx.subjectId },
        select: { status: true },
      });
      if (
        row.status !== status &&
        !(
          decision === "APPROVE" && ["SETTLING", "SETTLED"].includes(row.status)
        )
      )
        await this.loans.decideLoan(ctx.subjectId, dto, user, ctx.transaction);
    } else if (ctx.subjectType === ApprovalSubjectType.ATTENDANCE_CORRECTION) {
      const row = await db.attendanceCorrection.findUniqueOrThrow({
        where: { id: ctx.subjectId },
        select: { status: true },
      });
      if (row.status !== status)
        await this.attendance.decideCorrection(
          ctx.subjectId,
          dto,
          user,
          ctx.transaction,
        );
    } else if (ctx.subjectType === ApprovalSubjectType.TERMINATION) {
      const row = await db.terminationRequest.findUniqueOrThrow({
        where: { id: ctx.subjectId },
        select: { status: true },
      });
      if (row.status !== status)
        await this.lifecycle.decideTermination(
          ctx.subjectId,
          dto,
          user,
          ctx.transaction,
        );
    } else if (
      ctx.subjectType === ApprovalSubjectType.PAYROLL &&
      decision === "APPROVE"
    ) {
      const row = await db.payrollPeriod.findUniqueOrThrow({
        where: { id: ctx.subjectId },
        select: { status: true },
      });
      if (row.status !== "LOCKED")
        await this.payroll.lock(ctx.subjectId, user.id, user, ctx.transaction);
    }
  }

  /* ---------------------------------------------------------------------
   * نگاشت خروجی
   * ------------------------------------------------------------------ */

  private toFlow(flow: any) {
    return {
      id: flow.id,
      code: flow.code,
      name: flow.name,
      subjectType: flow.subjectType,
      description: flow.description,
      version: flow.version,
      isActive: flow.isActive,
      companyId: flow.companyId,
      createdAt: flow.createdAt,
      updatedAt: flow.updatedAt,
      instanceCount: flow._count?.instances ?? undefined,
      steps: (flow.steps ?? []).map((s: any) => ({
        id: s.id,
        stepOrder: s.stepOrder,
        name: s.name,
        approverType: s.approverType,
        approverRoleCode: s.approverRoleCode,
        approverUserId: s.approverUserId,
        conditionJson: s.conditionJson,
        slaHours: s.slaHours,
        onTimeout: s.onTimeout,
        required: s.required,
      })),
    };
  }

  private toInstance(instance: any) {
    return {
      id: instance.id,
      flowId: instance.flowId,
      flowCode: instance.flow?.code ?? null,
      flowName: instance.flow?.name ?? null,
      flowVersion: instance.flowVersion,
      subjectType: instance.subjectType,
      subjectId: instance.subjectId,
      status: instance.status,
      currentStepOrder: instance.currentStepOrder,
      initiatedById: instance.initiatedById,
      initiatedByName: instance.initiator?.fullName ?? null,
      initiatedAt: instance.initiatedAt,
      completedAt: instance.completedAt,
      note: instance.note,
      payloadJson: instance.payloadJson,
      createdAt: instance.initiatedAt,
      tasks: (instance.tasks ?? []).map((t: any) => this.toTask(t)),
    };
  }

  private toTask(task: any) {
    return {
      id: task.id,
      instanceId: task.instanceId,
      stepId: task.stepId,
      stepOrder: task.stepOrder,
      stepName: task.step?.name ?? null,
      status: task.status,
      decision: task.decision,
      assigneeUserId: task.assigneeUserId,
      assigneeRoleCode: task.assigneeRoleCode,
      assigneeName: task.assignee?.fullName ?? null,
      decidedById: task.decidedById,
      decidedByName: task.decidedBy?.fullName ?? null,
      comment: task.comment,
      dueAt: task.dueAt,
      decidedAt: task.decidedAt,
      referredToUserId: task.referredToUserId,
      createdAt: task.createdAt,
      subjectType: task.instance?.subjectType ?? null,
      subjectId: task.instance?.subjectId ?? null,
      instanceStatus: task.instance?.status ?? null,
    };
  }

  /* ---------------------------------------------------------------------
   * هندلرهای پیش‌فرض — مرخصی
   * ------------------------------------------------------------------ */

  /** تأیید مرخصی: ثبت مصرف، تغییر وضعیت رکورد و به‌روزرسانی حضور و غیاب */
  private async applyLeaveApproved(ctx: ApprovalSubjectContext) {
    const user = await this.outcomeActor(ctx);
    const db = ctx.transaction ?? this.prisma;
    const record = await db.leaveRequest.findUnique({
      where: { id: ctx.subjectId },
      select: { status: true },
    });
    if (!record) throw new NotFoundException("موضوع گردش یافت نشد.");
    if (record.status === "APPROVED") return;
    await this.leaves.decide(
      ctx.subjectId,
      { decision: "APPROVE", comment: ctx.comment ?? undefined },
      user,
      ctx.transaction,
    );
  }

  /** رد مرخصی */
  private async applyLeaveRejected(ctx: ApprovalSubjectContext) {
    const user = await this.outcomeActor(ctx);
    const db = ctx.transaction ?? this.prisma;
    const record = await db.leaveRequest.findUnique({
      where: { id: ctx.subjectId },
      select: { status: true },
    });
    if (!record) throw new NotFoundException("موضوع گردش یافت نشد.");
    if (record.status === "REJECTED") return;
    await this.leaves.decide(
      ctx.subjectId,
      { decision: "REJECT", comment: ctx.comment ?? undefined },
      user,
      ctx.transaction,
    );
  }

  /** نیازمند اصلاح مرخصی — رزرو آزاد می‌شود تا دوباره ثبت شود */
  private async applyLeaveNeedsRevision(ctx: ApprovalSubjectContext) {
    const user = await this.outcomeActor(ctx);
    const db = ctx.transaction ?? this.prisma;
    const record = await db.leaveRequest.findUnique({
      where: { id: ctx.subjectId },
      select: { status: true },
    });
    if (!record) throw new NotFoundException("موضوع گردش یافت نشد.");
    if (record.status === "NEEDS_REVISION") return;
    await this.leaves.decide(
      ctx.subjectId,
      { decision: "NEEDS_REVISION", comment: ctx.comment ?? undefined },
      user,
      ctx.transaction,
    );
  }

  /** لغو مرخصی */
  private async applyLeaveCancelled(ctx: ApprovalSubjectContext) {
    const user = await this.outcomeActor(ctx);
    const db = ctx.transaction ?? this.prisma;
    const record = await db.leaveRequest.findUnique({
      where: { id: ctx.subjectId },
      select: { status: true },
    });
    if (!record) throw new NotFoundException("موضوع گردش یافت نشد.");
    if (record.status === "CANCELLED") return;
    await this.leaves.cancel(ctx.subjectId, user, ctx.transaction);
  }

  /** همگام‌سازی «مرحله فعلی» در درخواست مرخصی */
  private async applyLeaveStepAdvanced(ctx: ApprovalSubjectContext) {
    if (!ctx.stepOrder) return;
    await (ctx.transaction ?? this.prisma).leaveRequest.updateMany({
      where: { id: ctx.subjectId },
      data: { currentStep: ctx.stepOrder },
    });
  }

  /** مانده رزرو (منفی یعنی هنوز رزرو نشده) */

  /** فهرست روزهای کاری یک بازه (بر حسب نیمه‌شب UTC) */

  /* ---------------------------------------------------------------------
   * هندلرهای پیش‌فرض — تعویض شیفت
   * ------------------------------------------------------------------ */

  private async applyShiftSwapApproved(ctx: ApprovalSubjectContext) {
    const user = await this.outcomeActor(ctx);
    const db = ctx.transaction ?? this.prisma;
    const record = await db.shiftSwapRequest.findUnique({
      where: { id: ctx.subjectId },
      select: { status: true },
    });
    if (!record) throw new NotFoundException("موضوع گردش یافت نشد.");
    if (record.status === "APPROVED") return;
    await this.shifts.decideSwap(
      ctx.subjectId,
      { decision: "APPROVE", comment: ctx.comment ?? undefined },
      user,
      ctx.transaction,
    );
  }

  private async applyShiftSwapRejected(ctx: ApprovalSubjectContext) {
    const user = await this.outcomeActor(ctx);
    const db = ctx.transaction ?? this.prisma;
    const record = await db.shiftSwapRequest.findUnique({
      where: { id: ctx.subjectId },
      select: { status: true },
    });
    if (!record) throw new NotFoundException("موضوع گردش یافت نشد.");
    if (record.status === "REJECTED") return;
    await this.shifts.decideSwap(
      ctx.subjectId,
      { decision: "REJECT", comment: ctx.comment ?? undefined },
      user,
      ctx.transaction,
    );
  }
}
