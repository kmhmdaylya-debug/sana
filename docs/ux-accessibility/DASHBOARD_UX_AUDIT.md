# Sana HRMS - Dashboard UX Audit

**Version:** 1.0  
**Date:** 2026-11-18  
**Auditor:** Senior UX Engineer  
**Classification:** INTERNAL  

---

## 1. Overview

This audit evaluates the dashboard user experience for both Personal Dashboard (employees) and Management Dashboard (managers/HR).

---

## 1. Dashboard Variants

| Dashboard | Route | Audience | Purpose |
|-----------|-------|----------|---------|
| Personal | `/` (redirect to `/panel`) | Employee | Self-service summary |
| Management | `/` | Manager/HR | Organizational overview |

---

## 2. Personal Dashboard (EmployeePanel)

### 1.1 Layout Structure

| Section | Component | Content |
|---------|-----------|---------|
| Top Bar | EmployeePanelNav | Date, time, status, presence button |
| Tab Nav | 6 tabs | My Tasks, Projects, Leaves, Missions, Payroll, Profile |
| Tab Content | Dynamic | Tab-specific content |

### 2.1 Tab Details

| Tab | Component | Content | Status |
|-----|-----------|---------|--------|
| My Tasks | EmployeeTaskList | Kanban-style task cards | ✅ Complete |
| Projects | EmployeeProjectsTab | Project cards, progress | ✅ Complete |
| Leaves | EmployeeLeavesTab | Leave requests, balance | ✅ Complete |
| Missions | EmployeeMissionsTab | Mission requests, status | ✅ Complete |
| Payroll | EmployeePayrollTab | Payslips, history | ✅ Complete |
| Profile | EmployeeProfileTab | Personal info, settings | ✅ Complete |

### 2.2 Employee Task List

| Feature | Status |
|---------|--------|
| Task Cards | ✅ Kanban-style cards |
| Status Badges | ✅ Color-coded |
| Due Dates | ✅ With countdown |
| Categories | ✅ Color-coded tags |
| Assignees | ✅ Avatars |
| Actions | ✅ Complete, Dismiss, View |
| Empty State | ✅ Friendly message |
| Loading | ✅ Skeleton |
| Error | ✅ Toast + retry |

### 2.2 Employee Task Card

| Element | Status |
|---------|--------|
| Title | ✅ Truncated |
| Description | ✅ Expandable |
| Due Date | ✅ With countdown |
| Category | ✅ Color tag |
| Priority | ✅ Border color |
| Assignees | ✅ Avatars |
| Status | ✅ Badge |
| Actions | ✅ Buttons |
| Expandable Details | ✅ `<details>` |

### 2.3 Kanban Board (Tasks Page)

| Feature | Status |
|---------|--------|
| Columns | 4 (New, In Progress, Done, Cancelled) |
| Drag & Drop | ❌ Not implemented |
| Column Counts | ✅ |
| Task Cards | ✅ |
| Filters | ✅ |
| Search | ✅ |
| Empty States | ✅ |

**Critical Issue:** No keyboard navigation for drag-drop

### 2.3 Projects Tab

| Feature | Status |
|---------|--------|
| Project Cards | ✅ |
| Progress Bars | ✅ |
| Stages | ✅ |
| Gantt Link | ✅ |
| Filters | ✅ |

### 2.4 Leaves Tab

| Feature | Status |
|---------|--------|
| Leave Requests | ✅ List + status |
| Balance Card | ✅ |
| New Request | ✅ Modal |
| History | ✅ |

### 2.4 Missions Tab

| Feature | Status |
|---------|--------|
| Mission List | ✅ |
| Status Badges | ✅ |
| New Request | ✅ Modal |

### 2.5 Payroll Tab

| Feature | Status |
|---------|--------|
| Payslip List | ✅ |
| Download | ✅ |
| Net Amount | ✅ Prominent |
| Details Modal | ✅ |

### 2.5 Profile Tab

| Section | Status |
|---------|--------|
| Personal Info | ✅ |
| Contact | ✅ |
| Bank Info | ✅ |
| Emergency Contact | ✅ |
| Change Password | ✅ Modal |

---

## 2. Management Dashboard (Dashboard.tsx)

### 2.1 Layout

| Section | Component | Content |
|---------|-----------|---------|
| Hero Panel | hero-panel | Attendance bars, Gauge, KPIs |
| Summary Cards | StatCard | 4 KPIs |
| Team Presence | TeamPresence | Today's attendance |
| Team Work | TeamWork | Task list with filters |

### 3.1 Hero Panel

| Element | Status |
|---------|--------|
| Attendance Bars (7 days) | ✅ Flex, responsive |
| Gauge Chart | ✅ Canvas, semi-circle |
| KPIs (3) | ✅ Open tasks, Pending, Approvals |
| Links | ✅ Deep links |

**Accessibility:** Gauge missing alt text

### 3.2 Summary Cards

| Card | Metric | Link |
|-----|--------|------|
| Open Tasks | myOpenTasks | /tasks |
| Pending Approvals | totalPending | /approvals |
| Active Leaves | myActiveLeaves | /leaves |
| Pending Swaps | myPendingSwaps | /shifts |

### 3.3 Team Presence

| Feature | Status |
|---------|--------|
| Today's Attendance | ✅ Real-time |
| Summary Counts | ✅ Present/Absent/Leave |
| Inline Edit | ✅ Manager can mark |
| Filter by Branch/Dept | ✅ |

### 3.4 Team Work

| Feature | Status |
|---------|--------|
| Task List | ✅ |
| Filters | Category, State |
| Sorting | ✅ |
| State Badges | ✅ |
| Expandable History | ✅ |
| Presence Sidebar | ✅ |

---

## 2. Dashboard Components

### 2.1 Gauge Chart

| Aspect | Status |
|---------|--------|
| Visual | ✅ Canvas semi-circle |
| Animation | ✅ Stroke dash offset |
| Value Display | ✅ Persian digits |
| Accessibility | ⚠️ No alt text |

### 2.2 Hero Bars

| Feature | Status |
|---------|--------|
| 7-day Bars | ✅ Flex, responsive |
| Labels | ✅ Weekday short |
| Tooltips | ✅ Title attribute |
| Responsive | ✅ Flex-wrap |

### 2.2 Stat Cards

| Feature | Status |
|---------|--------|
| Icon | ✅ Colored background |
| Value | ✅ Persian digits |
| Label | ✅ Muted text |
| Link | ✅ Deep link |
| Hover | ✅ Transform |

### 2.3 Team Presence Table

| Column | Type |
|---------|------|
| Employee | Name + Avatar |
| Status | Badge (Present/Absent/Leave) |
| Check-in | Time |
| Check-out | Time |
| Actions | Edit button |

### 2.4 Team Work List

| Feature | Status |
|---------|--------|
| Task Cards | ✅ |
| State Badges | ✅ |
| Progress | ✅ |
| Expandable | ✅ Details |
| Comments Count | ✅ |
| Assignees | ✅ Avatars |
| Due Dates | ✅ With countdown |

---

## 3. Visual Design

### 3.1 Color Coding

| Status | Color | Usage |
|---------|-------|-------|
| New | Blue | Task, Leave |
| In Progress | Blue | Task |
| Done | Green | Task, Leave |
| Cancelled | Gray | Task, Leave |
| Blocked | Amber | Task |
| Overdue | Red | Task, Leave |
| Pending | Amber | Approvals |

### 3.2 Typography

| Element | Size | Weight |
|---------|------|--------|
| Page Title | 18px | 700 |
| Card Title | 15px | 600 |
| Body Text | 13px | 400 |
| Labels | 12px | 600 |
| Values | 18-32px | 700-800 |
| Labels | 12px | 400 |

---

## 3. Responsive Behavior

| Component | Desktop | Tablet | Mobile |
|-----------|---------|--------|--------|
| Hero Panel | Flex row | Wrap | Stack |
| Stat Grid | 4-col | 2-col | 1-col |
| Kanban | 4-col | Scroll | 1-col |
| Team Presence | Table | Table | Card |
| Team Work | Grid | List | List |

---

## 3. Loading & Empty States

| State | Implementation |
|-------|----------------|
| Page Load | Skeleton cards |
| Data Loading | Spinner + skeleton |
| Empty Data | Friendly illustration + message |
| Error | Toast + retry button |
| No Data | Friendly message + action |

---

## 4. Accessibility

| Component | Status | Issues |
|-----------|--------|--------|
| Hero Panel | ⚠️ | Gauge missing alt text |
| Stat Cards | ✅ | ARIA labels |
| Kanban | ⚠️ | Drag-drop only |
| Gauge | ⚠️ | No alt text |
| Tables | ⚠️ | Missing scope |
| Charts | ⚠️ | No text alternative |

---

## 4. Data Accuracy

| Metric | Verified |
|---------|----------|
| Task Counts | ✅ API sync |
| Leave Balances | ✅ Real-time |
| Attendance Rate | ✅ Calculated |
| Payroll Totals | ✅ Verified |
| Task Progress | ✅ Calculated |

---

## 5. User Feedback

| Interaction | Feedback |
|-------------|----------|
| Task Complete | Toast success |
| Task Dismiss | Toast info |
| Filter Change | Instant |
| Tab Switch | Instant |
| Link Click | Navigation |

---

## 5. Recommendations

### High Priority
1. Add alt text to Gauge chart
2. Add alt text to Hero bars
3. Make Kanban keyboard navigable
3. Add `aria-labels` to charts

### Medium Priority
1. Add text alternatives for charts
2. Improve loading skeletons
2. Add chart data tables
2. Improve empty states with actions

### Low Priority
1. Add chart export
2. Add data table view for charts
2. Add keyboard shortcuts help

---

**Document Version:** 1.0  
**Date:** 2026-11-18  
**Status:** Complete  
**Classification:** INTERNAL