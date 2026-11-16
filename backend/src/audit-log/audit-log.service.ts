import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { AuditLogQueryDto } from './dto/audit-log.dto';
import { sanitizeStoredAudit } from '../common/audit/audit-redaction';

@Injectable()
export class AuditLogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: AuditLogQueryDto, pagination: PaginationDto, user: AuthenticatedUser) {
    const where: Prisma.AuditLogWhereInput = {
      AND: [this.scope(user)],
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.entity ? { entity: { contains: query.entity, mode: 'insensitive' } } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(`${query.from}T00:00:00.000Z`) } : {}),
              ...(query.to ? { lte: new Date(`${query.to}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
    };

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 50;
    const [total, rows] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, fullName: true, username: true } } },
      }),
    ]);

    await this.audit.record(user.id, {
      action: AuditAction.VIEW_SENSITIVE,
      entity: 'AuditLog',
      note: 'مشاهده لاگ ممیزی',
    });

    return {
      data: rows.map(row => this.publicRow(row)),
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
    const row = await this.prisma.auditLog.findFirst({
      where: { id, AND: [this.scope(user)] },
      include: { user: { select: { id: true, fullName: true, username: true } } },
    });
    if (!row) throw new NotFoundException('رکورد ممیزی یافت نشد.');
    return {
      data: this.publicRow(row),
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  private scope(user: AuthenticatedUser): Prisma.AuditLogWhereInput {
    // Audit rows have no tenant field: actor-based company joins are not reliable.
    return user.isSuperAdmin ? {} : { userId: user.id };
  }

  private publicRow<T extends { before: string | null; after: string | null }>(row: T) {
    return { ...row, before: sanitizeStoredAudit(row.before), after: sanitizeStoredAudit(row.after) };
  }
}
