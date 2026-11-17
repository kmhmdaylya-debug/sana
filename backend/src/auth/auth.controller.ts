import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { ChangePasswordDto, LoginDto } from './dto/auth.dto';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'ورود با نام کاربری یا شماره موبایل' })
  login(@Body() dto: LoginDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.auth.login(dto, request, response);
  }

  @Public()
  @Post('refresh')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'تازه‌سازی توکن دسترسی' })
  refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const token =
      (request.cookies?.refresh_token as string | undefined) ??
      (request.body?.refreshToken as string | undefined);
    return this.auth.refresh(token, request, response);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'خروج با کوکی refresh یا توکن دسترسی معتبر؛ ابطال نشست در سرور' })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const token =
      (request.cookies?.refresh_token as string | undefined) ??
      (request.body?.refreshToken as string | undefined);
    response.clearCookie('refresh_token', { path: '/' });
    return this.auth.logout(undefined, token, request);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'خروج از همه دستگاه‌ها' })
  logoutAll(@CurrentUser() user: AuthenticatedUser, @Req() request: Request) {
    return this.auth.revokeAllSessions(user.id, request);
  }

  @Get('me')
  @ApiOperation({ summary: 'اطلاعات کاربر جاری، نقش‌ها، مجوزها و دامنه دسترسی' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.buildProfile(user.id);
  }

  @Get('sessions')
  @ApiOperation({ summary: 'نشست‌های فعال کاربر' })
  sessions(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.listSessions(user.id);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'تغییر رمز عبور' })
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
    @Req() request: Request,
  ) {
    return this.auth.changePassword(user.id, dto, request);
  }
}
