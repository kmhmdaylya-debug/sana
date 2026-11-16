import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, NotificationType, Prisma, TaskStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AccessService } from '../common/access/access.service';
import { AuditService } from '../common/audit/audit.service';
import { NotificationService } from '../common/notifications/notification.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CreateTaskDto, ReviewTaskRetryDto, TaskCommentDto, TaskDependencyDto, TaskQueryDto, UpdateTaskDto } from './dto/tasks.dto';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
  ) {}

  private assigneeWhere(user: AuthenticatedUser): Prisma.UserWhereInput {
    const scoped = user.scope;
    const hasEmployeeScope = user.employeeId || scoped.companyIds.length || scoped.branchIds.length || scoped.orgUnitIds.length || scoped.employeeIds.length;
    return {
      status: 'ACTIVE', deletedAt: null,
      ...(!user.isSuperAdmin && !scoped.unrestricted ? {
        OR: [
          { id: user.id },
          ...(hasEmployeeScope ? [{ employee: { is: { deletedAt: null, status: 'ACTIVE' as const, ...this.access.employeeWhereFor(user) } } }] : []),
        ],
      } : {}),
    };
  }

  async assigneeOptions(query: PaginationDto, user: AuthenticatedUser) {
    const where: Prisma.UserWhereInput = {
      AND: [this.assigneeWhere(user), ...(query.search ? [{ OR: [
        { fullName: { contains: query.search, mode: 'insensitive' as const } },
        { username: { contains: query.search, mode: 'insensitive' as const } },
      ] }] : [])],
    };
    const [total, data] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({ where, skip: query.skip, take: query.limit, orderBy: { fullName: 'asc' },
        select: { id: true, fullName: true, username: true } }),
    ]);
    return { data, meta: { total, page: query.page, limit: query.limit, totalPages: Math.max(1, Math.ceil(total / query.limit)) }, success: true };
  }

  /** آیا کاربر روی این task دسترسی دارد (مسئول/ایجادکننده/حوزه دسترسی) */
  private async assertTaskAccess(taskId: string, user: AuthenticatedUser) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignees: { include: { employee: { select: { id: true, userId: true } } } },
        orgUnit: { select: { id: true } },
      },
    });
    if (!task) throw new NotFoundException('task موردنظر یافت نشد.');

    if (user.isSuperAdmin || user.scope.unrestricted) return task;
    if (task.createdById === user.id) return task;
    if (task.assignees.some((a) => a.userId === user.id)) return task;
    if (task.assignees.some((a) => a.employeeId && a.employeeId === user.employeeId)) return task;
    if (task.companyId && user.scope.companyIds.length && user.scope.companyIds.includes(task.companyId)) {
      // دسترسی سطح شرکت مجاز است
      return task;
    }
    throw new ForbiddenException('به این task دسترسی ندارید.');
  }

  async list(query: TaskQueryDto, pagination: PaginationDto, user: AuthenticatedUser) {
    const where: Prisma.TaskWhereInput = {
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.orgUnitId ? { orgUnitId: query.orgUnitId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.createdById ? { createdById: query.createdById } : {}),
      ...(query.assigneeId ? { assignees: { some: { employeeId: query.assigneeId } } } : {}),
      ...(query.filter === 'overdue'
        ? { dueDate: { lt: new Date() }, status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] } }
        : {}),
      ...(query.filter === 'due-soon'
        ? {
            dueDate: { gte: new Date(), lte: new Date(Date.now() + 3 * 86_400_000) },
            status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search } },
              { projectName: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    // محدودسازی حوزه: اگر کاربر unrestricted نیست فقط task خودش/واحدش
    if (!user.isSuperAdmin && !user.scope.unrestricted) {
      where.AND = [{ OR: [
        { createdById: user.id },
        { assignees: { some: { userId: user.id } } },
        ...(user.employeeId ? [{ assignees: { some: { employeeId: user.employeeId } } }] : []),
        { companyId: { in: user.scope.companyIds.length ? user.scope.companyIds : [] } },
      ] }];
    }

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const [total, rows] = await Promise.all([
      this.prisma.task.count({ where }),
      this.prisma.task.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
        include: {
          assignees: {
            include: {
              employee: { select: { id: true, code: true, firstName: true, lastName: true } },
              user: { select: { id: true, fullName: true, username: true } },
            },
          },
          createdBy: { select: { id: true, fullName: true } },
          orgUnit: { select: { id: true, name: true } },
          _count: { select: { comments: true, attachments: true, dependencies: true } },
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
    const task = await this.assertTaskAccess(id, user);
    const full = await this.prisma.task.findUnique({
      where: { id },
      include: {
        assignees: {
          include: {
            employee: { select: { id: true, code: true, firstName: true, lastName: true } },
            user: { select: { id: true, fullName: true, username: true } },
          },
        },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: { author: { select: { id: true, fullName: true } } },
        },
        attachments: true,
        dependencies: { include: { dependsOn: { select: { id: true, title: true, status: true } } } },
        dependents: { include: { task: { select: { id: true, title: true, status: true } } } },
        createdBy: { select: { id: true, fullName: true } },
        orgUnit: { select: { id: true, name: true } },
      },
    });
    void task;
    return {
      data: full,
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * مسئولان task از روی «کاربر» و/یا «نیرو» مشخص می‌شوند.
   * چون «کاربر = نیرو» است، شناسهٔ کاربر به پروندهٔ پرسنلی او نگاشت می‌شود
   * تا هم افرادِ دارای پرونده و هم حساب‌های صرفاً کاربری قابل انتخاب باشند.
   */
  private async resolveAssignees(user: AuthenticatedUser, userIds?: string[], employeeIds?: string[]) {
    const rows: { userId?: string; employeeId?: string }[] = [];

    if (userIds?.length) {
      const users = await this.prisma.user.findMany({
        where: { AND: [this.assigneeWhere(user), { id: { in: userIds } }] },
        select: { id: true, employeeId: true },
      });
      if (users.length !== new Set(userIds).size) throw new BadRequestException('یک یا چند کاربر مسئول فعال یا در دسترس نیستند.');
      for (const u of users) {
        rows.push({ userId: u.id, employeeId: u.employeeId ?? undefined });
      }
    }

    if (employeeIds?.length) {
      const employees = await this.prisma.employee.findMany({
        where: { AND: [{ id: { in: employeeIds }, deletedAt: null, status: 'ACTIVE' }, this.access.employeeWhereFor(user)] },
        select: { id: true, user: { select: { id: true } } },
      });
      if (employees.length !== new Set(employeeIds).size) throw new BadRequestException('یک یا چند نیروی مسئول فعال یا در دسترس نیستند.');
      for (const e of employees) {
        rows.push({ employeeId: e.id, userId: e.user?.id });
      }
    }

    // حذف تکراری‌ها (یک فرد ممکن است از هر دو راه معرفی شده باشد)
    const seen = new Set<string>();
    return rows.filter((r) => {
      const key = `${r.userId ?? ''}|${r.employeeId ?? ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  async create(dto: CreateTaskDto, user: AuthenticatedUser) {
    if (!dto.title.trim()) throw new BadRequestException('عنوان کار را وارد کنید.');
    const resolved = await this.resolveAssignees(user, dto.assigneeUserIds, dto.assigneeIds);
    const assignees = resolved.length
      ? { create: resolved.map((a) => ({ employeeId: a.employeeId ?? null, userId: a.userId ?? null, role: 'ASSIGNEE', isResponsible: true })) }
      : undefined;

    const task = await this.prisma.task.create({
      data: {
        companyId: dto.companyId,
        orgUnitId: dto.orgUnitId ?? null,
        title: dto.title.trim(),
        description: dto.description ?? null,
        status: TaskStatus.NEW,
        priority: dto.priority ?? 'MEDIUM',
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        estimatedHours: dto.estimatedHours ?? null,
        progress: dto.progress ?? 0,
        slaHours: dto.slaHours ?? null,
        projectName: dto.projectName ?? null,
        category: dto.category ?? null,
        createdById: user.id,
        assignees,
      },
      include: {
        assignees: {
          include: {
            employee: { select: { id: true, code: true, firstName: true, lastName: true } },
            user: { select: { id: true, fullName: true, username: true } },
          },
        },
      },
    });

    await this.audit.record(user.id, {
      action: AuditAction.CREATE,
      entity: 'Task',
      entityId: task.id,
      after: { title: task.title, priority: task.priority },
    });

    for (const a of task.assignees) {
      if (a.userId && a.userId !== user.id) {
        await this.notifications.notify(a.userId, {
          type: NotificationType.TASK_ASSIGNED,
          title: 'task جدید به شما واگذار شد',
          body: task.title,
          link: '/tasks',
        });
      }
    }

    return {
      data: { id: task.id },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  async update(id: string, dto: UpdateTaskDto, user: AuthenticatedUser) {
    const existing = await this.assertTaskAccess(id, user);
    if (dto.title !== undefined && !dto.title.trim()) throw new BadRequestException('عنوان کار را وارد کنید.');
    const requested = dto.assigneeIds !== undefined || dto.assigneeUserIds !== undefined
      ? await this.resolveAssignees(user, dto.assigneeUserIds, dto.assigneeIds) : undefined;
    const assigneeKeys = (rows: { userId?: string | null; employeeId?: string | null }[]) => rows.map(row => `${row.userId ?? ''}|${row.employeeId ?? ''}`).sort().join(',');
    const resolved = requested && assigneeKeys(requested) !== assigneeKeys(existing.assignees) ? requested : undefined;

    const before = await this.prisma.task.findUnique({ where: { id } });
    if (before?.status === TaskStatus.DONE && dto.status && dto.status !== TaskStatus.DONE) {
      // بازگشایی task تکمیل‌شده مجاز است
    }

    const task = await this.prisma.task.update({
      where: { id },
      data: {
        ...(resolved ? { assignees: { deleteMany: {}, create: resolved.map((a) => ({ employeeId: a.employeeId ?? null, userId: a.userId ?? null, role: 'ASSIGNEE', isResponsible: true })) } } : {}),
        ...(!resolved && dto.status && dto.status !== before?.status ? { assignees: { updateMany: { where: {}, data: { dismissedAt: null } } } } : {}),
        ...((dto.status && dto.status !== before?.status) || resolved ? { comments: { create: { authorId: user.id, content: [dto.status && dto.status !== before?.status ? `وضعیت کار تغییر کرد: ${{ NEW: 'شروع نشده', IN_PROGRESS: 'در حال انجام', DONE: 'انجام‌شده', CANCELLED: 'لغوشده' }[dto.status]}` : '', resolved ? 'مسئولان کار به‌روزرسانی شدند.' : ''].filter(Boolean).join(' · ') } } } : {}),
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.dueDate !== undefined ? { dueDate: dto.dueDate ? new Date(dto.dueDate) : null } : {}),
        ...(dto.estimatedHours !== undefined ? { estimatedHours: dto.estimatedHours } : {}),
        ...(dto.actualHours !== undefined ? { actualHours: dto.actualHours } : {}),
        ...(dto.progress !== undefined ? { progress: dto.progress } : {}),
        ...(dto.slaHours !== undefined ? { slaHours: dto.slaHours } : {}),
        ...(dto.delayReason !== undefined ? { delayReason: dto.delayReason } : {}),
        ...(dto.status === TaskStatus.DONE ? { completedAt: before?.completedAt ?? new Date(), progress: 100, delayReason: null } : {}),
        ...(dto.status && dto.status !== TaskStatus.DONE ? { completedAt: null } : {}),
        ...((dto.status && dto.status !== before?.status) || resolved ? { retryStatus: null, retryRequestedAt: null, retryRequestedById: null, delayReason: null } : {}),
      },
      include: { assignees: { include: { employee: { select: { userId: true } } } } },
    });

    if (resolved) {
      // اطلاع به مسئولان جدید
      const notifyIds = [...new Set(resolved.map((a) => a.userId).filter(Boolean))] as string[];
      for (const uid of notifyIds) {
        if (uid !== user.id) {
          await this.notifications.notify(uid, {
            type: NotificationType.TASK_ASSIGNED,
            title: 'task به شما واگذار شد',
            body: task.title,
            link: '/tasks',
          });
        }
      }
    }

    await this.audit.record(user.id, {
      action: AuditAction.UPDATE,
      entity: 'Task',
      entityId: id,
      before: { status: before?.status, progress: before?.progress },
      after: { status: dto.status ?? undefined, progress: dto.progress ?? undefined },
    });

    return {
      data: { id: task.id },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  async remove(id: string, user: AuthenticatedUser) {
    const task = await this.assertTaskAccess(id, user);
    if (task.createdById !== user.id && !user.isSuperAdmin) {
      throw new ForbiddenException('فقط ایجادکننده task می‌تواند آن را حذف کند.');
    }
    await this.prisma.task.delete({ where: { id } });
    await this.audit.record(user.id, {
      action: AuditAction.DELETE,
      entity: 'Task',
      entityId: id,
      before: { title: task.title },
    });
    return { success: true, timestamp: new Date().toISOString() };
  }

  async addComment(id: string, dto: TaskCommentDto, user: AuthenticatedUser) {
    await this.assertTaskAccess(id, user);
    const comment = await this.prisma.taskComment.create({
      data: { taskId: id, authorId: user.id, content: dto.content },
      include: { author: { select: { id: true, fullName: true } } },
    });
    await this.audit.record(user.id, {
      action: AuditAction.CREATE,
      entity: 'TaskComment',
      entityId: comment.id,
    });
    return {
      data: comment,
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  async reviewRetry(id: string, dto: ReviewTaskRetryDto, user: AuthenticatedUser) {
    const task = await this.assertTaskAccess(id, user);
    const reason = dto.reason?.trim();
    if (!dto.approved && !reason) throw new BadRequestException('دلیل رد درخواست را بنویسید.');
    if (task.retryStatus !== 'PENDING' || !task.delayReason || ['DONE', 'CANCELLED'].includes(task.status)) throw new BadRequestException('درخواست در انتظار بررسی برای این کار وجود ندارد.');
    await this.prisma.$transaction(async tx => {
      const result = await tx.task.updateMany({
        where: { id, retryStatus: 'PENDING', retryRequestedAt: task.retryRequestedAt, status: task.status, delayReason: task.delayReason },
        data: { retryStatus: dto.approved ? 'APPROVED' : 'REJECTED', ...(dto.approved ? { status: 'NEW', delayReason: null, completedAt: null, progress: 0 } : {}) },
      });
      if (!result.count) throw new BadRequestException('درخواست تغییر کرده است؛ صفحه را تازه کنید.');
      if (dto.approved) await tx.taskAssignee.updateMany({ where: { taskId: id }, data: { completedAt: null, dismissedAt: null } });
      await tx.taskComment.create({ data: { taskId: id, authorId: user.id, content: dto.approved ? 'درخواست انجام دوباره تأیید شد؛ کار آمادهٔ شروع است.' : `درخواست انجام دوباره رد شد: ${reason}` } });
    });
    await this.audit.record(user.id, { action: AuditAction.UPDATE, entity: 'Task', entityId: id, after: { retryStatus: dto.approved ? 'APPROVED' : 'REJECTED', ...(reason ? { reason } : {}) } });
    const recipients = new Set(task.assignees.map(assignment => assignment.userId ?? assignment.employee?.userId).filter((value): value is string => !!value));
    if (task.retryRequestedById) recipients.add(task.retryRequestedById);
    for (const recipient of recipients) {
      if (recipient !== user.id) await this.notifications.notify(recipient, { title: dto.approved ? 'درخواست انجام دوباره تأیید شد' : 'درخواست انجام دوباره رد شد', body: `${task.title}${reason ? `: ${reason}` : ''}`, link: '/panel' });
    }
    return { success: true };
  }

  async addDependency(id: string, dto: TaskDependencyDto, user: AuthenticatedUser) {
    await this.assertTaskAccess(id, user);
    if (dto.dependsOnTaskId === id) throw new BadRequestException('task نمی‌تواند به خودش وابسته باشد.');

    const cycle = await this.hasDependencyCycle(id, dto.dependsOnTaskId);
    if (cycle) throw new BadRequestException('این وابستگی یک چرخه در زنجیره task ایجاد می‌کند.');

    const row = await this.prisma.taskDependency.create({
      data: { taskId: id, dependsOnTaskId: dto.dependsOnTaskId },
    });
    await this.audit.record(user.id, {
      action: AuditAction.CREATE,
      entity: 'TaskDependency',
      entityId: row.id,
    });
    return {
      data: { id: row.id },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  private async hasDependencyCycle(taskId: string, dependsOn: string): Promise<boolean> {
    const visited = new Set<string>([taskId]);
    const queue = [dependsOn];
    while (queue.length) {
      const current = queue.pop() as string;
      if (visited.has(current)) return true;
      visited.add(current);
      const deps = await this.prisma.taskDependency.findMany({
        where: { taskId: current },
        select: { dependsOnTaskId: true },
      });
      queue.push(...deps.map((d) => d.dependsOnTaskId));
    }
    return false;
  }

  async removeDependency(dependencyId: string, user: AuthenticatedUser) {
    const row = await this.prisma.taskDependency.findUnique({ where: { id: dependencyId } });
    if (!row) throw new NotFoundException('وابستگی یافت نشد.');
    await this.assertTaskAccess(row.taskId, user);
    await this.prisma.taskDependency.delete({ where: { id: dependencyId } });
    await this.audit.record(user.id, {
      action: AuditAction.DELETE,
      entity: 'TaskDependency',
      entityId: dependencyId,
    });
    return { success: true, timestamp: new Date().toISOString() };
  }
}
