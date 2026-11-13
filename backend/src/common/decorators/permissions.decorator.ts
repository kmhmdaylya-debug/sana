import { SetMetadata } from '@nestjs/common';
import { PermissionCode } from '../constants/permissions';

export const PERMISSIONS_KEY = 'required_permissions';

/**
 * حداقل مجوزهای لازم برای دسترسی به یک مسیر.
 * همه مجوزهای اعلام‌شده باید در کاربر وجود داشته باشند (AND).
 */
export const RequirePermissions = (...permissions: PermissionCode[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/** یکی از مجوزها کافی است (OR). */
export const RequireAnyPermission = (...permissions: PermissionCode[]) =>
  SetMetadata(PERMISSIONS_KEY, { permissions, mode: 'any' });
