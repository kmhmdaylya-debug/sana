import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, UserStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AccessService } from '../common/access/access.service';
import { hashPassword, validatePasswordStrength } from '../common/utils/password.util';
import { PaginationDto } from '../common/dto/pagination.dto';
import {
  CreateUserDto,
  ResetPasswordDto,
  ScopeAssignmentDto,
  UpdateUserDto,
  UserQueryDto,
} from './dto/users.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly access: AccessService,
  ) {}

  async list(query: UserQueryDto, pagination: PaginationDto) {
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.roleId ? { userRoles: { some: { roleId: query.roleId } } } : {}),
      ...(query.search
        ? {
            OR: [
              { username: { contains: query.search, mode: 'insensitive' } },
              { fullName: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
              { mobile: { contains: query.search } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          userRoles: { include: { role: true } },
          scopeAssignments: true,
          employee: {
            select: {
              id: true,
              code: true,
              firstName: true,
              lastName: true,
              orgUnit: { select: { id: true, name: true } },
              position: { select: { id: true, title: true } },
            },
          },
        },
      }),
    ]);

    return {
      data: rows.map((u) => this.toPublic(u)),
      meta: {
        total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: Math.ceil(total / pagination.limit),
        hasNext: pagination.page * pagination.limit < total,
        hasPrev: pagination.page > 1,
      },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  async get(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        userRoles: { include: { role: true } },
        scopeAssignments: true,
        sessions: { where: { revokedAt: null }, orderBy: { lastSeenAt: 'desc' } },
        employee: {
          select: {
            id: true,
            code: true,
            firstName: true,
            lastName: true,
            status: true,
            orgUnit: { select: { id: true, name: true } },
            position: { select: { id: true, title: true } },
          },
        },
      },
    });
    if (!user) throw new NotFoundException('کاربر موردنظر یافت نشد.');
    return { ...this.toPublic(user), sessions: user.sessions };
  }

  async create(dto: CreateUserDto, actorId: string) {
    const minLength = 10;
    const strength = validatePasswordStrength(dto.password, minLength);
    if (!strength.ok) throw new BadRequestException(strength.message);

    const existing = await this.prisma.user.findUnique({ where: { username: dto.username.trim() } });
    if (existing) throw new BadRequestException('این نام کاربری قبلاً ثبت شده است.');

    const user = await this.prisma.user.create({
      data: {
        username: dto.username.trim(),
        fullName: dto.fullName.trim(),
        passwordHash: await hashPassword(dto.password),
        email: dto.email ?? null,
        mobile: dto.mobile ?? null,
        employeeId: dto.employeeId ?? null,
        mustChangePassword: dto.mustChangePassword ?? true,
        passwordChangedAt: new Date(),
        userRoles: dto.roleIds?.length
          ? { create: dto.roleIds.map((roleId) => ({ roleId })) }
          : undefined,
        scopeAssignments: dto.scope?.length
          ? { create: dto.scope.map((s) => this.scopeData(s)) }
          : undefined,
      },
      include: { userRoles: { include: { role: true } }, scopeAssignments: true },
    });

    await this.audit.record(actorId, {
      action: AuditAction.CREATE,
      entity: 'User',
      entityId: user.id,
      after: { username: user.username, fullName: user.fullName },
    });

    return this.toPublic(user);
  }

  async update(id: string, dto: UpdateUserDto, actorId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { userRoles: { include: { role: true } }, scopeAssignments: true },
    });
    if (!user) throw new NotFoundException('کاربر موردنظر یافت نشد.');

    const before = {
      fullName: user.fullName,
      status: user.status,
      roles: user.userRoles.map((ur) => ur.role.code),
    };

    if (dto.roleIds) {
      await this.prisma.userRole.deleteMany({ where: { userId: id } });
      if (dto.roleIds.length) {
        await this.prisma.userRole.createMany({
          data: dto.roleIds.map((roleId) => ({ userId: id, roleId, grantedById: actorId })),
        });
      }
    }

    if (dto.scope) {
      await this.prisma.scopeAssignment.deleteMany({ where: { userId: id } });
      if (dto.scope.length) {
        await this.prisma.scopeAssignment.createMany({
          data: dto.scope.map((s) => ({ userId: id, ...this.scopeData(s) })),
        });
      }
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.fullName !== undefined ? { fullName: dto.fullName.trim() } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.mobile !== undefined ? { mobile: dto.mobile } : {}),
        ...(dto.employeeId !== undefined ? { employeeId: dto.employeeId } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.mfaEnabled !== undefined ? { mfaEnabled: dto.mfaEnabled } : {}),
      },
      include: { userRoles: { include: { role: true } }, scopeAssignments: true },
    });

    await this.audit.record(
      actorId,
      {
        action: dto.roleIds || dto.scope ? AuditAction.PERMISSION_CHANGE : AuditAction.UPDATE,
        entity: 'User',
        entityId: id,
        before,
        after: {
          fullName: updated.fullName,
          status: updated.status,
          roles: updated.userRoles.map((ur) => ur.role.code),
        },
      },
    );

    return this.toPublic(updated);
  }

  /** غیرفعال‌سازی کاربر — نشست‌های فعال او باطل می‌شود */
  async deactivate(id: string, actorId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('کاربر موردنظر یافت نشد.');
    if (user.isSuperAdmin) throw new ForbiddenException('حساب مدیر سیستم را نمی‌توان غیرفعال کرد.');

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: { status: UserStatus.INACTIVE, deletedAt: new Date() },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.userSession.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.audit.record(actorId, {
      action: AuditAction.DEACTIVATE,
      entity: 'User',
      entityId: id,
      before: { username: user.username, status: user.status },
    });
    return { success: true };
  }

  async resetPassword(id: string, dto: ResetPasswordDto, actorId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('کاربر موردنظر یافت نشد.');

    const strength = validatePasswordStrength(dto.password, 10);
    if (!strength.ok) throw new BadRequestException(strength.message);

    await this.prisma.user.update({
      where: { id },
      data: {
        passwordHash: await hashPassword(dto.password),
        mustChangePassword: dto.mustChangePassword ?? true,
        passwordChangedAt: new Date(),
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });

    await this.prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.audit.record(actorId, {
      action: AuditAction.PASSWORD_CHANGE,
      entity: 'User',
      entityId: id,
      note: 'بازنشانی رمز عبور توسط مدیر',
    });
    return { success: true };
  }

  /** ابطال نشست‌های فعال یک کاربر */
  async revokeSessions(id: string, actorId: string) {
    const result = await this.prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.prisma.userSession.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit.record(actorId, {
      action: AuditAction.LOGOUT,
      entity: 'User',
      entityId: id,
      note: 'ابطال نشست‌های فعال کاربر',
    });
    return { count: result.count };
  }

  private scopeData(s: ScopeAssignmentDto) {
    return {
      scopeType: s.scopeType,
      companyId: s.companyId ?? null,
      branchId: s.branchId ?? null,
      orgUnitId: s.orgUnitId ?? null,
      employeeId: s.employeeId ?? null,
    };
  }

  private toPublic(u: any) {
    return {
      id: u.id,
      username: u.username,
      fullName: u.fullName,
      email: u.email,
      mobile: u.mobile,
      status: u.status,
      isSuperAdmin: u.isSuperAdmin,
      mustChangePassword: u.mustChangePassword,
      mfaEnabled: u.mfaEnabled,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
      roles: u.userRoles?.map((ur: any) => ({
        id: ur.role.id,
        code: ur.role.code,
        name: ur.role.name,
        validFrom: ur.validFrom,
        validTo: ur.validTo,
      })),
      scope: u.scopeAssignments?.map((s: any) => ({
        id: s.id,
        scopeType: s.scopeType,
        companyId: s.companyId,
        branchId: s.branchId,
        orgUnitId: s.orgUnitId,
        employeeId: s.employeeId,
      })),
      employee: u.employee ?? null,
    };
  }
}
