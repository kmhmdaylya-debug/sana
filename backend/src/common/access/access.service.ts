import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser, AccessScope } from '../decorators/current-user.decorator';
import { employmentEnded } from './employment-access';

/**
 * سرویس دسترسی: ترکیب RBAC (نقش/مجوز) و ABAC (حوزه سازمانی).
 * برای جلوگیری از وابستگی حلقوی، فقط به Prisma وابسته است.
 */
@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  /** مجوزهای مؤثر کاربر از طریق نقش‌های فعالش */
  async getEffectivePermissions(userId: string): Promise<string[]> {
    const assignments = await this.prisma.userRole.findMany({
      where: { userId, validFrom: { lte: new Date() }, OR: [{ validTo: null }, { validTo: { gt: new Date() } }] },
      include: {
        role: {
          include: { rolePermissions: { include: { permission: true } } },
        },
      },
    });

    const permissions = new Set<string>();
    for (const a of assignments) {
      if (!a.role.isActive || a.role.deletedAt) continue;
      for (const rp of a.role.rolePermissions) {
        permissions.add(rp.permission.code);
      }
    }
    return [...permissions];
  }

  /**
   * دامنه دسترسی کاربر.
   * اگر مدیر سیستم باشد یا مجوز «دسترسی کامل» داشته باشد، `unrestricted` برابر true است.
   * در غیر این صورت بر اساس ScopeAssignmentها محدوده ساخته می‌شود و
   * در نبود آن، کاربر فقط پرونده خودش را می‌بیند.
   */
  async getScope(userId: string, isSuperAdmin = false): Promise<AccessScope> {
    const empty: AccessScope = {
      unrestricted: false,
      companyIds: [],
      branchIds: [],
      orgUnitIds: [],
      employeeIds: [],
      ownEmployeeId: null,
    };

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, employeeId: true, isSuperAdmin: true },
    });
    if (!user) return empty;
    if (isSuperAdmin || user.isSuperAdmin) return { ...empty, unrestricted: true };

    const assignments = await this.prisma.scopeAssignment.findMany({
      where: { userId, validFrom: { lte: new Date() }, OR: [{ validTo: null }, { validTo: { gt: new Date() } }] },
    });

    const permissions = await this.getEffectivePermissions(userId);
    if (permissions.includes('*')) return { ...empty, unrestricted: true };

    const scope: AccessScope = { ...empty, ownEmployeeId: user.employeeId };
    const orgUnitIds = new Set<string>();

    for (const a of assignments) {
      if (a.scopeType === 'ALL') {
        return { ...empty, unrestricted: true };
      }
      if (a.scopeType === 'COMPANY' && a.companyId) scope.companyIds.push(a.companyId);
      if (a.scopeType === 'BRANCH' && a.branchId) scope.branchIds.push(a.branchId);
      if (a.scopeType === 'ORG_UNIT' && a.orgUnitId) orgUnitIds.add(a.orgUnitId);
      if (a.scopeType === 'EMPLOYEE' && a.employeeId) scope.employeeIds.push(a.employeeId);
    }

    // گسترش واحدهای سازمانی به کل زیرواحدها
    for (const id of orgUnitIds) {
      const descendants = await this.expandOrgUnitIds(id);
      descendants.forEach((d) => orgUnitIds.add(d));
    }
    scope.orgUnitIds = [...orgUnitIds];

    // یکتا کردن شناسه‌ها
    scope.companyIds = [...new Set(scope.companyIds)];
    scope.branchIds = [...new Set(scope.branchIds)];
    scope.employeeIds = [...new Set(scope.employeeIds)];

    return scope;
  }

  /** شناسه واحدهای زیرمجموعه (بازگشتی) */
  async expandOrgUnitIds(rootId: string): Promise<string[]> {
    const root = await this.prisma.orgUnit.findUnique({ where: { id: rootId }, select: { companyId: true } });
    if (!root) return [];
    const result: string[] = [rootId];
    let frontier = [rootId];
    let guard = 0;
    while (frontier.length && guard < 10) {
      guard += 1;
      const children = await this.prisma.orgUnit.findMany({
        where: { parentId: { in: frontier }, companyId: root.companyId, deletedAt: null },
        select: { id: true },
      });
      const next = children.map((c) => c.id).filter((id) => !result.includes(id));
      result.push(...next);
      frontier = next;
    }
    return result;
  }

  /** بارگذاری کامل اطلاعات کاربر برای نشست */
  async buildAuthUser(userId: string): Promise<AuthenticatedUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { employee: { select: { status: true, terminationDate: true, company: { select: { timezone: true } } } }, userRoles: { where: { validFrom: { lte: new Date() }, OR: [{ validTo: null }, { validTo: { gt: new Date() } }], role: { isActive: true, deletedAt: null } }, include: { role: true } } },
    });
    if (!user || user.status !== 'ACTIVE' || user.deletedAt) return null;
    if (!user.isSuperAdmin && employmentEnded(user.employee)) return null;

    const [permissions, scope] = await Promise.all([
      this.getEffectivePermissions(userId),
      this.getScope(userId, user.isSuperAdmin),
    ]);

    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      mobile: user.mobile,
      isSuperAdmin: user.isSuperAdmin,
      employeeId: user.employeeId,
      roleIds: user.userRoles.map((ur) => ur.roleId),
      roleCodes: user.userRoles.map((ur) => ur.role.code),
      permissions,
      scope,
    };
  }

  /**
   * شرط فیلتر پرونده پرسنلی بر اساس حوزه دسترسی کاربر.
   * خروجی: شرط where قابل استفاده در Prisma.
   */
  employeeWhereFor(user: AuthenticatedUser): Prisma.EmployeeWhereInput {
    const { scope } = user;
    if (user.isSuperAdmin || scope.unrestricted) return {};

    const or: Prisma.EmployeeWhereInput[] = [];
    if (scope.companyIds.length) or.push({ companyId: { in: scope.companyIds } });
    if (scope.branchIds.length) or.push({ branchId: { in: scope.branchIds } });
    if (scope.orgUnitIds.length) or.push({ orgUnitId: { in: scope.orgUnitIds } });
    if (scope.employeeIds.length) or.push({ id: { in: scope.employeeIds } });
    if (scope.ownEmployeeId) or.push({ id: scope.ownEmployeeId });

    // سرپرست‌ها نیروهای زیرمجموعه مستقیم خود را نیز می‌بینند
    if (scope.ownEmployeeId && this.hasPermission(user, 'dashboard.view.management')) {
      or.push({ managerId: scope.ownEmployeeId });
    }

    if (!or.length) {
      // کاربر بدون حوزه فقط پرونده خودش را می‌بیند
      return scope.ownEmployeeId ? { id: scope.ownEmployeeId } : { id: { in: [] } };
    }
    return { OR: or };
  }

  /** آیا کاربر به پرونده نیروی مشخص دسترسی دارد؟ (پیشگیری از IDOR) */
  async canAccessEmployee(user: AuthenticatedUser, employeeId: string): Promise<boolean> {
    if (user.isSuperAdmin || user.scope.unrestricted) return true;
    const where = this.employeeWhereFor(user);
    const found = await this.prisma.employee.findFirst({
      where: { AND: [{ id: employeeId }, where] },
      select: { id: true },
    });
    return !!found;
  }

  /**
   * شرکت پیش‌فرض کاربر برای ایجاد رکوردهای وابسته به شرکت.
   * اولویت: شرکتِ پروندهٔ خودِ کاربر، سپس اولین شرکتِ حوزهٔ دسترسی، سپس اولین شرکت فعال.
   */
  async resolveCompanyId(user: AuthenticatedUser): Promise<string> {
    if (user.employeeId) {
      const own = await this.prisma.employee.findUnique({
        where: { id: user.employeeId },
        select: { companyId: true },
      });
      if (own) return own.companyId;
    }
    if (user.scope.companyIds.length) return user.scope.companyIds[0];
    if (!user.isSuperAdmin && !user.scope.unrestricted) throw new ForbiddenException('شرکت مجاز برای این عملیات مشخص نشده است.');
    const fallback = await this.prisma.company.findFirst({
      where: { deletedAt: null, isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (!fallback) {
      throw new BadRequestException('هیچ شرکت فعالی برای ثبت رکورد وجود ندارد؛ ابتدا شرکت بسازید.');
    }
    return fallback.id;
  }

  /**
   * شرکتِ مرجع برای ایجاد رکورد وابسته به شرکت.
   * اگر واحد/سمت/شعبه‌ای داده شده باشد، شرکت از روی همان مرجع استخراج می‌شود
   * تا رکورد با ساختار سازمانی هم‌خوان بماند؛ در غیر این صورت شرکت پیش‌فرض کاربر.
   */
  async resolveCompanyIdForRefs(
    user: AuthenticatedUser,
    refs: { branchId?: string | null; orgUnitId?: string | null; positionId?: string | null },
  ): Promise<string> {
    if (refs.orgUnitId) {
      const unit = await this.prisma.orgUnit.findUnique({ where: { id: refs.orgUnitId }, select: { companyId: true } });
      if (unit) return unit.companyId;
    }
    if (refs.positionId) {
      const position = await this.prisma.position.findUnique({ where: { id: refs.positionId }, select: { companyId: true } });
      if (position) return position.companyId;
    }
    if (refs.branchId) {
      const branch = await this.prisma.branch.findUnique({ where: { id: refs.branchId }, select: { companyId: true } });
      if (branch) return branch.companyId;
    }
    return this.resolveCompanyId(user);
  }

  hasPermission(user: AuthenticatedUser, permission: string): boolean {
    return user.isSuperAdmin || user.permissions.includes('*') || user.permissions.includes(permission);
  }

  async allowedCompanyIds(user: AuthenticatedUser): Promise<string[] | null> {
    if (user.isSuperAdmin || user.scope.unrestricted) return null;
    const ids = new Set(user.scope.companyIds);
    const employees = await this.prisma.employee.findMany({ where: { AND: [this.employeeWhereFor(user)], deletedAt: null }, select: { companyId: true }, distinct: ['companyId'] });
    employees.forEach(employee => ids.add(employee.companyId));
    const branches = user.scope.branchIds.length ? await this.prisma.branch.findMany({ where: { id: { in: user.scope.branchIds }, deletedAt: null }, select: { companyId: true } }) : [];
    const units = user.scope.orgUnitIds.length ? await this.prisma.orgUnit.findMany({ where: { id: { in: user.scope.orgUnitIds }, deletedAt: null }, select: { companyId: true } }) : [];
    [...branches, ...units].forEach(row => ids.add(row.companyId));
    return [...ids];
  }

  async assertCompanyAccess(user: AuthenticatedUser, companyId: string): Promise<void> {
    const ids = await this.allowedCompanyIds(user);
    if (ids !== null && !ids.includes(companyId)) throw new ForbiddenException('به این شرکت دسترسی ندارید.');
  }

  async companyWhereFor(user: AuthenticatedUser): Promise<{ companyId?: Prisma.StringFilter }> {
    const ids = await this.allowedCompanyIds(user);
    return ids === null ? {} : { companyId: { in: ids } };
  }

  async assertCompanyMember(user: AuthenticatedUser, companyId: string, refs: { employeeId?: string | null; userId?: string | null }): Promise<void> {
    await this.assertCompanyAccess(user, companyId);
    if (refs.employeeId) {
      await this.assertEmployeeAccess(user, refs.employeeId);
      const employee = await this.prisma.employee.findFirst({ where: { id: refs.employeeId, companyId, deletedAt: null }, select: { id: true } });
      if (!employee) throw new BadRequestException('کارمند انتخاب‌شده به این شرکت تعلق ندارد.');
    }
    if (refs.userId) {
      const target = await this.prisma.user.findFirst({ where: { id: refs.userId, status: 'ACTIVE', deletedAt: null, employee: { is: { companyId, deletedAt: null } } }, select: { employeeId: true } });
      if (!target?.employeeId || (refs.employeeId && refs.employeeId !== target.employeeId)) throw new BadRequestException('کاربر انتخاب‌شده به این شرکت تعلق ندارد.');
      await this.assertEmployeeAccess(user, target.employeeId);
    }
  }

  async assertEmployeeAccess(user: AuthenticatedUser, employeeId: string): Promise<void> {
    if (!await this.canAccessEmployee(user, employeeId)) throw new ForbiddenException('به این پرونده دسترسی ندارید.');
  }

  async assertEmployeeMutable(user: AuthenticatedUser, employeeId: string, destructive = false): Promise<void> {
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId }, select: { userId: true } });
    const protectedUser = await this.prisma.user.findFirst({
      where: {
        AND: [
          { OR: [{ employeeId }, ...(employee?.userId ? [{ id: employee.userId }] : [])] },
          { OR: [{ isSuperAdmin: true }, { userRoles: { some: { role: { OR: [{ code: 'SUPER_ADMIN' }, { rolePermissions: { some: { permission: { code: { in: ['*', 'users.manage.superadmin'] } } } } }] } } } }] },
        ],
      },
      select: { id: true },
    });
    if (protectedUser && (destructive || !user.isSuperAdmin)) throw new ForbiddenException('پرونده حساب محافظت‌شده از این مسیر قابل تغییر یا خاتمه نیست.');
  }

  async assertOrganizationAccess(user: AuthenticatedUser, companyId: string, branchId?: string | null, orgUnitId?: string | null): Promise<void> {
    await this.assertCompanyAccess(user, companyId);
    await this.assertEmployeeRelations(companyId, { branchId, orgUnitId });
    if (user.isSuperAdmin || user.scope.unrestricted || user.scope.companyIds.includes(companyId)) return;
    const unit = orgUnitId ? await this.prisma.orgUnit.findUnique({ where: { id: orgUnitId }, select: { branchId: true } }) : null;
    if ((branchId && user.scope.branchIds.includes(branchId)) || (orgUnitId && user.scope.orgUnitIds.includes(orgUnitId)) || (unit?.branchId && user.scope.branchIds.includes(unit.branchId))) return;
    throw new ForbiddenException('ثبت یا جابه‌جایی رکورد در این حوزه مجاز نیست.');
  }

  async assertEmployeeRelations(companyId: string, refs: { branchId?: string | null; orgUnitId?: string | null; positionId?: string | null; managerId?: string | null; workLocationId?: string | null; costCenterId?: string | null }): Promise<void> {
    const checks: [string | null | undefined, (id: string) => Promise<{ id: string } | null>][] = [
      [refs.branchId, id => this.prisma.branch.findFirst({ where: { id, companyId, deletedAt: null }, select: { id: true } })],
      [refs.orgUnitId, id => this.prisma.orgUnit.findFirst({ where: { id, companyId, deletedAt: null }, select: { id: true } })],
      [refs.positionId, id => this.prisma.position.findFirst({ where: { id, companyId, isActive: true }, select: { id: true } })],
      [refs.managerId, id => this.prisma.employee.findFirst({ where: { id, companyId, deletedAt: null }, select: { id: true } })],
      [refs.workLocationId, id => this.prisma.workLocation.findFirst({ where: { id, companyId, isActive: true }, select: { id: true } })],
      [refs.costCenterId, id => this.prisma.costCenter.findFirst({ where: { id, companyId, isActive: true }, select: { id: true } })],
    ];
    for (const [id, find] of checks) {
      if (id && !await find(id)) throw new BadRequestException('ارتباط سازمانی انتخاب‌شده به این شرکت تعلق ندارد.');
    }
  }

  async assertGrantableRoles(actor: AuthenticatedUser, roleIds: string[]): Promise<void> {
    const ids = [...new Set(roleIds)];
    const roles = await this.prisma.role.findMany({ where: { id: { in: ids }, isActive: true, deletedAt: null }, include: { rolePermissions: { include: { permission: true } } } });
    if (roles.length !== ids.length) throw new BadRequestException('نقش انتخاب‌شده معتبر نیست.');
    if (actor.isSuperAdmin) return;
    for (const role of roles) {
      const permissions = role.rolePermissions.map(row => row.permission.code);
      if (role.code === 'SUPER_ADMIN' || permissions.some(code => code === '*' || code === 'users.manage.superadmin' || !actor.permissions.includes(code))) throw new ForbiddenException('اجازهٔ واگذاری این سطح دسترسی را ندارید.');
    }
  }

  async assertGrantableScopes(actor: AuthenticatedUser, scopes: { scopeType: string; companyId?: string; branchId?: string; orgUnitId?: string; employeeId?: string }[]): Promise<void> {
    for (const scope of scopes) {
      if (scope.scopeType === 'ALL') {
        if (!actor.isSuperAdmin) throw new ForbiddenException('واگذاری دسترسی سراسری فقط برای مدیر ارشد مجاز است.');
        continue;
      }
      if (scope.scopeType === 'COMPANY' && scope.companyId) {
        if (!actor.isSuperAdmin && !actor.scope.unrestricted && !actor.scope.companyIds.includes(scope.companyId)) throw new ForbiddenException('اجازهٔ واگذاری این شرکت را ندارید.');
        await this.assertCompanyAccess(actor, scope.companyId);
      } else if (scope.scopeType === 'BRANCH' && scope.branchId) {
        const branch = await this.prisma.branch.findUnique({ where: { id: scope.branchId } });
        if (!branch || branch.deletedAt || (scope.companyId && scope.companyId !== branch.companyId)) throw new BadRequestException('شعبهٔ حوزه معتبر نیست.');
        if (!actor.isSuperAdmin && !actor.scope.unrestricted && !actor.scope.companyIds.includes(branch.companyId) && !actor.scope.branchIds.includes(branch.id)) throw new ForbiddenException('اجازهٔ واگذاری این شعبه را ندارید.');
      } else if (scope.scopeType === 'ORG_UNIT' && scope.orgUnitId) {
        const unit = await this.prisma.orgUnit.findUnique({ where: { id: scope.orgUnitId } });
        if (!unit || unit.deletedAt || (scope.companyId && scope.companyId !== unit.companyId)) throw new BadRequestException('واحد حوزه معتبر نیست.');
        if (!actor.isSuperAdmin && !actor.scope.unrestricted && !actor.scope.companyIds.includes(unit.companyId) && !actor.scope.branchIds.includes(unit.branchId ?? '') && !actor.scope.orgUnitIds.includes(unit.id)) throw new ForbiddenException('اجازهٔ واگذاری این واحد را ندارید.');
      } else if (scope.scopeType === 'EMPLOYEE' && scope.employeeId) {
        await this.assertEmployeeAccess(actor, scope.employeeId);
        const employee = await this.prisma.employee.findUnique({ where: { id: scope.employeeId }, select: { companyId: true } });
        if (!employee || (scope.companyId && scope.companyId !== employee.companyId)) throw new BadRequestException('پروندهٔ حوزه معتبر نیست.');
      } else throw new BadRequestException('شناسهٔ متناسب با نوع حوزه الزامی است.');
    }
  }
}
