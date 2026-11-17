import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AuditAction, NotificationType } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../common/prisma/prisma.service";
import { AuditService } from "../common/audit/audit.service";
import { AccessService } from "../common/access/access.service";
import { NotificationService } from "../common/notifications/notification.service";
import { AuthenticatedUser } from "../common/decorators/current-user.decorator";
import {
  CreateEvaluationCycleDto,
  CreateEvaluationFeedbackDto,
  CreateEvaluationFormDto,
  CreateGoalDto,
  EmployeeResponseDto,
  EvaluationCycleQueryDto,
  EvaluationFormQueryDto,
  EvaluationItemInputDto,
  EvaluationQueryDto,
  EVALUATION_FORM_WEIGHT_TOTAL,
  GoalQueryDto,
  SelfAssessDto,
  StartEvaluationCycleDto,
  SupervisorAssessDto,
  UpdateEvaluationCycleDto,
  UpdateEvaluationFormDto,
  UpdateEvaluationItemDto,
  UpdateGoalDto,
} from "./dto/evaluations.dto";

@Injectable()
export class EvaluationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly access: AccessService,
    private readonly notifications: NotificationService,
  ) {}

  // =========================================================================
  // فرم ارزیابی
  // =========================================================================

  async listForms(query: EvaluationFormQueryDto, user: AuthenticatedUser) {
    const where: Prisma.EvaluationFormWhereInput = {
      AND: [await this.access.companyWhereFor(user)],
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" } },
              { description: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.evaluationForm.count({ where }),
      this.prisma.evaluationForm.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: "desc" },
        include: {
          items: { orderBy: { sortOrder: "asc" } },
          _count: { select: { cycles: true } },
        },
      }),
    ]);

    return this.paginated(
      rows.map((f) => ({
        ...f,
        totalWeight: f.items.reduce((sum, i) => sum + i.weight, 0),
        itemCount: f.items.length,
        cycleCount: f._count.cycles,
        _count: undefined,
      })),
      total,
      query,
    );
  }

  async getForm(id: string, user: AuthenticatedUser) {
    const form = await this.prisma.evaluationForm.findUnique({
      where: { id },
      include: {
        items: { orderBy: { sortOrder: "asc" } },
        cycles: { orderBy: { startDate: "desc" } },
      },
    });
    if (!form) throw new NotFoundException("فرم ارزیابی موردنظر یافت نشد.");
    await this.access.assertCompanyAccess(user, form.companyId);
    return {
      ...form,
      totalWeight: form.items.reduce((sum, i) => sum + i.weight, 0),
    };
  }

  async createForm(dto: CreateEvaluationFormDto, user: AuthenticatedUser) {
    const actorId = user.id;
    if (dto.items?.length) this.assertWeightSum(dto.items);

    const companyId = await this.resolveCompanyId(dto.companyId, user);

    const form = await this.prisma.evaluationForm.create({
      data: {
        companyId,
        name: dto.name.trim(),
        description: dto.description ?? null,
        isActive: dto.isActive ?? true,
        items: dto.items?.length
          ? {
              create: dto.items.map((i) => this.itemData(i)),
            }
          : undefined,
      },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });

    await this.audit.record(actorId, {
      action: AuditAction.CREATE,
      entity: "EvaluationForm",
      entityId: form.id,
      after: { name: form.name, itemCount: form.items.length },
    });

    return form;
  }

  async updateForm(
    id: string,
    dto: UpdateEvaluationFormDto,
    user: AuthenticatedUser,
  ) {
    return this.prisma.$transaction(
      async (db) => {
        await db.$queryRaw`SELECT id FROM "EvaluationForm" WHERE id = ${id}::uuid FOR UPDATE`;

        const actorId = user.id;
        const form = await db.evaluationForm.findUnique({
          where: { id },
          include: { items: true },
        });
        if (!form) throw new NotFoundException("فرم ارزیابی موردنظر یافت نشد.");
        await this.access.assertCompanyAccess(user, form.companyId);

        const before = {
          name: form.name,
          isActive: form.isActive,
          totalWeight: form.items.reduce((s, i) => s + i.weight, 0),
        };

        let replacedItems:
          Array<ReturnType<EvaluationsService["itemData"]>> | undefined;
        if (dto.items) {
          await this.assertFormUnscored(id, db);
          this.assertWeightSum(dto.items);
          replacedItems = dto.items.map((i) => this.itemData(i));
        }

        const updated = await (async () => {
          const tx = db;
          if (replacedItems) {
            await tx.evaluationScore.deleteMany({
              where: { itemId: { in: form.items.map((i) => i.id) } },
            });
            await tx.evaluationItem.deleteMany({ where: { formId: id } });
            await tx.evaluationItem.createMany({
              data: replacedItems.map((i) => ({ ...i, formId: id })),
            });
          }
          return tx.evaluationForm.update({
            where: { id },
            data: {
              ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
              ...(dto.description !== undefined
                ? { description: dto.description }
                : {}),
              ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
            },
            include: { items: { orderBy: { sortOrder: "asc" } } },
          });
        })();

        await this.audit.recordInTransaction(db, actorId, {
          action: AuditAction.UPDATE,
          entity: "EvaluationForm",
          entityId: id,
          before,
          after: {
            name: updated.name,
            isActive: updated.isActive,
            totalWeight: updated.items.reduce((s, i) => s + i.weight, 0),
          },
        });

        return updated;
      },
      { maxWait: 10000, timeout: 30000 },
    );
  }

  async deleteForm(id: string, user: AuthenticatedUser) {
    return this.prisma.$transaction(
      async (db) => {
        await db.$queryRaw`SELECT id FROM "EvaluationForm" WHERE id = ${id}::uuid FOR UPDATE`;

        const actorId = user.id;
        const form = await db.evaluationForm.findUnique({
          where: { id },
          include: { _count: { select: { cycles: true } } },
        });
        if (!form) throw new NotFoundException("فرم ارزیابی موردنظر یافت نشد.");
        await this.access.assertCompanyAccess(user, form.companyId);
        if (form._count.cycles > 0) {
          throw new BadRequestException(
            "این فرم به دوره ارزیابی متصل است و قابل حذف نیست.",
          );
        }

        await db.evaluationForm.delete({ where: { id } });
        await this.audit.recordInTransaction(db, actorId, {
          action: AuditAction.DELETE,
          entity: "EvaluationForm",
          entityId: id,
          before: { name: form.name },
        });
        return { success: true };
      },
      { maxWait: 10000, timeout: 30000 },
    );
  }

  async listItems(formId: string, user: AuthenticatedUser) {
    const form = await this.prisma.evaluationForm.findUnique({
      where: { id: formId },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });
    if (!form) throw new NotFoundException("فرم ارزیابی موردنظر یافت نشد.");
    await this.access.assertCompanyAccess(user, form.companyId);
    return {
      ...form,
      totalWeight: form.items.reduce((s, i) => s + i.weight, 0),
    };
  }

  /** جایگزینی کامل سؤالات فرم — مجموع وزن باید دقیقاً ۱۰۰ باشد */
  async replaceItems(
    formId: string,
    items: EvaluationItemInputDto[],
    user: AuthenticatedUser,
  ) {
    return this.prisma.$transaction(
      async (db) => {
        await db.$queryRaw`SELECT id FROM "EvaluationForm" WHERE id = ${formId}::uuid FOR UPDATE`;

        const actorId = user.id;
        await this.assertFormUnscored(formId, db);
        const form = await db.evaluationForm.findUnique({
          where: { id: formId },
          include: { items: true },
        });
        if (!form) throw new NotFoundException("فرم ارزیابی موردنظر یافت نشد.");
        await this.access.assertCompanyAccess(user, form.companyId);
        this.assertWeightSum(items);

        const updated = await (async () => {
          const tx = db;
          await tx.evaluationScore.deleteMany({
            where: { itemId: { in: form.items.map((i) => i.id) } },
          });
          await tx.evaluationItem.deleteMany({ where: { formId } });
          await tx.evaluationItem.createMany({
            data: items.map((i) => ({ ...this.itemData(i), formId })),
          });
          return tx.evaluationForm.findUnique({
            where: { id: formId },
            include: { items: { orderBy: { sortOrder: "asc" } } },
          });
        })();

        await this.audit.recordInTransaction(db, actorId, {
          action: AuditAction.UPDATE,
          entity: "EvaluationForm",
          entityId: formId,
          before: { totalWeight: form.items.reduce((s, i) => s + i.weight, 0) },
          after: {
            totalWeight: items.reduce((s, i) => s + i.weight, 0),
            itemCount: items.length,
          },
        });

        return updated;
      },
      { maxWait: 10000, timeout: 30000 },
    );
  }

  async createItem(
    formId: string,
    dto: EvaluationItemInputDto,
    user: AuthenticatedUser,
  ) {
    return this.prisma.$transaction(
      async (db) => {
        await db.$queryRaw`SELECT id FROM "EvaluationForm" WHERE id = ${formId}::uuid FOR UPDATE`;

        const actorId = user.id;
        await this.assertFormUnscored(formId, db);
        const form = await db.evaluationForm.findUnique({
          where: { id: formId },
          include: { items: true },
        });
        if (!form) throw new NotFoundException("فرم ارزیابی موردنظر یافت نشد.");
        await this.access.assertCompanyAccess(user, form.companyId);

        const current = form.items.reduce((s, i) => s + i.weight, 0);
        const newTotal = current + (dto.weight ?? 0);
        if (newTotal > EVALUATION_FORM_WEIGHT_TOTAL) {
          throw new BadRequestException(
            `مجموع وزن سؤالات فرم نباید از ${EVALUATION_FORM_WEIGHT_TOTAL} بیشتر باشد (مجموع فعلی: ${newTotal}).`,
          );
        }

        const item = await db.evaluationItem.create({
          data: { ...this.itemData(dto), formId },
        });

        await this.audit.recordInTransaction(db, actorId, {
          action: AuditAction.CREATE,
          entity: "EvaluationItem",
          entityId: item.id,
          after: { title: item.title, weight: item.weight, formId },
        });

        return { ...item, totalWeight: newTotal };
      },
      { maxWait: 10000, timeout: 30000 },
    );
  }

  async updateItem(
    itemId: string,
    dto: UpdateEvaluationItemDto,
    user: AuthenticatedUser,
  ) {
    return this.prisma.$transaction(
      async (db) => {
        const reference = await db.evaluationItem.findUnique({
          where: { id: itemId },
          select: { formId: true },
        });
        if (!reference) throw new NotFoundException("سؤال ارزیابی یافت نشد.");
        await db.$queryRaw`SELECT id FROM "EvaluationForm" WHERE id = ${reference.formId}::uuid FOR UPDATE`;

        const actorId = user.id;
        const item = await db.evaluationItem.findUnique({
          where: { id: itemId },
          include: { form: { include: { items: true } } },
        });
        if (!item)
          throw new NotFoundException("سؤال ارزیابی موردنظر یافت نشد.");
        await this.access.assertCompanyAccess(user, item.form.companyId);
        await this.assertFormUnscored(item.formId, db);

        const before = {
          title: item.title,
          weight: item.weight,
          scaleType: item.scaleType,
        };

        if (dto.weight !== undefined) {
          const others = item.form.items
            .filter((i) => i.id !== itemId)
            .reduce((s, i) => s + i.weight, 0);
          const newTotal = others + dto.weight;
          if (newTotal > EVALUATION_FORM_WEIGHT_TOTAL) {
            throw new BadRequestException(
              `مجموع وزن سؤالات فرم نباید از ${EVALUATION_FORM_WEIGHT_TOTAL} بیشتر باشد (مجموع فعلی: ${newTotal}).`,
            );
          }
        }

        const updated = await db.evaluationItem.update({
          where: { id: itemId },
          data: {
            ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
            ...(dto.description !== undefined
              ? { description: dto.description }
              : {}),
            ...(dto.weight !== undefined ? { weight: dto.weight } : {}),
            ...(dto.scaleType !== undefined
              ? { scaleType: dto.scaleType }
              : {}),
            ...(dto.minScore !== undefined ? { minScore: dto.minScore } : {}),
            ...(dto.maxScore !== undefined ? { maxScore: dto.maxScore } : {}),
            ...(dto.isKPI !== undefined ? { isKPI: dto.isKPI } : {}),
            ...(dto.evidenceRequired !== undefined
              ? { evidenceRequired: dto.evidenceRequired }
              : {}),
            ...(dto.sortOrder !== undefined
              ? { sortOrder: dto.sortOrder }
              : {}),
          },
        });

        await this.audit.recordInTransaction(db, actorId, {
          action: AuditAction.UPDATE,
          entity: "EvaluationItem",
          entityId: itemId,
          before,
          after: {
            title: updated.title,
            weight: updated.weight,
            scaleType: updated.scaleType,
          },
        });

        return updated;
      },
      { maxWait: 10000, timeout: 30000 },
    );
  }

  async deleteItem(itemId: string, user: AuthenticatedUser) {
    return this.prisma.$transaction(
      async (db) => {
        const reference = await db.evaluationItem.findUnique({
          where: { id: itemId },
          select: { formId: true },
        });
        if (!reference) throw new NotFoundException("سؤال ارزیابی یافت نشد.");
        await db.$queryRaw`SELECT id FROM "EvaluationForm" WHERE id = ${reference.formId}::uuid FOR UPDATE`;

        const actorId = user.id;
        const item = await db.evaluationItem.findUnique({
          where: { id: itemId },
          include: { form: true },
        });
        if (!item)
          throw new NotFoundException("سؤال ارزیابی موردنظر یافت نشد.");
        await this.access.assertCompanyAccess(user, item.form.companyId);
        await this.assertFormUnscored(item.formId, db);

        await db.evaluationItem.delete({ where: { id: itemId } });
        await this.audit.recordInTransaction(db, actorId, {
          action: AuditAction.DELETE,
          entity: "EvaluationItem",
          entityId: itemId,
          before: { title: item.title, weight: item.weight },
        });
        return { success: true };
      },
      { maxWait: 10000, timeout: 30000 },
    );
  }

  // =========================================================================
  // دوره ارزیابی
  // =========================================================================

  async listCycles(query: EvaluationCycleQueryDto, user: AuthenticatedUser) {
    const where: Prisma.EvaluationCycleWhereInput = {
      AND: [await this.access.companyWhereFor(user)],
      ...(query.formId ? { formId: query.formId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.periodType ? { periodType: query.periodType } : {}),
      ...(query.search
        ? { name: { contains: query.search, mode: "insensitive" } }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.evaluationCycle.count({ where }),
      this.prisma.evaluationCycle.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { startDate: "desc" },
        include: {
          form: { select: { id: true, name: true, version: true } },
          _count: { select: { evaluations: true } },
        },
      }),
    ]);

    return this.paginated(
      rows.map((c) => ({
        ...c,
        evaluationCount: c._count.evaluations,
        _count: undefined,
      })),
      total,
      query,
    );
  }

  async getCycle(id: string, user: AuthenticatedUser) {
    const cycle = await this.prisma.evaluationCycle.findUnique({
      where: { id },
      include: {
        form: { include: { items: { orderBy: { sortOrder: "asc" } } } },
        _count: { select: { evaluations: true } },
      },
    });
    if (!cycle) throw new NotFoundException("دوره ارزیابی موردنظر یافت نشد.");
    await this.access.assertCompanyAccess(user, cycle.companyId);
    return { ...cycle, evaluationCount: cycle._count.evaluations };
  }

  async createCycle(dto: CreateEvaluationCycleDto, user: AuthenticatedUser) {
    return this.prisma.$transaction(
      async (db) => {
        await db.$queryRaw`SELECT id FROM "EvaluationForm" WHERE id = ${dto.formId}::uuid FOR UPDATE`;

        const actorId = user.id;
        const form = await db.evaluationForm.findUnique({
          where: { id: dto.formId },
        });
        if (!form) throw new NotFoundException("فرم ارزیابی موردنظر یافت نشد.");
        await this.access.assertCompanyAccess(user, form.companyId);

        const startDate = new Date(dto.startDate);
        const endDate = new Date(dto.endDate);
        if (startDate > endDate) {
          throw new BadRequestException(
            "تاریخ شروع دوره نمی‌تواند بعد از تاریخ پایان باشد.",
          );
        }
        if (dto.dueDate && new Date(dto.dueDate) < startDate) {
          throw new BadRequestException(
            "تاریخ سررسید دوره نمی‌تواند قبل از تاریخ شروع باشد.",
          );
        }

        const companyId = dto.companyId ?? form.companyId;
        if (dto.companyId && dto.companyId !== form.companyId) {
          throw new BadRequestException(
            "شرکت دوره ارزیابی باید با شرکت فرم یکسان باشد.",
          );
        }

        const cycle = await db.evaluationCycle.create({
          data: {
            companyId,
            formId: dto.formId,
            name: dto.name.trim(),
            periodType: dto.periodType ?? "QUARTERLY",
            startDate,
            endDate,
            dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
            status: dto.status ?? "PLANNED",
          },
          include: { form: { select: { id: true, name: true } } },
        });

        await this.audit.recordInTransaction(db, actorId, {
          action: AuditAction.CREATE,
          entity: "EvaluationCycle",
          entityId: cycle.id,
          after: {
            name: cycle.name,
            formId: cycle.formId,
            periodType: cycle.periodType,
          },
        });

        return cycle;
      },
      { maxWait: 10000, timeout: 30000 },
    );
  }

  async updateCycle(
    id: string,
    dto: UpdateEvaluationCycleDto,
    user: AuthenticatedUser,
  ) {
    return this.prisma.$transaction(
      async (db) => {
        await db.$queryRaw`SELECT id FROM "EvaluationCycle" WHERE id = ${id}::uuid FOR UPDATE`;

        const actorId = user.id;
        const cycle = await db.evaluationCycle.findUnique({ where: { id } });
        if (!cycle)
          throw new NotFoundException("دوره ارزیابی موردنظر یافت نشد.");
        await this.access.assertCompanyAccess(user, cycle.companyId);
        if (dto.formId && dto.formId !== cycle.formId) {
          const form = await db.evaluationForm.findFirst({
            where: { id: dto.formId, companyId: cycle.companyId },
            select: { id: true },
          });
          if (!form)
            throw new BadRequestException("فرم به شرکت این دوره تعلق ندارد.");
          if (await db.evaluation.count({ where: { cycleId: id } }))
            throw new BadRequestException(
              "فرم دوره دارای ارزیابی قابل تغییر نیست.",
            );
        }

        const startDate = dto.startDate
          ? new Date(dto.startDate)
          : cycle.startDate;
        const endDate = dto.endDate ? new Date(dto.endDate) : cycle.endDate;
        if (startDate > endDate) {
          throw new BadRequestException(
            "تاریخ شروع دوره نمی‌تواند بعد از تاریخ پایان باشد.",
          );
        }

        const before = {
          name: cycle.name,
          status: cycle.status,
          startDate: cycle.startDate,
          endDate: cycle.endDate,
        };

        const updated = await db.evaluationCycle.update({
          where: { id },
          data: {
            ...(dto.formId !== undefined ? { formId: dto.formId } : {}),
            ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
            ...(dto.periodType !== undefined
              ? { periodType: dto.periodType }
              : {}),
            ...(dto.startDate !== undefined ? { startDate } : {}),
            ...(dto.endDate !== undefined ? { endDate } : {}),
            ...(dto.dueDate !== undefined
              ? { dueDate: dto.dueDate ? new Date(dto.dueDate) : null }
              : {}),
            ...(dto.status !== undefined ? { status: dto.status } : {}),
          },
        });

        await this.audit.recordInTransaction(db, actorId, {
          action: AuditAction.UPDATE,
          entity: "EvaluationCycle",
          entityId: id,
          before,
          after: { name: updated.name, status: updated.status },
        });

        return updated;
      },
      { maxWait: 10000, timeout: 30000 },
    );
  }

  async deleteCycle(id: string, user: AuthenticatedUser) {
    return this.prisma.$transaction(
      async (db) => {
        await db.$queryRaw`SELECT id FROM "EvaluationCycle" WHERE id = ${id}::uuid FOR UPDATE`;

        const actorId = user.id;
        const cycle = await db.evaluationCycle.findUnique({
          where: { id },
          include: { _count: { select: { evaluations: true } } },
        });
        if (!cycle)
          throw new NotFoundException("دوره ارزیابی موردنظر یافت نشد.");
        await this.access.assertCompanyAccess(user, cycle.companyId);
        if (cycle._count.evaluations > 0) {
          throw new BadRequestException(
            "این دوره دارای رکورد ارزیابی است و قابل حذف نیست.",
          );
        }

        await db.evaluationCycle.delete({ where: { id } });
        await this.audit.recordInTransaction(db, actorId, {
          action: AuditAction.DELETE,
          entity: "EvaluationCycle",
          entityId: id,
          before: { name: cycle.name },
        });
        return { success: true };
      },
      { maxWait: 10000, timeout: 30000 },
    );
  }

  /** آغاز دوره ارزیابی — ساخت رکورد خودارزیابی و ارزیابی سرپرست برای کارکنان حوزه */
  async startCycle(
    id: string,
    dto: StartEvaluationCycleDto,
    user: AuthenticatedUser,
  ) {
    return this.prisma.$transaction(
      async (db) => {
        await db.$queryRaw`SELECT id FROM "EvaluationCycle" WHERE id = ${id}::uuid FOR UPDATE`;
        const reference = await db.evaluationCycle.findUnique({
          where: { id },
          select: { formId: true },
        });
        if (!reference) throw new NotFoundException("دوره ارزیابی یافت نشد.");
        await db.$queryRaw`SELECT id FROM "EvaluationForm" WHERE id = ${reference.formId}::uuid FOR UPDATE`;

        const cycle = await db.evaluationCycle.findUnique({
          where: { id },
          include: { form: { include: { items: true } } },
        });
        if (!cycle)
          throw new NotFoundException("دوره ارزیابی موردنظر یافت نشد.");
        await this.access.assertCompanyAccess(user, cycle.companyId);

        if (cycle.status === "CANCELLED") {
          throw new BadRequestException(
            "این دوره ارزیابی لغو شده است و قابل فعال‌سازی نیست.",
          );
        }
        if (cycle.status === "CLOSED") {
          throw new BadRequestException(
            "این دوره ارزیابی بسته شده است و قابل فعال‌سازی نیست.",
          );
        }

        const totalWeight = cycle.form.items.reduce((s, i) => s + i.weight, 0);
        if (cycle.form.items.length === 0) {
          throw new BadRequestException("فرم ارزیابی این دوره فاقد سؤال است.");
        }
        if (totalWeight !== EVALUATION_FORM_WEIGHT_TOTAL) {
          throw new BadRequestException(
            `مجموع وزن سؤالات فرم باید ${EVALUATION_FORM_WEIGHT_TOTAL} باشد (مجموع فعلی: ${totalWeight}).`,
          );
        }

        const employeeWhere: Prisma.EmployeeWhereInput = {
          AND: [this.access.employeeWhereFor(user)],
          companyId: cycle.companyId,
          deletedAt: null,
          status: "ACTIVE",
          ...(dto.employeeIds?.length ? { id: { in: dto.employeeIds } } : {}),
        };

        const employees = await db.employee.findMany({
          where: employeeWhere,
          select: {
            id: true,
            userId: true,
            firstName: true,
            lastName: true,
            manager: { select: { userId: true } },
          },
          orderBy: { code: "asc" },
        });

        if (!employees.length) {
          throw new BadRequestException(
            "هیچ کارمند فعالی برای این دوره ارزیابی یافت نشد.",
          );
        }
        if (
          dto.employeeIds?.length &&
          employees.length !== new Set(dto.employeeIds).size
        ) {
          throw new BadRequestException(
            "تمام کارکنان باید فعال، در حوزه دسترسی و متعلق به شرکت دوره باشند.",
          );
        }

        const existing = await db.evaluation.findMany({
          where: { cycleId: id },
          select: { employeeId: true, evaluationType: true },
        });
        const existingKeys = new Set(
          existing.map((e) => `${e.employeeId}:${e.evaluationType}`),
        );

        const rows: Prisma.EvaluationCreateManyInput[] = [];
        for (const e of employees) {
          if (!existingKeys.has(`${e.id}:SELF`)) {
            rows.push({
              cycleId: id,
              employeeId: e.id,
              evaluationType: "SELF",
              status: "PENDING",
            });
          }
          if (!existingKeys.has(`${e.id}:SUPERVISOR`)) {
            rows.push({
              cycleId: id,
              employeeId: e.id,
              evaluationType: "SUPERVISOR",
              status: "PENDING",
              evaluatorId: e.manager?.userId ?? null,
            });
          }
        }

        if (rows.length) {
          await db.evaluation.createMany({ data: rows, skipDuplicates: true });
        }

        await db.evaluationCycle.update({
          where: { id },
          data: { status: "ACTIVE" },
        });

        // اعلان به کارکنان و سرپرستان
        const employeeUserIds = employees
          .filter((e) =>
            rows.some(
              (row) => row.employeeId === e.id && row.evaluationType === "SELF",
            ),
          )
          .map((e) => e.userId)
          .filter((v): v is string => !!v);
        const managerUserIds = [
          ...new Set(
            employees
              .filter((e) =>
                rows.some(
                  (row) =>
                    row.employeeId === e.id &&
                    row.evaluationType === "SUPERVISOR",
                ),
              )
              .map((e) => e.manager?.userId)
              .filter((v): v is string => !!v),
          ),
        ];

        await this.notifications.notifyMany(
          employeeUserIds,
          {
            type: NotificationType.SYSTEM,
            title: "آغاز دوره ارزیابی عملکرد",
            body: `دوره «${cycle.name}» آغاز شد. خودارزیابی عملکرد خود را تکمیل کنید.`,
            link: `/evaluations/cycles/${id}`,
          },
          db,
        );

        await this.notifications.notifyMany(
          managerUserIds,
          {
            type: NotificationType.SYSTEM,
            title: "ارزیابی سرپرست",
            body: `دوره «${cycle.name}» آغاز شد. ارزیابی عملکرد زیرمجموعه‌های خود را انجام دهید.`,
            link: `/evaluations/cycles/${id}`,
          },
          db,
        );

        await this.audit.recordInTransaction(db, user.id, {
          action: AuditAction.UPDATE,
          entity: "EvaluationCycle",
          entityId: id,
          before: { status: cycle.status },
          after: {
            status: "ACTIVE",
            createdEvaluations: rows.length,
            employees: employees.length,
          },
        });

        return {
          cycleId: id,
          status: "ACTIVE",
          employees: employees.length,
          createdEvaluations: rows.length,
          notified: employeeUserIds.length + managerUserIds.length,
        };
      },
      { maxWait: 10000, timeout: 30000 },
    );
  }

  // =========================================================================
  // ارزیابی‌ها
  // =========================================================================

  async list(query: EvaluationQueryDto, user: AuthenticatedUser) {
    const employeeWhere = this.access.employeeWhereFor(user);

    const where: Prisma.EvaluationWhereInput = {
      ...(query.cycleId ? { cycleId: query.cycleId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.evaluationType ? { evaluationType: query.evaluationType } : {}),
      employee: {
        AND: [
          employeeWhere,
          ...(query.employeeId ? [{ id: query.employeeId }] : []),
        ],
      },
    };

    const [total, rows] = await Promise.all([
      this.prisma.evaluation.count({ where }),
      this.prisma.evaluation.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: "desc" },
        include: {
          cycle: {
            select: { id: true, name: true, periodType: true, status: true },
          },
          employee: {
            select: {
              id: true,
              code: true,
              firstName: true,
              lastName: true,
              orgUnit: { select: { id: true, name: true } },
              position: { select: { id: true, title: true } },
            },
          },
          evaluator: { select: { id: true, fullName: true } },
          _count: { select: { scores: true, feedbacks: true } },
        },
      }),
    ]);

    return this.paginated(
      rows.map((e) => ({
        ...e,
        scoreCount: e._count.scores,
        feedbackCount: e._count.feedbacks,
        _count: undefined,
      })),
      total,
      query,
    );
  }

  async get(id: string, user: AuthenticatedUser) {
    const evaluation = await this.prisma.evaluation.findUnique({
      where: { id },
      include: {
        cycle: {
          include: {
            form: { include: { items: { orderBy: { sortOrder: "asc" } } } },
          },
        },
        employee: {
          select: {
            id: true,
            code: true,
            firstName: true,
            lastName: true,
            orgUnit: { select: { id: true, name: true } },
            position: { select: { id: true, title: true } },
            manager: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        evaluator: { select: { id: true, fullName: true } },
        scores: { include: { item: true } },
        feedbacks: {
          include: { author: { select: { id: true, fullName: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!evaluation)
      throw new NotFoundException("رکورد ارزیابی موردنظر یافت نشد.");
    await this.access.assertEmployeeAccess(user, evaluation.employeeId);

    const allowed = await this.access.canAccessEmployee(
      user,
      evaluation.employeeId,
    );
    if (!allowed)
      throw new ForbiddenException("به این رکورد ارزیابی دسترسی ندارید.");

    const items = evaluation.cycle.form.items;
    const scale = this.scaleInfo(items);

    return {
      id: evaluation.id,
      cycleId: evaluation.cycleId,
      cycle: evaluation.cycle,
      employeeId: evaluation.employeeId,
      employee: evaluation.employee,
      evaluatorId: evaluation.evaluatorId,
      evaluator: evaluation.evaluator,
      evaluationType: evaluation.evaluationType,
      status: evaluation.status,
      selfScore: evaluation.selfScore,
      supervisorScore: evaluation.supervisorScore,
      weightedScore: evaluation.weightedScore,
      finalScore: evaluation.finalScore,
      normalizedFinalScore: this.toHundred(evaluation.finalScore, scale),
      employeeResponse: evaluation.employeeResponse,
      lockedAt: evaluation.lockedAt,
      createdAt: evaluation.createdAt,
      updatedAt: evaluation.updatedAt,
      items,
      scores: evaluation.scores,
      feedbacks: evaluation.feedbacks,
      scale,
    };
  }

  /** خودارزیابی کارمند */
  async selfAssess(id: string, dto: SelfAssessDto, user: AuthenticatedUser) {
    return this.prisma.$transaction(
      async (db) => {
        await db.$queryRaw`SELECT id FROM "Evaluation" WHERE id = ${id}::uuid FOR UPDATE`;

        const evaluation = await db.evaluation.findUnique({
          where: { id },
          include: {
            cycle: { include: { form: { include: { items: true } } } },
          },
        });
        if (!evaluation)
          throw new NotFoundException("رکورد ارزیابی موردنظر یافت نشد.");
        await this.access.assertEmployeeAccess(user, evaluation.employeeId);

        this.assertNotLocked(evaluation.lockedAt);

        const isOwner =
          !!user.employeeId && user.employeeId === evaluation.employeeId;
        const canManage = this.hasPermission(user, "evaluations.manage");
        if (!isOwner && !canManage) {
          throw new ForbiddenException(
            "تنها کارمند مربوطه یا مدیر ارزیابی مجاز به ثبت خودارزیابی است.",
          );
        }
        if (evaluation.evaluationType !== "SELF") {
          throw new BadRequestException("این رکورد، رکورد خودارزیابی نیست.");
        }

        const { weighted, items } = this.computeWeighted(
          evaluation.cycle.form.items,
          dto.scores,
        );

        await (async () => {
          const tx = db;
          for (const s of dto.scores) {
            await tx.evaluationScore.upsert({
              where: {
                evaluationId_itemId: { evaluationId: id, itemId: s.itemId },
              },
              create: {
                evaluationId: id,
                itemId: s.itemId,
                score: s.score,
                comment: s.comment ?? null,
                evidence: s.evidence ?? null,
              },
              update: {
                score: s.score,
                ...(s.comment !== undefined ? { comment: s.comment } : {}),
                ...(s.evidence !== undefined ? { evidence: s.evidence } : {}),
              },
            });
          }
          await tx.evaluation.update({
            where: { id },
            data: {
              selfScore: weighted,
              status:
                evaluation.status === "SUPERVISOR_ASSESSED"
                  ? "SUPERVISOR_ASSESSED"
                  : "SELF_ASSESSED",
            },
          });
        })();

        await this.audit.recordInTransaction(db, user.id, {
          action: AuditAction.UPDATE,
          entity: "Evaluation",
          entityId: id,
          before: { selfScore: evaluation.selfScore },
          after: { selfScore: weighted, itemCount: dto.scores.length },
        });

        const scale = this.scaleInfo(items);
        return {
          id,
          selfScore: weighted,
          normalizedSelfScore: this.toHundred(weighted, scale),
          status:
            evaluation.status === "SUPERVISOR_ASSESSED"
              ? "SUPERVISOR_ASSESSED"
              : "SELF_ASSESSED",
          scale,
        };
      },
      { maxWait: 10000, timeout: 30000 },
    );
  }

  /** ارزیابی سرپرست */
  async supervisorAssess(
    id: string,
    dto: SupervisorAssessDto,
    user: AuthenticatedUser,
  ) {
    return this.prisma.$transaction(
      async (db) => {
        await db.$queryRaw`SELECT id FROM "Evaluation" WHERE id = ${id}::uuid FOR UPDATE`;

        const evaluation = await db.evaluation.findUnique({
          where: { id },
          include: {
            cycle: { include: { form: { include: { items: true } } } },
            employee: {
              select: {
                id: true,
                managerId: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        });
        if (!evaluation)
          throw new NotFoundException("رکورد ارزیابی موردنظر یافت نشد.");
        await this.access.assertEmployeeAccess(user, evaluation.employeeId);

        this.assertNotLocked(evaluation.lockedAt);

        if (user.employeeId && user.employeeId === evaluation.employeeId) {
          throw new ForbiddenException("ارزیابی پرونده شخصی خود مجاز نیست.");
        }

        const isDirectManager =
          !!user.employeeId &&
          evaluation.employee.managerId === user.employeeId;
        const canRate =
          this.hasPermission(user, "evaluations.rate") ||
          this.hasPermission(user, "evaluations.manage");
        if (!isDirectManager && !canRate) {
          throw new ForbiddenException(
            "تنها سرپرست مستقیم یا دارای مجوز ارزیابی مجاز به نمره‌دهی است.",
          );
        }
        if (evaluation.evaluationType !== "SUPERVISOR") {
          throw new BadRequestException(
            "این رکورد، رکورد ارزیابی سرپرست نیست.",
          );
        }

        const { weighted, items } = this.computeWeighted(
          evaluation.cycle.form.items,
          dto.scores,
        );

        const combined =
          evaluation.selfScore !== null && evaluation.selfScore !== undefined
            ? round2((evaluation.selfScore + weighted) / 2)
            : weighted;

        await (async () => {
          const tx = db;
          for (const s of dto.scores) {
            await tx.evaluationScore.upsert({
              where: {
                evaluationId_itemId: { evaluationId: id, itemId: s.itemId },
              },
              create: {
                evaluationId: id,
                itemId: s.itemId,
                score: s.score,
                comment: s.comment ?? null,
                evidence: s.evidence ?? null,
              },
              update: {
                score: s.score,
                ...(s.comment !== undefined ? { comment: s.comment } : {}),
                ...(s.evidence !== undefined ? { evidence: s.evidence } : {}),
              },
            });
          }
          await tx.evaluation.update({
            where: { id },
            data: {
              supervisorScore: weighted,
              weightedScore: combined,
              evaluatorId: user.id,
              status: "SUPERVISOR_ASSESSED",
            },
          });
        })();

        await this.audit.recordInTransaction(db, user.id, {
          action: AuditAction.UPDATE,
          entity: "Evaluation",
          entityId: id,
          before: { supervisorScore: evaluation.supervisorScore },
          after: { supervisorScore: weighted, weightedScore: combined },
        });

        const scale = this.scaleInfo(items);
        return {
          id,
          supervisorScore: weighted,
          normalizedSupervisorScore: this.toHundred(weighted, scale),
          weightedScore: combined,
          status: "SUPERVISOR_ASSESSED",
          scale,
        };
      },
      { maxWait: 10000, timeout: 30000 },
    );
  }

  /** ثبت بازخورد */
  async addFeedback(
    id: string,
    dto: CreateEvaluationFeedbackDto,
    user: AuthenticatedUser,
  ) {
    const evaluation = await this.prisma.evaluation.findUnique({
      where: { id },
    });
    if (!evaluation)
      throw new NotFoundException("رکورد ارزیابی موردنظر یافت نشد.");
    await this.access.assertEmployeeAccess(user, evaluation.employeeId);

    const isOwner =
      !!user.employeeId && user.employeeId === evaluation.employeeId;
    const canRate =
      this.hasPermission(user, "evaluations.rate") ||
      this.hasPermission(user, "evaluations.manage");
    if (!isOwner && !canRate) {
      throw new ForbiddenException("مجوز ثبت بازخورد را ندارید.");
    }

    const feedback = await this.prisma.evaluationFeedback.create({
      data: {
        evaluationId: id,
        authorId: user.id,
        content: dto.content.trim(),
      },
      include: { author: { select: { id: true, fullName: true } } },
    });

    await this.audit.record(user.id, {
      action: AuditAction.CREATE,
      entity: "EvaluationFeedback",
      entityId: feedback.id,
      after: { evaluationId: id },
    });

    return feedback;
  }

  /** پاسخ کارمند به بازخورد */
  async employeeResponse(
    id: string,
    dto: EmployeeResponseDto,
    user: AuthenticatedUser,
  ) {
    return this.prisma.$transaction(
      async (db) => {
        await db.$queryRaw`SELECT id FROM "Evaluation" WHERE id = ${id}::uuid FOR UPDATE`;

        const evaluation = await db.evaluation.findUnique({ where: { id } });
        if (!evaluation)
          throw new NotFoundException("رکورد ارزیابی موردنظر یافت نشد.");
        await this.access.assertEmployeeAccess(user, evaluation.employeeId);

        const isOwner =
          !!user.employeeId && user.employeeId === evaluation.employeeId;
        const canManage = this.hasPermission(user, "evaluations.manage");
        if (!isOwner && !canManage) {
          throw new ForbiddenException(
            "تنها کارمند مربوطه مجاز به ثبت پاسخ است.",
          );
        }

        const updated = await db.evaluation.update({
          where: { id },
          data: { employeeResponse: dto.response.trim() },
        });

        await this.audit.recordInTransaction(db, user.id, {
          action: AuditAction.UPDATE,
          entity: "Evaluation",
          entityId: id,
          before: { employeeResponse: evaluation.employeeResponse },
          after: { employeeResponse: updated.employeeResponse },
        });

        return { id, employeeResponse: updated.employeeResponse };
      },
      { maxWait: 10000, timeout: 30000 },
    );
  }

  /** نهایی‌سازی و قفل کردن رکورد ارزیابی */
  async finalize(id: string, user: AuthenticatedUser) {
    return this.prisma.$transaction(
      async (db) => {
        await db.$queryRaw`SELECT id FROM "Evaluation" WHERE id = ${id}::uuid FOR UPDATE`;

        const evaluation = await db.evaluation.findUnique({
          where: { id },
          include: {
            cycle: { include: { form: { include: { items: true } } } },
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                userId: true,
              },
            },
          },
        });
        if (!evaluation)
          throw new NotFoundException("رکورد ارزیابی موردنظر یافت نشد.");
        await this.access.assertEmployeeAccess(user, evaluation.employeeId);

        if (
          !user.isSuperAdmin &&
          (user.employeeId === evaluation.employeeId ||
            evaluation.evaluatorId === user.id)
        ) {
          throw new ForbiddenException(
            "نهایی‌سازی ارزیابی خود یا ارزیابی نمره‌دهی‌شده توسط خودتان مجاز نیست.",
          );
        }

        if (evaluation.lockedAt) {
          throw new BadRequestException(
            "این ارزیابی قبلاً نهایی شده و قفل است.",
          );
        }
        if (
          evaluation.supervisorScore === null ||
          evaluation.supervisorScore === undefined
        ) {
          throw new BadRequestException(
            "ارزیابی سرپرست تکمیل نشده است؛ ابتدا نمره سرپرست را ثبت کنید.",
          );
        }

        const finalScore =
          evaluation.weightedScore ??
          evaluation.supervisorScore ??
          evaluation.selfScore ??
          null;

        const updated = await db.evaluation.update({
          where: { id },
          data: {
            finalScore,
            status: "FINALIZED",
            lockedAt: new Date(),
          },
        });

        // اطلاع‌رسانی به کارمند
        if (evaluation.employee.userId) {
          await this.notifications.notify(
            evaluation.employee.userId,
            {
              type: NotificationType.SYSTEM,
              title: "نهایی شدن نتیجه ارزیابی عملکرد",
              body: `نتیجه ارزیابی شما در دوره «${evaluation.cycle.name}» نهایی شد.`,
              link: `/evaluations/${id}`,
            },
            db,
          );
        }

        await this.audit.recordInTransaction(db, user.id, {
          action: AuditAction.APPROVE,
          entity: "Evaluation",
          entityId: id,
          before: {
            status: evaluation.status,
            finalScore: evaluation.finalScore,
          },
          after: {
            status: "FINALIZED",
            finalScore: updated.finalScore,
            lockedAt: updated.lockedAt,
          },
        });

        const scale = this.scaleInfo(evaluation.cycle.form.items);
        return {
          id,
          status: updated.status,
          finalScore: updated.finalScore,
          normalizedFinalScore: this.toHundred(updated.finalScore, scale),
          lockedAt: updated.lockedAt,
          scale,
        };
      },
      { maxWait: 10000, timeout: 30000 },
    );
  }

  /** جدول مقایسه نمرات نهایی کارکنان یک دوره — کالیبراسیون بین واحدها */
  async calibration(cycleId: string, user: AuthenticatedUser) {
    const cycle = await this.prisma.evaluationCycle.findUnique({
      where: { id: cycleId },
      include: { form: { include: { items: true } } },
    });
    if (!cycle) throw new NotFoundException("دوره ارزیابی موردنظر یافت نشد.");
    await this.access.assertCompanyAccess(user, cycle.companyId);

    const employeeWhere = this.access.employeeWhereFor(user);

    const evaluations = await this.prisma.evaluation.findMany({
      where: {
        cycleId,
        evaluationType: "SUPERVISOR",
        employee: { AND: [employeeWhere] },
      },
      include: {
        employee: {
          select: {
            id: true,
            code: true,
            firstName: true,
            lastName: true,
            orgUnit: { select: { id: true, name: true } },
            position: { select: { id: true, title: true } },
          },
        },
      },
      orderBy: { finalScore: "desc" },
    });

    const scale = this.scaleInfo(cycle.form.items);
    const rows = evaluations
      .map((e) => ({
        evaluationId: e.id,
        employeeId: e.employeeId,
        employeeCode: e.employee.code,
        employeeName: `${e.employee.firstName} ${e.employee.lastName}`,
        orgUnitId: e.employee.orgUnit?.id ?? null,
        orgUnitName: e.employee.orgUnit?.name ?? null,
        positionTitle: e.employee.position?.title ?? null,
        selfScore: e.selfScore,
        supervisorScore: e.supervisorScore,
        weightedScore: e.weightedScore,
        finalScore: e.finalScore,
        normalizedFinalScore: this.toHundred(e.finalScore, scale),
        status: e.status,
      }))
      .sort((a, b) => (b.finalScore ?? -1) - (a.finalScore ?? -1));

    const withRank = rows.map((r, i) => ({
      ...r,
      rank: r.finalScore === null ? null : i + 1,
    }));

    const scores = withRank
      .map((r) => r.finalScore)
      .filter((v): v is number => v !== null);
    const total = scores.length;
    const average = total
      ? round2(scores.reduce((s, v) => s + v, 0) / total)
      : null;
    const variance = total
      ? round2(
          scores.reduce((s, v) => s + Math.pow(v - (average as number), 2), 0) /
            total,
        )
      : null;

    const byOrgUnit = Object.values(
      withRank.reduce<
        Record<
          string,
          {
            orgUnitId: string | null;
            orgUnitName: string | null;
            count: number;
            sum: number;
          }
        >
      >((acc, r) => {
        const key = r.orgUnitId ?? "__none__";
        if (!acc[key]) {
          acc[key] = {
            orgUnitId: r.orgUnitId,
            orgUnitName: r.orgUnitName,
            count: 0,
            sum: 0,
          };
        }
        acc[key].count += 1;
        acc[key].sum += r.finalScore ?? 0;
        return acc;
      }, {}),
    ).map((g) => ({
      orgUnitId: g.orgUnitId,
      orgUnitName: g.orgUnitName ?? "بدون واحد سازمانی",
      count: g.count,
      averageFinalScore: g.count ? round2(g.sum / g.count) : null,
    }));

    return {
      cycle: {
        id: cycle.id,
        name: cycle.name,
        periodType: cycle.periodType,
        status: cycle.status,
      },
      scale,
      summary: {
        count: total,
        average,
        min: total ? Math.min(...scores) : null,
        max: total ? Math.max(...scores) : null,
        variance,
        standardDeviation:
          variance !== null ? round2(Math.sqrt(variance)) : null,
        finalizedCount: withRank.filter((r) => r.status === "FINALIZED").length,
      },
      byOrgUnit,
      rows: withRank,
    };
  }

  /** روند عملکرد کارمند در طول زمان */
  async trend(employeeId: string, user: AuthenticatedUser) {
    const allowed = await this.access.canAccessEmployee(user, employeeId);
    if (!allowed)
      throw new ForbiddenException("به پرونده این کارمند دسترسی ندارید.");

    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        code: true,
        firstName: true,
        lastName: true,
        orgUnit: { select: { id: true, name: true } },
        position: { select: { id: true, title: true } },
      },
    });
    if (!employee) throw new NotFoundException("کارمند موردنظر یافت نشد.");

    const evaluations = await this.prisma.evaluation.findMany({
      where: { employeeId, evaluationType: "SUPERVISOR" },
      include: {
        cycle: {
          select: {
            id: true,
            name: true,
            periodType: true,
            startDate: true,
            endDate: true,
            status: true,
          },
        },
      },
      orderBy: { cycle: { startDate: "asc" } },
    });

    const trend = evaluations.map((e) => ({
      evaluationId: e.id,
      cycleId: e.cycleId,
      cycleName: e.cycle.name,
      periodType: e.cycle.periodType,
      startDate: e.cycle.startDate,
      endDate: e.cycle.endDate,
      selfScore: e.selfScore,
      supervisorScore: e.supervisorScore,
      weightedScore: e.weightedScore,
      finalScore: e.finalScore,
      status: e.status,
    }));

    const finals = trend
      .map((t) => t.finalScore)
      .filter((v): v is number => v !== null);
    const first = finals.length ? finals[0] : null;
    const last = finals.length ? finals[finals.length - 1] : null;

    return {
      employee,
      summary: {
        cycles: trend.length,
        scoredCycles: finals.length,
        average: finals.length
          ? round2(finals.reduce((s, v) => s + v, 0) / finals.length)
          : null,
        firstScore: first,
        latestScore: last,
        change:
          first !== null && last !== null && first !== 0
            ? round2(((last - first) / first) * 100)
            : null,
        direction:
          first !== null && last !== null
            ? last > first
              ? "UP"
              : last < first
                ? "DOWN"
                : "FLAT"
            : "UNKNOWN",
      },
      trend,
    };
  }

  // =========================================================================
  // اهداف (KPI / OKR)
  // =========================================================================

  async listGoals(query: GoalQueryDto, user: AuthenticatedUser) {
    const employeeWhere = this.access.employeeWhereFor(user);

    const where: Prisma.GoalWhereInput = {
      ...(query.cycleId ? { cycleId: query.cycleId } : {}),
      ...(query.goalType ? { goalType: query.goalType } : {}),
      ...(query.status ? { status: query.status } : {}),
      employee: {
        AND: [
          employeeWhere,
          ...(query.employeeId ? [{ id: query.employeeId }] : []),
        ],
      },
    };

    const [total, rows] = await Promise.all([
      this.prisma.goal.count({ where }),
      this.prisma.goal.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: "desc" },
        include: {
          employee: {
            select: { id: true, code: true, firstName: true, lastName: true },
          },
          cycle: { select: { id: true, name: true } },
        },
      }),
    ]);

    return this.paginated(rows, total, query);
  }

  async getGoal(id: string, user: AuthenticatedUser) {
    const goal = await this.prisma.goal.findUnique({
      where: { id },
      include: {
        employee: {
          select: { id: true, code: true, firstName: true, lastName: true },
        },
        cycle: { select: { id: true, name: true } },
      },
    });
    if (!goal) throw new NotFoundException("هدف موردنظر یافت نشد.");
    const allowed = await this.access.canAccessEmployee(user, goal.employeeId);
    if (!allowed) throw new ForbiddenException("به این هدف دسترسی ندارید.");
    return goal;
  }

  async createGoal(dto: CreateGoalDto, user: AuthenticatedUser) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: dto.employeeId },
    });
    if (!employee) throw new NotFoundException("کارمند موردنظر یافت نشد.");

    const allowed = await this.access.canAccessEmployee(user, dto.employeeId);
    if (!allowed)
      throw new ForbiddenException("به پرونده این کارمند دسترسی ندارید.");

    if (dto.cycleId) {
      const cycle = await this.prisma.evaluationCycle.findUnique({
        where: { id: dto.cycleId },
      });
      if (!cycle) throw new NotFoundException("دوره ارزیابی موردنظر یافت نشد.");
      await this.access.assertCompanyAccess(user, cycle.companyId);
      if (cycle.companyId !== employee.companyId)
        throw new BadRequestException("دوره متعلق به شرکت این نیرو نیست.");
    }

    const goal = await this.prisma.goal.create({
      data: {
        employeeId: dto.employeeId,
        cycleId: dto.cycleId ?? null,
        title: dto.title.trim(),
        description: dto.description ?? null,
        goalType: dto.goalType ?? "KPI",
        targetValue: dto.targetValue ?? null,
        unit: dto.unit ?? null,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        progress: dto.progress ?? 0,
        status: dto.status ?? "OPEN",
      },
    });

    await this.audit.record(user.id, {
      action: AuditAction.CREATE,
      entity: "Goal",
      entityId: goal.id,
      after: {
        title: goal.title,
        employeeId: goal.employeeId,
        goalType: goal.goalType,
      },
    });

    return goal;
  }

  async updateGoal(id: string, dto: UpdateGoalDto, user: AuthenticatedUser) {
    const goal = await this.prisma.goal.findUnique({ where: { id } });
    if (!goal) throw new NotFoundException("هدف موردنظر یافت نشد.");

    const allowed = await this.access.canAccessEmployee(user, goal.employeeId);
    if (!allowed) throw new ForbiddenException("به این هدف دسترسی ندارید.");
    if (dto.cycleId) {
      const employee = await this.prisma.employee.findUniqueOrThrow({
        where: { id: goal.employeeId },
        select: { companyId: true },
      });
      const cycle = await this.prisma.evaluationCycle.findFirst({
        where: { id: dto.cycleId, companyId: employee.companyId },
        select: { id: true },
      });
      if (!cycle)
        throw new BadRequestException("دوره متعلق به شرکت این نیرو نیست.");
    }

    const before = {
      title: goal.title,
      progress: goal.progress,
      status: goal.status,
    };

    const updated = await this.prisma.goal.update({
      where: { id },
      data: {
        ...(dto.cycleId !== undefined ? { cycleId: dto.cycleId ?? null } : {}),
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.goalType !== undefined ? { goalType: dto.goalType } : {}),
        ...(dto.targetValue !== undefined
          ? { targetValue: dto.targetValue }
          : {}),
        ...(dto.unit !== undefined ? { unit: dto.unit } : {}),
        ...(dto.startDate !== undefined
          ? { startDate: dto.startDate ? new Date(dto.startDate) : null }
          : {}),
        ...(dto.endDate !== undefined
          ? { endDate: dto.endDate ? new Date(dto.endDate) : null }
          : {}),
        ...(dto.progress !== undefined ? { progress: dto.progress } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
    });

    await this.audit.record(user.id, {
      action: AuditAction.UPDATE,
      entity: "Goal",
      entityId: id,
      before,
      after: {
        title: updated.title,
        progress: updated.progress,
        status: updated.status,
      },
    });

    return updated;
  }

  async deleteGoal(id: string, user: AuthenticatedUser) {
    const goal = await this.prisma.goal.findUnique({ where: { id } });
    if (!goal) throw new NotFoundException("هدف موردنظر یافت نشد.");

    const allowed = await this.access.canAccessEmployee(user, goal.employeeId);
    if (!allowed) throw new ForbiddenException("به این هدف دسترسی ندارید.");

    await this.prisma.goal.delete({ where: { id } });
    await this.audit.record(user.id, {
      action: AuditAction.DELETE,
      entity: "Goal",
      entityId: id,
      before: { title: goal.title },
    });
    return { success: true };
  }

  /** خلاصه پیشرفت اهداف یک کارمند */
  async goalProgress(employeeId: string, user: AuthenticatedUser) {
    const allowed = await this.access.canAccessEmployee(user, employeeId);
    if (!allowed)
      throw new ForbiddenException("به پرونده این کارمند دسترسی ندارید.");

    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        code: true,
        firstName: true,
        lastName: true,
        orgUnit: { select: { id: true, name: true } },
        position: { select: { id: true, title: true } },
      },
    });
    if (!employee) throw new NotFoundException("کارمند موردنظر یافت نشد.");

    const goals = await this.prisma.goal.findMany({
      where: { employeeId },
      include: { cycle: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });

    const byStatus = goals.reduce<Record<string, number>>((acc, g) => {
      acc[g.status] = (acc[g.status] ?? 0) + 1;
      return acc;
    }, {});

    const averageProgress = goals.length
      ? round2(goals.reduce((s, g) => s + g.progress, 0) / goals.length)
      : 0;

    return {
      employee,
      summary: {
        total: goals.length,
        byStatus,
        kpiCount: goals.filter((g) => g.goalType === "KPI").length,
        okrCount: goals.filter((g) => g.goalType === "OKR").length,
        achievedCount: goals.filter((g) => g.status === "ACHIEVED").length,
        averageProgress,
        openCount: goals.filter(
          (g) => g.status === "OPEN" || g.status === "IN_PROGRESS",
        ).length,
      },
      goals,
    };
  }

  // =========================================================================
  // کمکی‌ها
  // =========================================================================

  private itemData(i: EvaluationItemInputDto) {
    return {
      title: i.title.trim(),
      description: i.description ?? null,
      weight: i.weight,
      scaleType: i.scaleType ?? "NUMERIC",
      minScore: i.minScore ?? 1,
      maxScore: i.maxScore ?? 5,
      isKPI: i.isKPI ?? false,
      evidenceRequired: i.evidenceRequired ?? false,
      sortOrder: i.sortOrder ?? 0,
    };
  }

  /** اعتبارسنجی مجموع وزن سؤالات فرم */
  private assertWeightSum(items: EvaluationItemInputDto[]) {
    if (!items.length) {
      throw new BadRequestException(
        "فرم ارزیابی باید حداقل یک سؤال داشته باشد.",
      );
    }
    const sum = items.reduce((s, i) => s + (i.weight ?? 0), 0);
    if (sum !== EVALUATION_FORM_WEIGHT_TOTAL) {
      throw new BadRequestException(
        `مجموع وزن سؤالات فرم باید ${EVALUATION_FORM_WEIGHT_TOTAL} باشد (مجموع فعلی: ${sum}).`,
      );
    }
    for (const item of items) {
      const min = item.minScore ?? 1;
      const max = item.maxScore ?? 5;
      if (max <= min) {
        throw new BadRequestException(
          `حداکثر نمره سؤال «${item.title}» باید بزرگ‌تر از حداقل نمره آن باشد.`,
        );
      }
    }
  }

  /** محاسبه میانگین وزنی نمرات */
  private computeWeighted(
    items: any[],
    scores: { itemId: string; score: number }[],
  ) {
    const map = new Map(items.map((i) => [i.id, i]));
    let numerator = 0;
    let denominator = 0;

    for (const s of scores) {
      const item = map.get(s.itemId);
      if (!item) {
        throw new BadRequestException(
          "یکی از سؤال‌های ارسالی متعلق به فرم این دوره ارزیابی نیست.",
        );
      }
      if (typeof s.score !== "number" || Number.isNaN(s.score)) {
        throw new BadRequestException(
          `نمره سؤال «${item.title}» باید عدد باشد.`,
        );
      }
      if (s.score < item.minScore || s.score > item.maxScore) {
        throw new BadRequestException(
          `نمره سؤال «${item.title}» باید بین ${item.minScore} تا ${item.maxScore} باشد.`,
        );
      }
      numerator += s.score * item.weight;
    }

    for (const item of items) denominator += item.weight;
    if (denominator <= 0) {
      throw new BadRequestException("فرم ارزیابی فاقد سؤال با وزن مشخص است.");
    }

    return { weighted: round2(numerator / denominator), items };
  }

  private scaleInfo(items: any[]) {
    const minScore = items.length
      ? Math.min(...items.map((i) => i.minScore))
      : 0;
    const maxScore = items.length
      ? Math.max(...items.map((i) => i.maxScore))
      : 5;
    const totalWeight = items.reduce((s, i) => s + i.weight, 0);
    return { minScore, maxScore, totalWeight, itemCount: items.length };
  }

  /** تبدیل نمره خام به مقیاس ۰ تا ۱۰۰ */
  private toHundred(
    value: number | null | undefined,
    scale: { minScore: number; maxScore: number },
  ) {
    if (value === null || value === undefined) return null;
    if (scale.maxScore === scale.minScore) return null;
    return round2(
      ((value - scale.minScore) / (scale.maxScore - scale.minScore)) * 100,
    );
  }

  private assertNotLocked(lockedAt: Date | null) {
    if (lockedAt) {
      throw new BadRequestException(
        "این ارزیابی قفل شده است و امکان ویرایش نمرات وجود ندارد.",
      );
    }
  }

  private hasPermission(user: AuthenticatedUser, code: string): boolean {
    return (
      !!user.isSuperAdmin ||
      user.permissions.includes("*") ||
      user.permissions.includes(code)
    );
  }

  private async assertFormUnscored(
    formId: string,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    if (await db.evaluation.count({ where: { cycle: { formId } } }))
      throw new BadRequestException(
        "سنجه‌های فرم دارای ارزیابی قابل تغییر نیستند؛ فرم جدید ایجاد کنید.",
      );
  }

  private async resolveCompanyId(
    provided: string | undefined,
    user: AuthenticatedUser,
  ): Promise<string> {
    const id = provided ?? (await this.access.resolveCompanyId(user));
    await this.access.assertCompanyAccess(user, id);
    const company = await this.prisma.company.findFirst({
      where: { id, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (!company) throw new NotFoundException("شرکت موردنظر یافت نشد.");
    return id;
  }

  private paginated<T>(
    data: T[],
    total: number,
    query: { page: number; limit: number },
  ) {
    return {
      data,
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
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
