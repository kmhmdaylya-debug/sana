# گزارش تست بار و تنش (Load & Stress Test Report)

**پروژه:** سامانه مدیریت منابع انسانی «سنا» (Sana HRMS)  
**تاریخ:** ۱۳۰۵/۰۸/۲۷  
**ابزار پیشنهادی:** k6  
**وضعیت:** در حال آمادگی (اجرا نشده)

---

## ۱. سناریوهای تست بار

| # | سناریو | کاربران هم‌زمان | مدته | هدف |
|---|--------|--------------|------|-----|
| L1 | ورود هم‌زمان کاربران | ۵۰ کاربر | ۵ دقیقه | بررسی Limitlessess login rate |
| L2 | مشاهده داشبورد | ۱۰۰ کاربر | ۱۰ دقیقه | بررسی TTFB و API response |
| L3 | جست‌وجوی کارکنان | ۵۰ کاربر | ۵ دقیقه | بررسی کوئری دیتابیس |
| L4 | ثبت حضور و غیاب | ۳۰ کاربر | ۵ دقیقه | بررسی تراکنسی writes |
| L5 | ثبت مرخصی | ۲۰ کاربر | ۵ دقیقه | بررسی validation و transaction |
| L6 | مشاهده گزارش‌ها | ۴۰ کاربر | ۵ دقیقه | بررسی export و PDF |
| L7 | عملیات حقوق و دستمزد | ۱۰ کاربر | ۱۰ دقیقه | بررسی period lock و concurrency |
| L8 | آپلود فایل | ۱۵ کاربر | ۵ دقیقه | بررسی حجم و storage |

---

## ۲. معیارهای پذیرش

| معیار | هدف | وضعیت |
|-------|-----|-------|
| Response Time (P95) | < ۵۰۰ ms | pending |
| Response Time (P99) | < ۱ ثانیه | pending |
| Throughput | > ۱۰۰ Request/ثانیه | pending |
| Error Rate | < ۱٪ | pending |
| CPU Usage | < ۸۰٪ | pending |
| Memory Usage | < ۸۰٪ | pending |
| Database Connections | < ۸۰٪ از pool | pending |
| Slow Queries | ۰ کوئری > ۱ ثانیه | pending |

---

## ۳. سنarios کد (نمونه k6)

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 50,
  duration: '5m',
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const loginRes = http.post('http://localhost:4114/api/v1/auth/login', {
    username: 'testuser',
    password: 'TestP@ssw0rd!',
  });
  
  check(loginRes, {
    'login status is 200': (r) => r.status === 200,
    'login has token': (r) => r.json('data.accessToken') !== undefined,
  });
  
  sleep(1);
}
```

---

## ۴. نتایج اجرا

تست بار هنوز اجرا نشده است. pending.

---

**تاریخ گزارش:** ۱۳۰۵/۰۸/۲۷  
**نسخه:** ۱.۰  
**وضعیت:** در حال آمادگی