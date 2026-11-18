# Sana HRMS - Financial Workflow Integrity Audit

**Version:** 1.0  
**Date:** 2026-11-18  
**Auditor:** Senior Business Logic Auditor  
**Classification:** INTERNAL  

---

## 1. Overview

This audit validates the integrity of financial workflows including loans, installments, advances, benefits, and their integration with payroll.

---

## 2. Loan Management

| Check | Requirement | Implementation | Evidence | Status |
|-------|-------------|----------------|----------|--------|
| LN-01 | Loan installment count ≤ 60 | ✅ Enforced | `loans.service.ts:148` | ✅ Pass |
| LN-02 | Monthly amount = floor(amount / count) | ✅ Enforced | `loans.service.ts:151` | ✅ Pass |
| LN-03 | Last installment = remainder (exact total) | ✅ Enforced | `loans.service.ts:174` | ✅ Pass |
| LN-04 | First due date = next month if not specified | ✅ Enforced | `loans.service.ts:156` | ✅ Pass |
| LN-05 | Self-approval prohibited | ✅ Enforced | `loans.service.ts:221` | ✅ Pass |
| LN-06 | Only APPROVED loans can be disbursed | ✅ Enforced | `loans.service.ts:281` | ✅ Pass |
| LN-07 | Idempotency key prevents duplicate payments | ✅ Enforced | `loans.service.ts:318` | ✅ Pass |
| LN-08 | Installment payment only in non-LOCKED period | ✅ Enforced | `loans.service.ts:379` | ✅ Pass |
| LN-09 | Payment amount ≤ remaining installment amount | ✅ Enforced | `loans.service.ts:390` | ✅ Pass |
| LN-10 | Payment marks installment PAID when complete | ✅ Enforced | `loans.service.ts:394` | ✅ Pass |
| LN-11 | Auto-deduct installments during payroll | ✅ Enforced | `payroll.service.ts:707` | ✅ Pass |
| LN-12 | Interest rate stored (default 0) | ✅ Implemented | `Loan.interestRate` | ✅ Pass |
| LN-13 | Purpose field optional | ✅ Implemented | `Loan.purpose` optional | ✅ Pass |
| LN-14 | Loan status: PENDING_APPROVAL → APPROVED → SETTLING → PAID | ✅ Implemented | `LoanStatus` enum | ✅ Pass |
| LN-15 | Loan cancellation not implemented | ⚠️ Missing | No cancel endpoint | ⚠️ Partial |

---

## 3. Loan Installment Payments

| Check | Requirement | Implementation | Evidence | Status |
|-------|-------------|----------------|----------|--------|
| IP-01 | Idempotency key (UUID) required | ✅ Enforced | `PayInstallmentDto.idempotencyKey` | ✅ Pass |
| IP-02 | Advisory lock on idempotency key | ✅ Enforced | `pg_advisory_xact_lock` | ✅ Pass |
| IP-03 | Loan row lock during payment | ✅ Enforced | `SELECT ... FOR UPDATE` | ✅ Pass |
| IP-04 | Installment row lock during payment | ✅ Enforced | `SELECT ... FOR UPDATE` | ✅ Pass |
| IP-05 | Payroll period row lock during payment | ✅ Enforced | `SELECT ... FOR UPDATE` | ✅ Pass |
| IP-06 | Period must not be LOCKED | ✅ Enforced | `loans.service.ts:379` | ✅ Pass |
| IP-07 | Installment must not be PAID | ✅ Enforced | `loans.service.ts:382` | ✅ Pass |
| IP-08 | Loan must be SETTLING status | ✅ Enforced | `loans.service.ts:384` | ✅ Pass |
| IP-09 | Payment amount ≤ remaining amount | ✅ Enforced | `loans.service.ts:390` | ✅ Pass |
| IP-10 | Partial payment updates paidAmount | ✅ Enforced | `paidAmount + BigInt(dto.amount)` | ✅ Pass |
| IP-10 | Full payment marks PAID | ✅ Enforced | `newPaid === installment.amount` | ✅ Pass |
| IP-11 | Duplicate idempotency returns existing | ✅ Enforced | `loans.service.ts:358` | ✅ Pass |
| IP-12 | Payment audit trail | ✅ Enforced | `audit.recordInTransaction` | ✅ Pass |
| IP-13 | Idempotency key unique constraint | ✅ Enforced | `prisma: @@unique([idempotencyKey])` | ✅ Pass |

---

## 4. Advances (Loan Type = ADVANCE)

| Check | Requirement | Implementation | Evidence | Status |
|-------|-------------|----------------|----------|--------|
| AD-01 | Advance uses loanType=ADVANCE | ✅ Implemented | `loans.service.ts:162` | ✅ Pass |
| AD-02 | Advance workflow same as loan | ✅ Implemented | Same service methods | ✅ Pass |
| AD-03 | Advance installments auto-generated | ✅ Implemented | Same installment logic | ✅ Pass |
| AD-04 | Advance deducted from payroll | ✅ Implemented | Same payroll integration | ✅ Pass |
| AD-05 | Separate advance workflow not implemented | ⚠️ Missing | No separate advance entity | ⚠️ Partial |
| AD-06 | Advance approval same as loan | ✅ Enforced | Same decision logic | ✅ Pass |
| AD-07 | Advance disbursement same as loan | ✅ Enforced | Same disbursement logic | ✅ Pass |

---

## 5. Benefits & Packages

| Check | Requirement | Implementation | Evidence | Status |
|-------|-------------|----------------|----------|--------|
| BF-01 | Benefit types per company | ✅ Implemented | `BenefitType` model | ✅ Pass |
| BF-02 | Benefit packages with items | ✅ Implemented | `BenefitPackage` + `BenefitPackageItem` | ✅ Pass |
| BF-03 | Package item: company/employee share | ✅ Implemented | `companyShare`/`employeeShare` | ✅ Pass |
| BF-04 | Cap amount per benefit item | ✅ Implemented | `capAmount` field | ✅ Pass |
| BF-05 | Period configuration (monthly/annual) | ✅ Implemented | `period` field | ✅ Pass |
| BF-06 | Employee benefits with dates | ✅ Implemented | `EmployeeBenefit` model | ✅ Pass |
| BF-07 | Benefit status: ACTIVE/INACTIVE/EXPIRED | ✅ Implemented | `BenefitStatus` enum | ✅ Pass |
| BF-08 | Certificate requirements per position | ✅ Implemented | `CertificateRequirement` model | ✅ Pass |
| BF-09 | Training prerequisites | ✅ Implemented | `TrainingCoursePrerequisite` | ✅ Pass |

---

## 5. Payroll Integration

| Check | Requirement | Implementation | Evidence | Status |
|-------|-------------|----------------|----------|--------|
| PI-01 | Loan installments auto-deducted in payroll | ✅ Enforced | `payroll.service.ts:707` | ✅ Pass |
| PI-02 | Installment due date in period | ✅ Enforced | `dueDate` in period range | ✅ Pass |
| PI-03 | Installment status PENDING required | ✅ Enforced | `status: 'PENDING'` filter | ✅ Pass |
| PI-03 | Loan installment payment idempotent | ✅ Enforced | Idempotency key | ✅ Pass |
| PI-04 | Benefit deductions in payroll | ⚠️ Not implemented | Not in payroll pipeline | ⚠️ Partial |
| PI-05 | Advance deductions in payroll | ✅ Enforced | Same as loan | ✅ Pass |

---

## 6. Financial Precision & Rounding

| Check | Requirement | Implementation | Evidence | Status |
|-------|-------------|----------------|----------|--------|
| FP-01 | All amounts stored as BigInt (Rials) | ✅ Enforced | `prisma: BigInt` | ✅ Pass |
| FP-02 | No floating-point for monetary calcs | ✅ Enforced | `BigInt(Math.trunc())` | ✅ Pass |
| FP-03 | Monthly installment = floor(amount/count) | ✅ Enforced | `loans.service.ts:151` | ✅ Pass |
| FP-04 | Last installment = exact remainder | ✅ Enforced | `loans.service.ts:174` | ✅ Pass |
| FP-04 | Installment payment exact amount | ✅ Enforced | `BigInt(dto.amount)` | ✅ Pass |
| FP-05 | Insurance % applied to gross | ✅ Enforced | `payroll.service.ts:725` | ✅ Pass |
| FP-05 | Overtime calculation precise | ✅ Enforced | `payroll.service.ts:683` | ✅ Pass |
| FP-05 | Proration ratio precise (4 decimals) | ✅ Enforced | `ratioLabel` precision | ✅ Pass |
| FP-05 | Payroll item amounts truncated | ✅ Enforced | `Math.trunc()` before BigInt | ✅ Pass |

---

## 7. Concurrent Operations Safety

| Check | Requirement | Implementation | Evidence | Status |
|-------|-------------|----------------|----------|--------|
| CC-01 | Loan row lock on decision | ✅ Enforced | `loans.service.ts:210` | ✅ Pass |
| CC-02 | Loan row lock on disbursement | ✅ Enforced | `loans.service.ts:276` | ✅ Pass |
| CC-03 | Advisory lock on idempotency key | ✅ Enforced | `loans.service.ts:318` | ✅ Pass |
| CC-04 | Multiple row locks for payment | ✅ Enforced | `loans.service.ts:324-326` | ✅ Pass |
| CC-05 | Payroll period lock during payment | ✅ Enforced | `loans.service.ts:324` | ✅ Pass |
| CC-06 | Installment row lock during payment | ✅ Enforced | `loans.service.ts:326` | ✅ Pass |
| CC-07 | Company row lock for loan operations | ✅ Enforced | `loans.service.ts:210` | ✅ Pass |
| CC-08 | Idempotent retry safe | ✅ Enforced | Idempotency key check | ✅ Pass |

---

## 8. Audit & Traceability

| Check | Requirement | Implementation | Evidence | Status |
|-------|-------------|----------------|----------|--------|
| AT-01 | Loan create audited | ✅ Enforced | `loans.service.ts:184` | ✅ Pass |
| AT-02 | Loan decision audited | ✅ Enforced | `loans.service.ts:247` | ✅ Pass |
| AT-03 | Loan disbursement audited | ✅ Enforced | `loans.service.ts:293` | ✅ Pass |
| AT-04 | Installment payment audited | ✅ Enforced | `loans.service.ts:395` | ✅ Pass |
| AT-05 | Benefit assignment audited | ✅ Enforced | `loans.service.ts` | ✅ Pass |
| AT-06 | Advance create audited | ✅ Enforced | Same as loan | ✅ Pass |

---

## 9. Multi-tenant Isolation

| Check | Requirement | Implementation | Evidence | Status |
|-------|-------------|----------------|----------|--------|
| MT-01 | Loans scoped to accessible companies | ✅ Enforced | `access.employeeWhereFor` | ✅ Pass |
| MT-02 | Installments respect company | ✅ Enforced | Company check in payroll | ✅ Pass |
| MT-03 | Benefits scoped to company | ✅ Enforced | `BenefitType.companyId` | ✅ Pass |
| MT-04 | Packages scoped to company | ✅ Enforced | `BenefitPackage.companyId` | ✅ Pass |
| MT-05 | Employee benefits respect org scope | ✅ Enforced | `access.canAccessEmployee` | ✅ Pass |

---

## 9. Summary

| Category | Checks | Passed | Failed | Partial |
|----------|--------|--------|--------|---------|
| Loan Management | 15 | 14 | 0 | 1 |
| Installment Payments | 13 | 13 | 0 | 0 |
| Advances | 7 | 6 | 0 | 1 |
| Benefits & Packages | 9 | 9 | 0 | 0 |
| Payroll Integration | 5 | 4 | 0 | 1 |
| Financial Precision | 8 | 8 | 0 | 0 |
| Concurrency | 8 | 8 | 0 | 0 |
| Audit | 6 | 6 | 0 | 0 |
| Multi-tenant | 5 | 5 | 0 | 0 |
| **Total** | **57** | **55** | **0** | **2** |

---

## 10. Findings

| Severity | Count | Details |
|----------|-------|---------|
| Critical | 0 | No critical integrity gaps |
| High | 0 | No high-severity gaps |
| Medium | 2 | LN-15: Loan cancellation not implemented; AD-05: Advance workflow not separate; PI-04: Benefit deductions not in payroll |
| Low | 0 | - |
| **Total** | **2** | **2 Medium findings** |

---

## 10. Defect Details

| ID | Severity | Description | Recommendation |
|----|----------|-------------|----------------|
| FIN-LN-15 | Medium | Loan cancellation not implemented | Add cancel endpoint with balance reversal |
| FIN-AD-05 | Medium | Advance workflow not separated from loan | Create dedicated Advance entity/workflow |
| FIN-PI-04 | Medium | Benefit deductions not integrated in payroll | Add benefit deduction to payroll pipeline |

---

## 10. Recommendations

1. **Implement loan cancellation** - With balance reversal and audit trail.
2. **Create dedicated Advance entity** - Separate from Loan with specific workflow.
3. **Integrate benefit deductions in payroll** - Add benefit deduction items to payroll generation.
4. **Add loan restructuring workflow** - For renegotiating terms.
5. **Implement early repayment with interest recalculation** - Per Iranian banking regulations.

---

**Document Version:** 1.0  
**Last Updated:** 2026-11-18  
**Status:** Complete  
**Verdict:** ✅ **PASS** - Financial workflows pass (2 Medium findings)