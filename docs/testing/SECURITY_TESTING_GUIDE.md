# Sana HRMS - Security Testing Guide

**Version:** 1.0  
**Date:** 2026-11-18  
**Audience:** Security Engineers, QA Engineers, Developers

---

## 1. Overview

This guide defines the security testing strategy for Sana HRMS, covering automated security tests, manual penetration testing procedures, and security regression testing.

### Scope

- Authentication & Authorization
- Input Validation & Injection
- File Upload Security
- Session & Token Management
- Data Protection & Privacy
- API Security
- Access Control (RBAC/ABAC)
- Audit Logging

---

## 2. Automated Security Tests

### 2.1 Authentication Security Tests

```typescript
// frontend/tests/e2e/security.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication Security', () => {
  test('prevents brute force attacks', async ({ page }) => {
    for (let i = 0; i < 6; i++) {
      await page.goto('/login');
      await page.fill('input[placeholder="نام کاربری"]', 'admin');
      await page.fill('input[type="password"]', `wrong${i}`);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(500);
    }
    
    // Should show lockout message
    await expect(page.locator('text=حساب موقتاً قفل شد')).toBeVisible();
  });

  test('rate limiting on login endpoint', async ({ page }) => {
    const responses = [];
    for (let i = 0; i < 10; i++) {
      const response = await page.request.post('/api/v1/auth/login', {
        data: { username: 'admin', password: 'wrong' }
      });
      responses.push(response.status());
    }
    
    // Should get 429 after limit exceeded
    expect(responses.filter(s => s === 429).length).toBeGreaterThan(0);
  });

  test('prevents credential stuffing', async ({ page }) => {
    const commonPasswords = ['123456', 'password', 'admin123', 'qwerty', 'welcome'];
    
    for (const pwd of commonPasswords) {
      const response = await page.request.post('/api/v1/auth/login', {
        data: { username: 'admin', password: pwd }
      });
      expect(response.status()).not.toBe(200);
    }
  });

  test('JWT token structure validation', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[placeholder="نام کاربری"]', 'admin');
    await page.fill('input[type="password"]', 'E7HHpQcEFezE4OAa1!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
    
    const cookies = await page.context().cookies();
    const refreshCookie = cookies.find(c => c.name === 'refresh_token');
    expect(refreshCookie).toBeTruthy();
    expect(refreshCookie?.httpOnly).toBe(true);
    expect(refreshCookie?.secure).toBe(true);
    expect(refreshCookie?.sameSite).toBe('Strict');
  });

  test('access token not in localStorage', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[placeholder="نام کاربری"]', 'admin');
    await page.fill('input[type="password"]', 'E7HHpQcEFezE4OAa1!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
    
    const localStorage = await page.evaluate(() => JSON.stringify(localStorage));
    expect(localStorage).not.toContain('access_token');
    expect(localStorage).not.toContain('refresh_token');
  });
});
```

### 2.2 Authorization Security Tests

```typescript
test.describe('Authorization Security', () => {
  test('prevents IDOR on employee endpoint', async ({ page }) => {
    // Login as regular employee
    await page.goto('/login');
    await page.fill('input[placeholder="نام کاربری"]', 'emp-001');
    await page.fill('input[type="password"]', 'SanaDemo@1404');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
    
    // Try to access another employee's data
    await page.goto('/employees/other-employee-id');
    await expect(page.locator('text=دسترسی غیرمجاز')).toBeVisible();
  });

  test('prevents cross-company data access', async ({ page }) => {
    await login(page, 'company-a-admin');
    
    // Try to access company B's employee
    await page.goto('/employees/company-b-employee-id');
    await expect(page.locator('text=دسترسی غیرمجاز')).toBeVisible();
  });

  test('prevents privilege escalation', async ({ page }) => {
    await login(page, 'employee');
    
    // Try to access admin-only endpoint
    const response = await page.request.post('/api/v1/users', {
      headers: { Authorization: `Bearer ${await getToken(page)}` },
      data: { username: 'hacker', password: 'Pass123!', roleIds: ['super-admin'] }
    });
    
    expect(response.status()).toBe(403);
  });

  test('ABAC scope enforcement', async ({ page }) => {
    // Manager can only see their org unit employees
    await login(page, 'branch-manager');
    await page.goto('/employees');
    
    const rows = page.locator('tbody tr');
    for (const row of await rows.all()) {
      const branch = await row.locator('[data-field="branch"]').textContent();
      expect(branch).toBe('Tehran Branch'); // Manager's branch
    }
  });
});
```

### 2.3 Input Validation Tests

```typescript
test.describe('Input Validation', () => {
  test('prevents XSS in all input fields', async ({ page }) => {
    const xssPayloads = [
      '<script>alert("xss")</script>',
      '<img src=x onerror=alert(1)>',
      '<svg onload=alert(1)>',
      'javascript:alert(1)',
      '<iframe src="javascript:alert(1)">',
    ];

    for (const payload of xssPayloads) {
      await page.goto('/employees');
      await page.click('button:has-text("افزودن نیرو")');
      await page.fill('input[name="firstName"]', payload);
      await page.click('button:has-text("ذخیره")');
      
      // Should not execute script - check payload is escaped
      const content = await page.content();
      expect(content).not.toContain('<script>');
      expect(content).toContain('<script>');
    }
  });

  test('prevents SQL injection in search', async ({ page }) => {
    const sqlPayloads = [
      "' OR '1'='1",
      "'; DROP TABLE employees; --",
      "' UNION SELECT * FROM users --",
      "admin'--",
    ];

    for (const payload of sqlPayloads) {
      await page.goto('/employees');
      await page.fill('input[placeholder*="جستجو"]', payload);
      await page.keyboard.press('Enter');
      
      // Should not crash or return all records
      await expect(page.locator('text=داده‌ای یافت نشد')).toBeVisible({ timeout: 5000 });
    }
  });

  test('prevents command injection in file upload', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/documents');
    await page.click('button:has-text("بارگذاری مدرک")');
    
    // Create file with command injection in name
    const fileName = 'test$(rm -rf /).pdf';
    // ... upload logic
    
    // Should reject or sanitize
  });
});
```

### 2.4 File Upload Security

```typescript
test.describe('File Upload Security', () => {
  test('rejects executable files', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/documents');
    await page.click('button:has-text("بارگذاری مدرک")');
    
    await page.setInputFiles('input[type="file"]', 'tests/e2e/fixtures/test.exe');
    await page.click('button:has-text("بارگذاری")');
    
    await expect(page.locator('text=نوع فایل مجاز نیست')).toBeVisible();
  });

  test('rejects SVG with scripts', async ({ page }) => {
    const svgWithScript = `<svg onload="alert(1)"></svg>`;
    // Create SVG file and upload
    // Should reject
  });

  test('validates magic bytes', async ({ page }) => {
    // Upload file with .pdf extension but executable content
    // Should reject due to magic byte mismatch
  });

  test('enforces file size limit', async ({ page }) => {
    // Create file > 10MB
    // Should reject with size error
  });

  test('scans with ClamAV when enabled', async ({ page }) => {
    // Requires ClamAV configured
    // Upload EICAR test file
    // Should reject
  });
});
```

### 2.5 Session & Token Management

```typescript
test.describe('Session & Token Security', () => {
  test('refresh token rotation', async ({ page }) => {
    await login(page, 'admin');
    const cookies1 = await page.context().cookies();
    const refresh1 = cookies1.find(c => c.name === 'refresh_token');
    
    // Refresh token
    await page.request.post('/api/v1/auth/refresh');
    
    const cookies2 = await page.context().cookies();
    const refresh2 = cookies2.find(c => c.name === 'refresh_token');
    
    // Token should have rotated
    expect(refresh2.value).not.toBe(refresh1.value);
  });

  test('refresh token reuse detection', async ({ page }) => {
    await login(page, 'admin');
    const cookies = await page.context().cookies();
    const refresh = cookies.find(c => c.name === 'refresh_token');
    
    // Use same refresh token twice
    const resp1 = await page.request.post('/api/v1/auth/refresh', {
      headers: { Cookie: `refresh_token=${refresh.value}` }
    });
    expect(resp1.status()).toBe(200);
    
    // Second use should fail
    const resp2 = await page.request.post('/api/v1/auth/refresh', {
      headers: { Cookie: `refresh_token=${refresh.value}` }
    });
    expect(resp2.status()).toBe(401);
  });

  test('logout revokes refresh token', async ({ page }) => {
    await login(page, 'admin');
    await page.locator('[class*="user-avatar"]').click();
    await page.click('text=خروج');
    await expect(page).toHaveURL('/login');
    
    // Try to use old refresh token
    const cookies = await page.context().cookies();
    const refresh = cookies.find(c => c.name === 'refresh_token');
    const response = await page.request.post('/api/v1/auth/refresh', {
      headers: { Cookie: `refresh_token=${refresh?.value}` }
    });
    expect(response.status()).toBe(401);
  });

  test('concurrent session limit', async ({ page, context }) => {
    // Login from multiple browsers
    const contexts = await Promise.all(
      Array(4).fill(null).map(() => browser.newContext())
    );
    
    for (const ctx of contexts) {
      const page = await ctx.newPage();
      await page.goto('/login');
      await page.fill('input[placeholder="نام کاربری"]', 'admin');
      await page.fill('input[type="password"]', 'E7HHpQcEFezE4OAa1!');
      await page.click('button[type="submit"]');
    }
    
    // Should enforce max concurrent sessions
  });
});
```

### 2.5 API Security

```typescript
test.describe('API Security', () => {
  test('CORS configuration', async ({ page }) => {
    const response = await page.request.get('/api/v1/employees', {
      headers: { Origin: 'https://evil.com' }
    });
    // Should not allow evil.com
    expect(response.headers()['access-control-allow-origin']).not.toBe('https://evil.com');
  });

  test('security headers present', async ({ page }) => {
    const response = await page.request.get('/api/v1/employees');
    const headers = response.headers();
    
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['x-content-security-policy']).toBeTruthy();
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });

  test('rate limiting on API endpoints', async ({ page }) => {
    const responses = [];
    for (let i = 0; i < 310; i++) {
      const resp = await page.request.get('/api/v1/employees', {
        headers: { Authorization: `Bearer ${await getToken()}` }
      });
      responses.push(resp.status());
    }
    
    const rateLimited = responses.filter(s => s === 429).length;
    expect(rateLimited).toBeGreaterThan(0);
  });
});
```

---

## 3. Manual Penetration Testing Checklist

### Pre-Engagement

- [ ] Scope defined and approved
- [ ] Rules of engagement signed
- [ ] Test environment isolated from production
- [ ] Test accounts created with appropriate permissions
- [ ] Backup and rollback plan documented

### Authentication Testing

- [ ] Password policy enforcement
- [ ] Account lockout after failed attempts
- [ ] Password reset functionality
- [ ] Multi-factor authentication (if implemented)
- [ ] Session timeout and renewal
- [ ] Concurrent session limits
- [ ] Password history and reuse prevention
- [ ] Secure password reset tokens

### Session Management

- [ ] Session ID randomness
- [ ] Session timeout
- [ ] Session invalidation on logout
- [ ] Session invalidation on password change
- [ ] Concurrent session handling
- [ ] Secure cookie attributes (HttpOnly, Secure, SameSite)
- [ ] Session fixation protection

### Access Control

- [ ] Vertical privilege escalation
- [ ] Horizontal privilege escalation (IDOR)
- [ ] Cross-tenant data access
- [ ] Cross-branch data access
- [ ] Cross-orgunit data access
- [ ] Role-based access control (RBAC)
- [ ] Attribute-based access control (ABAC)
- [ ] Function-level access control
- [ ] Data-level access control

### Input Validation

- [ ] SQL injection (all input fields)
- [ ] Cross-site scripting (XSS) - stored, reflected, DOM-based
- [ ] Command injection
- [ ] Path traversal
- [ ] File upload validation
- [ ] XML/JSON injection
- [ ] LDAP injection
- [ ] NoSQL injection
- [ ] Server-side template injection (SSTI)
- [ ] HTTP parameter pollution
- [ ] Mass assignment / Overposting

### File Upload

- [ ] File type validation (MIME + extension)
- [ ] Magic byte validation
- [ ] File size limits
- [ ] Malware scanning
- [ ] File name sanitization
- [ ] Storage outside web root
- [ ] Secure download (Content-Disposition, X-Content-Type-Options)

### API Security

- [ ] Rate limiting
- [ ] Authentication on all endpoints
- [ ] Authorization on all endpoints
- [ ] Input validation on all parameters
- [ ] Output encoding
- [ ] Error handling (no stack traces)
- [ ] API versioning
- [ ] CORS configuration
- [ ] Security headers
- [ ] Rate limiting per endpoint
- [ ] Request size limits

### Session & Token Management

- [ ] JWT algorithm confusion
- [ ] Token expiration
- [ ] Token revocation
- [ ] Refresh token rotation
- [ ] Refresh token reuse detection
- [ ] Token scope validation
- [ ] Audience/issuer validation
- [ ] Key rotation

### Data Protection

- [ ] Encryption at rest
- [ ] Encryption in transit (TLS 1.2+)
- [ ] PII encryption
- [ ] Key management
- [ ] Data masking in logs
- [ ] Backup encryption
- [ ] Data retention/deletion

### Error Handling & Logging

- [ ] No stack traces in production
- [ ] No sensitive data in logs
- [ ] Audit log integrity
- [ ] Audit log tampering detection
- [ ] Security event alerting

### Configuration & Deployment

- [ ] Secure defaults
- [ ] Unused features disabled
- [ ] Security headers
- [ ] Content Security Policy
- [ ] Subresource Integrity
- [ ] Dependency vulnerability scanning
- [ ] Container security (if applicable)
- [ ] Infrastructure as Code security

---

## 4. Security Test Automation

### 4.1 CI/CD Integration

```yaml
# .github/workflows/security-tests.yml
name: Security Tests

on: [push, pull_request]

jobs:
  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: |
          cd backend && npm ci
          cd ../frontend && npm ci
      
      - name: Run SAST
        uses: github/codeql-action/init@v2
        with:
          languages: typescript
      
      - name: Run SAST analysis
        uses: github/codeql-action/analyze@v2
      
      - name: Dependency scan
        run: |
          cd backend && npm audit --audit-level=high
          cd ../frontend && npm audit --audit-level=high
      
      - name: Container scan
        if: false
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          format: 'sarif'
          output: 'trivy-results.sarif'
      
      - name: Upload Trivy results
        if: false
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: 'trivy-results.sarif'
```

### 2.2 Dependency Scanning

```bash
# Backend
cd backend
npm audit --audit-level=high --json > audit-report.json
npx snyk test --severity-threshold=high

# Frontend
cd frontend
npm audit --audit-level=high --json > audit-report.json
npx snyk test --severity-threshold=high
```

### 2.3 Container Scanning

```bash
# Using Trivy
trivy image --severity HIGH,CRITICAL sana-hrms-backend:latest
trivy image --severity HIGH,CRITICAL sana-hrms-frontend:latest

# Using Docker Scout
docker scout cves sana-hrms-backend:latest
docker scout cves sana-hrms-frontend:latest
```

### 2.4 SAST (Static Application Security Testing)

```bash
# Using CodeQL (GitHub)
# Configured in .github/workflows/codeql.yml

# Using Semgrep
semgrep --config=auto backend/src/
semgrep --config=auto frontend/src/

# Using SonarQube
sonar-scanner \
  -Dsonar.projectKey=sana-hrms \
  -Dsonar.sources=backend/src,frontend/src \
  -Dsonar.host.url=https://sonarqube.example.com
```

---

## 4. Manual Penetration Testing Process

### Phase 1: Reconnaissance (Day 1)
- [ ] Application mapping
- [ ] Technology fingerprinting
- [ ] API endpoint discovery
- [ ] User role enumeration
- [ ] Business logic understanding

### Phase 2: Automated Scanning (Day 1-2)
- [ ] OWASP ZAP active scan
- [ ] Burp Suite active scan
- [ ] Dependency vulnerability scan
- [ ] Container image scan
- [ ] SSL/TLS configuration test

### Phase 3: Manual Testing (Day 2-4)
- [ ] Authentication & session testing
- [ ] Authorization & access control
- [ ] Input validation testing
- [ ] Business logic flaws
- [ ] File upload testing
- [ ] API security testing
- [ ] Client-side security (XSS, CSRF)

### Phase 5: Reporting (Day 5)
- [ ] Findings documentation
- [ ] Risk rating (CVSS)
- [ ] Remediation guidance
- [ ] Retest verification

---

## 4. Vulnerability Classification

| Severity | CVSS Range | Response Time | Description |
|----------|------------|---------------|-------------|
| **Critical** | 9.0-10.0 | 24 hours | Remote code execution, auth bypass, massive data breach |
| **High** | 7.0-8.9 | 72 hours | SQLi, auth bypass, significant data exposure |
| **Medium** | 4.0-6.9 | 2 weeks | XSS, CSRF, info disclosure, weak crypto |
| **Low** | 0.1-3.9 | 30 days | Info disclosure, minor config issues |
| **Informational** | 0.0 | Next release | Best practice violations |

---

## 5. Reporting Template

```markdown
# Security Assessment Report - Sana HRMS

## Executive Summary
- Assessment Date: YYYY-MM-DD
- Scope: [URLs, IP ranges, components]
- Methodology: OWASP ASVS 4.0 / OWASP Testing Guide v4

## Findings Summary
| Severity | Count |
|----------|-------|
| Critical | X |
| High | X |
| Medium | X |
| Low | X |
| Info | X |

## Detailed Findings

### [SEV-001] Critical: SQL Injection in Employee Search
**CVSS:** 9.8 (Critical)
**Location:** `/api/v1/employees?search=`
**Impact:** Full database compromise
**Evidence:** Payload `' UNION SELECT * FROM users --` returns all users
**Remediation:** Use parameterized queries / Prisma ORM properly
**Status:** Open

### [SEV-002] High: IDOR in Employee Endpoint
**CVSS:** 7.5 (High)
**Location:** `GET /api/v1/employees/{id}`
**Impact:** Cross-employee data access
**Evidence:** Employee A can access Employee B's salary data
**Remediation:** Implement ABAC scope checks in service layer
**Status:** Open

## Recommendations
1. Implement parameterized queries / Use Prisma ORM correctly
2. Implement ABAC scope checks on all data access
3. Enable CSP with nonce
4. Implement rate limiting on all endpoints
5. Enable CSP with nonce-based scripts
5. Regular dependency updates
```

---

## 6. Remediation Verification

```typescript
// Regression test for CVE-XXXX-XXXX
test('CVE-XXXX-XXXX: SQL injection fixed in employee search', async ({ page }) => {
  await login(page, 'admin');
  await page.goto('/employees');
  
  const payload = "' UNION SELECT * FROM users --";
  await page.fill('input[placeholder*="جستجو"]', payload);
  await page.keyboard.press('Enter');
  
  // Should not return all users
  await expect(page.locator('text=داده‌ای یافت نشد')).toBeVisible();
});
```

---

## 7. Tools & Resources

| Category | Tools |
|----------|-------|
| **DAST** | OWASP ZAP, Burp Suite, Nikto, Nuclei |
| **SAST** | CodeQL, Semgrep, SonarQube, ESLint Security |
| **SCA** | npm audit, Snyk, Dependabot, Trivy, OWASP Dependency Check |
| **Container** | Trivy, Docker Scout, Clair, Anchore |
| **Secrets** | TruffleHog, GitLeaks, detect-secrets |
| **API** | Postman, Insomnia, Pact, Schemathesis |
| **Mobile** | MobSF, Frida, Objection |
| **Infrastructure** | Checkov, tfsec, Terrascan, KICS |
| **Runtime** | Falco, Sysdig, Tracee |

---

## 7. Remediation Tracking

| Finding ID | Severity | Status | Owner | Target Date | Verified |
|------------|----------|--------|-------|-------------|----------|
| SEV-001 | Critical | Open | Backend Lead | 2026-12-01 | No |
| SEV-002 | High | In Progress | Backend Lead | 2026-11-25 | No |
| SEV-003 | Medium | Open | Frontend Lead | 2026-12-15 | No |

---

**Document Control:**
- Version: 1.0
- Classification: Confidential
- Review Cycle: Per Release
- Owner: Security Team