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
import { CreateTaskDto, TaskCommentDto, TaskDependencyDto, TaskQueryDto, UpdateTaskDto } from './dto/tasks.dto';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
  ) {}

  /** آیا کاربر روی این وظیفه دسترسی دارد (مسئول/ایجادکننده/حوزه دسترسی) */
  private async assertTaskAccess(taskId: string, user: AuthenticatedUser) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignees: { include: { employee: { select: { id: true } } } },
        orgUnit: { select: { id: true } },
      },
    });
    if (!task) throw new NotFoundException('وظیفه موردنظر یافت نشد.');

    if (user.isSuperAdmin || user.scope.unrestricted) return task;
    if (task.createdById === user.id) return task;
    if (task.assignees.some((a) => a.employeeId && a.employeeId === user.employeeId)) return task;
    if (task.companyId && user.scope.companyIds.length && user.scope.companyIds.includes(task.companyId)) {
      // دسترسی سطح شرکت مجاز است
      return task;
    }
    throw new ForbiddenException('به این وظیفه دسترسی ندارید.');
  }

  async list(query: TaskQueryDto, pagination: PaginationDto, user: AuthenticatedUser) {
    const where: Prisma.TaskWhereInput = {
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.orgUnitId ? { orgUnitId: query.orgUnitId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
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

    // محدودسازی حوزه: اگر کاربر unrestricted نیست فقط وظایف خودش/واحدش
    if (!user.isSuperAdmin && !user.scope.unrestricted) {
      where.OR = [
        { createdById: user.id },
        { assignees: { some: { employeeId: user.employeeId ?? '' } } },
        { companyId: { in: user.scope.companyIds.length ? user.scope.companyIds : [] } },
      ];
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
            include: { employee: { select: { id: true, code: true, firstName: true, lastName: true } } },
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
        assignees: { include: { employee: { select: { id: true, code: true, firstName: true, lastName: true } } } },
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

  async create(dto: CreateTaskDto, user: AuthenticatedUser) {
    const assignees = dto.assigneeIds?.length
      ? { create: dto.assigneeIds.map((employeeId) => ({ employeeId, role: 'ASSIGNEE', isResponsible: true })) }
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
        createdById: user.id,
        assignees,
      },
      include: { assignees: { include: { employee: { select: { userId: true, firstName: true } } } } },
    });

    await this.audit.record(user.id, {
      action: AuditAction.CREATE,
      entity: 'Task',
      entityId: task.id,
      after: { title: task.title, priority: task.priority },
    });

    for (const a of task.assignees) {
      if (a.employee?.userId && a.employee.userId !== user.id) {
        await this.notifications.notify(a.employee.userId, {
          type: NotificationType.TASK_ASSIGNED,
          title: 'وظیفه جدید به شما واگذار شد',
          body: task.title,
          link: `/tasks/${task.id}`,
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
    await this.assertTaskAccess(id, user);

    const before = await this.prisma.task.findUnique({ where: { id } });
    if (before?.status === TaskStatus.DONE && dto.status && dto.status !== TaskStatus.DONE) {
      // بازگشایی وظیفه تکمیل‌شده مجاز است
    }

    const task = await this.prisma.task.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.dueDate !== undefined ? { dueDate: dto.dueDate ? new Date(dto.dueDate) : null } : {}),
        ...(dto.estimatedHours !== undefined ? { estimatedHours: dto.estimatedHours } : {}),
        ...(dto.actualHours !== undefined ? { actualHours: dto.actualHours } : {}),
        ...(dto.progress !== undefined ? { progress: dto.progress } : {}),
        ...(dto.slaHours !== undefined ? { slaHours: dto.slaHours } : {}),
        ...(dto.delayReason !== undefined ? { delayReason: dto.delayReason } : {}),
        ...(dto.status === TaskStatus.DONE ? { completedAt: new Date(), progress: 100 } : {}),
        ...(dto.status && dto.status !== TaskStatus.DONE ? { completedAt: null } : {}),
      },
      include: { assignees: { include: { employee: { select: { userId: true } } } } },
    });

    if (dto.assigneeIds) {
      await this.prisma.taskAssignee.deleteMany({ where: { taskId: id } });
      if (dto.assigneeIds.length) {
        await this.prisma.taskAssignee.createMany({
          data: dto.assigneeIds.map((employeeId) => ({ taskId: id, employeeId, role: 'ASSIGNEE' })),
        });
      }
      // اطلاع به مسئولان جدید
      const employees = await this.prisma.employee.findMany({
        where: { id: { in: dto.assigneeIds } },
        select: { userId: true },
      });
      for (const e of employees) {
        if (e.userId && e.userId !== user.id) {
          await this.notifications.notify(e.userId, {
            type: NotificationType.TASK_ASSIGNED,
            title: 'وظیفه به شما واگذار شد',
            body: task.title,
            link: `/tasks/${id}`,
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
      throw new ForbiddenException('فقط ایجادکننده وظیفه می‌تواند آن را حذف کند.');
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

  async addDependency(id: string, dto: TaskDependencyDto, user: AuthenticatedUser) {
    await this.assertTaskAccess(id, user);
    if (dto.dependsOnTaskId === id) throw new BadRequestException('وظیفه نمی‌تواند به خودش وابسته باشد.');

    const cycle = await this.hasDependencyCycle(id, dto.dependsOnTaskId);
    if (cycle) throw new BadRequestException('این وابستگی یک چرخه در زنجیره وظایف ایجاد می‌کند.');

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
