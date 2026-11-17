# گزارش امنیتی (Security Audit Report)

**پروژه:** سامانه مدیریت منابع انسانی «سنا» (Sana HRMS)  
**تاریخ:** ۱۳۰۵/۰۸/۲۷  
**راهنمای ارزیابی:** OWASP ASVS 4.0 + OWASP Top 10 2021  
**وضعیت:** در حال تکمیل

---

## ۱.’arrière/security findings - تأییدشده (Confirmed)

| ID | آسیب‌پذیری | شدت | مکان | توضیح | وضعیت | راهکار |
|----|-----------|------|------|-------|-------|---------|
| SEC-01 | Rate Limiting ضعیف برای احراز هویت | HIGH | `backend/src/auth/auth.controller.ts:26` | محدودیت ورود ۱۰ درخواست در دقیقه (قبلاً) → lowering to 5 | Fixed | Reduce to 5/min, add CAPTCHA after 3 failures |
| SEC-02 | Content Security Policy غیرفعال | HIGH | `backend/src/main.ts` | `helmet({ contentSecurityPolicy: false })` | Fixed | Enabled CSP with restrictive policy |
| SEC-03 | Refresh Token Grace Period طولانی | MEDIUM | `backend/src/auth/auth.service.ts:234-264` | ۶۰ ثانیه پنجره replay attack | Fixed | Reduced to 15 seconds |
| SEC-04 | اعتبارسنجی فایل آپلودی ناقص | HIGH | `backend/src/documents/documents.service.ts` | عدم اسکن آنتی‌ویروس (اختیاری) | Fixed | Added ClamAV integration option |
| SEC-05 | Audit Log در صورت خطا | MEDIUM | `backend/src/common/audit/audit.service.ts` | عدم استفاده از Outbox Pattern | Partial | Transactional audit added |
| SEC-06 | Swagger در تولید غیرفعال | MEDIUM | `backend/src/main.ts` | مستندات در تولید در دسترس نیست | Fixed | Enabled with IP/Auth protection |

---

## ۲. آسیب‌پذیری‌های احتمالی (Likely)

| ID | آسیب‌پذیری محتمل | احتمال | مکان | توضیح | بررسی پیشنهادی |
|----|------------------|--------|------|-------|----------------|
| SEC-L1 | IDOR در APIهایNested | MEDIUM | تمام Controllerها | دسترسی به رکوردهای کاربران دیگر | Code review تمام endpointهای `:id` |
| SEC-L2 | SQL Injection در Raw Queries | LOW | `backend/src/common/prisma/prisma.service.ts` | `$executeRawUnsafe` با table name interpolation | بررسی regex validation جدول |
| SEC-L3 | JWT Algorithm Confusion | LOW | `backend/src/auth/auth.service.ts:339-346` | `algorithms: ['HS256']` صریح مشخص شده | تست با tokenهای `none`، `RS256` |
| SEC-L4 | Webhook Signature Verification | MEDIUM | `backend/prisma/schema.prisma:2872-2896` | verification logic دیده نشد | بررسی و تست verification در delivery handler |
| SEC-L5 | Sensitive Data in Logs | MEDIUM | تمام سرویس‌ها | لاگ کردن داده‌های حساس | مراجعة تمام console.log و loggerها |

---

## ۳. موارد بررسی‌نشده (Not Verified)

| ID | مورد | دلیل عدم بررسی |
|----|------|-----------------|
| SEC-N1 | Dependency Vulnerabilities (SCA) | `npm audit` / `snyk` / `trivy` اجرا نشده |
| SEC-N2 | Container Image Scanning | Docker image build/scan انجام نشده |
| SEC-N3 | Penetration Testing | تست نفوذ واقعی انجام نشده |
| SEC-N4 | Secrets Scanning in Git History | `trufflehog` / `gitleaks` اجرا نشده |
| SEC-N5 | CORS Misconfiguration در تولید | `CORS_ORIGINS` تنظیم شده اما تست نشده |

---

## ۴. اقدامات امنیتی اعمال‌شده

1. **Rate Limiting:** کاهش limit ورود از ۱۰ به ۵ درخواست در دقیقه
2. **CSP:** فعال‌سازی Content Security Policy در helmet
3. **File Upload:** افزودن اسکن آنتی‌ویروس (ClamAV) به storeUpload
4. **Refresh Token:** کاهش grace period از ۶۰ به ۱۵ ثانیه
5. **Swagger Security:** افزودن middleware امنیتی برای دسترسی به `/api/docs` در تولید
6. **Password Hashing:** Argon2id (پیش از این هست، اعتبارسنجی شده)

---

## ۵. موارد باقی‌مانده برای رسیدن به ۱۰۰٪

| # | وظیفه | اولویت | وضعیت |
|---|-------|--------|-------|
| ۱ | Penetration Test واقعی | Critical | pending |
| ۲ | Dependency Scan (npm audit، snyk) | High | pending |
| ۳ | Container Image Scan (trivy) | High | pending |
| ۴ | Secrets Scan (trufflehog/gitleaks) | High | pending |
| ۵ | تست IDOR برای تمام endpointها | Medium | pending |
| ۶ | تست XSS و CSRF | Medium | pending |
| ۷ | بررسی CORS در تولید | Medium | pending |

---

**تاریخ گزارش:** ۱۳۰۵/۰۸/۲۷  
**نسخه:** ۱.۰  
**وضعیت:** در حال تکمیل