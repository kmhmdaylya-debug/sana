import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ description: 'نام کاربری یا شماره موبایل', example: 'admin' })
  @IsString({ message: 'نام کاربری الزامی است.' })
  @MaxLength(64)
  username: string;

  @ApiProperty({ example: 'Admin@Sana1404' })
  @IsString({ message: 'رمز عبور الزامی است.' })
  @MinLength(6)
  @MaxLength(128)
  password: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}

export class RefreshDto {
  @ApiPropertyOptional({ description: 'توکن تازه‌سازی (در صورت نبود کوکی ارسال می‌شود)' })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString({ message: 'رمز عبور فعلی الزامی است.' })
  currentPassword: string;

  @ApiProperty()
  @IsString({ message: 'رمز عبور جدید الزامی است.' })
  @MinLength(8)
  @MaxLength(128)
  newPassword: string;
}

export class OtpDto {
  @ApiProperty({ description: 'کد یکبارمصرف ۶ رقمی' })
  @IsString({ message: 'کد یکبارمصرف الزامی است.' })
  @Matches(/^\d{6}$/, { message: 'کد یکبارمصرف باید ۶ رقم باشد.' })
  code: string;
}
