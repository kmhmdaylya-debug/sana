# راهنمای مستندات API و دسترسی امن به Swagger

**پروژه:** سامانه مدیریت منابع انسانی «سنا» (Sana HRMS)  
**تاریخ:** ۱۳۰۵/۰۸/۲۷  
**وضعیت:** در حال تکمیل

---

## ۱. آدرس دسترسی به Swagger

| محیط | آدرس | دسترسی |
|------|------|--------|
| توسعه (Development) | `http://localhost:4114/api/docs` | Öffentlichkeit |
| تولید (Production) | `https://api.sana.hr/api/docs` | فقط IP مجاز یا توکن JWT |

---

## ۲. امنیت دسترسی به Swagger در تولید

Swagger در محیط تولید به دو روش محافظت شده است:

### الف. محدودیت IP
فقط آدرس‌های IP ذکر شده در متغیر محیطی `SWAGGER_ALLOWED_IPS` می‌توانند به Swagger دسترسی پیدا کنند.

```env
SWAGGER_ALLOWED_IPS=10.0.0.1,10.0.0.2,127.0.0.1
```

### ب. احراز هویت JWT
کاربران با توکن JWT معتبر می‌توانند به Swagger دسترسی پیدا کنند:

```
Authorization: Bearer <access_token>
```

### ج. پیام خطا در صورت دسترسی غیرمجاز
- **۴۰۳:** دسترسی به مستندات API مجاز نیست
- **۴۰۱:** دسترسی به مستندات API نیاز به احراز هویت دارد

---

## ۳.」。

نمونه درخواست و پاسخ

### ورود به سیستم

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "SecureP@ssw0rd!"
}
```

**پاسخ موفق:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbG...",
    "user": { "id": "u1", "username": "admin", "roleCodes": ["SUPER_ADMIN"] }
  },
  "timestamp": "2026-08-27T12:00:00Z"
}
```

### ایجاد کارمند

```http
POST /api/v1/employees
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "firstName": "علی",
  "lastName": "رضایی",
  "nationalId": "0012345678",
  "companyId": "company-a",
  "employmentType": "PERMANENT"
}
```

---

## ۴. لیست Endpointهای اصلی

|what on earth happened? failed tool call|متد|Endpoint|توضیح|احراز هویت|
|---|---|---|---|---|
|Auth|POST|`/api/v1/auth/login`|ورود به سیستم|خیر|
|Auth|POST|`/api/v1/auth/refresh`|تازه‌سازی توکن|خیر|
|Auth|POST|`/api/v1/auth/logout`|خروج از سیستم|بله|
|Org|GET|`/api/v1/org/companies`|لیست شرکت‌ها|بله|
|Org|POST|`/api/v1/org/companies`|ایجاد شرکت|بله (SuperAdmin)|
|Employees|GET|`/api/v1/employees`|لیست کارکنان|بله|
|Employees|POST|`/api/v1/employees`|ایجاد کارمند|بله|
|Leaves|GET|`/api/v1/leaves`|لیست درخواست‌های مرخصی|بله|
|Leaves|POST|`/api/v1/leaves`|ثبت درخواست مرخصی|بله|
|Attendance|GET|`/api/v1/attendance/events`|رویدادهای حضور|بله|
|Attendance|POST|`/api/v1/attendance/events`|ثبت رویداد حضور|بله|
|Payroll|GET|`/api/v1/payroll/periods`|دوره‌های حقوقی|بله|
|Payroll|POST|`/api/v1/payroll/periods`|ایجاد دوره حقوقی|بله|
|Documents|GET|`/api/v1/documents`|لیست مدارک|بله|
|Documents|POST|`/api/v1/documents`|آپلود مدارک|بله|
|Tasks|GET|`/api/v1/tasks`|لیست کارها|بله|
|Tasks|POST|`/api/v1/tasks`|ایجاد کار|بله|
|Reports|GET|`/api/v1/reports`|گزارش‌ها|بله|
|Audit|GET|`/api/v1/audit`|لاگ‌های امنیتی|بله|

---

## ۵. کدهای خطا

| کد | توضیح |
|----|----------|
| ۲۰۰ | عملیات با موفقیت انجام شد |
| ۴۰۰ | درخواست نامعتبر (اعتبارسنجی) |
| ۴۰۱ | غیرمجاز (токن نامعتبر یا منقضی شده) |
| ۴۰۳ | دسترسی مجاز نیست |
| ۴۰۴ | منبع یافت نشد |
| ۴۰۹ | ناسازگاری (رکورد تکراری) |
| ۴۲۹ | demasiaded درخواست (Rate Limit) |
| ۵۰۰ | خطای داخلی سرور |

---

## ۶. رؤوسام‌های امنیتی

| رأس | مقدار |
|-----|-------|
| `Content-Security-Policy` | default-src 'self'; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https:; script-src 'self'; connect-src 'self' https:; font-src 'self' https:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none' |
| `X-Content-Type-Options` | nosniff |
| `X-Frame-Options` | DENY |
| `Referrer-Policy` | strict-origin-when-cross-origin |
| `Strict-Transport-Security` | max-age=31536000; includeSubDomains (در تولید با HTTPS) |

---

## ۷. Rate Limiting

| Endpoint | Limit | TTL |
|----------|-------|-----|
| `POST /api/v1/auth/login` | ۵ درخواست | ۱ دقیقه |
| `POST /api/v1/auth/refresh` | ۱۰ درخواست | ۱ دقیقه |
| سایر endpointها | ۳۰۰ درخواست | ۱ دقیقه |

---

**تاریخ گزارش:** ۱۳۰۵/۰۸/۲۷  
**نسخه:** ۱.۰  
**وضعیت:** در حال تکمیل