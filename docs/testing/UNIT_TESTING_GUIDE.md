# Sana HRMS - Unit Testing Guide

**Version:** 1.0  
**Date:** 2026-11-18  
**Audience:** Backend/Frontend Developers, QA Engineers

---

## 1. Overview

This guide establishes conventions, patterns, and best practices for writing unit tests in the Sana HRMS project.

### Testing Stack

| Layer | Tool | Purpose |
|-------|------|---------|
| Backend Unit | Jest + ts-jest | Service, controller, guard, pipe, interceptor tests |
| Backend Integration | Jest + Prisma | Database integration tests with isolated DB |
| Frontend Unit | Vitest + React Testing Library | Component, hook, utility tests |
| E2E | Playwright | Full user journey tests |
| Accessibility | axe-core/Playwright | WCAG 2.1 AA compliance |

---

## 2. Backend Unit Testing

### 2.1 Project Structure

```
backend/src/
├── module/
│   ├── service.ts
│   ├── service.spec.ts          # Unit tests for service
│   ├── controller.spec.ts       # Controller tests
│   └── module.integration.spec.ts # Integration tests
└── common/
    └── testing/
        ├── prisma-mock.ts       # Prisma mock factory
        ├── test-factories.ts    # Test data builders
        ├── mock-auth-user.ts    # AuthenticatedUser mocks
        ├── mock-access.ts       # AccessService mock
        ├── mock-audit.ts        # AuditService mock
        └── index.ts
```

### 2.2 Writing a Service Unit Test

#### Template

```typescript
// backend/src/module/service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ModuleService } from './service';
import { PrismaService } from '../common/prisma/prisma.service';
import { AccessService } from '../common/access/access.service';
import { AuditService } from '../common/audit/audit.service';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { createMockPrisma, createMockAccess, createMockAudit, createMockUser } from '../common/testing';

describe('ModuleService', () => {
  let service: ModuleService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let access: ReturnType<typeof createMockAccess>;
  let audit: ReturnType<typeof createMockAudit>;
  let user: AuthenticatedUser;

  beforeEach(async () => {
    prisma = createMockPrisma();
    access = createMockAccess();
    audit = createMockAudit();
    user = createMockUser({ id: 'user-1', isSuperAdmin: false });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModuleService,
        { provide: PrismaService, useValue: prisma },
        { provide: AccessService, useValue: access },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<ModuleService>(ModuleService);
  });

  describe('methodName', () => {
    it('should succeed with valid input', async () => {
      // Arrange
      const dto = { /* valid DTO */ };
      prisma.model.findUnique.mockResolvedValue({ id: '1', ...dto });
      prisma.model.create.mockResolvedValue({ id: '1', ...dto });

      // Act
      const result = await service.methodName(dto, user);

      // Assert
      expect(result).toEqual({ data: { id: '1', ...dto }, success: true, timestamp: expect.any(String) });
      expect(prisma.model.create).toHaveBeenCalledWith(expect.objectContaining({ data: dto }));
      expect(audit.record).toHaveBeenCalledWith(user.id, expect.objectContaining({
        action: AuditAction.CREATE,
        entity: 'Entity',
      }));
    });

    it('should throw NotFoundException for non-existent record', async () => {
      // Arrange
      prisma.model.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.methodName({ id: 'non-existent' }, user))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for unauthorized access', async () => {
      // Arrange
      access.canAccessResource.mockResolvedValue(false);
      prisma.model.findUnique.mockResolvedValue({ id: '1', companyId: 'other-company' });

      // Act & Assert
      await expect(service.methodName({ id: '1' }, user))
        .rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException for invalid input', async () => {
      // Act & Assert
      await expect(service.methodName({ invalidField: 'value' }, user))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for duplicate resource', async () => {
      prisma.model.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(service.methodName({ code: 'DUPLICATE' }, user))
        .rejects.toThrow(ConflictException);
    });

    it('should rollback on database error', async () => {
      prisma.model.create.mockRejectedValue(new Error('DB error'));

      await expect(service.methodName({ valid: 'data' }, user))
        .rejects.toThrow('DB error');
      
      expect(audit.record).not.toHaveBeenCalled();
    });
  });
});
```

### 2.3 Test Utilities

#### `backend/src/common/testing/prisma-mock.ts`

```typescript
import { PrismaClient } from '@prisma/client';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';

export function createMockPrisma(): DeepMockProxy<PrismaClient> {
  return mockDeep<PrismaClient>({
    // Default mock implementations
    $transaction: jest.fn(async (callback) => callback(mockDeep<PrismaClient>())),
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
  });
}

export function createMockPrismaWithTransaction(): DeepMockProxy<PrismaClient> {
  const mock = createMockPrisma();
  mock.$transaction.mockImplementation(async (callback) => {
    const txMock = createMockPrisma();
    return callback(txMock);
  });
  return mock;
}
```

#### `backend/src/common/testing/test-factories.ts`

```typescript
import { faker } from '@faker-js/faker';
import { Prisma } from '@prisma/client';

export class EmployeeFactory {
  static build(overrides: Partial<Prisma.EmployeeCreateInput> = {}): Prisma.EmployeeCreateInput {
    return {
      companyId: 'company-1',
      code: `EMP-${faker.string.alphanumeric(6).toUpperCase()}`,
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      nationalId: faker.string.numeric(10),
      mobile: `09${faker.string.numeric(9)}`,
      email: faker.internet.email(),
      employmentType: 'PERMANENT',
      hireDate: faker.date.past({ years: 5 }),
      monthlyBaseSalary: faker.number.int({ min: 50000000, max: 500000000 }),
      isContractor: false,
      status: 'ACTIVE',
      ...overrides,
    };
  }

  static buildMany(count: number, overrides: Partial<Prisma.EmployeeCreateInput> = {}) {
    return Array.from({ length: count }, () => this.build(overrides));
  }
}

export class LeaveRequestFactory {
  static build(overrides: Partial<Prisma.LeaveRequestCreateInput> = {}) {
    const startAt = faker.date.future();
    const endAt = faker.date.soon({ days: 7, refDate: startAt });
    
    return {
      employeeId: 'emp-1',
      leaveTypeId: 'leave-type-1',
      startAt,
      endAt,
      durationMinutes: 480,
      reason: faker.lorem.sentence(),
      status: 'DRAFT',
      ...overrides,
    };
  }
}

export class AttendanceEventFactory {
  static build(overrides: Partial<Prisma.AttendanceEventCreateInput> = {}) {
    return {
      employeeId: 'emp-1',
      type: 'IN',
      eventTime: new Date(),
      source: 'DEVICE',
      idempotencyKey: `emp-1-${new Date().toISOString().split('T')[0]}-IN`,
      ...overrides,
    };
  }
}

export class LeaveTypeFactory {
  static build(overrides: Partial<Prisma.LeaveTypeCreateInput> = {}) {
    return {
      code: 'ANNUAL',
      name: 'Annual Leave',
      companyId: 'company-1',
      annualQuotaMinutes: 12480,
      isPaid: true,
      requiresApproval: true,
      ...overrides,
    };
  }
}
```

#### `backend/src/common/testing/mock-auth-user.ts`

```typescript
import { AuthenticatedUser } from '../decorators/current-user.decorator';

export function createMockUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: 'user-1',
    username: 'testuser',
    fullName: 'Test User',
    email: 'test@example.com',
    mobile: '09123456789',
    isSuperAdmin: false,
    employeeId: 'emp-1',
    roleIds: [],
    roleCodes: [],
    permissions: ['employees.view', 'employees.create', 'employees.update'],
    scope: {
      unrestricted: false,
      companyIds: ['company-1'],
      branchIds: [],
      orgUnitIds: [],
      employeeIds: [],
      ownEmployeeId: 'emp-1',
    },
    ...overrides,
  };
}

export function createSuperAdmin(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return createMockUser({
    id: 'super-admin',
    username: 'superadmin',
    fullName: 'Super Admin',
    isSuperAdmin: true,
    scope: {
      unrestricted: true,
      companyIds: [],
      branchIds: [],
      orgUnitIds: [],
      employeeIds: [],
      ownEmployeeId: null,
    },
    ...overrides,
  });
}

export function createEmployeeUser(employeeId: string, overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return createMockUser({
    employeeId,
    ownEmployeeId: employeeId,
    ...overrides,
  });
}
```

#### `backend/src/common/testing/mock-access.ts`

```typescript
import { AccessService } from '../access/access.service';

export function createMockAccess(overrides: Partial<jest.Mocked<AccessService>> = {}) {
  return {
    assertCompanyAccess: jest.fn().mockResolvedValue(undefined),
    assertEmployeeAccess: jest.fn().mockResolvedValue(undefined),
    assertEmployeeRelations: jest.fn().mockResolvedValue(undefined),
    assertEmployeeMutable: jest.fn().mockResolvedValue(undefined),
    assertGrantableRoles: jest.fn().mockResolvedValue(undefined),
    assertGrantableScopes: jest.fn().mockResolvedValue(undefined),
    canAccessEmployee: jest.fn().mockResolvedValue(true),
    employeeWhereFor: jest.fn().mockResolvedValue({}),
    companyWhereFor: jest.fn().mockResolvedValue({}),
    allowedCompanyIds: jest.fn().mockResolvedValue(['company-1']),
    allowedBranchIds: jest.fn().mockResolvedValue([]),
    allowedOrgUnitIds: jest.fn().mockResolvedValue([]),
    ...overrides,
  } as jest.Mocked<AccessService>;
}
```

#### `backend/src/common/testing/mock-audit.ts`

```typescript
import { AuditService, AuditAction } from '../audit/audit.service';

export function createMockAudit(overrides: Partial<jest.Mocked<AuditService>> = {}) {
  return {
    record: jest.fn().mockResolvedValue(undefined),
    recordInTransaction: jest.fn().mockResolvedValue(undefined),
    recordView: jest.fn().mockResolvedValue(undefined),
    recordExport: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as jest.Mocked<AuditService>;
}
```

#### `backend/src/common/testing/index.ts`

```typescript
export * from './prisma-mock';
export * from './test-factories';
export * from './mock-auth-user';
export * from './mock-access';
export * from './mock-audit';
```

---

## 3. Controller Tests

```typescript
// backend/src/module/controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ModuleController } from './controller';
import { ModuleService } from './service';
import { createMockModuleService } from '../common/testing';

describe('ModuleController', () => {
  let controller: ModuleController;
  let service: jest.Mocked<ModuleService>;

  beforeEach(async () => {
    const mockService = createMockModuleService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ModuleController],
      providers: [{ provide: ModuleService, useValue: mockService }],
    }).compile();

    controller = module.get<ModuleController>(ModuleController);
    service = module.get(ModuleService);
  });

  describe('create', () => {
    it('should create resource and return 201', async () => {
      const dto = { code: 'TEST', name: 'Test' };
      const result = { data: { id: '1', ...dto }, success: true, timestamp: new Date().toISOString() };
      service.create.mockResolvedValue(result);

      const result = await controller.create({ user: createMockUser() } as any, dto as any);

      expect(result).toEqual(result);
      expect(service.create).toHaveBeenCalledWith(dto, expect.any(Object));
    });

    it('should throw BadRequestException for invalid DTO', async () => {
      const dto = { invalid: 'data' };
      service.create.mockRejectedValue(new BadRequestException('Invalid data'));

      await expect(controller.create({ user: createMockUser() } as any, dto as any))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return paginated results', async () => {
      const pagination = { page: 1, limit: 20, skip: 0 };
      const result = { data: [{ id: '1' }], meta: { total: 1, page: 1, limit: 20, totalPages: 1, hasNext: false, hasPrev: false } };
      service.list.mockResolvedValue(result);

      const result = await controller.findAll(pagination, { user: createMockUser() } as any);

      expect(result).toEqual(result);
      expect(service.list).toHaveBeenCalledWith(pagination, expect.any(Object));
    });
  });
});
```

---

## 4. Guard & Pipe Tests

```typescript
// backend/src/common/guards/permissions.guard.spec.ts
import { PermissionsGuard } from './permissions.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: jest.Mocked<Reflector>;
  let context: jest.Mocked<ExecutionContext>;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() } as any;
    guard = new PermissionsGuard(reflector);
    
    const request = { user: createMockUser({ permissions: ['employees.view'] }) };
    context = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as any;
  });

  it('allows access when user has required permission', () => {
    reflector.getAllAndOverride.mockReturnValue(['employees.view']);
    
    expect(() => guard.canActivate(context)).not.toThrow();
  });

  it('denies access when user lacks permission', () => {
    reflector.getAllAndOverride.mockReturnValue(['employees.delete']);
    
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('allows superadmin access', () => {
    const superAdminContext = {
      ...context,
      switchToHttp: () => ({ getRequest: () => ({ user: createSuperAdmin() }) }),
    };
    reflector.getAllAndOverride.mockReturnValue(['superadmin.only']);
    
    expect(() => guard.canActivate(superAdminContext)).not.toThrow();
  });
});
```

---

## 4. Frontend Unit Testing (Vitest + React Testing Library)

### Setup

```json
// frontend/package.json
{
  "devDependencies": {
    "vitest": "^2.0.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.5.0",
    "@testing-library/jest-dom": "^6.4.0",
    "jsdom": "^24.0.0",
    "msw": "^2.3.0"
  }
}
```

```typescript
// frontend/vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        statements: 70,
        branches: 65,
        functions: 70,
        lines: 70,
      },
    },
  },
});
```

```typescript
// frontend/tests/setup.ts
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
```

### Component Test Example

```tsx
// frontend/src/components/ChangePassword.test.tsx
import { test, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChangePassword } from './ChangePassword';
import { AuthProvider } from '../lib/auth';

// Mock dependencies
vi.mock('../lib/api', () => ({
  api: {
    post: vi.fn(),
  },
  apiErrorMessage: (e: any) => e.response?.data?.message ?? 'Error',
}));

vi.mock('../lib/auth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', username: 'test', fullName: 'Test User' },
    logout: vi.fn(),
  }),
}));

const renderWithProviders = (component: React.ReactNode) => {
  return render(<AuthProvider>{component}</AuthProvider>);
};

test('shows strength meter for weak password', async () => {
  const user = userEvent.setup();
  renderWithProviders(<ChangePassword />);

  // Open modal
  await user.click(screen.getByTitle('تغییر گذرواژهٔ من'));
  
  // Enter weak password
  await user.type(screen.getByRole('textbox', { name: /گذرواژهٔ جدید/i }), '123');
  
  await expect(screen.getByText('بسیار ضعیف')).toBeVisible();
});

test('shows strength meter for strong password', async () => {
  const user = userEvent.setup();
  renderWithProviders(<ChangePassword />);

  await user.click(screen.getByTitle('تغییر گذرواژهٔ من'));
  await user.type(screen.getByRole('textbox', { name: /گذرواژهٔ جدید/i }), 'Str0ng!Passw0rd');
  
  await expect(screen.getByText('قوی')).toBeVisible();
});

test('requires current password', async () => {
  const user = userEvent.setup();
  renderWithProviders(<ChangePassword />);

  await user.click(screen.getByTitle('تغییر گذرواژهٔ من'));
  await user.type(screen.getByRole('textbox', { name: /گذرواژهٔ جدید/i }), 'NewStr0ng!Pass');
  await user.type(screen.getByRole('textbox', { name: /تکرار گذرواژه/i }), 'NewStr0ng!Pass');
  await user.click(screen.getByRole('button', { name: /ذخیره/i }));

  await expect(screen.getByText('رمز فعلی الزامی است')).toBeVisible();
});

test('successful password change logs out user', async () => {
  const user = userEvent.setup();
  const { api } = await import('../lib/api');
  
  renderWithProviders(<ChangePassword />);

  await user.click(screen.getByTitle('تغییر گذرواژهٔ من'));
  await user.type(screen.getByRole('textbox', { name: /رمز فعلی/i }), 'OldPass123!');
  await user.type(screen.getByRole('textbox', { name: /گذرواژهٔ جدید/i }), 'NewStr0ng!Pass');
  await user.type(screen.getByRole('textbox', { name: /تکرار گذرواژه/i }), 'NewStr0ng!Pass');
  await user.click(screen.getByRole('button', { name: /ذخیره/i }));

  await waitFor(() => {
    expect(api.post).toHaveBeenCalledWith('/auth/change-password', {
      currentPassword: 'OldPass123!',
      newPassword: 'NewStr0ng!Pass',
    });
  });
});
```

### Hook Testing

```ts
// frontend/src/lib/useDeadlineClock.test.ts
import { test, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDeadlineClock } from './useDeadlineClock';

test('countdown calculates correctly', () => {
  const end = Date.parse('2026-11-18T20:30:00Z');
  const now = Date.parse('2026-11-15T20:30:00Z');
  
  vi.useFakeTimers();
  vi.setSystemTime(new Date(now));
  
  const { result } = renderHook(() => useDeadlineClock(true));
  
  expect(result.current.deadline).toBe(end);
  expect(result.current.text).toBe('72:00:00');
  expect(result.current.urgent).toBe(false);
  
  act(() => {
    vi.advanceTimersByTime(24 * 60 * 60 * 1000); // 24 hours
  });
  
  expect(result.current.urgent).toBe(true);
  expect(result.current.text).toBe('48:00:00');
});

test('returns null for finished tasks', () => {
  const end = Date.parse('2026-11-15T20:30:00Z');
  const now = Date.parse('2026-11-15T20:30:00Z');
  
  vi.useFakeTimers();
  vi.setSystemTime(new Date(now));
  
  const { result } = renderHook(() => useDeadlineClock(true));
  
  expect(result.current).toBeNull();
});
```

### Pure Function Tests (Node.js test runner)

```ts
// frontend/src/lib/format.test.ts
import { test, expect } from 'node:test';
import assert from 'node:assert/strict';
import { format } from './format';

test('toEnglishDigits converts Persian/Arabic digits', () => {
  assert.equal(format.toEnglishDigits('۱۴۰۵/٠٨/۲۴'), '1405/08/24');
  assert.equal(format.toPersianDigits(12345), '۱۲۳۴۵');
});

test('parseDateInput handles various formats', () => {
  assert.equal(format.parseDateInput('۱۴۰۵/۰۸/۲۴'), '2026-11-15');
  assert.equal(format.parseDateInput('14050824'), '2026-11-15');
  assert.equal(format.parseDateInput('2026-11-15'), '2026-11-15');
  assert.equal(format.parseDateInput(''), undefined);
  assert.equal(format.parseDateInput('invalid'), undefined);
});

test('isPastDueDate respects Tehran midnight', () => {
  const now = new Date('2026-11-15T14:00:00Z');
  assert.equal(format.isPastDueDate('2026-11-15', now), false);
  assert.equal(format.isPastDueDate('2026-11-14', now), true);
  assert.equal(format.isPastDueDate('2026-11-16', now), false);
});
```

---

## 5. Integration Tests

### Database Integration Test Template

```typescript
// backend/src/module/module.integration.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../common/prisma/prisma.service';
import { createMockUser, createSuperAdmin } from '../common/testing';

describe('ModuleController (Integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
    
    // Login to get auth token
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'E7HHpQcEFezE4OAa1!' });
    authToken = loginRes.body.data.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean test data
    await prisma.module.deleteMany({ where: { code: { startsWith: 'TEST-' } } });
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

    it('returns 401 without auth', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/module')
        .send({ code: 'TEST', name: 'Test' })
        .expect(401);
    });
  });
});
```

---

## 6. E2E Tests (Playwright)

### Test Structure

```
frontend/tests/e2e/
├── journeys.spec.ts      # 12 critical user journeys
├── accessibility.spec.ts # axe-core accessibility tests
├── security.spec.ts      # Security tests (new)
├── performance.spec.ts   # Performance tests (new)
└── fixtures/
    ├── test.pdf
    └── test.exe
```

### Adding New Journey Tests

```typescript
// frontend/tests/e2e/journeys.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Journey 13: New Feature Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.waitForSelector('input[placeholder="نام کاربری"]');
    await page.fill('input[placeholder="نام کاربری"]', 'admin');
    await page.fill('input[type="password"]', 'E7HHpQcEFezE4OAa1!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
  });

  test('complete new feature workflow', async ({ page }) => {
    await page.goto('/new-feature');
    await page.click('button:has-text("Create")');
    
    await page.fill('input[name="name"]', 'Test Item');
    await page.fill('input[name="description"]', 'Test description');
    await page.click('button:has-text("Save")');
    
    await expect(page.locator('text=Item created successfully')).toBeVisible();
  });
});
```

---

## 7. Running Tests

### Backend

```bash
# Run all backend tests
cd backend
npm test

# Run specific test file
npm test -- --testPathPattern=employees.service.spec.ts

# Run with coverage
npm run test:cov

# Run integration tests
npm run test:integration

# Watch mode
npm run test:watch
```

### Frontend

```bash
# Run all frontend tests
cd frontend
npm test

# Run E2E tests
npx playwright test

# Run with UI
npx playwright test --ui

# Run with coverage
npx vitest run --coverage
```

---

## 7. CI/CD Integration

```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: cd backend && npm ci
      - run: cd backend && npm run lint
      - run: cd backend && npm run test:cov
      - run: cd backend && npm run test:integration
      - name: Upload coverage
        uses: codecov/codecov-action@v3

  frontend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: cd frontend && npm ci
      - run: cd frontend && npm run lint
      - run: cd frontend && npm run test
      - run: cd frontend && npx playwright install --with-deps
      - run: cd frontend && npx playwright test
      - name: Upload Playwright report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: frontend/test-results/

  coverage-gates:
    needs: [backend-tests, frontend-tests]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: |
          # Verify coverage thresholds
          # This would be implemented with a script that parses coverage reports
```

---

## 11. Common Patterns & Anti-Patterns

### ✅ Do

```typescript
// ✅ Test actual behavior
it('should calculate overtime correctly', async () => {
  const result = await service.calculateOvertime(480, 540); // 8h -> 9h
  expect(result.overtimeMinutes).toBe(60);
});

// ✅ Test error cases with specific exceptions
it('should throw NotFoundException for missing employee', async () => {
  await expect(service.getEmployee('non-existent')).rejects.toThrow(NotFoundException);
});

// ✅ Test authorization
it('denies access to other company employees', async () => {
  access.canAccessEmployee.mockResolvedValue(false);
  await expect(service.getEmployee('emp-other')).rejects.toThrow(ForbiddenException);
});

// ✅ Test audit logging
it('records audit log on create', async () => {
  await service.create(dto, user);
  expect(audit.record).toHaveBeenCalledWith(user.id, expect.objectContaining({
    action: AuditAction.CREATE,
    entity: 'Entity',
  }));
```

### ❌ Don't

```typescript
// ❌ Don't test implementation details
it('should call prisma.create', async () => {
  await service.create(dto);
  expect(prisma.create).toHaveBeenCalled(); // Too coupled to implementation
});

// ❌ Don't test mocked functions only
it('should call service method', async () => {
  const spy = vi.spyOn(service, 'method');
  await controller.method(dto);
  expect(spy).toHaveBeenCalled(); // Tests nothing about behavior
});

// ❌ Don't test without assertions
it('should create user', async () => {
  await service.create(dto); // No assertions!
});

// ❌ Don't use arbitrary timeouts
it('should work', async () => {
  await new Promise(r => setTimeout(r, 5000)); // Flaky!
  await service.method();
```

---

## 7. Debugging Tests

```bash
# Run single test with debug output
npm test -- --testNamePattern="should create employee" --verbose

# Run with Node inspector
node --inspect-brk node_modules/.bin/jest --runInBand --testNamePattern="test name"

# Debug in VS Code: add to launch.json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Jest",
  "program": "${workspaceFolder}/backend/node_modules/.bin/jest",
  "args": ["--runInBand", "--testNamePattern", "test name"],
  "console": "integratedTerminal"
}
```

---

## 8. Performance Tips

1. **Use `--runInBand`** for integration tests to avoid DB connection pool exhaustion
2. **Mock external services** (email, SMS, file storage) in unit tests
3. **Use `jest-mock-extended`** for type-safe Prisma mocks
4. **Reuse test fixtures** - Create once in `beforeAll`, cleanup in `afterAll`
4. **Parallelize unit tests** - Jest does this by default
5. **Run integration tests sequentially** - Use `--runInBand` for DB tests

---

## 9. Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Vitest Guide](https://vitest.dev/guide/)
- [Playwright](https://playwright.dev/docs/intro)
- [axe-core](https://github.com/dequelabs/axe-core)
- [MSW - API Mocking](https://mswjs.io/docs/getting-started)
- [Stryker Mutation Testing](https://stryker-mutator.io/docs/stryker-js/quickstart/)

---

**Document Control:**
- Version: 1.0
- Last Updated: 2026-11-18
- Next Review: Sprint Planning
- Owner: QA Team