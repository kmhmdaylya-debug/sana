import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuditAction, NotificationSeverity, UserStatus } from '@prisma/client';
import { Request, Response } from 'express';
import { PrismaService } from '../common/prisma/prisma.service';
import { AccessService } from '../common/access/access.service';
import { AuditService } from '../common/audit/audit.service';
import { NotificationService } from '../common/notifications/notification.service';
import { hashToken, randomToken } from '../common/utils/crypto.util';
import {
  hashPassword,
  validatePasswordStrength,
  verifyPassword,
} from '../common/utils/password.util';
import { ChangePasswordDto, LoginDto } from './dto/auth.dto';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
  ) {}

  // ---------------------------------------------------------------------
  // ورود
  // ---------------------------------------------------------------------
  async login(dto: LoginDto, request: Request, response: Response): Promise<any> {
    const identifier = dto.username.trim().toLowerCase();
    const isMobile = /^09\d{9}$/.test(identifier.replace(/\D/g, ''));
    const ip = this.audit.extractIp(request);

    const user = await this.prisma.user.findFirst({
      where: isMobile ? { mobile: identifier.replace(/\D/g, '') } : { username: identifier },
    });

    // هر خطای احراز هویت پیام یکسان می‌دهد تا وجود حساب یا وضعیت قفل فاش نشود
    const invalidCredentials = () =>
      new UnauthorizedException('نام کاربری یا رمز عبور اشتباه است.');

    if (!user) {
      await this.audit.record(
        null,
        { action: AuditAction.LOGIN_FAILED, entity: 'User', entityId: null },
        { ...this.audit.contextFrom(request), note: 'تلاش ورود ناموفق' },
      );
      throw invalidCredentials();
    }

    const locked = !!(user.lockedUntil && user.lockedUntil > new Date());
    const inactive = user.status !== UserStatus.ACTIVE || !!user.deletedAt;

    const valid = await verifyPassword(user.passwordHash, dto.password);
    if (!valid) {
      const maxAttempts = this.config.get<number>('app.security.maxLoginAttempts') ?? 5;
      const lockMinutes = this.config.get<number>('app.security.loginLockoutMinutes') ?? 15;
      const failed = user.failedLoginCount + 1;

      if (!locked) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginCount: failed,
            ...(failed >= maxAttempts
              ? {
                  lockedUntil: new Date(Date.now() + lockMinutes * 60_000),
                  failedLoginCount: 0,
                }
              : {}),
          },
        });
      }

      await this.audit.record(
        user.id,
        { action: AuditAction.LOGIN_FAILED, entity: 'User', entityId: user.id },
        { ...this.audit.contextFrom(request), note: 'رمز عبور اشتباه است.' },
      );
      throw invalidCredentials();
    }

    // رمز درست است؛ اکنون وضعیت حساب را می‌توان اعلام کرد
    if (locked) {
      const remain = Math.ceil((user.lockedUntil!.getTime() - Date.now()) / 60000);
      await this.audit.record(
        user.id,
        { action: AuditAction.LOGIN_FAILED, entity: 'User', entityId: user.id },
        { ...this.audit.contextFrom(request), note: 'تلاش ورود به حساب قفل‌شده.' },
      );
      throw new ForbiddenException(
        `حساب کاربری شما موقتاً قفل است. لطفاً ${remain} دقیقه دیگر تلاش کنید.`,
      );
    }
    if (inactive) {
      throw new ForbiddenException('حساب کاربری شما غیرفعال است. با مدیر سیستم تماس بگیرید.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    const tokens = await this.issueTokens(user.id, user.username, !!dto.rememberMe, request);
    this.setRefreshCookie(response, tokens.refreshToken, !!dto.rememberMe);

    await this.prisma.userSession.create({
      data: {
        userId: user.id,
        device: request.headers['x-device-name']?.toString().slice(0, 160) ?? null,
        browser: request.headers['user-agent']?.toString().slice(0, 120) ?? null,
        ip: ip ?? null,
        userAgent: request.headers['user-agent']?.toString().slice(0, 255) ?? null,
      },
    });

    await this.audit.record(
      user.id,
      { action: AuditAction.LOGIN, entity: 'User', entityId: user.id },
      this.audit.contextFrom(request),
    );

    return { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
  }

  // ---------------------------------------------------------------------
  // تازه‌سازی توکن (با چرخش خانوادگی)
  // ---------------------------------------------------------------------
  async refresh(
    refreshToken: string | undefined,
    request: Request,
    response: Response,
  ): Promise<any> {
    if (!refreshToken) throw new UnauthorizedException('توکن تازه‌سازی ارسال نشده است.');

    const tokenHash = hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored) throw new UnauthorizedException('توکن تازه‌سازی نامعتبر است.');

    const rememberMe =
      stored.expiresAt.getTime() - stored.createdAt.getTime() > 8 * 24 * 3600 * 1000;

    if (stored.revokedAt) {
      // درخواست‌های هم‌زمان (چند تب مرورگر یا StrictMode) ممکن است توکنِ قبلاً مصرف‌شده
      // را بفرستند. در بازهٔ کوتاهی پس از چرخش، خطا نمی‌دهیم و توکن تازه صادر می‌کنیم.
      // شرط مهم: باید توکنِ زنده‌ای در همان خانواده وجود داشته باشد؛ اگر کل خانواده باطل شده
      // باشد (نشت توکن)، هیچ توکنی صادر نمی‌شود.
      const graceMs = this.config.get<number>('app.jwt.refreshGraceSeconds') ?? 60;
      const ageMs = Date.now() - stored.revokedAt.getTime();
      const liveInFamily = await this.prisma.refreshToken.findFirst({
        where: { family: stored.family, revokedAt: null },
        select: { id: true },
      });
      if (ageMs <= graceMs * 1000 && liveInFamily) {
        const tokens = await this.issueTokens(
          stored.userId,
          stored.user.username,
          rememberMe,
          request,
          stored.family,
        );
        this.setRefreshCookie(response, tokens.refreshToken, rememberMe);
        return { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
      }

      // استفاده مجدد از توکن لغوشده در بازهٔ عادی => احتمال نشت؛ کل خانواده باطل می‌شود
      await this.prisma.refreshToken.updateMany({
        where: { family: stored.family, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.record(
        stored.userId,
        { action: AuditAction.LOGOUT, entity: 'RefreshToken', entityId: stored.id },
        {
          ...this.audit.contextFrom(request),
          note: 'استفاده مجدد از توکن لغوشده شناسایی شد؛ همه نشست‌های خانواده باطل شد.',
        },
      );
      throw new UnauthorizedException('توکن تازه‌سازی نامعتبر است. لطفاً دوباره وارد شوید.');
    }

    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException('نشست شما منقضی شده است. لطفاً دوباره وارد شوید.');
    }
    if (stored.user.status !== UserStatus.ACTIVE || stored.user.deletedAt) {
      throw new ForbiddenException('حساب کاربری شما غیرفعال است.');
    }

    const tokens = await this.issueTokens(
      stored.userId,
      stored.user.username,
      rememberMe,
      request,
      stored.family,
    );

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    await this.prisma.refreshToken.update({
      where: { tokenHash: hashToken(tokens.refreshToken) },
      data: { replacedBy: stored.id },
    });

    this.setRefreshCookie(response, tokens.refreshToken, rememberMe);
    return { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
  }

  // ---------------------------------------------------------------------
  // خروج
  // ---------------------------------------------------------------------
  async logout(
    userId: string | undefined,
    refreshToken: string | undefined,
    request: Request,
  ): Promise<{ success: boolean }> {
    if (refreshToken) {
      const stored = await this.prisma.refreshToken.findUnique({
        where: { tokenHash: hashToken(refreshToken) },
      });
      if (stored) {
        await this.prisma.refreshToken.updateMany({
          where: { family: stored.family, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
    }
    if (userId) {
      await this.prisma.userSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.record(
        userId,
        { action: AuditAction.LOGOUT, entity: 'User', entityId: userId },
        this.audit.contextFrom(request),
      );
    }
    return { success: true };
  }

  /** ابطال همه نشست‌های یک کاربر (خود کاربر یا مدیر سیستم) */
  async revokeAllSessions(userId: string, request?: Request): Promise<{ count: number }> {
    const tokens = await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.prisma.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit.record(
      userId,
      { action: AuditAction.LOGOUT, entity: 'User', entityId: userId },
      { ...(request ? this.audit.contextFrom(request) : {}), note: 'ابطال همه نشست‌ها' },
    );
    return { count: tokens.count };
  }

  /** ابطال نشست‌های کاربر در تاریخ و ساعت مؤثر — در خاتمه همکاری استفاده می‌شود */
  async revokeSessionsAt(userId: string, effectiveAt: Date): Promise<number> {
    const result = await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: effectiveAt },
    });
    await this.prisma.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: effectiveAt },
    });
    return result.count;
  }

  // ---------------------------------------------------------------------
  // پروفایل
  // ---------------------------------------------------------------------
  async buildProfile(userId: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: { include: { role: true } },
        employee: {
          select: {
            id: true,
            code: true,
            firstName: true,
            lastName: true,
            status: true,
            orgUnit: { select: { id: true, name: true } },
            position: { select: { id: true, title: true } },
            company: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!user) throw new UnauthorizedException('کاربر یافت نشد.');

    const authUser = await this.access.buildAuthUser(userId);
    if (!authUser) throw new UnauthorizedException('کاربر یافت نشد.');

    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      mobile: user.mobile,
      status: user.status,
      isSuperAdmin: user.isSuperAdmin,
      mustChangePassword: user.mustChangePassword,
      mfaEnabled: user.mfaEnabled,
      lastLoginAt: user.lastLoginAt,
      roles: user.userRoles.map((ur) => ({
        id: ur.role.id,
        code: ur.role.code,
        name: ur.role.name,
      })),
      permissions: authUser.permissions,
      scope: authUser.scope,
      employee: user.employee,
    };
  }

  // ---------------------------------------------------------------------
  // تغییر رمز عبور
  // ---------------------------------------------------------------------
  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    request: Request,
  ): Promise<{ success: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('کاربر یافت نشد.');

    const valid = await verifyPassword(user.passwordHash, dto.currentPassword);
    if (!valid) throw new BadRequestException('رمز عبور فعلی اشتباه است.');

    const minLength = this.config.get<number>('app.security.passwordMinLength') ?? 10;
    const strength = validatePasswordStrength(dto.newPassword, minLength);
    if (!strength.ok) throw new BadRequestException(strength.message);

    if (await verifyPassword(user.passwordHash, dto.newPassword)) {
      throw new BadRequestException('رمز عبور جدید باید با رمز عبور فعلی متفاوت باشد.');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await hashPassword(dto.newPassword),
        passwordChangedAt: new Date(),
        mustChangePassword: false,
      },
    });

    await this.audit.record(
      userId,
      { action: AuditAction.PASSWORD_CHANGE, entity: 'User', entityId: userId },
      this.audit.contextFrom(request),
    );

    return { success: true };
  }

  // ---------------------------------------------------------------------
  // نشست‌های فعال
  // ---------------------------------------------------------------------
  async listSessions(userId: string): Promise<any[]> {
    const sessions = await this.prisma.userSession.findMany({
      where: { userId, revokedAt: null },
      orderBy: { lastSeenAt: 'desc' },
      select: {
        id: true,
        device: true,
        browser: true,
        ip: true,
        lastSeenAt: true,
        createdAt: true,
      },
    });
    return sessions;
  }

  // ---------------------------------------------------------------------
  // کمکی‌ها
  // ---------------------------------------------------------------------
  private async issueTokens(
    userId: string,
    username: string,
    rememberMe: boolean,
    request: Request,
    family?: string,
  ): Promise<TokenPair> {
    const accessSecret = this.config.get<string>('app.jwt.accessSecret') as string;
    const accessExpiresIn = this.config.get<string>('app.jwt.accessExpiresIn') as string;
    const issuer = this.config.get<string>('app.jwt.issuer') as string;

    const accessToken = this.jwt.sign(
      { sub: userId, username, type: 'access' },
      { expiresIn: accessExpiresIn as any, issuer, secret: accessSecret },
    );

    const refreshRaw = `${randomToken(32)}.${randomToken(16).replace(/[^a-zA-Z0-9]/g, '').slice(0, 16)}`;
    const refreshTokenHash = hashToken(refreshRaw);

    const days = rememberMe
      ? this.config.get<number>('app.jwt.rememberMeExpiresDays') ?? 30
      : this.config.get<number>('app.jwt.refreshExpiresDays') ?? 7;

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: refreshTokenHash,
        family: family ?? randomToken(16).replace(/[^a-zA-Z0-9]/g, '').slice(0, 32),
        expiresAt: new Date(Date.now() + days * 24 * 3600 * 1000),
        userAgent: request?.headers?.['user-agent']?.toString().slice(0, 255) ?? null,
        ip: this.audit.extractIp(request),
      },
    });

    return {
      accessToken,
      refreshToken: refreshRaw,
      expiresIn: this.parseToSeconds(accessExpiresIn),
    };
  }

  private setRefreshCookie(response: Response, token: string, rememberMe: boolean): void {
    const days = rememberMe
      ? this.config.get<number>('app.jwt.rememberMeExpiresDays') ?? 30
      : this.config.get<number>('app.jwt.refreshExpiresDays') ?? 7;
    response.cookie('refresh_token', token, {
      httpOnly: true,
      secure: this.config.get<string>('app.env') === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: days * 24 * 3600 * 1000,
    });
  }

  private parseToSeconds(value: string): number {
    const match = /^(\d+)([smhd])$/.exec(value.trim());
    if (!match) return 900;
    const n = parseInt(match[1], 10);
    switch (match[2]) {
      case 's':
        return n;
      case 'm':
        return n * 60;
      case 'h':
        return n * 3600;
      case 'd':
        return n * 86400;
      default:
        return 900;
    }
  }

  /** هشدار امنیتی به کاربر (ورود جدید، تغییر رمز و …) */
  async raiseSecurityAlert(userId: string, title: string, body?: string): Promise<void> {
    await this.notifications.notify(userId, {
      severity: NotificationSeverity.WARNING,
      title,
      body,
    });
  }
}
