import { Injectable } from '@nestjs/common';
import {
  NotificationChannel,
  NotificationSeverity,
  NotificationType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface NotifyInput {
  type?: NotificationType;
  severity?: NotificationSeverity;
  title: string;
  body?: string;
  link?: string;
  channel?: NotificationChannel;
  isCritical?: boolean;
  senderId?: string;
}

/**
 * سرویس اعلان‌ها — کانال پیش‌فرض «درون‌برنامه‌ای».
 * صف پیامک/ایمیل در فاز یکپارچگی (بخش ۸ سند) به همین سرویس متصل می‌شود.
 */
@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  async notify(userId: string, input: NotifyInput): Promise<void> {
    await this.prisma.notification.create({
      data: {
        userId,
        type: input.type ?? NotificationType.SYSTEM,
        severity: input.severity ?? NotificationSeverity.INFO,
        title: input.title,
        body: input.body ?? null,
        link: input.link ?? null,
        channel: input.channel ?? NotificationChannel.IN_APP,
        status: 'SENT',
        isCritical: input.isCritical ?? false,
        senderId: input.senderId ?? null,
        sentAt: new Date(),
      },
    });
  }

  async notifyMany(userIds: string[], input: NotifyInput): Promise<void> {
    if (!userIds.length) return;
    await this.prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        type: input.type ?? NotificationType.SYSTEM,
        severity: input.severity ?? NotificationSeverity.INFO,
        title: input.title,
        body: input.body ?? null,
        link: input.link ?? null,
        channel: input.channel ?? NotificationChannel.IN_APP,
        status: 'SENT',
        isCritical: input.isCritical ?? false,
        senderId: input.senderId ?? null,
        sentAt: new Date(),
      })),
    });
  }

  /** اعلان به کاربرانی که مجوز مشخصی دارند */
  async notifyRoles(roleCodes: string[], input: NotifyInput): Promise<void> {
    const users = await this.prisma.user.findMany({
      where: { status: 'ACTIVE', userRoles: { some: { role: { code: { in: roleCodes } } } } },
      select: { id: true },
    });
    await this.notifyMany(
      users.map((u) => u.id),
      input,
    );
  }

  /** اعلان به همه کاربران یک واحد سازمانی */
  async notifyOrgUnit(orgUnitId: string, input: NotifyInput): Promise<void> {
    const employees = await this.prisma.employee.findMany({
      where: { orgUnitId, status: 'ACTIVE', userId: { not: null } },
      select: { userId: true },
    });
    await this.notifyMany(
      employees.map((e) => e.userId).filter((v): v is string => !!v),
      input,
    );
  }
}
