# Sana HRMS - UX Remediation Register

**Version:** 1.0  
**Date:** 2026-11-18  
**Auditor:** Senior UX Engineer  
**Classification:** INTERNAL  

---

## 1. Overview

This register tracks all UX and accessibility defects found during Stage 9 audit, their severity, status, and remediation progress.

---

## 2. Defect Register

### 2.1 Critical Defects (4)

| ID | Title | Component | Severity | Status | Owner | Target |
|-----|-------|-----------|----------|--------|-------|--------|
| UX-001 | DataTable horizontal scroll on mobile hides actions | DataTable.tsx | Critical | 🔴 Open | Frontend | Sprint 1 |
| UX-002 | Modal focus trap incomplete | Modal.tsx | Critical | 🔴 Open | Frontend | Sprint 1 |
| UX-003 | Kanban not keyboard accessible | Tasks, Projects | Critical | 🔴 Open | Frontend | Sprint 1 |
| UX-004 | Light mode contrast failures | tokens.css (light) | Critical | 🔴 Open | Frontend | Sprint 1 |

### 2.2 High Severity (8)

| ID | Title | Component | Severity | Status | Owner | Target |
|----|-------|-----------|----------|--------|-------|--------|
| UX-005 | EmployeePanel tabs overflow on mobile | EmployeePanel.tsx | High | 🔴 Open | Frontend | Sprint 1 |
| UX-006 | Missing `aria-describedby` on form errors | Multiple forms | High | 🔴 Open | Frontend | Sprint 1 |
| UX-007 | ConfirmDialog missing `aria-describedby` | ConfirmDialog.tsx | High | 🔴 Open | Frontend | Sprint 1 |
| UX-008 | DatePicker missing `aria-label` | DatePicker.tsx | High | 🔴 Open | Frontend | Sprint 1 |
| UX-009 | Light mode contrast failures | tokens.css (light) | High | 🔴 Open | Frontend | Sprint 1 |
| UX-010 | Modal focus not always trapped | Modal.tsx | High | 🔴 Open | Frontend | Sprint 1 |
| UX-011 | Table horizontal scroll on mobile | DataTable.tsx | High | 🔴 Open | Frontend | Sprint 1 |
| UX-012 | Kanban drag-only, no keyboard | Tasks, Projects | High | 🔴 Open | Frontend | Sprint 2 |

### 2.3 Medium Severity (8)

| ID | Title | Component | Severity | Status | Owner | Target |
|----|-------|-----------|----------|--------|-------|--------|
| UX-013 | Missing `aria-label` on pagination | Pagination.tsx | Medium | 🟡 Open | Frontend | Sprint 2 |
| UX-014 | Missing `displayName` on components | Multiple | Medium | 🟡 Open | Frontend | Sprint 2 |
| UX-015 | Missing `React.memo` on UI components | base.tsx | Medium | 🟡 Open | Frontend | Sprint 2 |
| UX-016 | Missing dependency arrays in hooks | Multiple hooks | Medium | 🟡 Open | Frontend | Sprint 2 |
| UX-017 | Light mode shadows too light | tokens.css (light) | Medium | 🟡 Open | Frontend | Sprint 2 |
| UX-018 | Kanban cards too narrow on tablet | Tasks, Projects | Medium | 🟡 Open | Frontend | Sprint 2 |
| UX-019 | Header search hidden on mobile | Layout.tsx | Medium | 🟡 Open | Frontend | Sprint 2 |
| UX-020 | DatePicker calendar clipping on mobile | DatePicker.tsx | Medium | 🟡 Open | Frontend | Sprint 2 |

### 2.4 Low Severity (6)

| ID | Title | Component | Severity | Status | Owner | Target |
|----|-------|-----------|----------|--------|-------|--------|
| UX-021 | Missing `aria-label` on pagination | Pagination.tsx | Low | 🟢 Open | Frontend | Sprint 3 |
| UX-022 | Missing `displayName` on components | Multiple | Low | 🟢 Open | Frontend | Sprint 3 |
| UX-022 | Missing `displayName` on components | Multiple | Low | 🟢 Open | Frontend | Sprint 3 |
| UX-023 | Missing `displayName` on hooks | Multiple hooks | Low | 🟢 Open | Frontend | Sprint 3 |
| UX-024 | Missing `displayName` on hooks | Multiple hooks | Low | 🟢 Open | Frontend | Sprint 3 |
| UX-025 | Missing CONTRIBUTING.md | Root | Low | 🟢 Open | Frontend | Sprint 3 |
| UX-026 | Light mode shadows too light | tokens.css (light) | Low | 🟢 Open | Frontend | Sprint 3 |
| UX-027 | Missing skip-link visibility | global.css | Low | 🟢 Open | Frontend | Sprint 3 |

---

## 3. Remediation Tracking

### 3.1 Sprint 1 (Week 1-2) - Critical/High

| ID | Action | Assignee | Started | Completed | Verification |
|----|--------|----------|---------|-----------|--------------|
| UX-001 | Implement DataTable mobile card view | Frontend Lead | - | - | Mobile test |
| UX-002 | Fix Modal focus trap | Frontend Lead | - | - | Keyboard test |
| UX-003 | Add Kanban keyboard navigation | Frontend Lead | - | - | Keyboard test |
| UX-004 | Fix light mode contrast | UI Designer | - | - | axe-core scan |
| UX-005 | Fix EmployeePanel tabs overflow | Frontend | - | - | Mobile test |
| UX-006 | Add `aria-describedby` to form errors | Frontend | - | - | Screen reader test |
| UX-007 | Add `aria-describedby` to ConfirmDialog | Frontend | - | - | Screen reader test |
| UX-008 | Add `aria-label` to DatePicker | Frontend | - | - | Screen reader test |
| UX-009 | Fix light mode contrast | UI Designer | - | - | axe-core scan |
| UX-010 | Fix Modal focus return | Frontend | - | - | Keyboard test |
| UX-011 | Implement DataTable mobile card view | Frontend Lead | - | - | Mobile test |
| UX-012 | Add Kanban keyboard navigation | Frontend Lead | - | - | Keyboard test |

### 3.2 Sprint 2 (Week 3-4) - Medium

| ID | Action | Assignee | Started | Completed | Verification |
|----|--------|----------|---------|-----------|--------------|
| UX-013 | Add `aria-label` to pagination | Frontend | - | - | Screen reader test |
| UX-014 | Add `displayName` to components | Frontend | - | - | DevTools check |
| UX-015 | Add `React.memo` to UI components | Frontend | - | - | Profiler check |
| UX-016 | Add missing dependency arrays | Frontend | - | - | ESLint check |
| UX-017 | Fix light mode shadows | UI Designer | - | - | Visual review |
| UX-018 | Fix Kanban tablet layout | Frontend | - | - | Tablet test |
| UX-019 | Add search icon button mobile | Frontend | - | - | Mobile test |
| UX-020 | Fix DatePicker mobile clipping | Frontend | - | - | Mobile test |

### 3.3 Sprint 3 (Week 5-6) - Low

| ID | Action | Assignee | Started | Completed | Verification |
|----|--------|----------|---------|-----------|--------------|
| UX-021 | Add `aria-label` to pagination | Frontend | - | - | Screen reader test |
| UX-022 | Add `displayName` to components | Frontend | - | - | DevTools check |
| UX-023 | Add `displayName` to hooks | Frontend | - | - | DevTools check |
| UX-024 | Add missing dependency arrays | Frontend | - | - | ESLint check |
| UX-025 | Create CONTRIBUTING.md | Tech Lead | - | - | File exists |
| UX-026 | Fix light mode shadows | UI Designer | - | - | Visual review |
| UX-027 | Add skip-link visibility | Frontend | - | - | Keyboard test |

---

## 3. Remediation Progress Dashboard

```
Overall Progress: ████████░░░░░░░░░░░░░░  30%

Critical:    ████░░░░░░░░░░░░░░░░░░░░░░░  0/4  (0%)
High:        ████░░░░░░░░░░░░░░░░░░░░░░░  0/8  (0%)
Medium:      ████░░░░░░░░░░░░░░░░░░░░░░░  0/8  (0%)
Low:         ██░░░░░░░░░░░░░░░░░░░░░░░░░  0/6  (0%)
```

---

## 4. Verification Checklist

### 4.1 Per-Defect Verification

| ID | Test Method | Pass Criteria |
|----|-------------|---------------|
| UX-001 | Mobile viewport test | Actions visible on 360px |
| UX-002 | Keyboard navigation test | Tab traps in modal |
| UX-003 | Keyboard navigation test | Arrow keys navigate Kanban |
| UX-004 | axe-core scan (light) | 0 contrast violations |
| UX-005 | Mobile viewport test | Tabs accessible |
| UX-006 | Screen reader test | Errors announced |
| UX-007 | Screen reader test | Message announced |
| UX-008 | Screen reader test | DatePicker announced |
| UX-009 | axe-core scan (light) | 0 contrast violations |
| UX-010 | Keyboard test | Focus returns to trigger |
| UX-011 | Mobile viewport test | Card view, actions visible |
| UX-012 | Keyboard test | Arrow keys navigate cards |

---

## 5. Verification Commands

```bash
# Run accessibility audit
npx axe-cli http://localhost:3000 --save --dir ./axe-results

# Run Playwright keyboard tests
npx playwright test --grep="keyboard|focus|keyboard"

# Run mobile viewport tests
npx playwright test --project=mobile-chrome

# Run contrast check
npx axe-cli http://localhost:3000 --tags wcag2aa --save

# Visual regression
npx playwright test --update-snapshots
```

---

## 6. Sign-Off Requirements

| Role | Sign-Off Criteria |
|-------|-------------------|
| UX Lead | All Critical/High verified |
| Accessibility Engineer | axe-core 0 critical/serious |
| Frontend Lead | All tests pass, no regressions |
| Product Owner | UX approved |
| QA Lead | Regression tests pass |

---

**Document Version:** 1.0  
**Date:** 2026-11-18  
**Status:** Active - Remediation in Progress  
**Classification:** INTERNAL