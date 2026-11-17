import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import {
  AuditAction,
  NotificationSeverity,
  Prisma,
  UserStatus,
} from "@prisma/client";
import { randomUUID } from "crypto";
import { Request, Response } from "express";
import { PrismaService } from "../common/prisma/prisma.service";
import { AccessService } from "../common/access/access.service";
import { AuditService } from "../common/audit/audit.service";
import { NotificationService } from "../common/notifications/notification.service";
import { hashToken, randomToken } from "../common/utils/crypto.util";
import {
  hashPassword,
  validatePasswordStrength,
  verifyPassword,
} from "../common/utils/password.util";
import { ChangePasswordDto, LoginDto } from "./dto/auth.dto";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenId: string;
}

@Injectable()
export class AuthService {
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
  async login(
    dto: LoginDto,
    request: Request,
    response: Response,
  ): Promise<any> {
    const identifier = dto.username.trim().toLowerCase();
    const isMobile = /^09\d{9}$/.test(identifier.replace(/\D/g, ""));
    const ip = this.audit.extractIp(request);

    const user = await this.prisma.user.findFirst({
      where: isMobile
        ? { mobile: identifier.replace(/\D/g, "") }
        : { username: { equals: identifier, mode: "insensitive" } },
    });

    // هر خطای احراز هویت پیام یکسان می‌دهد تا وجود حساب یا وضعیت قفل فاش نشود
    const invalidCredentials = () =>
      new UnauthorizedException("نام کاربری یا رمز عبور اشتباه است.");

    if (!user) {
      await this.audit.record(
        null,
        { action: AuditAction.LOGIN_FAILED, entity: "User", entityId: null },
        { ...this.audit.contextFrom(request), note: "تلاش ورود ناموفق" },
      );
      throw invalidCredentials();
    }

    const locked = !!(user.lockedUntil && user.lockedUntil > new Date());
    const inactive = user.status !== UserStatus.ACTIVE || !!user.deletedAt;

    const valid = await verifyPassword(user.passwordHash, dto.password);
    if (!valid) {
      const maxAttempts =
        this.config.get<number>("app.security.maxLoginAttempts") ?? 5;
      const lockMinutes =
        this.config.get<number>("app.security.loginLockoutMinutes") ?? 15;
      await this.prisma.$transaction(async (db) => {
        await this.lockUser(db, user.id);
        const current = await db.user.findUniqueOrThrow({
          where: { id: user.id },
        });
        if (current.lockedUntil && current.lockedUntil > new Date()) return;
        const failed = current.failedLoginCount + 1;
        await db.user.update({
          where: { id: user.id },
          data: {
            failedLoginCount: failed >= maxAttempts ? 0 : failed,
            ...(failed >= maxAttempts
              ? { lockedUntil: new Date(Date.now() + lockMinutes * 60_000) }
              : {}),
          },
        });
      });

      await this.audit.record(
        user.id,
        { action: AuditAction.LOGIN_FAILED, entity: "User", entityId: user.id },
        { ...this.audit.contextFrom(request), note: "رمز عبور اشتباه است." },
      );
      throw invalidCredentials();
    }

    // رمز درست است؛ اکنون وضعیت حساب را می‌توان اعلام کرد
    if (locked) {
      const remain = Math.ceil(
        (user.lockedUntil!.getTime() - Date.now()) / 60000,
      );
      await this.audit.record(
        user.id,
        { action: AuditAction.LOGIN_FAILED, entity: "User", entityId: user.id },
        {
          ...this.audit.contextFrom(request),
          note: "تلاش ورود به حساب قفل‌شده.",
        },
      );
      throw new ForbiddenException(
        `حساب کاربری شما موقتاً قفل است. لطفاً ${remain} دقیقه دیگر تلاش کنید.`,
      );
    }
    if (inactive) {
      throw new ForbiddenException(
        "حساب کاربری شما غیرفعال است. با مدیر سیستم تماس بگیرید.",
      );
    }

    const tokens = await this.prisma.$transaction(async (db) => {
      await this.lockUser(db, user.id);
      const current = await db.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      if (
        current.passwordHash !== user.passwordHash ||
        current.status !== UserStatus.ACTIVE ||
        current.deletedAt ||
        (current.lockedUntil && current.lockedUntil > new Date())
      )
        throw invalidCredentials();
      await db.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: 0,
          lockedUntil: null,
          lastLoginAt: new Date(),
        },
      });
      const sessionId = randomUUID();
      await db.userSession.create({
        data: {
          id: sessionId,
          userId: user.id,
          device:
            request.headers["x-device-name"]?.toString().slice(0, 160) ?? null,
          browser:
            request.headers["user-agent"]?.toString().slice(0, 120) ?? null,
          ip: ip ?? null,
          userAgent:
            request.headers["user-agent"]?.toString().slice(0, 255) ?? null,
        },
      });
      return this.issueTokens(
        db,
        user.id,
        user.username,
        request,
        sessionId,
        this.refreshExpiry(!!dto.rememberMe),
      );
    });
    this.setRefreshCookie(response, tokens.refreshToken, !!dto.rememberMe);

    await this.audit.record(
      user.id,
      { action: AuditAction.LOGIN, entity: "User", entityId: user.id },
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
    if (!refreshToken)
      throw new UnauthorizedException("توکن تازه‌سازی ارسال نشده است.");

    if (typeof refreshToken !== "string" || refreshToken.length > 512)
      throw new UnauthorizedException("توکن تازه‌سازی نامعتبر است.");
    const tokenHash = hashToken(refreshToken);
    const found = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      select: { userId: true },
    });
    if (!found) throw new UnauthorizedException("توکن تازه‌سازی نامعتبر است.");

    const result = await this.prisma.$transaction(async (db) => {
      // Login, rotation, logout and password reset use the same lock order.
      await this.lockUser(db, found.userId);
      const stored = await db.refreshToken.findUniqueOrThrow({
        where: { tokenHash },
        include: { user: true },
      });
      const now = new Date();
      if (stored.user.status !== UserStatus.ACTIVE || stored.user.deletedAt)
        throw new UnauthorizedException("نشست شما نامعتبر است.");
      if (stored.expiresAt <= now || !this.isSessionId(stored.family))
        throw new UnauthorizedException(
          "نشست شما منقضی شده است. دوباره وارد شوید.",
        );
      const session = await db.userSession.findFirst({
        where: {
          id: stored.family,
          userId: stored.userId,
          OR: [{ revokedAt: null }, { revokedAt: { gt: now } }],
        },
      });
      if (!session) throw new UnauthorizedException("نشست شما باطل شده است.");

      if (stored.revokedAt && stored.revokedAt <= now) {
        const graceSeconds = Math.max(
          0,
          Math.min(
            15,
            this.config.get<number>("app.jwt.refreshGraceSeconds") ?? 15,
          ),
        );
        const live = stored.replacedBy
          ? await db.refreshToken.findFirst({
              where: {
                family: stored.family,
                userId: stored.userId,
                expiresAt: { gt: now },
                OR: [{ revokedAt: null }, { revokedAt: { gt: now } }],
              },
              select: { id: true },
            })
          : null;
        if (
          live &&
          now.getTime() - stored.revokedAt.getTime() <= graceSeconds * 1000
        ) {
          // Concurrent tabs may receive access only; never fork or extend a refresh family.
          return this.signAccess(
            stored.userId,
            stored.user.username,
            stored.family,
          );
        }
        await this.revokeFamily(db, stored.userId, stored.family, now);
        return null;
      }

      const expiresAt = new Date(
        Math.min(
          stored.expiresAt.getTime(),
          stored.revokedAt?.getTime() ?? Infinity,
          session.revokedAt?.getTime() ?? Infinity,
        ),
      );
      const tokens = await this.issueTokens(
        db,
        stored.userId,
        stored.user.username,
        request,
        stored.family,
        expiresAt,
      );
      await db.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: now, replacedBy: tokens.tokenId },
      });
      await db.userSession.update({
        where: { id: session.id },
        data: { lastSeenAt: now },
      });
      return { ...tokens, expiresAt };
    });
    if (!result) {
      await this.audit.record(
        found.userId,
        { action: AuditAction.LOGOUT, entity: "RefreshToken" },
        {
          ...this.audit.contextFrom(request),
          note: "بازپخش توکن؛ خانوادهٔ نشست باطل شد.",
        },
      );
      throw new UnauthorizedException(
        "نشست شما باطل شده است. دوباره وارد شوید.",
      );
    }
    if ("refreshToken" in result)
      this.setRefreshCookie(
        response,
        result.refreshToken,
        false,
        result.expiresAt,
      );
    return { accessToken: result.accessToken, expiresIn: result.expiresIn };
  }

  // ---------------------------------------------------------------------
  // خروج
  // ---------------------------------------------------------------------
  async logout(
    userId: string | undefined,
    refreshToken: string | undefined,
    request: Request,
  ): Promise<{ success: boolean }> {
    const targets = new Map<string, { userId: string; family: string }>();
    if (typeof refreshToken === "string" && refreshToken.length <= 512) {
      const stored = await this.prisma.refreshToken.findUnique({
        where: { tokenHash: hashToken(refreshToken) },
      });
      if (stored) {
        targets.set(`${stored.userId}:${stored.family}`, {
          userId: stored.userId,
          family: stored.family,
        });
      }
    }
    const bearer =
      request.headers?.authorization?.match(/^Bearer (\S+)$/i)?.[1];
    if (bearer && bearer.length <= 8192) {
      try {
        const claims = this.jwt.verify<{
          sub: string;
          sid: string;
          type: string;
        }>(bearer, {
          algorithms: ["HS256"],
          secret: this.config.get<string>("app.jwt.accessSecret"),
          issuer: this.config.get<string>("app.jwt.issuer"),
        });
        if (
          claims.type === "access" &&
          this.isSessionId(claims.sub) &&
          this.isSessionId(claims.sid)
        ) {
          targets.set(`${claims.sub}:${claims.sid}`, {
            userId: claims.sub,
            family: claims.sid,
          });
        }
      } catch {
        // Invalid credentials must not revoke another session or prevent cookie clearing.
      }
    }
    const users = [
      ...new Set([...targets.values()].map((target) => target.userId)),
    ].sort();
    if (targets.size)
      await this.prisma.$transaction(async (db) => {
        for (const id of users) await this.lockUser(db, id);
        const now = new Date();
        for (const target of targets.values())
          await this.revokeFamily(db, target.userId, target.family, now);
      });
    for (userId of users) {
      await this.audit.record(
        userId,
        { action: AuditAction.LOGOUT, entity: "User", entityId: userId },
        this.audit.contextFrom(request),
      );
    }
    return { success: true };
  }

  /** ابطال همه نشست‌های یک کاربر (خود کاربر یا مدیر سیستم) */
  async revokeAllSessions(
    userId: string,
    request?: Request,
  ): Promise<{ count: number }> {
    const tokens = await this.prisma.$transaction(async (db) => {
      await this.lockUser(db, userId);
      const now = new Date();
      const tokens = await db.refreshToken.updateMany({
        where: {
          userId,
          OR: [{ revokedAt: null }, { revokedAt: { gt: now } }],
        },
        data: { revokedAt: now },
      });
      await db.userSession.updateMany({
        where: {
          userId,
          OR: [{ revokedAt: null }, { revokedAt: { gt: now } }],
        },
        data: { revokedAt: now },
      });
      return tokens;
    });
    await this.audit.record(
      userId,
      { action: AuditAction.LOGOUT, entity: "User", entityId: userId },
      {
        ...(request ? this.audit.contextFrom(request) : {}),
        note: "ابطال همه نشست‌ها",
      },
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
        userRoles: {
          where: {
            validFrom: { lte: new Date() },
            OR: [{ validTo: null }, { validTo: { gt: new Date() } }],
            role: { isActive: true, deletedAt: null },
          },
          include: { role: true },
        },
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
    if (!user) throw new UnauthorizedException("کاربر یافت نشد.");

    const authUser = await this.access.buildAuthUser(userId);
    if (!authUser) throw new UnauthorizedException("کاربر یافت نشد.");

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
    if (!user || user.deletedAt || user.status !== UserStatus.ACTIVE)
      throw new UnauthorizedException("نشست نامعتبر است.");

    const valid = await verifyPassword(user.passwordHash, dto.currentPassword);
    if (!valid) throw new BadRequestException("رمز عبور فعلی اشتباه است.");

    const minLength =
      this.config.get<number>("app.security.passwordMinLength") ?? 10;
    const strength = validatePasswordStrength(dto.newPassword, minLength);
    if (!strength.ok) throw new BadRequestException(strength.message);

    if (await verifyPassword(user.passwordHash, dto.newPassword)) {
      throw new BadRequestException(
        "رمز عبور جدید باید با رمز عبور فعلی متفاوت باشد.",
      );
    }

    const passwordHash = await hashPassword(dto.newPassword);
    await this.prisma.$transaction(async (db) => {
      await this.lockUser(db, userId);
      const current = await db.user.findUniqueOrThrow({
        where: { id: userId },
      });
      if (
        current.passwordHash !== user.passwordHash ||
        current.deletedAt ||
        current.status !== UserStatus.ACTIVE
      )
        throw new UnauthorizedException(
          "حساب تغییر کرده است؛ دوباره وارد شوید.",
        );
      const now = new Date();
      await db.user.update({
        where: { id: userId },
        data: {
          passwordHash,
          passwordChangedAt: now,
          mustChangePassword: false,
        },
      });
      await db.refreshToken.updateMany({
        where: {
          userId,
          OR: [{ revokedAt: null }, { revokedAt: { gt: now } }],
        },
        data: { revokedAt: now },
      });
      await db.userSession.updateMany({
        where: {
          userId,
          OR: [{ revokedAt: null }, { revokedAt: { gt: now } }],
        },
        data: { revokedAt: now },
      });
      await db.auditLog.create({
        data: {
          userId,
          action: AuditAction.PASSWORD_CHANGE,
          entity: "User",
          entityId: userId,
          ...this.audit.contextFrom(request),
        },
      });
    });

    return { success: true };
  }

  // ---------------------------------------------------------------------
  // نشست‌های فعال
  // ---------------------------------------------------------------------
  async listSessions(userId: string): Promise<any[]> {
    const sessions = await this.prisma.userSession.findMany({
      where: {
        userId,
        OR: [{ revokedAt: null }, { revokedAt: { gt: new Date() } }],
      },
      orderBy: { lastSeenAt: "desc" },
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
    db: Prisma.TransactionClient,
    userId: string,
    username: string,
    request: Request,
    family: string,
    expiresAt: Date,
  ): Promise<TokenPair> {
    const refreshRaw = randomToken(48);
    const refreshTokenHash = hashToken(refreshRaw);
    const token = await db.refreshToken.create({
      data: {
        userId,
        tokenHash: refreshTokenHash,
        family,
        expiresAt,
        userAgent:
          request?.headers?.["user-agent"]?.toString().slice(0, 255) ?? null,
        ip: this.audit.extractIp(request),
      },
    });

    return {
      ...this.signAccess(userId, username, family),
      refreshToken: refreshRaw,
      tokenId: token.id,
    };
  }

  private signAccess(userId: string, username: string, sessionId: string) {
    const expiresIn =
      this.config.get<string>("app.jwt.accessExpiresIn") ?? "15m";
    return {
      accessToken: this.jwt.sign(
        { sub: userId, username, type: "access", sid: sessionId },
        {
          algorithm: "HS256",
          secret: this.config.get<string>("app.jwt.accessSecret"),
          issuer: this.config.get<string>("app.jwt.issuer"),
          expiresIn: expiresIn as any,
        },
      ),
      expiresIn: this.parseToSeconds(expiresIn),
    };
  }

  private refreshExpiry(rememberMe: boolean) {
    const days = rememberMe
      ? (this.config.get<number>("app.jwt.rememberMeExpiresDays") ?? 30)
      : (this.config.get<number>("app.jwt.refreshExpiresDays") ?? 7);
    return new Date(Date.now() + days * 24 * 3600 * 1000);
  }

  private isSessionId(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    );
  }

  private async lockUser(db: Prisma.TransactionClient, id: string) {
    await db.$queryRaw`SELECT id FROM "User" WHERE id = ${id}::uuid FOR UPDATE`;
  }

  private async revokeFamily(
    db: Prisma.TransactionClient,
    userId: string,
    family: string,
    now: Date,
  ) {
    await db.refreshToken.updateMany({
      where: {
        userId,
        family,
        OR: [{ revokedAt: null }, { revokedAt: { gt: now } }],
      },
      data: { revokedAt: now },
    });
    if (this.isSessionId(family))
      await db.userSession.updateMany({
        where: { id: family, userId },
        data: { revokedAt: now },
      });
  }

  private setRefreshCookie(
    response: Response,
    token: string,
    rememberMe: boolean,
    expiresAt = this.refreshExpiry(rememberMe),
  ): void {
    response.cookie("refresh_token", token, {
      httpOnly: true,
      secure: this.config.get<string>("app.env") === "production",
      sameSite: "lax",
      path: "/",
      maxAge: Math.max(0, expiresAt.getTime() - Date.now()),
    });
  }

  private parseToSeconds(value: string): number {
    const match = /^(\d+)([smhd])$/.exec(value.trim());
    if (!match) return 900;
    const n = parseInt(match[1], 10);
    switch (match[2]) {
      case "s":
        return n;
      case "m":
        return n * 60;
      case "h":
        return n * 3600;
      case "d":
        return n * 86400;
      default:
        return 900;
    }
  }

  /** هشدار امنیتی به کاربر (ورود جدید، تغییر رمز و …) */
  async raiseSecurityAlert(
    userId: string,
    title: string,
    body?: string,
  ): Promise<void> {
    await this.notifications.notify(userId, {
      severity: NotificationSeverity.WARNING,
      title,
      body,
    });
  }
}
