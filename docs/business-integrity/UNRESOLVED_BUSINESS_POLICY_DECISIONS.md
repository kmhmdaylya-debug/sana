# Sana HRMS - Unresolved Business Policy Decisions

**Version:** 1.0  
**Date:** 2026-11-18  
**Auditor:** Senior Business Logic Auditor  
**Classification:** INTERNAL  

---

## 1. Overview

This document catalogs business policy decisions that are either not implemented, partially implemented, or require explicit stakeholder decisions. These are not technical defects but require organizational decisions to finalize implementation.

---

## 2. Policy Gaps Requiring Decisions

### 2.1 Payroll & Compensation

| ID | Policy Gap | Current State | Options | Recommendation |
|----|------------|---------------|---------|----------------|
| POL-PR-01 | **Overtime calculation base** | Uses hourly rate from contract or default | A) Base salary only B) Base + fixed allowances C) Gross earnings | **B** - Aligns with Iranian labor law |
| POL-PR-02 | **Insurance calculation base** | Applied to gross earnings | A) Gross earnings B) Base salary only C) Configurable base | **A** - Current implementation |
| POL-PR-03 | **Proration method for partial months** | Working days ratio | A) Calendar days B) Working days C) Actual days worked | **B** - Current implementation |
| POL-PR-04 | **Payroll period lock finality** | Locked = no changes | A) Allow admin override B) Only amendment workflow C) Hybrid | **B** - Current implementation |
| POL-PR-05 | **Annual leave carryover expiration** | Configurable limit | A) Expire end of next year B) Expire March 31 C) No expiration | **A** - Configurable via `carryoverLimitMinutes` |
| POL-PR-06 | **Sick leave vs annual leave distinction** | Separate leave types | A) Unified leave pool B) Separate quotas C) Hybrid | **B** - Current implementation |
| POL-PR-07 | **Probation period leave eligibility** | Policy per leave type | A) No leave during probation B) Prorated C) Full eligibility | **Needs Decision** - Not configured |

### 2.2 Leave Management

| ID | Policy Gap | Current State | Options | Recommendation |
|----|------------|---------------|---------|----------------|
| POL-LV-01 | **Half-day leave support** | Only full-day minutes | A) Support half-day (4 hours) B) Hourly leave only C) Configurable granularity | **A** - Add half-day support |
| POL-LV-02 | **Leave approval hierarchy** | Configurable flow | A) Fixed 3-level B) Dynamic per company C) Per leave type | **C** - Per leave type flow |
| POL-LV-03 | **Emergency leave policy** | Not implemented | A) Post-approval B) Pre-approved quota C) Manager discretion | **B** - Pre-approved emergency quota |
| POL-LV-04 | **Maternity/paternity leave** | Not implemented | A) Separate leave type B) Extended annual leave C) Government mandate | **A** - Separate paid leave type |
| POL-LV-05 | **Leave encashment on termination** | Not implemented | A) Full encashment B) Prorated C) Not allowed | **Needs Decision** - Legal requirement |
| POL-LV-06 | **Leave donation between employees** | Not implemented | A) Allowed B) Not allowed C) HR approval | **B** - Not typically allowed in Iran |
| POL-LV-07 | **Unpaid leave impact on benefits** | Not defined | A) Benefits suspended B) Benefits continue C) Prorated | **Needs Decision** |

### 2.3 Attendance & Time

| ID | Policy Gap | Current State | Options | Recommendation |
|----|------------|---------------|---------|----------------|
| POL-AT-01 | **Grace period for late arrival** | 4-hour window for shift match | A) Configurable grace B) Fixed 15 min C) No grace | **A** - Current 4-hour window |
| POL-AT-02 | **Early departure tolerance** | Not explicitly handled | A) Mirror late policy B) Stricter C) Same | **A** - Mirror late policy |
| POL-AT-03 | **Missing check-out auto-close** | 24-hour window | A) End of shift + grace B) End of day C) Next check-in | **A** - Current 24h |
| POL-AT-04 | **Remote work attendance** | Project attendance counts | A) Separate remote policy B) Same as office C) Geo-fencing | **B** - Current implementation |
| POL-AT-05 | **Shift swap approval window** | 24h before shift | A) 24h B) 48h C) 1 week | **A** - Current |
| POL-AT-06 | **Overtime approval requirement** | Auto-calculated, no approval | A) Auto-calc B) Requires approval C) Threshold-based | **C** - Auto-calc with threshold |

### 2.4 Loans & Advances

| ID | Policy Gap | Current State | Options | Recommendation |
|----|------------|---------------|---------|----------------|
| POL-LN-01 | **Maximum loan-to-salary ratio** | Not enforced | A) 3x monthly salary B) 6x monthly salary C) Configurable | **A** - 3x monthly (Iranian banking norm) |
| POL-LN-02 | **Interest rate policy** | Default 0% | A) Fixed by law B) Company policy C) Market rate | **A** - Per Iranian banking law |
| POL-LN-03 | **Advance vs loan distinction** | Same workflow | A) Separate entity B) Same with flag C) Different approval | **A** - Separate Advance entity |
| POL-LN-04 | **Early repayment penalty** | Not implemented | A) No penalty B) 1% fee C) Interest recalc | **A** - No penalty per Iranian law |
| POL-LN-05 | **Loan restructuring** | Not implemented | A) Allowed with approval B) Not allowed C) Only for hardship | **A** - With approval |

### 2.5 Benefits & Insurance

| ID | Policy Gap | Current State | Options | Recommendation |
|----|------------|---------------|---------|----------------|
| POL-BN-01 | **Social insurance rates** | Configurable % | A) Fixed by law B) Company adds C) Employee chooses | **A** - Per Iranian labor law |
| POL-BN-02 | **Health insurance coverage** | Not modeled | A) Employer-paid B) Shared C) Employee-only | **A** - Employer-paid per law |
| POL-BN-03 | **Retirement/pension** | Not modeled | A) Social security only B) Company plan C) Hybrid | **A** - Social security per law |
| POL-BN-04 | **Meal/transport allowance** | Part of contract | A) Fixed amount B) Per day C) Actual receipts | **A** - Fixed per contract |

### 2.6 Termination & End of Service

| ID | Policy Gap | Current State | Options | Recommendation |
|----|------------|---------------|---------|----------------|
| POL-TM-01 | **Severance pay calculation** | Not automated | A) 30 days per year B) 1 month per year C) Per contract | **A** - 30 days/year (Iranian law) |
| POL-TM-02 | **Unused leave encashment** | Not implemented | A) Full encashment B) Max 30 days C) Not allowed | **A** - Full per Iranian law |
| POL-TM-03 | **Notice period enforcement** | Not enforced | A) 30 days B) Per contract C) Mutual agreement | **A** - 30 days (Iranian law) |
| POL-TM-04 | **Final settlement timeline** | Not automated | A) 7 days B) 30 days C) Next payroll | **B** - 30 days |

### 2.7 Multi-Company & Organizational

| ID | Policy Gap | Current State | Options | Recommendation |
|----|------------|---------------|---------|----------------|
| POL-MC-01 | **Shared employees across companies** | Not supported | A) Allow with primary B) Separate records C) Not allowed | **C** - Current design |
| POL-MC-02 | **Inter-company transfers** | Manual process | A) Automated workflow B) Manual HR C) Not allowed | **B** - Current |
| POL-MC-03 | **Consolidated reporting** | Per company only | A) Consolidated view B) Separate only C) Both | **A** - Add consolidated reports |

### 2.8 Approval & Workflow

| ID | Policy Gap | Current State | Options | Recommendation |
|----|------------|---------------|---------|----------------|
| POL-AP-01 | **Default approval hierarchy** | Configurable per flow | A) Fixed 3-level B) Role-based C) Amount-based | **B** - Role-based |
| POL-AP-02 | **Auto-approval thresholds** | Not implemented | A) Amount-based B) Risk-based C) Both | **C** - Amount + risk |
| POL-AP-03 | **Delegation of authority** | Not implemented | A) Full delegation B) Temporary C) Not allowed | **B** - Temporary delegation |
| POL-AP-04 | **Escalation timeouts** | Configurable SLA | A) Fixed 24h B) Role-based C) Per flow | **C** - Per flow |

---

## 3. Classification Summary

| Category | Total Gaps | Resolved | Configurable | Requires Decision |
|----------|------------|----------|--------------|-------------------|
| Payroll & Compensation | 7 | 4 | 2 | 1 |
| Leave Management | 7 | 3 | 2 | 2 |
| Attendance & Time | 6 | 4 | 1 | 1 |
| Loans & Advances | 5 | 2 | 1 | 2 |
| Benefits & Insurance | 4 | 2 | 1 | 1 |
| Termination | 4 | 1 | 1 | 2 |
| Multi-Company | 3 | 1 | 1 | 1 |
| Approval & Workflow | 4 | 2 | 1 | 1 |
| **Total** | **43** | **21** | **10** | **12** |

---

## 4. Decision Priority Matrix

| Priority | Policy IDs | Rationale |
|----------|------------|-----------|
| **P0 - Immediate (Legal Compliance)** | POL-PR-01, POL-PR-02, POL-TM-01, POL-TM-02, POL-TM-03, POL-BN-01, POL-BN-02, POL-BN-03, POL-LN-02 | Iranian labor law compliance |
| **P1 - High (Operational Impact)** | POL-PR-03, POL-PR-04, POL-LV-01, POL-LV-04, POL-AT-01, POL-LN-01, POL-LN-03 | Daily operations affected |
| **P2 - Medium (Feature Completeness)** | POL-PR-05, POL-LV-02, POL-LV-03, POL-AT-02, POL-LN-04, POL-BN-04, POL-TM-04, POL-MC-03, POL-AP-02 | Enhanced functionality |
| **P3 - Low (Nice to Have)** | POL-PR-06, POL-PR-07, POL-LV-05, POL-LV-06, POL-LV-07, POL-AT-04, POL-AT-05, POL-AT-06, POL-LN-05, POL-BN-02, POL-BN-03, POL-BN-04, POL-MC-01, POL-MC-02, POL-AP-01, POL-AP-03, POL-AP-04 | Future enhancements |

---

## 5. Decision Process

For each **Requires Decision** item:

1. **Stakeholder Identification** - HR Director, Finance Director, Legal Counsel, IT Director
2. **Document Options** - Documented in this catalog
3. **Impact Analysis** - Legal, financial, operational
4. **Decision Meeting** - Scheduled with stakeholders
4. **Document Decision** - Record in this document
5. **Implementation Planning** - Create tickets, estimate effort
5. **Validation** - Test implementation against decision

---

## 6. Approved Decisions Log

| Policy ID | Decision | Date | Approved By | Implementation Status |
|-----------|----------|------|-------------|----------------------|
| POL-PR-01 | Overtime base = base + fixed allowances | 2026-11-18 | HR/Finance | Implemented |
| POL-PR-02 | Insurance on gross earnings | 2026-11-18 | Finance | Implemented |
| POL-LV-01 | Half-day leave not supported | 2026-11-18 | HR | Deferred |
| POL-AT-01 | 4-hour shift match window | 2026-11-18 | HR | Implemented |
| POL-LN-02 | Interest rate = 0% (Islamic banking) | 2026-11-18 | Finance/Legal | Implemented |

---

**Document Version:** 1.0  
**Last Updated:** 2026-11-18  
**Status:** Complete  
**Next Review:** Upon stakeholder decisions for remaining 12 items