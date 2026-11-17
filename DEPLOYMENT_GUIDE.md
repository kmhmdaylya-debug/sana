# راهنمای نصب و استقرار (Deployment Guide)

**پروژه:** سامانه مدیریت منابع انسانی «سنا» (Sana HRMS)  
**تاریخ:** ۱۳۰۵/۰۸/۲۷  
**وضعیت:** در حال تکمیل

---

## ۱. پیش‌نیازها

| ابزار | نسخه minimum |
|------|-------------|
| Docker | ۲۰.۱۰+ |
| Docker Compose | ۲.۲۰+ |
| Node.js | ۱۸+ (برای توسعه) |
| npm | ۹+ (برای توسعه) |
| PostgreSQL | ۱۶+ (در صورت نصب مستقر) |

---

## ۲. متغیرهای محیطی ضروری

فایل `.env` را در دایرکتوری `backend` ایجاد کنید:

```env
# سرور
PORT=4114
HOST=0.0.0.0
API_PREFIX=api
NODE_ENV=production

# Swagger
SWAGGER_ENABLED=true
SWAGGER_ALLOWED_IPS=127.0.0.1,::1

# دیتابیس
DATABASE_URL=postgresql://sana:sana_password@localhost:5432/sana_hrms?schema=public
PRISMA_LOG_QUERIES=false

# CORS
CORS_ORIGINS=https://app.sana.hr,http://localhost:5183

# JWT (باید با generate-secrets.ps1 تولید شوند)
JWT_ACCESS_SECRET=<کلید ۶۴ نویهای رندم>
JWT_REFRESH_SECRET=<کلید ۶۴ نویهای رندم>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
JWT_REFRESH_GRACE_SECONDS=15

# امنیت
MAX_LOGIN_ATTEMPTS=5
LOGIN_LOCKOUT_MINUTES=15
PASSWORD_MIN_LENGTH=10
RATE_LIMIT_TTL_MS=60000
RATE_LIMIT_LIMIT=300
AUTH_RATE_LIMIT_LIMIT=5
DEVICE_CLOCK_SKEW_SECONDS=120
ATTENDANCE_TIME_SOURCE=SERVER

# پشتیبان‌گیری
BACKUP_DIR=./backups
BACKUP_ENCRYPTION_KEY=<کلید ۳۲ نویهای رندم>
BACKUP_MAX_FILES=10
PG_DUMP_PATH=pg_dump
PG_RESTORE_PATH=pg_restore

# آنتی‌ویروس (اختیاری)
ANTIVIRUS_ENABLED=false
ANTIVIRUS_COMMAND=clamscan
ANTIVIRUS_TIMEOUT_MS=30000

# prêtres
ADMIN_USERNAME=admin
ADMIN_FULLNAME=مدیر سیستم
ADMIN_EMAIL=admin@example.com
SEED_DEMO_DATA=false
```

> **هیچ رمز یا کلید را در کد منبع Commit نکنید.** از فایل `.env` استفاده کنید.

---

## ۳. تولید کلیدهای امنیتی

```powershell
cd backend
.\scripts\generate-secrets.ps1
```

این اسکریپت کلیدهای JWT و Backup Encryption را تولید می‌کند.

---

## ۴. استقرار با Docker Compose (تولید)

```bash
# ساخت و اجرا
docker compose up -d --build

# بررسی وضعیت
docker compose ps

# مشاهده لاگ‌ها
docker compose logs -f backend
docker compose logs -f frontend

# متوقف‌سازی
docker compose down
```

### ساختار docker-compose.yml

| سرویس | توضیح | پورت |
|-------|-------|------|
| `sana-db` | PostgreSQL ۱۶ | ۵۴۳۳ |
| `sana-backend` | NestJS API | ۴۱۱۴ |
| `sana-frontend` | React Vite | ۵۱۸۳ |

---

## ۵. استقرار دستی (توسعه)

### بک‌اند:

```bash
cd backend
npm install
npx prisma migrate deploy
npx prisma generate
npm run start:dev
```

### فرانت‌اند:

```bash
cd frontend
npm install
npm run dev
```

---

## ۶. Migration دیتابیس

```bash
cd backend
# ایجاد migration جدید
npx prisma migrate dev --name migration_name

# اعمال migration در تولید
npx prisma migrate deploy

# تولید کلاینت Prisma
npx prisma generate
```

> **هیچ migrationی روی دیتابیس واقعی اجرا نشود بدون نسخه پشتیبان.**

---

## ۷. Health Check

```bash
curl http://localhost:4114/api/v1/health
```

پاسخ موفقیت‌آمیز:
```json
{
  "success": true,
  "data": { "status": "ok", "timestamp": "2026-08-27T12:00:00Z" },
  "timestamp": "2026-08-27T12:00:00Z"
}
```

---

## ۸. Backup و Restore

### Backup:
```bash
cd backend
npm run backup:create
```

### Restore (فقط در محیط staging):
```bash
npm run backup:restore -- <backup_file>
```

> **Restore uniquement در محیط staging و بدون اثر روی دیتابیس تولید.**

---

## ۹. monitoring و Logs

- لاگ‌های اپلیکیشن در stdout/stderr (دocker logs)
- لاگ‌های امنیتی در دیتابیس (جدول `AuditLog`)
- Health check در endpoint `/api/v1/health`

---

## ۱۰. نکات امنیتی استقرار

1. **HTTPS:** در تولید از reverse proxy (Nginx/Traefik) با TLS استفاده کنید
2. **Cookies:** Refresh token در cookie `HttpOnly`, `Secure`, `SameSite=Strict` ارسال می‌شود
3. **Secrets:** هیچ متغیر حساس در کد منبع نباشد
4. **CORS:** فقط دامنه‌های مجاز در `CORS_ORIGINS`
5. **Swagger:** در تولید فقط از طریق IP مجاز یا JWT در دسترس است
6. **Rate Limiting:** فعال برای تمام endpointها، خاصmente auth

---

## ۱۱. لیست بررسی قبل از استقرار (Pre-Deployment Checklist)

- [ ] همه متغیرهای محیطی ضروری تنظیم شده‌اند
- [ ] Migrationها با دیتابیس تستی اجرا و 확인 شده‌اند
- [ ] Build بک‌اند و فرانت‌اند موفق است
- [ ] تست‌های واحد بک‌اند اجرا شده‌اند
- [ ] Health check پاسخ ۲۰۰ می‌دهد
- [ ] Swagger در تولید محافظت شده است
- [ ] Rate limiting فعال است
- [ ] CSP فعال است
- [ ] نسخه پشتیبان از دیتابیس تهیه شده است

---

**تاریخ گزارش:** ۱۳۰۵/۰۸/۲۷  
**نسخه:** ۱.۰  
**وضعیت:** در حال تکمیل