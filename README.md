# سامانهٔ مدیریت منابع انسانی «سنا»

سامانهٔ یکپارچهٔ HRMS فارسی (RTL) با تقویم جلالی و مبالغ ریال، مطابق سند نیازمندی نسخهٔ ۳.۰.

## پشتهٔ فناوری

| لایه | فناوری |
|---|---|
| بک‌اند | NestJS 11 + Prisma 6 + PostgreSQL 16 |
| فرانت‌اند | React 18 + Vite 6 + TypeScript + Recharts |
| احراز هویت | Argon2 + JWT (access در حافظه، refresh در cookie httpOnly با چرخش) |
| مستندسازی API | Swagger (`/api/docs`) |

## ساختار پوشه‌ها

```
sana-hrms/
├── backend/          # API (۲۹ ماژول دامنه‌ای)
│   ├── prisma/       # schema.prisma + seed.ts
│   └── src/
├── frontend/         # SPA فارسی RTL
│   └── src/          # pages/ components/ layout/ lib/ styles/
├── scripts/          # اسکریپت‌های راه‌اندازی (PowerShell)
├── docs/             # مستندات
└── docker-compose.yml
```

## راه‌اندازی سریع (توسعه)

### پیش‌نیاز
- Node.js ≥ 20 و npm
- Docker (برای PostgreSQL) یا PostgreSQL بومی روی پورت `5433`

### ۱) پایگاه داده و بک‌اند

```powershell
powershell -ExecutionPolicy Bypass -File scripts\setup-dev.ps1
```

یا دستی:

```powershell
powershell -File scripts\generate-secrets.ps1   # ساخت .env ریشه و backend/.env با اسرار تصادفی
docker compose up -d db
cd backend
npm install
npx prisma migrate dev
npm run db:seed
npm run start:dev           # http://localhost:4114/api/docs
```

### ۲) فرانت‌اند

```powershell
cd frontend
npm install
npm run dev                 # http://localhost:5183
```

### ۳) ورود اولیه

نام کاربری و گذرواژهٔ مدیر از `.env` بک‌اند (`ADMIN_USERNAME` / `ADMIN_PASSWORD`) خوانده می‌شود.
رمز مدیر اولیه در `.env` ریشه ذخیره می‌شود. دادهٔ نمونه فقط با `SEED_DEMO_DATA=true` ساخته می‌شود و رمز کاربران نمونه از `DEMO_PASSWORD_ALI` و `DEMO_PASSWORD_MARYAM` خوانده می‌شود.

### ۴) دادهٔ نمونهٔ جامع (همهٔ بخش‌ها)

برای پر کردن همهٔ ماژول‌های سامانه با دادهٔ واقع‌گرایانه (نیروها، قرارداد، حضور و غیاب، مرخصی،
حقوق، ارزیابی، وظایف، دارایی، آموزش، استخدام، مأموریت، وام، مکاتبات، اعلامیه‌ها و …):

```powershell
cd backend
npm run db:seed:demo
```

اسکریپت idempotent است و کاربران نمونهٔ `ali` / `maryam` / `negar` را با رمز
`DEMO_PASSWORD_ALI` / `DEMO_PASSWORD_MARYAM` می‌سازد.

## اجرای تولیدی با Docker

```powershell
docker compose up -d --build
```

- فرانت: `http://localhost:8080`
- API: `http://localhost:4114/api`

> قبل از اجرا، متغیرهای `POSTGRES_PASSWORD`، `JWT_ACCESS_SECRET`، `JWT_REFRESH_SECRET`،
> `BACKUP_ENCRYPTION_KEY` و `ADMIN_PASSWORD` الزامی‌اند؛ با `scripts\generate-secrets.ps1` تولید کنید.
> برنامه بدون این متغیرها (یا با مقادیر نمونه) اجرا نمی‌شود.

## اصول طراحی

- **قاعدهٔ سرور:** هیچ کاربری حق تأیید درخواست خودش را ندارد؛ تصمیم‌ها فقط از مسیر گردش تأیید انجام می‌شوند.
- **حذف منطقی:** رکوردها soft-delete می‌شوند (`deletedAt`).
- **امنیت:** RBAC/ABAC با scope (سازمان/شعبه/واحد/خود)، لاگ ممیزی کامل رخدادهای حساس، محدودسازی نرخ درخواست، helmet.
- **پاسخ لیست استاندارد:** `{ data, meta: { total, page, limit, totalPages, hasNext, hasPrev }, success, timestamp }`.
- **مالی:** مبالغ به‌صورت عدد صحیح ریال (`BigInt`) بدون ممیز.

## دستورات پرکاربرد

| دستور | محل | توضیح |
|---|---|---|
| `npm run start:dev` | backend | اجرای API با watch |
| `npm run prisma:studio` | backend | مشاهدهٔ داده‌ها |
| `npm run db:reset` | backend | ریست کامل DB + seed |
| `npm run db:seed:demo` | backend | دادهٔ نمونهٔ جامع همهٔ بخش‌ها (شامل پروژه‌ها و گانت چارت) |
| `npm run build` | frontend | build تولیدی (tsc + vite) |
| `npm run build` | backend | build NestJS |

## پروژه‌ها و گانت چارت

ماژول «پروژه‌ها» (منوی **پروژه‌ها و گانت**) دو نما ارائه می‌دهد:

- **تقویم پروژه:** کارت هر پروژه با بازهٔ زمانی، اولویت، درصد پیشرفت، مراحل رنگی و اعضا.
- **گانت چارت:** میله‌های هر مرحله روی محور زمان (تقویم شمسی) با خطوط وابستگی میان مراحل.

هر پروژه شامل کارها (مراحل) با تاریخ شروع/پایان، مسئول، پیشرفت و **پیش‌نیاز** است.
مدل‌های دیتابیس: `Project`، `ProjectMember`، `ProjectTask` — و مجوزهای `projects.view|create|update|delete`.

## پنل کارمند

صفحهٔ **پنل کارمند** (`/panel`) برای کارکنانی است که کار پروژه انجام می‌دهند. تب‌های آن:

| تب | امکانات |
|---|---|
| کارهای من | پروژه‌ها و مراحل اختصاصی + **ثبت حضور** روی هر مرحله (با مدت و توضیح) |
| مرخصی‌ها | ثبت درخواست مرخصی (تاریخ شمسی) و پیگیری وضعیت تأیید |
| مأموریت‌ها | مأموریت‌ها، گزارش، هزینهٔ برآوردی/واقعی و ریز هزینه‌ها |
| حقوق من | فیش‌های حقوقی با ریز اقلام (پرداختی/کسورات) و **زمان پرداخت** |
| حضور و غیاب | رکوردهای حضور ماه جاری + حضور پروژه‌ای |
| پروندهٔ من | اطلاعات پرسنلی، قرارداد، مانده مرخصی، مهارت‌ها، مدارک و حساب بانکی |

کاربران بدون پروندهٔ پرسنلی (مثل مدیر ارشد سیستم) این پنل را نمی‌بینند.
مجوزها: `panel.view`، `panel.attendance`، `panel.leave.request` — مدل حضور پروژه: `ProjectAttendance`.


