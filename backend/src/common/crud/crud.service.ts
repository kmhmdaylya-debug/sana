import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

export interface ListOptions {
  page?: number;
  limit?: number;
  orderBy?: any;
  include?: any;
  select?: any;
}

/**
 * کمکی‌های مشترک CRUD برای کاهش تکرار کد در ماژول‌ها.
 * همه ماژول‌ها از همین الگو برای صفحه‌بندی، حذف منطقی و ثبت لاگ استفاده می‌کنند.
 */
@Injectable()
export class CrudService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** فهرست صفحه‌بندی‌شده با قالب پاسخ استاندارد */
  async paginate<T = any>(
    model: any,
    where: any,
    options: ListOptions = {},
  ): Promise<{ data: T[]; meta: any; success: true; timestamp: string }> {
    const page = options.page && options.page > 0 ? options.page : 1;
    const limit = options.limit && options.limit > 0 ? options.limit : 20;
    const [total, rows] = await Promise.all([
      model.count({ where }),
      model.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        ...(options.orderBy ? { orderBy: options.orderBy } : {}),
        ...(options.include ? { include: options.include } : {}),
        ...(options.select ? { select: options.select } : {}),
      }),
    ]);

    return {
      data: rows as T[],
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

  /** دریافت یک رکورد یا خطای «یافت نشد» */
  async findOneOrFail<T = any>(model: any, where: any, include?: any): Promise<T> {
    const row = await model.findFirst({ where, ...(include ? { include } : {}) });
    if (!row) throw new NotFoundException('رکورد موردنظر یافت نشد.');
    return row as T;
  }

  /** حذف منطقی — رکورد در پایگاه داده باقی می‌ماند */
  async softDelete(
    model: any,
    id: string,
    userId: string,
    entity: string,
    before?: unknown,
    reason?: string,
  ): Promise<{ success: boolean }> {
    const row = await model.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('رکورد موردنظر یافت نشد.');
    const data: any = { deletedAt: new Date() };
    if ('isActive' in row) data.isActive = false;
    await model.update({ where: { id }, data });
    await this.audit.record(userId, {
      action: AuditAction.DELETE,
      entity,
      entityId: id,
      before: before ?? row,
      note: reason,
    });
    return { success: true };
  }

  /** ثبت لاگ ایجاد/ویرایش */
  async track(
    userId: string,
    action: AuditAction,
    entity: string,
    entityId: string,
    payload: { before?: unknown; after?: unknown; note?: string },
  ): Promise<void> {
    await this.audit.record(userId, { action, entity, entityId, ...payload });
  }
}
