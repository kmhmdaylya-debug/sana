import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { AuthenticatedUser } from '../decorators/current-user.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * کنترل مجوزها در سمت سرور.
 * این گارد تنها منبع تصمیم‌گیری درباره دسترسی است — رابط کاربری صرفاً آن را پنهان می‌کند.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const metadata = this.reflector.getAllAndOverride<unknown>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!metadata) return true;

    // RequirePermissions آرایه می‌گذارد و RequireAnyPermission شیء { permissions, mode }
    const required: string[] = Array.isArray(metadata)
      ? (metadata as string[])
      : ((metadata as { permissions?: string[] }).permissions ?? []);
    const mode: 'all' | 'any' = Array.isArray(metadata)
      ? 'all'
      : ((metadata as { mode?: 'all' | 'any' }).mode ?? 'all');
    if (!required.length) return true;

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;
    if (!user) throw new ForbiddenException('برای انجام این عملیات باید وارد حساب کاربری شوید.');

    if (user.isSuperAdmin) return true;

    const owned = new Set(user.permissions ?? []);

    const has = required.filter((p) => owned.has(p) || owned.has('*'));
    const allowed = mode === 'any' ? has.length > 0 : has.length === required.length;

    if (!allowed) {
      throw new ForbiddenException('شما مجوز لازم برای انجام این عملیات را ندارید.');
    }
    return true;
  }
}
