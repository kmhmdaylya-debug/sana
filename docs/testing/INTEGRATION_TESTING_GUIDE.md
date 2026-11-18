# Sana HRMS - Integration Testing Guide

**Version:** 1.0  
**Date:** 2026-11-18  
**Audience:** Backend Developers, QA Engineers

---

## 1. Overview

Integration tests verify that components work correctly together, including:
- Database operations (Prisma + PostgreSQL)
- API endpoints (Controller → Service → Database)
- External service integrations
- Cross-module interactions

### Test Database Strategy

- **Isolated test databases** created per test run
- **Unique database names** using random suffixes
- **Automatic migration** before tests
- **Automatic cleanup** after tests
- **Never** use production or shared development database

---

## 2. Test Database Setup

### 2.1 Database Creation Script

The project uses `scripts/test-integration.cjs` to create isolated test databases:

```javascript
// backend/scripts/test-integration.cjs
// Creates: sana_audit_test_<random> and sana_restore_test_<random>
// Runs migrations, executes tests, cleans up
```

### 2.2 Environment Variables

```bash
# Required for integration tests
DATABASE_URL=postgresql://user:pass@localhost:5432/postgres
SANA_INTEGRATION_DATABASE_URL=postgresql://user:pass@localhost:5432/sana_audit_test_xxx
SANA_RESTORE_TEST_URL=postgresql://user:pass@localhost:5432/sana_restore_test_xxx
```

---

## 3. Integration Test Structure

### 3.1 Test Module Structure

```
backend/src/
├── module/
│   ├── module.integration.spec.ts    # Integration tests
│   └── service.spec.ts               # Unit tests (mocked)
└── common/
    └── testing/
        └── integration-setup.ts      # Shared setup utilities
```

### 3.2 Base Integration Test Template

```typescript
// backend/src/module/module.integration.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../common/prisma/prisma.service';
import { createMockUser, createSuperAdmin } from '../common/testing';

describe('ModuleController (Integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let adminToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ 
      whitelist: true, 
      transform: true,
      forbidNonWhitelisted: true 
    }));
    await app.init();

    prisma = app.get(PrismaService);

    // Login to get auth tokens
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'E7HHpQcEFezE4OAa1!' });
    authToken = loginRes.body.data.accessToken;

    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'superadmin', password: 'SuperAdminPass!' });
    adminToken = adminLogin.body.data.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean test data - use transaction for speed
    await prisma.$transaction([
      prisma.module.deleteMany({ where: { code: { startsWith: 'TEST-' } } }),
      // Add other cleanup as needed
    ]);
  });

  describe('POST /api/v1/module', () => {
    it('creates resource with valid data', async () => {
      const dto = { code: 'TEST-001', name: 'Test Resource' };
      
      const res = await request(app.getHttpServer())
        .post('/api/v1/module')
        .set('Authorization', `Bearer ${authToken}`)
        .send(dto)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.code).toBe('TEST-001');
    });

    it('returns 400 for duplicate code', async () => {
      await prisma.module.create({ data: { code: 'DUP', name: 'Existing' } });
      
      await request(app.getHttpServer())
        .post('/api/v1/module')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ code: 'DUP', name: 'Duplicate' })
        .expect(400);
    });

    it('returns 400 for invalid DTO', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/module')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ invalid: 'data' })
        .expect(400);
    });

    it('returns 401 without auth', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/module')
        .send({ code: 'TEST', name: 'Test' })
        .expect(401);
    });
  });

  describe('GET /api/v1/module', () => {
    it('returns paginated results', async () => {
      await prisma.module.createMany({
        data: [
          { code: 'TEST-1', name: 'Test 1' },
          { code: 'TEST-2', name: 'Test 2' },
        ],
      });

      const res = await request(app.getHttpServer())
        .get('/api/v1/module?page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta.total).toBe(2);
    });

    it('supports filtering', async () => {
      await prisma.module.createMany({
        data: [
          { code: 'TEST-A', name: 'Test A', companyId: 'company-1' },
          { code: 'TEST-B', name: 'Test B', companyId: 'company-2' },
        ],
      });

      const res = await request(app.getHttpServer())
        .get('/api/v1/module?companyId=company-1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].code).toBe('TEST-A');
    });
  });

  describe('PUT /api/v1/module/:id', () => {
    it('updates resource', async () => {
      const created = await prisma.module.create({
        data: { code: 'TEST-UPDATE', name: 'Original' },
      });

      const res = await request(app.getHttpServer())
        .put(`/api/v1/module/${created.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated Name' })
        .expect(200);

      expect(res.body.data.name).toBe('Updated Name');
    });

    it('returns 404 for non-existent', async () => {
      await request(app.getHttpServer())
        .put('/api/v1/module/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated' })
        .expect(404);
    });
  });

  describe('DELETE /api/v1/module/:id', () => {
    it('soft deletes resource', async () => {
      const created = await prisma.module.create({
        data: { code: 'TEST-DELETE', name: 'To Delete' },
      });

      const res = await request(app.getHttpServer())
        .delete(`/api/v1/module/${created.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);

      // Verify soft delete
      const deleted = await prisma.module.findUnique({ where: { id: created.id } });
      expect(deleted?.deletedAt).not.toBeNull();
    });
  });
});
```

---

## 4. Database Transaction Testing

### Testing Transaction Rollback

```typescript
it('rolls back on service error', async () => {
  // Arrange - setup data that will cause service to fail
  const dto = { /* invalid data that causes service to throw */ };
  
  // Spy on audit service
  const auditSpy = jest.spyOn(auditService, 'record');
  
  // Act & Assert
  await expect(service.create(invalidDto, user)).rejects.toThrow(BadRequestException);
  
  // Verify no audit log was created (transaction rolled back)
  expect(auditService.record).not.toHaveBeenCalled();
  
  // Verify no data persisted
  const count = await prisma.module.count({ where: { code: 'TEST-ROLLBACK' } });
  expect(count).toBe(0);
});
```

### Testing Transactional Audit Logs

```typescript
it('creates audit log within transaction', async () => {
  const dto = { /* valid DTO */ };
  
  await service.create(dto, user);
  
  // Verify audit log created within same transaction
  const auditLog = await prisma.auditLog.findFirst({
    where: { 
      entity: 'Entity',
      action: 'CREATE',
      userId: user.id,
    },
    orderBy: { createdAt: 'desc' },
  });
  
  expect(auditLog).not.toBeNull();
  expect(auditLog.entityId).toBe(result.data.id);
});
```

---

## 5. Database Constraint Testing

### Unique Constraints

```typescript
it('enforces unique constraint on code per company', async () => {
  await prisma.module.create({
    data: { companyId: 'company-1', code: 'DUP', name: 'First' },
  });

  await expect(
    prisma.module.create({ data: { companyId: 'company-1', code: 'DUP', name: 'Second' } })
  ).rejects.toThrow(); // Prisma P2002 error
});
```

### Foreign Key Constraints

```typescript
it('enforces foreign key on companyId', async () => {
  await expect(
    prisma.module.create({ 
      data: { companyId: 'non-existent-company', code: 'TEST', name: 'Test' } 
    })
  ).rejects.toThrow(); // Prisma P2003 error
});
```

### Soft Delete Behavior

```typescript
it('excludes soft-deleted records from default queries', async () => {
  const created = await prisma.module.create({ data: { code: 'SOFT', name: 'Soft' } });
  await prisma.module.update({ where: { id: created.id }, data: { deletedAt: new Date() } });

  const found = await prisma.module.findUnique({ where: { id: created.id } });
  expect(found).not.toBeNull(); // Still exists

  const defaultQuery = await prisma.module.findMany();
  expect(defaultQuery.find(r => r.id === created.id)).toBeUndefined(); // Excluded by default

  const withDeleted = await prisma.module.findMany({ where: { deletedAt: { not: null } } });
  expect(withDeleted.find(r => r.id === created.id)).not.toBeUndefined();
});
```

---

## 6. Concurrent Operations Testing

### Testing Optimistic Locking

```typescript
it('handles concurrent updates with version conflict', async () => {
  const created = await prisma.module.create({ data: { code: 'CONCURRENT', name: 'Original', version: 1 } });

  // Simulate two concurrent updates
  const update1 = prisma.module.update({
    where: { id: created.id, version: 1 },
    data: { name: 'Update 1', version: 2 },
  });
  
  const update2 = prisma.module.update({
    where: { id: created.id, version: 1 }, // Stale version
    data: { name: 'Update 2', version: 2 },
  });

  const results = await Promise.allSettled([update1, update2]);
  
  // One should succeed, one should fail
  const successCount = results.filter(r => r.status === 'fulfilled').length;
  expect(successCount).toBe(1);
});
```

---

## 6. Running Integration Tests

```bash
# Run all integration tests
cd backend
npm run test:integration

# Run specific integration test
npx jest --config jest.config.js --testPathPattern=integration.spec.ts

# Run with verbose output
npx jest --config jest.config.js --testPathPattern=integration.spec.ts --verbose
```

---

## 7. CI/CD Integration

```yaml
# .github/workflows/integration-tests.yml
name: Integration Tests

on: [push, pull_request]

jobs:
  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: postgres
        ports:
          - 5432:5432
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
      - run: cd backend && npm ci
      - run: cd backend && npx prisma generate
      - run: cd backend && npm run test:integration
```

---

## 7. Best Practices

### Do

```typescript
// ✅ Use isolated test databases
// ✅ Clean up test data in beforeEach/afterEach
// ✅ Test both success and error paths
// ✅ Verify database state after operations
// ✅ Test authorization at API level
// ✅ Test database constraints
// ✅ Test transaction rollback
// ✅ Test concurrent operations
```

### Don't

```typescript
// ❌ Don't use production database
// ❌ Don't leave test data in database
// ❌ Don't skip error case testing
// ❌ Don't assume test execution order
// ❌ Don't share test data between tests
// ❌ Don't test implementation details
// ❌ Don't use production credentials
```

---

## 6. Running Integration Tests

```bash
# Run all integration tests
cd backend
npm run test:integration

# Run specific integration test
npx jest --config jest.config.js --testPathPattern=integration.spec.ts

# Run with verbose output
npx jest --config jest.config.js --testPathPattern=integration.spec.ts --verbose
```

---

## 8. Troubleshooting

| Issue | Solution |
|-------|----------|
| `P1001` Can't reach database | Check PostgreSQL is running, check `DATABASE_URL` |
| `P2002` Unique constraint violation | Clean test data in `beforeEach`, use unique codes |
| `P2003` Foreign key violation | Ensure referenced records exist |
| `P2025` Record not found | Check if record was soft-deleted |
| Tests timeout | Increase Jest timeout: `jest.setTimeout(30000)` |
| Migration fails | Check `prisma migrate deploy` logs |

---

## 8. Resources

- [NestJS Testing Docs](https://docs.nestjs.com/fundamentals/testing)
- [Prisma Testing](https://www.prisma.io/docs/guides/testing)
- [Supertest](https://github.com/visionmedia/supertest)
- [Jest Docs](https://jestjs.io/docs/getting-started)

---

**Document Control:**
- Version: 1.0
- Last Updated: 2026-11-18
- Next Review: Sprint Planning
- Owner: QA Team