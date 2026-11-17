# ==========================================================================
# راه‌اندازی اولیهٔ محیط توسعهٔ سنا (Windows PowerShell)
# Migration deployment never resets an existing database. Bootstrap is opt-in.
# ==========================================================================

param([switch]$Bootstrap)

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
  if ($LASTEXITCODE -ne 0) { throw 'Database startup failed' }
}

# 3) نصب وابستگی‌ها و مهاجرت‌ها
Push-Location $backend
try {
  Write-Host '2/3) نصب وابستگی‌ها…'
  npm.cmd ci
  if ($LASTEXITCODE -ne 0) { throw 'Backend dependency installation failed' }

  Write-Host '3/3) اعمال مهاجرت‌ها بدون بازنشانی داده‌ها…'
  npx.cmd prisma migrate deploy
  if ($LASTEXITCODE -ne 0) { throw 'Migration deployment failed' }
  if ($Bootstrap) {
    node -r dotenv/config -e 'const {PrismaClient}=require("@prisma/client"); const p=new PrismaClient({log:[]}); (async()=>{try{if(await p.user.count())throw Error("Bootstrap requires an empty user database")}finally{await p.$disconnect()}})().catch(()=>{console.error("Refusing bootstrap on an existing installation");process.exitCode=1})'
    if ($LASTEXITCODE -ne 0) { throw 'Initial administrator bootstrap refused' }
    npm.cmd run db:seed
    if ($LASTEXITCODE -ne 0) { throw 'Initial administrator bootstrap failed' }
  }

  Write-Host 'آماده است. اجرای سرور: npm run start:dev (در پوشهٔ backend)' -ForegroundColor Green
  Write-Host '   فرانت‌اند: cd frontend && npm install && npm run dev' -ForegroundColor Green
} finally {
  Pop-Location
}
