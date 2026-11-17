import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { RequestHandler } from 'express';
import { JwtPayload, JwtStrategy } from '../../auth/jwt.strategy';

export function swaggerAccess(config: ConfigService, jwt: JwtService, strategy: JwtStrategy): RequestHandler {
  return async (req, res, next) => {
    const pathname = (req.originalUrl ?? req.url).split('?')[0];
    if (!/^\/api\/docs(?:\/|$|-json$|-yaml$)/.test(pathname)) return next();
    const allowed = config.get<string[]>('app.swaggerAllowedIps') ?? [];
    if (allowed.includes(req.ip ?? req.socket?.remoteAddress ?? '')) return next();
    try {
      const header = req.headers.authorization;
      if (!header?.startsWith('Bearer ')) throw new Error('Missing access token');
      const payload = jwt.verify<JwtPayload>(header.slice(7), {
        secret: config.get<string>('app.jwt.accessSecret'),
        issuer: config.get<string>('app.jwt.issuer'), algorithms: ['HS256'],
      });
      const user = await strategy.validate(payload);
      if (!user.isSuperAdmin) return void res.status(403).json({ message: 'دسترسی به مستندات API مجاز نیست.' });
      next();
    } catch {
      res.status(401).json({ message: 'برای مشاهده مستندات، احراز هویت معتبر مدیر ارشد لازم است.' });
    }
  };
}
