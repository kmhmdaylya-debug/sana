import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import {
  CreateCustomFieldDto,
  CreateSavedFilterDto,
  CustomFieldQueryDto,
  SettingQueryDto,
} from './dto/settings.dto';

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // =========================================================================
  // تنظیمات سیستمی
  // =========================================================================

  async listSettings(query: SettingQueryDto, pagination: PaginationDto) {
    const where: Prisma.SettingWhereInput = {
      ...(query.group ? { group: query.group } : {}),
      ...(query.key ? { key: { contains: query.key, mode: 'insensitive' } } : {}),
    };

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 50;
    const [total, rows] = await Promise.all([
      this.prisma.setting.count({ where }),
      this.prisma.setting.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ group: 'asc' }, { label: 'asc' }],
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

  /** گروه‌های تنظیمات برای فیلتر */
  async settingGroups() {
    const rows = await this.prisma.setting.groupBy({ by: ['group'] });
    return {
      data: rows.map((r) => r.group),
      meta: { total: rows.length, page: 1, limit: rows.length, totalPages: 1, hasNext: false, hasPrev: false },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  async updateSetting(key: string, value: string, user: AuthenticatedUser) {
    const setting = await this.prisma.setting.findUnique({ where: { key } });
    if (!setting) throw new NotFoundException(`تنظیم «${key}» یافت نشد.`);

    const row = await this.prisma.setting.update({
      where: { key },
      data: { value, updatedById: user.id },
    });

    await this.audit.record(user.id, {
      action: AuditAction.SETTINGS_CHANGE,
      entity: 'Setting',
      entityId: row.id,
      before: { key: setting.key, value: setting.value },
      after: { key: setting.key, value },
    });

    return {
      data: { key: row.key, value: row.value },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  // =========================================================================
  // فیلدهای سفارشی
  // =========================================================================

  async listCustomFields(query: CustomFieldQueryDto, pagination: PaginationDto) {
    const where: Prisma.CustomFieldDefinitionWhereInput = {
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.entity ? { entity: query.entity } : {}),
    };

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 50;
    const [total, rows] = await Promise.all([
      this.prisma.customFieldDefinition.count({ where }),
      this.prisma.customFieldDefinition.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
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

  async createCustomField(dto: CreateCustomFieldDto, user: AuthenticatedUser) {
    const duplicate = await this.prisma.customFieldDefinition.findUnique({
      where: { companyId_entity_code: { companyId: dto.companyId, entity: dto.entity, code: dto.code.trim() } },
    });
    if (duplicate) throw new BadRequestException(`فیلد سفارشی «${dto.code}» برای این موجودیت قبلاً ثبت شده است.`);

    const row = await this.prisma.customFieldDefinition.create({
      data: {
        companyId: dto.companyId,
        entity: dto.entity,
        code: dto.code.trim(),
        label: dto.label.trim(),
        dataType: dto.dataType ?? 'text',
        options: dto.options ?? null,
        isRequired: dto.isRequired ?? false,
        sortOrder: dto.sortOrder ?? 0,
      },
    });

    await this.audit.record(user.id, {
      action: AuditAction.CREATE,
      entity: 'CustomFieldDefinition',
      entityId: row.id,
      after: { entity: dto.entity, code: row.code },
    });

    return {
      data: { id: row.id },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  /** غیرفعال‌سازی فیلد سفارشی (حذف منطقی با isActive) */
  async removeCustomField(id: string, user: AuthenticatedUser) {
    const field = await this.prisma.customFieldDefinition.findUnique({ where: { id } });
    if (!field) throw new NotFoundException('فیلد سفارشی یافت نشد.');

    await this.prisma.customFieldDefinition.update({ where: { id }, data: { isActive: false } });
    await this.audit.record(user.id, {
      action: AuditAction.DEACTIVATE,
      entity: 'CustomFieldDefinition',
      entityId: id,
      before: { code: field.code, isActive: field.isActive },
    });

    return { success: true, timestamp: new Date().toISOString() };
  }

  // =========================================================================
  // فیلترهای ذخیره‌شده
  // =========================================================================

  async listSavedFilters(query: { scope?: string }, user: AuthenticatedUser) {
    const rows = await this.prisma.savedFilter.findMany({
      where: { userId: user.id, ...(query.scope ? { scope: query.scope } : {}) },
      orderBy: { createdAt: 'desc' },
    });
    return {
      data: rows,
      meta: { total: rows.length, page: 1, limit: rows.length, totalPages: 1, hasNext: false, hasPrev: false },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  async createSavedFilter(dto: CreateSavedFilterDto, user: AuthenticatedUser) {
    // اعتبارسنجی JSON
    try {
      JSON.parse(dto.params);
    } catch {
      throw new BadRequestException('پارامترهای فیلتر باید JSON معتبر باشند.');
    }

    const duplicate = await this.prisma.savedFilter.findUnique({
      where: { userId_scope_name: { userId: user.id, scope: dto.scope, name: dto.name.trim() } },
    });
    if (duplicate) throw new BadRequestException('فیلتری با این نام در این حوزه ذخیره شده است.');

    const row = await this.prisma.savedFilter.create({
      data: {
        userId: user.id,
        scope: dto.scope,
        name: dto.name.trim(),
        params: dto.params,
      },
    });

    return {
      data: { id: row.id },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  async removeSavedFilter(id: string, user: AuthenticatedUser) {
    const row = await this.prisma.savedFilter.findUnique({ where: { id } });
    if (!row || row.userId !== user.id) throw new NotFoundException('فیلتر ذخیره‌شده یافت نشد.');

    await this.prisma.savedFilter.delete({ where: { id } });
    return { success: true, timestamp: new Date().toISOString() };
  }
}
