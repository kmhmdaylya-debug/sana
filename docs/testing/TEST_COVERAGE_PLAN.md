# Sana HRMS - Test Coverage Plan

**Version:** 1.0  
**Date:** 2026-11-18  
**Status:** Draft - Phase 1 Audit Complete

---

## 1. Coverage Targets

| Metric | Minimum Target | Stretch Target | Current Estimate |
|--------|---------------|----------------|------------------|
| **Backend Statements** | 80% | 90% | ~45% |
| **Backend Branches** | 75% | 85% | ~35% |
| **Backend Functions** | 80% | 90% | ~40% |
| **Backend Lines** | 80% | 90% | ~45% |
| **Critical Services** | 90% | 95% | ~20% |
| **Auth/Authz Logic** | 95% | 98% | ~60% |
| **Frontend Statements** | 70% | 80% | ~25% |
| **Frontend Branches** | 65% | 75% | ~20% |

---

## 2. Coverage by Module (Target vs Current)

| Module | Stmt Target | Current | Gap | Priority |
|--------|-------------|---------|-----|----------|
| **auth** | 95% | 70% | 25% | Critical |
| **users** | 90% | 65% | 25% | Critical |
| **roles** | 90% | 50% | 40% | High |
| **employees** | 90% | 0% | 90% | Critical |
| **attendance** | 90% | 15% | 75% | Critical |
| **leaves** | 90% | 0% | 90% | Critical |
| **payroll** | 90% | 20% | 70% | Critical |
| **contracts** | 85% | 0% | 85% | High |
| **documents** | 85% | 0% | 85% | High |
| **loans** | 85% | 0% | 85% | High |
| **shifts** | 85% | 0% | 85% | High |
| **projects** | 80% | 60% | 20% | High |
| **tasks** | 85% | 65% | 20% | High |
| **assets** | 80% | 0% | 80% | Medium |
| **training** | 80% | 0% | 80% | Medium |
| **evaluations** | 80% | 0% | 80% | Medium |
| **recruitment** | 80% | 0% | 80% | Medium |
| **lifecycle** | 80% | 0% | 80% | Medium |
| **admin** | 80% | 0% | 80% | Medium |
| **approvals** | 85% | 0% | 85% | High |
| **audit-log** | 90% | 0% | 90% | High |
| **reports** | 80% | 0% | 80% | Medium |
| **settings** | 80% | 0% | 80% | Low |
| **backup** | 90% | 30% | 60% | High |
| **dashboard** | 85% | 40% | 45% | High |
| **employee-panel** | 85% | 30% | 55% | High |
| **notifications** | 80% | 0% | 80% | Low |
| **org** | 85% | 0% | 85% | High |
| **tasks** | 85% | 65% | 20% | High |
| **projects** | 85% | 65% | 20% | High |
| **common/access** | 95% | 50% | 45% | Critical |
| **common/audit** | 90% | 20% | 70% | High |
| **common/filters** | 80% | 30% | 50% | High |
| **common/guards** | 85% | 20% | 65% | Medium |
| **common/filters** | 80% | 30% | 50% | High |
| **health** | 80% | 20% | 60% | Low |

---

## 3. Test Implementation Phases

### Phase 1: Foundation & Critical Services (Weeks 1-3)

| Week | Focus | Deliverables |
|------|-------|--------------|
| 1 | Test infrastructure, utilities, factories | `test-utils/`, `test-factories/`, Jest config with thresholds |
| 2-3 | Critical services: auth, users, access | ~150 unit tests, 90%+ coverage |

**Exit Criteria:**
- Jest coverage thresholds configured in `jest.config.js`
- Test utilities/factories published
- Auth, Users, Access services ≥ 90% coverage
- All new tests passing in CI

### Phase 2: Core Business Services (Weeks 4-7)

| Week | Focus | Deliverables |
|------|-------|--------------|
| 4-5 | Employees, Attendance, Leaves | ~300 unit tests, 90%+ coverage |
| 6-7 | Payroll, Contracts, Loans | ~250 unit tests, 85%+ coverage |

**Exit Criteria:**
- Critical business services ≥ 90% coverage
- All new tests passing in CI
- Integration test infrastructure ready

### Phase 3: Remaining Services & Integration (Weeks 8-10)

| Week | Focus | Deliverables |
|------|-------|--------------|
| 8 | Contracts, Documents, Loans, Shifts, Assets | ~300 unit tests |
| 9 | Remaining services, Integration test setup | ~200 unit tests, Integration test infra |
| 10 | E2E tests, Security tests, Coverage gates | E2E tests, Security tests, CI gates |

### Phase 4: Frontend, E2E & Quality Gates (Weeks 11-13)

| Week | Focus | Deliverables |
|------|-------|--------------|
| 11 | Frontend component tests (Vitest + RTL), E2E expansion | ~100 component tests, 20 E2E tests |
| 11 | Security tests, Accessibility tests | Security test suite, aXe CI |
| 12 | Coverage thresholds, CI/CD integration, mutation testing | CI gates, mutation testing |
| 13 | Final verification, documentation, reporting | Final report, all docs |

---

## 6. Test Scenarios by Service (Critical Modules)

### Auth Service (`auth.service.ts`, `auth.controller.ts`)
| Scenario | Priority | Test Type |
|----------|----------|-----------|
| Valid login with username | Critical | Unit + Integration |
| Valid login with mobile | Critical | Unit + Integration |
| Invalid password | Critical | Unit + Integration |
| Locked account | Critical | Unit + Integration |
| Expired password | High | Unit |
| Refresh token rotation | Critical | Unit + Integration |
| Refresh token replay detection | Critical | Unit + Integration |
| Refresh token grace period (15s) | High | Unit |
| Logout revokes refresh token | Critical | Integration |
| Password change with current password | Critical | Unit + Integration |
| Password change without current password (admin) | High | Unit |
| Weak password rejection | Critical | Unit |
| Password history prevention | Medium | Unit |
| JWT token structure validation | High | Unit |
| Token expiry handling | High | Unit |

### Users Service (`users.service.ts`)
| Scenario | Priority | Test Type |
|----------|----------|-----------|
| Create user with valid data | Critical | Unit + Integration |
| Create user with weak password | Critical | Unit |
| Create user with duplicate username | Critical | Unit |
| Create user with invalid email | High | Unit |
| Create user with roles and scopes | Critical | Unit + Integration |
| Get user by ID | High | Unit |
| List users with pagination | High | Unit |
| List users with filters (status, search) | High | Unit |
| Update user status | Critical | Unit + Integration |
| Update user roles | Critical | Unit + Integration |
| Update user scopes | Critical | Unit + Integration |
| Delete user (soft) | Critical | Unit + Integration |
| Prevent self-deactivation | Critical | Unit |
| Prevent superadmin deletion | Critical | Unit |
| Lock user account | High | Unit |
| Unlock user account | High | Unit |
| Change password | Critical | Unit + Integration |
| Prevent password reuse | Medium | Unit |

### Access Service (`access.service.ts`)
| Scenario | Priority | Test Type |
|----------|----------|-----------|
| Superadmin unrestricted access | Critical | Unit |
| Company-level scope | Critical | Unit |
| Branch-level scope | Critical | Unit |
| OrgUnit-level scope | Critical | Unit |
| Employee-level scope | Critical | Unit |
| Cross-company access denied | Critical | Unit |
| Cross-branch access denied | Critical | Unit |
| Cross-orgunit access denied | Critical | Unit |
| Employee self-access | Critical | Unit |
| Manager access to subordinates | Critical | Unit |
| Role-based permissions | Critical | Unit |
| Permission inheritance | High | Unit |
| Scope assignment validation | Critical | Unit |
| Grantable roles validation | Critical | Unit |
| Grantable scopes validation | Critical | Unit |

### Employees Service (`employees.service.ts`)
| Scenario | Priority | Test Type |
|----------|----------|-----------|
| Create employee with valid data | Critical | Unit + Integration |
| Create employee with duplicate code | Critical | Unit |
| Create employee with duplicate nationalId | Critical | Unit |
| Create employee with invalid nationalId | High | Unit |
| Create employee without required fields | Critical | Unit |
| Get employee by ID | High | Unit |
| List employees with pagination | High | Unit |
| List employees with filters (company, branch, orgUnit, status) | High | Unit |
| List employees with search | High | Unit |
| Update employee basic info | Critical | Unit + Integration |
| Update employee employment details | Critical | Unit + Integration |
| Update employee compensation | Critical | Unit + Integration |
| Update employee shift | High | Unit + Integration |
| Update employee manager | High | Unit + Integration |
| Transfer employee between org units | High | Unit + Integration |
| Terminate employee (soft delete) | Critical | Unit + Integration |
| Reactivate terminated employee | High | Unit + Integration |
| Prevent modification of terminated employee | Critical | Unit |
| Prevent duplicate code per company | Critical | Unit |
| Employee visibility (personal info access) | Critical | Unit + Integration |
| Employee bank accounts CRUD | High | Unit + Integration |
| Employee dependents CRUD | Medium | Unit + Integration |
| Employee skills CRUD | Medium | Unit + Integration |
| Employee employment events | High | Unit + Integration |
| Employee documents visibility | High | Unit + Integration |

### Attendance Service (`attendance.service.ts`)
| Scenario | Priority | Test Type |
|----------|----------|-----------|
| Create attendance event (check-in) | Critical | Unit + Integration |
| Create attendance event (check-out) | Critical | Unit + Integration |
| Duplicate idempotency key rejection | Critical | Unit |
| Invalid event type | High | Unit |
| Event for non-existent employee | High | Unit |
| Unauthorized employee access | Critical | Unit |
| Process daily attendance | Critical | Integration |
| Get attendance records with pagination | High | Unit |
| Get attendance records with filters | High | Unit |
| Update attendance record | High | Unit + Integration |
| Delete attendance record | Medium | Unit + Integration |
| Attendance correction request | Critical | Integration |
| Attendance correction approval | Critical | Integration |
| Attendance correction rejection | Critical | Integration |
| Shift assignment validation | High | Unit |
| Overtime calculation | High | Unit |
| Late arrival calculation | High | Unit |
| Early leave calculation | High | Unit |
| Absent status determination | High | Unit |
| Attendance statistics | Medium | Unit |

### Leaves Service (`leaves.service.ts`)
| Scenario | Priority | Test Type |
|----------|----------|-----------|
| List leave types | High | Unit |
| Create leave request | Critical | Unit + Integration |
| Overlapping leave request rejection | Critical | Unit |
| Insufficient leave balance | Critical | Unit |
| Leave balance calculation | Critical | Unit |
| Submit leave request | Critical | Unit + Integration |
| Approve leave request | Critical | Unit + Integration |
| Reject leave request | Critical | Unit + Integration |
| Cancel leave request | High | Unit + Integration |
| Cancel approved leave request | High | Unit + Integration |
| Cancel rejected leave request | Medium | Unit + Integration |
| Unauthorized access to other's leave | Critical | Unit |
| Leave balance grant | High | Unit |
| Leave balance consume | High | Unit |
| Leave transaction log | Medium | Unit |
| Leave request cancellation by manager | High | Unit + Integration |
| Leave conflict detection | Critical | Unit |

### Payroll Service (`payroll.service.ts`)
| Scenario | Priority | Test Type |
|----------|----------|-----------|
| Create payroll period | Critical | Unit + Integration |
| Duplicate period prevention | Critical | Unit |
| Lock payroll period | Critical | Unit + Integration |
| Unlock payroll period | Medium | Unit + Integration |
| Generate payroll items | Critical | Integration |
| Calculate gross salary | Critical | Unit |
| Calculate allowances | Critical | Unit |
| Calculate deductions | Critical | Unit |
| Calculate overtime | Critical | Unit |
| Calculate loan installment deduction | Critical | Unit |
| Calculate tax | High | Unit |
| Calculate net salary | Critical | Unit |
| Rounding and precision | High | Unit |
| Generate payslips | Critical | Integration |
| Approve payslips | Critical | Unit + Integration |
| Publish payslips | Critical | Unit + Integration |
| Lock period prevents changes | Critical | Unit |
| Duplicate payroll prevention | Critical | Unit |
| Historical payroll consistency | High | Integration |
| Payroll statistics | Medium | Unit |

### Contracts Service (`contracts.service.ts`)
| Scenario | Priority | Test Type |
|----------|----------|-----------|
| Create contract | Critical | Unit + Integration |
| Duplicate contract prevention | Critical | Unit |
| Get contract by ID | High | Unit |
| List contracts with pagination | High | Unit |
| Update contract | Critical | Unit + Integration |
| Create contract version | Critical | Unit + Integration |
| Version ordering (newest first) | High | Unit |
| Contract status transitions | Critical | Unit + Integration |
| Approve contract | Critical | Unit + Integration |
| Reject contract | High | Unit + Integration |
| Terminate contract | Critical | Unit + Integration |
| Soft delete contract | High | Unit + Integration |
| Contract approval workflow | High | Integration |

### Documents Service (`documents.service.ts`)
| Scenario | Priority | Test Type |
|----------|----------|-----------|
| Upload valid document | Critical | Unit + Integration |
| Reject invalid file type | Critical | Unit |
| Reject oversized file | Critical | Unit |
| Reject mismatched MIME/magic bytes | Critical | Unit |
| Virus scan rejection | High | Integration |
| Document versioning | High | Unit + Integration |
| Document download | High | Integration |
| Document download audit log | High | Integration |
| Soft delete document | High | Unit + Integration |
| Document access control | Critical | Unit |

### Loans Service (`loans.service.ts`)
| Scenario | Priority | Test Type |
|----------|----------|-----------|
| Create loan request | Critical | Unit + Integration |
| Reject non-positive amount | Critical | Unit |
| Reject negative installments | Critical | Unit |
| Approve loan | Critical | Unit + Integration |
| Reject loan | High | Unit + Integration |
| Disburse loan | Critical | Unit + Integration |
| Create installments | Critical | Unit + Integration |
| Pay installment | Critical | Unit + Integration |
| Overpayment rejection | Critical | Unit |
| Underpayment handling | High | Unit |
| Early repayment | Medium | Unit + Integration |
| Loan balance calculation | High | Unit |
| Loan cancellation | High | Unit + Integration |
| Idempotent payment processing | Critical | Unit |

### Dashboard Service (`dashboard.service.ts`)
| Scenario | Priority | Test Type |
|----------|----------|-----------|
| Team work items | High | Unit + Integration |
| Today attendance | High | Unit + Integration |
| My dashboard | High | Unit + Integration |
| Management dashboard | Critical | Unit + Integration |
| Leave trend | Medium | Unit + Integration |
| Scope filtering | Critical | Unit |
| Unauthorized access | Critical | Unit |

### Projects & Tasks Services
| Scenario | Priority | Test Type |
|----------|----------|-----------|
| Create project | High | Unit + Integration |
| Project member management | High | Unit + Integration |
| Create task | High | Unit + Integration |
| Task assignment | High | Unit + Integration |
| Task status transitions | High | Unit + Integration |
| Task dependencies | High | Unit + Integration |
| Circular dependency prevention | High | Unit |
| Gantt chart data | Medium | Unit |
| Task deadline calculations | High | Unit |
| Task comments | Medium | Unit + Integration |
| Project attendance | Medium | Unit + Integration |
| Project completion calculation | Medium | Unit |

### Dashboard Service
| Scenario | Priority | Test Type |
|----------|----------|-----------|
| Team work items | High | Unit + Integration |
| Today attendance | High | Unit + Integration |
| My dashboard | High | Unit + Integration |
| Management dashboard | Critical | Unit + Integration |
| Leave trend | Medium | Unit + Integration |
| Scope filtering | Critical | Unit |
| Unauthorized access | Critical | Unit |

---

## 8. Frontend Test Scenarios

### Component Tests (Vitest + React Testing Library)

| Component | Scenarios |
|-----------|-----------|
| **Login** | Valid login, invalid credentials, locked account, password visibility, RTL layout |
| **ChangePassword** | Strength meter, weak/medium/strong, current password required, success/error states |
| **DataTable** | Sorting, filtering, pagination, row actions, keyboard nav, RTL, empty state |
| **Modal** | Open/close, focus trap, ESC close, overlay click, portal rendering |
| **DatePicker** | Jalali/Gregorian, range selection, disabled dates, RTL, keyboard |
| **EntityPicker** | Search, select, create new, clear, keyboard nav |
| **Form Fields** | Validation, error display, Persian digits, RTL |
| **DataTable** | Virtualization, sorting, filtering, row actions, keyboard nav |
| **Dashboard** | Widgets, charts, stats, loading, empty states |
| **EmployeePanel** | Task list, countdown, leave requests, missions, payslips |
| **ErrorBoundary** | Error capture, fallback UI, reload button |

### E2E Tests (Playwright)
- See `frontend/tests/e2e/journeys.spec.ts` - 12 journeys already implemented
- Need to add: Error boundary trigger, offline behavior, slow network, concurrent edits

---

## 9. Security Test Scenarios

| Category | Scenarios |
|----------|-----------|
| **Authentication** | Brute force, credential stuffing, session fixation, JWT tampering, expired tokens |
| **Authorization** | IDOR, RBAC bypass, ABAC scope bypass, privilege escalation, cross-tenant access |
| **Input Validation** | SQL injection, XSS, command injection, path traversal, prototype pollution |
| **File Upload** | MIME sniffing, magic bytes, polyglot files, SVG XSS, oversized, zip bombs |
| **Session Management** | Session fixation, concurrent sessions, token rotation, logout invalidation |
| **Data Exposure** | PII in logs, error messages, API responses, audit logs |
| **API Security** | Rate limiting, CORS, CSRF, security headers, CSP |
| **Audit Log** | Tampering, completeness, retention, access control |

---

## 9. CI/CD Quality Gates

```yaml
# Required quality gates for CI/CD pipeline
quality_gates:
  backend_unit_tests:
    required: true
    threshold: "pass"
  
  backend_coverage:
    statements: 80%
    branches: 75%
    functions: 80%
    lines: 80%
    
  critical_services_coverage:
    statements: 90%
    branches: 85%
    functions: 90%
    
  auth_authz_coverage:
    statements: 95%
    branches: 90%
    functions: 95%
    
  frontend_tests:
    required: true
    threshold: "pass"
    
  frontend_coverage:
    statements: 70%
    branches: 65%
    functions: 70%
    
  e2e_tests:
    required: true
    threshold: "pass"
    critical_journeys: 12
    
  accessibility_tests:
    required: true
    threshold: "zero critical/serious violations"
    
  security_tests:
    required: true
    threshold: "pass"
    
  mutation_testing:
    threshold: 70% (stretch)
    
  type_check:
    required: true
    
  lint:
    required: true
    
  build:
    required: true
```

---

## 10. Implementation Checklist

### Phase 1: Foundation (Week 1)
- [ ] Create `docs/testing/TEST_AUDIT.md` ✅
- [ ] Create `docs/testing/TEST_COVERAGE_PLAN.md` ✅
- [ ] Create `docs/testing/UNIT_TESTING_GUIDE.md`
- [ ] Create test utilities: `backend/src/common/testing/`
  - [ ] `prisma-mock.ts` - Prisma mock factory
  - [ ] `test-data-factory.ts` - Test data builders
  - [ ] `mock-authenticated-user.ts` - Auth user mocks
  - [ ] `mock-access-service.ts` - Access service mock
  - [ ] `mock-audit-service.ts` - Audit service mock
- [ ] Update `backend/jest.config.js` with coverage thresholds
- [ ] Add `collectCoverageFrom` to exclude non-source files

### Phase 2: Critical Services (Weeks 2-4)
- [ ] `AuthService` unit tests
- [ ] `UsersService` unit tests
- [ ] `AccessService` unit tests
- [ ] `EmployeesService` unit tests
- [ ] `AttendanceService` unit tests
- [ ] `LeavesService` unit tests
- [ ] `PayrollService` unit tests
- [ ] `AuthController` integration tests

### Phase 3: Core Business Services (Weeks 5-8)
- [ ] `ContractsService` unit tests
- [ ] `DocumentsService` unit tests
- [ ] `LoansService` unit tests
- [ ] `ShiftsService` unit tests
- [ ] `AssetsService` unit tests
- [ ] `TrainingService` unit tests
- [ ] `EvaluationsService` unit tests
- [ ] `RecruitmentService` unit tests
- [ ] `LifecycleService` unit tests
- [ ] `AdminService` unit tests
- [ ] `ApprovalsService` unit tests
- [ ] `AuditLogService` unit tests
- [ ] `ReportsService` unit tests
- [ ] `SettingsService` unit tests
- [ ] `BackupService` unit tests
- [ ] `DashboardService` unit tests
- [ ] `EmployeePanelService` unit tests
- [ ] `NotificationsService` unit tests
- [ ] `AnnouncementsService` unit tests
- [ ] `OrgService` unit tests
- [ ] `TasksService` additional tests
- [ ] `ProjectsService` additional tests

### Phase 4: Integration & E2E (Weeks 9-11)
- [ ] Database integration test infrastructure
- [ ] Integration tests for all critical workflows
- [ ] Playwright E2E test expansion (12 → 25+ scenarios)
- [ ] Security test suite
- [ ] Accessibility test suite (axe-core)

### Phase 5: Quality Gates & CI/CD (Weeks 12-13)
- [ ] Jest coverage thresholds in `jest.config.js`
- [ ] CI/CD pipeline with quality gates
- [ ] Mutation testing (Stryker)
- [ ] Bundle size analysis in CI
- [ ] Dependency vulnerability scanning
- [ ] Documentation completion

---

## 11. Test File Naming & Structure Conventions

```
backend/
├── src/
│   ├── module/
│   │   ├── service.ts
│   │   ├── service.spec.ts          # Unit tests
│   │   ├── controller.spec.ts       # Controller tests
│   │   └── module.integration.spec.ts # Integration tests
│   └── common/
│       └── testing/
│           ├── prisma-mock.ts
│           ├── test-factories.ts
│           └── index.ts

frontend/
├── src/
│   ├── component/
│   │   ├── Component.tsx
│   │   └── Component.test.tsx       # Vitest + RTL
│   ├── hooks/
│   │   ├── hook.ts
│   │   └── hook.test.ts
│   └── lib/
│       ├── util.ts
│       └── util.test.ts             # Node test runner
├── tests/
│   ├── e2e/
│   │   ├── journeys.spec.ts
│   │   ├── accessibility.spec.ts
│   │   ├── security.spec.ts
│   │   └── fixtures/
│   └── integration/
│       └── api.spec.ts
```

---

## 12. Dependencies to Add

```json
{
  "devDependencies": {
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.5.0",
    "@testing-library/jest-dom": "^6.4.0",
    "vitest": "^2.0.0",
    "@vitest/coverage-v8": "^2.0.0",
    "msw": "^2.3.0",
    "stryker": "^8.0.0",
    "@stryker-mutator/jest-runner": "^8.0.0",
    "@pact-foundation/pact": "^13.0.0",
    "k6": "^0.50.0"
  }
}
```

---

## 13. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Backend statement coverage | ≥ 80% | Jest coverage report |
| Backend branch coverage | ≥ 75% | Jest coverage report |
| Backend function coverage | ≥ 80% | Jest coverage report |
| Critical services coverage | ≥ 90% | Jest coverage report |
| Auth/authz coverage | ≥ 95% | Jest coverage report |
| Frontend statement coverage | ≥ 70% | Vitest coverage report |
| E2E critical journeys | 12/12 passing | Playwright HTML report |
| Accessibility violations | 0 critical/serious | axe-core/Playwright report |
| Security tests | All passing | Playwright security suite |
| Mutation score | ≥ 70% | Stryker report |
| TypeScript errors | 0 | `tsc --noEmit` |
| ESLint errors | 0 | `eslint` |
| Build success | ✅ | CI pipeline |

---

## 14. Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Insufficient test coverage in critical services | High | High | Prioritize critical services first, enforce CI gates |
| Flaky E2E tests | Medium | Medium | Retry logic, proper waits, test isolation |
| Database integration test flakiness | High | Medium | Isolated test DBs, proper cleanup |
| Frontend test setup complexity | Medium | Medium | Use Vitest + RTL, avoid complex setup |
| Coverage threshold too aggressive | Medium | Low | Start with 70%, increment by 5% per sprint |
| Time constraints | High | High | Prioritize critical paths, parallelize CI |

---

## 15. Approval

| Role | Name | Signature | Date |
|------|------|-----------|------|
| QA Lead | | | |
| Backend Lead | | | |
| Frontend Lead | | | |
| Security Lead | | | |
| DevOps Lead | | | |

---

**Document Control:**
- Version: 1.0
- Classification: Internal
- Review Cycle: Sprintly
- Next Review: Sprint Planning

---

**End of Test Coverage Plan**