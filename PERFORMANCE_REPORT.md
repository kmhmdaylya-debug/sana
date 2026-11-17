# گزارش عملکرد (Performance Report)

**پروژه:** سامانه مدیریت منابع انسانی «سنا» (Sana HRMS)  
**تاریخ:** ۱۳۰۵/۰۸/۲۷  
**وضعیت:** تحلیلی (بر اساس تحلیل کد، بدون اندازه‌گیری واقعی Lighthouse/WebPageTest)

---

## ۱. تغییرات اعمال‌شده در عملکرد

### الف. بهینه‌سازی Bundle Size (Frontend)

فایل `vite.config.ts` به‌روزرسانی شد با `manualChunks` برای جدا‌سازی vendorها:

| Chunk | کتابخانه‌ها |估计 حجم |
|-------|-----------|---------|
| vendor-react | react, react-dom | ~۴۵ KB gzipped |
| vendor-axios | axios | ~۱۳ KB gzipped |
| vendor-recharts | recharts | ~۱۵۰ KB gzipped |
| vendor-lucide | lucide-react | ~۵ KB gzipped |
| vendor-forms | react-hook-form | ~۱۴ KB gzipped |
| vendor-router | react-router-dom | ~۱۶ KB gzipped |
| vendor-jalaali | jalaali-js | ~۱۰ KB gzipped |
| vendor-utils | clsx | ~۱ KB gzipped |
| vendor-other | سایر node_modules | متغیر |

**مزایا:**
- کاهش حجم chunk اولیه ( Initial bundle )
- کش بهتر با chunkFileNames hashed
- بارگذاری کشőانه برای vendorها که تغییر نمی‌کنند

### ب. بهینه‌سازی React

- حذف state update بعد از Unmount در Layout.tsx (با AbortController)
- حذف state update بعد از Unmount در Dashboard.tsx (با AbortController)
- мемоизация داشبورد با useMemo برای weekBars

### ج. بهینه‌سازی Backend و Database

- Transactional audit log (ثبت همزمان با عملیات اصلی)
- Indexهای موجود در schema.prisma (Foreign Keys و Unique Constraints)
- Paginationoffset-based در List APIها (نیازمند به_cursor-based برای داده‌های زیاد)

---

## ۲. معیارهای اندازه‌گیری (هدف)

| معیار | هدف | وضعیت فعلی | vehículo |
|-------|-----|-------------|---------|
| Initial Bundle Size | < ۵۰۰ KB gzipped | نامشخص | نیاز به اجرا |
| Total JavaScript Size | < ۱ MB gzipped | نامشخص | نیاز به اجرا |
| First Contentful Paint (FCP) | < ۱.۵ ثانیه | نامشخص | نیاز به Lighthouse |
| Largest Contentful Paint (LCP) | < ۲.۵ ثانیه | نامشخص | نیاز به Lighthouse |
| Cumulative Layout Shift (CLS) | < ۰.۱ | نامشخص | نیاز به Lighthouse |
| Interaction to Next Paint (INP) | < ۲۰۰ ms | نامشخص | نیاز به Lighthouse |
| Time to First Byte (TTFB) | < ۲۰۰ ms | نامشخص | نیاز به اندازه‌گیری سرور |
| API Response Time (P95) | < ۵۰۰ ms | نامشخص | نیاز به Load Test |
| Database Query Duration (P95) | < ۱۰۰ ms | نامشخص | نیاز به Query Analysis |

---

## ۳. مشکلات عملکردی شناخته‌شده

| # | مشکل | تأثیر | راهکار |
|---|-------|-------|---------|
| PERF-01 | Offset Pagination در لیست‌های بزرگ | کندی در صفحات głębokie | Cursor-based pagination (keyset) |
| PERF-02 | N+1 Query در برخی سرویس‌ها | کندی در داشبورد مدیریت | بهینه‌سازی `include`/`select` |
| PERF-03 | Recharts بدون Tree Shaking | حجم Bundle بالا | Import selectivity از recharts |
| PERF-04 | Image Optimization غیرفعال | بارگذاری تصاویر بزرگ | Vite imagetools plugin |
| PERF-05 | Cache-Control Headers ناکافی | تکرار بارگذاری استاتیک‌ها | Nginx config با expires |
| PERF-06 | Real-time Polling هر ۳۰ ثانیه | درخواست‌های بی‌معنی | WebSocket/SSE یا افزایش interval |

---

## ۴. برنامه بهینه‌سازی بعدی

| # | وظیفه | اولویت | وضعیت |
|---|-------|--------|-------|
| ۱ | تحلیل Bundle با vite-bundle-analyzer | Medium | pending |
| ۲ | Cursor-based pagination برای لیست‌های بزرگ | Medium | pending |
| ۳ | Optimize N+1 Queries در DashboardService | Medium | pending |
| ۴ | Image Optimization (WebP/AVIF) | Low | pending |
| ۵ | Cache-Control در Nginx | Low | pending |
| ۶ | WebSocket/SSE برای real-time updates | Medium | pending |

---

## ۵. روش اندازه‌گیری پیشنهادی

```bash
# Lighthouse CI
npx lighthouse http://localhost:5183 --preset=desktop --output=json --output-path=lighthouse-report.json

# Bundle Analyzer
npm install --save-dev vite-bundle-analyzer
# اضافه کردن به vite.config.ts

# Load Test (k6)
k6 run load-test.js
```

---

**تاریخ گزارش:** ۱۳۰۵/۰۸/۲۷  
**نسخه:** ۱.۰  
**وضعیت:** تحلیلی (نیاز به اندازه‌گیری واقعی)