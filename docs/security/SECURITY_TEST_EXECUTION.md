# Sana HRMS - Security Test Execution Guide

**Version:** 1.0  
**Date:** 2026-11-18  
**Prerequisites:** Node.js 20+, PostgreSQL 16, npm 10+  

---

## 1. Environment Setup

### 1.1 Required Services
```bash
# Start PostgreSQL (Docker)
docker run -d --name sana-test-db \
  -e POSTGRES_USER=sana \
  -e POSTGRES_PASSWORD=test123 \
  -e POSTGRES_DB=sana_hrms_test \
  -p 5433:5432 \
  postgres:16-alpine

# Wait for database to be ready
sleep 5
```

### 1.2 Environment Variables
Create `backend/.env.test`:
```env
NODE_ENV=test
PORT=4115
HOST=127.0.0.1
DATABASE_URL=postgresql://sana:test123@localhost:5433/sana_hrms_test?schema=public
JWT_ACCESS_SECRET=test-access-secret-minimum-32-characters-long
JWT_REFRESH_SECRET=test-refresh-secret-minimum-32-characters-long
JWT_REFRESH_GRACE_SECONDS=5
JWT_ISSUER=sana-hrms-test
BACKUP_ENCRYPTION_KEY=test-backup-encryption-key-32-chars!!
ADMIN_USERNAME=admin
ADMIN_PASSWORD=TestPass123!
SEED_DEMO_DATA=false
SWAGGER_ENABLED=true
CORS_ORIGINS=http://localhost:5183
AUDIT_FAIL_OPEN=true
AUDIT_ALERT_ON_FAILURE=true
ANTIVIRUS_ENABLED=false
```

### 1.3 Database Setup
```bash
cd backend
cp .env.test .env
npx prisma migrate deploy
npx prisma generate
```

---

## 2. Test Execution Commands

### 2.1 Backend Security Tests

```bash
cd backend

# Run all security tests
npm test -- --testPathPattern=test/security

# Run with coverage
npm test -- --testPathPattern=test/security --coverage

# Run specific category
npm test -- --testPathPattern=test/security/auth
npm test -- --testPathPattern=test/security/authorization
npm test -- --testPathPattern=test/security/tenant-isolation
npm test -- --testPathPattern=test/security/injection
npm test -- --testPathPattern=test/security/file-handling
npm test -- --testPathPattern=test/security/browser-security
npm test -- --testPathPattern=test/security/rate-limiting
npm test -- --testPathPattern=test/security/audit

# Run in watch mode (development)
npm test -- --testPathPattern=test/security --watch
```

### 2.2 Frontend Security Tests

```bash
cd frontend

# Run unit tests
npm test

# Run E2E tests
npm run test:e2e

# Run accessibility tests
npm run test:a11y

# Run all tests
npm run test:all
```

### 2.3 Full Test Suite

```bash
# From project root
./scripts/run-all-tests.sh

# Or manually:
cd backend && npm test -- --testPathPattern=test/security --coverage
cd ../frontend && npm run test:all
```

---

## 3. Expected Test Results

### 3.1 Success Criteria

| Test Category | Minimum Tests | Pass Rate |
|---------------|--------------|-----------|
| Authentication | 20 | 100% |
| Authorization | 15 | 100% |
| Tenant Isolation | 12 | 100% |
| Injection | 10 | 100% |
| File Handling | 10 | 100% |
| Browser Security | 10 | 100% |
| Rate Limiting | 8 | 100% |
| Audit Logging | 5 | 100% |
| **Total** | **90** | **100%** |

### 3.2 Coverage Targets

| Metric | Target |
|--------|--------|
| Statements | 80% |
| Branches | 75% |
| Functions | 80% |
| Lines | 80% |

---

## 4. CI/CD Integration

### 4.1 GitHub Actions Workflow

Create `.github/workflows/security-tests.yml`:
```yaml
name: Security Regression Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  backend-security:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: sana
          POSTGRES_PASSWORD: test123
          POSTGRES_DB: sana_hrms_test
        ports: ['5433:5432']
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: backend/package-lock.json
      
      - name: Install dependencies
        run: cd backend && npm ci
      
      - name: Generate Prisma Client
        run: cd backend && npx prisma generate
      
      - name: Run migrations
        run: cd backend && npx prisma migrate deploy
        env:
          DATABASE_URL: postgresql://sana:test123@localhost:5433/sana_hrms_test?schema=public
      
      - name: Run security tests
        run: cd backend && npm test -- --testPathPattern=test/security --coverage
        env:
          NODE_ENV: test
          DATABASE_URL: postgresql://sana:test123@localhost:5433/sana_hrms_test?schema=public
          JWT_ACCESS_SECRET: test-access-secret-minimum-32-characters-long
          JWT_REFRESH_SECRET: test-refresh-secret-minimum-32-characters-long
          JWT_REFRESH_GRACE_SECONDS: 5
          JWT_ISSUER: sana-hrms-test
          BACKUP_ENCRYPTION_KEY: test-backup-encryption-key-32-chars!!
          ADMIN_USERNAME: admin
          ADMIN_PASSWORD: TestPass123!
          AUDIT_FAIL_OPEN: 'true'
          AUDIT_ALERT_ON_FAILURE: 'true'
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          directory: backend/coverage
          flags: backend-security

  frontend-security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json
      
      - name: Install dependencies
        run: cd frontend && npm ci
      
      - name: Run unit tests
        run: cd frontend && npm test
      
      - name: Run E2E tests
        run: cd frontend && npm run test:e2e
      
      - name: Run accessibility tests
        run: cd frontend && npm run test:a11y

  dependency-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Audit backend dependencies
        run: cd backend && npm audit --audit-level=high
      
      - name: Audit frontend dependencies
        run: cd frontend && npm audit --audit-level=high

  build-verification:
    runs-on: ubuntu-latest
    needs: [backend-security, frontend-security]
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Build backend
        run: |
          cd backend
          npm ci
          npx prisma generate
          npm run build
      
      - name: Build frontend
        run: |
          cd frontend
          npm ci
          npm run build
```

---

## 5. Manual Penetration Testing Checklist

### 5.1 Authentication
- [ ] Test login with valid credentials
- [ ] Test login with invalid credentials
- [ ] Test login with SQL injection in username
- [ ] Test login with XSS in username
- [ ] Test brute force protection (6 attempts)
- [ ] Test account lockout after 5 failures
- [ ] Test password change invalidates tokens
- [ ] Test refresh token rotation
- [ ] Test concurrent refresh handling
- [ ] Test logout revokes tokens
- [ ] Test logout-all revokes all sessions

### 5.2 Authorization
- [ ] Test access without token
- [ ] Test access with expired token
- [ ] Test access with malformed token
- [ ] Test access with wrong algorithm (none, RS256)
- [ ] Test RBAC permission checks
- [ ] Test ABAC company/branch/orgUnit isolation
- [ ] Test IDOR on all endpoints
- [ ] Test self-assignment prevention
- [ ] Test superadmin protection

### 5.3 Tenant Isolation
- [ ] Cross-company employee access
- [ ] Cross-company payroll access
- [ ] Cross-company document access
- [ ] Cross-branch attendance access
- [ ] Query parameter manipulation
- [ ] Body parameter manipulation

### 5.4 Injection
- [ ] SQL injection in search
- [ ] SQL injection in UUID parameters
- [ ] Path traversal in file download
- [ ] XSS in error responses
- [ ] XSS in search results

### 5.5 File Handling
- [ ] Executable file upload
- [ ] MIME type mismatch
- [ ] Oversized file upload
- [ ] Valid file upload
- [ ] Virus scan (if enabled)
- [ ] Download authorization
- [ ] Confidentiality enforcement

### 5.6 Browser Security
- [ ] CSRF on login
- [ ] CSRF on refresh
- [ ] CSRF on change-password
- [ ] CORS configuration
- [ ] Security headers (CSP, HSTS, X-Frame-Options, etc.)
- [ ] SameSite=Strict on refresh cookie
- [ ] HttpOnly and Secure flags

### 5.7 Rate Limiting
- [ ] Login (5/min)
- [ ] Refresh (10/min)
- [ ] Change-password (5/5min)
- [ ] Logout (10/min)
- [ ] Logout-all (3/5min)
- [ ] Admin endpoints (20/min)

---

## 6. Troubleshooting

### 6.1 Common Issues

| Issue | Solution |
|-------|----------|
| Prisma generate fails | Delete `node_modules/.prisma` and retry |
| Database connection refused | Check PostgreSQL is running on correct port |
| Tests timeout | Increase Jest timeout: `--testTimeout=30000` |
| Port already in use | Kill process on port 4115/5183 |
| Migration fails | Reset database: `npx prisma migrate reset --force` |

### 6.2 Debug Mode
```bash
# Run tests with debug output
cd backend
npm test -- --testPathPattern=test/security --verbose --no-coverage

# Run single test file
npm test -- test/security/auth/refresh-token-rotation.spec.ts
```

---

## 7. Reporting

### 7.1 Test Report Generation
```bash
# JUnit XML for CI
npm test -- --testPathPattern=test/security --reporters=default --reporters=jest-junit

# HTML coverage report
npm test -- --testPathPattern=test/security --coverage --coverageReporters=html
```

### 7.2 Required Reports
- Test execution summary (pass/fail counts)
- Coverage report (statements, branches, functions, lines)
- Security findings summary
- Failed test details with reproduction steps

---

## 8. Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Security Engineer | | | |
| QA Lead | | | |
| DevOps Engineer | | | |
| Project Manager | | | |

---

**Document Version:** 1.0  
**Status:** READY FOR EXECUTION