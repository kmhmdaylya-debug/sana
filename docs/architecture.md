# معماری سامانهٔ «سنا»

## مرور کلی

معماری ماژولار NestJS با لایه‌بندی Controller → Service → Prisma. همهٔ ماژول‌های
دامنه‌ای در `backend/src/<module>/` قرار دارند و از زیرساخت مشترک زیر استفاده می‌کنند:

- **PrismaModule** (Global): دسترسی DB
- **AccessModule** (Global): گاردهای JWT، مجوز (`RequirePermissions`) و محدودهٔ دسترسی (scope)
- **AuditModule** (Global): ثبت خودکار AuditLog رخدادهای حساس
- **NotificationModule** (Global): تولید اعلان درون‌برنامه‌ای

گاردهای سراسری با `APP_GUARD` در `app.module.ts` فعال شده‌اند؛ هر کنترلر فقط
مجوزهای موردنیاز را با دکوراتور `@RequirePermissions(...)` اعلام می‌کند.

## ماژول‌های دامنه‌ای (۲۹)

auth, users, roles, org (شرکت/شعبه/محل کار/مرکز هزینه/واحد/سمت/تقویم/تعطیلات),
employees, contracts, documents, attendance (رکورد/اصلاح/شیت), shifts (تعریف/انتساب/تعویض),
leaves (نوع/سیاست/درخواست/مانده), approvals (گردش‌های پویا), payroll (دوره/فیش/اجزا),
evaluations, tasks, assets, training, recruitment (درخواست جذب/آگهی/داوطلب/مصاحبه/پیشنهاد),
lifecycle (ورود/خروج/خاتمه), loans (وام/قسط/مزایا), missions, admin (مکاتبات/جلسات/نظرسنجی/پیشنهاد/گزارش محرمانه),
announcements, notifications, reports (۵ گزارش استاندارد + CSV/XLSX), dashboard,
audit-log, settings (تنظیمات/فیلد سفارشی/فیلتر ذخیره‌شده), backup.

## احراز هویت و مجوزدهی

1. **ورود:** Argon2id + قفل حساب پس از `MAX_LOGIN_ATTEMPTS` + SecurityEvent.
2. **توکن:** access token کوتاه‌عمر (۱۵ دقیقه) فقط در حافظهٔ فرانت؛ refresh token در
   cookie `httpOnly` با چرخش و ابطال خانوادهٔ توکن در صورت استفادهٔ مجدد.
3. **مجوز:** RBAC (نقش → مجوز `module.action`) به‌علاوهٔ ABAC با `ScopeAssignment`
   (ALL / COMPANY / BRANCH / ORG_UNIT / EMPLOYEE) که در هر کوئری لیست به
   `where` معادل تزریق می‌شود و از IDOR جلوگیری می‌کند.
4. **قاعدهٔ سرور:** در سرویس تصمیم‌گیری هر درخواست، برابری `applicant == approver`
   با خطا مسدود می‌شود.

## گردش تأیید (Approvals)

- `ApprovalFlow` پویا بر حسب `subjectType` (مرخصی، اصلاح حضور، مأموریت، …)
- مراحل: `ApprovalStep` با انواع تأییدکننده (سرپرست مستقیم، مدیر واحد، نقش ثابت)
- هر درخواست → `ApprovalInstance` → `ApprovalTask`؛ تصمیم‌ها با AuditLog ثبت می‌شوند.
- کارهای در انتظار کاربر از `/approvals/inbox` خوانده می‌شود.

## پشتیبان‌گیری و گزارش

- `pg_dump` در `BACKUP_DIR` با نگهداشت `BACKUP_MAX_FILES` نسخه و امکان دانلود.
- گزارش‌های استاندارد با `ReportRun` (تاریخچهٔ اجرا) و خروجی CSV/Excel (exceljs).

## فرانت‌اند

- React 18 + Vite، مسیرها با React Router و lazy-load صفحات.
- `lib/api.ts`: axios با interceptor تازه‌سازی توکن و دانلود فایل/گزارش.
- `lib/auth.tsx`: پرووایدر احراز هویت + توابع `hasPermission/hasAnyPermission`.
- `components/ui.tsx`: کتابخانهٔ کامپوننت (DataTable، Modal، Toast، Badge، …).
- `lib/format.ts`: تقویم جلالی (jalaali-js)، قالب ریال، برچسب وضعیت‌ها.
- ظاهر: `styles/global.css` با متغیرهای CSS و پشتیبانی پوستهٔ تیره/روشن.
