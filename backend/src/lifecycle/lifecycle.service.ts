import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AuditAction,
  ChecklistItemStatus,
  ChecklistStatus,
  Prisma,
} from "@prisma/client";
import { PrismaService } from "../common/prisma/prisma.service";
import { AccessService } from "../common/access/access.service";
import { AuditService } from "../common/audit/audit.service";
import { NotificationService } from "../common/notifications/notification.service";
import { AuthenticatedUser } from "../common/decorators/current-user.decorator";
import { PaginationDto } from "../common/dto/pagination.dto";
import {
  ChecklistQueryDto,
  CreateOffboardingDto,
  CreateOnboardingTemplateDto,
  CreateTerminationRequestDto,
  DecideTerminationDto,
  OnboardingTemplateQueryDto,
  StartOnboardingDto,
  TerminationQueryDto,
  UpdateChecklistItemDto,
} from "./dto/lifecycle.dto";

@Injectable()
export class LifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
  ) {}

  // =========================================================================
  // قالب چک‌لیست ورود
  // =========================================================================

  async listTemplates(
    query: OnboardingTemplateQueryDto,
    pagination: PaginationDto,
    user: AuthenticatedUser,
  ) {
    const where: Prisma.OnboardingChecklistTemplateWhereInput = {
      AND: [await this.access.companyWhereFor(user)],
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.search
        ? { name: { contains: query.search, mode: "insensitive" } }
        : {}),
    };

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const [total, rows] = await Promise.all([
      this.prisma.onboardingChecklistTemplate.count({ where }),
      this.prisma.onboardingChecklistTemplate.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { items: true, checklists: true } } },
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

  async createTemplate(
    dto: CreateOnboardingTemplateDto,
    user: AuthenticatedUser,
  ) {
    await this.access.assertCompanyAccess(user, dto.companyId);
    const row = await this.prisma.onboardingChecklistTemplate.create({
      data: {
        companyId: dto.companyId,
        name: dto.name.trim(),
        appliesTo: dto.appliesTo ?? null,
        items: {
          create: dto.items.map((item, index) => ({
            title: item.title.trim(),
            sortOrder: item.sortOrder ?? index,
            isRequired: item.isRequired ?? true,
            requiresDocument: item.requiresDocument ?? false,
          })),
        },
      },
      include: { items: true },
    });

    await this.audit.record(user.id, {
      action: AuditAction.CREATE,
      entity: "OnboardingChecklistTemplate",
      entityId: row.id,
      after: { name: row.name, items: row.items.length },
    });

    return {
      data: { id: row.id },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  // =========================================================================
  // چک‌لیست ورود
  // =========================================================================

  async listChecklists(
    query: ChecklistQueryDto,
    pagination: PaginationDto,
    user: AuthenticatedUser,
  ) {
    const where: Prisma.OnboardingChecklistWhereInput = {
      employee: this.access.employeeWhereFor(user),
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const [total, rows] = await Promise.all([
      this.prisma.onboardingChecklist.count({ where }),
      this.prisma.onboardingChecklist.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          employee: {
            select: { id: true, code: true, firstName: true, lastName: true },
          },
          template: { select: { id: true, name: true } },
          _count: { select: { items: true } },
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

  /** شروع فرآیند ورود: ساخت چک‌لیست از قالب */
  async startOnboarding(dto: StartOnboardingDto, user: AuthenticatedUser) {
    return this.prisma.$transaction(
      async (db) => {
        await db.$queryRaw`SELECT id FROM "Employee" WHERE id = ${dto.employeeId}::uuid FOR UPDATE`;

        const ok = await this.access.canAccessEmployee(user, dto.employeeId);
        if (!ok)
          throw new ForbiddenException("به پرونده این نیرو دسترسی ندارید.");

        const template = await db.onboardingChecklistTemplate.findUnique({
          where: { id: dto.templateId },
          include: { items: { orderBy: { sortOrder: "asc" } } },
        });
        if (!template || !template.isActive)
          throw new NotFoundException("قالب چک‌لیست یافت نشد یا غیرفعال است.");
        await this.access.assertCompanyMember(user, template.companyId, {
          employeeId: dto.employeeId,
        });

        const duplicate = await db.onboardingChecklist.findFirst({
          where: {
            employeeId: dto.employeeId,
            status: { not: ChecklistStatus.CANCELLED },
          },
          select: { id: true },
        });
        if (duplicate)
          throw new BadRequestException(
            "فرآیند ورود فعال دیگری برای این نیرو وجود دارد.",
          );

        const checklist = await db.onboardingChecklist.create({
          data: {
            employeeId: dto.employeeId,
            templateId: dto.templateId,
            status: ChecklistStatus.IN_PROGRESS,
            startedAt: new Date(),
            items: {
              create: template.items.map((item) => ({
                definitionId: item.id,
                title: item.title,
              })),
            },
          },
          include: { items: true },
        });

        await this.audit.recordInTransaction(db, user.id, {
          action: AuditAction.CREATE,
          entity: "OnboardingChecklist",
          entityId: checklist.id,
          after: { employeeId: dto.employeeId, templateId: dto.templateId },
        });

        return {
          data: { id: checklist.id, itemsCount: checklist.items.length },
          success: true,
          timestamp: new Date().toISOString(),
        };
      },
      { maxWait: 10000, timeout: 30000 },
    );
  }

  async getChecklist(id: string, user: AuthenticatedUser) {
    const checklist = await this.prisma.onboardingChecklist.findUnique({
      where: { id },
      include: { items: { orderBy: { definitionId: "asc" } } },
    });
    if (!checklist) throw new NotFoundException("چک‌لیست یافت نشد.");
    const ok = await this.access.canAccessEmployee(user, checklist.employeeId);
    if (!ok) throw new ForbiddenException("به این چک‌لیست دسترسی ندارید.");
    return {
      data: checklist,
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  /** ثبت وضعیت یک قلم چک‌لیست + به‌روزرسانی وضعیت کلی */
  async updateChecklistItem(
    itemId: string,
    dto: UpdateChecklistItemDto,
    user: AuthenticatedUser,
  ) {
    return this.prisma.$transaction(
      async (db) => {
        const reference = await db.onboardingChecklistItem.findUnique({
          where: { id: itemId },
          select: { checklistId: true },
        });
        if (!reference) throw new NotFoundException("قلم چک‌لیست یافت نشد.");
        await db.$queryRaw`SELECT id FROM "OnboardingChecklist" WHERE id = ${reference.checklistId}::uuid FOR UPDATE`;

        const item = await db.onboardingChecklistItem.findUnique({
          where: { id: itemId },
          include: { checklist: { include: { items: true } } },
        });
        if (!item) throw new NotFoundException("قلم چک‌لیست یافت نشد.");
        const ok = await this.access.canAccessEmployee(
          user,
          item.checklist.employeeId,
        );
        if (!ok) throw new ForbiddenException("به این چک‌لیست دسترسی ندارید.");

        await db.onboardingChecklistItem.update({
          where: { id: itemId },
          data: {
            status: dto.status,
            note: dto.note ?? item.note,
            evidencePath: dto.evidencePath ?? item.evidencePath,
            completedById:
              dto.status === ChecklistItemStatus.DONE ? user.id : null,
            completedAt:
              dto.status === ChecklistItemStatus.DONE ? new Date() : null,
          },
        });

        // محاسبه وضعیت کلی چک‌لیست
        const items = await db.onboardingChecklistItem.findMany({
          where: { checklistId: item.checklistId },
          select: { status: true },
        });
        const pending = items.filter(
          (i) =>
            i.status === ChecklistItemStatus.PENDING ||
            i.status === ChecklistItemStatus.BLOCKED,
        );
        const touched = items.filter(
          (i) => i.status !== ChecklistItemStatus.PENDING,
        );
        const checklistStatus =
          pending.length === 0
            ? ChecklistStatus.COMPLETED
            : touched.length > 0
              ? ChecklistStatus.IN_PROGRESS
              : item.checklist.status;

        await db.onboardingChecklist.update({
          where: { id: item.checklistId },
          data: {
            status: checklistStatus,
            completedAt:
              checklistStatus === ChecklistStatus.COMPLETED ? new Date() : null,
          },
        });

        await this.audit.recordInTransaction(db, user.id, {
          action: AuditAction.UPDATE,
          entity: "OnboardingChecklistItem",
          entityId: itemId,
          after: { status: dto.status },
        });

        return {
          data: { id: itemId, checklistStatus },
          success: true,
          timestamp: new Date().toISOString(),
        };
      },
      { maxWait: 10000, timeout: 30000 },
    );
  }

  // =========================================================================
  // چک‌لیست خروج
  // =========================================================================

  async listOffboarding(
    query: ChecklistQueryDto,
    pagination: PaginationDto,
    user: AuthenticatedUser,
  ) {
    const where: Prisma.OffboardingChecklistWhereInput = {
      employee: this.access.employeeWhereFor(user),
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const [total, rows] = await Promise.all([
      this.prisma.offboardingChecklist.count({ where }),
      this.prisma.offboardingChecklist.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          employee: {
            select: { id: true, code: true, firstName: true, lastName: true },
          },
          _count: { select: { items: true } },
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

  /** آغاز فرآیند خروج با چک‌لیست تسویه */
  async startOffboarding(dto: CreateOffboardingDto, user: AuthenticatedUser) {
    return this.prisma.$transaction(
      async (db) => {
        await db.$queryRaw`SELECT id FROM "Employee" WHERE id = ${dto.employeeId}::uuid FOR UPDATE`;

        await this.access.assertEmployeeMutable(user, dto.employeeId, true);
        const ok = await this.access.canAccessEmployee(user, dto.employeeId);
        if (!ok)
          throw new ForbiddenException("به پرونده این نیرو دسترسی ندارید.");

        const employee = await db.employee.findUnique({
          where: { id: dto.employeeId },
          select: { userId: true, code: true, firstName: true, lastName: true },
        });
        if (!employee) throw new NotFoundException("نیروی موردنظر یافت نشد.");
        if (
          await db.offboardingChecklist.count({
            where: {
              employeeId: dto.employeeId,
              status: { not: ChecklistStatus.CANCELLED },
            },
          })
        ) {
          throw new BadRequestException(
            "فرآیند خروج دیگری برای این نیرو وجود دارد.",
          );
        }

        const defaultItems = dto.items?.length
          ? dto.items.map((i) => i.title.trim())
          : [
              "تحویل دارایی‌ها و ابزار کار",
              "تسویه مالی و مطالبات",
              "بستن دسترسی‌های سامانه‌ای",
              "تحویل مستندات و پرونده",
              "گفت‌وگوی پایانی (Exit Interview)",
            ];

        const checklist = await db.offboardingChecklist.create({
          data: {
            employeeId: dto.employeeId,
            reason: dto.reason,
            terminationDate: new Date(dto.terminationDate),
            status: ChecklistStatus.IN_PROGRESS,
            items: {
              create: defaultItems.map((title) => ({ title })),
            },
          },
          include: { items: true },
        });

        // به‌روزرسانی وضعیت نیرو
        await db.employee.update({
          where: { id: dto.employeeId },
          data: {
            status: "TERMINATED",
            terminationDate: new Date(dto.terminationDate),
          },
        });

        await this.audit.recordInTransaction(db, user.id, {
          action: AuditAction.CREATE,
          entity: "OffboardingChecklist",
          entityId: checklist.id,
          after: { employeeId: dto.employeeId, reason: dto.reason },
        });

        if (employee.userId) {
          await this.notifications.notify(
            employee.userId,
            {
              type: "SYSTEM",
              title: "فرآیند تسویه شما آغاز شد",
              body: "چک‌لیست خروج برای شما ایجاد شد.",
              link: `/lifecycle/offboarding/${checklist.id}`,
            },
            db,
          );
        }

        return {
          data: { id: checklist.id, itemsCount: checklist.items.length },
          success: true,
          timestamp: new Date().toISOString(),
        };
      },
      { maxWait: 10000, timeout: 30000 },
    );
  }

  async getOffboarding(id: string, user: AuthenticatedUser) {
    const checklist = await this.prisma.offboardingChecklist.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!checklist) throw new NotFoundException("چک‌لیست خروج یافت نشد.");
    const ok = await this.access.canAccessEmployee(user, checklist.employeeId);
    if (!ok) throw new ForbiddenException("به این چک‌لیست دسترسی ندارید.");
    return {
      data: checklist,
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  /** تکمیل قلم چک‌لیست خروج */
  async updateOffboardingItem(
    itemId: string,
    dto: UpdateChecklistItemDto,
    user: AuthenticatedUser,
  ) {
    return this.prisma.$transaction(
      async (db) => {
        const reference = await db.offboardingChecklistItem.findUnique({
          where: { id: itemId },
          select: { checklistId: true },
        });
        if (!reference) throw new NotFoundException("قلم چک‌لیست یافت نشد.");
        await db.$queryRaw`SELECT id FROM "OffboardingChecklist" WHERE id = ${reference.checklistId}::uuid FOR UPDATE`;

        const item = await db.offboardingChecklistItem.findUnique({
          where: { id: itemId },
          include: { checklist: true },
        });
        if (!item) throw new NotFoundException("قلم چک‌لیست یافت نشد.");
        const ok = await this.access.canAccessEmployee(
          user,
          item.checklist.employeeId,
        );
        if (!ok) throw new ForbiddenException("به این چک‌لیست دسترسی ندارید.");

        await db.offboardingChecklistItem.update({
          where: { id: itemId },
          data: {
            status: dto.status,
            note: dto.note ?? item.note,
            completedAt:
              dto.status === ChecklistItemStatus.DONE ? new Date() : null,
          },
        });

        const items = await db.offboardingChecklistItem.findMany({
          where: { checklistId: item.checklistId },
          select: { status: true },
        });
        const pending = items.filter(
          (i) =>
            i.status !== ChecklistItemStatus.DONE &&
            i.status !== ChecklistItemStatus.SKIPPED,
        );
        const checklistStatus =
          pending.length === 0
            ? ChecklistStatus.COMPLETED
            : ChecklistStatus.IN_PROGRESS;

        await db.offboardingChecklist.update({
          where: { id: item.checklistId },
          data: {
            status: checklistStatus,
            completedAt:
              checklistStatus === ChecklistStatus.COMPLETED ? new Date() : null,
          },
        });

        await this.audit.recordInTransaction(db, user.id, {
          action: AuditAction.UPDATE,
          entity: "OffboardingChecklistItem",
          entityId: itemId,
          after: { status: dto.status },
        });

        return {
          data: { id: itemId, checklistStatus },
          success: true,
          timestamp: new Date().toISOString(),
        };
      },
      { maxWait: 10000, timeout: 30000 },
    );
  }

  // =========================================================================
  // درخواست خاتمه همکاری
  // =========================================================================

  async listTerminations(
    query: TerminationQueryDto,
    pagination: PaginationDto,
    user: AuthenticatedUser,
  ) {
    const where: Prisma.TerminationRequestWhereInput = {
      employee: this.access.employeeWhereFor(user),
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const [total, rows] = await Promise.all([
      this.prisma.terminationRequest.count({ where }),
      this.prisma.terminationRequest.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          employee: {
            select: { id: true, code: true, firstName: true, lastName: true },
          },
        },
      }),
    ]);

    // نام تأییدکننده‌ها (مدل رابطه مستقیم ندارد)
    const approverIds = [
      ...new Set(rows.map((r) => r.approvedById).filter(Boolean)),
    ] as string[];
    const approvers = approverIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: approverIds } },
          select: { id: true, fullName: true },
        })
      : [];

    return {
      data: rows.map((r) => ({
        ...r,
        approvedBy: approvers.find((u) => u.id === r.approvedById) ?? null,
      })),
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

  async createTermination(
    dto: CreateTerminationRequestDto,
    user: AuthenticatedUser,
  ) {
    await this.access.assertEmployeeMutable(user, dto.employeeId, true);
    const ok = await this.access.canAccessEmployee(user, dto.employeeId);
    if (!ok) throw new ForbiddenException("به پرونده این نیرو دسترسی ندارید.");

    const row = await this.prisma.terminationRequest.create({
      data: {
        employeeId: dto.employeeId,
        reason: dto.reason,
        terminationDate: new Date(dto.terminationDate),
        note: dto.note ?? null,
        status: "REQUESTED",
      },
    });

    await this.audit.record(user.id, {
      action: AuditAction.CREATE,
      entity: "TerminationRequest",
      entityId: row.id,
      after: { employeeId: dto.employeeId, reason: dto.reason },
    });

    return {
      data: { id: row.id },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  /** تصمیم خاتمه — قاعده سرور: هیچ‌کس درخواست خودش را تأیید نمی‌کند */
  async decideTermination(
    id: string,
    dto: DecideTerminationDto,
    user: AuthenticatedUser,
    transaction?: Prisma.TransactionClient,
  ) {
    const run = async (db: Prisma.TransactionClient) => {
      await db.$queryRaw`SELECT id FROM "TerminationRequest" WHERE id = ${id}::uuid FOR UPDATE`;

      const request = await db.terminationRequest.findUnique({
        where: { id },
        include: { employee: { select: { id: true, userId: true } } },
      });
      if (!request) throw new NotFoundException("درخواست خاتمه یافت نشد.");
      if (request.status !== "REQUESTED")
        throw new BadRequestException("این درخواست قبلاً بررسی شده است.");
      await this.access.assertEmployeeAccess(user, request.employeeId);
      await this.access.assertEmployeeMutable(user, request.employeeId, true);

      const requester = await db.terminationRequest.findFirst({
        where: { id },
        select: { employee: { select: { user: { select: { id: true } } } } },
      });
      const requesterUserId = requester?.employee?.user?.id;
      if (requesterUserId === user.id && !user.isSuperAdmin) {
        throw new ForbiddenException(
          "هیچ‌کس اجازه تأیید خاتمه همکاری خودش را ندارد.",
        );
      }

      const approved = dto.decision === "APPROVE";
      await db.terminationRequest.update({
        where: { id },
        data: {
          status: approved ? "APPROVED" : "REJECTED",
          approvedById: approved ? user.id : null,
          note: dto.comment ?? request.note,
        },
      });

      await this.audit.recordInTransaction(db, user.id, {
        action: approved ? AuditAction.APPROVE : AuditAction.REJECT,
        entity: "TerminationRequest",
        entityId: id,
        after: { decision: dto.decision, comment: dto.comment },
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
