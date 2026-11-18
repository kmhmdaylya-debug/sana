import { test, expect } from '@playwright/test';

// Run tests sequentially to avoid session conflicts
test.describe.configure({ retries: 0, timeout: 60000 });

test.describe('Journey 1: Login, Failed Login, Lockout, Logout, Session Expiry', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.waitForSelector('input[placeholder="نام کاربری"]');
  });

  test('successful login as SUPER_ADMIN (admin)', async ({ page }) => {
    await page.fill('input[placeholder="نام کاربری"]', 'admin');
    await page.fill('input[type="password"]', 'E7HHpQcEFezE4OAa1!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
  });

  test('successful login as HR_ADMIN', async ({ page }) => {
    await page.fill('input[placeholder="نام کاربری"]', 'hradmin_comp-001');
    await page.fill('input[type="password"]', 'SanaDemo@1404');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
  });

  test('successful login as MANAGER', async ({ page }) => {
    await page.fill('input[placeholder="نام کاربری"]', 'mgr_hq_comp-001');
    await page.fill('input[type="password"]', 'SanaDemo@1404');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
  });

  test('failed login shows error message', async ({ page }) => {
    await page.fill('input[placeholder="نام کاربری"]', 'admin');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=نام کاربری یا رمز عبور اشتباه است')).toBeVisible();
  });

  test('multiple failed logins trigger lockout message', async ({ page }) => {
    test.skip('Requires 5 failed attempts, may conflict with other tests');
  });

  test('logout works', async ({ page }) => {
    await page.fill('input[placeholder="نام کاربری"]', 'admin');
    await page.fill('input[type="password"]', 'E7HHpQcEFezE4OAa1!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
    
    // Click user avatar/menu and logout
    await page.locator('[class*="user-avatar"], [class*="user-menu"], button[aria-label*="منوی کاربر"]').first().click();
    await page.click('text=خروج');
    await expect(page).toHaveURL('/login');
  });
});

test.describe('Journey 2: Password Change with Persian Feedback', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.waitForSelector('input[placeholder="نام کاربری"]');
    await page.fill('input[placeholder="نام کاربری"]', 'admin');
    await page.fill('input[type="password"]', 'E7HHpQcEFezE4OAa1!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
  });

  test('change password shows strength meter in Persian', async ({ page }) => {
    // Navigate to profile/settings
    await page.locator('[class*="user-avatar"], [class*="user-menu"], button[aria-label*="منوی کاربر"]').first().click();
    await page.click('text=تنظیمات پروفایل');
    
    // Find change password section
    await expect(page.locator('text=تغییر رمز عبور')).toBeVisible();
    
    // Enter weak password
    await page.fill('input[name="newPassword"]', '123');
    await expect(page.locator('text=بسیار ضعیف')).toBeVisible();
    
    // Enter medium password
    await page.fill('input[name="newPassword"]', 'Password123');
    await expect(page.locator('text=متوسط')).toBeVisible();
    
    // Enter strong password
    await page.fill('input[name="newPassword"]', 'Str0ng!Passw0rd');
    await expect(page.locator('text=قوی')).toBeVisible();
  });

  test('password change requires current password', async ({ page }) => {
    await page.locator('[class*="user-avatar"], [class*="user-menu"], button[aria-label*="منوی کاربر"]').first().click();
    await page.click('text=تنظیمات پروفایل');
    
    await page.fill('input[name="newPassword"]', 'NewStr0ng!Pass');
    await page.fill('input[name="confirmPassword"]', 'NewStr0ng!Pass');
    await page.click('button:has-text("ذخیره")');
    
    await expect(page.locator('text=رمز فعلی الزامی است')).toBeVisible();
  });
});

test.describe('Journey 3: Employee CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.waitForSelector('input[placeholder="نام کاربری"]');
    await page.fill('input[placeholder="نام کاربری"]', 'admin');
    await page.fill('input[type="password"]', 'E7HHpQcEFezE4OAa1!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
    await page.goto('/employees');
  });

  test('create new employee', async ({ page }) => {
    await page.click('button:has-text("افزودن نیرو")');
    
    // Fill required fields
    await page.fill('input[name="code"]', 'TEST-001');
    await page.fill('input[name="firstName"]', 'تست');
    await page.fill('input[name="lastName"]', 'کارمند');
    await page.fill('input[name="nationalId"]', '9999999999');
    await page.fill('input[name="mobile"]', '09123456789');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.selectOption('select[name="employmentType"]', 'PERMANENT');
    await page.fill('input[name="hireDate"]', '1403-01-01');
    await page.fill('input[name="monthlyBaseSalary"]', '500000000');
    
    await page.click('button:has-text("ذخیره")');
    
    await expect(page.locator('text=نیرو با موفقیت ایجاد شد')).toBeVisible();
    await expect(page.locator('text=TEST-001')).toBeVisible();
  });

  test('duplicate employee code is rejected', async ({ page }) => {
    await page.click('button:has-text("افزودن نیرو")');
    
    await page.fill('input[name="code"]', 'TEST-001'); // Same as previous test
    await page.fill('input[name="firstName"]', 'تست۲');
    await page.fill('input[name="lastName"]', 'کارمند۲');
    await page.fill('input[name="nationalId"]', '8888888888');
    await page.fill('input[name="mobile"]', '09123456788');
    await page.fill('input[name="email"]', 'test2@example.com');
    await page.selectOption('select[name="employmentType"]', 'PERMANENT');
    await page.fill('input[name="hireDate"]', '1403-01-01');
    await page.fill('input[name="monthlyBaseSalary"]', '500000000');
    
    await page.click('button:has-text("ذخیره")');
    
    await expect(page.locator('text=کد پرسنلی تکراری است')).toBeVisible();
  });

  test('search, filter, sort employees', async ({ page }) => {
    // Search
    await page.fill('input[placeholder*="جستجو"]', 'TEST-001');
    await expect(page.locator('text=TEST-001')).toBeVisible();
    await expect(page.locator('text=تست کارمند')).toBeVisible();
    
    // Clear search
    await page.fill('input[placeholder*="جستجو"]', '');
    
    // Filter by employment type
    await page.selectOption('select[name="employmentType"]', 'PERMANENT');
    await expect(page.locator('text=TEST-001')).toBeVisible();
    
    // Sort by code
    await page.click('th:has-text("کد پرسنلی")');
    await expect(page.locator('tbody tr').first()).toContainText('TEST-001');
  });

  test('soft delete employee', async ({ page }) => {
    // Find the test employee row and click delete
    await page.click('tr:has-text("TEST-001") >> button[aria-label="حذف"]');
    await page.click('button:has-text("تأیید حذف")');
    
    await expect(page.locator('text=نیرو با موفقیت حذف شد')).toBeVisible();
    
    // Verify it's not in list (soft deleted)
    await page.fill('input[placeholder*="جستجو"]', 'TEST-001');
    await expect(page.locator('text=داده‌ای یافت نشد')).toBeVisible();
  });
});

test.describe('Journey 4: Shift Assignment & Attendance', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.waitForSelector('input[placeholder="نام کاربری"]');
    await page.fill('input[placeholder="نام کاربری"]', 'admin');
    await page.fill('input[type="password"]', 'E7HHpQcEFezE4OAa1!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
  });

  test('assign shift to employee', async ({ page }) => {
    await page.goto('/shifts');
    await page.click('button:has-text("افزودن شیفت")');
    
    // Fill shift form
    await page.fill('input[name="code"]', 'TEST-SHIFT');
    await page.fill('input[name="name"]', 'شیفت تست');
    await page.selectOption('select[name="kind"]', 'MORNING');
    await page.fill('input[name="startTime"]', '08:00');
    await page.fill('input[name="endTime"]', '16:00');
    await page.fill('input[name="durationMinutes"]', '480');
    await page.fill('input[name="breakMinutes"]', '60');
    
    await page.click('button:has-text("ذخیره")');
    await expect(page.locator('text=شیفت با موفقیت ایجاد شد')).toBeVisible();
    
    // Assign to employee
    await page.goto('/employees');
    await page.click('tr:has-text("TEST-001") >> button[aria-label="ویرایش"]');
    await page.selectOption('select[name="shiftId"]', 'TEST-SHIFT');
    await page.click('button:has-text("ذخیره")');
    await expect(page.locator('text=نیرو با موفقیت به‌روزرسانی شد')).toBeVisible();
  });

  test('record attendance and verify dashboard', async ({ page }) => {
    await page.goto('/attendance');
    
    // Record attendance for today
    await page.click('button:has-text("ثبت حضور")');
    await page.selectOption('select[name="employeeId"]', 'TEST-001');
    await page.fill('input[name="firstIn"]', '08:00');
    await page.fill('input[name="lastOut"]', '16:00');
    await page.click('button:has-text("ذخیره")');
    
    await expect(page.locator('text=حضور با موفقیت ثبت شد')).toBeVisible();
    
    // Check dashboard
    await page.goto('/');
    await expect(page.locator('text=TEST-001')).toBeVisible();
  });
});

test.describe('Journey 5: Leave Request Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.waitForSelector('input[placeholder="نام کاربری"]');
    // Use a manager for leave approval tests
    await page.fill('input[placeholder="نام کاربری"]', 'mgr_hq_comp-001');
    await page.fill('input[type="password"]', 'SanaDemo@1404');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
  });

  test('submit leave request as manager', async ({ page }) => {
    await page.goto('/leaves');
    await page.click('button:has-text("درخواست مرخصی")');
    
    await page.selectOption('select[name="leaveTypeId"]', 'ANNUAL');
    await page.fill('input[name="startAt"]', '1403-06-01T08:00');
    await page.fill('input[name="endAt"]', '1403-06-03T16:00');
    await page.fill('textarea[name="reason"]', 'مرخصی تابستانی');
    await page.click('button:has-text("ارسال")');
    
    await expect(page.locator('text=درخواست مرخصی با موفقیت ثبت شد')).toBeVisible();
  });

  test('verify balance changes exactly once', async ({ page }) => {
    test.skip('Requires DB verification');
  });
});

test.describe('Journey 6: Payroll Period', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.waitForSelector('input[placeholder="نام کاربری"]');
    await page.fill('input[placeholder="نام کاربری"]', 'admin');
    await page.fill('input[type="password"]', 'E7HHpQcEFezE4OAa1!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
  });

  test('run payroll period', async ({ page }) => {
    await page.goto('/payroll');
    await page.click('button:has-text("دوره جدید")');
    
    await page.selectOption('select[name="month"]', '6');
    await page.fill('input[name="year"]', '1403');
    await page.click('button:has-text("تولید")');
    
    await expect(page.locator('text=دوره حقوق با موفقیت تولید شد')).toBeVisible();
  });

  test('lock period prevents changes', async ({ page }) => {
    await page.goto('/payroll');
    await page.click('tr:has-text("1403-06") >> button:has-text("قفل")');
    await page.click('button:has-text("تأیید قفل")');
    
    await expect(page.locator('text=دوره قفل شد')).toBeVisible();
    
    // Try to modify locked period
    await page.click('tr:has-text("1403-06") >> button:has-text("تولید")');
    await expect(page.locator('text=دوره قفل شده است')).toBeVisible();
  });
});

test.describe('Journey 7: Contract Versioning', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.waitForSelector('input[placeholder="نام کاربری"]');
    await page.fill('input[placeholder="نام کاربری"]', 'admin');
    await page.fill('input[type="password"]', 'E7HHpQcEFezE4OAa1!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
  });

  test('create contract and add new version', async ({ page }) => {
    await page.goto('/contracts');
    await page.click('button:has-text("قرارداد جدید")');
    
    await page.selectOption('select[name="employeeId"]', 'TEST-001');
    await page.selectOption('select[name="contractType"]', 'PERMANENT');
    await page.fill('input[name="startDate"]', '1403-01-01');
    await page.fill('input[name="baseSalary"]', '600000000');
    await page.click('button:has-text("ذخیره")');
    
    await expect(page.locator('text=قرارداد با موفقیت ایجاد شد')).toBeVisible();
    
    // Add new version
    await page.click('tr:has-text("TEST-001") >> button[aria-label="نسخه جدید"]');
    await page.fill('input[name="baseSalary"]', '650000000');
    await page.fill('input[name="effectiveDate"]', '1403-07-01');
    await page.click('button:has-text("ذخیره")');
    
    await expect(page.locator('text=نسخه قرارداد با موفقیت ایجاد شد')).toBeVisible();
    
    // Verify version ordering
    await page.click('tr:has-text("TEST-001") >> button[aria-label="مشاهده"]');
    const versions = page.locator('.contract-version');
    await expect(versions.nth(0)).toContainText('نسخه 2');
    await expect(versions.nth(1)).toContainText('نسخه 1');
  });
});

test.describe('Journey 8: Document Upload', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.waitForSelector('input[placeholder="نام کاربری"]');
    await page.fill('input[placeholder="نام کاربری"]', 'admin');
    await page.fill('input[type="password"]', 'E7HHpQcEFezE4OAa1!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
  });

  test('upload valid document', async ({ page }) => {
    await page.goto('/documents');
    await page.click('button:has-text("بارگذاری مدرک")');
    
    await page.selectOption('select[name="employeeId"]', 'TEST-001');
    await page.selectOption('select[name="docType"]', 'NATIONAL_ID');
    await page.fill('input[name="title"]', 'کارت ملی تست');
    await page.fill('input[name="documentNumber"]', 'DOC-TEST-001');
    await page.fill('input[name="issueDate"]', '1403-01-01');
    
    // Create a small test PDF file
    const filePath = 'tests/e2e/fixtures/test.pdf';
    await page.setInputFiles('input[type="file"]', filePath);
    
    await page.click('button:has-text("بارگذاری")');
    await expect(page.locator('text=مدرک با موفقیت بارگذاری شد')).toBeVisible();
  });

  test('reject invalid file type', async ({ page }) => {
    await page.goto('/documents');
    await page.click('button:has-text("بارگذاری مدرک")');
    
    await page.selectOption('select[name="employeeId"]', 'TEST-001');
    await page.selectOption('select[name="docType"]', 'NATIONAL_ID');
    await page.fill('input[name="title"]', 'فایل نامعتبر');
    await page.fill('input[name="documentNumber"]', 'DOC-INVALID');
    await page.fill('input[name="issueDate"]', '1403-01-01');
    
    const filePath = 'tests/e2e/fixtures/test.exe';
    await page.setInputFiles('input[type="file"]', filePath);
    
    await page.click('button:has-text("بارگذاری")');
    await expect(page.locator('text=نوع فایل مجاز نیست')).toBeVisible();
  });

  test('download with correct headers', async ({ page }) => {
    test.skip('Requires file download verification');
  });
});

test.describe('Journey 9: Error Boundary', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.waitForSelector('input[placeholder="نام کاربری"]');
    await page.fill('input[placeholder="نام کاربری"]', 'admin');
    await page.fill('input[type="password"]', 'E7HHpQcEFezE4OAa1!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
  });

  test('render error in dev shows Persian error boundary', async ({ page }) => {
    test.skip('Requires test-only error trigger route');
  });
});

test.describe('Journey 10: Theme Switching', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.waitForSelector('input[placeholder="نام کاربری"]');
    await page.fill('input[placeholder="نام کاربری"]', 'admin');
    await page.fill('input[type="password"]', 'E7HHpQcEFezE4OAa1!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
  });

  test('switch between light and dark themes', async ({ page }) => {
    // Click theme toggle
    await page.click('[data-testid="theme-toggle"], button[aria-label*="تم"], button:has(svg.lucide-sun), button:has(svg.lucide-moon)');
    
    // Verify dark theme
    await expect(page.locator('html')).toHaveClass(/dark/);
    
    // Switch back to light
    await page.click('[data-testid="theme-toggle"], button[aria-label*="تم"], button:has(svg.lucide-sun), button:has(svg.lucide-moon)');
    await expect(page.locator('html')).not.toHaveClass(/dark/);
  });
});

test.describe('Journey 11: Keyboard Navigation', () => {
  test('navigate from login to saved form using only keyboard', async ({ page }) => {
    await page.goto('/login');
    await page.waitForSelector('input[placeholder="نام کاربری"]');
    
    // Tab to username
    await page.keyboard.press('Tab');
    await page.keyboard.type('admin');
    
    // Tab to password
    await page.keyboard.press('Tab');
    await page.keyboard.type('E7HHpQcEFezE4OAa1!');
    
    // Tab to submit and press Enter
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    
    await expect(page).toHaveURL('/');
    
    // Navigate to employees
    await page.goto('/employees');
    
    // Tab through table
    await page.keyboard.press('Tab');
    await expect(page.locator('tbody tr:first-child')).toBeFocused();
    
    // Open detail with Enter
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/employees\/.*/);
  });
});

test.describe('Journey 12: Responsive Design', () => {
  const viewports = [
    { width: 375, height: 667, name: 'mobile' },
    { width: 768, height: 1024, name: 'tablet' },
    { width: 1440, height: 900, name: 'desktop' },
  ];

  for (const viewport of viewports) {
    test(`no horizontal overflow at ${viewport.width}px (${viewport.name})`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/login');
      await page.waitForSelector('input[placeholder="نام کاربری"]');
      await page.fill('input[placeholder="نام کاربری"]', 'admin');
      await page.fill('input[type="password"]', 'E7HHpQcEFezE4OAa1!');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL('/');
      
      // Check main pages for horizontal overflow
      const pages = ['/', '/employees', '/leaves', '/payroll', '/tasks'];
      
      for (const path of pages) {
        await page.goto(path);
        await page.waitForLoadState('networkidle');
        
        const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
        expect(bodyWidth).toBeLessThanOrEqual(viewport.width + 20); // Allow small margin
      }
    });
  }
});