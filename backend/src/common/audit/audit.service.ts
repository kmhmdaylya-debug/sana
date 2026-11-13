import { Injectable, Logger } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditContext {
  ip?: string;
  userAgent?: string;
  requestId?: string;
  note?: string;
}

export interface AuditEntry {
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  note?: string;
}

/**
 * ثبت لاگ ممیزی. لاگ‌ها فقط‌خواندنی‌اند و قابل ویرایش یا حذف نیستند.
 * هر عملیات حساس (تغییر نقش، مشاهده حقوق، خروجی گرفتن، …) باید ثبت شود.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(
    userId: string | null | undefined,
    entry: AuditEntry,
    ctx: AuditContext = {},
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: userId ?? null,
          action: entry.action,
          entity: entry.entity,
          entityId: entry.entityId ?? null,
          before: entry.before === undefined ? null : safeStringify(entry.before),
          after: entry.after === undefined ? null : safeStringify(entry.after),
          ip: ctx.ip ?? null,
          userAgent: ctx.userAgent ?? null,
          requestId: ctx.requestId ?? null,
          note: ctx.note ?? null,
        },
      });
    } catch (e) {
      // ثبت لاگ نباید باعث شکست عملیات اصلی شود
      this.logger.warn(`ثبت لاگ ممیزی ناموفق بود: ${(e as Error).message}`);
    }
  }

  /** ثبت مشاهده اطلاعات حساس (حقوق، کد ملی، …) */
  async recordView(
    userId: string,
    entity: string,
    entityId: string,
    ctx: AuditContext = {},
  ): Promise<void> {
    await this.record(userId, { action: AuditAction.VIEW_SENSITIVE, entity, entityId }, ctx);
  }

  /** ثبت خروجی گرفتن / دانلود */
  async recordExport(
    userId: string,
    entity: string,
    entityId: string | null,
    ctx: AuditContext = {},
  ): Promise<void> {
    await this.record(
      userId,
      { action: AuditAction.EXPORT, entity, entityId },
      { ...ctx, note: ctx.note ?? 'خروجی گرفتن از سامانه' },
    );
  }

  /** استخراج نشانی IP از درخواست HTTP */
  extractIp(request: { headers?: Record<string, any>; ip?: string; socket?: { remoteAddress?: string } }): string | null {
    const forwarded = request?.headers?.['x-forwarded-for'];
    if (forwarded) {
      const first = String(forwarded).split(',')[0].trim();
      if (first) return first;
    }
    const real = request?.headers?.['x-real-ip'];
    if (real) return String(real).slice(0, 64);
    return (request?.ip ?? request?.socket?.remoteAddress ?? null)?.toString().slice(0, 64) ?? null;
  }

  /** ساخت بافت لاگ از درخواست HTTP */
  contextFrom(request: any): AuditContext {
    return {
      ip: this.extractIp(request),
      userAgent: request?.headers?.['user-agent']?.toString().slice(0, 255) ?? null,
      requestId: request?.headers?.['x-request-id']?.toString().slice(0, 64) ?? null,
    };
  }
}

function safeStringify(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  try {
    return JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v));
  } catch {
    return String(value);
  }
}
