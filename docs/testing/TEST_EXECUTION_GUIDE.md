# Sana HRMS - Test Execution Guide

**Version:** 1.0  
**Date:** 2026-11-18  
**Audience:** Developers, QA Engineers, DevOps, CI/CD Engineers

---

## 1. Quick Start

### Prerequisites

| Tool | Version | Install Command |
|------|---------|-----------------|
| Node.js | 20.x | `nvm install 20` |
| npm | 10.x | Included with Node |
| PostgreSQL | 16.x | `docker run -d postgres:16` |
| Docker | Latest | `docker --version` |
| Git | Latest | `git --version` |

### Initial Setup

```bash
# Clone repository
git clone <repository-url>
cd sana-hrms

# Backend setup
cd backend
npm ci
npx prisma generate
cp .env.example .env
# Edit .env with your database credentials
npx prisma migrate deploy
npm run db:seed

# Frontend setup
cd ../frontend
npm ci
```

---

## 2. Running Tests Locally

### 2.1 Backend Tests

```bash
cd backend

# Run all tests
npm test

# Run specific test file
npm test -- --testPathPattern=employees.service.spec.ts

# Run with coverage
npm run test:cov

# Run integration tests (requires PostgreSQL)
npm run test:integration

# Watch mode for development
npm run test:watch

# Run specific test by name
npm test -- --testNamePattern="should create employee"

# Debug mode
node --inspect-brk node_modules/.bin/jest --runInBand --testNamePattern="test name"
```

### 2.2 Frontend Tests

```bash
cd frontend

# Run all tests (Node.js test runner + Playwright)
npm test

# Run only E2E tests
npx playwright test

# Run with UI mode
npx playwright test --ui

# Run headed (visible browser)
npx playwright test --headed

# Run specific test
npx playwright test -g "successful login"

# Run with specific browser
npx playwright test --project=chromium

# Run with retries
npx playwright test --retries=2

# Debug mode
npx playwright test --debug

# Generate and view HTML report
npx playwright show-report

# Run accessibility tests only
npx playwright test accessibility.spec.ts
```

### 2.3 Full Test Suite

```bash
# Run everything from root
cd sana-hrms

# Backend
cd backend && npm test && npm run test:integration

# Frontend
cd ../frontend && npm test && npx playwright test

# Full build verification
cd backend && npm run build
cd ../frontend && npm run build
```

---

## 3. Test Environment Setup

### 3.1 Local Development

```bash
# Start PostgreSQL
docker run -d \
  --name sana-postgres \
  -e POSTGRES_USER=sana \
  -e POSTGRES_PASSWORD=sana_password \
  -e POSTGRES_DB=sana_hrms \
  -p 5432:5432 \
  postgres:16

# Or use docker-compose
docker compose up -d postgres
```

### 3.2 Test Database Setup

```bash
cd backend

# Create test database
createdb sana_hrms_test

# Run migrations
DATABASE_URL=postgresql://user:pass@localhost:5432/sana_hrms_test npx prisma migrate deploy

# Seed test data (optional)
npx prisma db seed
```

### 3.3 Environment Variables

```bash
# backend/.env
DATABASE_URL=postgresql://user:pass@localhost:5432/sana_hrms
JWT_ACCESS_SECRET=your-32-char-secret-here
JWT_REFRESH_SECRET=another-32-char-secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_DAYS=7
JWT_REFRESH_GRACE_SECONDS=15
CORS_ORIGINS=http://localhost:5183
NODE_ENV=development
SWAGGER_ENABLED=true
```

---

## 4. Test Execution Commands

### 4.1 Backend Commands

```bash
cd backend

# All tests
npm test

# Specific patterns
npm test -- --testPathPattern=employees
npm test -- --testPathPattern=auth
npm test -- --testPathPattern=attendance

# By test name
npm test -- --testNamePattern="should create employee"

# Coverage
npm run test:cov

# Integration tests only
npm run test:integration

# Watch mode
npm run test:watch

# Debug
npm run test:debug  # if configured
# or
node --inspect-brk node_modules/.bin/jest --runInBand
```

### 4.2 Frontend Commands

```bash
# Unit/pure function tests
npm test

# E2E tests
npx playwright test

# With UI
npx playwright test --ui

# Headed mode
npx playwright test --headed

# Specific browser
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit

# Specific test
npx playwright test -g "successful login"

# Retries
npx playwright test --retries=2

# Debug
npx playwright test --debug

# Show report
npx playwright show-report
```

### 4.3 Coverage Reports

```bash
# Backend coverage
cd backend
npm run test:cov
# Open coverage/lcov-report/index.html

# Frontend coverage
cd frontend
npx vitest run --coverage
# Open coverage/index.html

# Combined report (if configured)
# Use codecov or similar
```

---

## 5. CI/CD Pipeline Execution

### 5.1 GitHub Actions

```yaml
# .github/workflows/test.yml
# Triggered on push/PR
# Runs: lint -> typecheck -> unit tests -> integration tests -> e2e tests
```

### 5.2 Manual Trigger

```bash
# Trigger workflow manually
gh workflow run test.yml

# Or via GitHub UI: Actions > Test Suite > Run workflow
```

### 5.3 Local CI Simulation

```bash
# Simulate CI locally
cd backend
npm ci
npm run lint
npm run typecheck
npm test
npm run test:integration

cd ../frontend
npm ci
npm run lint
npm run typecheck
npm test
npx playwright test
```

---

## 6. Test Debugging

### 6.1 Backend Debugging

```bash
# VS Code launch.json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Jest",
  "program": "${workspaceFolder}/backend/node_modules/.bin/jest",
  "args": ["--runInBand", "--testNamePattern", "test name"],
  "console": "integratedTerminal",
  "cwd": "${workspaceFolder}/backend"
}
```

```bash
# Run single test with verbose output
cd backend
npx jest --testPathPattern=employees.service.spec.ts --verbose

# With debug output
DEBUG=* npx jest --testPathPattern=employees.service.spec.ts

# Inspect specific test
node --inspect-brk node_modules/.bin/jest --runInBand --testNamePattern="test name"
```

### 5.2 Frontend Debugging

```bash
# Playwright debug
npx playwright test --debug

# Debug specific test
npx playwright test --debug -g "test name"

# Trace viewer
npx playwright show-trace trace.zip

# Slow motion
npx playwright test --slow-mo=1000

# Console output
DEBUG=pw:api npx playwright test
```

### 5.3 Common Issues & Fixes

| Issue | Solution |
|-------|----------|
| `ECONNREFUSED` database | Check PostgreSQL is running, verify `DATABASE_URL` |
| `P2002` Unique constraint | Clean test data in `beforeEach`, use unique codes |
| `P2003` FK violation | Ensure referenced records exist |
| `P2025` Not found | Check soft delete, use `includeDeleted` |
| Timeout | Increase timeout: `jest.setTimeout(30000)` |
| Flaky E2E | Add `waitForLoadState('networkidle')`, use `data-testid` |
| Module not found | Check `moduleNameMapper` in jest.config.js |
| TypeScript errors | Run `npx tsc --noEmit` |

---

## 6. Test Data Management

### 6.1 Test Data Principles

- **Isolation**: Each test creates/cleans its own data
- **Uniqueness**: Use prefixes (`TEST-`, `E2E-`) for test data
- **Deterministic**: Fixed seeds for reproducible tests
- **Cleanup**: `afterEach` / `afterAll` cleanup

### 6.2 Test Data Factories

```typescript
// backend/src/common/testing/test-factories.ts
export const EmployeeFactory = {
  build(overrides = {}) ({
    companyId: 'company-1',
    code: `TEST-${faker.string.alphanumeric(6)}`,
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    nationalId: faker.string.numeric(10),
    // ... required fields
  }),

  createMany(count, overrides) {
    return Array.from({ length: count }, () => this.build(overrides));
  }
};
```

### 6.3 Database Seeding

```bash
# Seed development database
cd backend
npm run db:seed

# Seed test database (integration tests)
DATABASE_URL=postgresql://.../sana_test npx prisma db seed
```

---

## 7. Coverage Reports

### 7.1 Generating Reports

```bash
# Backend
cd backend
npm run test:cov
# Opens coverage/lcov-report/index.html

# Frontend
cd frontend
npx vitest run --coverage
# Opens coverage/index.html
```

### 7.2 Interpreting Reports

| Metric | Good | Warning | Critical |
|--------|------|---------|----------|
| Statements | >80% | 60-80% | <60% |
| Branches | >75% | 50-75% | <50% |
| Functions | >80% | 60-80% | <60% |
| Lines | >80% | 60-80% | <60% |

### 7.3 Coverage Gates

```javascript
// backend/jest.config.js
module.exports = {
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 75,
      functions: 80,
      lines: 80,
    },
    './src/auth/**': {
      statements: 95,
      branches: 90,
      functions: 95,
    },
    './src/common/access/**': {
      statements: 95,
      branches: 90,
      functions: 95,
    },
  },
};
```

---

## 8. Troubleshooting

### 8.1 Common Issues

| Error | Cause | Solution |
|-------|-------|----------|
| `ECONNREFUSED` | DB not running | Start PostgreSQL, check `DATABASE_URL` |
| `P2002` | Unique constraint | Use unique codes, clean in `beforeEach` |
| `P2003` | FK violation | Create parent records first |
| `P2025` | Not found | Check soft delete, use `where: { deletedAt: null }` |
| Timeout | Test too slow | `jest.setTimeout(30000)` or optimize query |
| Flaky E2E | Race condition | Add `waitForLoadState('networkidle')` |
| Module not found | Path alias | Check `moduleNameMapper` in jest.config |
| TypeScript errors | Run `npx tsc --noEmit` | Fix types before testing |

### 8.2 Database Issues

```bash
# Reset test database
dropdb sana_hrms_test && createdb sana_hrms_test
npx prisma migrate deploy

# Reset migrations (dev only)
npx prisma migrate reset --force

# Check migration status
npx prisma migrate status
```

### 8.3 Docker Issues

```bash
# Clean Docker
docker system prune -a

# Rebuild images
docker compose build --no-cache

# Check logs
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f postgres
```

---

## 9. Test Data Management

### 9.1 Test Data Principles

| Principle | Practice |
|-----------|----------|
| **Isolation** | Each test creates/cleans own data |
| **Uniqueness** | Use `TEST-`, `E2E-` prefixes |
| **Deterministic** | Fixed seeds, no randomness |
| **Cleanup** | `afterEach` / `afterAll` |
| **No shared state** | Independent tests |

### 9.2 Cleanup Patterns

```typescript
// Unit tests - mock Prisma, no cleanup needed

// Integration tests - clean in beforeEach
beforeEach(async () => {
  await prisma.employee.deleteMany({ where: { code: { startsWith: 'TEST-' } } });
  await prisma.leaveRequest.deleteMany({ where: { reason: { contains: 'TEST' } } });
});

// E2E - cleanup in afterAll
afterAll(async () => {
  await cleanupTestData();
});
```

---

## 10. Performance Testing

### 10.1 Load Testing (k6)

```javascript
// load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 50,
  duration: '5m',
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const loginRes = http.post('http://localhost:4114/api/v1/auth/login', {
    username: 'admin',
    password: 'E7HHpQcEFezE4OAa1!',
  });
  
  check(loginRes, {
    'login status 200': (r) => r.status === 200,
    'has token': (r) => r.json('data.accessToken') !== undefined,
  });
  
  sleep(1);
}
```

```bash
# Run load test
k6 run load-test.js
```

---

## 10. Maintenance

### 11.1 Regular Tasks

| Frequency | Task |
|-----------|------|
| Daily | Run CI pipeline, check flaky tests |
| Weekly | Review coverage trends, update snapshots |
| Monthly | Review test performance, update dependencies |
| Per Release | Full regression suite, penetration test |

### 11.2 Test Maintenance

```bash
# Update snapshots
npm test -- -u

# Remove obsolete tests
# Review and delete skipped tests

# Update test data
# Review test factories for new fields
```

---

## 12. Support & Escalation

| Issue | Contact | SLA |
|-------|---------|-----|
| CI/CD Pipeline Failure | DevOps Team | 1 hour |
| Flaky Test | QA Team | 4 hours |
| Coverage Drop | Team Lead | 1 day |
| Security Test Failure | Security Team | 4 hours |
| Infrastructure Issue | DevOps | 30 minutes |

---

## 13. Appendix: Useful Commands Reference

```bash
# Quick reference card
cd backend
npm test                              # All tests
npm test -- --testPathPattern=auth    # Filter by path
npm test -- --testNamePattern="login" # Filter by name
npm run test:cov                      # Coverage
npm run test:integration              # Integration tests
npm run test:watch                    # Watch mode

cd ../frontend
npm test                              # Unit tests
npx playwright test                   # E2E tests
npx playwright test --ui              # UI mode
npx playwright test --headed          # Headed mode
npx playwright test --debug           # Debug mode
npx playwright show-report            # View report

# Full suite
cd ..
./run-all-tests.sh  # If created
```

---

## 14. Appendix: Test Data Reference

### 12.1 Default Test Users

| Role | Username | Password | Permissions |
|------|----------|----------|-------------|
| Super Admin | admin | E7HHpQcEFezE4OAa1! | All |
| HR Admin | hradmin_comp-001 | SanaDemo@1404 | HR Module |
| Manager | mgr_hq_comp-001 | SanaDemo@1404 | Team Management |
| Employee | emp-001 | SanaDemo@1404 | Self Service |

### 12.2 Test Employee Codes

| Prefix | Purpose |
|--------|---------|
| `TEST-` | Unit/Integration tests |
| `E2E-` | End-to-end tests |
| `PERF-` | Performance tests |
| `SEC-` | Security tests |

---

**Document Control:**
- Version: 1.0
- Last Updated: 2026-11-18
- Next Review: Sprint Planning
- Owner: QA Team