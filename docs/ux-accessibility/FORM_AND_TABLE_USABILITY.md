# Sana HRMS - Form and Table Usability Audit

**Version:** 1.0  
**Date:** 2026-11-18  
**Auditor:** Senior UX Engineer  
**Classification:** INTERNAL  

---

## 1. Overview

This audit evaluates form usability and table/data presentation across all major screens in Sana HRMS.

---

## 1. Form Usability Audit

### 1.1 Form Inventory

| Form | Page | Fields | Validation | Submission |
|------|------|--------|------------|------------|
| Login | Login.tsx | 2 (user, pass) | Client + Server | POST /auth/login |
| Employee Create | Employees.tsx | 10 | Client + Server | POST /employees |
| Employee Detail | Employees.tsx | 15+ (multi-tab) | Server | PUT /employees/:id |
| Contract Create/Edit | Contracts.tsx | 12 | Server | POST/PUT /contracts |
| Leave Request | Leaves.tsx | 7 | Client + Server | POST /leaves/requests |
| Leave Decision | Leaves.tsx | 1 (decision) | Server | POST /leaves/:id/decide |
| Attendance Correction | Attendance.tsx | 5 | Server | POST /attendance |
| Payroll Period Create | Payroll.tsx | 4 | Server | POST /payroll/periods |
| Payroll Generation | Payroll.tsx | 1 (periodId) | Server | POST /payroll/periods/:id/generate |
| Loan Application | Loans.tsx | 8 | Client + Server | POST /loans |
| Loan Payment | Loans.tsx | 2 (amount, idempotency) | Server | POST /loans/installments/:id/pay |
| Mission Request | Missions.tsx | 10 | Client + Server | POST /missions |
| Mission Decision | Missions.tsx | 1 (decision) | Server | POST /missions/:id/decide |
| Task Create/Edit | Tasks.tsx | 12 | Server | POST/PUT /tasks |
| Project Create/Edit | Projects.tsx | 10 | Server | POST/PUT /projects |
| Document Upload | Documents.tsx | 3 + file | Server | POST /documents |
| User Create/Edit | Users.tsx | 8 | Server | POST/PUT /users |
| Role Create/Edit | Roles.tsx | 5 | Server | POST/PUT /roles |
| Org Unit Create/Edit | Org.tsx | 6 | Server | POST/PUT /org |
| Asset Create/Edit | Assets.tsx | 8 | Server | POST/PUT /assets |
| Training Create/Edit | Training.tsx | 8 | Server | POST/PUT /training |
| Announcement Create | Announcements.tsx | 4 | Server | POST /announcements |
| Settings Forms | Settings.tsx | Various | Server | Various |

---

## 2. Form Usability Evaluation

### 2.1 Form Quality Matrix

| Form | Labels | Validation | Accessibility | UX | Issues |
|------|--------|------------|---------------|----|--------|
| Login | ✅ | ✅ Client+Server | ✅ Labels, ARIA | Good | No strength meter |
| Employee Create | ✅ | ✅ | ✅ | Good | Company required but auto-filled |
| Employee Detail | ✅ | Server | ✅ | Good | Multi-tab, complex |
| Leave Request | ✅ | ✅ | ✅ | Good | Time inputs not validated |
| Attendance Correction | ✅ | Server | ✅ | Good | Modal only |
| Loan Application | ✅ | Server | ✅ | Good | Complex validation |
| Mission Request | ✅ | Server | ✅ | Good | Complex dates |
| Task Create | ✅ | Server | ✅ | Good | Kanban integration |
| Document Upload | ✅ | Server | ✅ | Good | Drag-drop + click |

### 2.2 Form Field Quality

| Aspect | Status | Notes |
|--------|--------|-------|
| Labels | ✅ | All fields have labels |
| Required Indicators | ✅ | Red asterisk `*` |
| Placeholders | ✅ | Descriptive Persian |
| Help Text | ✅ | Contextual hints |
| Error Messages | ✅ | Inline + Toast |
| Required Fields | ✅ | `aria-required` |
| Error Association | ⚠️ | Missing `aria-describedby` on some |
| Placeholders | ✅ | Persian examples |
| Input Types | ✅ | Email, tel, number, date, time |
| Auto-complete | ✅ | Username, password, etc. |

### 2.3 Form Interaction Patterns

| Pattern | Implementation | Consistency |
|---------|----------------|-------------|
| Submit Button | Primary, loading state | ✅ Consistent |
| Cancel Button | Secondary, closes modal | ✅ Consistent |
| Reset/Clear | Not consistent | ⚠️ Inconsistent |
| Dirty Check | Not implemented | ❌ Missing |
| Auto-save | Not implemented | ❌ Missing |
| Optimistic Updates | Implemented | ✅ Good |

---

## 3. Form Accessibility

### 3.1 Form Accessibility Checklist

| Criterion | Status | Notes |
|-----------|--------|-------|
| Labels associated | ✅ | `htmlFor` + `id` |
| Required Indicators | ✅ | Red asterisk `*` |
| Error Announcements | ✅ | `role="alert"` |
| Error Association | ⚠️ | Missing `aria-describedby` on some |
| Focus Management | ✅ | Focus on first error |
| Required Indicators | ✅ | Visual + `aria-required` |
| Invalid State | ✅ | `aria-invalid` |
| Required Fields | ✅ | Visual + `aria-required` |
| Disabled State | ✅ | `disabled` + styling |
| Read-only State | ✅ | `readOnly` + styling |

### 3.2 Form Error Handling

| Pattern | Implementation |
|-----------|----------------|
| Inline Errors | Below field, red text |
| Toast Errors | Top-right, auto-dismiss |
| Field Focus | First error focused |
| Server Errors | Mapped to fields |
| Network Errors | Toast + retry |

---

## 4. Table Usability Audit

### 4.1 DataTable Features

| Feature | Status | Notes |
|---------|--------|-------|
| Sorting | ✅ | Client-side, Persian collator |
| Filtering | ✅ | Column + global search |
| Pagination | ✅ | Page size selector (10,20,50,100,200) |
| Row Actions | ✅ | Buttons with icons |
| Sorting Indicators | ✅ | Visual + ARIA |
| Row Selection | ❌ | Not implemented |
| Bulk Actions | ❌ | Not implemented |
| Column Resize | ❌ | Not implemented |
| Column Visibility | ❌ | Not implemented |
| Export | ⚠️ | CSV via report API |

### 4.2 Table Accessibility

| Feature | Status | Notes |
|---------|--------|-------|
| `scope="col"` | ❌ | Missing on `<th>` |
| `scope="row"` | ❌ | Missing on row headers |
| `aria-sort` | ✅ | On sortable headers |
| `aria-describedby` | ✅ | Column descriptions |
| Keyboard Sort | ✅ | Enter/Space on headers |
| Row Actions | ✅ | Buttons accessible |
| Row Hover | ✅ | Visual feedback |

### 4.3 Table Responsiveness

| Viewport | Behavior | Usability |
|----------|----------|-----------|
| Desktop | Full table | ✅ Good |
| Tablet | Horizontal scroll | ⚠️ Acceptable |
| Mobile | Horizontal scroll | ❌ Poor - actions hidden |

**Critical Issue:** Action buttons (Edit, View, Delete) clipped on mobile

### 4.4 Table Data Quality

| Aspect | Status |
|-------|--------|
| Empty State | ✅ Friendly message + icon |
| Loading State | ✅ Skeleton rows |
| Error State | ✅ Retry button |
| Empty Message | ✅ Persian, contextual |
| Loading Skeletons | ✅ 5 rows |

---

## 4. Specific Table Pages

### 4.1 Employees Table

| Column | Type | Sortable | Filterable |
|---------|------|----------|------------|
| Code | String | ✅ | ✅ |
| Name | String | ✅ | ✅ |
| National ID | String | ✅ | ✅ |
| Position | String | ✅ | ✅ |
| Employment Type | Enum | ✅ | ✅ |
| Hire Date | Date | ✅ | ✅ |
| Status | Enum | ✅ | ✅ |
| Actions | Buttons | - | - |

**Issues:** Mobile horizontal scroll hides actions

### 4.2 Attendance Table

| Column | Type | Sortable |
|---------|------|----------|
| Date | Date | ✅ |
| Employee | String | ✅ |
| Check-in | Time | ✅ |
| Check-out | Time | ✅ |
| Status | Enum | ✅ |
| Overtime | Number | ✅ |
| Actions | Buttons | - |

### 4.3 Leave Requests Table

| Column | Type | Sortable |
|---------|------|----------|
| Employee | String | ✅ |
| Type | Enum | ✅ |
| Start | Date | ✅ |
| End | Date | ✅ |
| Duration | Number | ✅ |
| Reason | Text | ✅ |
| Status | Enum | ✅ |
| Actions | Buttons | - |

### 4.4 Payroll Table

| Column | Type | Sortable |
|---------|------|----------|
| Period | Year/Month | ✅ |
| Employees | Number | ✅ |
| Gross | Currency | ✅ |
| Net | Currency | ✅ |
| Status | Enum | ✅ |
| Actions | Buttons | - |

### 4.5 Loans Table

| Column | Type | Sortable |
|--------|------|----------|
| Employee | String | ✅ |
| Amount | Currency | ✅ |
| Installments | Number | ✅ |
| Status | Enum | ✅ |
| Actions | Buttons | - |

### 4.6 Tasks (Kanban)

| View | Responsiveness |
|-------|----------------|
| Desktop | 4 columns |
| Tablet | Horizontal scroll |
| Mobile | Single column stack |

**Issue:** No keyboard navigation for drag-drop

---

## 4. Table Actions Usability

| Action | Placement | Accessibility | Mobile |
|---------|-----------|---------------|--------|
| View | Eye icon | ✅ Button | Hidden |
| Edit | Pencil icon | ✅ Button | Hidden |
| Delete | Trash icon | ✅ Button | Hidden |
| Approve | Green button | ✅ Button | Hidden |
| Reject | Red button | ✅ Button | Hidden |
| Download | Download icon | ✅ Button | Hidden |

**Critical:** All actions hidden on mobile due to horizontal scroll

---

## 5. Search & Filtering

### 5.1 Global Search

| Feature | Implementation |
|---------|----------------|
| Shortcut | Ctrl+K |
| Modal | Search results by type |
| Debounce | 300ms |
| Results | Categorized |
| Keyboard | Arrow keys, Enter |

### 5.2 Table Toolbar

| Element | Implementation |
|---------|----------------|
| Search | Debounced input |
| Column Filters | Select per column |
| Status Filters | Select dropdown |
| Date Range | DatePicker pair |
| Clear Filters | Button |

---

## 6. Pagination

| Feature | Implementation |
|---------|----------------|
| Page Size | 10, 20, 50, 100, 200 |
| Navigation | Prev/Next, Page numbers |
| Total Count | Displayed |
| Accessibility | ❌ Missing `aria-label` |

---

## 7. Bulk Operations

| Feature | Status |
|---------|--------|
| Row Selection | ❌ Not implemented |
| Bulk Actions | ❌ Not implemented |
| Select All | ❌ Not implemented |

---

## 8. Export

| Format | Implementation |
|--------|----------------|
| CSV | Via report API |
| Excel | Via report API |
| PDF | Not implemented |

---

## 9. Findings Summary

### 8.1 Critical Issues

| ID | Issue | Severity | Pages Affected |
|----|-------|----------|----------------|
| TBL-001 | Mobile action buttons hidden | High | All DataTable pages |
| TBL-002 | Missing `scope` attributes | High | All DataTables |

### 8.2 High Priority

| ID | Issue | Severity | Pages |
|----|-------|----------|-------|
| TBL-003 | No mobile card view | High | All DataTables |
| TBL-004 | Kanban not keyboard accessible | High | Tasks, Projects |
| TBL-005 | Missing `scope="col"` | High | All DataTables |

### 8.3 Medium

| ID | Issue | Severity |
|----|-------|----------|
| TBL-006 | No column resize | Medium |
| TBL-007 | No column visibility | Medium |
| TBL-008 | No row selection | Medium |
| TBL-009 | No bulk actions | Medium |
| TBL-010 | Pagination missing aria-labels | Medium |

### 8.4 Low

| ID | Issue |
|----|-------|
| TBL-011 | No column reorder |
| TBL-012 | No row hover highlight on mobile |
| TBL-013 | Sticky header on horizontal scroll |
| TBL-014 | Column width persistence |

---

## 9. Recommendations

### P0 - Immediate
1. Implement DataTable mobile card view
2. Add `scope="col"` to all `<th>`
2. Fix Kanban keyboard navigation

### P1 - Sprint 1
1. Add column resize
2. Add column visibility toggle
3. Add row selection + bulk actions

### P2 - Sprint 2
1. Add column reorder
2. Add export to Excel/PDF
3. Add sticky columns

---

## 10. Test Cases

| Test | Expected |
|-----|----------|
| Mobile DataTable | Card view, actions accessible |
| Keyboard Sort | Enter/Space on headers |
| Keyboard Pagination | Arrow keys, Enter |
| Screen Reader | Headers announced with scope |
| Zoom 200% | Table usable |
| High Contrast | Visible borders |

---

**Document Version:** 1.0  
**Date:** 2026-11-18  
**Status:** Complete  
**Classification:** INTERNAL