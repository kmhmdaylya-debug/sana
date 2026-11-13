/**
 * تبدیل تاریخ میلادی به شمسی (تقویم جلالی)
 * پیاده‌سازی بر پایه الگوریتم استاندارد jalaali
 */

interface JalaliCal {
  leap: number;
  gy: number;
  march: number;
}

function div(a: number, b: number): number {
  return ~~(a / b);
}
function mod(a: number, b: number): number {
  return a - ~~(a / b) * b;
}

function jalCal(jy: number): JalaliCal {
  const breaks = [
    -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192,
    2262, 2324, 2394, 2456, 3178,
  ];
  let bl = breaks.length;
  const gy = jy + 621;
  let leapJ = -14;
  let jp = breaks[0];

  if (jy < jp || jy >= breaks[bl - 1]) {
    throw new Error('سال شمسی نامعتبر است.');
  }

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

function d2g(jdn: number): { gy: number; gm: number; gd: number } {
  let j =
    4 * jdn + 139361631 +
    div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 -
    3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

export interface JalaliDate {
  jy: number;
  jm: number;
  jd: number;
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

export const PERSIAN_WEEKDAYS = [
  'یکشنبه',
  'دوشنبه',
  'سه‌شنبه',
  'چهارشنبه',
  'پنجشنبه',
  'جمعه',
  'شنبه',
];

/** تبدیل تاریخ میلادی به شمسی */
export function toJalali(date: Date): JalaliDate {
  const gy = date.getFullYear();
  const gm = date.getMonth() + 1;
  const gd = date.getDate();
  const jdn = g2d(gy, gm, gd);
  const d2gResult = d2g(jdn);
  let jy = d2gResult.gy - 621;
  const jal = jalCal(jy);
  const jdn1f = g2d(d2gResult.gy, 3, jal.march);
  let k = jdn - jdn1f;
  if (k >= 0) {
    if (k <= 185) {
      return { jy, jm: 1 + div(k, 31), jd: mod(k, 31) + 1 };
    }
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (jal.leap === 1) k += 1;
  }
  return { jy, jm: 7 + div(k, 30), jd: mod(k, 30) + 1 };
}

/** عدد دوره (سال) برای شماره‌گذاری اسناد */
export function jalaliYear(date: Date): string {
  return String(toJalali(date).jy);
}

/** قالب‌بندی تاریخ شمسی: ۱۴۰۴/۰۷/۳۰ */
export function formatJalali(date: Date, withTime = false): string {
  const { jy, jm, jd } = toJalali(date);
  const pad = (n: number) => String(n).padStart(2, '0');
  const base = `${jy}/${pad(jm)}/${pad(jd)}`;
  if (!withTime) return base;
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  return `${base} ${hh}:${mm}`;
}

/** قالب‌بندی با نام ماه شمسی */
export function formatJalaliLong(date: Date, withTime = false): string {
  const { jy, jm, jd } = toJalali(date);
  const pad = (n: number) => String(n).padStart(2, '0');
  const base = `${jd} ${PERSIAN_MONTHS[jm - 1]} ${jy}`;
  if (!withTime) return base;
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  return `${base} — ${hh}:${mm}`;
}

export function persianWeekday(date: Date): string {
  return PERSIAN_WEEKDAYS[date.getDay()];
}

/** بازه شروع و پایان یک روز بر حسب UTC (منطقه زمانی سازمان در لایه سرویس اعمال می‌شود) */
export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** تعداد روزهای تقویمی بین دو تاریخ */
export function daysBetween(from: Date, to: Date): number {
  const a = startOfDay(from).getTime();
  const b = startOfDay(to).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** افزودن روز به تاریخ */
export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
