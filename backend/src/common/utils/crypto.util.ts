import { randomBytes, createHash, randomInt } from 'crypto';

export function randomToken(bytes = 48): string {
  return randomBytes(bytes).toString('base64url');
}

/** هش توکن برای ذخیره امن در پایگاه داده */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateIdempotencyKey(): string {
  return randomBytes(24).toString('hex');
}

/** کلید idempotency ترکیبی برای رویدادهای حضور و غیاب */
export function attendanceIdempotencyKey(
  deviceCode: string,
  eventTime: Date,
  type: string,
): string {
  const stamp = eventTime.toISOString();
  return createHash('sha256').update(`${deviceCode}|${stamp}|${type}`).digest('hex');
}

/** کد یکبارمصرف ۶ رقمی برای MFA */
export function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/** ساخت شناسه یکتا برای پیوست‌ها و فایل‌ها */
export function randomFileName(extension = ''): string {
  const stamp = Date.now().toString(36);
  const rand = randomBytes(6).toString('hex');
  return `${stamp}-${rand}${extension}`;
}
