import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { ALL_PERMISSIONS, PERMISSION_GROUPS } from '../common/constants/permissions';
import { CreateRoleDto, UpdateRoleDto } from './dto/roles.dto';

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async assertGlobalRoleWrite(userId: string) {
    const actor = await this.prisma.user.findUnique({ where: { id: userId }, select: { isSuperAdmin: true, status: true, deletedAt: true } });
    if (!actor?.isSuperAdmin || actor.status !== 'ACTIVE' || actor.deletedAt) throw new ForbiddenException('تعریف نقش‌ها سراسری است و فقط مدیر ارشد می‌تواند آن را تغییر دهد.');
  }

  /** فهرست نقش‌ها همراه با مجوزها */
  async list(includeInactive = false): Promise<any[]> {
    const roles = await this.prisma.role.findMany({
      where: { deletedAt: null, ...(includeInactive ? {} : { isActive: true }) },
      orderBy: { name: 'asc' },
      include: {
        rolePermissions: { include: { permission: true } },
        _count: { select: { userRoles: true } },
      },
    });
    return roles.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      isActive: r.isActive,
      userCount: r._count.userRoles,
      permissions: r.rolePermissions.map((rp) => rp.permission.code),
    }));
  }

  /** فهرست مجوزها به تفکیک گروه — برای نمایش ماتریس دسترسی */
  async permissions() {
    const rows = await this.prisma.permission.findMany({ orderBy: [{ group: 'asc' }, { code: 'asc' }] });
    const grouped = PERMISSION_GROUPS.map((g) => ({
      group: g.group,
      label: g.label,
      permissions: rows
        .filter((p) => p.group === g.group)
        .map((p) => ({ code: p.code, label: p.label, description: p.description })),
    }));
    return { groups: grouped, total: rows.length };
  }

  async create(dto: CreateRoleDto, userId: string): Promise<any> {
    await this.assertGlobalRoleWrite(userId);
    const permissionRows = await this.prisma.permission.findMany({
      where: { code: { in: dto.permissions } },
    });
    if (permissionRows.length !== new Set(dto.permissions).size) {
      throw new NotFoundException('یک یا چند مجوز انتخاب‌شده معتبر نیست.');
    }

    const role = await this.prisma.role.create({
      data: {
        code: dto.code.trim(),
        name: dto.name.trim(),
        description: dto.description ?? null,
        rolePermissions: {
          create: permissionRows.map((p) => ({ permissionId: p.id })),
        },
      },
      include: { rolePermissions: { include: { permission: true } } },
    });

    await this.audit.record(userId, {
      action: AuditAction.PERMISSION_CHANGE,
      entity: 'Role',
      entityId: role.id,
      after: { code: role.code, permissions: dto.permissions },
    });

    return {
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      isActive: role.isActive,
      permissions: role.rolePermissions.map((rp) => rp.permission.code),
    };
  }

  async update(id: string, dto: UpdateRoleDto, userId: string): Promise<any> {
    await this.assertGlobalRoleWrite(userId);
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { rolePermissions: { include: { permission: true } } },
    });
    if (!role) throw new NotFoundException('نقش موردنظر یافت نشد.');
    if (role.code === 'SUPER_ADMIN') throw new ForbiddenException('نقش مدیر ارشد از این مسیر قابل تغییر نیست.');

    const before = { name: role.name, isActive: role.isActive, permissions: role.rolePermissions.map((rp) => rp.permission.code) };

    if (dto.permissions) {
      const permissionRows = await this.prisma.permission.findMany({
        where: { code: { in: dto.permissions } },
      });
      await this.prisma.$transaction([
        this.prisma.rolePermission.deleteMany({ where: { roleId: id } }),
        this.prisma.rolePermission.createMany({
          data: permissionRows.map((p) => ({ roleId: id, permissionId: p.id })),
        }),
      ]);
    }

    const updated = await this.prisma.role.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      include: { rolePermissions: { include: { permission: true } } },
    });

    await this.audit.record(
      userId,
      {
        action: AuditAction.PERMISSION_CHANGE,
        entity: 'Role',
        entityId: id,
        before,
        after: {
          name: updated.name,
          isActive: updated.isActive,
          permissions: updated.rolePermissions.map((rp) => rp.permission.code),
        },
      },
    );

    return {
      id: updated.id,
      code: updated.code,
      name: updated.name,
      description: updated.description,
      isSystem: updated.isSystem,
      isActive: updated.isActive,
      permissions: updated.rolePermissions.map((rp) => rp.permission.code),
    };
  }

  /** حذف نقش — فقط اگر کاربری نداشته باشد و نقش سیستمی نباشد */
  async remove(id: string, userId: string): Promise<{ success: boolean }> {
    await this.assertGlobalRoleWrite(userId);
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { userRoles: true } } },
    });
    if (!role) throw new NotFoundException('نقش موردنظر یافت نشد.');
    if (role.isSystem) throw new NotFoundException('نقش‌های سیستمی قابل حذف نیستند.');
    if (role._count.userRoles > 0) {
      throw new NotFoundException('این نقش به کاربران تخصیص داده شده و قابل حذف نیست.');
    }

    await this.prisma.role.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.record(userId, {
      action: AuditAction.DELETE,
      entity: 'Role',
      entityId: id,
      before: { code: role.code },
    });
    return { success: true };
  }

  /** همگام‌سازی فهرست مجوزها با کدهای تعریف‌شده در کد سامانه */
  async syncPermissions(): Promise<{ created: number }> {
    const existing = await this.prisma.permission.findMany();
    const existingCodes = new Set(existing.map((p) => p.code));
    const missing = ALL_PERMISSIONS.filter((code) => !existingCodes.has(code));

    if (missing.length) {
      await this.prisma.permission.createMany({
        data: missing.map((code) => {
          const group = code.split('.')[0];
          const label = PERMISSION_GROUPS.find((g) => g.group === group)?.label ?? group;
          return { code, label: `${label} — ${code.split('.')[1]}`, group };
        }),
      });
    }
    return { created: missing.length };
  }
}
