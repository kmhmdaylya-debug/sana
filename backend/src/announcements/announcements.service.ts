import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AccessService } from '../common/access/access.service';
import { AuditService } from '../common/audit/audit.service';
import { NotificationService } from '../common/notifications/notification.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { AnnouncementQueryDto, CreateAnnouncementDto } from './dto/announcements.dto';

@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
  ) {}

  async list(query: AnnouncementQueryDto, pagination: PaginationDto, user: AuthenticatedUser) {
    const where: Prisma.AnnouncementWhereInput = {
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.search ? { title: { contains: query.search } } : {}),
    };

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const [total, rows] = await Promise.all([
      this.prisma.announcement.count({ where }),
      this.prisma.announcement.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { publishedAt: 'desc' },
        include: {
          company: { select: { id: true, code: true, name: true } },
          publishedBy: { select: { id: true, fullName: true } },
          acks: { where: { userId: user.id }, select: { acknowledgedAt: true } },
          _count: { select: { acks: true } },
        },
      }),
    ]);

    let data = rows;
    if (query.pendingAck) {
      data = rows.filter((a) => a.requiresAck && a.acks.length === 0);
    }

    return {
      data: data.map((a) => ({
        id: a.id,
        companyId: a.companyId,
        title: a.title,
        body: a.body,
        targetType: a.targetType,
        targetId: a.targetId,
        requiresAck: a.requiresAck,
        attachmentPath: a.attachmentPath,
        publishedBy: a.publishedBy,
        publishedAt: a.publishedAt,
        expiresAt: a.expiresAt,
        ackCount: a._count.acks,
        acknowledgedByMe: a.acks.length > 0 ? a.acks[0].acknowledgedAt : null,
      })),
      meta: {
        total: query.pendingAck ? data.length : total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil((query.pendingAck ? data.length : total) / limit)),
        hasNext: page * limit < (query.pendingAck ? data.length : total),
        hasPrev: page > 1,
      },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  async get(id: string, user: AuthenticatedUser) {
    const row = await this.prisma.announcement.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, code: true, name: true } },
        publishedBy: { select: { id: true, fullName: true } },
        acks: {
          include: { user: { select: { id: true, fullName: true } } },
          orderBy: { acknowledgedAt: 'desc' },
        },
      },
    });
    if (!row) throw new NotFoundException('اعلامیه یافت نشد.');

    await this.audit.record(user.id, {
      action: AuditAction.CREATE,
      entity: 'Announcement',
      entityId: id,
      note: 'مشاهده اعلامیه',
    });

    return {
      data: {
        ...row,
        myAck: row.acks.find((a) => a.userId === user.id)?.acknowledgedAt ?? null,
      },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  /** انتشار اعلامیه + اطلاع‌رسانی */
  async create(dto: CreateAnnouncementDto, user: AuthenticatedUser) {
    const row = await this.prisma.announcement.create({
      data: {
        companyId: dto.companyId,
        title: dto.title.trim(),
        body: dto.body,
        targetType: dto.targetType ?? 'ALL',
        targetId: dto.targetId ?? null,
        requiresAck: dto.requiresAck ?? false,
        attachmentPath: dto.attachmentPath ?? null,
        publishedById: user.id,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });

    // اطلاع‌رسانی به کاربران هدف
    const userWhere: Prisma.UserWhereInput = {
      status: 'ACTIVE',
      ...(dto.targetType === 'ORG_UNIT' && dto.targetId
        ? { employee: { orgUnitId: dto.targetId, deletedAt: null } }
        : dto.targetType === 'BRANCH' && dto.targetId
          ? { employee: { branchId: dto.targetId, deletedAt: null } }
          : dto.targetType === 'POSITION' && dto.targetId
            ? { employee: { positionId: dto.targetId, deletedAt: null } }
            : {}),
    };
    const users = await this.prisma.user.findMany({
      where: userWhere,
      select: { id: true },
      take: 500,
    });
    for (const u of users) {
      if (u.id !== user.id) {
        await this.notifications.notify(u.id, {
          type: NotificationType.ANNOUNCEMENT,
          title: row.title,
          body: row.body.slice(0, 200),
          link: `/announcements/${row.id}`,
        });
      }
    }

    await this.audit.record(user.id, {
      action: AuditAction.CREATE,
      entity: 'Announcement',
      entityId: row.id,
      after: { title: row.title, targetType: row.targetType, notified: users.length },
    });

    return {
      data: { id: row.id, notified: users.length },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  /** تأیید مطالعه اعلامیه */
  async acknowledge(id: string, user: AuthenticatedUser) {
    const announcement = await this.prisma.announcement.findUnique({ where: { id } });
    if (!announcement) throw new NotFoundException('اعلامیه یافت نشد.');

    await this.prisma.announcementAck.upsert({
      where: { announcementId_userId: { announcementId: id, userId: user.id } },
      create: { announcementId: id, userId: user.id },
      update: {},
    });

    return {
      data: { id, acknowledgedAt: new Date().toISOString() },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  /** حذف منطقی اعلامیه */
  async remove(id: string, user: AuthenticatedUser) {
    const row = await this.prisma.announcement.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('اعلامیه یافت نشد.');
    if (row.publishedById !== user.id && !user.isSuperAdmin) {
      throw new NotFoundException('اعلامیه یافت نشد.');
    }

    await this.prisma.announcement.delete({ where: { id } });
    await this.audit.record(user.id, {
      action: AuditAction.DELETE,
      entity: 'Announcement',
      entityId: id,
      before: { title: row.title },
    });

    return { success: true, timestamp: new Date().toISOString() };
  }
}
