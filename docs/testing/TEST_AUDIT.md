# Sana HRMS - Testing Audit Report

**Date:** 2026-11-18  
**Auditor:** Senior QA Automation Engineer / Software Quality Architect  
**Project:** Sana HRMS - Human Resource Management System

---

## Executive Summary

The Sana HRMS project has a **moderate testing infrastructure** with some good practices but significant gaps in coverage. The project has:
- **~50 backend spec files** covering various modules
- **E2E tests** using Playwright with ~12 journey tests
- **Frontend unit tests** using Node.js test runner (not Vitest/Jest)
- **Integration tests** with isolated database per test run
- **Accessibility tests** with axe-core/Playwright

**Current Testing Score Estimate: ~65/100** (based on audit criteria)

---

## 1. Repository Structure Overview

### Backend (NestJS 11 + Prisma 6 + PostgreSQL 16)
- **29 backend modules** (modules listed in `backend/src/`)
- **54 backend spec files** found (including unit, integration, security specs)
- **Jest** configured with `ts-jest` for backend unit/integration tests
- Integration tests use **isolated PostgreSQL databases** per test run

### Frontend (React 18 + Vite 6 + TypeScript)
- **Node.js test runner** (`node:test`) for pure function tests
- **Playwright** for E2E tests with 12 journey tests
- **axe-core/Playwright** for accessibility testing
- No Vitest/Jest for component testing currently

---

## 2. Backend Test Coverage Inventory

| Module | Service | Spec File | Test Count | Coverage | Priority |
|--------|---------|-----------|------------|----------|----------|
| **auth** | AuthService | `auth.security.spec.ts` | ~15 | Medium | **Critical** |
| **auth** | AuthController | `auth.security.spec.ts` | ~8 | Medium | **Critical** |
| **users** | UsersService | `users.service.spec.ts` | ~12 | Medium | **Critical** |
| **users** | UsersController | `users.security.spec.ts` | ~8 | Medium | **Critical** |
| **roles** | RolesService | `roles.service.spec.ts` | ~10 | Medium | **High** |
| **employees** | EmployeesService | `employees.service.spec.ts` | 0 | **None** | **Critical** |
| **employees** | EmployeePrivacy | `employee-privacy.spec.ts` | ~5 | Low | Medium |
| **org** | OrgService | `org.service.spec.ts` | 0 | **None** | **High** |
| **attendance** | AttendanceService | `attendance.service.spec.ts` | 0 | **None** | **Critical** |
| **attendance** | DailyAttendanceService | `daily-attendance.service.spec.ts` | ~10 | Medium | **Critical** |
| **attendance** | AttendanceCalculation | `attendance-calculation.spec.ts` | ~8 | Medium | High |
| **leaves** | LeavesService | `leaves.service.spec.ts` | 0 | **None** | **Critical** |
| **shifts** | ShiftsService | `shifts.service.spec.ts` | 0 | **None** | **High** |
| **payroll** | PayrollService | `payroll.service.spec.ts` | 0 | **None** | **Critical** |
| **payroll** | PayrollIntegration | `payroll.integration.spec.ts` | ~8 | Medium | **Critical** |
| **contracts** | ContractsService | `contracts.service.spec.ts` | 0 | **None** | **High** |
| **documents** | DocumentsService | `documents.service.spec.ts` | 0 | **None** | **High** |
| **loans** | LoansService | `loans.service.spec.ts` | 0 | **None** | **High** |
| **missions** | MissionsService | `missions.service.spec.ts` | 0 | **None** | **Medium** |
| **projects** | ProjectsService | `projects.service.spec.ts` | ~10 | Medium | **High** |
| **tasks** | TasksService | `tasks.service.spec.ts` | ~12 | Medium | **High** |
| **assets** | AssetsService | `assets.service.spec.ts` | 0 | **None** | Medium |
| **training** | TrainingService | `training.service.spec.ts` | 0 | **None** | Medium |
| **evaluations** | EvaluationsService | `evaluations.service.spec.ts` | 0 | **None** | Medium |
| **recruitment** | RecruitmentService | `recruitment.service.spec.ts` | 0 | **None** | Medium |
| **lifecycle** | LifecycleService | `lifecycle.service.spec.ts` | 0 | **None** | Medium |
| **admin** | AdminService | `admin.service.spec.ts` | 0 | **None** | Medium |
| **announcements** | AnnouncementsService | `announcements.service.spec.ts` | 0 | **None** | Low |
| **approvals** | ApprovalsService | `approvals.service.spec.ts` | 0 | **None** | **High** |
| **audit-log** | AuditLogService | `audit-log.service.spec.ts` | 0 | **None** | **High** |
| **reports** | ReportsService | `reports.service.spec.ts` | 0 | **None** | Medium |
| **settings** | SettingsService | `settings.service.spec.ts` | 0 | **None** | Low |
| **backup** | BackupService | `backup.service.spec.ts` | 0 | **None** | **High** |
| **backup** | BackupArchive | `backup-archive.spec.ts` | ~5 | Low | **High** |
| **employee-panel** | EmployeePanelService | `employee-panel.service.spec.ts` | ~8 | Medium | **High** |
| **dashboard** | DashboardService | `dashboard.service.spec.ts` | ~10 | Medium | **High** |
| **notifications** | NotificationsService | `notifications.service.spec.ts` | 0 | **None** | Low |
| **recruitment** | RecruitmentService | `recruitment.service.spec.ts` | 0 | **None** | Medium |
| **assets** | AssetsService | `assets.service.spec.ts` | 0 | **None** | Medium |
| **lifecycle** | LifecycleService | `lifecycle.service.spec.ts` | 0 | **None** | Medium |
| **reports** | ReportsService | `reports.service.spec.ts` | 0 | **None** | Medium |
| **settings** | SettingsService | `settings.service.spec.ts` | 0 | **None** | Low |
| **notifications** | NotificationsService | `notifications.service.spec.ts` | 0 | **None** | Low |
| **dashboard** | DashboardService | `dashboard.service.spec.ts` | ~10 | Medium | **High** |
| **employee-panel** | EmployeePanelService | `employee-panel.service.spec.ts` | ~8 | Medium | **High** |
| **common/access** | AccessService | `access.service.spec.ts` | ~12 | Medium | **Critical** |
| **common/access** | EmploymentAccess | `employment-access.spec.ts` | ~8 | Low | High |
| **common/access** | TenantIsolation | `tenant-isolation.integration.spec.ts` | ~8 | Low | **Critical** |
| **common/audit** | AuditService | `audit-redaction.spec.ts` | ~8 | Low | **High** |
| **common/filters** | AllExceptionsFilter | `all-exceptions.filter.spec.ts` | ~5 | Low | High |
| **common/guards** | SwaggerAccessGuard | `swagger-access.spec.ts` | ~3 | Low | Medium |
| **health** | HealthController | `health.controller.spec.ts` | ~3 | Low | Low |
| **users** | UsersSecurity | `users.security.spec.ts` | ~8 | Medium | **Critical** |

**Summary:**
- **29 backend modules** with services
- **~25 modules** have **zero or minimal** unit tests
- **4 modules** have decent coverage (tasks, projects, dashboard, attendance)
- **~54 spec files** total in backend
- **Integration tests**: 3 files (tenant-isolation, payroll.integration, auth.security)

---

## 3. Frontend Test Coverage Inventory

| Test Type | Files | Test Count | Coverage | Status |
|-----------|-------|------------|----------|--------|
| **E2E (Playwright)** | 1 file | ~50 scenarios | High (critical journeys) | ✅ Good |
| **Accessibility (axe)** | 1 file | 34 routes tested | Medium | ✅ Good |
| **Unit/Pure Functions** | 2 files (`ui.test.mjs`, `forms.test.mjs`) | ~60 tests | Medium | ✅ Good |
| **Component/React Tests** | 0 | 0 | **None** | ❌ Missing |
| **Component/Integration** | 0 | 0 | **None** | ❌ Missing |

**Frontend Test Gaps:**
- No React component unit tests (React Testing Library not used)
- No component integration tests
- No form validation unit tests
- No hook testing
- No RTL/LTR layout tests

---

## 4. Missing Test Scenarios by Priority

### CRITICAL (Must Fix Immediately)

| Module | Service | Missing Scenarios | Business Risk |
|--------|---------|-------------------|---------------|
| **employees** | EmployeesService | Create/update/delete, duplicate code, nationalId, org access, termination | Employee data integrity |
| **attendance** | AttendanceService | Check-in/out, duplicate events, missing checkout, overtime, idempotency | Payroll accuracy, compliance |
| **leaves** | LeavesService | Balance calc, overlap, approval, cancellation, unauthorized approval | Leave liability, compliance |
| **payroll** | PayrollService | Salary calc, allowances, overtime, loan deduct, precision, duplicate prevention | Financial accuracy, legal |
| **loans** | LoansService | Installment gen, payment, duplicate payment, balance calc | Financial accuracy |
| **access** | AccessService | ABAC scope, cross-tenant, IDOR prevention | Data isolation, security |

### HIGH PRIORITY

| Module | Service | Missing Scenarios | Business Risk |
|--------|---------|-------------------|---------------|
| **contracts** | ContractsService | Versioning, transitions, approval, duplicate prevention | Legal compliance |
| **approvals** | ApprovalsService | Flow creation, step assignment, decision, delegation | Process compliance |
| **dashboard** | DashboardService | Query performance, scope filtering, aggregation accuracy | Decision making |
| **shifts** | ShiftsService | Assignment, conflict, swap, schedule validation | Scheduling accuracy |
| **documents** | DocumentsService | Upload validation, versioning, access control | Document integrity |
| **assets** | AssetsService | Handover, maintenance, depreciation | Asset tracking |
| **approvals** | ApprovalsService | Workflow, delegation, escalation | Process compliance |

### MEDIUM PRIORITY

| Module | Service | Missing Scenarios |
|--------|---------|-------------------|
| assets | AssetsService | Handover, maintenance, depreciation |
| training | TrainingService | Records, certificates, expiry |
| evaluations | EvaluationsService | Forms, cycles, scoring, feedback |
| recruitment | RecruitmentService | Requisitions, applicants, interviews, offers |
| lifecycle | LifecycleService | Onboarding/offboarding checklists, termination |
| admin | AdminService | Correspondence, meetings, surveys |
| announcements | AnnouncementsService | Creation, acknowledgment, targeting |
| notifications | NotificationsService | Creation, read status, targeting |
| reports | ReportsService | Generation, export, scheduling |
| settings | SettingsService | CRUD, validation, grouping |
| backup | BackupService | Creation, restore, scheduling, encryption |
| notifications | NotificationsService | Creation, read status, targeting |

---

## 5. Current Test Quality Assessment

### Strengths
1. **Isolated integration tests** - Each run creates fresh DB, runs migrations, cleans up
2. **Security-focused tests** - `auth.security.spec.ts` covers auth edge cases well
3. **E2E coverage** - 12 critical user journeys with Playwright
4. **Accessibility testing** - axe-core integration for 34 routes
5. **Pure function tests** - Persian date, formatting, deadline logic well tested
5. **Access control tests** - Tenant isolation, employment access tests exist
6. **Pure function tests** - Persian date, formatting, workflow payloads tested

### Weaknesses
1. **No unit tests for 25+ critical services** (employees, attendance, leaves, payroll, etc.)
2. **No frontend component tests** - No React Testing Library, no component tests
3. **No backend coverage thresholds** - No enforced minimums in Jest config
4. **No CI/CD coverage gates** - No enforced coverage thresholds
5. **Integration tests only run in separate script** - Not part of standard `npm test`
5. **No mutation testing** - No Stryker or similar
6. **No contract testing** - No Pact or similar for API contracts
6. **No load/stress testing** - No k6 or similar
7. **No mutation testing** - No Stryker or similar
8. **No contract testing** - No Pact or similar for API contracts
8. **No load/stress testing** - No k6 or similar

---

## 6. Test Infrastructure Assessment

| Component | Status | Notes |
|-----------|--------|-------|
| **Jest Config** | Basic | No coverage thresholds, no moduleNameMapper for paths |
| **TypeScript Config** | ✅ | Properly configured for tests |
| **Prisma Test DB** | ✅ | Isolated per run, but only for integration tests |
| **Test DB Seeding** | Partial | Only for integration tests, not unit |
| **Test Fixtures** | Minimal | No shared test fixtures/factories |
| **Test Utilities** | Minimal | Some in `common/utils` but not for testing |
| **Mock Strategy** | Manual | Manual mocks in each spec, no central mock factory |
| **Test Data Factories** | None | Hardcoded test data in specs |
| **Coverage Reporting** | None | No coverage thresholds or reports |
| **CI Integration** | Partial | Only `test-integration.cjs` runs integration tests |

---

## 7. Recommendations Summary

### Immediate Actions (Week 1-2)
1. **Add Jest coverage thresholds** - Minimum 80% statements, 75% branches, 80% functions
2. **Create test utilities/factories** - Shared mock factories, test data builders
3. **Add missing unit tests for critical services** - Employees, Attendance, Leaves, Payroll
4. **Add frontend component tests** - Introduce Vitest + React Testing Library

### Short Term (Week 3-6)
1. **Implement database integration tests** with proper test DB setup
2. **Add Playwright E2E for remaining critical journeys**
5. **Add security tests** - IDOR, RBAC/ABAC, file upload, auth bypass
6. **Configure coverage thresholds in CI/CD**

### Medium Term (Week 7-10)
1. **Add contract testing** (Pact or similar)
2. **Add mutation testing** (Stryker)
2. **Add performance/load tests** (k6)
3. **Contract testing** for API contracts
3. **Full CI/CD pipeline** with quality gates

---

## 8. Module Test Priority Matrix

| Module | Unit Tests | Integration | E2E | Priority | Effort |
|--------|------------|-------------|-----|----------|--------|
| auth | ✅ Good | ✅ | ✅ | Critical | Low |
| users | ✅ Good | ❌ | ✅ | Critical | Medium |
| roles | ✅ Good | ❌ | ❌ | High | Medium |
| employees | ❌ None | ❌ | ✅ | Critical | High |
| attendance | Partial | ❌ | ✅ | Critical | High |
| leaves | ❌ None | ❌ | ✅ | Critical | High |
| payroll | Partial | ✅ | ✅ | Critical | High |
| contracts | ❌ None | ❌ | ✅ | High | Medium |
| documents | ❌ None | ❌ | ✅ | High | Medium |
| loans | ❌ None | ❌ | ✅ | High | Medium |
| shifts | ❌ None | ❌ | ✅ | High | Medium |
| projects | ✅ Good | ❌ | ✅ | High | Low |
| tasks | ✅ Good | ❌ | ✅ | High | Low |
| assets | ❌ None | ❌ | ❌ | Medium | Medium |
| training | ❌ None | ❌ | ❌ | Medium | Medium |
| evaluations | ❌ None | ❌ | ❌ | Medium | Medium |
| recruitment | ❌ None | ❌ | ❌ | Medium | Medium |
| lifecycle | ❌ None | ❌ | ❌ | Medium | Medium |
| admin | ❌ None | ❌ | ✅ | Medium | Medium |
| announcements | ❌ None | ❌ | ❌ | Low | Low |
| approvals | ❌ None | ❌ | ❌ | High | High |
| audit-log | ❌ None | ❌ | ❌ | High | Medium |
| reports | ❌ None | ❌ | ✅ | Medium | Medium |
| settings | ❌ None | ❌ | ✅ | Low | Low |
| backup | Partial | ❌ | ✅ | High | Medium |
| dashboard | Partial | ❌ | ✅ | High | Medium |
| employee-panel | Partial | ❌ | ✅ | High | Medium |
| notifications | ❌ None | ❌ | ❌ | Low | Low |
| org | ❌ None | ❌ | ✅ | High | Medium |
| tasks | ✅ Good | ❌ | ✅ | High | Low |
| projects | ✅ Good | ❌ | ✅ | High | Low |

---

## 9. Next Steps

1. **Create test utilities and factories** - Shared Prisma mock, test data builders
2. **Implement unit tests for top 5 critical services** (Employees, Attendance, Leaves, Payroll, Access)
3. **Add frontend component testing** (Vitest + React Testing Library)
4. **Configure Jest coverage thresholds** and CI/CD gates
5. **Expand integration tests** with proper test DB isolation
5. **Add security tests** (IDOR, RBAC/ABAC, file upload, auth bypass)
5. **Configure CI/CD pipeline** with quality gates

---

**Audit Completed:** 2026-11-18  
**Next Review:** After Phase 1 implementation  
**Auditor:** Senior QA Automation Engineer / Software Quality Architect