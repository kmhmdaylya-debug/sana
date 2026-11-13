import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser, AccessScope } from '../decorators/current-user.decorator';

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
      where: { userId, OR: [{ validTo: null }, { validTo: { gt: new Date() } }] },
      include: {
        role: {
          include: { rolePermissions: { include: { permission: true } } },
        },
      },
    });

    const permissions = new Set<string>();
    for (const a of assignments) {
      if (!a.role.isActive) continue;
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
      where: { userId, OR: [{ validTo: null }, { validTo: { gt: new Date() } }] },
    });

    const permissions = await this.getEffectivePermissions(userId);
    if (permissions.includes('*')) return { ...empty, unrestricted: true };

    const scope: AccessScope = { ...empty, ownEmployeeId: user.employeeId };
    const orgUnitIds = new Set<string>();

    for (const a of assignments) {
      if (a.scopeType === 'ALL') {
        return { ...empty, unrestricted: true };
      }
      if (a.companyId) scope.companyIds.push(a.companyId);
      if (a.branchId) scope.branchIds.push(a.branchId);
      if (a.orgUnitId) orgUnitIds.add(a.orgUnitId);
      if (a.employeeId) scope.employeeIds.push(a.employeeId);
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
    const result: string[] = [rootId];
    let frontier = [rootId];
    let guard = 0;
    while (frontier.length && guard < 10) {
      guard += 1;
      const children = await this.prisma.orgUnit.findMany({
        where: { parentId: { in: frontier }, deletedAt: null },
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
      include: { userRoles: { include: { role: true } } },
    });
    if (!user || user.status !== 'ACTIVE' || user.deletedAt) return null;

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
    if (scope.unrestricted) return {};

    const or: Prisma.EmployeeWhereInput[] = [];
    if (scope.companyIds.length) or.push({ companyId: { in: scope.companyIds } });
    if (scope.branchIds.length) or.push({ branchId: { in: scope.branchIds } });
    if (scope.orgUnitIds.length) or.push({ orgUnitId: { in: scope.orgUnitIds } });
    if (scope.employeeIds.length) or.push({ id: { in: scope.employeeIds } });
    if (scope.ownEmployeeId) or.push({ id: scope.ownEmployeeId });

    // سرپرست‌ها نیروهای زیرمجموعه مستقیم خود را نیز می‌بینند
    if (scope.ownEmployeeId) {
      or.push({ managerId: scope.ownEmployeeId });
    }

    if (!or.length) {
      // کاربر بدون حوزه فقط پرونده خودش را می‌بیند
      return scope.ownEmployeeId ? { id: scope.ownEmployeeId } : { id: '__none__' };
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
}
