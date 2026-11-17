param([string]$DockerPath = 'docker')

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$project = 'sana-audit-' + [Guid]::NewGuid().ToString('N').Substring(0, 8)
if ($project -notmatch '^sana-audit-[a-f0-9]{8}$') { throw 'Unsafe test project name' }
$composeArgs = @('compose', '-p', $project, '-f', (Join-Path $root 'docker-compose.yml'), '-f', (Join-Path $root 'docker-compose.audit.yml'))
$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
$listener.Start()
$port = $listener.LocalEndpoint.Port
$listener.Stop()
$names = @('AUDIT_PROJECT', 'AUDIT_HTTP_PORT', 'POSTGRES_PASSWORD', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'BACKUP_ENCRYPTION_KEY', 'ADMIN_PASSWORD')
$previous = @{}
foreach ($name in $names) { $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }

function New-AuditSecret {
  return [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
}

function Invoke-AuditCompose {
  param([string[]]$Arguments)
  & $DockerPath @composeArgs @Arguments
  if ($LASTEXITCODE -ne 0) { throw 'Isolated Compose command failed' }
}

try {
  $env:AUDIT_PROJECT = $project
  $env:AUDIT_HTTP_PORT = [string]$port
  $env:POSTGRES_PASSWORD = New-AuditSecret
  $env:JWT_ACCESS_SECRET = New-AuditSecret
  $env:JWT_REFRESH_SECRET = New-AuditSecret
  $env:BACKUP_ENCRYPTION_KEY = New-AuditSecret
  $env:ADMIN_PASSWORD = 'Aa7!' + (New-AuditSecret)
  Write-Output "Isolated Compose project: $project"
  Invoke-AuditCompose -Arguments @('config', '--quiet')
  Invoke-AuditCompose -Arguments @('build')
  Invoke-AuditCompose -Arguments @('up', '-d', '--wait', '--wait-timeout', '180')

  $dbName = & $DockerPath @composeArgs exec -T backend node -e 'process.stdout.write(new URL(process.env.DATABASE_URL).pathname)'
  if ($LASTEXITCODE -ne 0 -or $dbName.Trim() -ne '/sana_audit_compose') { throw 'Refusing bootstrap outside the isolated audit database' }
  Invoke-AuditCompose -Arguments @('exec', '-T', 'backend', 'npm', 'run', 'db:seed')
  $dumpVersion = & $DockerPath @composeArgs exec -T backend pg_dump --version
  if ($LASTEXITCODE -ne 0 -or $dumpVersion -notmatch 'PostgreSQL\) 16\.') { throw 'Backup client major version differs from the test database' }
  Invoke-AuditCompose -Arguments @('exec', '-T', 'db', 'createdb', '-U', 'sana', 'sana_restore_compose')

  $base = "http://127.0.0.1:$port"
  $health = Invoke-WebRequest -Uri "$base/api/v1/health" -TimeoutSec 15
  if ($health.StatusCode -ne 200) { throw 'Compose readiness failed' }
  $page = Invoke-WebRequest -Uri "$base/login" -TimeoutSec 15
  if ($page.StatusCode -ne 200 -or $page.Content -notmatch 'id="root"') { throw 'Compose frontend response failed' }
  $credentials = @{ username = 'audit.admin'; password = $env:ADMIN_PASSWORD } | ConvertTo-Json
  $login = Invoke-RestMethod -Uri "$base/api/v1/auth/login" -Method Post -ContentType 'application/json' -Body $credentials
  $payload = if ($login.data) { $login.data } else { $login }
  if (-not $payload.accessToken) { throw 'Synthetic Compose login failed' }
  $headers = @{ Authorization = 'Bearer ' + $payload.accessToken }
  $profile = Invoke-WebRequest -Uri "$base/api/v1/auth/me" -Headers $headers -TimeoutSec 15
  if ($profile.StatusCode -ne 200) { throw 'Compose authenticated API failed' }
  $backup = Invoke-RestMethod -Uri "$base/api/v1/backup/run" -Method Post -Headers $headers -TimeoutSec 120
  $backupRow = if ($backup.data) { $backup.data } else { $backup }
  if ($backupRow.result -ne 'SUCCESS' -or $backupRow.size -le 0) { throw 'Compose encrypted backup failed' }
  $download = Invoke-WebRequest -Uri "$base/api/v1/backup/$($backupRow.id)/download" -Headers $headers -TimeoutSec 60
  if ($download.StatusCode -ne 200 -or $download.RawContentLength -ne $backupRow.size) { throw 'Compose archive download failed' }
  $restoreBody = @{ backupId = $backupRow.id; currentPassword = $env:ADMIN_PASSWORD; confirmationDatabase = 'sana_restore_compose' } | ConvertTo-Json
  $restore = Invoke-RestMethod -Uri "$base/api/v1/backup/restore" -Method Post -Headers $headers -ContentType 'application/json' -Body $restoreBody -TimeoutSec 180
  if ($restore.data.database -ne 'sana_restore_compose' -or -not $restore.data.safetyBackupId) { throw 'Compose staging restore failed' }
  $verify = 'const {PrismaClient}=require("@prisma/client"); const p=new PrismaClient({datasources:{db:{url:process.env.BACKUP_RESTORE_DATABASE_URL}},log:[]}); (async()=>{try{if(await p.user.count()!==1||await p.userSession.count({where:{revokedAt:null}})!==0)throw Error("Invalid restored data");console.log("PASS: Docker restore contains the synthetic administrator and no active copied sessions.")}finally{await p.$disconnect()}})().catch(()=>{console.error("Restore verification failed");process.exitCode=1})'
  Invoke-AuditCompose -Arguments @('exec', '-T', 'backend', 'node', '-e', $verify)
  $again = Invoke-WebRequest -Uri "$base/api/v1/backup/restore" -Method Post -Headers $headers -ContentType 'application/json' -Body $restoreBody -SkipHttpErrorCheck -TimeoutSec 30
  if ($again.StatusCode -ne 400) { throw 'Nonempty restore target was not protected' }
  Invoke-WebRequest -Uri "$base/api/v1/auth/logout" -Method Post -Headers $headers -TimeoutSec 15 | Out-Null
  $revoked = Invoke-WebRequest -Uri "$base/api/v1/auth/me" -Headers $headers -SkipHttpErrorCheck -TimeoutSec 15
  if ($revoked.StatusCode -ne 401) { throw 'Compose Bearer-only logout did not revoke the session' }
  Write-Output 'PASS: isolated Compose build, migrations, health, frontend, bootstrap, login, authenticated API, encrypted backup/download, staging restore and logout revocation.'
} finally {
  try {
    if ($project -notmatch '^sana-audit-[a-f0-9]{8}$') { throw 'Unsafe cleanup project' }
    # Only this randomly named audit project and its synthetic volumes are removed.
    Invoke-AuditCompose -Arguments @('down', '--volumes', '--remove-orphans')
  } finally {
    foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
  }
}
