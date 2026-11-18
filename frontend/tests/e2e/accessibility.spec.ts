import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const routes = [
  { path: '/login', name: 'Login', auth: false },
  { path: '/', name: 'Dashboard', auth: true, role: 'admin' },
  { path: '/employees', name: 'Employees', auth: true, role: 'admin' },
  { path: '/leaves', name: 'Leaves', auth: true, role: 'admin' },
  { path: '/payroll', name: 'Payroll', auth: true, role: 'admin' },
  { path: '/tasks', name: 'Tasks', auth: true, role: 'admin' },
  { path: '/contracts', name: 'Contracts', auth: true, role: 'admin' },
  { path: '/attendance', name: 'Attendance', auth: true, role: 'admin' },
  { path: '/shifts', name: 'Shifts', auth: true, role: 'admin' },
  { path: '/documents', name: 'Documents', auth: true, role: 'admin' },
  { path: '/panel', name: 'Employee Panel', auth: true, role: 'admin' },
  { path: '/announcements', name: 'Announcements', auth: true, role: 'any' },
  { path: '/settings', name: 'Settings', auth: true, role: 'admin' },
  { path: '/org', name: 'Organization', auth: true, role: 'admin' },
  { path: '/users', name: 'Users', auth: true, role: 'admin' },
  { path: '/roles', name: 'Roles', auth: true, role: 'admin' },
  { path: '/audit', name: 'Audit Log', auth: true, role: 'admin' },
  { path: '/backup', name: 'Backup', auth: true, role: 'superadmin' },
  { path: '/admin', name: 'Admin', auth: true, role: 'admin' },
  { path: '/reports', name: 'Reports', auth: true, role: 'admin' },
  { path: '/assets', name: 'Assets', auth: true, role: 'admin' },
  { path: '/training', name: 'Training', auth: true, role: 'admin' },
  { path: '/loans', name: 'Loans', auth: true, role: 'admin' },
  { path: '/recruitment', name: 'Recruitment', auth: true, role: 'admin' },
  { path: '/lifecycle', name: 'Lifecycle', auth: true, role: 'admin' },
  { path: '/projects', name: 'Projects', auth: true, role: 'admin' },
  { path: '/missions', name: 'Missions', auth: true, role: 'admin' },
  { path: '/evaluations', name: 'Evaluations', auth: true, role: 'admin' },
  { path: '/approvals', name: 'Approvals', auth: true, role: 'admin' },
];

const credentials = {
  admin: { username: 'admin', password: 'E7HHpQcEFezE4OAa1!' },
  employee: { username: 'mgr_hq_comp-001', password: 'SanaDemo@1404' },
};

async function login(page, role) {
  const creds = credentials[role] || credentials.admin;
  await page.goto('/login');
  await page.waitForSelector('input[placeholder="نام کاربری"]');
  await page.fill('input[placeholder="نام کاربری"]', creds.username);
  await page.fill('input[type="password"]', creds.password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/');
}

test.describe('Accessibility Audit (axe)', () => {
  for (const route of routes) {
    test(`${route.name} (${route.path}) - no critical/serious violations`, async ({ page }) => {
      if (route.auth) {
        const role = route.role === 'any' ? 'admin' : (route.role || 'admin');
        await login(page, role);
      } else {
        await page.goto(route.path);
      }
      
      await page.waitForLoadState('networkidle');
      
      // Run axe
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'])
        .analyze();
      
      // Filter for critical and serious violations only
      const criticalSerious = results.violations.filter(v => 
        v.impact === 'critical' || v.impact === 'serious'
      );
      
      if (criticalSerious.length > 0) {
        console.log(`\n❌ ${route.name} (${route.path}) - ${criticalSerious.length} critical/serious violations:`);
        for (const v of criticalSerious) {
          console.log(`  - ${v.id}: ${v.description} (${v.nodes.length} nodes)`);
          for (const node of v.nodes.slice(0, 3)) {
            console.log(`    Target: ${node.target.join(', ')}`);
            console.log(`    HTML: ${node.html?.substring(0, 100)}...`);
          }
        }
      } else {
        console.log(`✅ ${route.name} (${route.path}) - No critical/serious violations`);
      }
      
      // Fail test if critical/serious violations exist
      expect(criticalSerious.length).toBe(0);
    });
  }
});