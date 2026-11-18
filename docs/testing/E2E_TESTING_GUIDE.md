# Sana HRMS - E2E Testing Guide

**Version:** 1.0  
**Date:** 2026-11-18  
**Audience:** QA Engineers, Frontend Developers

---

## 1. Overview

End-to-End (E2E) tests verify complete user workflows from UI to database. The project uses **Playwright** with **TypeScript** for E2E testing.

### Test Stack

| Tool | Version | Purpose |
|------|---------|---------|
| Playwright | ^1.65.1 | Browser automation |
| @playwright/test | ^1.65.1 | Test runner |
| @axe-core/playwright | ^4.14.0 | Accessibility testing |
| playwright-chromium | Built-in | Chromium browser |

---

## 2. Project Structure

```
frontend/tests/e2e/
├── journeys.spec.ts      # 12 critical user journeys (482 lines)
├── accessibility.spec.ts # axe-core accessibility tests (34 routes)
├── security.spec.ts      # Security tests (planned)
├── performance.spec.ts   # Performance tests (planned)
├── fixtures/
│   ├── test.pdf          # Valid PDF for upload tests
│   └── test.exe          # Invalid file for rejection tests
├── fixtures/
│   ├── test-users.ts     # Test user credentials
│   └── test-data.ts      # Test data factories
├── page-objects/         # Page Object Models (planned)
│   ├── login.page.ts
│   ├── employees.page.ts
│   └── ...
└── utils/
    ├── auth-helpers.ts
    └── test-data.ts
```

---

## 3. Current Test Coverage

### Existing Journey Tests (12 Journeys)

| Journey | Description | Scenarios |
|---------|-------------|-----------|
| **Journey 1** | Login, Failed Login, Lockout, Logout, Session Expiry | 5 tests |
| **Journey 2** | Password Change with Persian Feedback | 3 tests |
| **Journey 3** | Employee CRUD (Create, Duplicate, Search, Filter, Sort, Soft Delete) | 5 tests |
| **Journey 4** | Shift Assignment & Attendance | 2 tests |
| **Journey 5** | Leave Request Flow | 2 tests |
| **Journey 6** | Payroll Period | 2 tests |
| **Journey 7** | Contract Versioning | 1 test |
| **Journey 8** | Document Upload (valid, invalid, download) | 3 tests |
| **Journey 9** | Error Boundary | 1 test (skipped) |
| **Journey 9** | Theme Switching | 1 test |
| **Journey 10** | Keyboard Navigation | 1 test |
| **Journey 12** | Responsive Design (mobile, tablet, desktop) | 3 tests |

**Total: ~34 E2E test cases**

---

## 3. Running E2E Tests

### Prerequisites

```bash
# Install dependencies
cd frontend
npm ci

# Install Playwright browsers
npx playwright install --with-deps
```

### Running Tests

```bash
# Run all E2E tests
cd frontend
npx playwright test

# Run specific test file
npx playwright test journeys.spec.ts

# Run with UI mode (interactive)
npx playwright test --ui

# Run headed (visible browser)
npx playwright test --headed

# Run specific test by name
npx playwright test -g "successful login"

# Run with specific browser
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit

# Run with retries
npx playwright test --retries=2

# Generate HTML report
npx playwright show-report
```

### Debugging Tests

```bash
# Debug mode (opens browser with inspector)
npx playwright test --debug

# Debug specific test
npx playwright test --debug -g "successful login"

# Trace viewer (after test failure)
npx playwright show-trace trace.zip
```

---

## 4. Writing New E2E Tests

### 3.1 Test Structure

```typescript
// frontend/tests/e2e/journeys.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Journey N: Feature Name', () => {
  // Setup - runs before each test
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.waitForSelector('input[placeholder="نام کاربری"]');
    await page.fill('input[placeholder="نام کاربری"]', 'admin');
    await page.fill('input[type="password"]', 'E7HHpQcEFezE4OAa1!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
  });

  test('descriptive test name', async ({ page }) => {
    // Navigate to feature
    await page.goto('/feature');
    
    // Perform actions
    await page.click('button:has-text("Create")');
    await page.fill('input[name="name"]', 'Test Item');
    await page.click('button:has-text("Save")');
    
    // Assertions
    await expect(page.locator('text=Item created successfully')).toBeVisible();
  });
});
```

### 3.2 Test Patterns

#### Login Helper

```typescript
async function login(page, role = 'admin') {
  const credentials = {
    admin: { username: 'admin', password: 'E7HHpQcEFezE4OAa1!' },
    hrAdmin: { username: 'hradmin_comp-001', password: 'SanaDemo@1404' },
    manager: { username: 'mgr_hq_comp-001', password: 'SanaDemo@1404' },
    employee: { username: 'emp-001', password: 'SanaDemo@1404' },
  };

  const creds = credentials[role] || credentials.admin;
  
  await page.goto('/login');
  await page.waitForSelector('input[placeholder="نام کاربری"]');
  await page.fill('input[placeholder="نام کاربری"]', credentials[role].username);
  await page.fill('input[type="password"]', credentials[role].password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/');
}
```

#### Navigation Helpers

```typescript
// Navigate to page and wait for load
async function gotoPage(page, path) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}

// Fill form and submit
async function fillAndSubmit(page, formData, submitText = 'ذخیره') {
  for (const [field, value] of Object.entries(formData)) {
    const selector = `input[name="${field}"], select[name="${field}"], textarea[name="${field}"]`;
    const element = page.locator(selector).first();
    if (await element.isVisible()) {
      if (await element.getAttribute('type') === 'checkbox') {
        await page.check(selector);
      } else if (await element.evaluate(el => el.tagName === 'SELECT')) {
        await page.selectOption(selector, value);
      } else {
        await page.fill(selector, value);
      }
    }
  }
  await page.click(`button:has-text("${submitText}")`);
}
```

#### Assertion Helpers

```typescript
// Expect toast notification
async function expectToast(page, message) {
  await expect(page.locator(`text=${message}`)).toBeVisible({ timeout: 5000 });
}

// Expect element to be visible
async function expectVisible(page, text) {
  await expect(page.locator(`text=${text}`)).toBeVisible();
}

// Expect element to be hidden
async function expectHidden(page, text) {
  await expect(page.locator(`text=${text}`)).toBeHidden();
}
```

---

## 4. Page Object Models (Recommended)

### Page Object Pattern

```typescript
// frontend/tests/e2e/page-objects/login.page.ts
import { Page, Locator, expect } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.usernameInput = page.locator('input[placeholder="نام کاربری"]');
    this.passwordInput = page.locator('input[type="password"]');
    this.submitButton = page.locator('button[type="submit"]');
    this.errorMessage = page.locator('text=نام کاربری یا رمز عبور اشتباه است');
  }

  async goto() {
    await this.page.goto('/login');
    await this.page.waitForLoadState('networkidle');
  }

  async login(username: string, password: string) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async expectError(message: string) {
    await expect(this.errorMessage).toContainText(message);
  }

  async expectSuccess() {
    await expect(this.page).toHaveURL('/');
  }
}
```

### Usage in Tests

```typescript
test('successful login', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login('admin', 'E7HHpQcEFezE4OAa1!');
  await loginPage.expectSuccess();
});
```

---

## 4. Test Data Management

### Test Data Factory

```typescript
// frontend/tests/e2e/fixtures/test-data.ts
export const testEmployees = [
  { code: 'TEST-001', firstName: 'تست', lastName: 'کارمند', nationalId: '9999999999' },
  { code: 'TEST-002', firstName: 'تست۲', lastName: 'کارمند۲', nationalId: '8888888888' },
];

export const testLeaves = [
  { leaveTypeId: 'ANNUAL', startAt: '1403-06-01T08:00', endAt: '1403-06-05T16:00', reason: 'مرخصی تابستانی' },
];

export const testMissions = [
  { title: 'مأموریت تست', destination: 'تهران', startAt: '1403-06-01T08:00', endAt: '1403-06-05T16:00', estimatedCost: 5000000 },
];
```

### Database Cleanup

```typescript
// frontend/tests/e2e/utils/db-helpers.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function cleanupTestData() {
  await prisma.employee.deleteMany({ where: { code: { startsWith: 'TEST-' } } });
  await prisma.leaveRequest.deleteMany({ where: { reason: { contains: 'تست' } } });
  await prisma.mission.deleteMany({ where: { title: { contains: 'تست' } } });
  await prisma.document.deleteMany({ where: { title: { contains: 'تست' } } });
}
```

---

## 5. Accessibility Testing

### axe-core Integration

```typescript
// frontend/tests/e2e/accessibility.spec.ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility Audit', () => {
  const routes = [
    { path: '/login', name: 'Login', auth: false },
    { path: '/', name: 'Dashboard', auth: true },
    // ... 34 routes
  ];

  for (const route of routes) {
    test(`${route.name} - no critical/serious violations`, async ({ page }) => {
      if (route.auth) {
        await login(page, 'admin');
      } else {
        await page.goto(route.path);
      }

      await page.waitForLoadState('networkidle');
      
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'])
        .analyze();
      
      const criticalSerious = results.violations.filter(v => 
        v.impact === 'critical' || v.impact === 'serious'
      );
      
      expect(criticalSerious.length).toBe(0);
    });
  }
});
```

### Running Accessibility Tests

```bash
# Run accessibility tests only
npx playwright test accessibility.spec.ts

# Run with specific route
npx playwright test -g "Dashboard"
```

---

## 4. Security Testing

### Planned Security Tests

```typescript
// frontend/tests/e2e/security.spec.ts (planned)
import { test, expect } from '@playwright/test';

test.describe('Security Tests', () => {
  test('prevents XSS in input fields', async ({ page }) => {
    await page.goto('/employees');
    await page.click('button:has-text("افزودن نیرو")');
    await page.fill('input[name="firstName"]', '<script>alert("xss")</script>');
    await page.click('button:has-text("ذخیره")');
    
    // Should not execute script
    await expect(page.locator('text=<script>')).toBeVisible(); // Escaped
  });

  test('prevents SQL injection in search', async ({ page }) => {
    await page.goto('/employees');
    await page.fill('input[placeholder*="جستجو"]', "' OR '1'='1");
    await expect(page.locator('text=داده‌ای یافت نشد')).toBeVisible();
  });

  test('prevents IDOR', async ({ page }) => {
    await login(page, 'employee');
    await page.goto('/employees/other-employee-id');
    await expect(page.locator('text=دسترسی غیرمجاز')).toBeVisible();
  });

  test('rate limiting on login', async ({ page }) => {
    for (let i = 0; i < 6; i++) {
      await page.goto('/login');
      await page.fill('input[placeholder="نام کاربری"]', 'admin');
      await page.fill('input[type="password"]', 'wrong');
      await page.click('button[type="submit"]');
    }
    await expect(page.locator('text=حساب موقتاً قفل شد')).toBeVisible();
  });
});
```

---

## 5. Performance Testing

```typescript
// frontend/tests/e2e/performance.spec.ts (planned)
import { test, expect } from '@playwright/test';

test.describe('Performance', () => {
  test('dashboard loads within 3 seconds', async ({ page }) => {
    await login(page, 'admin');
    
    const start = Date.now();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const duration = Date.now() - start;
    
    expect(duration).toBeLessThan(3000);
  });

  test('employee list loads within 2 seconds', async ({ page }) => {
    await login(page, 'admin');
    
    const start = Date.now();
    await page.goto('/employees');
    await page.waitForLoadState('networkidle');
    const duration = Date.now() - start;
    
    expect(duration).toBeLessThan(2000);
  });
});
```

---

## 6. CI/CD Integration

```yaml
# .github/workflows/e2e-tests.yml
name: E2E Tests

on: [push, pull_request]

jobs:
  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: cd frontend && npm ci
      - run: cd frontend && npx playwright install --with-deps
      - run: cd frontend && npx playwright test
      - name: Upload Playwright report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: frontend/test-results/
          retention-days: 7
```

---

## 6. Debugging Tips

### Common Issues

| Issue | Solution |
|-------|----------|
| Element not found | Use `page.waitForSelector()` before interacting |
| Flaky tests | Add `await page.waitForLoadState('networkidle')` |
| Element not clickable | Use `element.scrollIntoViewIfNeeded()` |
| Authentication issues | Check credentials, session persistence |
| Flaky selectors | Use `data-testid` attributes instead of text selectors |

### Debugging Commands

```bash
# Run with debug
npx playwright test --debug

# Run specific test with debug
npx playwright test --debug -g "test name"

# Show trace viewer
npx playwright show-trace trace.zip

# Run with slow motion
npx playwright test --slow-mo=1000
```

---

## 6. Best Practices

### Do

```typescript
// ✅ Use data-testid for stable selectors
await page.click('[data-testid="submit-button"]');

// ✅ Wait for network idle
await page.waitForLoadState('networkidle');

// ✅ Use auto-waiting assertions
await expect(page.locator('text=Success')).toBeVisible();

// ✅ Use page objects for complex pages
const loginPage = new LoginPage(page);
await loginPage.login('user', 'pass');

// ✅ Clean up test data
await cleanupTestData();

// ✅ Test error states
await expect(page.locator('text=Error')).toBeVisible();
```

### Don't

```typescript
// ❌ Don't use hardcoded waits
await page.waitForTimeout(5000); // Flaky!

// ❌ Don't use brittle selectors
await page.click('div:nth-child(3) > div > button'); // Fragile!

// ❌ Don't hardcode test data
await page.fill('input[name="email"]', 'test@test.com'); // Use test data factory

// ❌ Don't leave test data
// ❌ Don't share state between tests
// ❌ Don't use hardcoded waits
```

---

## 6. Resources

- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Playwright Test API](https://playwright.dev/docs/api/class-test)
- [Playwright Locators](https://playwright.dev/docs/locators)
- [axe-core/playwright](https://github.com/dequelabs/axe-core-npm/blob/develop/packages/playwright/README.md)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Playwright CI/CD](https://playwright.dev/docs/ci)

---

**Document Control:**
- Version: 1.0
- Last Updated: 2026-11-18
- Next Review: Sprint Planning
- Owner: QA Team