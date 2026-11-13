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
  $chars = @($lower[(Get-Random -Maximum $lower.Length)], $upper[(Get-Random -Maximum $upper.Length)],
             $digits[(Get-Random -Maximum $digits.Length)], $symbols[(Get-Random -Maximum $symbols.Length)])
  1..12 | ForEach-Object { $chars += $all[(Get-Random -Maximum $all.Length)] }
  -join ($chars | Sort-Object { Get-Random })
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
Write-Host 'رمز مدیر اولیه (ADMIN_PASSWORD) را یادداشت کنید:' -ForegroundColor Yellow
Write-Host $values.ADMIN_PASSWORD
