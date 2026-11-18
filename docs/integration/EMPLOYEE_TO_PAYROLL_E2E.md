# Sana HRMS - Employee-to-Payroll End-to-End Workflow Validation

**Version:** 1.0  
**Date:** 2026-11-18  
**Auditor:** Senior Integration Engineer  
**Classification:** INTERNAL  

---

## 1. Overview

This document validates the complete employee-to-payroll end-to-end workflow, from employee creation through payroll generation, payslip generation, and reporting.

---

## 2. Complete Workflow Steps

### 2.1 Step-by-Step Workflow

| Step | Action | Module | API Endpoint | Database Operations | Status |
|------|--------|--------|--------------|---------------------|--------|
| 1 | Create Employee | Employees | POST `/api/v1/employees` | Employee, User, UserRole | ✅ Verified |
| 2 | Assign Department/Position | OrgService | PUT `/api/v1/employees/:id` | Employee.departmentId, positionId | ✅ Verified |
| 3 | Create Contract | ContractsService | POST `/api/v1/contracts` | Contract, ContractVersion | ✅ Verified |
| 4 | Set Salary | ContractsService | POST `/api/v1/contracts` | ContractVersion.baseSalary, allowances | ✅ Verified |
| 5 | Assign Work Schedule | ShiftsService | POST `/api/v1/shifts/assignments` | ShiftAssignment | ✅ Verified |
| 6 | Record Attendance | AttendanceService | POST `/api/v1/attendance` | AttendanceRecord, AttendanceEvent | ✅ Verified |
| 7 | Add Overtime | AttendanceService | POST `/api/v1/attendance` | AttendanceRecord.overtimeMinutes | ✅ Verified |
| 8 | Create Leave Request | LeavesService | POST `/api/v1/leaves` | LeaveRequest, LeaveTransaction (RESERVE) | ✅ Verified |
| 9 | Approve Leave | ApprovalsService | POST `/api/v1/approvals/instances/:id/decide` | LeaveTransaction RESERVE→CONSUME | ✅ Verified |
| 10 | Create Pay Components | PayrollService | POST `/api/v1/payroll/components` | PayComponent | ✅ Verified |
| 11 | Create Payroll Period | PayrollService | POST `/api/v1/payroll/periods` | PayrollPeriod (DRAFT) | ✅ Verified |
| 12 | Generate Payroll | PayrollService | POST `/api/v1/payroll/generate/:periodId` | PayrollItem, Payslip, PayrollPeriod totals | ✅ Verified |
| 13 | Review Payroll | PayrollService | POST `/api/v1/payroll/periods/:id/review` | PayrollPeriod status → REVIEWED | ✅ Verified |
| 14 | Lock Payroll | PayrollService | POST `/api/v1/payroll/periods/:id/lock` | PayrollPeriod status → LOCKED | ✅ Verified |
| 15 | Publish Payroll | PayrollService | POST `/api/v1/payroll/periods/:id/publish` | Payslip status → PUBLISHED, Notification | ✅ Verified |
| 16 | Generate Payslip | PayrollService | GET `/api/v1/payroll/payslips/:periodId/mine` | Payslip generation | ✅ Verified |
| 17 | Verify Reports | ReportsService | GET `/api/v1/reports/payroll` | Aggregated data | ✅ Verified |
| 18 | Audit History | AuditService | GET `/api/v1/audit` | AuditLog entries | ✅ Verified |

---

## 3. Data Flow Validation

### 3.1 Employee Creation → Contract → Payroll

| Data Element | Source | Transformation | Destination | Verified |
|--------------|--------|----------------|-------------|----------|
| Employee.code | Employee creation | Direct | Employee.code | ✅ |
| Employee.companyId | Employee creation | Direct | Contract.companyId | ✅ |
| Employee.hireDate | Employee creation | Direct | Payroll proration | ✅ |
| Employee.monthlyBaseSalary | Employee creation | Fallback | Payroll baseSalary | ✅ |
| ContractVersion.baseSalary | Contract version | Direct | Payroll baseSalary | ✅ |
| ContractVersion.allowances | Contract version | Direct | Payroll allowances | ✅ |
| ContractVersion.workHoursPerMonth | Contract version | Direct | Payroll hourly rate | ✅ |

### 3.2 Attendance → Payroll

| Data Element | Source | Transformation | Destination | Verified |
|--------------|--------|----------------|-------------|----------|
| AttendanceRecord.overtimeMinutes | AttendanceService | SUM per employee | Payroll OVERTIME item | ✅ |
| AttendanceRecord.workDate | AttendanceRecord | Date range filter | Payroll period filter | ✅ |

### 3.3 Leave → Payroll

| Data Element | Source | Transformation | Destination | Verified |
|--------------|--------|----------------|-------------|----------|
| LeaveRequest.durationMinutes | LeaveRequest | SUM per employee (paid) | Payroll LEAVE_PAY item | ✅ |
| LeaveRequest.isPaid | LeaveType | Filter | Payroll inclusion | ✅ |
| LeaveRequest.status | LeaveRequest | APPROVED only | Payroll inclusion | ✅ |

### 3.4 Loan → Payroll

| Data Element | Source | Transformation | Destination | Verified |
|--------------|--------|----------------|-------------|----------|
| LoanInstallment.dueDate | LoanInstallment | Date range filter | Payroll period filter | ✅ |
| LoanInstallment.amount | LoanInstallment | SUM per employee | Payroll LOAN_INSTALLMENT item | ✅ |
| LoanInstallment.status | LoanInstallment | PENDING only | Payroll inclusion | ✅ |

### 3.3 Contract → Payroll

| Data Element | Source | Transformation | Destination | Verified |
|--------------|--------|----------------|-------------|----------|
| ContractVersion.baseSalary | ContractVersion | × proration ratio | BASE_SALARY | ✅ |
| ContractVersion.housingAllowance | ContractVersion | Direct | HOUSING_ALLOWANCE | ✅ |
| ContractVersion.foodAllowance | ContractVersion | Direct | FOOD_ALLOWANCE | ✅ |
| ContractVersion.childAllowance | ContractVersion | Direct | CHILD_ALLOWANCE | ✅ |
| ContractVersion.seniorityPay | ContractVersion | Direct | SENIORITY_PAY | ✅ |
| ContractVersion.workHoursPerMonth | ContractVersion | ÷ baseSalary | Hourly rate | ✅ |

---

## 4. Payroll Generation Pipeline Validation

### 4.1 Generation Steps

| Step | Function | Key Validation | Status |
|------|----------|----------------|--------|
| 1 | Lock period row | `SELECT ... FOR UPDATE` | ✅ |
| 2 | Lock company row | `SELECT ... FOR UPDATE` | ✅ |
| 3 | Check period status = DRAFT | `period.status === DRAFT` | ✅ |
| 4 | Load canonical components | `ensureCanonicalComponents()` | ✅ |
| 5 | Load active employees | Filter ACTIVE + TERMINATED in period | ✅ |
| 6 | Load active contracts | Latest approved version | ✅ |
| 7 | Load overtime minutes | Group by employeeId | ✅ |
| 8 | Load approved leaves | APPROVED, paid, date overlap | ✅ |
| 9 | Load loan installments | PENDING, dueDate in period | ✅ |
| 10 | Check amended employees | Skip if amended | ✅ |
| 11 | Calculate per employee | Loop with transactions | ✅ |
| 12 | Calculate proration ratio | hireDate/terminationDate | ✅ |
| 13 | Calculate base salary | contract.baseSalary × ratio | ✅ |
| 14 | Calculate allowances | From contract version | ✅ |
| 15 | Calculate overtime | minutes × hourlyRate × multiplier | ✅ |
| 16 | Calculate leave pay | minutes × hourlyRate | ✅ |
| 17 | Calculate loan deduction | Sum installments | ✅ |
| 18 | Calculate insurance | Gross × % | ✅ |
| 18 | Upsert payroll items | `ON CONFLICT DO UPDATE` | ✅ |
| 19 | Clean orphaned items | DELETE orphaned canonical | ✅ |
| 20 | Recalculate payslips | Aggregate items | ✅ |
| 20 | Update period totals | gross/deductions/net | ✅ |
| 21 | Set generatedAt timestamp | NOW() | ✅ |
| 22 | Financial audit | recordFinancialAudit() | ✅ |

---

## 5. Payroll Amendment Workflow

### 5.1 Amendment Flow

| Step | Action | Validation | Status |
|------|--------|------------|--------|
| 1 | Create amendment | POST `/api/v1/payroll/amendments` | ✅ |
| 2 | Add amendment items | POST `/api/v1/payroll/amendments/:id/items` | ✅ |
| 3 | Submit for approval | PATCH status → SUBMITTED | ✅ |
| 4 | Approve amendment | POST `/api/v1/payroll/amendments/:id/decide` | ✅ |
| 5 | Regenerate payroll | Exclude amended employees | ✅ |
| 6 | Amendment items preserved | Upsert preserves amendment items | ✅ |

---

## 6. Payroll Period Workflow

### 6.1 Status Transitions

| From | To | Action | Validation | Status |
|------|-----|--------|------------|--------|
| DRAFT | REVIEWED | POST /review | Only DRAFT | ✅ |
| REVIEWED | LOCKED | POST /lock | Only REVIEWED | ✅ |
| LOCKED | PUBLISHED | POST /publish | Only LOCKED | ✅ |
| DRAFT | REGENERATE | POST /generate | Only DRAFT | ✅ |
| LOCKED | AMEND | Create amendment | Only LOCKED | ✅ |

### 6.2 Concurrent Generation Test

| Scenario | Expected | Result |
|----------|----------|--------|
| Two concurrent generate calls | Second waits, no duplicates | ✅ Verified (payroll.integration.spec.ts) |
| Generate during review | Rejected | ✅ Verified |
| Generate after lock | Rejected | ✅ Verified |
| Regenerate after lock | Rejected (needs amendment) | ✅ Verified |

---

## 7. Payslip Generation & Verification

### 7.1 Payslip Structure

| Field | Source | Calculation | Verified |
|-------|--------|-------------|----------|
| grossAmount | Sum of EARNING items | SUM(amount) | ✅ |
| deductionAmount | Sum of DEDUCTION items | SUM(amount) | ✅ |
| netAmount | gross - deductions | gross - deductions | ✅ |
| companyCostAmount | Sum of COMPANY_COST | SUM(amount) | ✅ |
| status | PayrollPeriod status | DRAFT/PUBLISHED | ✅ |
| publishedAt | Publish action | Timestamp | ✅ |

### 7.2 Totals Reconciliation

| Total | Formula | Verified |
|-------|---------|----------|
| totalGross | SUM(payslip.grossAmount) | ✅ |
| totalDeductions | SUM(payslip.deductionAmount) | ✅ |
| totalNet | SUM(payslip.netAmount) | ✅ |
| Period totalGross = Σ payslip.grossAmount | Cross-check | ✅ |
| Period totalDeductions = Σ payslip.deductionAmount | Cross-check | ✅ |
| Period totalNet = Σ payslip.netAmount | Cross-check | ✅ |

---

## 6. Frontend Integration

### 6.1 Payroll Page Workflows

| Page | Workflow | API Calls | Status |
|------|----------|-----------|--------|
| Payroll.tsx | List periods | GET `/api/v1/payroll/periods` | ✅ |
| Payroll.tsx | Create period | POST `/api/v1/payroll/periods` | ✅ |
| Payroll.tsx | Generate | POST `/api/v1/payroll/generate/:id` | ✅ |
| Payroll.tsx | Review | POST `/api/v1/payroll/periods/:id/review` | ✅ |
| Payroll.tsx | Lock | POST `/api/v1/payroll/periods/:id/lock` | ✅ |
| Payroll.tsx | Publish | POST `/api/v1/payroll/periods/:id/publish` | ✅ |
| Payroll.tsx | Amendments | GET/POST `/api/v1/payroll/amendments` | ✅ |
| Payroll.tsx | Payslips | GET `/api/v1/payroll/payslips/:periodId` | ✅ |
| EmployeePanel.tsx | My payslips | GET `/api/v1/payroll/payslips/:periodId/mine` | ✅ |

---

## 7. Reports & Exports

| Report | API Endpoint | Data Source | Export Format | Status |
|--------|--------------|-------------|---------------|--------|
| Payroll Summary | GET `/api/v1/reports/payroll/summary` | PayrollPeriod totals | CSV/Excel | ✅ |
| Payslip Export | GET `/api/v1/payroll/payslips/:periodId/export` | Payslip items | CSV/Excel | ✅ |
| Payroll Register | GET `/api/v1/reports/payroll/register` | PayrollItem details | CSV/Excel | ✅ |
| Employee Payroll History | GET `/api/v1/payroll/history/:employeeId` | Payslip history | CSV/Excel | ✅ |
| Payroll Comparison | GET `/api/v1/payroll/compare` | Period comparison | CSV/Excel | ✅ |

---

## 8. Audit Trail Verification

| Action | Audit Action | Entity | Fields Recorded |
|--------|--------------|--------|-----------------|
| Create period | CREATE | PayrollPeriod | companyId, year, month, status |
| Generate payroll | UPDATE | PayrollPeriod | generatedAt, totals, items |
| Review period | APPROVE | PayrollPeriod | status: DRAFT→REVIEWED |
| Lock period | APPROVE | PayrollPeriod | status: REVIEWED→LOCKED, lockedAt, lockedById |
| Publish period | APPROVE | PayrollPeriod | status: LOCKED→PUBLISHED, publishedAt |
| Generate payroll | CREATE | PayrollItem | periodId, employeeId, componentId, amount, quantity |
| Generate payroll | CREATE | Payslip | periodId, employeeId, gross, deductions, net |
| Amendment create | CREATE | PayrollAmendment | periodId, employeeId, reason |
| Amendment approve | APPROVE | PayrollAmendment | status: SUBMITTED→APPROVED |
| Payslip publish | APPROVE | Payslip | status: DRAFT→PUBLISHED, publishedAt |

---

## 8. Integration Test Results

| Test Case | Expected | Result | Status |
|-----------|----------|--------|--------|
| Create employee → contract → payroll | Full flow completes | ✅ Pass |
| Attendance overtime → payroll | Overtime amount correct | ✅ Pass |
| Approved leave → payroll | Leave pay correct | ✅ Pass |
| Loan installment → payroll | Deduction correct | ✅ Pass |
| Contract allowances → payroll | Amounts correct | ✅ Pass |
| Proration hire/term mid-period | Ratio correct | ✅ Pass |
| Amendment skips regenerated | Items preserved | ✅ Pass |
| Concurrent generation | No duplicates | ✅ Pass |
| Concurrent publish | Single publish | ✅ Pass |
| Concurrent review | Single review | ✅ Pass |
| Concurrent lock | Single lock | ✅ Pass |
| Amendment skip regenerate | Items preserved | ✅ Pass |
| Audit trail complete | All actions logged | ✅ Pass |
| Cross-company isolation | 403 on other company | ✅ Pass |
| Report totals match payslips | Totals match | ✅ Pass |

---

## 9. Findings

| Severity | Count | Details |
|----------|-------|---------|
| Critical | 0 | No critical integration gaps |
| High | 0 | No high-severity gaps |
| Medium | 1 | PAY-AT-07: Payslip recalculation not individually audited |
| Low | 0 | - |
| **Total** | **1** | **1 Medium finding** |

---

## 9. Defect Details

| ID | Severity | Description | Recommendation |
|----|----------|-------------|----------------|
| PAY-AT-07 | Medium | Payslip recalculation (bulk) not individually audited | Add audit entries for recalculation per payslip or batch summary |

---

## 10. Recommendations

1. **Add payslip recalculation audit** - Log individual or batch recalculation events
2. **Add payroll calculation formula audit** - Log the exact formula used for each component
3. **Enhance payslip PDF generation** - Add digital signature for legal compliance
4. **Add payroll variance report** - Compare current vs previous period

---

**Document Version:** 1.0  
**Last Updated:** 2026-11-18  
**Status:** Complete  
**Verdict:** ✅ **PASS** - Employee-to-payroll workflow fully integrated and verified