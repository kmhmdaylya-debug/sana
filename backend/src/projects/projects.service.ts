import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, Prisma, ProjectStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AccessService } from '../common/access/access.service';
import { AuditService } from '../common/audit/audit.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import {
  CreateProjectDto,
  CreateProjectTaskDto,
  ProjectQueryDto,
  TimelineQueryDto,
  UpdateProjectDto,
  UpdateProjectTaskDto,
} from './dto/projects.dto';

const PROJECT_INCLUDE = {
  manager: { select: { id: true, code: true, firstName: true, lastName: true } },
  members: {
    include: {
      employee: { select: { id: true, code: true, firstName: true, lastName: true, position: { select: { title: true } } } },
    },
  },
  tasks: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      assignee: { select: { id: true, code: true, firstName: true, lastName: true } },
      dependsOn: { select: { id: true, title: true } },
    },
  },
  _count: { select: { tasks: true, members: true } },
} satisfies Prisma.ProjectInclude;

const DAY = 86_400_000;

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
  ) {}

  /** محدودسازی پروژه‌ها بر اساس حوزهٔ دسترسی کاربر */
  private scopeWhere(user: AuthenticatedUser): Prisma.ProjectWhereInput {
    if (user.isSuperAdmin || user.scope.unrestricted) return {};
    return {
      OR: [
        { managerId: user.employeeId ?? '' },
        { members: { some: { employeeId: user.employeeId ?? '' } } },
        { companyId: { in: user.scope.companyIds.length ? user.scope.companyIds : [] } },
      ],
    };
  }

  private assertDates(startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('قالب تاریخ معتبر نیست.');
    }
    if (end.getTime() < start.getTime()) {
      throw new BadRequestException('تاریخ پایان نمی‌تواند پیش از تاریخ شروع باشد.');
    }
  }

  // -------------------------------------------------------------------------
  // فهرست پروژه‌ها
  // -------------------------------------------------------------------------
  async list(query: ProjectQueryDto, pagination: PaginationDto, user: AuthenticatedUser) {
    const where: Prisma.ProjectWhereInput = {
      AND: [this.scopeWhere(user)],
      deletedAt: null,
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.managerId ? { managerId: query.managerId } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { code: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const [total, rows] = await Promise.all([
      this.prisma.project.count({ where }),
      this.prisma.project.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ startDate: 'asc' }, { code: 'asc' }],
        include: PROJECT_INCLUDE,
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
    const project = await this.prisma.project.findFirst({
      where: { id, deletedAt: null, AND: [this.scopeWhere(user)] },
      include: PROJECT_INCLUDE,
    });
    if (!project) throw new NotFoundException('پروژه موردنظر یافت نشد.');
    return project;
  }

  // -------------------------------------------------------------------------
  // تقویم پروژه / دادهٔ گانت چارت
  // -------------------------------------------------------------------------
  /**
   * دادهٔ تقویم: پروژه‌ها به‌همراه کارها، اعضا و وابستگی‌ها در بازهٔ زمانی خواسته‌شده.
   * بازهٔ پیش‌فرض: از ابتدای دورهٔ کاریِ جاری تا ۹۰ روز بعد.
   */
  async timeline(query: TimelineQueryDto, user: AuthenticatedUser) {
    const now = new Date();
    const from = query.from ? new Date(query.from) : new Date(now.getTime() - 30 * DAY);
    const to = query.to ? new Date(query.to) : new Date(now.getTime() + 90 * DAY);

    const projects = await this.prisma.project.findMany({
      where: {
        AND: [this.scopeWhere(user)],
        deletedAt: null,
        ...(query.companyId ? { companyId: query.companyId } : {}),
        ...(query.projectId ? { id: query.projectId } : {}),
        // پروژه‌هایی که با بازه تلاقی دارند
        startDate: { lte: to },
        endDate: { gte: from },
      },
      orderBy: [{ startDate: 'asc' }, { priority: 'desc' }],
      include: PROJECT_INCLUDE,
    });

    // محدودهٔ واقعی نمایش (حداقل و حداکثر تاریخ داده‌ها)
    let minDate: Date | null = null;
    let maxDate: Date | null = null;
    for (const p of projects) {
      const dates = [p.startDate, p.endDate, ...p.tasks.map((t) => t.startDate), ...p.tasks.map((t) => t.endDate)];
      for (const d of dates) {
        if (!minDate || d < minDate) minDate = d;
        if (!maxDate || d > maxDate) maxDate = d;
      }
    }

    return {
      range: {
        from: (minDate ?? from).toISOString(),
        to: (maxDate ?? to).toISOString(),
      },
      projects,
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  // -------------------------------------------------------------------------
  // ایجاد و ویرایش
  // -------------------------------------------------------------------------
  async create(dto: CreateProjectDto, user: AuthenticatedUser) {
    this.assertDates(dto.startDate, dto.endDate);
    const companyId = await this.access.resolveCompanyId(user);
    const duplicate = await this.prisma.project.findFirst({
      where: { companyId, code: dto.code.trim(), deletedAt: null },
    });
    if (duplicate) {
      throw new BadRequestException(`کد پروژه «${dto.code.trim()}» قبلاً ثبت شده است.`);
    }

    const project = await this.prisma.project.create({
      data: {
        companyId,
        code: dto.code.trim(),
        title: dto.title.trim(),
        description: dto.description ?? null,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        status: dto.status ?? ProjectStatus.PLANNING,
        priority: dto.priority,
        progress: dto.progress ?? 0,
        color: dto.color ?? null,
        managerId: dto.managerId ?? null,
        createdById: user.id,
        ...(dto.memberIds?.length
          ? { members: { create: dto.memberIds.map((employeeId) => ({ employeeId })) } }
          : {}),
      },
      include: PROJECT_INCLUDE,
    });

    await this.audit.record(user.id, {
      action: AuditAction.CREATE,
      entity: 'Project',
      entityId: project.id,
      after: { code: project.code, title: project.title },
    });

    return project;
  }

  async update(id: string, dto: UpdateProjectDto, user: AuthenticatedUser) {
    const existing = await this.get(id, user);
    if (dto.startDate && dto.endDate) {
      this.assertDates(dto.startDate, dto.endDate);
    } else if (dto.startDate || dto.endDate) {
      this.assertDates(dto.startDate ?? existing.startDate.toISOString(), dto.endDate ?? existing.endDate.toISOString());
    }

    const project = await this.prisma.project.update({
      where: { id },
      data: {
        ...(dto.code !== undefined ? { code: dto.code.trim() } : {}),
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.startDate !== undefined ? { startDate: new Date(dto.startDate) } : {}),
        ...(dto.endDate !== undefined ? { endDate: new Date(dto.endDate) } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.progress !== undefined ? { progress: dto.progress } : {}),
        ...(dto.color !== undefined ? { color: dto.color } : {}),
        ...(dto.managerId !== undefined ? { managerId: dto.managerId } : {}),
      },
      include: PROJECT_INCLUDE,
    });

    if (dto.memberIds) {
      await this.prisma.projectMember.deleteMany({ where: { projectId: id } });
      if (dto.memberIds.length) {
        await this.prisma.projectMember.createMany({
          data: dto.memberIds.map((employeeId) => ({ projectId: id, employeeId })),
          skipDuplicates: true,
        });
      }
    }

    await this.audit.record(user.id, {
      action: AuditAction.UPDATE,
      entity: 'Project',
      entityId: id,
      before: { code: existing.code, title: existing.title, status: existing.status },
      after: { code: project.code, title: project.title, status: project.status },
    });

    return project;
  }

  async remove(id: string, user: AuthenticatedUser) {
    const existing = await this.get(id, user);
    await this.prisma.project.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.record(user.id, {
      action: AuditAction.DELETE,
      entity: 'Project',
      entityId: id,
      before: { code: existing.code, title: existing.title },
    });
    return { message: 'پروژه حذف شد.' };
  }

  // -------------------------------------------------------------------------
  // کارهای پروژه (بخش گانت چارت)
  // -------------------------------------------------------------------------
  async addTask(projectId: string, dto: CreateProjectTaskDto, user: AuthenticatedUser) {
    const project = await this.get(projectId, user);
    this.assertDates(dto.startDate, dto.endDate);
    if (dto.dependsOnId) {
      const dep = await this.prisma.projectTask.findFirst({ where: { id: dto.dependsOnId, projectId } });
      if (!dep) throw new BadRequestException('وظیفهٔ پیش‌نیاز در این پروژه یافت نشد.');
    }

    const task = await this.prisma.projectTask.create({
      data: {
        projectId,
        title: dto.title.trim(),
        phase: dto.phase ?? null,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        progress: dto.progress ?? 0,
        status: dto.status ?? 'PENDING',
        priority: dto.priority ?? 'MEDIUM',
        color: dto.color ?? project.color ?? null,
        assigneeId: dto.assigneeId ?? null,
        dependsOnId: dto.dependsOnId ?? null,
        sortOrder: dto.sortOrder ?? project.tasks.length,
      },
      include: {
        assignee: { select: { id: true, code: true, firstName: true, lastName: true } },
        dependsOn: { select: { id: true, title: true } },
      },
    });

    await this.recalcProgress(projectId);
    return task;
  }

  async updateTask(taskId: string, dto: UpdateProjectTaskDto, user: AuthenticatedUser) {
    const task = await this.prisma.projectTask.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('کار پروژه یافت نشد.');
    await this.get(task.projectId, user);

    if (dto.dependsOnId) {
      if (dto.dependsOnId === taskId) {
        throw new BadRequestException('یک کار نمی‌تواند پیش‌نیاز خودش باشد.');
      }
      const dep = await this.prisma.projectTask.findFirst({ where: { id: dto.dependsOnId, projectId: task.projectId } });
      if (!dep) throw new BadRequestException('کار پیش‌نیاز در این پروژه یافت نشد.');
    }

    const updated = await this.prisma.projectTask.update({
      where: { id: taskId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.phase !== undefined ? { phase: dto.phase } : {}),
        ...(dto.startDate !== undefined ? { startDate: new Date(dto.startDate) } : {}),
        ...(dto.endDate !== undefined ? { endDate: new Date(dto.endDate) } : {}),
        ...(dto.progress !== undefined ? { progress: dto.progress } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.color !== undefined ? { color: dto.color } : {}),
        ...(dto.assigneeId !== undefined ? { assigneeId: dto.assigneeId } : {}),
        ...(dto.dependsOnId !== undefined ? { dependsOnId: dto.dependsOnId } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
      include: {
        assignee: { select: { id: true, code: true, firstName: true, lastName: true } },
        dependsOn: { select: { id: true, title: true } },
      },
    });

    await this.recalcProgress(task.projectId);
    return updated;
  }

  async removeTask(taskId: string, user: AuthenticatedUser) {
    const task = await this.prisma.projectTask.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('کار پروژه یافت نشد.');
    await this.get(task.projectId, user);
    await this.prisma.projectTask.updateMany({
      where: { dependsOnId: taskId },
      data: { dependsOnId: null },
    });
    await this.prisma.projectTask.delete({ where: { id: taskId } });
    await this.recalcProgress(task.projectId);
    return { message: 'کار پروژه حذف شد.' };
  }

  /** پیشرفت پروژه = میانگین پیشرفت کارها (در نبود کار، مقدار ثبت‌شده حفظ می‌شود) */
  private async recalcProgress(projectId: string) {
    const tasks = await this.prisma.projectTask.findMany({
      where: { projectId },
      select: { progress: true },
    });
    if (!tasks.length) return;
    const avg = Math.round(tasks.reduce((sum, t) => sum + t.progress, 0) / tasks.length);
    await this.prisma.project.update({ where: { id: projectId }, data: { progress: avg } });
  }

  /** بررسی دسترسی مدیریتی روی پروژه (فقط مدیر پروژه یا مدیر ارشد) */
  async assertManage(projectId: string, user: AuthenticatedUser) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('پروژه موردنظر یافت نشد.');
    if (user.isSuperAdmin || user.scope.unrestricted) return project;
    if (project.managerId && project.managerId === user.employeeId) return project;
    throw new ForbiddenException('فقط مدیر پروژه می‌تواند این عملیات را انجام دهد.');
  }
}
