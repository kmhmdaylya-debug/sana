/**
 * ابزارهای قالب‌بندی فارسی — تاریخ شمسی، اعداد فارسی، پول و وضعیت‌ها
 */

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export function isPastDueDate(value?: string | null, now = new Date(), timeZone = 'Asia/Tehran'): boolean {
  if (!value) return false;
  const due = new Date(value);
  if (Number.isNaN(due.getTime())) return false;
  const day = new Intl.DateTimeFormat('en-CA', { timeZone, year:'numeric', month:'2-digit', day:'2-digit' });
  return day.format(due) < day.format(now);
}

export function toPersianDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);
}

export function toEnglishDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

/* ------------------------- تبدیل تاریخ جلالی ------------------------- */

interface JalaliDate {
  jy: number;
  jm: number;
  jd: number;
}

function div(a: number, b: number): number {
  return ~~(a / b);
}
function mod(a: number, b: number): number {
  return a - ~~(a / b) * b;
}

function jalCal(jy: number) {
  const breaks = [
    -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192,
    2262, 2324, 2394, 2456, 3178,
  ];
  const bl = breaks.length;
  const gy = jy + 621;
  let leapJ = -14;
  let jp = breaks[0];
  let jump = 0;
  for (let i = 1; i < bl; i += 1) {
    const jm = breaks[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  let n = jy - jp;
  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return { leap, gy, march };
}

function g2d(gy: number, gm: number, gd: number): number {
  let d =
    div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
    div(153 * mod(gm + 9, 12) + 2, 5) +
    gd -
    34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

function d2g(jdn: number) {
  let j = 4 * jdn + 139361631 + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

/** تبدیل تاریخ میلادی به شمسی */
export function toJalali(date: Date): JalaliDate {
  const gy = date.getFullYear();
  const gm = date.getMonth() + 1;
  const gd = date.getDate();
  const jdn = g2d(gy, gm, gd);
  const g = d2g(jdn);
  let jy = g.gy - 621;
  const jal = jalCal(jy);
  const jdn1f = g2d(g.gy, 3, jal.march);
  let k = jdn - jdn1f;
  if (k >= 0) {
    if (k <= 185) return { jy, jm: 1 + div(k, 31), jd: mod(k, 31) + 1 };
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (jal.leap === 1) k += 1;
  }
  return { jy, jm: 7 + div(k, 30), jd: mod(k, 30) + 1 };
}

/** تبدیل تاریخ شمسی به میلادی (برای ورودی فرم‌ها) */
export function toGregorian(jy: number, jm: number, jd: number): Date {
  const jal = jalCal(jy);
  const jdn = g2d(jal.gy, 3, jal.march) + (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186) + jd - 1;
  const g = d2g(jdn);
  return new Date(g.gy, g.gm - 1, g.gd);
}

export const PERSIAN_MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
];

export const PERSIAN_WEEKDAYS = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];

/** «۱۴۰۴/۰۷/۳۰» یا با زمان */
export function formatJalali(value: string | Date | null | undefined, withTime = false): string {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  const { jy, jm, jd } = toJalali(d);
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${jy}/${pad(jm)}/${pad(jd)}`;
  if (!withTime) return toPersianDigits(date);
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  return toPersianDigits(`${date} — ${hh}:${mm}`);
}

/** «۳۰ مهر ۱۴۰۴» */
export function formatJalaliLong(value: string | Date | null | undefined, withTime = false): string {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  const { jy, jm, jd } = toJalali(d);
  const base = `${jd} ${PERSIAN_MONTHS[jm - 1]} ${jy}`;
  if (!withTime) return toPersianDigits(base);
  const pad = (n: number) => String(n).padStart(2, '0');
  return toPersianDigits(`${base} — ${pad(d.getHours())}:${pad(d.getMinutes())}`);
}

/** «شنبه ۳۰ مهر ۱۴۰۴» */
export function formatJalaliFull(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  const { jy, jm, jd } = toJalali(d);
  return toPersianDigits(`${PERSIAN_WEEKDAYS[d.getDay()]} ${jd} ${PERSIAN_MONTHS[jm - 1]} ${jy}`);
}

/** تاریخ ISO برای ارسال به سرور (YYYY-MM-DD) */
export function toIsoDate(value: string | Date | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** مقدار مناسب برای input[type=date] */
export function dateInputValue(value: string | Date | null | undefined): string {
  return toIsoDate(value);
}

/**
 * تبدیل تاریخ واردشدهٔ کاربر به تاریخ میلادی ISO (YYYY-MM-DD) برای سرور.
 * قالب‌های پذیرفته‌شده:
 *   ۱۴۰۴/۰۱/۰۱ یا 14040101 → شمسی (به میلادی تبدیل می‌شود)
 *   2026-01-15             → میلادی
 * ارقام فارسی/عربی هم پذیرفته می‌شود. در صورت نامعتبر بودن، undefined برمی‌گرداند.
 */
export function parseDateInput(value: string | null | undefined): string | undefined {
  const raw = toEnglishDigits(value ?? '').trim();
  if (!raw) return undefined;

  // قالب شمسی بدون جداکننده: ۱۴۰۴۰۱۰۱
  const compact = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) {
    const [, y, m, d] = compact.map((v) => Number(v));
    return jalaliToIso(y, m, d);
  }

  // قالب با جداکننده: ۱۴۰۴/۰۱/۰۱ (شمسی) یا 2026-01-15 (میلادی)
  const sep = raw.match(/^(\d{4})([/-])(\d{1,2})\2(\d{1,2})$/);
  if (sep) {
    const y = Number(sep[1]);
    const m = Number(sep[3]);
    const d = Number(sep[4]);
    if (sep[2] === '/') return jalaliToIso(y, m, d);
    const date = new Date(y, m - 1, d);
    if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return undefined;
    return toIsoDate(date);
  }

  return undefined;
}

/** تبدیل تاریخ شمسی به میلادی ISO با اعتبارسنجی محدوده */
function jalaliToIso(jy: number, jm: number, jd: number): string | undefined {
  if (jm < 1 || jm > 12 || jd < 1 || jd > 31) return undefined;
  const date = toGregorian(jy, jm, jd);
  if (isNaN(date.getTime())) return undefined;
  const { jy: cy, jm: cm, jd: cd } = toJalali(date);
  // تبدیل باید دقیقاً همان تاریخ شمسی را برگرداند (بررسی اعتبار مثل ۳۱ اردیبهشت)
  if (cy !== jy || cm !== jm || cd !== jd) return undefined;
  return toIsoDate(date);
}

/* ------------------------- اعداد و پول ------------------------- */

export function formatNumber(value: number | string | null | undefined, fraction = 0): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'string' ? Number(value) : value;
  if (isNaN(n)) return '—';
  return toPersianDigits(
    n.toLocaleString('en-US', {
      minimumFractionDigits: fraction,
      maximumFractionDigits: fraction,
    }),
  );
}

/** مبلغ ریالی با جداکننده هزارگان */
export function formatRial(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '۰';
  return `${formatNumber(value)} ریال`;
}

/** مبلغ به تومان */
export function formatToman(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '۰';
  const n = typeof value === 'string' ? Number(value) : value;
  return `${formatNumber(Math.round(n / 10))} تومان`;
}

/** دقیقه → «۷ ساعت و ۳۰ دقیقه» */
export function formatMinutes(minutes: number | null | undefined): string {
  if (!minutes) return '۰';
  const sign = minutes < 0 ? '‎-' : '';
  const abs = Math.abs(Math.round(minutes));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h && m) return `${sign}${toPersianDigits(h)} ساعت و ${toPersianDigits(m)} دقیقه`;
  if (h) return `${sign}${toPersianDigits(h)} ساعت`;
  return `${sign}${toPersianDigits(m)} دقیقه`;
}

/** ساعت → «۰۷:۳۰» */
export function formatClock(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return '—';
  const sign = minutes < 0 ? '‎-' : '';
  const abs = Math.abs(Math.round(minutes));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${toPersianDigits(String(h).padStart(2, '0'))}:${toPersianDigits(String(m).padStart(2, '0'))}`;
}

/** درصد */
export function formatPercent(value: number | null | undefined, fraction = 0): string {
  if (value === null || value === undefined) return '—';
  return `${formatNumber(value, fraction)}٪`;
}

/** ماسک کردن کد ملی: ۰۰۱۲۳۴۵۶۷۸ → ******۵۶۷۸ */
export function maskNationalId(value: string | null | undefined): string {
  if (!value || value.length < 4) return '—';
  return `${'*'.repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`;
}

/** ماسک کردن شماره موبایل */
export function maskMobile(value: string | null | undefined): string {
  if (!value || value.length < 4) return '—';
  return `${'*'.repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`;
}

/* ------------------------- برچسب‌ها ------------------------- */

export const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  PERMANENT: 'رسمی',
  CONTRACTUAL: 'پیمانی',
  TEMPORARY: 'قراردادی',
  DAILY: 'روزمزد',
  INTERN: 'کارآموز',
  PROJECT: 'پروژه‌ای',
  CONSULTANT: 'مشاور',
  OUTSOURCED: 'پیمانکار',
};

export const EMPLOYEE_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'فعال',
  ON_LEAVE: 'در مرخصی',
  MISSION: 'در مأموریت',
  SUSPENDED: 'تعلیق',
  TERMINATED: 'خاتمه‌یافته',
};

export const LEAVE_TYPE_LABELS: Record<string, string> = {
  ANNUAL: 'استحقاقی',
  SICK: 'استعلاجی',
  MATERNITY: 'زایمان',
  PATERNITY: 'پدری',
  UNPAID: 'بی‌حقوق',
  HOURLY: 'ساعتی',
  MARRIAGE: 'ازدواج',
  BEREAVEMENT: 'فوت بستگان درجه یک',
  STUDY: 'تحصیلی',
  CUSTOM: 'سفارشی',
};

export const CONTRACT_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'پیش‌نویس',
  PENDING_APPROVAL: 'در انتظار تأیید',
  READY_TO_SIGN: 'آماده امضا',
  ACTIVE: 'فعال',
  EXPIRING: 'نزدیک به انقضا',
  RENEWED: 'تمدیدشده',
  SUSPENDED: 'تعلیق‌شده',
  TERMINATED: 'خاتمه‌یافته',
  CANCELLED: 'فسخ‌شده',
};

export const REQUEST_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'پیش‌نویس',
  SUBMITTED: 'ثبت‌شده',
  PENDING: 'در انتظار تأیید',
  PENDING_SUPERVISOR: 'در انتظار سرپرست',
  PENDING_MANAGER: 'در انتظار مدیر واحد',
  PENDING_HR: 'در انتظار منابع انسانی',
  APPROVED: 'تأییدشده',
  REJECTED: 'ردشده',
  CANCELLED: 'لغوشده',
  NEEDS_REVISION: 'نیازمند اصلاح',
  REFERRED: 'ارجاع‌شده',
  EXPIRED: 'منقضی‌شده',
};

export const ATTENDANCE_STATUS_LABELS: Record<string, string> = {
  COMPLETE: 'کامل',
  INCOMPLETE: 'ناقص',
  SUSPICIOUS: 'مشکوک',
  MISSION: 'در مأموریت',
  ABSENT: 'غیبت',
  REMOTE: 'دورکار',
  LEAVE: 'مرخصی',
  EXCEPTION: 'استثنایی',
};

export const PAYROLL_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'پیش‌نویس',
  REVIEWED: 'بررسی‌شده',
  LOCKED: 'قفل‌شده',
};

export const TASK_STATUS_LABELS: Record<string, string> = {
  NEW: 'جدید',
  IN_PROGRESS: 'در حال انجام',
  IN_REVIEW: 'منتظر تأیید',
  DONE: 'انجام‌شده',
  CANCELLED: 'لغوشده',
  OVERDUE: 'عقب‌افتاده',
};

export const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'کم',
  MEDIUM: 'متوسط',
  HIGH: 'زیاد',
  CRITICAL: 'بحرانی',
};

export const ASSET_STATUS_LABELS: Record<string, string> = {
  IN_STOCK: 'موجود',
  ASSIGNED: 'تحویل‌شده',
  DAMAGED: 'معیوب',
  LOST: 'مفقود',
  RETIRED: 'اسقاط',
};

export const MISSION_STATUS_LABELS: Record<string, string> = {
  REQUESTED: 'درخواست‌شده',
  PENDING_APPROVAL: 'در انتظار تأیید',
  APPROVED: 'تأییدشده',
  IN_PROGRESS: 'در جریان',
  COMPLETED: 'پایان‌یافته',
  REJECTED: 'ردشده',
  CANCELLED: 'لغوشده',
};

export const LOAN_STATUS_LABELS: Record<string, string> = {
  REQUESTED: 'درخواست‌شده',
  PENDING_APPROVAL: 'در انتظار تأیید',
  APPROVED: 'تأییدشده',
  REJECTED: 'ردشده',
  CANCELLED: 'لغوشده',
};

export const APPLICANT_STATUS_LABELS: Record<string, string> = {
  APPLIED: 'دریافت رزومه',
  SCREENING: 'غربالگری',
  HR_INTERVIEW: 'مصاحبه منابع انسانی',
  TECH_INTERVIEW: 'مصاحبه تخصصی',
  TEST: 'آزمون',
  FINAL_REVIEW: 'بررسی نهایی',
  OFFERED: 'پیشنهاد',
  HIRED: 'پذیرفته‌شده',
  REJECTED: 'ردشده',
  WITHDRAWN: 'انصراف',
};

export const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  TASK_ASSIGNED: 'وظیفه جدید',
  TASK_DUE_SOON: 'یادآوری مهلت وظیفه',
  TASK_CHANGED: 'تغییر وظیفه',
  TASK_OVERDUE: 'عقب‌ماندگی از مهلت',
  REQUEST_RESULT: 'نتیجه درخواست',
  SHIFT_CHANGED: 'تغییر شیفت',
  ATTENDANCE_REMINDER: 'یادآوری ثبت حضور',
  CERTIFICATE_EXPIRING: 'انقضای گواهی',
  CONTRACT_EXPIRING: 'انقضای قرارداد',
  ANNOUNCEMENT: 'اعلامیه سازمانی',
  PAYSLIP_PUBLISHED: 'فیش حقوقی',
  SECURITY_ALERT: 'هشدار امنیتی',
  LEAVE_BALANCE: 'مانده مرخصی',
  ASSET_DUE: 'تجهیزات در انتظار تحویل',
  SYSTEM: 'سامانه',
};

/** نگاشت وضعیت → کلاس نشان */
export function badgeKind(status: string | null | undefined): string {
  switch (status) {
    case 'APPROVED':
    case 'ACTIVE':
    case 'DONE':
    case 'COMPLETED':
    case 'HIRED':
    case 'ACCEPTED':
    case 'SETTLED':
    case 'PUBLISHED':
      return 'green';
    case 'PENDING':
    case 'PENDING_SUPERVISOR':
    case 'PENDING_MANAGER':
    case 'PENDING_HR':
    case 'SUBMITTED':
    case 'IN_PROGRESS':
    case 'IN_REVIEW':
    case 'REVIEWED':
    case 'OPEN':
    case 'PARTIAL':
      return 'amber';
    case 'REJECTED':
    case 'CANCELLED':
    case 'LOST':
    case 'OVERDUE':
    case 'FAILED':
    case 'EXPIRED':
    case 'TERMINATED':
      return 'red';
    case 'DRAFT':
    case 'NOT_STARTED':
    case 'PENDING_STATUS':
    case 'SUSPENDED':
    case 'LOCKED':
      return 'gray';
    case 'NEEDS_REVISION':
    case 'REFERRED':
    case 'UNDER_REVIEW':
    case 'PLANNED':
      return 'violet';
    default:
      return 'sky';
  }
}

/** برچسب عمومی وضعیت */
export function statusLabel(status: string | null | undefined): string {
  if (!status) return '—';
  const maps: Record<string, Record<string, string>> = {
    employee: EMPLOYEE_STATUS_LABELS,
    contract: CONTRACT_STATUS_LABELS,
    request: REQUEST_STATUS_LABELS,
    attendance: ATTENDANCE_STATUS_LABELS,
    payroll: PAYROLL_STATUS_LABELS,
    task: TASK_STATUS_LABELS,
    priority: PRIORITY_LABELS,
    asset: ASSET_STATUS_LABELS,
    applicant: APPLICANT_STATUS_LABELS,
    leave: LEAVE_TYPE_LABELS,
    employment: EMPLOYMENT_TYPE_LABELS,
    notification: NOTIFICATION_TYPE_LABELS,
  };
  for (const map of Object.values(maps)) {
    if (map[status]) return map[status];
  }
  return status;
}
