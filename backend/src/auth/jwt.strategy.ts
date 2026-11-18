import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { AccessService } from '../common/access/access.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { isUUID } from 'class-validator';

export interface JwtPayload {
  sub: string;
  username: string;
  type: 'access';
  sid: string;
  jti: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly access: AccessService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('app.jwt.accessSecret'),
      issuer: config.get<string>('app.jwt.issuer'),
      algorithms: ['HS256'],
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (payload.type !== 'access' || !isUUID(payload.sub) || !isUUID(payload.sid) || !isUUID(payload.jti)) throw new UnauthorizedException('نشست نامعتبر است؛ دوباره وارد شوید.');
    const now = new Date();
    const blocked = await this.prisma.accessTokenBlocklist.findUnique({ where: { tokenId: payload.jti } });
    if (blocked && blocked.expiresAt > now) throw new UnauthorizedException('توکن باطل شده است؛ دوباره وارد شوید.');
    const session = await this.prisma.userSession.findFirst({ where: { id: payload.sid, userId: payload.sub, OR: [{ revokedAt: null }, { revokedAt: { gt: now } }] }, select: { id: true } });
    const live = session && await this.prisma.refreshToken.findFirst({ where: { family: payload.sid, userId: payload.sub, expiresAt: { gt: now }, OR: [{ revokedAt: null }, { revokedAt: { gt: now } }] }, select: { id: true } });
    if (!live) throw new UnauthorizedException('نشست شما باطل یا منقضی شده است.');
    const user = await this.access.buildAuthUser(payload.sub);
    if (!user) throw new UnauthorizedException('نشست شما نامعتبر یا منقضی شده است.');
    return user;
  }
}
