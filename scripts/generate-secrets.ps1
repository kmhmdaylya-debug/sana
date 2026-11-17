# ==========================================================================
# تولید اسرار تصادفی و ساخت فایل‌های .env — سنا
#
# - اگر فایل .env ریشه و backend/.env وجود نداشته باشند، ساخته می‌شوند
#   و همهٔ مقادیر حساس با مقادیر تصادفی جایگزین می‌شوند.
# - اگر فایل‌ها از قبل وجود داشته باشند، دست‌نخورده می‌مانند.
#
# اجرا: powershell -ExecutionPolicy Bypass -File scripts\generate-secrets.ps1
# ==========================================================================

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$rootEnv = Join-Path $root '.env'
$backendEnv = Join-Path $root 'backend\.env'
$backendExample = Join-Path $root 'backend\.env.example'

$hasRoot = Test-Path -LiteralPath $rootEnv
$hasBackend = Test-Path -LiteralPath $backendEnv
if ($hasRoot -and $hasBackend) {
  Write-Host 'فایل‌های تنظیمات موجودند؛ هیچ رمز یا کلیدی تغییر نکرد.'
  return
}
if ($hasRoot -or $hasBackend) {
  throw 'تنظیمات ناقص است. برای جلوگیری از ساخت کلید یا رمز ناسازگار، فایل مفقود را با مقادیر فایل موجود پیکربندی کنید. هیچ فایل موجودی تغییر نکرد.'
}

function New-Secret([int]$bytes = 48) {
  $buf = New-Object byte[] $bytes
  [System.Security.Cryptography.RandomNumberGenerator]::Fill($buf)
  [Convert]::ToBase64String($buf).TrimEnd('=').Replace('+', 'a').Replace('/', 'b')
}

function New-Password {
  $lower = 'abcdefghjkmnpqrstuvwxyz'
  $upper = 'ABCDEFGHJKMNPQRSTUVWXYZ'
  $digits = '23456789'
  $symbols = '!@%^&*-_=+'  # بدون $ و # (Docker Compose و dotenv آن‌ها را تفسیر می‌کنند)
  $all = $lower + $upper + $digits + $symbols
  $chars = @($lower[[Security.Cryptography.RandomNumberGenerator]::GetInt32($lower.Length)],
    $upper[[Security.Cryptography.RandomNumberGenerator]::GetInt32($upper.Length)],
    $digits[[Security.Cryptography.RandomNumberGenerator]::GetInt32($digits.Length)],
    $symbols[[Security.Cryptography.RandomNumberGenerator]::GetInt32($symbols.Length)])
  1..20 | ForEach-Object { $chars += $all[[Security.Cryptography.RandomNumberGenerator]::GetInt32($all.Length)] }
  for ($i = $chars.Length - 1; $i -gt 0; $i--) {
    $j = [Security.Cryptography.RandomNumberGenerator]::GetInt32($i + 1)
    $chars[$i], $chars[$j] = $chars[$j], $chars[$i]
  }
  -join $chars
}

$values = @{
  POSTGRES_PASSWORD      = New-Secret 24
  JWT_ACCESS_SECRET      = New-Secret
  JWT_REFRESH_SECRET     = New-Secret
  BACKUP_ENCRYPTION_KEY  = New-Secret
  ADMIN_PASSWORD         = New-Password
  DEMO_PASSWORD_ALI      = New-Password
  DEMO_PASSWORD_MARYAM   = New-Password
}

if (-not (Test-Path $rootEnv)) {
  $lines = @(
    '# ساخته‌شده توسط generate-secrets.ps1 — هرگز وارد مخزن کد نشود',
    "POSTGRES_PASSWORD=$($values.POSTGRES_PASSWORD)",
    "JWT_ACCESS_SECRET=$($values.JWT_ACCESS_SECRET)",
    "JWT_REFRESH_SECRET=$($values.JWT_REFRESH_SECRET)",
    "BACKUP_ENCRYPTION_KEY=$($values.BACKUP_ENCRYPTION_KEY)",
    "ADMIN_PASSWORD=$($values.ADMIN_PASSWORD)"
  )
  Set-Content -Path $rootEnv -Value $lines -Encoding UTF8
  Write-Host "ساخته شد: $rootEnv"
} else {
  Write-Host "فایل از قبل وجود دارد (تغییری نکرد): $rootEnv"
}

if (-not (Test-Path $backendEnv)) {
  $content = Get-Content $backendExample -Encoding UTF8
  $map = @{
    'JWT_ACCESS_SECRET'     = $values.JWT_ACCESS_SECRET
    'JWT_REFRESH_SECRET'    = $values.JWT_REFRESH_SECRET
    'BACKUP_ENCRYPTION_KEY' = $values.BACKUP_ENCRYPTION_KEY
    'ADMIN_PASSWORD'        = $values.ADMIN_PASSWORD
    'DEMO_PASSWORD_ALI'     = $values.DEMO_PASSWORD_ALI
    'DEMO_PASSWORD_MARYAM'  = $values.DEMO_PASSWORD_MARYAM
  }
  $out = foreach ($line in $content) {
    $replaced = $line
    foreach ($k in $map.Keys) {
      if ($line -match "^$k=") { $replaced = "$k=$($map[$k])" }
    }
    if ($line -match '^DATABASE_URL=') {
      $replaced = "DATABASE_URL=postgresql://sana:$($values.POSTGRES_PASSWORD)@localhost:5433/sana_hrms?schema=public"
    }
    $replaced
  }
  Set-Content -Path $backendEnv -Value $out -Encoding UTF8
  Write-Host "ساخته شد: $backendEnv"
} else {
  Write-Host "فایل از قبل وجود دارد (تغییری نکرد): $backendEnv"
}

Write-Host ''
Write-Host 'تنظیمات ساخته شد. رمز اولیه فقط در فایل‌های محلی .env است و در خروجی چاپ نمی‌شود.'
