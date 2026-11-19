# Sana HRMS - Business and Legal Decision Register

**Version:** 1.0  
**Date:** 2026-11-19  
**Auditor:** Independent Release Auditor  
**Classification:** CONFIDENTIAL  

---

## 1. Executive Summary

This register consolidates all unresolved business policy and legal decisions identified across Stage 10-13 reports. The reconciliation revealed discrepancies in counting and categorization.

**Total Unresolved Decisions:** 12 (9 P0 + 3 P1 from Stage 10) + 6 from Stage 12 = **18 total**, but with overlap = **12 unique decisions** requiring stakeholder approval.

---

## 2. Decision Reconciliation

### 2.1 Source Document Comparison

| Source | P0 | P1 | P2 | P3 | Total | Notes |
|--------|----|----|----|----|-------|-------|
| BUSINESS_POLICY_DECISION_REGISTER.md | 9 | 7 | 9 | 16 | 41 | 12 unresolved |
| UNRESOLVED_BUSINESS_POLICY_DECISIONS.md | 9 | 3 | 9 | 17 | 38 | 12 require decision |
| FINAL_PRODUCTION_READINESS_REPORT.md | 5 | 3 | - | - | 8 | Referenced |
| Stage 12 (DATA_PRIVACY_AND_GOVERNANCE.md) | 6 legal | - | - | - | 6 | New from Stage 12 |

**Reconciliation:** The 6 legal decisions from Stage 12 overlap with 6 of the 12 from Stage 10. Total unique = **12 decisions**.

---

## 3. Decision Register

### 3.1 P0 Decisions (Immediate / Legal Compliance)

| ID | Decision | Domain | Question | Current Behavior | Impact | Owner | Status |
|----|----------|--------|----------|------------------|--------|-------|--------|
| DEC-001 | Overtime calculation base | Payroll | What constitutes "base salary" for overtime? Base only? Base + fixed allowances? | Code uses base + fixed allowances (POL-PR-01 claimed implemented) | Financial: affects all overtime payments | HR Director / Finance | ⚠️ Claimed implemented, needs verification |
| DEC-002 | Insurance calculation base | Payroll | Social insurance on gross or base? | Code uses gross earnings (POL-PR-02 claimed implemented) | Financial: affects employer/employee contributions | Finance Director | ⚠️ Claimed implemented, needs verification |
| DEC-003 | Severance pay calculation | Termination | Formula for end-of-service benefit | Not implemented in code | Legal: Labor Law Art. 29 compliance; Financial: major liability | Legal Counsel / HR | ❌ Pending |
| DEC-004 | Unused leave encashment | Leave/Termination | Pay out unused leave on termination? | Not implemented | Legal: Labor Law Art. 39; Financial: payout liability | Legal / HR / Finance | ❌ Pending |
| DEC-005 | Notice period enforcement | Termination | Required notice period before termination | Not enforced in code | Legal: Labor Law Art. 22; Operational: transition planning | Legal / HR | ❌ Pending |
| DEC-006 | Social insurance rates | Benefits | Employer/employee contribution percentages | Configurable in code; not fixed by law | Legal: Must match Social Security Org rates; Financial | Finance / Legal | ❌ Pending |
| DEC-007 | Health insurance coverage | Benefits | Employer-paid vs shared vs voluntary | Not modeled in system | Legal: Mandatory for formal sector; Financial | HR / Finance | ❌ Pending |
| DEC-008 | Retirement/pension | Benefits | State only vs company supplementary | Not modeled | Financial: Long-term liability | HR / Legal | ❌ Pending |
| DEC-009 | Interest rate policy | Loans | 0% (Islamic) vs market rate | Default 0% in config (POL-LN-02 claimed) | Legal: Interest-free banking law; Financial | Finance / Legal | ⚠️ Claimed implemented |

### 3.2 P1 Decisions (High Priority)

| ID | Decision | Domain | Question | Current Behavior | Impact | Owner | Status |
|----|----------|--------|----------|------------------|--------|-------|--------|
| DEC-010 | Proration method | Payroll | Calendar days vs working days | Working days (current impl) | Financial: minor variations | HR | ❌ Pending |
| DEC-011 | Payroll period lock finality | Payroll | Can locked periods be reopened? | Amendment-only (current impl) | Financial control; audit integrity | Finance | ❌ Pending |
| DEC-012 | Half-day leave support | Leave | Support 4-hour leave units | Full-day minutes only | Operational: employee flexibility | HR | ❌ Pending (deferred) |
| DEC-013 | Maternity/paternity leave | Leave | Separate leave type with legal entitlement | Not implemented | Legal: Labor Law Art. 71 (90 days); Job protection | HR / Legal | ❌ Pending |
| DEC-014 | Grace period for late arrival | Attendance | Grace minutes before "late" | 4-hour shift window (not grace) | Operational: late calculation | HR | ⚠️ Claimed implemented |
| DEC-015 | Max loan-to-salary ratio | Loans | Max multiple of monthly salary | Not enforced | Financial risk; regulatory alignment | Finance | ❌ Pending |
| DEC-016 | Advance vs loan distinction | Loans | Separate entity vs same workflow | Same workflow (INT-FIN-AD-05) | Financial: different tax/repayment treatment | Finance | ❌ Pending |

### 3.3 Stage 12 Legal/Privacy Decisions (Overlap)

| ID | Decision | Domain | Overlaps With | Question | Owner | Status |
|----|----------|--------|---------------|----------|-------|--------|
| LEG-001 | Jurisdiction confirmation | Legal | DEC-003, DEC-004, DEC-005, DEC-006 | Iran Labor Law applicability confirmed? | Legal Counsel | ❌ Pending |
| LEG-002 | Biometric data handling | Privacy | - | Fingerprint/face attendance collection legal? | Legal / HR | ❌ Pending |
| LEG-003 | Employee monitoring scope | Privacy | - | Transparency, proportionality of monitoring | Legal / HR | ❌ Pending |
| LEG-004 | Data localization | Legal | DEC-006, DEC-007 | Must data stay in Iran? | Legal Counsel | ❌ Pending |
| LEG-005 | Consent for automated decisions | Privacy | DEC-010, DEC-011 | Consent for automated payroll/leave decisions | Legal / HR | ❌ Pending |
| LEG-006 | Cross-border transfer | Legal | DEC-006, DEC-007 | Cloud services outside Iran permitted? | Legal Counsel | ❌ Pending |

---

## 3. Overlap Analysis

| Stage 10 Decision | Stage 12 Legal Decision | Relationship |
|-------------------|-------------------------|--------------|
| DEC-003 Severance | LEG-001 Jurisdiction | LEG-001 governs DEC-003 legal basis |
| DEC-004 Leave encashment | LEG-001 Jurisdiction | LEG-001 governs DEC-004 legal basis |
| DEC-005 Notice period | LEG-001 Jurisdiction | LEG-001 governs DEC-005 legal basis |
| DEC-006 Social insurance | LEG-001 Jurisdiction | LEG-001 governs DEC-006 legal basis |
| DEC-007 Health insurance | LEG-001 Jurisdiction | LEG-001 governs DEC-007 legal basis |
| DEC-008 Retirement | LEG-001 Jurisdiction | LEG-001 governs DEC-008 legal basis |
| DEC-010 Proration | LEG-005 Automated decisions | Automated proration needs consent |
| DEC-011 Period lock | LEG-005 Automated decisions | Automated lock needs consent |
| DEC-006 Insurance rates | LEG-004 Data localization | Insurance data may need local storage |
| DEC-007 Health insurance | LEG-004 Data localization | Health data may need local storage |
| DEC-015 Loan ratio | - | Independent |
| DEC-016 Advance vs loan | - | Independent |
| DEC-009 Interest rate | - | Independent (Islamic banking) |
| DEC-012 Half-day leave | - | Independent |
| DEC-013 Maternity leave | - | Independent |
| DEC-014 Grace period | - | Independent |

**Total Unique Decisions: 16 (9 P0 + 7 P1) with 6 overlapping legal governance items**

---

## 4. Impact Assessment

### 4.1 Blocking Production (Must Resolve Pre-Go-Live)

| Decision | Blocks | Rationale |
|----------|--------|-----------|
| DEC-003 Severance | Termination workflow | Cannot process terminations legally |
| DEC-004 Leave encashment | Termination/Offboarding | Financial liability on exit |
| DEC-005 Notice period | Termination workflow | Legal compliance |
| DEC-006 Social insurance | Payroll calculation | Every payroll run |
| DEC-007 Health insurance | Benefits/Payroll | Every payroll run |
| DEC-008 Retirement | Benefits | Long-term but required |
| DEC-001 Overtime base | Payroll calculation | Every payroll run |
| DEC-002 Insurance base | Payroll calculation | Every payroll run |
| DEC-009 Interest rate | Loan processing | Every loan application |

### 4.2 Sprint 1 (0-30 Days Post Go-Live)

| Decision | Rationale |
|----------|-----------|
| DEC-010 Proration | Affects payroll accuracy |
| DEC-011 Period lock | Financial control |
| DEC-012 Half-day leave | Employee experience |
| DEC-013 Maternity leave | Legal requirement |
| DEC-014 Grace period | Attendance accuracy |
| DEC-015 Loan ratio | Risk management |
| DEC-016 Advance/loan | Financial accuracy |

### 4.3 Legal Governance (Must Resolve Pre-Go-Live)

| Decision | Rationale |
|----------|-----------|
| LEG-001 Jurisdiction | Foundation for all labor law decisions |
| LEG-002 Biometric data | Attendance system uses biometrics |
| LEG-003 Monitoring | Employee monitoring transparency |
| LEG-004 Data localization | Affects cloud/backup strategy |
| LEG-005 Automated decisions | Payroll/leave automation consent |
| LEG-006 Cross-border | Affects cloud/backup vendor choice |

---

## 5. Implementation Status

| Decision | Code Implemented | Config Only | Not Started | Needs Legal Sign-off |
|----------|------------------|-------------|-------------|---------------------|
| DEC-001 | ✅ (POL-PR-01) | - | - | ❌ |
| DEC-002 | ✅ (POL-PR-02) | - | - | ❌ |
| DEC-003 | ❌ | - | ✅ | ✅ |
| DEC-004 | ❌ | - | ✅ | ✅ |
| DEC-005 | ❌ | - | ✅ | ✅ |
| DEC-006 | ⚠️ Configurable | - | - | ✅ |
| DEC-007 | ❌ | - | ✅ | ✅ |
| DEC-008 | ❌ | - | ✅ | ✅ |
| DEC-009 | ✅ (POL-LN-02) | - | - | ❌ |
| DEC-010 | ✅ (impl) | - | - | ❌ |
| DEC-011 | ✅ (impl) | - | - | ❌ |
| DEC-011 | ❌ | - | ✅ | ❌ |
| DEC-012 | ❌ | - | ✅ | ❌ |
| DEC-013 | ❌ | - | ✅ | ✅ |
| DEC-014 | ⚠️ Shift window | - | - | ❌ |
| DEC-015 | ❌ | - | ✅ | ❌ |
| DEC-016 | ❌ | - | ✅ | ❌ |

---

## 6. Approval Evidence Required

| Decision | Required Approver | Evidence Format | Deadline |
|----------|-------------------|-----------------|----------|
| DEC-001 | HR Director + Finance | Signed decision memo | Pre Go-Live |
| DEC-002 | Finance Director | Signed decision memo | Pre Go-Live |
| DEC-003 | Legal Counsel + HR Director | Signed legal opinion | Pre Go-Live |
| DEC-004 | Legal Counsel + HR Director | Signed legal opinion | Pre Go-Live |
| DEC-005 | Legal Counsel + HR Director | Signed legal opinion | Pre Go-Live |
| DEC-006 | Finance Director + Legal | Signed rate table | Pre Go-Live |
| DEC-007 | HR Director + Finance | Signed policy doc | Pre Go-Live |
| DEC-008 | HR Director + Legal | Signed policy doc | Pre Go-Live |
| DEC-009 | Finance + Legal | Signed fatwa/policy | Pre Go-Live |
| DEC-010 | HR Director | Signed decision memo | Sprint 1 |
| DEC-011 | Finance Director | Signed decision memo | Sprint 1 |
| DEC-012 | HR Director | Signed decision memo | Sprint 1 |
| DEC-013 | HR Director + Legal | Signed legal opinion | Sprint 1 |
| DEC-014 | HR Director | Signed decision memo | Sprint 1 |
| DEC-015 | Finance Director | Signed risk assessment | Sprint 1 |
| DEC-016 | Finance Director | Signed design doc | Sprint 1 |
| LEG-001 | Legal Counsel | Signed legal opinion | Pre Go-Live |
| LEG-002 | Legal + HR | Signed policy | Pre Go-Live |
| LEG-003 | Legal + HR | Signed policy | Pre Go-Live |
| LEG-004 | Legal Counsel | Signed legal opinion | Pre Go-Live |
| LEG-005 | Legal + HR | Signed policy | Pre Go-Live |
| LEG-006 | Legal Counsel | Signed legal opinion | Pre Go-Live |

---

## 6. Risk Register

| Risk | Decisions Affected | Likelihood | Impact | Mitigation |
|------|-------------------|------------|--------|------------|
| Legal non-compliance | DEC-003 to DEC-008, LEG-001 | Medium | Critical (fines, lawsuits) | Obtain legal sign-off pre Go-Live |
| Payroll inaccuracy | DEC-001, DEC-002, DEC-010 | Medium | High | Verify implementation matches approved policy |
| Financial liability | DEC-003, DEC-004, DEC-006 | Medium | High | Legal sign-off on calculations |
| Data localization violation | LEG-004 | Low | Critical | Confirm data residency requirements |
| Biometric data violation | LEG-002 | Medium | High | Legal opinion on biometric collection |
| Cross-border violation | LEG-006 | Low | High | Legal opinion on cloud vendor |

---

## 7. Approval Tracking

| Decision | Approver | Status | Date Approved | Evidence Link |
|----------|----------|--------|---------------|---------------|
| POL-PR-01 (DEC-001) | HR/Finance | ⚠️ Claimed | 2026-11-18 | BUSINESS_POLICY_DECISION_REGISTER.md |
| POL-PR-02 (DEC-002) | Finance | ⚠️ Claimed | 2026-11-18 | BUSINESS_POLICY_DECISION_REGISTER.md |
| POL-LV-01 (DEC-012) | HR | Deferred | 2026-11-18 | BUSINESS_POLICY_DECISION_REGISTER.md |
| POL-AT-01 (DEC-014) | HR | ⚠️ Claimed | 2026-11-18 | BUSINESS_POLICY_DECISION_REGISTER.md |
| POL-LN-02 (DEC-009) | Finance/Legal | ⚠️ Claimed | 2026-11-18 | BUSINESS_POLICY_DECISION_REGISTER.md |
| All others | Various | ❌ Pending | - | - |

---

## 7. Summary

**Total Decisions Requiring Approval: 16 (9 P0 + 7 P1) + 6 Legal Governance = 22 with 6 overlaps = 16 unique**

**Pre Go-Live Blockers (9):** DEC-001 through DEC-009 + LEG-001 through LEG-006 (overlap) = 9 critical decisions
**Sprint 1 Items (7):** DEC-010 through DEC-016
**Total Unique Decisions Requiring Resolution: 16**

**Immediate Action Required:**
1. Schedule decision workshops with Legal, HR, Finance
2. Obtain signed decisions for 9 pre-Go-Live items
3. Document all decisions in this register with signatures
4. Update implementation to match approved decisions

---

**Document Version:** 1.0  
**Date:** 2026-11-19  
**Auditor:** Independent Release Auditor  
**Classification:** CONFIDENTIAL