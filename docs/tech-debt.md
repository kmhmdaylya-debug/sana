# Technical Debt Tracker

**Project**: Sana HRMS  
**Last Updated**: 2026-11-17  
**Source**: Codebase grep for TODO, FIXME, HACK, XXX

---

## TODO Items

### Backend

| File | Line | Context |
|------|------|---------|
| `src/employees/employees.service.ts` | ~ | `// TODO: Add validation for nationalId format` |
| `src/contracts/contracts.service.ts` | ~ | `// TODO: Add contract renewal workflow` |
| `src/leaves/leaves.service.ts` | ~ | `// TODO: Add leave balance carry-over logic` |
| `src/payroll/payroll.service.ts` | ~ | `// TODO: Implement tax calculation per Iranian labor law` |
| `src/attendance/attendance.service.ts` | ~ | `// TODO: Add geofencing support for mobile check-in` |
| `src/assets/assets.service.ts` | ~ | `// TODO: Add asset depreciation calculation` |
| `src/recruitment/recruitment.service.ts` | ~ | `// TODO: Add candidate scoring algorithm` |
| `src/evaluations/evaluations.service.ts` | ~ | `// TODO: Add 360-degree evaluation support` |

### Frontend

| File | Line | Context |
|------|------|---------|
| `src/pages/Employees.tsx` | ~ | `// TODO: Add bulk import/export for employees` |
| `src/pages/Dashboard.tsx` | ~ | `// TODO: Add widget customization per user` |
| `src/components/DataTable.tsx` | ~ | `// TODO: Add column resizing persistence` |
| `src/hooks/useList.ts` | ~ | `// TODO: Add optimistic updates for mutations` |

---

## FIXME Items

### Backend

| File | Line | Context | Severity |
|------|------|---------|----------|
| `src/employees/employees.service.ts` | ~ | `// FIXME: Handle race condition in concurrent employee creation` | High |
| `src/contracts/contracts.service.ts` | ~ | `// FIXME: Version conflict handling for concurrent edits` | High |
| `src/leaves/leaves.service.ts` | ~ | `// FIXME: Overlapping leave detection edge case` | Medium |
| `src/payroll/payroll.service.ts` | ~ | `// FIXME: Precision loss in large salary calculations` | Medium |
| `src/attendance/attendance.service.ts` | ~ | `// FIXME: Handle timezone edge cases for shift boundaries` | Medium |

### Frontend

| File | Line | Context | Severity |
|------|------|---------|----------|
| `src/hooks/useList.ts` | ~ | `// FIXME: Race condition in rapid filter changes` | High |
| `src/components/DataTable.tsx` | ~ | `// FIXME: Memory leak in large dataset virtualization` | High |
| `src/pages/Dashboard.tsx` | ~ | `// FIXME: Chart re-renders on every props change` | Medium |

---

## HACK Items

### Backend

| File | Line | Context | Note |
|------|------|---------|------|
| `src/users/users.service.ts` | ~ | `// HACK: Temporary workaround for user sync with external LDAP` | Remove when LDAP sync service is ready |
| `src/auth/auth.service.ts` | ~ | `// HACK: Temporary fix for token rotation race condition` | Replace with proper locking |

### Frontend

| File | Line | Context | Note |
|------|------|---------|------|
| `src/components/DataTable.tsx` | ~ | `// HACK: Workaround for React 18 strict mode double render` | Remove when upgrading to stable React 18 |

---

## XXX Items (Critical Technical Debt)

### Backend

| File | Line | Context | Impact |
|------|------|---------|--------|
| `src/common/prisma/prisma.service.ts` | ~ | `// XXX: Global BigInt monkey patch - breaks JSON serialization` | High - Replace with custom serializer |
| `src/common/access/access.service.ts` | ~ | `// XXX: Complex permission logic - needs refactoring` | High - Hard to maintain |
| `src/payroll/payroll.service.ts` | ~ | `// XXX: Custom audit method bypasses standard audit service` | Medium - Inconsistent audit trail |

### Frontend

| File | Line | Context | Impact |
|------|------|---------|--------|
| `src/lib/api.ts` | ~ | `// XXX: Global axios instance - hard to test` | Medium - Dependency injection needed |
| `src/lib/auth.tsx` | ~ | `// XXX: Auth context with too many responsibilities` | Medium - Split into smaller hooks |

---

## Resolved Items (This Sprint)

| Item | File | Resolution |
|------|------|------------|
| Memory leak in Layout.tsx | `src/layout/Layout.tsx` | Added AbortController for API cleanup |
| Memory leak in Dashboard.tsx | `src/pages/Dashboard.tsx` | Added AbortController for API calls |
| Swagger disabled in production | `docker-compose.yml`, `main.ts` | Enabled with auth guard |
| Refresh token grace period | `configuration.ts`, `.env.example`, `docker-compose.yml` | Reduced from 60s to 15s |
| File upload magic bytes | `documents.controller.ts`, `file-validation.util.ts` | Added Multer fileFilter |
| Audit log outbox pattern | `audit.service.ts`, `audit-outbox.processor.ts` | Implemented outbox with retry |
| CSP headers | `main.ts` | Enabled strict CSP with nonce |
| Rate limiting | `auth.controller.ts`, `configuration.ts` | Login 5/min, per-account lockout |
| Error boundary | `ErrorBoundary.tsx`, `App.tsx` | Wrapped route tree |
| Health checks | `health/` module | Terminus with DB, migrations, frontend |

---

## Priority for Next Sprint

1. **High**: Fix `BigInt` monkey patch in `prisma.service.ts` - replace with custom serializer
2. **High**: Fix race condition in `useList.ts` hook
3. **High**: Fix memory leak in `DataTable.tsx` virtualization
4. **Medium**: Refactor `AccessService` permission logic
5. **Medium**: Replace `payroll.service.ts` custom audit with standard service
6. **Low**: Add TSDoc to all public APIs
7. **Low**: Set up `axe-playwright` in CI for accessibility
8. **Low**: Add bundle size thresholds to CI

---

## Notes

- This list is generated from codebase grep + manual review
- Update this file when adding new TODO/FIXME/HACK/XXX comments
- Review during sprint planning to allocate time for debt reduction
- Target: Reduce total items by 20% per quarter

---

*Generated by Sana HRMS Engineering Team on 2026-11-17*