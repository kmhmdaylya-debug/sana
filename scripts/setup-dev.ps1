# ==========================================================================
# راه‌اندازی اولیهٔ محیط توسعهٔ سنا (Windows PowerShell)
# 1) بالا آوردن PostgreSQL با Docker (اسرار در .env ریشه)  2) اعمال مهاجرت‌ها  3) Seed
# اجرا: powershell -ExecutionPolicy Bypass -File scripts\setup-dev.ps1
# ==========================================================================

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $root 'backend'

Write-Host "== سامانهٔ منابع انسانی سنا — راه‌اندازی توسعه ==" -ForegroundColor Cyan

# 0) ساخت فایل‌های .env با اسرار تصادفی (در صورت نبود)
& (Join-Path $PSScriptRoot 'generate-secrets.ps1')

# 1) بررسی Docker
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Warning 'Docker یافت نشد. PostgreSQL را دستی روی پورت 5433 راه‌اندازی کنید (مطابق backend/.env.example).'
} else {
  Write-Host '1/3) بالا آوردن پایگاه داده…'
  docker compose -f (Join-Path $root 'docker-compose.yml') up -d db
}

# 3) نصب وابستگی‌ها و مهاجرت‌ها
Push-Location $backend
try {
  Write-Host '2/3) نصب وابستگی‌ها…'
  npm.cmd install

  Write-Host '3/3) اعمال مهاجرت‌ها و Seed…'
  npx.cmd prisma migrate dev --name init
  npm.cmd run db:seed

  Write-Host '✅ آماده است. اجرای سرور: npm run start:dev (در پوشهٔ backend)' -ForegroundColor Green
  Write-Host '   فرانت‌اند: cd frontend && npm install && npm run dev' -ForegroundColor Green
} finally {
  Pop-Location
}
