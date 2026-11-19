# Sana HRMS - Business Policy Approval Status

**Version:** 1.0  
**Date:** 2026-11-18  
**Auditor:** Principal Software Architect  
**Classification:** INTERNAL  

---

## 1. Executive Summary

This document tracks the approval status of all 12 unresolved business policy decisions that are release blockers for production go-live. Each decision requires explicit stakeholder approval before implementation.

**Overall Status:** 0/12 APPROVED — All decisions BLOCKED pending stakeholder review

---

## 2. Decision Register — P0 (Immediate / Legal Compliance)

### POL-TM-01: Severance Pay Calculation

| Field | Value |
|-------|-------|
| **Decision ID** | POL-TM-01 |
| **Business Domain** | Termination / End of Service |
| **Priority** | P0 — Legal Compliance |
| **Existing Behavior** | Not automated; manual calculation per HR |
| **Decision Required** | How to calculate severance pay upon termination |
| **Alternative Options** | A) 30 days per year of service (Iran Labor Law standard)<br>B) 1 month per year (calendar month)<br>C) Per employment contract terms |
| **Financial Consequences** | Option A: Higher liability for long-tenure employees<br>Option B: Slightly lower for partial years<br>Option C: Variable, requires contract review |
| **Operational Consequences** | Automated calculation needed in LifecycleService termination workflow |
| **Recommended Option** | **A) 30 days/year** — Aligns with Iranian Labor Law Article 29 |
| **Justification** | Legal requirement; reduces litigation risk; consistent with industry practice |
| **Required Stakeholder** | HR Director, Legal Counsel |
| **Approval Status** | ⬜ **BLOCKED** — Pending HR/Legal sign-off |
| **Implementation Dependencies** | LifecycleService.terminateEmployee(), settlement calculation engine |

---

### POL-TM-02: Unused Leave Encashment

| Field | Value |
|-------|-------|
| **Decision ID** | POL-TM-02 |
| **Business Domain** | Termination / Leave |
| **Priority** | P0 — Legal Compliance |
| **Existing Behavior** | Not implemented; leave balances expire on termination |
| **Decision Required** | How to handle unused leave balance upon termination |
| **Alternative Options** | A) Full encashment (all unused days paid)<br>B) Prorated encashment (max 30 days per year)<br>C) No encashment (forfeited) |
| **Financial Consequences** | Option A: Highest liability<br>Option B: Capped liability<br>Option C: Zero liability |
| **Operational Consequences** | Requires LeaveService.getLeaveBalance() integration with termination workflow |
| **Recommended Option** | **A) Full encashment** — Iranian Labor Law Article 39 |
| **Justification** | Legal requirement; employee right; avoids labor disputes |
| **Required Stakeholder** | HR Director, Legal Counsel, Finance Director |
| **Approval Status** | ⬜ **BLOCKED** — Pending HR/Legal/Finance sign-off |
| **Implementation Dependencies** | Leave balance query, payroll final settlement |

---

### POL-TM-03: Notice Period Enforcement

| Field | Value |
|-------|-------|
| **Decision ID** | POL-TM-03 |
| **Business Domain** | Termination |
| **Priority** | P0 — Legal Compliance |
| **Existing Behavior** | Not enforced; resignation effective immediately |
| **Decision Required** | Notice period requirement for resignation/termination |
| **Alternative Options** | A) 30 days (Iran Labor Law standard)<br>B) Per employment contract<br>C) Mutual agreement (waivable) |
| **Financial Consequences** | Option A: Salary paid during notice period<br>Option B: Variable<br>Option C: Minimal if waived |
| **Operational Consequences** | LifecycleService must validate notice period before final settlement |
| **Recommended Option** | **A) 30 days** — Iranian Labor Law Article 22 |
| **Justification** | Legal requirement; standard practice |
| **Required Stakeholder** | HR Director, Legal Counsel |
| **Approval Status** | ⬜ **BLOCKED** — Pending HR/Legal sign-off |
| **Implementation Dependencies** | Resignation workflow, settlement date calculation |

---

### POL-BN-01: Social Insurance Rates

| Field | Value |
|-------|-------|
| **Decision ID** | POL-BN-01 |
| **Business Domain** | Benefits & Insurance |
| **Priority** | P0 — Legal Compliance |
| **Existing Behavior** | Configurable percentages in payroll calculation |
| **Decision Required** | Social insurance contribution rates (employer/employee) |
| **Alternative Options** | A) Fixed by law (Social Security Organization rates)<br>B) Company adds supplementary<br>C) Employee chooses level |
| **Financial Consequences** | Option A: Fixed statutory cost<br>Option B: Higher employer cost<br>Option C: Variable |
| **Operational Consequences** | Payroll engine must use fixed rates; no configuration needed |
| **Recommended Option** | **A) Fixed by law** — Per Social Security Organization regulations |
| **Justification** | Legal mandate; rates set by government; non-negotiable |
| **Required Stakeholder** | Finance Director, Legal Counsel |
| **Approval Status** | ⬜ **BLOCKED** — Pending Finance/Legal sign-off |
| **Implementation Dependencies** | PayrollEngine social insurance calculation |

---

### POL-BN-02: Health Insurance Coverage

| Field | Value |
|-------|-------|
| **Decision ID** | POL-BN-02 |
| **Business Domain** | Benefits & Insurance |
| **Priority** | P0 — Legal Compliance |
| **Existing Behavior** | Not modeled in system |
| **Decision Required** | Health insurance funding model |
| **Alternative Options** | A) Employer-paid (mandatory per law)<br>B) Shared employer/employee<br>C) Employee-only (voluntary) |
| **Financial Consequences** | Option A: Full employer cost<br>Option B: Split cost<br>Option C: No employer cost |
| **Operational Consequences** | New benefit type in Benefits module; payroll deduction if shared |
| **Recommended Option** | **A) Employer-paid** — Iranian Labor Law requirement |
| **Justification** | Legal requirement for formal sector employers |
| **Required Stakeholder** | HR Director, Finance Director |
| **Approval Status** | ⬜ **BLOCKED** — Pending HR/Finance sign-off |
| **Implementation Dependencies** | BenefitsService, payroll benefit deductions |

---

### POL-BN-03: Retirement/Pension

| Field | Value |
|-------|-------|
| **Decision ID** | POL-BN-03 |
| **Business Domain** | Benefits & Insurance |
| **Priority** | P0 — Legal Compliance |
| **Existing Behavior** | Not modeled |
| **Decision Required** | Pension provision model |
| **Alternative Options** | A) Social security only (state pension)<br>B) Company supplementary plan<br>C) Hybrid |
| **Financial Consequences** | Option A: Covered by social insurance<br>Option B: Additional employer cost<br>Option C: Variable |
| **Operational Consequences** | May require separate pension tracking if supplementary |
| **Recommended Option** | **A) Social security only** — Standard for Iranian private sector |
| **Justification** | Legal baseline; supplementary plans optional and rare |
| **Required Stakeholder** | HR Director, Legal Counsel |
| **Approval Status** | ⬜ **BLOCKED** — Pending HR/Legal sign-off |
| **Implementation Dependencies** | BenefitsService, reporting |

---

### POL-LN-02: Interest Rate Policy

| Field | Value |
|-------|-------|
| **Decision ID** | POL-LN-02 |
| **Business Domain** | Loans & Advances |
| **Priority** | P0 — Legal Compliance |
| **Existing Behavior** | Default 0% in loan configuration |
| **Decision Required** | Interest rate policy for employee loans |
| **Alternative Options** | A) 0% (Islamic banking compliant)<br>B) Market rate<br>C) Central bank reference rate |
| **Financial Consequences** | Option A: No interest income, Sharia compliant<br>Option B: Interest income, may violate Islamic banking<br>Option C: Variable, regulatory complexity |
| **Operational Consequences** | LoanService must enforce 0% or configured rate |
| **Recommended Option** | **A) 0%** — Islamic banking compliance, Iranian banking law |
| **Justification** | Iran interest-free banking law; avoids religious/compliance issues |
| **Required Stakeholder** | Finance Director, Legal Counsel |
| **Approval Status** | ⬜ **BLOCKED** — Pending Finance/Legal sign-off |
| **Implementation Dependencies** | LoanService interest calculation |

---

## 3. Decision Register — P1 (High / Operational Impact)

### POL-PR-03: Proration Method for Partial Months

| Field | Value |
|-------|-------|
| **Decision ID** | POL-PR-03 |
| **Business Domain** | Payroll & Compensation |
| **Priority** | P1 — Operational Impact |
| **Existing Behavior** | Working days ratio (current implementation) |
| **Decision Required** | How to prorate salary for partial month work |
| **Alternative Options** | A) Calendar days (30/31 denominator)<br>B) Working days (actual working days / scheduled working days)<br>C) Actual days worked |
| **Financial Consequences** | Minor variations; Option B most favorable to employees |
| **Operational Consequences** | PayrollEngine proration logic |
| **Recommended Option** | **B) Working days** — Current implementation; fairer for shift workers |
| **Justification** | Reflects actual work obligation; industry standard |
| **Required Stakeholder** | HR Director |
| **Approval Status** | ⬜ **BLOCKED** — Pending HR sign-off |
| **Implementation Dependencies** | PayrollEngine.prorateSalary() |

---

### POL-PR-04: Payroll Period Lock Finality

| Field | Value |
|-------|-------|
| **Decision ID** | POL-PR-04 |
| **Business Domain** | Payroll & Compensation |
| **Priority** | P1 — Operational Impact |
| **Existing Behavior** | Locked periods cannot be modified (current implementation) |
| **Decision Required** | Can locked payroll periods be reopened? |
| **Alternative Options** | A) Admin override allowed<br>B) Amendment workflow only (reversing entries)<br>C) Hybrid (override with audit) |
| **Financial Consequences** | Option A: Risk of unauthorized changes<br>Option B: Full audit trail, compliance<br>Option C: Controlled flexibility |
| **Operational Consequences** | PayrollService.lockPeriod(), amendment workflow |
| **Recommended Option** | **B) Amendment only** — Current implementation; strongest audit integrity |
| **Justification** | Financial control; audit requirement; prevents tampering |
| **Required Stakeholder** | Finance Director |
| **Approval Status** | ⬜ **BLOCKED** — Pending Finance sign-off |
| **Implementation Dependencies** | PayrollService, amendment workflow |

---

### POL-LV-01: Half-Day Leave Support

| Field | Value |
|-------|-------|
| **Decision ID** | POL-LV-01 |
| **Business Domain** | Leave Management |
| **Priority** | P1 — Operational Impact |
| **Existing Behavior** | Full-day minutes only (no half-day) |
| **Decision Required** | Support half-day (4-hour) leave requests |
| **Alternative Options** | A) Add half-day (4 hours) support<br>B) Hourly leave granularity<br>C) Configurable granularity per leave type |
| **Financial Consequences** | Minimal; affects leave balance precision |
| **Operational Consequences** | LeaveService, leave balance tracking, calendar display |
| **Recommended Option** | **A) Add half-day** — Common requirement; simple implementation |
| **Justification** | Employee flexibility; standard in HR systems |
| **Required Stakeholder** | HR Director |
| **Approval Status** | ⬜ **BLOCKED** — Pending HR sign-off |
| **Implementation Dependencies** | LeaveService, leave balance in minutes, UI calendar |

---

### POL-LV-04: Maternity/Paternity Leave

| Field | Value |
|-------|-------|
| **Decision ID** | POL-LV-04 |
| **Business Domain** | Leave Management |
| **Priority** | P1 — Operational Impact |
| **Existing Behavior** | Not implemented |
| **Decision Required** | Maternity/paternity leave type and entitlement |
| **Alternative Options** | A) Separate leave type with legal entitlement<br>B) Extended annual leave<br>C) Government mandate only (external) |
| **Financial Consequences** | Option A: Paid leave cost (90 days maternity per law)<br>Option B: Uses annual leave balance<br>Option C: No direct cost |
| **Operational Consequences** | New leave types, entitlement tracking, payroll integration |
| **Recommended Option** | **A) Separate paid leave type** — Iranian Labor Law Article 71 (90 days maternity) |
| **Justification** | Legal requirement; distinct from annual leave; job protection |
| **Required Stakeholder** | HR Director, Legal Counsel |
| **Approval Status** | ⬜ **BLOCKED** — Pending HR/Legal sign-off |
| **Implementation Dependencies** | LeaveService leave types, entitlement engine |

---

### POL-AT-01: Grace Period for Late Arrival

| Field | Value |
|-------|-------|
| **Decision ID** | POL-AT-01 |
| **Business Domain** | Attendance & Time |
| **Priority** | P1 — Operational Impact |
| **Existing Behavior** | 4-hour shift matching window (current implementation) |
| **Decision Required** | Grace period policy for late arrival |
| **Alternative Options** | A) Configurable grace period<br>B) Fixed 15 minutes<br>C) No grace period |
| **Financial Consequences** | Minimal; affects overtime/late calculations |
| **Operational Consequences** | AttendanceService late calculation |
| **Recommended Option** | **A) Configurable** — Current 4-hour window is shift matching, not grace |
| **Justification** | Shift matching window ≠ grace period; need separate grace config |
| **Required Stakeholder** | HR Director |
| **Approval Status** | ⬜ **BLOCKED** — Pending HR sign-off |
| **Implementation Dependencies** | AttendanceService, shift configuration |

---

### POL-LN-01: Maximum Loan-to-Salary Ratio

| Field | Value |
|-------|-------|
| **Decision ID** | POL-LN-01 |
| **Business Domain** | Loans & Advances |
| **Priority** | P1 — Operational Impact |
| **Existing Behavior** | Not enforced |
| **Decision Required** | Maximum loan amount as multiple of monthly salary |
| **Alternative Options** | A) 3x monthly salary (Iranian banking norm)<br>B) 6x monthly salary<br>C) Configurable per company |
| **Financial Consequences** | Option A: Conservative, lower default risk<br>Option B: Higher exposure<br>Option C: Flexible |
| **Operational Consequences** | LoanService validation on application |
| **Recommended Option** | **A) 3x monthly** — Iranian banking standard; risk mitigation |
| **Justification** | Industry standard; regulatory alignment; risk management |
| **Required Stakeholder** | Finance Director |
| **Approval Status** | ⬜ **BLOCKED** — Pending Finance sign-off |
| **Implementation Dependencies** | LoanService, employee salary query |

---

### POL-LN-03: Advance vs Loan Distinction

| Field | Value |
|-------|-------|
| **Decision ID** | POL-LN-03 |
| **Business Domain** | Loans & Advances |
| **Priority** | P1 — Operational Impact |
| **Existing Behavior** | Same workflow for advances and loans |
| **Decision Required** | Separate advance entity from loans |
| **Alternative Options** | A) Separate Advance entity (dedicated table/workflow)<br>B) Same entity with type flag<br>C) Different approval workflow only |
| **Financial Consequences** | Option A: Clean separation, distinct accounting<br>Option B: Simpler schema, mixed reporting<br>Option C: Workflow only, same data model |
| **Operational Consequences** | Major: New Prisma model, API, UI, repayment logic |
| **Recommended Option** | **A) Separate Advance entity** — Per UNRESOLVED_BUSINESS_POLICY_DECISIONS.md |
| **Justification** | Different repayment terms, tax treatment, approval flow; INT-FIN-AD-05 |
| **Required Stakeholder** | Finance Director |
| **Approval Status** | ⬜ **BLOCKED** — Pending Finance sign-off |
| **Implementation Dependencies** | Prisma schema migration, AdvanceService, repayment engine |

---

## 4. Approval Workflow

For each BLOCKED decision:

1. **Stakeholder Notification** — Email/schedule meeting with Required Stakeholder(s)
2. **Decision Briefing** — Present this document with options and recommendations
3. **Formal Approval** — Stakeholder signs off (email/recorded meeting)
4. **Decision Log Update** — Record decision, date, approver in this document
5. **Implementation Planning** — Create ticket, estimate effort, assign owner
6. **Validation** — Test implementation against approved decision

---

## 5. Current Blocker Summary

| Priority | Decisions Blocked | Stakeholders Required |
|----------|-------------------|----------------------|
| P0 | 7 (POL-TM-01, POL-TM-02, POL-TM-03, POL-BN-01, POL-BN-02, POL-BN-03, POL-LN-02) | HR Director, Legal Counsel, Finance Director |
| P1 | 5 (POL-PR-03, POL-PR-04, POL-LV-01, POL-LV-04, POL-AT-01, POL-LN-01, POL-LN-03) | HR Director, Finance Director, Legal Counsel |
| **Total** | **12** | **3 key stakeholders** |

---

## 6. Impact on Production Go-Live

**These 12 decisions are RELEASE BLOCKERS.** Without formal approval:

- Termination workflows cannot be completed (POL-TM-01, POL-TM-02, POL-TM-03)
- Benefits compliance unverified (POL-BN-01, POL-BN-02, POL-BN-03)
- Loan policy unenforced (POL-LN-01, POL-LN-02, POL-LN-03)
- Payroll calculation ambiguity (POL-PR-03, POL-PR-04)
- Leave management incomplete (POL-LV-01, POL-LV-04)
- Attendance policy gap (POL-AT-01)

**Recommendation:** Schedule stakeholder decision meeting within Sprint 1 (Week 1-2). All P0 decisions must be resolved before CONDITIONAL GO.

---

## 7. Sign-Off

| Role | Name | Signature | Date | Decision |
|------|------|-----------|------|----------|
| Principal Architect | | | 2026-11-18 | ⚠️ BLOCKED |
| HR Director | | | | ⬜ Pending |
| Finance Director | | | | ⬜ Pending |
| Legal Counsel | | | | ⬜ Pending |
| Product Owner | | | | ⬜ Pending |

---

**Document Version:** 1.0  
**Date:** 2026-11-18  
**Status:** Active — All 12 Decisions BLOCKED  
**Classification:** INTERNAL