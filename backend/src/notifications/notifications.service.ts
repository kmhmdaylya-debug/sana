import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { NotificationQueryDto } from './dto/notifications.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: NotificationQueryDto, pagination: PaginationDto, user: AuthenticatedUser) {
    const where: Prisma.NotificationWhereInput = {
      userId: user.id,
      ...(query.status ? { status: query.status } : {}),
      ...(query.unread ? { readAt: null } : {}),
    };

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const [total, unreadCount, rows] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId: user.id, readAt: null } }),
      this.prisma.notification.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
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
      unreadCount,
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  async unreadCount(user: AuthenticatedUser) {
    const count = await this.prisma.notification.count({
      where: { userId: user.id, readAt: null },
    });
    return {
      data: { unreadCount: count },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  /** علامت‌گذاری به‌عنوان خوانده‌شده */
  async markRead(id: string, user: AuthenticatedUser) {
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification || notification.userId !== user.id) {
      throw new NotFoundException('اعلان یافت نشد.');
    }
    if (!notification.readAt) {
      await this.prisma.notification.update({
        where: { id },
        data: { readAt: new Date(), status: NotificationStatus.SENT },
      });
    }
    return { success: true, timestamp: new Date().toISOString() };
  }

  /** خواندن همه اعلان‌ها */
  async markAllRead(user: AuthenticatedUser) {
    const result = await this.prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date(), status: NotificationStatus.SENT },
    });
    return {
      data: { updated: result.count },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }
}
