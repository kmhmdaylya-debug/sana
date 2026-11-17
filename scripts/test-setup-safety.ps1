$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$temporaryRoot = Join-Path $root 'backend/tmp'
$fixture = Join-Path $temporaryRoot ('setup-audit-' + [Guid]::NewGuid().ToString('N'))
$source = Join-Path $PSScriptRoot 'generate-secrets.ps1'

function Assert-True([bool]$Condition, [string]$Message) {
  if (-not $Condition) { throw $Message }
}

function New-Case([string]$Name) {
  $directory = Join-Path $fixture $Name
  New-Item -ItemType Directory -Path (Join-Path $directory 'scripts'), (Join-Path $directory 'backend') -Force | Out-Null
  Copy-Item -LiteralPath $source -Destination (Join-Path $directory 'scripts/generate-secrets.ps1')
  Copy-Item -LiteralPath (Join-Path $root 'backend/.env.example') -Destination (Join-Path $directory 'backend/.env.example')
  return $directory
}

try {
  New-Item -ItemType Directory -Path $fixture | Out-Null
  $fresh = New-Case 'fresh'
  $output = & (Join-Path $fresh 'scripts/generate-secrets.ps1') 6>&1 | Out-String
  Assert-True (Test-Path -LiteralPath (Join-Path $fresh '.env')) 'Fresh setup did not create root settings'
  Assert-True (Test-Path -LiteralPath (Join-Path $fresh 'backend/.env')) 'Fresh setup did not create backend settings'
  $verification = @'
const fs=require('fs'),path=require('path');
const {parse}=require(path.join(process.argv[2],'backend/node_modules/dotenv'));
const root=parse(fs.readFileSync(path.join(process.argv[1],'.env')));
const backend=parse(fs.readFileSync(path.join(process.argv[1],'backend/.env')));
for(const key of ['JWT_ACCESS_SECRET','JWT_REFRESH_SECRET','BACKUP_ENCRYPTION_KEY','ADMIN_PASSWORD']) {
 if(!root[key] || root[key]!==backend[key])throw Error('Generated settings disagree');
}
if(new URL(backend.DATABASE_URL).password!==root.POSTGRES_PASSWORD)throw Error('Database password mismatch');
if(!/[a-z]/.test(root.ADMIN_PASSWORD)||!/[A-Z]/.test(root.ADMIN_PASSWORD)||!/[0-9]/.test(root.ADMIN_PASSWORD)||root.ADMIN_PASSWORD.length<20)throw Error('Weak generated password');
process.stdout.write('PASS: fresh settings are consistent and nondefault.');
'@
  & node -e $verification $fresh $root
  if ($LASTEXITCODE -ne 0) { throw 'Generated configuration check failed' }
  foreach ($line in Get-Content -LiteralPath (Join-Path $fresh '.env')) {
    if ($line -match '^[A-Z_]+=(.+)$') { Assert-True (-not $output.Contains($Matches[1])) 'A generated secret appeared in output' }
  }
  $beforeRoot = (Get-FileHash -LiteralPath (Join-Path $fresh '.env')).Hash
  $beforeBackend = (Get-FileHash -LiteralPath (Join-Path $fresh 'backend/.env')).Hash
  & (Join-Path $fresh 'scripts/generate-secrets.ps1') | Out-Null
  Assert-True ((Get-FileHash -LiteralPath (Join-Path $fresh '.env')).Hash -eq $beforeRoot) 'Existing root settings were changed'
  Assert-True ((Get-FileHash -LiteralPath (Join-Path $fresh 'backend/.env')).Hash -eq $beforeBackend) 'Existing backend settings were changed'
  Write-Output 'PASS: repeated initialization leaves existing settings unchanged.'

  $partial = New-Case 'partial'
  [IO.File]::WriteAllText((Join-Path $partial '.env'), 'SYNTHETIC_TEST=preserve-existing-settings')
  $hash = (Get-FileHash -LiteralPath (Join-Path $partial '.env')).Hash
  $refused = $false
  try { & (Join-Path $partial 'scripts/generate-secrets.ps1') | Out-Null } catch { $refused = $true }
  Assert-True $refused 'Partial settings were not rejected'
  Assert-True (-not (Test-Path -LiteralPath (Join-Path $partial 'backend/.env'))) 'Partial setup generated incompatible settings'
  Assert-True ((Get-FileHash -LiteralPath (Join-Path $partial '.env')).Hash -eq $hash) 'Partial setup changed existing settings'
  Write-Output 'PASS: partial settings fail closed without changing existing secrets.'
} finally {
  $absolute = [IO.Path]::GetFullPath($fixture)
  $parent = [IO.Path]::GetFullPath($temporaryRoot)
  if ([IO.Path]::GetDirectoryName($absolute) -ne $parent -or [IO.Path]::GetFileName($absolute) -notmatch '^setup-audit-[a-f0-9]{32}$') { throw 'Unsafe fixture cleanup path' }
  if (Test-Path -LiteralPath $absolute) { Remove-Item -LiteralPath $absolute -Recurse -Force }
}
