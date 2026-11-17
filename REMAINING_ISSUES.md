# فهرست مشکلات حل‌نشده و محدودیت‌ها (Remaining Issues)

**پروژه:** سامانه مدیریت منابع انسانی «سنا» (Sana HRMS)  
**تاریخ:** ۱۳۰۵/۰۸/۲۷  
**وضعیت:** در حال تکمیل

---

## ۱. مشکلات Critical (حل‌نشده)

| # | مشکل | توضیح | affected component | تخمین زمان رفع |
|---|-------|-------|-------------------|-----------------|
| RI-C1 | تکمیل تست‌های واحد برای ۲۵+ سرویس بک‌اند | ۱۵+ فایل spec جدید ایجاد شده اما نیاز به تطبیق با API واقعی دارند | Backend Testing | ۱-۲ هفته |
| RI-C2 | رفع خطاهای کامپایل در فایل‌های spec جدید | برخی نام متدها و ساختار پاسخ با réalisation مطابقت ندارد | Backend Testing | ۳-۵ روز |
| RI-C3 | پیاده‌سازی E2E Testing با Playwright | هیچ تست E2E وجود ندارد | Testing | ۱-۲ هفته |
| RI-C4 | Penetration Test واقعی | تست نفوذ در محیط آزمایشی اجرا نشده | Security | ۱-۲ هفته |

---

## ۲. مشکلات High (حل‌نشده)

| # | مشکل | توضیح | affected component | تخمین زمان رفع |
|---|-------|-------|-------------------|-----------------|
| RI-H1 | Cursor-based pagination برای لیست‌های بزرگ | Offset-based pagination برای داده‌های >۱۰۰k رکورد کند است | Backend/Database | ۳-۵ روز |
| RI-H2 | بهینه‌سازی N+1 Queries | برخی کوئری‌های داشبورد ممکن است N+1 تولید کنند | Backend | ۲-۳ روز |
| RI-H3 | تست‌های امنیتی (IDOR، XSS، CSRF) | تست‌های خودکار اجرا نشده | Security | ۱ هفته |
| RI-H4 | Load Testing | تست بار چندکاربره اجرا نشده | Performance | ۱ هفته |
| RI-H5 | Observability و Monitoring | لاگینگ ساختاریافته و Health Check کامل نیست | DevOps | ۳-۵ روز |

---

## ۳. مشکلات Medium (حل‌نشده)

| # | مشکل | توضیح | affected component | تخمین زمان رفع |
|---|-------|-------|-------------------|-----------------|
| RI-M1 | Image Optimization (WebP/AVIF) | تصاویر بدون فشرده‌سازی | Frontend/Performance | ۲-۳ روز |
| RI-M2 | Cache-Control Headers | هدرهای کش برای فایل‌های استاتیک ناکافی | DevOps/Performance | ۱-۲ روز |
| RI-M3 | i18n برای زبان‌های غیرفارسی | تمام متن‌ها hardcoded فارسی | Frontend/UI/UX | ۱-۲ هفته |
| RI-M4 | Accessibility Automation | تست aXe/lighthouse در CI نیست | Accessibility | ۳-۵ روز |
| RI-M5 | API Versioning Policy | سیاست deprecation API مستند نشده | Backend/API | ۱-۲ روز |

---

## ۴. مشکلات Low (حل‌نشده)

| # | مشکل | توضیح | affected component | تخمین زمان رفع |
|---|-------|-------|-------------------|-----------------|
| RI-L1 | TODO/FIXME در کد | موارد عدم تکمیل در کدهای مختلف | Code Quality | ۱ روز |
| RI-L2 | Storybook برای UI Components | مستندسازی کامپوننت‌ها | Frontend/UI | ۲-۳ روز |
| RI-L3 | OpenAPI Spec Export | export JSON/YAML در CI نیست | Backend/API | ۱ روز |
| RI-L4 | Dependency Update Automation | Dependabot/Renovate پیکربندی نشده | DevOps/Security | ۱ روز |

---

## ۵. محدودیت‌های بررسی (Assessment Limitations)

| # | محدودیت | توضیح |
|---|---------|-------|
| LI-1 | اندازه‌گیری واقعی Performance | Lighthouse/WebPageTest اجرا نشده؛ نمره بر اساس تحلیل کد تخمین زده شده |
| LI-2 | Penetration Testing تست نفوذ واقعی انجام نشده | امنیت بر اساس Code Review و OWASP Mapping ارزیابی شده |
| LI-3 | Load Testing | تست بار همزمان انجام نشده؛ مقیاس‌پذیری بر اساس معماری تخمین زده شده |
| LI-4 | Browser Compatibility | تست Cross-browser (Safari, Firefox, Edge) انجام نشده |
| LI-5 | Mobile Real Device | تست روی دستگاه‌های واقعی انجام نشده؛ بر اساس Responsive Design ارزیابی شده |
| LI-6 | Accessibility با Screen Reader | تست با NVDA/JAWS/VoiceOver انجام نشده |
| LI-7 | E2E Testing | تست‌های End-to-End اجرا نشده |

---

## ۶. ریسک‌های باقی‌مانده

| # | ریسک | سطح |planation |
|---|------|------|----------|
| RS-1 | عدم پوشش تست واحد برای همه سرویس‌ها | High | ریگریشن در منطق تجاری |
| RS-2 | عدم تست E2E | Medium | عدم اطمینان از جریان‌های کاربری واقعی |
| RS-3 | عدم Penetration Test | High | ریسک امنیتی غیرشناخته |
| RS-4 | عدم Load Test | Medium | عدم اطمینان از عملکرد تحت بار |
| RS-5 | به‌روزرسانی وابستگی‌ها | Low | ریسک security در پکیج‌های قدیمی |

---

## ۷. برنامه رفع مشکلات باقی‌مانده

### فاز ۱: Critical (هفته ۱-۳)
- تکمیل و تطبیق ۱۵+ فایل spec جدید
- رفع خطاهای کامپایل در تست‌ها
- اجرای تست‌ها و پوشش ≥ ۸۵٪

### فاز ۲: High (هفته ۳-۶)
- پیاده‌سازی E2E Testing با Playwright
- Penetration Test در محیط آزمایشی
- Cursor-based pagination
- Observability و Monitoring

### فاز ۳: Medium (هفته ۶-۹)
- Image Optimization
- i18n Foundation
- Accessibility Automation
- Cache-Control Headers

### فاز ۴: Low (هفته ۹-۱۰)
- TODO/FIXME cleanup
- Storybook
- Dependency Automation

---

## ۸. جمع‌بندی

| بخش | وضعیت | estimating effort |
|------|-------|------------------|
| تست یکپارچگی بک‌اند | ۱۲/۴۱ اجرا شده | ۲-۳ هفته |
| E2E Testing | ۰/۱۲ سناریو | ۱-۲ هفته |
| تست‌های امنیتی | ۰/۷ مورد | ۱ هفته |
| Performance Analysis | تحلیلی (بدون اندازه‌گیری) | ۱ هفته |
| Penetration Test | نشده | ۱-۲ هفته |

---

**تاریخ گزارش:** ۱۳۰۵/۰۸/۲۷  
**نسخه:** ۱.۰  
**وضعیت:** در حال تکمیل