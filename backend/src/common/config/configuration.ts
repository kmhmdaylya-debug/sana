import { registerAs } from '@nestjs/config';

/** مسیر فایل تنظیمات برای نمایش در پیام‌های خطا */
const ENV_FILE_HINT = 'فایل backend\\.env (در پوشهٔ backend)';

/**
 * کلیدهای امنیتی باید از محیط خوانده شوند و مقدار پیش‌فرض ندارند.
 * اگر کلید تنظیم نشده باشد یا مقدار نمونه باشد، برنامه اجرا نمی‌شود.
 */
function requiredSecret(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `متغیر ${name} در ${ENV_FILE_HINT} پیدا نشد. فایل .env را از .env.example بسازید ` +
        `یا با scripts\\generate-secrets.ps1 مقدار تصادفی تولید کنید.`,
    );
  }
  if (/CHANGE_ME|dev-only/i.test(value)) {
    throw new Error(
      `متغیر ${name} هنوز مقدار نمونه (CHANGE_ME) دارد. در ${ENV_FILE_HINT} آن را با یک رشتهٔ تصادفی جایگزین کنید.`,
    );
  }
  if (value.length < 32) {
    throw new Error(`متغیر ${name} باید حداقل ۳۲ نویسه باشد (فعلاً ${value.length} نویسه است).`);
  }
  return value;
}

/** مقدار اجباری از محیط (بدون مقدار پیش‌فرض) */
function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `متغیر ${name} در ${ENV_FILE_HINT} پیدا نشد. فایل .env را در پوشهٔ backend بسازید ` +
        `(از .env.example کپی کنید) و این متغیر را مقداردهی کنید.`,
    );
  }
  return value;
}

export default registerAs('app', () => ({
  name: process.env.APP_NAME ?? 'سامانه مدیریت منابع انسانی «سنا»',
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '4114', 10),
  /** نشانی شنود سرور؛ در Docker باید 0.0.0.0 باشد */
  host: process.env.HOST ?? '127.0.0.1',
  apiPrefix: process.env.API_PREFIX ?? 'api',
  swaggerEnabled: (process.env.SWAGGER_ENABLED ?? 'false') === 'true',

  database: {
    url: requiredEnv('DATABASE_URL'),
    logQueries: (process.env.PRISMA_LOG_QUERIES ?? 'false') === 'true',
  },

  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5183,http://127.0.0.1:5183')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  jwt: {
    accessSecret: requiredSecret('JWT_ACCESS_SECRET'),
    refreshSecret: requiredSecret('JWT_REFRESH_SECRET'),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshExpiresDays: parseInt(process.env.JWT_REFRESH_EXPIRES_DAYS ?? '7', 10),
    rememberMeExpiresDays: parseInt(process.env.JWT_REMEMBER_ME_EXPIRES_DAYS ?? '30', 10),
    /** بازهٔ ارفاق چرخش توکن refresh (برای درخواست‌های هم‌زمان/چند تب) — ثانیه */
    refreshGraceSeconds: parseInt(process.env.JWT_REFRESH_GRACE_SECONDS ?? '60', 10),
    issuer: process.env.JWT_ISSUER ?? 'sana-hrms',
  },

  security: {
    maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS ?? '5', 10),
    loginLockoutMinutes: parseInt(process.env.LOGIN_LOCKOUT_MINUTES ?? '15', 10),
    passwordMinLength: parseInt(process.env.PASSWORD_MIN_LENGTH ?? '10', 10),
    rateLimitTtlMs: parseInt(process.env.RATE_LIMIT_TTL_MS ?? '60000', 10),
    rateLimitLimit: parseInt(process.env.RATE_LIMIT_LIMIT ?? '300', 10),
    authRateLimitLimit: parseInt(process.env.AUTH_RATE_LIMIT_LIMIT ?? '10', 10),
    /** حد مجاز انحراف ساعت دستگاه حضور و غیاب (ثانیه) */
    deviceClockSkewSeconds: parseInt(process.env.DEVICE_CLOCK_SKEW_SECONDS ?? '120', 10),
    /** منبع معتبر پیش‌فرض زمان در حضور و غیاب */
    attendanceTimeSource: process.env.ATTENDANCE_TIME_SOURCE ?? 'SERVER',
  },

  payroll: {
    /** واحد پول پایه */
    currency: process.env.PAYROLL_CURRENCY ?? 'IRR',
    /** نمایش ریال یا تومان */
    displayUnit: process.env.PAYROLL_DISPLAY_UNIT ?? 'RIAL',
    /** تعداد روز کاری ماه برای محاسبه اضافه‌کار */
    workingDaysPerMonth: parseInt(process.env.WORKING_DAYS_PER_MONTH ?? '30', 10),
    /** ساعت کاری روزانه پیش‌فرض */
    defaultWorkHoursPerDay: parseInt(process.env.DEFAULT_WORK_HOURS_PER_DAY ?? '8', 10),
  },

  backup: {
    dir: process.env.BACKUP_DIR ?? './backups',
    /** کلید رمزنگاری فایل‌های پشتیبان (AES-256-GCM) — حداقل ۳۲ نویسه */
    encryptionKey: requiredSecret('BACKUP_ENCRYPTION_KEY'),
    maxFiles: parseInt(process.env.BACKUP_MAX_FILES ?? '10', 10),
    pgDumpPath: process.env.PG_DUMP_PATH ?? 'pg_dump',
    pgRestorePath: process.env.PG_RESTORE_PATH ?? 'pg_restore',
    restoreDatabaseUrl: process.env.BACKUP_RESTORE_DATABASE_URL ?? '',
  },

  seed: {
    adminUsername: process.env.ADMIN_USERNAME ?? 'admin',
    /** رمز مدیر اولیه؛ بدون مقدار پیش‌فرض */
    adminPassword: process.env.ADMIN_PASSWORD ?? '',
    adminFullName: process.env.ADMIN_FULLNAME ?? 'مدیر سیستم',
    adminEmail: process.env.ADMIN_EMAIL ?? 'admin@example.com',
    demoData: (process.env.SEED_DEMO_DATA ?? 'false') === 'true',
  },
}));
