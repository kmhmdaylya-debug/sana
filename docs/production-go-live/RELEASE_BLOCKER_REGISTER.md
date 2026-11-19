# Sana HRMS - Release Blocker Register

**Version:** 1.0  
**Date:** 2026-11-18  
**Auditor:** Principal Software Architect / Release Manager  
**Classification:** INTERNAL  

---

## 1. Executive Summary

This register documents all release blockers identified during Stage 11 initial reconciliation. It serves as the single authoritative source for tracking production go-live readiness.

**Overall Status:** CONDITIONAL GO — Multiple blockers must be resolved before PRODUCTION GO.

---

## 2. Initial Reconciliation Findings

### 2.1 Document Count Discrepancy

| Source | Claimed | Actual | Discrepancy |
|--------|---------|--------|-------------|
| FINAL_PRODUCTION_READINESS_REPORT.md (Phase 11) | 12 documents | 14 documents | +2 documents |

**Actual Documents in `docs/final-production-readiness/`:**
1. BACKUP_RESTORE_VERIFICATION.md
2. BUSINESS_POLICY_DECISION_REGISTER.md
3. CRITICAL_HIGH_REMEDIATION_REPORT.md
4. DATABASE_CONCURRENCY_VALIDATION.md
5. FINAL_ACCESSIBILITY_VALIDATION.md
6. FINAL_DEFECT_RECONCILIATION.md
7. FINAL_PRODUCTION_READINESS_REPORT.md
8. FINAL_SECURITY_REVALIDATION.md
9. FINANCIAL_INTEGRITY_VALIDATION.md
10. FRONTEND_TEST_STABILIZATION.md
11. FULL_REGRESSION_TEST_REPORT.md
12. PRODUCTION_INFRASTRUCTURE_VALIDATION.md
13. PRODUCTION_OPERATIONS_CHECKLIST.md
14. RELEASE_ROLLBACK_PLAN.md

**Resolution:** Update FINAL_PRODUCTION_READINESS_REPORT.md to reflect 14 documents.

---

### 2.2 Defect Statistics Reconciliation

| Source | Critical | High | Medium | Low | Total |
|--------|----------|------|--------|-----|-------|
| FINAL_DEFECT_RECONCILIATION.md | 6 | 22 | 45 | 31 | 104 |
| FINAL_PRODUCTION_READINESS_REPORT.md (Table) | 6 | 22 | 45 | 31 | 104 |
| FINAL_PRODUCTION_READINESS_REPORT.md (Section 8.2) | 4 UX Critical | 8 UX High | — | — | — |
| UX_REMEDIATION_REGISTER.md | 4 Open | 8 Open | 8 Open | 6 Open | 26 Open |
| CRITICAL_HIGH_REMEDIATION_REPORT.md | 6 Fixed | 20 Fixed | — | — | 26 Fixed |

**Critical Discrepancy:** CRITICAL_HIGH_REMEDIATION_REPORT.md claims UX-001 through UX-012 are FIXED, but UX_REMEDIATION_REGISTER.md and code inspection show all 12 as OPEN.

**Actual Code Verification:**

| Defect ID | Description | Component | Code Status | Evidence |
|-----------|-------------|-----------|-------------|----------|
| UX-001 | DataTable mobile horizontal scroll hides actions | DataTable.tsx | 🔴 OPEN | No mobile card view implemented |
| UX-002 | Modal focus trap incomplete | Modal.tsx | 🔴 OPEN | Focus trap exists but focus return needs verification |
| UX-003 | Kanban not keyboard accessible | Dashboard.tsx, Tasks.tsx, Projects.tsx | 🔴 OPEN | No keyboard navigation (Arrow keys) |
| UX-004 | Light mode contrast failures | tokens.css | 🔴 OPEN | Values don't match claimed fixes |
| UX-005 | EmployeePanel tabs overflow mobile | EmployeePanel.tsx | 🔴 OPEN | Tabs overflow on mobile |
| UX-006 | Missing aria-describedby on errors | Multiple forms | 🔴 OPEN | Field component has aria-describedby but not verified on all forms |
| UX-007 | ConfirmDialog missing aria-describedby | ConfirmDialog (base.tsx) | 🔴 OPEN | No aria-describedby on message |
| UX-008 | DatePicker missing aria-label | DatePicker.tsx | 🔴 OPEN | Toggle button has aria-label but input may lack it |
| UX-009 | Light mode contrast (duplicate) | tokens.css | 🔴 OPEN | Same as UX-004 |
| UX-010 | Modal focus not always trapped | Modal.tsx | 🔴 OPEN | Same as UX-002 |
| UX-011 | Table horizontal scroll mobile | DataTable.tsx | 🔴 OPEN | Same as UX-001 |
| UX-012 | Kanban drag-only, no keyboard | Tasks.tsx, Projects.tsx | 🔴 OPEN | Same as UX-003 |

**Security Critical Defects (3 Deferred):**
| ID | Description | Status | Reason |
|----|-------------|--------|--------|
| SEC-CRIT-01 | picomatch ReDoS | Deferred | Requires @nestjs/cli upgrade (breaking) |
| SEC-CRIT-02 | minimatch DoS | Deferred | Requires @typescript-eslint upgrade |
| SEC-CRIT-03 | glob AbortSignal bypass | Deferred | Requires @nestjs/cli upgrade |

**Resolution:** CRITICAL_HIGH_REMEDIATION_REPORT.md must be corrected. Actual status: 0/4 Critical UX fixed, 0/8 High UX fixed.

---

### 2.3 Business Policy Decisions Reconciliation

| Source | P0 (Immediate) | P1 (High) | P2 (Medium) | P3 (Low) | Total Requiring Decision |
|--------|----------------|-----------|-------------|----------|--------------------------|
| BUSINESS_POLICY_DECISION_REGISTER.md | 9 | 7 | 9 | 16 | 41 total, 12 unresolved |
| UNRESOLVED_BUSINESS_POLICY_DECISIONS.md | 9 | 3 | 9 | 17 | 12 requires decision |
| FINAL_PRODUCTION_READINESS_REPORT.md (8.2) | 5 P0 | 3 P1 | — | — | 8 mentioned |

**Approved Decisions Log (from BUSINESS_POLICY_DECISION_REGISTER.md):**
| Policy ID | Decision | Date | Approved By | Status |
|-----------|----------|------|-------------|--------|
| POL-PR-01 | Overtime base = base + fixed allowances | 2026-11-18 | HR/Finance | Implemented |
| POL-PR-02 | Insurance on gross earnings | 2026-11-18 | Finance | Implemented |
| POL-LV-01 | Half-day leave deferred | 2026-11-18 | HR | Deferred |
| POL-AT-01 | 4-hour shift match window | 2026-11-18 | HR | Implemented |
| POL-LN-02 | Interest rate = 0% (Islamic banking) | 2026-11-18 | Finance/Legal | Implemented |

**Remaining Unresolved (12 items requiring explicit stakeholder approval):**

| Priority | Policy ID | Decision Required | Status | Blocker |
|----------|-----------|-------------------|--------|---------|
| P0 | POL-PR-01 | Overtime calculation base | ⚠️ Claimed implemented | Need verification |
| P0 | POL-PR-02 | Insurance calculation base | ⚠️ Claimed implemented | Need verification |
| P0 | POL-TM-01 | Severance pay calculation | Pending | Legal/HR |
| P0 | POL-TM-02 | Unused leave encashment | Pending | Legal/HR |
| P0 | POL-TM-03 | Notice period enforcement | Pending | Legal/HR |
| P0 | POL-BN-01 | Social insurance rates | Pending | Finance/Legal |
| P0 | POL-BN-02 | Health insurance coverage | Pending | HR/Finance |
| P0 | POL-BN-03 | Retirement/pension | Pending | HR/Legal |
| P0 | POL-LN-02 | Interest rate policy | ⚠️ Claimed implemented | Need verification |
| P1 | POL-PR-03 | Proration method | Pending | HR |
| P1 | POL-PR-04 | Payroll period lock finality | Pending | Finance |
| P1 | POL-LV-01 | Half-day leave support | Deferred | HR |
| P1 | POL-LV-04 | Maternity/paternity leave | Pending | HR/Legal |
| P1 | POL-AT-01 | Grace period for late arrival | ⚠️ Claimed implemented | Need verification |
| P1 | POL-LN-01 | Max loan-to-salary ratio | Pending | Finance |
| P1 | POL-LN-03 | Advance vs loan distinction | Pending | Finance |

**Discrepancy:** BUSINESS_POLICY_DECISION_REGISTER.md lists 9 P0 items but FINAL_PRODUCTION_READINESS_REPORT.md mentions only 5 P0. UNRESOLVED_BUSINESS_POLICY_DECISIONS.md says 12 total require decisions.

**Resolution:** All 12 unresolved items must have formal decision documents with stakeholder approval before PRODUCTION GO.

---

### 2.4 Test Results Reconciliation

| Source | Claim | Actual Status |
|--------|-------|---------------|
| FINAL_PRODUCTION_READINESS_REPORT.md (6.1) | "162/162 test result" | ❌ Unsupported |
| FINAL_PRODUCTION_READINESS_REPORT.md (6.1) | Frontend: 33 pass, 0 fail | ⚠️ Need verification |
| FINAL_PRODUCTION_READINESS_REPORT.md (6.1) | Backend: 106 passed, 0 failed | ⚠️ Need verification |
| UNIT_TEST_REPORT.md | Tests not fully run; need method alignment | ✅ Accurate |
| E2E_TEST_REPORT.md | "در حال پیاده‌سازی" (in implementation) | ✅ Accurate |
| FRONTEND_TEST_STABILIZATION.md | 3 pre-existing unrelated failures | ⚠️ Need verification |

**Actual Test Commands Available:**
- Backend: `npm test` (Jest) — 42 spec files, many need API alignment
- Frontend: `npm test` (custom node --test scripts) — Not standard Jest/Playwright
- E2E: Playwright configured but no tests implemented
- TypeScript: `npx tsc --noEmit` — 0 errors (verified in reports)

**Resolution:** No "162/162" test suite exists. Full regression must be executed and documented.

---

### 2.5 RPO/RTO Status Reconciliation

| Source | RPO | RTO | Status |
|--------|-----|-----|--------|
| DISASTER_RECOVERY_PLAN.md | ≤ 24 hours | ≤ 4 hours | Proposed targets |
| DATABASE_BACKUP_GUIDE.md | ≤ 24 hours | ≤ 4 hours | Proposed targets |
| FINAL_PRODUCTION_READINESS_REPORT.md | 24 hours | ~1.5 hours | Measured results |
| MONITORING_AND_ALERTING.md (BackupTooOld alert) | > 36 hours warning | — | Alert threshold |

**Critical Finding:** RPO 24 hours and RTO 1.5 hours are **measured results from testing**, not formally approved business requirements. No stakeholder sign-off documented.

**Resolution:** Formal business approval required for RPO/RTO targets before PRODUCTION GO.

---

### 2.6 Monitoring & Alerting Deployment Status

| Component | Document Status | Deployment Status |
|-----------|-----------------|-------------------|
| Prometheus | Designed in MONITORING_AND_ALERTING.md | ❌ Not deployed |
| Grafana | Designed in MONITORING_AND_ALERTING.md | ❌ Not deployed |
| Loki | Designed in MONITORING_AND_ALERTING.md | ❌ Not deployed |
| Tempo | Designed in MONITORING_AND_ALERTING.md | ❌ Not deployed |
| Alertmanager | Designed in MONITORING_AND_ALERTING.md | ❌ Not deployed |
| Health Checks | Implemented in backend | ⚠️ Need verification |
| Business Metrics | Defined in metrics.ts | ⚠️ Need verification |

**Resolution:** Monitoring stack must be deployed and validated with at least one controlled alert test.

---

### 2.7 Disaster Recovery Drill Status

| Test Type | Scheduled | Executed | Evidence |
|-----------|-----------|----------|----------|
| Automated Backup/Restore (CI) | Every PR | ❌ No evidence | — |
| Staging Rehearsal | Weekly | ❌ No evidence | — |
| Tabletop Exercise | Monthly | ❌ No evidence | — |
| Full DR Drill | Quarterly | ❌ No evidence | — |
| Backup Integrity | Daily | ❌ No evidence | — |

**Resolution:** Controlled DR drill must be executed in isolated environment with documented results.

---

## 3. Authoritative Release Blocker Register

### 3.1 Critical Blockers (Must resolve for PRODUCTION GO)

| Blocker ID | Category | Description | Current Status | Required Action | Owner | Target |
|------------|----------|-------------|----------------|-----------------|-------|--------|
| RB-001 | UX Critical | DataTable mobile card view not implemented | 🔴 OPEN | Implement card view for mobile < 768px | Frontend Lead | Sprint 1 |
| RB-002 | UX Critical | Modal focus trap incomplete / focus return | 🔴 OPEN | Verify and fix focus management | Frontend Lead | Sprint 1 |
| RB-003 | UX Critical | Kanban (Dashboard, Tasks, Projects) not keyboard accessible | 🔴 OPEN | Add Arrow key navigation, ARIA roles | Frontend Lead | Sprint 1 |
| RB-004 | UX Critical | Light mode contrast failures (4 color pairs) | 🔴 OPEN | Fix tokens.css light mode values | UI Designer | Sprint 1 |
| RB-005 | Business Policy | 12 unresolved policy decisions lack stakeholder approval | 🔴 OPEN | Prepare decision docs, obtain approvals | PO/Legal/HR/Finance | Sprint 1-3 |
| RB-006 | Testing | No executed full regression test suite | 🔴 OPEN | Run all tests, document results | QA Lead | Pre-Go-Live |
| RB-007 | Monitoring | Monitoring stack not deployed | 🔴 OPEN | Deploy Prometheus/Grafana/Alertmanager/Loki | DevOps | Sprint 1 |
| RB-008 | DR | Disaster recovery drill not executed | 🔴 OPEN | Execute controlled DR drill | DevOps/DBA | Pre-Go-Live |
| RB-009 | RPO/RTO | RPO/RTO not formally approved by business | 🔴 OPEN | Obtain stakeholder sign-off | PO/CTO | Sprint 1 |

### 3.2 High Blockers (Must resolve for PRODUCTION GO)

| Blocker ID | Category | Description | Current Status | Required Action | Owner | Target |
|------------|----------|-------------|----------------|-----------------|-------|--------|
| RB-010 | UX High | EmployeePanel tabs overflow on mobile | 🔴 OPEN | Add horizontal scroll or dropdown | Frontend | Sprint 1 |
| RB-011 | UX High | Form errors missing aria-describedby | 🔴 OPEN | Verify Field component propagation | Frontend | Sprint 1 |
| RB-012 | UX High | ConfirmDialog missing aria-describedby | 🔴 OPEN | Add aria-describedby to message | Frontend | Sprint 1 |
| RB-013 | UX High | DatePicker missing aria-label on input | 🔴 OPEN | Add aria-label to date input | Frontend | Sprint 1 |
| RB-014 | UX High | Modal focus not always trapped | 🔴 OPEN | Same as RB-002 | Frontend | Sprint 1 |
| RB-015 | UX High | DataTable mobile horizontal scroll | 🔴 OPEN | Same as RB-001 | Frontend | Sprint 1 |
| RB-016 | UX High | Kanban drag-only, no keyboard | 🔴 OPEN | Same as RB-003 | Frontend | Sprint 2 |
| RB-017 | Security | 3 Critical build-time CVEs deferred | 🟡 DEFERRED | Document risk acceptance | Security | Next Sprint |

### 3.3 Medium Blockers (Should resolve or formally accept)

| Blocker ID | Category | Description | Current Status | Required Action | Owner | Target |
|------------|----------|-------------|----------------|-----------------|-------|--------|
| RB-018 | UX Medium | Missing aria-label on pagination | 🟡 OPEN | Add aria-label | Frontend | Sprint 2 |
| RB-019 | UX Medium | Missing displayName on components | 🟡 OPEN | Add displayName | Frontend | Sprint 2 |
| RB-020 | UX Medium | Missing React.memo on UI components | 🟡 OPEN | Add React.memo | Frontend | Sprint 2 |
| RB-021 | UX Medium | Missing dependency arrays in hooks | 🟡 OPEN | Add dep arrays | Frontend | Sprint 2 |
| RB-022 | UX Medium | Light mode shadows too light | 🟡 OPEN | Adjust shadow tokens | UI Designer | Sprint 2 |
| RB-023 | UX Medium | Kanban cards too narrow on tablet | 🟡 OPEN | Adjust responsive layout | Frontend | Sprint 2 |
| RB-024 | UX Medium | Header search hidden on mobile | 🟡 OPEN | Add search icon button | Frontend | Sprint 2 |
| RB-025 | UX Medium | DatePicker calendar clipping on mobile | 🟡 OPEN | Fix mobile layout | Frontend | Sprint 2 |
| RB-026 | Integration | Benefit deductions missing from payroll | 🟡 DOCUMENTED | Requires payroll pipeline update | Backend | Sprint 3 |
| RB-027 | Integration | Advance workflow not separated | 🟡 DOCUMENTED | Requires separate entity | Backend | Sprint 3 |
| RB-028 | Integration | Optimistic concurrency not universal | 🟡 DOCUMENTED | Add version fields | Backend | Sprint 3 |
| RB-029 | Integration | Leave request not uniquely constrained | 🟡 DOCUMENTED | Add unique constraint | Backend | Sprint 3 |
| RB-030 | Integration | Payslip recalculation not audited | 🟡 DOCUMENTED | Add audit entries | Backend | Sprint 3 |

---

## 4. Go/No-Go Gate Status

| Gate | Requirement | Status | Evidence Required |
|------|-------------|--------|-------------------|
| G1 | Zero open Critical defects | ❌ FAIL | 4 Critical UX open |
| G2 | Zero open High defects | ❌ FAIL | 8 High UX open |
| G3 | Release-blocking Medium resolved/accepted | ❌ FAIL | 13 Medium open |
| G4 | All mandatory business policies approved | ❌ FAIL | 12 unresolved |
| G5 | Full regression tests passing | ❌ FAIL | Not executed |
| G6 | Production release candidate validated in staging | ❌ FAIL | Not deployed |
| G7 | Monitoring and alerting deployed and verified | ❌ FAIL | Not deployed |
| G8 | Disaster recovery drill completed successfully | ❌ FAIL | Not executed |
| G9 | RPO/RTO formally accepted | ❌ FAIL | No sign-off |
| G10 | Rollback procedure reviewed and executable | ⚠️ PARTIAL | Documented, not tested |

---

## 5. Final Recommendation

**CURRENT VERDICT: NO-GO FOR PRODUCTION**

**Rationale:** 9 Critical blockers (G1, G2, G4, G5, G6, G7, G8, G9) and 8 High blockers remain unresolved. The Stage 10 CONDITIONAL GO was based on incorrect defect status reporting.

**Path to CONDITIONAL GO:**
1. Sprint 1 (2 weeks): Resolve RB-001 through RB-004, RB-010 through RB-015 (12 UX Critical/High)
2. Sprint 1-3: Resolve RB-005 (12 policy decisions) with stakeholder approvals
3. Sprint 1: Resolve RB-007 (monitoring deployment + alert test)
4. Pre-Go-Live: Resolve RB-006 (full regression), RB-008 (DR drill), RB-009 (RPO/RTO approval)

**Estimated Timeline to PRODUCTION GO: 6-8 weeks** with current team velocity.

---

## 6. Sign-Off

| Role | Name | Signature | Date | Decision |
|------|------|-----------|------|----------|
| Principal Architect | | | 2026-11-18 | ❌ NO-GO |
| Technical Lead | | | | ⬜ Pending |
| QA Lead | | | | ⬜ Pending |
| DevOps Lead | | | | ⬜ Pending |
| Security Engineer | | | | ⬜ Pending |
| Product Owner | | | | ⬜ Pending |
| Engineering Lead | | | | ⬜ Pending |

---

**Document Version:** 1.0  
**Date:** 2026-11-18  
**Status:** Active — Reconciliation Complete  
**Classification:** INTERNAL