import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { stringifyAudit } from './audit-redaction';
import { ConfigService } from '@nestjs/config';

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

/** شناسهٔ کاربر در AuditLog ستون UUID با کلید خارجی به User است. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * ثبت لاگ ممیزی. لاگ‌ها فقط‌خواندنی‌اند و قابل ویرایش یا حذف نیستند.
 * هر عملیات حساس (تغییر نقش، مشاهده حقوق، خروجی گرفتن، …) باید ثبت شود.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * ثبت لاگ ممیزی داخل تراکنش جاری.
   * ستون userId از نوع UUID و کلید خارجی به User است؛ بازیگران سیستمی (Jobها)
   * ردیف کاربر ندارند، پس شناسهٔ نامعتبر به null تبدیل می‌شود تا تراکنش اصلی نشکند
   * و هویت سیستمی در قسمت note حفظ شود.
   */
  async recordInTransaction(db: Prisma.TransactionClient, userId: string | null, entry: AuditEntry): Promise<void> {
    const validUserId = userId && UUID_PATTERN.test(userId) ? userId : null;
    if (userId && !validUserId) {
      this.logger.warn(`Audit actor "${userId.slice(0, 64)}" is not a UUID; storing the entry with a null userId.`);
    }
    const note = validUserId === null && userId ? `${entry.note ?? ''} [actor: ${userId.slice(0, 60)}]`.slice(0, 500) : entry.note;
    await db.auditLog.create({ data: { userId: validUserId, action: entry.action, entity: entry.entity, entityId: entry.entityId ?? null, before: stringifyAudit(entry.before), after: stringifyAudit(entry.after), note: note ?? null } });
  }

  /**
   * ثبت لاگ با الگوی Outbox برای اطمینان از ذخیره‌سازی مطمئن.
   * اگر تراکنش جاری وجود دارد، در همان تراکنش ثبت می‌شود.
   * در غیر این صورت، رکورد در جدول outbox ذخیره می‌شود تا به‌صورت async پردازش شود.
   */
  async record(
    userId: string | null | undefined,
    entry: AuditEntry,
    ctx: AuditContext = {},
  ): Promise<void> {
    try {
      // تلاش برای ثبت در تراکنش جاری (اگر وجود داشته باشد)
      await this.prisma.auditLog.create({
        data: {
          userId: userId ?? null,
          action: entry.action,
          entity: entry.entity,
          entityId: entry.entityId ?? null,
          before: stringifyAudit(entry.before),
          after: stringifyAudit(entry.after),
          ip: ctx.ip ?? null,
          userAgent: ctx.userAgent ?? null,
          requestId: ctx.requestId ?? null,
          note: ctx.note ?? null,
        },
      });
    } catch (e) {
      // در صورت خطا، در جدول outbox ذخیره شود برای پردازش بعدی
      try {
        await this.prisma.auditOutbox.create({
          data: {
            userId: userId ?? null,
            action: entry.action,
            entity: entry.entity,
            entityId: entry.entityId ?? null,
            before: stringifyAudit(entry.before),
            after: stringifyAudit(entry.after),
            ip: ctx.ip ?? null,
            userAgent: ctx.userAgent ?? null,
            requestId: ctx.requestId ?? null,
            note: ctx.note ?? null,
            retryCount: 0,
          },
        });
      } catch {
        // ثبت لاگ نباید باعث شکست عملیات اصلی شود - trừ khi failOpen=false
        this.logger.error('Audit write failed', e);
        const failOpen = this.config.get('app.audit.failOpen') ?? true;
        const alertOnFailure = this.config.get('app.audit.alertOnFailure') ?? true;
        
        if (alertOnFailure) {
          // Log critical alert for audit failure
          this.logger.error(`AUDIT FAILURE ALERT: Failed to record ${entry.action} on ${entry.entity} for user ${userId}`);
        }
        
        const sensitiveActions = [AuditAction.VIEW_SENSITIVE, AuditAction.EXPORT, AuditAction.DOWNLOAD, AuditAction.BACKUP, AuditAction.RESTORE];
        if (sensitiveActions.includes(entry.action as never)) {
          throw new ServiceUnavailableException('ثبت سابقه امنیتی ممکن نشد؛ عملیات حساس انجام نشد.');
        }
        if (!failOpen) {
          throw new ServiceUnavailableException('ثبت سابقه امنیتی ممکن نشد؛ عملیات متوقف شد.');
        }
        // در حالت failOpen، لاگ کردن و ادامه عملیات
        this.logger.warn('Audit write failed; continuing in fail-open mode');
      }
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
    // Express applies the configured trusted-proxy policy; raw headers are spoofable.
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

