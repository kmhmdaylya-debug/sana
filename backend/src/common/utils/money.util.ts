/**
 * ابزارهای پول و اعداد فارسی.
 * قاعده پولی: مبالغ همیشه عدد صحیح ریال ذخیره می‌شوند (بدون اعشار).
 */

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

/** تبدیل ارقام فارسی/عربی به لاتین */
export function toEnglishDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)));
}

/** تبدیل ارقام لاتین به فارسی */
export function toPersianDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => PERSIAN_DIGITS[Number(d)]);
}

/** تبدیل ورودی عددی کاربر به عدد صحیح — ارقام فارسی پشتیبانی می‌شود */
export function parseNumber(input: string | number | null | undefined): number {
  if (input === null || input === undefined || input === '') return 0;
  if (typeof input === 'number') return Math.trunc(input);
  const normalized = toEnglishDigits(String(input)).replace(/[,٬\s]/g, '');
  const n = Number(normalized);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

/** قالب‌بندی مبلغ ریالی با جداکننده هزارگان */
export function formatRial(value: number | bigint | null | undefined): string {
  if (value === null || value === undefined) return '۰';
  const n = typeof value === 'bigint' ? Number(value) : value;
  return n.toLocaleString('en-US');
}

/** تبدیل ریال به تومان */
export function rialToToman(value: number | bigint | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === 'bigint' ? Number(value) : value;
  return Math.round(n / 10);
}

/** استخراج کد ملی ایران از ورودی کاربر */
export function normalizeNationalId(input: string | null | undefined): string | null {
  if (!input) return null;
  const v = toEnglishDigits(input).replace(/\D/g, '');
  return v.length === 10 ? v : null;
}

/**
 * اعتبارسنجی کد ملی ایران (الگوریتم رسمی).
 */
export function isValidNationalId(nationalId: string | null | undefined): boolean {
  if (!nationalId) return false;
  const value = toEnglishDigits(nationalId).replace(/\D/g, '');
  if (value.length !== 10) return false;
  if (/^(\d)\1{9}$/.test(value)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i += 1) {
    sum += Number(value[i]) * (10 - i);
  }
  const remainder = sum % 11;
  const check = Number(value[9]);
  if (remainder < 2) return check === remainder;
  return check === 11 - remainder;
}

/** اعتبارسنجی شماره موبایل ایران */
export function isValidMobile(mobile: string | null | undefined): boolean {
  if (!mobile) return false;
  const value = toEnglishDigits(mobile).replace(/\D/g, '');
  return /^09\d{9}$/.test(value);
}

/** نرمال‌سازی شماره موبایل به فرمت ۰۹xxxxxxxxx */
export function normalizeMobile(mobile: string | null | undefined): string | null {
  if (!mobile) return null;
  let value = toEnglishDigits(mobile).replace(/\D/g, '');
  if (value.length === 10 && value.startsWith('9')) value = `0${value}`;
  return value.length === 11 ? value : null;
}

/** تبدیل دقیقه به ساعت/دقیقه خوانا */
export function formatMinutes(minutes: number | null | undefined): string {
  if (!minutes) return '۰';
  const sign = minutes < 0 ? '-' : '';
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h && m) return `${sign}${toPersianDigits(h)} ساعت و ${toPersianDigits(m)} دقیقه`;
  if (h) return `${sign}${toPersianDigits(h)} ساعت`;
  return `${sign}${toPersianDigits(m)} دقیقه`;
}
