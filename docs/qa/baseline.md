# QA Baseline Report

**Date**: 2026-11-18
**Environment**: Local development machine (Windows 10, Node.js 22, PostgreSQL 16 in Docker)
**Database**: Seeded with QA data (5 companies, 11 branches, 69 org units, 5,121 employees, 3,457 users)

---

## Backend Test Results

### Unit Tests (Jest)
- **Passing**: 104 tests in 12 suites
  - `src/common/access/access.service.spec.ts` ✅
  - `src/projects/projects.service.spec.ts` ✅
  - `src/tasks/tasks.service.spec.ts` ✅
  - `src/attendance/daily-attendance.service.spec.ts` ✅
  - `src/auth/auth.security.spec.ts` ✅
  - `src/users/users.security.spec.ts` ⚠️ (2 integration tests fail with 500 errors)
  - 6 other passing suites

- **Failing**: 29 test suites (compile errors)
  - Spec files created during audit don't match actual service implementations
  - Known issue documented in remediation report
  - 98 tests skipped due to compile errors

### Type Check (TypeScript)
- **Source code**: ✅ No errors in `src/**/*.ts` (excluding `.spec.ts`)
- **Spec files**: ❌ 200+ TypeScript errors (mismatched service APIs)
- **Root cause**: Audit-created spec files don't match actual service signatures

### Lint (ESLint)
- ✅ Passes with `--fix` (no errors, auto-fixed formatting)

---

## Frontend Test Results

### Unit Tests (Node.js test runner)
- ✅ **38/38 tests pass** (0 failed)
- Tests cover: UI components, forms, date handling, task countdowns, document search, employee panel, task redesign, category palette, retry controls

### Type Check (TypeScript)
- ✅ `tsc --noEmit` passes (no errors)

### Build (Vite)
- ✅ Build succeeds
- **Bundle sizes**:
  - `index-CilZCGxr.js`: 319.55 kB (105.54 kB gzipped) - **EXCEEDS 250 KB gzipped target**
  - `Dashboard-Ds0Bjj0b.js`: 21.61 kB (7.22 kB gzipped)
  - `EmployeePanel-BkY7vyIE.js`: 24.31 kB (7.38 kB gzipped)
  - `Projects-PCpaDxrG.js`: 19.02 kB (6.56 kB gzipped)
  - CSS: 81.98 kB (15.72 kB gzipped)

---

## Database State (Post-QA Seed)

| Entity | Count |
|--------|-------|
| Companies | 5 |
| Branches | 11 |
| Org Units | 69 |
| Employees | 5,121 |
| Users | 3,457 |
| Attendance Records | 206,193 |
| Shifts | 16 |
| Shift Assignments | 152,253 |
| Leave Requests | 807 |
| Payroll Periods | 12 |
| Payslips | 15,336 |
| Contracts | 5,112 |
| Evaluations | 612 |
| Tasks | 614 |
| Assets | 68 |
| Training Courses | 35 |
| Loans | 243 |
| Missions | 94 |
| Announcements | 74 |
| Notifications | 397 |
| Employee Documents | 613 |
| Projects | 21 |

---

## Performance Baseline (Not Yet Measured)

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Lighthouse Mobile Performance (Dashboard) | ≥ 85 | TBD | ⏳ |
| Lighthouse Mobile Performance (Employee List) | ≥ 85 | TBD | ⏳ |
| Initial JS (gzipped) | ≤ 250 KB | 105.54 KB | ⚠️ Bundle is 319 KB raw |
| List endpoints p95 | ≤ 300 ms | TBD | ⏳ |
| Axe violations (serious/critical) | 0 | TBD | ⏳ |
| Contrast ratio (text) | ≥ 4.5:1 | TBD | ⏳ |
| Horizontal overflow at 375px | None | TBD | ⏳ |

---

## Security Baseline (Not Yet Measured)

| Check | Status |
|-------|--------|
| Authorization matrix (all endpoints × all roles) | ⏳ |
| Injection/XSS on text inputs | ⏳ |
| Sensitive fields in logs | ⏳ |
| Sensitive fields in unauthorized API responses | ⏳ |
| Sensitive fields in localStorage | ⏳ |

---

## Accessibility Baseline (Not Yet Measured)

| Page | Axe Violations (Critical/Serious) | Contrast Issues | Status |
|------|-----------------------------------|-----------------|--------|
| Login | TBD | TBD | ⏳ |
| Dashboard | TBD | TBD | ⏳ |
| Employee List | TBD | TBD | ⏳ |
| Employee Detail | TBD | TBD | ⏳ |
| Leave Request | TBD | TBD | ⏳ |
| Attendance | TBD | TBD | ⏳ |
| Payroll | TBD | TBD | ⏳ |
| Contracts | TBD | TBD | ⏳ |
| Settings | TBD | TBD | ⏳ |

---

## Known Issues (from Remediation Report)

1. **C1**: Backend unit tests incomplete - 25+ spec files need updating to match service APIs
2. **H8**: E2E tests not implemented - Playwright setup needed
3. **M1**: Type safety - Recommended `orval`/`openapi-typescript` after Swagger export
4. **M5**: Soft delete indexes - Migration ready, needs duplicate check before applying
5. **M7**: i18n - Out of scope for MVP (Persian-only)
6. **M12**: Backup key rotation - Versioned key-header design proposed
7. **L1**: TODO/FIXME cleanup - Listed in `/docs/tech-debt.md`
8. **L2**: Storybook - Out of scope
9. **L3**: API deprecation policy - Documented, headers to be added
10. **L10**: TSDoc - In progress for public APIs

---

## Decisions Required from Owner

| Decision | Options | Recommendation |
|----------|---------|----------------|
| CAPTCHA Provider | Google reCAPTCHA v3, hCaptcha, Turnstile | Cloudflare Turnstile (free, privacy-friendly) |
| ClamAV in Production | Enabled/Disabled | Enable; use managed ClamAV service or sidecar container |
| Backup Key Rotation | Versioned key-header design | Implement key version header in backup archives |
| Webhook Retry Design | Exponential backoff + DLQ | Implement processor with configurable retry |
| i18n Scope | Full i18n vs. Persian-only | Persian-only for MVP; i18n infrastructure for future |

---

## Next Steps

1. Run Lighthouse performance audits on Dashboard and Employee List (desktop + mobile)
2. Run axe accessibility audit on all routes
3. Measure API endpoint latency (p95) with seeded data
4. Check horizontal overflow at 375px, 768px, 1440px
5. Run authorization matrix test (all endpoints × all roles)
6. Test injection/XSS on all text inputs
7. Verify sensitive fields not in logs, unauthorized responses, or localStorage
8. Create Playwright E2E tests for 12 Phase 2 journeys
9. Fix bundle size (code-split Recharts, lazy-load heavy components)
10. Fix backend spec files or remove non-matching ones