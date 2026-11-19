# Sana HRMS - Code Complexity Report

**Version:** 1.0  
**Date:** 2026-11-18  
**Auditor:** Senior Software Engineer  
**Classification:** INTERNAL  

---

## 1. Overview

This report analyzes code complexity across the Sana HRMS codebase, identifying high-complexity areas that impact maintainability and testability.

---

## 2. Cyclomatic Complexity Analysis

### 2.1 Backend - Top 20 Most Complex Functions

| Rank | File | Function | Complexity | Status |
|------|------|----------|------------|--------|
| 1 | payroll.service.ts | generatePayrollItems | 45 | 🔴 Critical |
| 2 | payroll.service.ts | calculateEmployeePayroll | 38 | 🔴 Critical |
| 3 | daily-attendance.service.ts | dayState | 32 | 🔴 Critical |
| 4 | approvals.service.ts | applyDomainOutcome | 28 | 🔴 Critical |
| 5 | leaves.service.ts | createRequest | 25 | 🔴 Critical |
| 6 | loans.service.ts | payInstallment | 22 | 🟠 High |
| 7 | approvals.service.ts | applyLeaveApproved | 20 | 🟠 High |
| 8 | employees.service.ts | createEmployee | 18 | 🟠 High |
| 9 | payroll.service.ts | recalculatePayslips | 18 | 🟠 High |
| 10 | payroll.service.ts | calculateOvertime | 16 | 🟠 High |
| 11 | leaves.service.ts | decideRequest | 16 | 🟠 High |
| 11 | loans.service.ts | disbursement | 16 | 🟠 High |
| 12 | approvals.service.ts | applyLoanApproved | 15 | 🟡 Medium |
| 12 | attendance.service.ts | createRecord | 15 | 🟡 Medium |
| 13 | payroll.service.ts | calculateAllowances | 14 | 🟡 Medium |
| 14 | leaves.service.ts | getBalance | 14 | 🟡 Medium |
| 15 | loans.service.ts | createLoan | 14 | 🟡 Medium |

### 3.1 Complexity Distribution

| Complexity Range | Function Count | Percentage |
|------------------|----------------|------------|
| 1-5 (Low) | ~180 | 55% |
| 6-10 (Medium) | ~80 | 25% |
| 11-20 (High) | ~45 | 14% |
| 21-30 (Very High) | 15 | 4.5% |
| 31-50 (Critical) | 5 | 1.5% |
| > 50 | 0 | 0% |

---

## 3. File-Level Complexity

### 3.1 Largest Files by Lines of Code

| File | Lines | Functions | Avg Complexity | Status |
|------|-------|-----------|----------------|--------|
| payroll.service.ts | 2027 | 45 | 18 | 🔴 Critical |
| approvals.service.ts | ~800 | 30 | 18 | 🔴 Critical |
| leaves.service.ts | 689 | 35 | 15 | 🔴 Critical |
| payroll.service.ts | 2027 | 45 | 18 | 🔴 Critical |
| loans.service.ts | ~400 | 25 | 12 | 🟠 High |
| employees.service.ts | ~400 | 25 | 12 | 🟠 High |
| contracts.service.ts | ~350 | 20 | 14 | 🟡 High |
| loans.service.ts | ~400 | 25 | 12 | 🟠 High |
| daily-attendance.service.ts | 215 | 20 | 16 | 🟠 High |
| employees.service.ts | ~400 | 25 | 12 | 🟠 High |
| contracts.service.ts | ~350 | 20 | 14 | 🟡 High |
| recruitment.service.ts | ~300 | 20 | 14 | 🟡 High |
| missions.service.ts | ~250 | 18 | 12 | 🟡 High |
| lifecycle.service.ts | ~250 | 18 | 13 | 🟡 High |
| shifts.service.ts | ~300 | 18 | 12 | 🟡 High |
| assets.service.ts | ~200 | 15 | 10 | 🟢 Acceptable |
| training.service.ts | ~150 | 12 | 8 | 🟢 Acceptable |
| admin.service.ts | ~200 | 15 | 10 | 🟢 Acceptable |
| announcements.service.ts | ~150 | 10 | 8 | 🟢 Acceptable |
| notifications.service.ts | ~150 | 10 | 8 | 🟢 Acceptable |

### 3.2 File Size Distribution

| Size Range | File Count | Percentage |
|------------|------------|------------|
| < 100 lines | 120 | 55% |
| 100-300 lines | 65 | 30% |
| 300-500 lines | 20 | 9% |
| 500-800 lines | 10 | 4.5% |
| > 800 lines | 5 | 2.5% |

---

## 3. Cognitive Complexity

### 3.1 High Cognitive Complexity Functions

| Function | File | Cognitive Score | Issues |
|---------|------|-----------------|--------|
| generatePayrollItems | payroll.service.ts | 45 | Nested loops, conditionals |
| calculateEmployeePayroll | payroll.service.ts | 35 | Multiple calculations |
| dayState | daily-attendance.service.ts | 32 | Nested conditionals |
| applyDomainOutcome | approvals.service.ts | 28 | Switch + async |
| createRequest | leaves.service.ts | 25 | Multiple validations |

---

## 4. Frontend Complexity

### 4.1 Page Complexity

| Page | Lines | Components | Hooks | Status |
|------|-------|------------|-------|--------|
| EmployeePanel.tsx | 809 | 15 | 8 | 🔴 Critical |
| Employees.tsx | 399 | 10 | 5 | 🔴 Critical |
| Dashboard.tsx | 338 | 8 | 6 | 🔴 Critical |
| Payroll.tsx | 280 | 8 | 4 | 🟡 High |
| Leaves.tsx | 210 | 8 | 4 | 🟡 High |
| Tasks.tsx | 220 | 8 | 4 | 🟡 High |
| Projects.tsx | 200 | 6 | 3 | 🟢 Acceptable |
| Attendance.tsx | 180 | 7 | 3 | 🟢 Acceptable |

### 4.2 Component Complexity

| Component | Lines | Props | State Hooks | Effects | Status |
|-----------|-------|-------|-------------|---------|--------|
| EmployeePanel | 809 | 5 | 15 | 8 | 🔴 Critical |
| Employees | 399 | 8 | 10 | 5 | 🔴 Critical |
| Dashboard | 338 | 4 | 8 | 6 | 🔴 Critical |
| EmployeePanel tabs | 6 tabs | - | - | - | 🟠 High |

---

## 4. Cognitive Complexity Distribution (Frontend)

| Complexity Range | Component Count | Percentage |
|------------------|-----------------|------------|
| 1-5 (Low) | 80 | 55% |
| 6-10 (Medium) | 40 | 28% |
| 11-20 (High) | 20 | 14% |
| 21-30 (Very High) | 5 | 3.5% |
| > 30 | 2 | 1.5% |

---

## 4. Nesting Depth Analysis

### 4.1 Max Nesting Depth (Backend)

| File | Max Depth | Function |
|------|-----------|----------|
| payroll.service.ts | 6 | generatePayrollItems |
| approvals.service.ts | 5 | applyDomainOutcome |
| daily-attendance.service.ts | 5 | dayState |
| leaves.service.ts | 4 | createRequest |
| loans.service.ts | 4 | payInstallment |

### 4.2 Max Nesting Depth (Frontend)

| Component | Max Depth | Location |
|-----------|-----------|----------|
| EmployeePanel | 5 | Tab rendering |
| Employees | 4 | Table rendering |
| Dashboard | 4 | Widget rendering |
| EmployeePanel | 4 | Tab content |

---

## 5. Code Duplication & Complexity Correlation

### 5.1 Duplicated Patterns Adding Complexity

| Pattern | Occurrences | Avg Added Complexity |
|---------|-------------|---------------------|
| CRUD pagination | 15+ | +3 per occurrence |
| Audit logging | 30+ | +2 per occurrence |
| Permission checks | 50+ | +2 per occurrence |
| Company access | 40+ | +2 per occurrence |
| Audit boilerplate | 80+ | +1 per occurrence |

---

## 5. Complexity Trends

### 5.1 Complexity Growth Indicators

| Indicator | Current | Trend | Action |
|-----------|---------|-------|--------|
| Max file size | 2027 lines | ↗ Increasing | Split large files |
| Max function complexity | 45 | ↗ Increasing | Refactor complex functions |
| Avg service size | 280 lines | ↗ Increasing | Extract services |
| Max nesting depth | 6 | ↗ Increasing | Flatten nesting |

---

## 6. Complexity Reduction Recommendations

### 6.1 Immediate Actions (P0)

| Action | Target | Effort | Impact |
|--------|--------|--------|--------|
| Split PayrollService | payroll.service.ts | 5 days | High |
| Split ApprovalsService | approvals.service.ts | 5 days | High |
| Split LeavesService | leaves.service.ts | 3 days | High |

### 4.2 Short-term (Sprint 1-2)

| Action | Target | Effort | Impact |
|--------|--------|--------|--------|
| Extract AttendanceCalculator | daily-attendance.service.ts | 3 days | High |
| Extract PayrollCalculationEngine | payroll.service.ts | 5 days | High |
| Split EmployeePanel.tsx | EmployeePanel.tsx | 3 days | High |
| Split Employees.tsx | Employees.tsx | 2 days | High |

### 4.3 Medium-term (Sprint 2-3)

| Action | Target | Effort | Impact |
|--------|--------|--------|--------|
| Extract Repository Layer | All services | 5 days | Medium |
| Extract BaseService | 15+ services | 3 days | Medium |
| Split Dashboard.tsx | Dashboard.tsx | 2 days | Medium |
| Flatten nesting in complex functions | Multiple | 5 days | Medium |

---

## 6. Complexity Budget

### 6.1 Recommended Limits

| Metric | Current | Target | Action if Exceeded |
|--------|---------|--------|-------------------|
| Max file size | 2027 | 500 lines | Split file |
| Max function complexity | 45 | 15 | Refactor function |
| Max function length | 200 | 50 lines | Split function |
| Max nesting depth | 6 | 3 | Flatten |
| Max cognitive complexity | 45 | 15 | Refactor |
| Max service size | 2027 | 500 lines | Split service |
| Avg service size | 280 | 200 lines | Refactor |

### 6.2 Complexity Gates (CI)

```yaml
# Recommended ESLint rules for complexity
rules:
  complexity: ["error", 15]
  max-lines-per-function: ["error", 50]
  max-depth: ["error", 3]
  max-lines: ["error", 500]
  max-classes-per-file: ["error", 1]
  max-params: ["error", 4]
```

---

## 7. Summary

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Max File Size | 2027 | 500 | 🔴 |
| Max Function Complexity | 45 | 15 | 🔴 |
| Max Nesting Depth | 6 | 3 | 🔴 |
| Avg Service Size | 280 | 200 | 🟡 |
| Code Duplication | ~1200 lines | < 500 | 🔴 |
| Functions > 20 complexity | 15 | 0 | 🔴 |
| Files > 500 lines | 15 | 0 | 🔴 |

**Overall Complexity Score: 45/100**

---

**Document Version:** 1.0  
**Last Updated:** 2026-11-18  
**Status:** Complete