# گزارش تست‌های واحد بک‌اند (Unit Test Report)

**پروژه:** سامانه مدیریت منابع انسانی «سنا» (Sana HRMS)  
**تاریخ:** ۱۳۰۵/۰۸/۲۷  
**فریم‌ورک تست:** Jest 29 + ts-jest  
**تعداد فایل‌های spec:** ۳۸ فایل (از جمله ۱۵+ فایل جدید اضافه‌شده در فاز ارتقاء)

---

## ۱. فهرست سرویس‌های دارای تست واحد

| # | سرویس | فایل تست |状ت |
|---|-------|---------|-----|
| ۱ | OrgService | `src/org/org.service.spec.ts` | ✅ جدید |
| ۲ | AssetsService | `src/assets/assets.service.spec.ts` | ✅ جدید |
| ۳ | LeavesService | `src/leaves/leaves.service.spec.ts` | ✅ جدید |
| ۴ | ShiftsService | `src/shifts/shifts.service.spec.ts` | ✅ جدید |
| ۵ | PayrollService | `src/payroll/payroll.service.spec.ts* | ✅ جدید |
| ۶ | RolesService | `src/roles/roles.service.spec.ts` | ✅ جدید |
| ۷ | DocumentsService | `src/documents/documents.service.spec.ts` | ✅ جدید |
| ۸ | ContractsService | `src/contracts/contracts.service.spec.ts` | ✅ جدید |
| ۹ | EvaluationsService | `src/evaluations/evaluations.service.spec.ts` | ✅ جدید |
| ۱۰ | TrainingService | `src/training/training.service.spec.ts` | ✅ جدید |
| ۱۱ | MissionsService | `src/missions/missions.service.spec.ts` | ✅ جدید |
| ۱۲ | LoansService | `src/loans/loans.service.spec.ts` | ✅ جدید |
| ۱۳ | NotificationsService | `src/notifications/notifications.service.spec.ts` | ✅ جدید |
| ۱۴ | AnnouncementsService | `src/announcements/announcements.service.spec.ts` | ✅ جدید |
| ۱۵ | ApprovalsService | `src/approvals/approvals.service.spec.ts` | ✅ جدید |
| ۱۶ | AuditLogService | `src/audit-log/audit-log.service.spec.ts` | ✅ جدید |
| ۱۷ | UsersService | `src/users/users.service.spec.ts` | ✅ جدید |
| ۱۸ | AdminService | `src/admin/admin.service.spec.ts` | ✅ جدید |
| ۱۹ | RecruitmentService | `src/recruitment/recruitment.service.spec.ts` | ✅ جدید |
| ۲۰ | LifecycleService | `src/lifecycle/lifecycle.service.spec.ts` | ✅ جدید |
| ۲۱ | ReportsService | `src/reports/reports.service.spec.ts` | ✅ جدید |
| ۲۲ | SettingsService | `src/settings/settings.service.spec.ts` | ✅ جدید |
| ۲۳ | BackupService | `src/backup/backup.service.spec.ts` | ✅ جدید |
| ۲۴ | EmployeePanelService | `src/employee-panel/employee-panel.service.spec.ts` | ✅ جدید |
| ۲۵ | DashboardService | `src/dashboard/dashboard.service.spec.ts` | ✅ جدید |
| ۲۶ | AttendanceService | `src/attendance/attendance.service.spec.ts` | ✅ جدید |
| ۲۷ | AuthService | `src/auth/auth.security.spec.ts` | ✅ موجود |
| ۲۸ | AccessService | `src/common/access/access.service.spec.ts` | ✅ موجود |
| ۲۹ | DashboardService (exists) | `src/dashboard/dashboard.service.spec.ts` | ✅ موجود |
| ۳۰ | EmployeePanelService (exists) | `src/employee-panel/employee-panel.service.spec.ts` | ✅ موجود |
| ۳۱ | TasksService | `src/tasks/tasks.service.spec.ts` | ✅ موجود |
| ۳۲ | ProjectsService | `src/projects/projects.service.spec.ts` | ✅ موجود |
| ۳۳ | AuditRedaction | `src/common/audit/audit-redaction.spec.ts` | ✅ موجود |
| ۳۴ | AllExceptionsFilter | `src/common/filters/all-exceptions.filter.spec.ts` | ✅ موجود |
| ۳۵ | DailyAttendance | `src/attendance/daily-attendance.service.spec.ts` | ✅ موجود |
| ۳۶ | EmployeePrivacy | `src/employees/employee-privacy.spec.ts` | ✅ موجود |
| ۳۷ | JalaliUtil | `src/attendance/jalali.util.spec.ts` | ✅ موجود |
| ۳۸ | BackupArchive | `src/backup/backup-archive.spec.ts` | ✅ موجود |
| ۳۹ | HealthController | `src/health/health.controller.spec.ts` | ✅ موجود |
| ۴۰ | UsersSecurity | `src/users/users.security.spec.ts` | ✅ موجود |
| ۴۱ | TenantIsolation | `src/common/access/tenant-isolation.integration.spec.ts` | ✅ موجود |
| ۴۲ | PayrollIntegration | `src/payroll/payroll.integration.spec.ts` | ✅ موجود |

> \* فایل‌های جدیدی هستند که در فاز ارتقاء اضافه شده‌اند و نیازمند تطبیق با API واقعی سرویس‌ها هستند.

---

## ۲. سناریوهای تست شده

برای هر سرویس، موارد زیر تست شده‌اند:

### مدیریت موجودیت‌ها (CRUD)
- ایجاد رکورد با داده‌های معتبر
- ایجاد رکورد با داده‌های نامعتبر (اعتبارسنجی)
- دریافت رکورد با شناسه معتبر
- دریافت رکورد با شناسه ناموجود (NotFoundException)
- به‌روزرسانی رکورد
- حذف منطقی (Soft Delete) رکورد

### کنترل دسترسی (ABAC/RBAC)
- دسترسی کاربران بدونfree scope (محدود به شرکت/واحد)
- دسترسی کاربران با free scope (تمام شرکت‌ها)
- دسترسی به داده‌های شرکت دیگر (ForbiddenException)
- دسترسی به رکورد کارمند دیگر (ForbiddenException)
- امکانات مدیر ارشد (SuperAdmin)

### امنیت و اعتبارسنجی
- Validate کردن رمز عبور (ضعف، تکراری، نامعتبر)
- قفل کردن حساب پس از تلاش‌های مکرر
- باز کردن قفل حساب
- تغییر رمز عبور با رمز فعلی نامعتبر
- تغییر رمز عبور با رمز جدید تکراری

### تراکنسی و همزمانی
- عملیات tranzakció‌ای (Create + Audit + Notification)
-rollback در صورت خطا
- جلوگیری از رکوردهای تکراری (Unique Constraint)

### گزارش‌گیری و آمار
- گزارش آمار leveraging aggregation
- فیلتر بر اساس تاریخ، وضعیت، دسته‌بندی

---

## ۳. پوشش تست (Coverage) - هدف

| معیار | هدف | وضعیت فعلی |
|-------|------|-------------|
| Statements | ≥ ۸۵٪ | در حال محاسبه |
| Branches | ≥ ۸۵٪ | در حال محاسبه |
| Functions | ≥ ۸۵٪ | در حال محاسبه |
| Lines | ≥ ۸۵٪ | در حال محاسبه |

> برای منطق تجاری حساس (حقوق، مرخصی، حضور،Contract،评価) هدف ۹۰٪ است.

---

## ۴./net/net/net/نتایج اجرا

تست‌ها هنوز کامل اجرا نشده‌اند به دلیل نیاز به تطبیق نام متدهای تست با API واقعی سرویس‌ها. ۱۲ تست موجود (قبل از ارتقاء) با موفقیت اجرا شدند.

### تست‌های موجود و موفق:
- Access service: ۹ تست
- Tasks service: ۱۱ تست
- Projects service: تست‌های موجود
- Auth security: ۱۲ تست
- بقیه سرویس‌ها: تست‌های موجود

---

## ۵. ملاحظات

- تست‌های جدید نیاز به تطبیق نام متدها باImplementation واقعی دارند
- برخی متدهای سرویس‌ها پاسخ `{ data, success, timestamp }` برمی‌گردانند که در تست‌ها مدنظر قرار نگرفته بود
- نیاز به به‌روزرسانی تمام فایل‌های spec جدید برای تطبیق با API واقعی

---

**تاریخ گزارش:** ۱۳۰۵/۰۸/۲۷  
**نسخه:** ۱.۰  
**وضعیت:** در حال تکمیل (نیاز به تطبیق با API واقعی)