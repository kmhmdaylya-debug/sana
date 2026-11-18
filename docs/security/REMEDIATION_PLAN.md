# Sana HRMS - Security Vulnerability Remediation Plan

**Version:** 1.0  
**Date:** 2026-11-18  
**Based on:** HIGH_CRITICAL_VULNERABILITY_AUDIT.md  
**Target:** Eliminate all Critical and High vulnerabilities  

---

## 1. Remediation Phases Overview

| Phase | Focus | Duration | Vulnerabilities |
|-------|-------|----------|-----------------|
| **Phase 1** | Critical Dependency Upgrades | Day 1 | SEC-CRIT-01, SEC-CRIT-02, SEC-CRIT-03 |
| **Phase 2** | Authentication Token Security | Day 1-2 | SEC-HIGH-01, SEC-HIGH-02 |
| **Phase 3** | Authorization & Tenant Isolation | Day 2-3 | SEC-HIGH-03, SEC-HIGH-04, SEC-HIGH-05 |
| **Phase 4** | Injection & File Handling | Day 3-4 | SEC-HIGH-06, SEC-HIGH-07 |
| **Phase 5** | Browser Security, Rate Limiting, Secrets, Audit | Day 4-5 | SEC-HIGH-08 through SEC-HIGH-11 |
| **Phase 6** | Medium Vulnerabilities | Week 2 | SEC-MED-01 through SEC-MED-08 |
| **Phase 7** | Security Regression Tests | Week 2 | All fixed vulnerabilities |
| **Phase 8** | Full Verification & Penetration Test | Week 2 | Complete test suite |

---

## 2. Phase 1: Critical Dependency Upgrades (Day 1)

### 1.1 Frontend: Upgrade Vite to ≥ 6.3.0
**Vulnerabilities:** SEC-CRIT-01 (picomatch ReDoS)

**Actions:**
```bash
cd frontend
npm update vite@latest
npm audit fix
```

**Breaking Changes to Address:**
- Vite 6.x config changes
- Plugin API updates
- CSS handling changes

**Verification:**
- `npm run build` succeeds
- `npm audit` shows 0 critical/high
- Frontend loads correctly in browser
- All existing tests pass

### 1.2 Backend: Upgrade @nestjs/cli to ≥ 12.0.13
**Vulnerabilities:** SEC-CRIT-01, SEC-CRIT-02, SEC-CRIT-03 (picomatch, minimatch, glob)

**Actions:**
```bash
cd backend
npm update @nestjs/cli@latest @nestjs/schematics@latest
npm audit fix
```

**Breaking Changes to Address:**
- NestJS 11 → 12 migration (if applicable)
- CLI command changes
- Schematics updates

**Verification:**
- `npm run build` succeeds
- `npm audit` shows 0 critical/high
- All unit tests pass
- Application starts without errors

### 1.3 Shared: Update @typescript-eslint to Latest
**Vulnerabilities:** SEC-CRIT-02 (minimatch), SEC-LOW-01

**Actions:**
```bash
cd backend
npm update @typescript-eslint/eslint-plugin @typescript-eslint/parser @typescript-eslint/utils @typescript-eslint/type-utils
cd ../frontend
npm update @typescript-eslint/eslint-plugin @typescript-eslint/parser
```

**Verification:**
- `npm run lint` passes
- `npm run build` passes
- TypeScript compilation clean

---

## 3. Phase 2: Authentication Token Security (Day 1-2)

### 3.1 Fix SEC-HIGH-01: Reduce Refresh Token Grace Period
**File:** `backend/src/auth/auth.service.ts`

**Current Code (lines 236-267):**
```typescript
const graceSeconds = Math.max(
  0,
  Math.min(
    15,
    this.config.get<number>("app.jwt.refreshGraceSeconds") ?? 15,
  ),
);
```

**Fix:**
```typescript
const graceSeconds = Math.max(
  0,
  Math.min(
    5,  // Reduced from 15 to 5 seconds
    this.config.get<number>("app.jwt.refreshGraceSeconds") ?? 5,
  ),
);
```

**Config Update:** `backend/src/common/config/configuration.ts` line 69
```typescript
refreshGraceSeconds: parseInt(process.env.JWT_REFRESH_GRACE_SECONDS ?? '5', 10),
```

**Verification Test:**
```typescript
// Test concurrent refresh requests
// 1. Login, get refresh token
// 2. Make 2 concurrent refresh requests with same token
// 3. Verify only first succeeds, second gets 401
```

### 3.2 Fix SEC-HIGH-02: Invalidate Access Tokens on Password Change
**File:** `backend/src/auth/auth.service.ts`

**Add Access Token Blocklist:**
```typescript
// New method in AuthService
private async addToAccessTokenBlocklist(tokenId: string, expiresAt: Date) {
  await this.prisma.accessTokenBlocklist.create({
    data: { tokenId, expiresAt }
  });
}

// In changePassword, after revoking refresh tokens:
const accessTokenIds = await this.getActiveAccessTokenIds(userId);
for (const tokenId of accessTokenIds) {
  await this.addToAccessTokenBlocklist(tokenId, new Date(Date.now() + 5 * 60 * 1000));
}
```

**Update JwtStrategy.validate to Check Blocklist:**
```typescript
// In jwt.strategy.ts validate()
const blocked = await this.prisma.accessTokenBlocklist.findUnique({
  where: { tokenId: payload.jti }
});
if (blocked) throw new UnauthorizedException('Token revoked');
```

**Required Schema Change:**
```prisma
model AccessTokenBlocklist {
  tokenId   String   @id
  expiresAt DateTime
  createdAt DateTime @default(now())
  @@index([expiresAt])
}
```

**Verification Test:**
- Change password with valid access token
- Verify old access token rejected on next API call

---

## 4. Phase 3: Authorization & Tenant Isolation (Day 2-3)

### 4.1 Fix SEC-HIGH-03: Document Download Confidentiality Check
**File:** `backend/src/documents/documents.service.ts:262-289`

**Current Issue:** `downloadVersion` only checks `canReadDocument` and `canAccessEmployee`

**Fix:** Add explicit confidentiality validation matching `get` endpoint:
```typescript
async downloadVersion(versionId: string, user: AuthenticatedUser) {
  const version = await this.prisma.employeeDocumentVersion.findUnique({
    where: { id: versionId },
    include: { document: { include: { employee: true } } },
  });
  if (!version || version.document.deletedAt) throw new NotFoundException('نسخه مدرک یافت نشد.');

  // Enhanced check - mirrors get() logic
  if (!this.canReadDocument(version.document, user)) {
    throw new ForbiddenException('این مدرک محرمانه است و دسترسی به آن ندارید.');
  }
  const ok = await this.access.canAccessEmployee(user, version.document.employeeId);
  if (!ok) throw new ForbiddenException('به مدارک این نیرو دسترسی ندارید.');

  // ... rest unchanged
}
```

**Verification Test:**
- Create confidential document (CONFIDENTIALITY=HIGH)
- User with `DOCUMENTS_VIEW` but without `EMPLOYEES_VIEW_SENSITIVE`
- Attempt download → verify 403 Forbidden

### 4.2 Fix SEC-HIGH-04: Payroll Component Company Validation
**File:** `backend/src/payroll/payroll.service.ts:97-102`

**Current Issue:** `query.companyId` used directly without validation

**Fix:**
```typescript
async listComponents(query: PayComponentQueryDto, pagination: PaginationDto, user: AuthenticatedUser) {
  const allowed = await this.allowedCompanyIds(user);
  
  // Validate query.companyId if provided
  if (query.companyId && allowed !== null && !allowed.includes(query.companyId)) {
    throw new ForbiddenException('به این شرکت دسترسی ندارید.');
  }
  
  const where: Prisma.PayComponentWhereInput = {
    AND: [allowed === null ? {} : { companyId: { in: allowed } }],
    // ... rest
  };
  // ...
}
```

**Apply Same Pattern to All Payroll List Methods:**
- `listRules`, `listPeriods`, `listAmendments`, `listPayslips`, `comparePeriods`, `report`

**Verification Test:**
- User with access to Company A only
- Query with `companyId=CompanyB` → verify 403

### 4.3 Fix SEC-HIGH-05: Attendance Device Creation Cross-Company Validation
**File:** `backend/src/attendance/attendance.service.ts:142-149`

**Current Issue:** References validated after company check but before creation

**Fix:** Wrap in transaction with validation first:
```typescript
async createDevice(dto: CreateDeviceDto, user: AuthenticatedUser) {
  await this.access.assertCompanyAccess(user, dto.companyId);
  await this.access.assertEmployeeRelations(dto.companyId, dto);
  
  // Validate all references belong to same company
  if (dto.branchId) {
    const branch = await this.prisma.branch.findUnique({ where: { id: dto.branchId } });
    if (!branch || branch.companyId !== dto.companyId) throw new BadRequestException('شعبه نامعتبر');
  }
  // ... similar for orgUnitId
  
  return this.prisma.$transaction(async (db) => {
    const duplicate = await db.attendanceDevice.findUnique({ where: { code: dto.code } });
    if (duplicate) throw new BadRequestException('کد دستگاه تکراری است.');
    // ... create
  });
}
```

**Verification Test:**
- User with Company A access
- Create device with `companyId=CompanyA` but `branchId=CompanyB-branch`
- Verify 400 Bad Request

---

## 5. Phase 4: Injection & File Handling (Day 3-4)

### 5.1 Fix SEC-HIGH-06: Unsafe $queryRaw in User Locking
**File:** `backend/src/auth/auth.service.ts:647-649`

**Current:**
```typescript
private async lockUser(db: Prisma.TransactionClient, id: string) {
  await db.$queryRaw`SELECT id FROM "User" WHERE id = ${id}::uuid FOR UPDATE`;
}
```

**Fix:** Use Prisma's built-in locking:
```typescript
private async lockUser(db: Prisma.TransactionClient, id: string) {
  await db.user.findUniqueOrThrow({
    where: { id },
    // Prisma doesn't have explicit FOR UPDATE, but findUnique in transaction is sufficient
  });
  // For true row locking, use:
  await db.$executeRaw`SELECT id FROM "User" WHERE id = ${id}::uuid FOR UPDATE`;
}
```

**Better Fix - Parameterized:**
```typescript
private async lockUser(db: Prisma.TransactionClient, id: string) {
  await db.$executeRaw`SELECT id FROM "User" WHERE id = ${id}::uuid FOR UPDATE`;
}
```

**Verification Test:**
- Attempt with SQL injection payload in ID → verify safe rejection
- Verify concurrent login handling still works

### 5.2 Fix SEC-HIGH-07: Path Traversal in Document File Resolution
**File:** `backend/src/documents/documents.service.ts:358-372`

**Current Issue:** Regex allows limited traversal

**Fix:** Strengthen path validation:
```typescript
private resolveDocumentFile(storedPath: string): string {
  // Strict validation: only alphanumeric, underscore, hyphen, dot
  if (!/^documents\/[a-zA-Z0-9_.-]+$/.test(storedPath)) {
    throw new NotFoundException('فایل معتبر یافت نشد.');
  }
  
  // Prevent directory traversal
  const normalized = path.normalize(storedPath);
  if (normalized !== storedPath || normalized.startsWith('..') || path.isAbsolute(normalized)) {
    throw new NotFoundException('فایل معتبر یافت نشد.');
  }
  
  const candidate = path.resolve(UPLOAD_ROOT, normalized);
  const uploadRootReal = fs.realpathSync(UPLOAD_ROOT);
  const candidateReal = fs.realpathSync(candidate);
  
  // Ensure file is within upload directory
  const relative = path.relative(uploadRootReal, candidateReal);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new NotFoundException('فایل معتبر یافت نشد.');
  }
  
  if (!fs.existsSync(candidateReal)) throw new NotFoundException('فایل یافت نشد.');
  const stat = fs.statSync(candidateReal);
  if (!stat.isFile() || stat.size > MAX_SIZE) throw new NotFoundException('فایل معتبر یافت نشد.');
  
  return candidateReal;
}
```

**Verification Test:**
- Attempt download with `storedPath=documents/../../etc/passwd` → 404
- Attempt with `documents/../other-file` → 404
- Valid file download still works

---

## 6. Phase 5: Browser Security, Rate Limiting, Secrets, Audit (Day 4-5)

### 6.1 Fix SEC-HIGH-08: CSRF Protection for Cookie Auth
**Files:** `backend/src/main.ts`, `backend/src/auth/auth.controller.ts`

**Option A: Double-Submit Cookie Pattern**
```typescript
// In main.ts - add CSRF middleware
import * as csrf from 'csurf';
app.use(csrf({ cookie: { httpOnly: true, sameSite: 'lax', secure: true } }));

// In auth.controller.ts - exempt GET endpoints, protect POST
@Post('login')
@UseGuards(CsrfGuard) // Custom guard to validate CSRF token
```

**Option B: SameSite=Strict for Auth Cookies (Simpler)**
```typescript
// In auth.service.ts setRefreshCookie()
private setRefreshCookie(response: Response, token: string, rememberMe: boolean, expiresAt = this.refreshExpiry(rememberMe)): void {
  response.cookie('refresh_token', token, {
    httpOnly: true,
    secure: this.config.get<string>('app.env') === 'production',
    sameSite: 'strict',  // Changed from 'lax'
    path: '/',
    maxAge: Math.max(0, expiresAt.getTime() - Date.now()),
  });
}
```

**Recommendation:** Use Option B (SameSite=Strict) for immediate fix; implement Option A for defense in depth.

**Verification Test:**
- Create malicious page that auto-submits login form
- Verify login fails with 403 (CSRF token missing)

### 6.2 Fix SEC-HIGH-09: Rate Limiting on All Sensitive Endpoints
**File:** `backend/src/auth/auth.controller.ts`

**Add Throttling:**
```typescript
@Public()
@Post('logout')
@Throttle({ default: { limit: 10, ttl: 60000 } })  // NEW
@HttpCode(HttpStatus.OK)
async logout(...) { ... }

@Post('change-password')
@Throttle({ default: { limit: 5, ttl: 300000 } })  // NEW: 5 per 5 minutes
@HttpCode(HttpStatus.OK)
changePassword(...) { ... }

@Post('logout-all')
@Throttle({ default: { limit: 3, ttl: 300000 } })  // NEW
@HttpCode(HttpStatus.OK)
logoutAll(...) { ... }
```

**Add Throttling to Admin Endpoints:**
```typescript
// In users.controller.ts, roles.controller.ts, settings.controller.ts
@Throttle({ default: { limit: 20, ttl: 60000 } })
@Controller('users')
export class UsersController { ... }
```

**Verification Test:**
- Exceed limits on each endpoint → verify 429 Too Many Requests
- Verify limits reset after TTL

### 6.3 Fix SEC-HIGH-10: Secret Entropy Validation
**File:** `backend/src/common/config/configuration.ts`

**Enhance `requiredSecret`:**
```typescript
function requiredSecret(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  if (/CHANGE_ME|dev-only/i.test(value)) {
    throw new Error(`${name} has default value`);
  }
  if (value.length < 32) {
    throw new Error(`${name} too short`);
  }
  
  // Entropy estimation (Shannon entropy)
  const entropy = calculateEntropy(value);
  if (entropy < 3.5) {  // bits per character
    console.warn(`WARNING: ${name} has low entropy (${entropy.toFixed(2)} bits/char). Use a stronger secret.`);
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`${name} has insufficient entropy for production`);
    }
  }
  
  return value;
}

function calculateEntropy(str: string): number {
  const freq: Record<string, number> = {};
  for (const char of str) freq[char] = (freq[char] || 0) + 1;
  let entropy = 0;
  const len = str.length;
  for (const count of Object.values(freq)) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}
```

**Verification Test:**
- Set `JWT_ACCESS_SECRET=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa` (low entropy)
- Start app in production → verify error
- Set strong random secret → verify startup success

### 6.4 Fix SEC-HIGH-11: Audit Logging Failure Handling
**File:** `backend/src/common/audit/audit.service.ts`

**Current:** Silent failure for non-sensitive operations

**Fix:** Make audit failure behavior configurable:
```typescript
// Add config option
audit: {
  failOpen: process.env.AUDIT_FAIL_OPEN !== 'false', // default true for non-sensitive
  alertOnFailure: true,
}

// In record()
} catch (e) {
  try {
    await this.prisma.auditOutbox.create({ ... });
  } catch {
    this.logger.error('Audit write failed', e);
    if ([AuditAction.VIEW_SENSITIVE, AuditAction.EXPORT, AuditAction.DOWNLOAD, AuditAction.BACKUP, AuditAction.RESTORE].includes(entry.action)) {
      throw new ServiceUnavailableException('Audit logging failed; sensitive operation blocked');
    }
    if (!this.config.get('app.audit.failOpen')) {
      throw new ServiceUnavailableException('Audit logging failed; operation blocked');
    }
    // Log but continue for non-sensitive
    this.logger.warn('Audit write failed; continuing (fail-open mode)');
  }
}
```

**Add Alerting Integration:**
```typescript
// In catch block
if (this.config.get('app.audit.alertOnFailure')) {
  await this.notifications.notifyAdmins({
    title: 'Audit Logging Failure',
    body: `Failed to record ${entry.action} on ${entry.entity}`,
    severity: 'CRITICAL'
  });
}
```

**Verification Test:**
- Mock Prisma to throw on `auditLog.create`
- Call sensitive endpoint (VIEW_SENSITIVE) → verify 503
- Call non-sensitive endpoint → verify success with warning log

---

## 7. Phase 6: Medium Vulnerabilities (Week 2)

### 7.1 SEC-MED-01: JWT Algorithm Confusion Tests
**File:** `backend/src/auth/auth.security.spec.ts` (new)

```typescript
describe('JWT Algorithm Confusion', () => {
  it('rejects "none" algorithm token', async () => {
    const noneToken = createNoneAlgorithmToken({ sub: 'user-id', type: 'access' });
    await expect(jwtStrategy.validate(noneToken)).rejects.toThrow(UnauthorizedException);
  });
  
  it('rejects RS256 token when HS256 expected', async () => {
    const rs256Token = createRS256Token({ sub: 'user-id', type: 'access' });
    await expect(jwtStrategy.validate(rs256Token)).rejects.toThrow(UnauthorizedException);
  });
});
```

### 7.2 SEC-MED-02: CORS Origin Validation
**File:** `backend/src/main.ts`

```typescript
const corsOrigins = config.get<string[]>('app.corsOrigins') ?? [];
if (config.get<string>('app.env') === 'production') {
  // Validate no wildcards, no localhost
  for (const origin of corsOrigins) {
    if (origin === '*' || origin.includes('localhost') || origin.includes('127.0.0.1')) {
      throw new Error(`Invalid CORS origin for production: ${origin}`);
    }
  }
}
```

### 7.3 SEC-MED-03: Mandatory Antivirus Scan
**File:** `backend/src/documents/documents.service.ts:80-85`

```typescript
try {
  await scanFileForViruses(fullPath, this.config);
} catch (error) {
  await fs.promises.unlink(fullPath).catch(() => undefined);
  if (this.config.get('app.env') === 'production') {
    throw new BadRequestException('فایل آپلودی بررسی امنیتی نشد؛ آپلود لغو شد.');
  }
  throw error;
}
```

### 7.4 SEC-MED-04: Cumulative Role Permission Validation
**File:** `backend/src/common/access/access.service.ts:310-319`

```typescript
async assertGrantableRoles(actor: AuthenticatedUser, roleIds: string[]): Promise<void> {
  // ... existing checks ...
  
  // Check cumulative permissions
  const newPermissions = new Set<string>();
  for (const role of roles) {
    for (const rp of role.rolePermissions) {
      newPermissions.add(rp.permission.code);
    }
  }
  
  const combinedPermissions = new Set([...actor.permissions, ...newPermissions]);
  // Verify no dangerous combinations
  const dangerousCombos = [
    ['users.create', 'users.manage.roles'],
    ['payroll.create', 'payroll.approve'],
  ];
  for (const [p1, p2] of dangerousCombos) {
    if (combinedPermissions.has(p1) && combinedPermissions.has(p2) && !actor.permissions.has(p1)) {
      throw new ForbiddenException(`ترکیب مجوزهای ${p1} و ${p2} نیاز به تأیید مدیر ارشد دارد.`);
    }
  }
}
```

### 7.5 SEC-MED-05: Access Token Revocation on Security Events
**Implementation:** See Phase 3.2 (AccessTokenBlocklist)

### 7.6 SEC-MED-06: Generic Error Messages in Production
**File:** `backend/src/common/filters/all-exceptions.filter.ts`

```typescript
if (status >= 500 || config.get<string>('app.env') === 'production') {
  message = 'خطای غیرمنتظره‌ای در سامانه رخ داد. لطفاً دوباره تلاش کنید.';
  errors = undefined;
}
```

### 7.7 SEC-MED-07: Webhook Signature Verification
**File:** New `backend/src/webhooks/webhook-verification.util.ts`

```typescript
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = createHmac('sha256', secret).update(payload).digest('hex');
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
```

### 7.8 SEC-MED-08: Structured Logging with Redaction
**File:** `backend/src/common/logger/redacted-logger.ts` (new)

```typescript
export class RedactedLogger {
  private static SENSITIVE_FIELDS = ['password', 'token', 'secret', 'key', 'nationalId', 'creditCard'];
  
  static redact(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    const redacted = Array.isArray(obj) ? [] : {};
    for (const [key, value] of Object.entries(obj)) {
      if (this.SENSITIVE_FIELDS.some(f => key.toLowerCase().includes(f))) {
        redacted[key] = '[REDACTED]';
      } else if (typeof value === 'object') {
        redacted[key] = this.redact(value);
      } else {
        redacted[key] = value;
      }
    }
    return redacted;
  }
}
```

---

## 8. Phase 7: Security Regression Tests (Week 2)

### 8.1 Test File Structure
```
backend/test/security/
├── auth/
│   ├── auth-bypass.spec.ts
│   ├── jwt-validation.spec.ts
│   ├── refresh-token-rotation.spec.ts
│   └── password-change.spec.ts
├── authorization/
│   ├── rbac-bypass.spec.ts
│   ├── abac-bypass.spec.ts
│   ├── idor.spec.ts
│   └── privilege-escalation.spec.ts
├── tenant-isolation/
│   ├── cross-company-access.spec.ts
│   ├── cross-branch-access.spec.ts
│   └── document-isolation.spec.ts
├── injection/
│   ├── sql-injection.spec.ts
│   ├── path-traversal.spec.ts
│   └── xss.spec.ts
├── file-handling/
│   ├── upload-restrictions.spec.ts
│   └── download-authorization.spec.ts
├── browser-security/
│   ├── csrf-protection.spec.ts
│   ├── cors-config.spec.ts
│   └── security-headers.spec.ts
├── rate-limiting/
│   └── throttle-enforcement.spec.ts
└── audit/
    └── audit-logging.spec.ts
```

### 8.2 Sample Test: IDOR Prevention
```typescript
// backend/test/security/authorization/idor.spec.ts
describe('IDOR Prevention', () => {
  let userA: AuthenticatedUser, userB: AuthenticatedUser;
  let employeeA: Employee, employeeB: Employee;
  
  beforeAll(async () => {
    // Create two users in different companies
    userA = await createTestUser({ companyId: 'company-a' });
    userB = await createTestUser({ companyId: 'company-b' });
    employeeA = await createEmployee({ companyId: 'company-a', userId: userA.id });
    employeeB = await createEmployee({ companyId: 'company-b', userId: userB.id });
  });
  
  it('prevents userA from accessing employeeB record', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/employees/${employeeB.id}`)
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .expect(403);
    
    expect(response.body.message).toContain('دسترسی ندارید');
  });
  
  it('prevents userA from downloading employeeB document', async () => {
    const doc = await createDocument({ employeeId: employeeB.id });
    const version = await uploadDocumentVersion(doc.id);
    
    await request(app.getHttpServer())
      .get(`/api/v1/documents/versions/${version.id}/download`)
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .expect(403);
  });
});
```

### 8.3 Sample Test: Refresh Token Reuse Detection
```typescript
// backend/test/security/auth/refresh-token-rotation.spec.ts
describe('Refresh Token Rotation', () => {
  it('detects and revokes family on token reuse', async () => {
    const { refreshToken } = await login(testUser);
    
    // First refresh - should succeed
    const first = await refresh(refreshToken);
    expect(first.accessToken).toBeDefined();
    
    // Second reuse of SAME refresh token - should fail
    await expect(refresh(refreshToken)).rejects.toThrow(UnauthorizedException);
    
    // Verify family revoked
    const tokens = await prisma.refreshToken.findMany({
      where: { family: first.sessionId }
    });
    expect(tokens.every(t => t.revokedAt)).toBe(true);
  });
});
```

---

## 9. Phase 8: Full Verification (Week 2)

### 9.1 Test Execution Checklist

| Test Suite | Command | Expected |
|------------|---------|----------|
| Backend Unit Tests | `cd backend && npm test` | All pass |
| Backend Integration Tests | `cd backend && npm run test:integration` | All pass |
| Frontend Unit Tests | `cd frontend && npm test` | All pass |
| E2E Tests | `cd frontend && npm run test:e2e` | All pass |
| Security Regression Tests | `cd backend && npm test -- --testPathPattern=security` | All pass |
| Dependency Audit | `cd backend && npm audit` | 0 critical/high |
| Dependency Audit | `cd frontend && npm audit` | 0 critical/high |
| Build Verification | `cd backend && npm run build` | Success |
| Build Verification | `cd frontend && npm run build` | Success |
| Docker Build | `docker compose build` | Success |

### 9.2 Penetration Test Checklist

| Area | Test | Tool/Method |
|------|------|-------------|
| Authentication | Brute force login | Custom script |
| Authentication | Token replay | Burp Suite |
| Authentication | Session fixation | Manual |
| Authorization | IDOR on all endpoints | Custom script |
| Authorization | Privilege escalation | Custom script |
| Tenant Isolation | Cross-company data access | Custom script |
| Injection | SQL injection | SQLMap |
| Injection | Path traversal | Custom script |
| File Upload | Malicious file upload | Custom script |
| File Upload | MIME type bypass | Custom script |
| CSRF | Auth endpoint CSRF | Custom script |
| Rate Limiting | Throttle bypass | Load test |
| Headers | Security header check | SecurityHeaders.com |

---

## 10. Rollback Procedures

### 10.1 Dependency Upgrades
```bash
# If breaking changes cause issues:
cd backend
git stash  # or revert package-lock.json
npm install
npm run build
```

### 10.2 Database Schema Changes (AccessTokenBlocklist)
```bash
# Rollback migration
cd backend
npx prisma migrate reset --force  # DANGEROUS - only in dev
# Or create down migration:
npx prisma migrate diff --from-migrations --to-schema-datamodel --script > down.sql
```

### 10.3 Configuration Changes
```bash
# Revert config
git checkout backend/src/common/config/configuration.ts
git checkout backend/src/auth/auth.service.ts
# Restart services
docker compose restart backend
```

---

## 11. Success Criteria

| Criterion | Target |
|-----------|--------|
| Critical vulnerabilities fixed | 3/3 (100%) |
| High vulnerabilities fixed | 11/11 (100%) |
| Medium vulnerabilities fixed | 8/8 (100%) |
| Dependency audit clean | 0 critical/high |
| All tests passing | 100% |
| Security regression tests | 100% coverage of fixes |
| Penetration test | No critical/high findings |
| Production build | Successful |
| No regressions | All existing functionality works |

---

## 12. Documentation Deliverables

| Document | Location | Status |
|----------|----------|--------|
| Vulnerability Audit | `docs/security/HIGH_CRITICAL_VULNERABILITY_AUDIT.md` | ✅ |
| Remediation Plan | `docs/security/REMEDIATION_PLAN.md` | ✅ |
| Regression Tests | `docs/security/SECURITY_REGRESSION_TESTS.md` | Pending |
| Test Execution Guide | `docs/security/SECURITY_TEST_EXECUTION.md` | Pending |
| Fixed Vulnerabilities | `docs/security/FIXED_VULNERABILITIES.md` | Pending |
| Remaining Risks | `docs/security/REMAINING_SECURITY_RISKS.md` | Pending |
| Final Report | `docs/security/FINAL_REMEDIATION_REPORT.md` | Pending |

---

**Plan Version:** 1.0  
**Status:** READY FOR EXECUTION  
**Next Step:** Begin Phase 1 - Dependency Upgrades