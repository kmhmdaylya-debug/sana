# راهنمای راه‌اندازی

## ۱. توسعهٔ محلی (توصیه‌شده)

```powershell
# از ریشهٔ پروژه
powershell -ExecutionPolicy Bypass -File scripts\setup-dev.ps1
```

اسکریپت بالا: PostgreSQL را با Docker بالا می‌آورد، `.env` را می‌سازد،
وابستگی‌ها را نصب، مهاجرت‌ها را اعمال و seed می‌کند.

سپس در دو ترمینال جداگانه:

```powershell
# ترمینال ۱ — API
cd backend ; npm run start:dev

# ترمینال ۲ — فرانت‌اند
cd frontend ; npm run dev
```

| آدرس | توضیح |
|---|---|
| `http://localhost:5183` | رابط کاربری |
| `http://localhost:4114/api/docs` | Swagger |

## ۲. تغییر کلیدهای امنیتی

```powershell
powershell -ExecutionPolicy Bypass -File scripts\generate-secrets.ps1
```

خروجی را در `backend/.env` جایگزین کنید (`JWT_ACCESS_SECRET`، `JWT_REFRESH_SECRET`، `ADMIN_PASSWORD`).

## ۳. اجرای تولیدی

```powershell
docker compose up -d --build
```

کانتینر بک‌اند پیش از اجرا `migrate deploy` و `seed` را انجام می‌دهد.
برای تغییر نسخهٔ دیتابیس در آینده فقط `docker compose exec backend npx prisma migrate deploy` را دوباره اجرا کنید.

## ۴. عیب‌یابی رایج

| مشکل | راه‌حل |
|---|---|
| `P1001: can't reach database` | مطمئن شوید کانتینر `sana-db` سالم است: `docker compose ps` |
| خطای `JWT secrets` | مقدار پیش‌فرض CHANGE_ME را عوض کنید (حداقل ۳۲ کاراکتر) |
| 401 مداوم در فرانت | کوکی refresh پاک شده؛ خروج/ورود مجدد |
| خطای CORS | `CORS_ORIGINS` در `.env` باید آدرس فرانت را شامل شود |
| Seed خطای تکراری | طبیعی است — seed مقاوم به اجرای مجدد است (upsert) |
