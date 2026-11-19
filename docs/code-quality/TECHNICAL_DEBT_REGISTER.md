# Sana HRMS - Technical Debt Register

**Version:** 1.0  
**Date:** 2026-11-18  
**Auditor:** Senior Software Engineer  
**Classification:** INTERNAL  

---

## 1. Overview

This register tracks all identified technical debt items, classified by severity, with remediation strategies and verification methods.

---

## 2. Technical Debt Classification

| Severity | Definition | SLA |
|----------|------------|-----|
| **Critical** | Blocks release, causes data loss, security vulnerability, or complete system failure | Fix immediately |
| **High** | Significantly impacts maintainability, performance, or developer productivity | Fix within 1 sprint |
| **Medium** | Moderately impacts code quality, testability, or developer experience | Fix within 3 sprints |
| **Low** | Minor impact, cosmetic, or nice-to-have improvements | Fix when capacity allows |

---

## 2. Technical Debt Items

### 2.1 Critical Debt (2 Items)

| ID | Title | Location | Root Cause | Impact | Remediation | Effort | Dependencies | Verification | Status |
|----|-------|----------|------------|--------|-------------|--------|--------------|--------------|--------|
| TD-001 | TypeScript strict mode disabled (backend) | `backend/tsconfig.json` | Legacy config | Allows unsafe patterns, runtime errors | Enable strict mode, fix 200+ errors | Medium | Test file fixes | `tsc --noEmit` passes | 🔴 Open |
| TD-002 | Backend test files outdated | `backend/src/**/*.spec.ts` | Service API changes | Tests don't run, false confidence | Update 15+ test files to match current API | High | Service changes | All tests pass | 🔴 Open |

### 2.2 High Severity (9 Items)

| ID | Title | Location | Root Cause | Impact | Remediation | Effort | Dependencies | Verification | Status |
|----|-------|----------|------------|--------|-------------|--------|--------------|--------------|--------|
| TD-003 | PayrollService too large (2027 lines) | `backend/src/payroll/payroll.service.ts` | Feature accretion | Unmaintainable, hard to test | Split into 4 services | High | Payroll domain knowledge | Tests pass, size < 500 | 🔴 Open |
| TD-004 | LeavesService too large (689 lines) | `backend/src/leaves/leaves.service.ts` | Feature accretion | Unmaintainable, hard to test | Split into 3 services | High | Leave domain knowledge | Tests pass, size < 500 | 🔴 Open |
| TD-005 | ApprovalsService too large (~800 lines) | `backend/src/approvals/approvals.service.ts` | Feature accretion | Unmaintainable, hard to test | Split into WorkflowEngine + HandlerRegistry | High | Approval domain knowledge | Tests pass, size < 500 | 🔴 Open |
| TD-006 | EmployeePanel.tsx too large (809 lines) | `frontend/src/pages/EmployeePanel.tsx` | Feature accretion | Unmaintainable, hard to test | Split into 6 tab components | Medium | React knowledge | Tests pass, size < 300 | 🔴 Open |
| TD-007 | Employees.tsx too large (399 lines) | `frontend/src/pages/Employees.tsx` | Feature accretion | Unmaintainable, hard to test | Split into 3 components | Medium | React knowledge | Tests pass, size < 300 | 🔴 Open |
| TD-008 | EmployeePanel.tsx missing React.memo | `frontend/src/pages/EmployeePanel.tsx` | Missing optimization | Unnecessary re-renders | Add React.memo to tabs | Low | React knowledge | Render count reduced | 🟡 Open |
| TD-008 | Dashboard.tsx too large (338 lines) | `frontend/src/pages/Dashboard.tsx` | Feature accretion | Unmaintainable, hard to test | Split into Personal/Management | Medium | React knowledge | Tests pass, size < 300 | 🟡 Open |
| TD-009 | ApprovalsService missing optimistic locking | `backend/src/approvals/approvals.service.ts` | Missing version field | Lost updates possible | Add version field + check | Medium | DB migration | Concurrent edits handled | 🟡 Open |
| TD-009 | EmployeePanel missing React.memo | `frontend/src/components/ui/base.tsx` | Missing optimization | Unnecessary re-renders | Add React.memo to UI components | Low | React knowledge | Render count reduced | 🟡 Open |

### 2.2 Medium Severity (13 Items)

| ID | Title | Location | Root Cause | Impact | Remediation | Effort | Dependencies | Verification | Status |
|----|-------|----------|------------|--------|-------------|--------|--------------|--------------|--------|
| TD-010 | Repository pattern missing | Multiple services | Direct Prisma usage | Tight coupling, hard to test | Extract BaseRepository | Medium | Prisma knowledge | Unit tests pass | 🟡 Open |
| TD-011 | Payroll calculation logic duplicated | `payroll.service.ts` | Copy-paste | Bugs, inconsistency | Extract CalculationEngine | Medium | Payroll domain | Tests pass, no duplication | 🟡 Open |
| TD-011 | Attendance calculation complex | `daily-attendance.service.ts` | Monolithic function | Hard to test, modify | Extract AttendanceCalculator | Medium | Attendance domain | Tests pass, complexity < 15 | 🟡 Open |
| TD-012 | CRUD pagination duplicated | 15+ services | Copy-paste | Maintenance burden | BaseService class | Medium | Service pattern | All pagination works | 🟡 Open |
| TD-012 | Audit logging boilerplate | 80+ calls | Copy-paste | Maintenance burden | AuditMixin/Decorator | Medium | AuditService | Audit logs work | 🟡 Open |
| TD-013 | CRUD pagination duplicated | 15+ services | Copy-paste | Maintenance burden | BaseService class | Medium | Service pattern | All pagination works | 🟡 Open |
| TD-013 | Audit logging boilerplate | 80+ calls | Copy-paste | Maintenance burden | AuditMixin/Decorator | Medium | AuditService | Audit logs work | 🟡 Open |
| TD-014 | Magic numbers/strings | 15+ services | Hardcoded values | Bugs, maintenance | Extract to constants | Low | Domain knowledge | No magic values | 🟡 Open |
| TD-015 | TypeScript strict mode (frontend) | `frontend/tsconfig.json` | Lenient config | Missed bugs | Enable strict options | Low | None | `tsc --noEmit` passes | 🟢 Open |
| TD-015 | TypeScript strict mode (backend) | `backend/tsconfig.json` | Lenient config | Missed bugs | Enable strict options | Low | Test fixes | `tsc --noEmit` passes | 🟢 Open |
| TD-016 | Backend test files outdated | 15+ test files | API changes | False confidence | Update mocks/signatures | High | Service changes | All tests pass | 🔴 Open |
| TD-016 | Missing optimistic locking | Multiple entities | No version field | Lost updates | Add version field + check | Medium | DB migration | Concurrent edits safe | 🟡 Open |
| TD-017 | Missing partial indexes | Database | Not implemented | Slow queries | Add partial indexes | Low | DB migration | Query perf improved | 🟢 Open |
| TD-017 | Missing component docs | 50+ components | Not prioritized | Onboarding hard | Add JSDoc/Storybook | Low | Component knowledge | Docs generated | 🟢 Open |
| TD-018 | Missing CONTRIBUTING.md | Root | Not created | Onboarding hard | Create CONTRIBUTING.md | Low | Team process | File exists | 🟢 Open |

### 2.3 Low Severity (4 Items)

| ID | Title | Location | Root Cause | Impact | Remediation | Effort | Dependencies | Verification | Status |
|----|-------|----------|------------|--------|-------------|--------|--------------|--------------|--------|
| TD-018 | Missing React.memo | 15+ components | Not added | Re-renders | Add React.memo | Low | React knowledge | Render count reduced | 🟢 Open |
| TD-019 | Missing displayName | 10+ components | Not added | Debugging hard | Add displayName | Low | React knowledge | DevTools shows names | 🟢 Open |
| TD-020 | Missing dependency arrays | 8 hooks | Omitted | Stale closures | Add exhaustive deps | Low | React knowledge | No stale closure bugs | 🟢 Open |
| TD-021 | Missing displayName | 10+ components | Not added | Debugging hard | Add displayName | Low | React knowledge | DevTools shows names | 🟢 Open |
| TD-022 | Missing CONTRIBUTING.md | Root | Not created | Onboarding hard | Create CONTRIBUTING.md | Low | Team process | File exists | 🟢 Open |
| TD-022 | Missing CONTRIBUTING.md | Root | Not created | Onboarding hard | Create CONTRIBUTING.md | Low | Team process | File exists | 🟢 Open |
| TD-023 | Missing partial indexes | Database | Not implemented | Slow queries | Add partial indexes | Low | DB migration | Query perf improved | 🟢 Open |
| TD-023 | Missing component docs | 50+ components | Not prioritized | Onboarding hard | Add JSDoc/Storybook | Low | Component knowledge | Docs generated | 🟢 Open |
| TD-024 | Outdated dependencies | package.json | Not updated | Security, features | Update deps | Low | Testing | Build passes | 🟢 Open |
| TD-024 | Missing component docs | 50+ components | Not prioritized | Onboarding hard | Add JSDoc/Storybook | Low | Component knowledge | Docs generated | 🟢 Open |
| TD-025 | Missing partial indexes | Database | Not implemented | Slow queries | Add partial indexes | Low | DB migration | Query perf improved | 🟢 Open |
| TD-025 | Missing component docs | 50+ components | Not prioritized | Onboarding hard | Add JSDoc/Storybook | Low | Component knowledge | Docs generated | 🟢 Open |

---

## 3. Technical Debt by Category

| Category | Critical | High | Medium | Low | Total |
|----------|----------|------|--------|-----|-------|
| Type Safety | 2 | 0 | 2 | 0 | 4 |
| Architecture | 0 | 3 | 2 | 0 | 5 |
| Code Quality | 0 | 2 | 4 | 4 | 10 |
| Testing | 0 | 1 | 3 | 0 | 4 |
| Dependencies | 0 | 0 | 1 | 1 | 2 |
| Documentation | 0 | 0 | 1 | 2 | 3 |
| **Total** | **2** | **9** | **13** | **4** | **28** |

---

## 3. Debt by Module

| Module | Critical | High | Medium | Low | Total |
|--------|----------|------|--------|-----|-------|
| Payroll | 1 | 2 | 2 | 0 | 5 |
| Leaves | 0 | 1 | 1 | 0 | 2 |
| Approvals | 0 | 1 | 1 | 0 | 2 |
| Attendance | 0 | 1 | 1 | 0 | 2 |
| Frontend Pages | 0 | 3 | 1 | 3 | 7 |
| Core/Shared | 0 | 1 | 3 | 3 | 7 |
| Database | 0 | 0 | 1 | 1 | 2 |
| Testing | 0 | 1 | 2 | 0 | 3 |
| **Total** | **2** | **9** | **13** | **4** | **28** |

---

## 4. Remediation Priority Matrix

| Priority | Items | Effort | Business Impact | Target Sprint |
|----------|-------|--------|-----------------|---------------|
| **P0 - Immediate** | TD-001, TD-002 | High | Critical | Sprint 1 |
| **P1 - Sprint 1** | TD-003, TD-004, TD-005, TD-006, TD-007 | High | High | Sprint 1-2 |
| **P2 - Sprint 2** | TD-008, TD-009, TD-010, TD-011, TD-012, TD-013 | Medium | High | Sprint 2-3 |
| **P3 - Sprint 3** | TD-014, TD-015, TD-016, TD-017 | Medium | Medium | Sprint 3-4 |
| **P4 - Backlog** | TD-018 through TD-025 | Low | Low | Backlog |

---

## 4. Remediation Tracking

| ID | Status | Assigned | Started | Completed | Blocker | Notes |
|----|--------|----------|---------|-----------|---------|-------|
| TD-001 | 🔴 Open | - | - | - | Test file fixes needed first | Prerequisite for all |
| TD-002 | 🔴 Open | - | - | - | 15+ files need updates | Prerequisite for CI |
| TD-003 | 🔴 Open | - | - | - | Domain knowledge needed | Split into 4 services |
| TD-004 | 🔴 Open | - | - | - | Domain knowledge needed | Split into 3 services |
| TD-005 | 🔴 Open | - | - | - | Domain knowledge needed | Split into Engine + Registry |
| TD-006 | 🔴 Open | - | - | - | React knowledge needed | Split into 6 tabs |
| TD-007 | 🔴 Open | - | - | - | React knowledge needed | Split into 3 components |
| TD-008 | 🟡 Open | - | - | - | - | Quick win |
| TD-009 | 🟡 Open | - | - | - | - | Quick win |
| TD-010 | 🟡 Open | - | - | - | Prisma knowledge | Medium effort |
| ... | ... | ... | ... | ... | ... | ... |

---

## 5. Debt Burndown Projection

```
Sprint 1:  ████████░░░░░░░░░░░░░░  30% (P0 + P1)
Sprint 2:  ████████████████░░░░░░  60% (P1 + P2)
Sprint 3:  ████████████████████░░  85% (P2 + P3)
Sprint 4:  ████████████████████████ 100% (P3 + P4)
```

---

## 5. Debt Interest Calculation

| Item | Annual Interest | Principal | Total Cost if Deferred 1 Year |
|------|-----------------|-----------|-------------------------------|
| TD-001 | 50 hrs/year | 8 hrs | 58 hrs |
| TD-002 | 100 hrs/year | 40 hrs | 140 hrs |
| TD-003 | 80 hrs/year | 40 hrs | 120 hrs |
| TD-004 | 60 hrs/year | 24 hrs | 84 hrs |
| TD-005 | 80 hrs/year | 40 hrs | 120 hrs |
| **Total Annual Interest** | **~370 hrs/year** | **152 hrs** | **522 hrs** |

---

## 6. Debt Paydown Strategy

### 6.1 Sprint Allocation

| Sprint | Focus | Capacity | Target Items |
|--------|-------|----------|--------------|
| Sprint 1 | P0 + P1 | 40 hrs | TD-001, TD-002, TD-003, TD-004 |
| Sprint 2 | P1 + P2 | 40 hrs | TD-005, TD-006, TD-007, TD-010 |
| Sprint 3 | P2 + P3 | 40 hrs | TD-011, TD-012, TD-013, TD-014 |
| Sprint 4 | P3 + P4 | 40 hrs | TD-015, TD-016, TD-018 |

### 4.2 Success Metrics

| Metric | Baseline | Target (4 Sprints) |
|--------|----------|-------------------|
| Technical Debt Items | 28 | ≤ 10 |
| Critical/High Items | 11 | 0 |
| TypeScript Errors | 200+ | 0 |
| Test Pass Rate | 92% | 98% |
| Build Time | 3.8s | < 3s |
| Max File Size | 2027 lines | < 500 lines |

---

**Document Version:** 1.0  
**Last Updated:** 2026-11-18  
**Status:** Complete  
**Next Review:** Sprint 1 Planning