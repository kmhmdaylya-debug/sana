# Sana HRMS - Business Policy Decision Register

**Version:** 1.0  
**Date:** 2026-11-18  
**Auditor:** Principal Software Architect  
**Classification:** INTERNAL  

---

## 1. Overview

This register documents business policy decisions that require explicit stakeholder approval before implementation. These are not technical defects but require organizational decisions.

---

## 2. Policy Decisions Register

### 2.1 P0 - Immediate (Legal Compliance)

| ID | Policy Area | Decision Required | Options | Recommended | Status | Owner | Target |
|----|-------------|-------------------|---------|-------------|--------|-------|--------|
| POL-PR-01 | Overtime calculation base | Base salary only vs Base + allowances | Base + fixed allowances | Base + fixed | Pending | HR/Finance | Sprint 1 |
| POL-PR-02 | Insurance calculation base | Gross earnings vs Base salary | Gross earnings | Gross | Pending | Finance | Sprint 1 |
| POL-TM-01 | Severance pay calculation | 30 days/year vs 1 month/year | 30 days/year | 30 days/year | Pending | HR/Legal | Sprint 1 |
| POL-TM-02 | Unused leave encashment | Full vs prorated vs none | Full encashment | Full | Pending | HR/Legal | Sprint 1 |
| POL-TM-03 | Notice period enforcement | 30 days vs contract vs mutual | 30 days | 30 days | Pending | HR/Legal | Sprint 1 |
| POL-BN-01 | Social insurance rates | Fixed by law vs configurable | Fixed by law | Fixed | Pending | Finance/Legal | Sprint 1 |
| POL-BN-02 | Health insurance coverage | Employer-paid vs shared | Employer-paid | Employer-paid | Pending | HR/Finance | Sprint 1 |
| POL-BN-03 | Retirement/pension | Social security only vs hybrid | Social security | Social security | Pending | HR/Legal | Sprint 1 |
| POL-LN-02 | Interest rate policy | 0% (Islamic) vs market rate | 0% (Islamic) | 0% | Pending | Finance/Legal | Sprint 1 |

### 2.2 P1 - High Priority (Operational Impact)

| ID | Policy Area | Decision Required | Options | Recommended | Status | Owner | Target |
|----|-------------|-------------------|---------|-------------|--------|-------|--------|
| POL-PR-03 | Proration method | Calendar days vs working days | Working days | Working days | Pending | HR | Sprint 2 |
| POL-PR-04 | Payroll period lock finality | Admin override vs amendment only | Amendment only | Amendment only | Pending | Finance | Sprint 2 |
| POL-LV-01 | Half-day leave support | Full-day only vs half-day support | Half-day | Add half-day | Pending | HR | Sprint 2 |
| POL-LV-04 | Maternity/paternity leave | Separate type vs extended annual | Separate type | Separate type | Pending | HR/Legal | Sprint 2 |
| POL-AT-01 | Grace period for late arrival | Configurable vs fixed | Configurable (4hr current) | Configurable | Pending | HR | Sprint 2 |
| POL-LN-01 | Max loan-to-salary ratio | 3x vs 6x vs configurable | 3x monthly | 3x monthly | Pending | Finance | Sprint 2 |
| POL-LN-03 | Advance vs loan distinction | Separate entity vs flag | Separate entity | Separate entity | Pending | Finance | Sprint 2 |

### 2.2 P2 - Medium Priority (Feature Completeness)

| ID | Policy Area | Decision Required | Options | Recommended | Status | Owner | Target |
|----|-------------|-------------------|---------|-------------|--------|-------|--------|
| POL-PR-05 | Leave carryover expiration | Expire next year vs March 31 | Expire next year | Expire next year | Pending | HR | Sprint 3 |
| POL-LV-02 | Leave approval hierarchy | Fixed 3-level vs dynamic | Dynamic per leave type | Dynamic | Pending | HR | Sprint 3 |
| POL-LV-03 | Emergency leave policy | Post-approval vs pre-approved | Pre-approved quota | Pre-approved quota | Pending | HR | Sprint 3 |
| POL-LV-05 | Leave encashment on termination | Full vs max 30 days vs none | Full encashment | Full | Pending | HR/Legal | Sprint 3 |
| POL-AT-02 | Early departure tolerance | Mirror late policy | Mirror | Mirror | Pending | HR | Sprint 3 |
| POL-LN-04 | Early repayment penalty | No penalty vs 1% fee | No penalty | No penalty | Pending | Finance/Legal | Sprint 3 |
| POL-BN-04 | Meal/transport allowance | Fixed vs per day | Fixed per contract | Fixed | Pending | Finance | Sprint 3 |

### 2.3 P3 - Low Priority (Nice to Have)

| ID | Policy Area | Decision Required | Options | Recommended | Status | Owner | Target |
|----|-------------|-------------------|---------|-------------|--------|-------|--------|
| POL-PR-06 | Sick vs annual leave distinction | Unified vs separate | Separate quotas | Separate | Pending | HR | Backlog |
| POL-LV-06 | Leave donation | Allowed vs not allowed | Not allowed | Not allowed | Pending | HR | Backlog |
| POL-LV-07 | Unpaid leave impact on benefits | Suspended vs continued | Continued | Continued | Pending | HR/Benefits | Backlog |
| POL-AT-04 | Remote work attendance | Separate policy | Same as office | Same | Pending | HR | Backlog |
| POL-LN-05 | Loan restructuring | Allowed with approval | Allowed with approval | Allowed | Pending | Finance | Backlog |
| POL-BN-02 | Health insurance coverage | Employer-paid | Employer-paid | Employer-paid | Pending | Benefits | Backlog |
| POL-BN-03 | Retirement/pension | Social security only | Social security | Social security | Pending | HR/Legal | Backlog |
| POL-MC-01 | Shared employees | Primary company only | Not allowed | Not allowed | Pending | HR | Backlog |
| POL-AP-01 | Default approval hierarchy | Role-based | Role-based | Role-based | Pending | HR | Backlog |
| POL-AP-03 | Delegation of authority | Temporary only | Temporary | Temporary | Pending | HR | Backlog |

---

## 2. Decision Tracking

| Policy ID | Decision | Date | Approved By | Implementation Status |
|-----------|----------|------|-------------|----------------------|
| POL-PR-01 | Base + fixed allowances | 2026-11-18 | HR/Finance | Implemented |
| POL-PR-02 | Insurance on gross | 2026-11-18 | Finance | Implemented |
| POL-LV-01 | Half-day leave deferred | 2026-11-18 | HR | Deferred to Sprint 2 |
| POL-AT-01 | 4-hour shift match window | 2026-11-18 | HR | Implemented |
| POL-LN-02 | Interest rate = 0% | 2026-11-18 | Finance/Legal | Implemented |

---

## 3. Decision Tracking Template

For each new policy decision:

```
Policy ID: POL-XXX-XX
Title: [Brief description]
Category: [Payroll/Leave/Attendance/Loan/Benefits/Termination/Multi-company/Approval]
Priority: P0/P1/P2/P3
Decision Required: [Clear question]
Options: [A) Option A, B) Option B, C) Option C]
Recommendation: [Recommended option with rationale]
Impact: [Legal/Financial/Operational]
Stakeholders: [Roles]
Decision: [Pending/Approved/Deferred]
Approved By: [Role/Name]
Date: [YYYY-MM-DD]
Implementation: [Status/Ticket]
```

---

**Document Version:** 1.0  
**Date:** 2026-11-18  
**Status:** Complete  
**Classification:** INTERNAL