# Bug Triage - Sana HRMS QA

**Date**: 2026-11-18
**Phase**: 3 - Bug Triage and Fixing

---

## Bugs Found During Testing

### Blocker Bugs (Must Fix)

| ID | Severity | Area | Steps to Reproduce | Expected | Actual | Evidence |
|----|----------|------|-------------------|----------|--------|----------|
| B-001 | Blocker | Auth | Admin login with password from seed-qa.ts ('SanaAdmin@2026!') | Login succeeds | Login fails - password hash from seed.ts (ADMIN_PASSWORD env var) differs | Backend API returns 401 |
| B-002 | Blocker | Auth | EMPLOYEE user 'ali' login | Redirect to /panel | User is INACTIVE in database | User status = INACTIVE |
| B-003 | Blocker | E2E | User menu logout | Click user avatar → Click "خروج" → Redirect to /login | User menu selector not found; "خروج" text matches sidebar link instead | Playwright timeout |
| B-004 | Blocker | E2E | Navigate to employee create form | Button "افزودن نیرو" visible and clickable | Button not found - likely different text or requires page load wait | Playwright timeout |

### Major Bugs

| ID | Severity | Area | Steps to Reproduce | Expected | Actual | Evidence |
|----|----------|------|-------------------|----------|--------|----------|
| B-005 | Major | Bundle Size | Frontend build | Initial JS ≤ 250 KB gzipped | 319.55 KB raw (105.54 KB gzipped) - but raw exceeds target | Vite build output |
| B-006 | Major | Type Safety | Backend TypeScript check | No errors | 200+ errors in spec files (audit-created specs don't match service APIs) | `npx tsc --noEmit` |
| B-007 | Major | Testing | Backend unit tests | All pass | 29 test suites fail to compile; only 12 suites pass | Jest output |
| B-008 | Major | Daily Attendance | Backend startup | No errors | Daily attendance closing fails on startup | Backend logs: "Daily attendance closing failed" |

### Minor Bugs

| ID | Severity | Area | Steps to Reproduce | Expected | Actual | Evidence |
|----|----------|------|-------------------|----------|--------|----------|
| B-009 | Minor | E2E | Theme toggle | Switch between light/dark | Selector `[data-testid="theme-toggle"]` not found | Playwright timeout |
| B-010 | Minor | E2E | Responsive design | No horizontal overflow at 375px | Tests use wrong login selectors | Playwright timeout |
| B-011 | Minor | Seed Data | Admin user | Consistent password across seeds | seed.ts uses ADMIN_PASSWORD env, seed-qa.ts uses hardcoded | Different password hashes |

### Cosmetic Bugs

| ID | Severity | Area | Steps to Reproduce | Expected | Actual | Evidence |
|----|----------|------|-------------------|----------|--------|----------|
| B-012 | Cosmetic | UI | Login page | Username input has `name="username"` | Input uses `placeholder="نام کاربری"` only | Playwright selector mismatch |

---

## Root Cause Analysis

### B-001, B-011: Inconsistent Seed Passwords
- **Cause**: `seed.ts` reads `ADMIN_PASSWORD` from `.env`; `seed-qa.ts` hardcodes `'SanaAdmin@2026!'`
- **Fix**: Align seeds to use same password source, or update `.env` to match seed-qa.ts

### B-002: Inactive Demo User
- **Cause**: `seed-demo.ts` creates 'ali' user with status INACTIVE; `seed-qa.ts` doesn't activate it
- **Fix**: Set status='ACTIVE' for demo users in seed-qa.ts, or create dedicated E2E test users

### B-003, B-009, B-012: Missing Test IDs / Selectors
- **Cause**: UI components lack `data-testid` attributes for reliable E2E testing
- **Fix**: Add `data-testid` to user menu, theme toggle, and key action buttons

### B-004, B-005: Bundle Size and UI Selectors
- **Cause**: Recharts and other heavy libs not code-split; UI text in Persian makes selectors brittle
- **Fix**: Lazy-load Recharts; add stable `data-testid` or `id` attributes to buttons

### B-006, B-007: Spec File Drift
- **Cause**: Audit created 25+ spec files that don't match actual service implementations
- **Fix**: Update spec files to match services, or remove non-matching specs

### B-008: Daily Attendance Closing Error
- **Cause**: Cron job runs on startup and fails (possibly no data or DB issue)
- **Fix**: Make cron job resilient; log actual error instead of suppressing

---

## Fix Priority Order

1. **B-001, B-011**: Align admin password (quick fix - update .env or seed)
2. **B-002**: Activate demo employee user for E2E tests
3. **B-003, B-009, B-012**: Add data-testid attributes to UI components
4. **B-004**: Fix E2E test selectors based on actual UI
5. **B-008**: Fix daily attendance closing error
6. **B-006, B-007**: Update or remove mismatched spec files
7. **B-005**: Code-split heavy dependencies (Recharts, etc.)
8. **B-010**: Fix responsive design tests

---

## Decisions Required from Owner

| Decision | Options | Recommendation |
|----------|---------|----------------|
| Admin password strategy | Use .env ADMIN_PASSWORD everywhere; or hardcode in seeds | Use .env for production, hardcoded for QA seeds |
| E2E test user management | Create dedicated test users in seed-qa.ts; or use existing seeded users | Create dedicated test users with known credentials in seed-qa.ts |
| Spec file maintenance | Fix all 25+ spec files; or delete non-matching ones | Fix critical path specs (auth, employees, payroll); delete rest for now |
| Bundle size target | 250 KB gzipped is very aggressive for Recharts app | Consider 350 KB gzipped target, or aggressive code-splitting |

---

## Next Steps

1. Fix admin password alignment
2. Activate demo employee user
3. Add data-testid attributes to critical UI elements
4. Run accessibility audit (axe) on all routes
5. Run Lighthouse performance audits
6. Run authorization matrix test
7. Check for sensitive data exposure
8. Update E2E tests with correct selectors