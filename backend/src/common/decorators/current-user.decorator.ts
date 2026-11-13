import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * کاربر احراز هویت‌شده جاری.
 * `scope` دامنه دسترسی (شرکت/شعبه/واحد) کاربر را مشخص می‌کند.
 */
export interface AuthenticatedUser {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  mobile: string | null;
  isSuperAdmin: boolean;
  employeeId: string | null;
  roleIds: string[];
  roleCodes: string[];
  permissions: string[];
  /** دامنه دسترسی مؤثر — اگر unrestricted باشد کاربر به همه رکوردها دسترسی دارد */
  scope: AccessScope;
}

/** دامنه دسترسی (ABAC) */
export interface AccessScope {
  unrestricted: boolean;
  companyIds: string[];
  branchIds: string[];
  orgUnitIds: string[];
  employeeIds: string[];
  ownEmployeeId: string | null;
}

/** کاربر احراز هویت‌شده جاری را از request استخراج می‌کند */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;
    if (!user) return undefined;
    return data ? user[data] : user;
  },
);
