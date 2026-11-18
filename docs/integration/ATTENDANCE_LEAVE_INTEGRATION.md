# Sana HRMS - Attendance, Leave, and Financial Integrations Validation

**Version:** 1.0  
**Date:** 2026-11-18  
**Auditor:** Senior Integration Engineer  
**Classification:** INTERNAL  

---

## 1. Overview

This document validates the integration between attendance, leave management, and financial workflows (payroll, loans, benefits) in Sana HRMS.

---

## 2. Attendance ↔ Leave Integration

### 2.1 Leave Request → Attendance Status

| Leave Status | Attendance Status | Integration Point | Verified |
|-------------|-------------------|-------------------|----------|
| SUBMITTED | PENDING | LeaveTransaction.RESERVE created | ✅ Verified |
| APPROVED | LEAVE | LeaveTransaction RESERVE→CONSUME | ✅ Verified |
| REJECTED | PRESENT (or original) | Reserve deleted | ✅ Verified |
| CANCELLED | PRESENT (or original) | Reserve deleted | ✅ Verified |
| NEEDS_REVISION | PENDING | Reserve kept | ✅ Verified |

### 2.2 Leave Balance ↔ Attendance

| Check | Requirement | Implementation | Evidence | Status |
|-------|-------------|----------------|----------|--------|
| LB-01 | Leave balance checked before submit | `leaves.service.ts:303` | ✅ |
| LB-02 | Reserve created on submit | `leaves.service.ts:331` | ✅ |
| LB-03 | Reserve → Consume on approve | `leaves.service.ts:431` | ✅ |
| LB-04 | Reserve deleted on reject | `leaves.service.ts:447` | ✅ |
| LB-05 | Reserve deleted on cancel | `leaves.service.ts:523` | ✅ |
| LB-05 | Balance = Grant - Consume | `leaves.service.ts:556` | ✅ |
| LB-06 | Annual quota enforced | `leaves.service.ts:303` | ✅ |

### 2.3 Attendance Calculation with Leave

| Leave Type | Attendance Status | Minutes Covered | Verified |
|------------|-------------------|-----------------|----------|
| Paid leave (APPROVED) | LEAVE | Full shift | ✅ |
| Unpaid leave (APPROVED) | LEAVE | Full shift | ✅ |
| Rejected leave | PRESENT/ABSENT | Original | ✅ |
| Cancelled leave | PRESENT/ABSENT | Original | ✅ |
| Partial day leave | PARTIAL_LEAVE | Leave minutes | ✅ |

### 2.4 Integration Test Results

| Test Case | Expected | Result | Status |
|-----------|----------|--------|--------|
| Approved leave covers shift | Attendance status = LEAVE | ✅ Pass |
| Rejected leave doesn't affect attendance | Status = PRESENT/ABSENT | ✅ Pass |
| Leave balance decreases on approve | Balance = total - used | ✅ Pass |
| Leave balance restored on reject | Balance restored | ✅ Pass |
| Leave balance restored on cancel | Balance restored | ✅ Pass |
| Overlapping leave prevented | 400 Bad Request | ✅ Pass |
| Leave during holiday | Holiday status takes precedence | ✅ Pass |
| Leave during weekend | Weekend status takes precedence | ✅ Pass |

---

## 2. Attendance ↔ Payroll Integration

### 2.1 Overtime Integration

| Data Flow | Source | Destination | Verified |
|-----------|--------|-------------|----------|
| AttendanceRecord.overtimeMinutes | AttendanceRecord | Payroll OVERTIME item | ✅ |
| GroupBy employeeId | AttendanceService | Payroll generation | ✅ |
| Overtime minutes × hourlyRate × multiplier | PayrollService | Payroll OVERTIME amount | ✅ |

### 2.2 Attendance Period Boundaries

| Boundary | Implementation | Verified |
|----------|----------------|----------|
| Period start | `periodRange.startDate` (00:00 UTC) | ✅ |
| Period end | `periodRange.endExclusive` (24:00 UTC) | ✅ |
| Shift crossing midnight | `shiftCalendarDay` utility | ✅ |
| AttendanceRecord.workDate | Filter `gte: startDate, lt: endExclusive` | ✅ |

### 2.2 Attendance Corrections → Payroll

| Scenario | Behavior | Verified |
|----------|----------|----------|
| Correction approved before payroll | Included in generation | ✅ |
| Correction approved after payroll | Requires amendment | ✅ |
| Correction rejected | Not included | ✅ |
| Duplicate check-in prevented | 400 Bad Request | ✅ |

---

## 3. Leave ↔ Payroll Integration

### 3.1 Paid Leave → Payroll

| Leave Type | Paid | Payroll Item | Calculation | Verified |
|------------|------|--------------|-------------|----------|
| Annual leave | Yes | LEAVE_PAY | minutes × hourlyRate | ✅ |
| Sick leave | Yes | LEAVE_PAY | minutes × hourlyRate | ✅ |
| Maternity leave | Yes | LEAVE_PAY | minutes × hourlyRate | ✅ |
| Unpaid leave | No | None | Excluded | ✅ |

### 3.2 Leave Balance Consistency

| Check | Implementation | Verified |
|-------|----------------|----------|
| Balance = Grant - Consume | `leaves.service.ts:556` | ✅ |
| Reserve on submit | `leaves.service.ts:331` | ✅ |
| Reserve → Consume on approve | `leaves.service.ts:431` | ✅ |
| Reserve deleted on reject | `leaves.service.ts:447` | ✅ |
| Reserve deleted on cancel | `leaves.service.ts:523` | ✅ |
| Balance query uses Jalali year | `leaves.service.ts:545` | ✅ |

---

## 4. Financial Integrations

### 4.1 Loan → Payroll Integration

| Step | Implementation | Verified |
|------|----------------|----------|
| Loan installment due in period | `payroll.service.ts:707` | ✅ |
| Installment status = PENDING | Filter in payroll generation | ✅ |
| Installment amount deducted | `payroll.service.ts:707` | ✅ |
| Installment payment marks PAID | `loans.service.ts:394` | ✅ |
| Partial payment tracking | `paidAmount` field | ✅ |
| Idempotent payment | Idempotency key + advisory lock | ✅ |
| Payment only in non-LOCKED period | `loans.service.ts:379` | ✅ |

### 4.2 Loan ↔ Payroll Concurrency

| Scenario | Protection | Verified |
|----------|------------|----------|
| Concurrent payroll gen + loan payment | Payroll period row lock + installment row lock | ✅ |
| Duplicate loan payment | Idempotency key + advisory lock | ✅ |
| Loan payment during payroll gen | Period row lock prevents | ✅ |

### 4.3 Advance (Loan Type = ADVANCE)

| Feature | Implementation | Status |
|---------|----------------|--------|
| Advance uses loanType=ADVANCE | `loans.service.ts:162` | ✅ |
| Advance installments auto-generated | Same logic | ✅ |
| Advance deducted from payroll | Same payroll integration | ✅ |
| Separate advance workflow | Not implemented | ⚠️ Partial |

---

## 4. Benefits & Payroll Integration

| Feature | Implementation | Status |
|---------|----------------|--------|
| Benefit types per company | `BenefitType` model | ✅ |
| Benefit packages with items | `BenefitPackage` + items | ✅ |
| Company/employee share | `companyShare`/`employeeShare` | ✅ |
| Cap amount per item | `capAmount` | ✅ |
| Employee benefits with dates | `EmployeeBenefit` model | ✅ |
| Benefit deductions in payroll | Not implemented | ⚠️ Partial |

---

## 4. Payroll Settings Integration

| Setting | Source | Used By | Verified |
|---------|--------|---------|----------|
| Working days per month | `app.payroll.workingDaysPerMonth` (30) | Proration ratio | ✅ |
| Default work hours/day | `app.payroll.defaultWorkHoursPerDay` (8) | Hourly rate calc | ✅ |
| Overtime multiplier | `PayrollSettings.overtimeMultiplier` | Overtime calc | ✅ |
| Insurance employee % | `PayrollSettings.insuranceEmployeePercent` | Insurance calc | ✅ |
| Insurance employer % | `PayrollSettings.insuranceEmployerPercent` | Company cost | ✅ |

---

## 5. Integration Test Results

| Test Case | Expected | Result | Status |
|-----------|----------|--------|--------|
| Attendance overtime → Payroll | OT amount correct | ✅ Pass |
| Approved leave → Payroll | Leave pay correct | ✅ Pass |
| Loan installment → Payroll | Deduction correct | ✅ Pass |
| Contract allowances → Payroll | Amounts correct | ✅ Pass |
| Proration hire/term mid-period | Ratio correct | ✅ Pass |
| Leave balance after approve | Balance = grant - consume | ✅ Pass |
| Leave balance after reject | Balance restored | ✅ Pass |
| Loan payment during payroll | Idempotent, correct | ✅ Pass |
| Leave during payroll period | Leave pay included | ✅ Pass |
| Attendance correction before payroll | Included in generation | ✅ Pass |
| Attendance correction after payroll | Requires amendment | ✅ Pass |
| Loan payment in LOCKED period | 400 Bad Request | ✅ Pass |
| Benefit deduction in payroll | Not yet implemented | ⚠️ Partial |

---

## 8. Findings

| Severity | Count | Details |
|----------|-------|---------|
| Critical | 0 | No critical integration gaps |
| High | 0 | No high-severity gaps |
| Medium | 2 | FIN-AD-05: Advance workflow not separate; FIN-PI-04: Benefits not in payroll |
| Low | 0 | - |
| **Total** | **2** | **2 Medium findings** |

---

## 8. Defect Details

| ID | Severity | Description | Recommendation |
|----|----------|-------------|----------------|
| FIN-AD-05 | Medium | Advance workflow mixed with loan | Create separate Advance entity/workflow |
| FIN-PI-04 | Medium | Benefit deductions not in payroll | Add benefit deduction to payroll pipeline |

---

## 9. Recommendations

1. **Separate Advance workflow** - Create dedicated Advance entity with specific approval flow
2. **Integrate benefit deductions** - Add benefit deduction items to payroll generation pipeline
3. **Add loan restructuring** - Support renegotiating loan terms
4. **Implement early repayment** - With interest recalculation per Iranian banking law

---

**Document Version:** 1.0  
**Last Updated:** 2026-11-18  
**Status:** Complete  
**Verdict:** ✅ **PASS** - Attendance, leave, and financial integrations verified (2 Medium findings)