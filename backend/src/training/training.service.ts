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
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import {
  CreateCertificateDto,
  CreateCourseDto,
  CreateTrainingRecordDto,
  CourseQueryDto,
  CertificateQueryDto,
  TrainingRecordQueryDto,
  UpdateCourseDto,
} from './dto/training.dto';

@Injectable()
export class TrainingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
  ) {}

  // =========================================================================
  // دوره‌های آموزشی
  // =========================================================================

  async listCourses(query: CourseQueryDto, pagination: PaginationDto) {
    const where: Prisma.TrainingCourseWhereInput = {
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.isActive !== undefined && query.isActive !== '' ? { isActive: query.isActive === 'true' } : {}),
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
      this.prisma.trainingCourse.count({ where }),
      this.prisma.trainingCourse.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { code: 'asc' },
        include: {
          company: { select: { id: true, code: true, name: true } },
          _count: { select: { records: true, prerequisites: true } },
        },
      }),
    ]);

    return {
      data: rows.map((c) => ({ ...c, cost: Number(c.cost) })),
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

  async getCourse(id: string) {
    const row = await this.prisma.trainingCourse.findUnique({
      where: { id },
      include: {
        prerequisites: { include: { requires: { select: { id: true, code: true, title: true } } } },
        requiredBy: { include: { course: { select: { id: true, code: true, title: true } } } },
        _count: { select: { records: true } },
      },
    });
    if (!row) throw new NotFoundException('دوره آموزشی یافت نشد.');
    return {
      data: {
        ...row,
        cost: Number(row.cost),
        prerequisites: row.prerequisites.map((p) => p.requires),
        requiredBy: row.requiredBy.map((p) => p.course),
      },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  async createCourse(dto: CreateCourseDto, actorId: string) {
    const duplicate = await this.prisma.trainingCourse.findUnique({
      where: { companyId_code: { companyId: dto.companyId, code: dto.code.trim() } },
    });
    if (duplicate) throw new BadRequestException(`کد دوره «${dto.code}» در این شرکت قبلاً ثبت شده است.`);

    const row = await this.prisma.trainingCourse.create({
      data: {
        companyId: dto.companyId,
        code: dto.code.trim(),
        title: dto.title.trim(),
        description: dto.description ?? null,
        instructor: dto.instructor ?? null,
        durationHours: dto.durationHours ?? 0,
        cost: BigInt(dto.cost ?? 0),
        ...(dto.prerequisiteIds?.length
          ? {
              prerequisites: {
                create: dto.prerequisiteIds.map((requiresCourseId) => ({ requiresCourseId })),
              },
            }
          : {}),
      },
    });

    await this.audit.record(actorId, {
      action: AuditAction.CREATE,
      entity: 'TrainingCourse',
      entityId: row.id,
      after: { code: row.code, title: row.title },
    });

    return {
      data: { id: row.id },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  async updateCourse(id: string, dto: UpdateCourseDto, actorId: string) {
    const course = await this.prisma.trainingCourse.findUnique({ where: { id } });
    if (!course) throw new NotFoundException('دوره آموزشی یافت نشد.');

    const row = await this.prisma.trainingCourse.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.instructor !== undefined ? { instructor: dto.instructor } : {}),
        ...(dto.durationHours !== undefined ? { durationHours: dto.durationHours } : {}),
        ...(dto.cost !== undefined ? { cost: BigInt(dto.cost) } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive === true } : {}),
      },
    });

    await this.audit.record(actorId, {
      action: AuditAction.UPDATE,
      entity: 'TrainingCourse',
      entityId: id,
      after: { title: row.title, isActive: row.isActive },
    });

    return {
      data: { id: row.id },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  /** تنظیم دوره‌های پیش‌نیاز یک دوره */
  async setPrerequisites(id: string, prerequisiteIds: string[], actorId: string) {
    const course = await this.prisma.trainingCourse.findUnique({ where: { id } });
    if (!course) throw new NotFoundException('دوره آموزشی یافت نشد.');
    if (prerequisiteIds.includes(id)) {
      throw new BadRequestException('دوره نمی‌تواند پیش‌نیاز خودش باشد.');
    }

    await this.prisma.$transaction([
      this.prisma.trainingCoursePrerequisite.deleteMany({ where: { courseId: id } }),
      ...(prerequisiteIds.length
        ? [
            this.prisma.trainingCoursePrerequisite.createMany({
              data: prerequisiteIds.map((requiresCourseId) => ({ courseId: id, requiresCourseId })),
            }),
          ]
        : []),
    ]);

    await this.audit.record(actorId, {
      action: AuditAction.UPDATE,
      entity: 'TrainingCourse',
      entityId: id,
      after: { prerequisites: prerequisiteIds },
    });

    return { data: { id, prerequisites: prerequisiteIds }, success: true, timestamp: new Date().toISOString() };
  }

  // =========================================================================
  // سوابق آموزش
  // =========================================================================

  async listRecords(query: TrainingRecordQueryDto, pagination: PaginationDto, user: AuthenticatedUser) {
    const where: Prisma.TrainingRecordWhereInput = {
      employee: this.access.employeeWhereFor(user),
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.courseId ? { courseId: query.courseId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const [total, rows] = await Promise.all([
      this.prisma.trainingRecord.count({ where }),
      this.prisma.trainingRecord.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { attendanceDate: 'desc' },
        include: {
          course: { select: { id: true, code: true, title: true, durationHours: true } },
          employee: { select: { id: true, code: true, firstName: true, lastName: true } },
          certificate: { select: { id: true, name: true, expiryDate: true } },
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

  /** ثبت سابقه آموزش با بررسی پیش‌نیازها */
  async createRecord(dto: CreateTrainingRecordDto, user: AuthenticatedUser) {
    const ok = await this.access.canAccessEmployee(user, dto.employeeId);
    if (!ok) throw new ForbiddenException('به پرونده این نیرو دسترسی ندارید.');

    const course = await this.prisma.trainingCourse.findUnique({
      where: { id: dto.courseId },
      include: { prerequisites: { select: { requiresCourseId: true } } },
    });
    if (!course) throw new NotFoundException('دوره آموزشی یافت نشد.');

    // بررسی گذراندن پیش‌نیازها
    const prereqIds = course.prerequisites.map((p) => p.requiresCourseId);
    if (prereqIds.length) {
      const passed = await this.prisma.trainingRecord.findMany({
        where: {
          employeeId: dto.employeeId,
          courseId: { in: prereqIds },
          status: 'COMPLETED',
        },
        select: { courseId: true },
        distinct: ['courseId'],
      });
      const passedIds = new Set(passed.map((p) => p.courseId));
      const missing = prereqIds.filter((id) => !passedIds.has(id));
      if (missing.length) {
        const missingCourses = await this.prisma.trainingCourse.findMany({
          where: { id: { in: missing } },
          select: { title: true },
        });
        throw new BadRequestException(
          `پیش از ثبت این دوره باید دوره‌های پیش‌نیاز گذرانده شود: ${missingCourses.map((c) => c.title).join('، ')}`,
        );
      }
    }

    const duplicate = await this.prisma.trainingRecord.findFirst({
      where: { employeeId: dto.employeeId, courseId: dto.courseId, status: { not: 'DROPPED' } },
      select: { id: true },
    });
    if (duplicate) throw new BadRequestException('سابقه حضور این نیرو در این دوره قبلاً ثبت شده است.');

    const row = await this.prisma.trainingRecord.create({
      data: {
        courseId: dto.courseId,
        employeeId: dto.employeeId,
        attendanceDate: new Date(dto.attendanceDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        result: dto.result ?? null,
        score: dto.score ?? null,
        effectivenessScore: dto.effectivenessScore ?? null,
        status: dto.status ?? 'COMPLETED',
        note: dto.note ?? null,
      },
      include: {
        course: { select: { code: true, title: true } },
        employee: { select: { code: true, firstName: true, lastName: true } },
      },
    });

    await this.audit.record(user.id, {
      action: AuditAction.CREATE,
      entity: 'TrainingRecord',
      entityId: row.id,
      after: { employeeId: dto.employeeId, courseId: dto.courseId },
    });

    return {
      data: { id: row.id },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  // =========================================================================
  // گواهینامه‌ها
  // =========================================================================

  async listCertificates(query: CertificateQueryDto, pagination: PaginationDto, user: AuthenticatedUser) {
    const where: Prisma.CertificateWhereInput = {
      employee: this.access.employeeWhereFor(user),
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
    };

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const [total, rows] = await Promise.all([
      this.prisma.certificate.count({ where }),
      this.prisma.certificate.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          employee: { select: { id: true, code: true, firstName: true, lastName: true } },
          records: { select: { id: true, courseId: true, status: true } },
        },
      }),
    ]);

    let data = rows;
    if (query.expiring === 'true' || query.expiring === '1') {
      const from = new Date();
      const to = new Date();
      to.setDate(to.getDate() + 90);
      data = rows.filter((c) => c.expiryDate && c.expiryDate >= from && c.expiryDate <= to);
    }

    return {
      data,
      meta: {
        total: query.expiring ? data.length : total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil((query.expiring ? data.length : total) / limit)),
        hasNext: page * limit < (query.expiring ? data.length : total),
        hasPrev: page > 1,
      },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  /** گواهینامه‌های در حال انقضا (۹۰ روز آینده) */
  async expiringCertificates(user: AuthenticatedUser) {
    const from = new Date();
    const to = new Date();
    to.setDate(to.getDate() + 90);
    const rows = await this.prisma.certificate.findMany({
      where: {
        expiryDate: { gte: from, lte: to },
        employee: this.access.employeeWhereFor(user),
      },
      include: {
        employee: { select: { id: true, code: true, firstName: true, lastName: true } },
      },
      orderBy: { expiryDate: 'asc' },
    });
    return {
      data: rows,
      meta: { total: rows.length, page: 1, limit: rows.length, totalPages: 1, hasNext: false, hasPrev: false },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  async createCertificate(dto: CreateCertificateDto, user: AuthenticatedUser) {
    const ok = await this.access.canAccessEmployee(user, dto.employeeId);
    if (!ok) throw new ForbiddenException('به پرونده این نیرو دسترسی ندارید.');

    const row = await this.prisma.certificate.create({
      data: {
        employeeId: dto.employeeId,
        name: dto.name.trim(),
        issuingBody: dto.issuingBody ?? null,
        issueDate: dto.issueDate ? new Date(dto.issueDate) : null,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
        filePath: dto.filePath ?? null,
      },
    });

    await this.audit.record(user.id, {
      action: AuditAction.CREATE,
      entity: 'Certificate',
      entityId: row.id,
      after: { employeeId: dto.employeeId, name: dto.name },
    });

    return {
      data: { id: row.id },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  async removeCertificate(id: string, user: AuthenticatedUser) {
    const row = await this.prisma.certificate.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('گواهینامه یافت نشد.');
    const ok = await this.access.canAccessEmployee(user, row.employeeId);
    if (!ok) throw new ForbiddenException('به پرونده این نیرو دسترسی ندارید.');

    await this.prisma.certificate.delete({ where: { id } });
    await this.audit.record(user.id, {
      action: AuditAction.DELETE,
      entity: 'Certificate',
      entityId: id,
      before: { name: row.name },
    });
    return { success: true, timestamp: new Date().toISOString() };
  }
}
