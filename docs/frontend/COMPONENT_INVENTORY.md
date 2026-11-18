# Sana HRMS - Component Inventory

**Version:** 1.0  
**Date:** 2026-11-18  
**Audience:** Frontend Developers, UI/UX Engineers

---

## 1. Component Inventory Overview

This document provides a comprehensive inventory of all frontend components in the Sana HRMS project, including their purpose, props, state, effects, and relationships.

### 1.1 Summary Statistics

| Category | Count | Total Lines | With State | With Effects | With API Calls |
|----------|-------|-------------|------------|--------------|----------------|
| Pages | 31 | ~6,500 | 31 | 28 | 28 |
| Feature Components | 17 | ~1,200 | 12 | 8 | 8 |
| UI Components | 5 | ~462 | 2 | 1 | 1 |
| Custom Hooks | 2 | ~208 | 0 | 2 | 2 |
| Utility Libraries | 10 | ~1,050 | 0 | 0 | 3 |
| **Total** | **65** | **~9,420** | **45** | **39** | **42** |

---

## 2. Pages (31 total)

### 2.1 Authentication & Entry

| File | Lines | Purpose | Route | Key Dependencies |
|------|-------|---------|-------|------------------|
| `Login.tsx` | 88 | User authentication with username/password, remember me, password visibility toggle, theme switch | `/login` | `useAuth`, `api`, `useToast`, `theme` |

### 2.2 Dashboard & Overview

| File | Lines | Purpose | Route | Key Dependencies |
|------|-------|---------|-------|------------------|
| `Dashboard.tsx` | 338 | Main dashboard - personal view (tasks, leaves, attendance) and management view (team stats, kanban) | `/` | `useAuth`, `api`, `useList`, `TeamPresence`, `TeamWork`, `TaskCountdown`, `TaskStatusMark`, `WorkCategory`, `format` |

### 2.3 Human Resources

| File | Lines | Purpose | Route | Key Dependencies |
|------|-------|---------|-------|------------------|
| `Employees.tsx` | 399 | Employee CRUD with search, filter, pagination, create modal, detail modal with tabs | `/employees`, `/employees/:employeeId` | `useAuth`, `api`, `useList`, `useItem`, `format`, `EntityPicker`, `DatePicker` |
| `Contracts.tsx` | ~250 | Contract management with versions, status tracking | `/contracts` | `useAuth`, `api`, `useList`, `format`, `EntityPicker`, `DatePicker` |
| `Documents.tsx` | ~200 | Document upload, categorization, expiration tracking | `/documents` | `useAuth`, `api`, `useList`, `format`, `EntityPicker`, `DatePicker`, file upload |
| `Attendance.tsx` | ~200 | Daily attendance records, corrections, reports | `/attendance` | `useAuth`, `api`, `useList`, `format`, `DatePicker` |
| `Shifts.tsx` | ~180 | Shift definitions, assignments, patterns | `/shifts` | `useAuth`, `api`, `useList`, `format`, `EntityPicker` |
| `Leaves.tsx` | 210 | Leave requests, balances, approval workflow | `/leaves` | `useAuth`, `api`, `useList`, `format`, `EntityPicker`, `DatePicker`, `leavePayload` |
| `Missions.tsx` | ~200 | Mission/travel requests, approvals, expenses | `/missions` | `useAuth`, `api`, `useList`, `format`, `EntityPicker`, `DatePicker`, `missionPayload` |
| `Payroll.tsx` | ~250 | Payroll periods, calculations, payslips, locking | `/payroll` | `useAuth`, `api`, `useList`, `format`, `EntityPicker`, `DatePicker` |
| `Evaluations.tsx` | ~180 | Performance evaluations, criteria, cycles | `/evaluations` | `useAuth`, `api`, `useList`, `format`, `EntityPicker` |
| `Recruitment.tsx` | ~180 | Applicant tracking, pipeline, interviews | `/recruitment` | `useAuth`, `api`, `useList`, `format`, `EntityPicker` |
| `Lifecycle.tsx` | ~180 | Onboarding, offboarding, promotions, transfers | `/lifecycle` | `useAuth`, `api`, `useList`, `format`, `EntityPicker` |
| `Training.tsx` | ~180 | Training programs, certificates, compliance | `/training` | `useAuth`, `api`, `useList`, `format`, `EntityPicker` |
| `Loans.tsx` | ~180 | Loan requests, approvals, repayment tracking | `/loans` | `useAuth`, `api`, `useList`, `format`, `EntityPicker` |
| `Assets.tsx` | ~180 | Asset inventory, assignments, maintenance | `/assets` | `useAuth`, `api`, `useList`, `format`, `EntityPicker` |

### 2.4 Collaboration & Work

| File | Lines | Purpose | Route | Key Dependencies |
|------|-------|---------|-------|------------------|
| `Tasks.tsx` | 220 | Task management with kanban, assignments, SLA, retry | `/tasks` | `useAuth`, `api`, `useList`, `format`, `EntityPicker`, `DatePicker`, `WorkCategory`, `TaskRetryReview` |
| `Projects.tsx` | ~200 | Project management with Gantt, phases, progress | `/projects` | `useAuth`, `api`, `useList`, `format`, `EntityPicker`, `DatePicker`, `WorkCategory` |
| `Approvals.tsx` | ~200 | Unified approval inbox for all request types | `/approvals` | `useAuth`, `api`, `useList`, `format` |
| `EmployeePanel.tsx` | 809 | Employee self-service portal (tasks, projects, leaves, missions, payroll, profile) | `/panel` | `useAuth`, `api`, `useList`, `format`, `DatePicker`, `TaskCountdown`, `TaskStatusMark`, `WorkCategory`, `TaskRetryReview` |

### 2.5 Administration & System

| File | Lines | Purpose | Route | Key Dependencies |
|------|-------|---------|-------|------------------|
| `Admin.tsx` | ~180 | Correspondence, meetings, administrative tasks | `/admin` | `useAuth`, `api`, `useList`, `format` |
| `Announcements.tsx` | ~150 | Organization-wide announcements | `/announcements` | `useAuth`, `api`, `useList`, `format` |
| `Notifications.tsx` | ~150 | Personal notification center | `/notifications` | `useAuth`, `api`, `useList`, `format` |
| `Reports.tsx` | ~200 | Report builder, scheduling, exports | `/reports` | `useAuth`, `api`, `useList`, `format`, `downloadReport` |
| `Users.tsx` | ~200 | User management, roles, permissions | `/users` | `useAuth`, `api`, `useList`, `format` |
| `Roles.tsx` | ~180 | Role definitions, permission matrices | `/roles` | `useAuth`, `api`, `useList`, `format` |
| `Org.tsx` | ~180 | Organization structure, units, companies | `/org` | `useAuth`, `api`, `useList`, `format` |
| `Audit.tsx` | ~150 | Audit log viewer with filters | `/audit` | `useAuth`, `api`, `useList`, `format` |
| `Settings.tsx` | ~180 | System settings, preferences | `/settings` | `useAuth`, `api`, `useList`, `format` |
| `Backup.tsx` | ~150 | Database backup management | `/backup` | `useAuth`, `api`, `useList`, `format` |
| `NotFound.tsx` | ~50 | 404 page with friendly message | `*` | None |

---

## 3. Feature Components (17 total)

### 3.1 Authentication & Security

| File | Lines | Purpose | Props | State | Effects | Used In |
|------|-------|---------|-------|-------|---------|---------|
| `ChangePassword.tsx` | 132 | Password change modal with strength meter | None | Form (current, new, confirm), strength | API call on submit | Layout header |

### 3.2 Organization & Selection

| File | Lines | Purpose | Props | State | Effects | Used In |
|------|-------|---------|-------|-------|---------|---------|
| `CompanyPicker.tsx` | ~80 | Company selection for multi-company forms | `value`, `onValueChange`, `disabled` | Selection | None | Task forms, Employee forms |
| `EntityPicker.tsx` | 30 | Generic entity search/selection modal | `value`, `onValueChange`, `endpoint`, `title` | Open, selected, search | API search via `useList` | All forms needing entity selection |

### 3.3 Attendance & Time

| File | Lines | Purpose | Props | State | Effects | Used In |
|------|-------|---------|-------|-------|---------|---------|
| `DailyAttendance.tsx` | 17 | Real-time Tehran clock with Jalali date | None | Timer (1s interval) | Timer cleanup | Layout header, EmployeePanel |
| `TaskCountdown.tsx` | 23 | Task deadline countdown with urgency/expired states | `dueDate`, `status` | Shared clock via `useDeadlineClock` | Clock subscription | Dashboard, Tasks, EmployeePanel, TeamWork |

### 3.4 Task & Work Management

| File | Lines | Purpose | Props | State | Effects | Used In |
|------|-------|---------|-------|-------|---------|---------|
| `TaskRetryReview.tsx` | 44 | Approve/reject task retry requests | `task`, `onReviewed` | Form (reason), saving, rejecting | API calls for review | Dashboard, Tasks, EmployeePanel, TeamWork |
| `TaskStatusMark.tsx` | 8 | Circular status indicator (new, progress, done, blocked, cancelled) | `status`, `blocked` | None | None | All task lists |
| `TeamPresence.tsx` | 77 | Today's team attendance with inline editing | None | Rows, loading, error, editing form | 30s polling + focus refresh | Dashboard, TeamWork, EmployeePanel |
| `TeamWork.tsx` | 157 | Team work overview with filters, assign modal | None | Tasks, filter, category, loading, error | 30s polling + focus refresh | Dashboard |
| `WorkCategory.tsx` | 24 | Colored category tags and picker | `value`, `onChange`, `disabled` | None | None | Dashboard, Tasks, Projects, EmployeePanel |

### 3.5 Search & Navigation

| File | Lines | Purpose | Props | State | Effects | Used In |
|------|-------|---------|-------|-------|---------|---------|
| `GlobalSearch.tsx` | 62 | Global search across users, tasks, documents, projects | `open`, `onClose`, `links` | Query, results, loading, error | Debounced multi-endpoint search | Layout header |
| `PageBoundary.tsx` | 11 | Per-page error boundary wrapper | `children` | Failed state | None | Layout outlet wrapper |

---

## 4. UI Components (5 total)

### 4.1 Base Components (`base.tsx` - 326 lines)

| Component | Props | Purpose |
|-----------|-------|---------|
| `Button` | `variant`, `size`, `loading`, `disabled`, `children` | Primary, secondary, outline, danger, success buttons |
| `Input` | `className`, `...HTMLInputAttributes` | Text, password, number, email, tel, file inputs |
| `Select` | `className`, `...HTMLSelectAttributes` | Dropdown select with options |
| `Textarea` | `className`, `...HTMLTextareaAttributes` | Multi-line text input |
| `Field` | `label`, `required`, `hint`, `error`, `children` | Form field wrapper with label, error, hint |
| `Card` | `title`, `subtitle`, `actions`, `children`, `className` | Content container with header, body, actions |
| `PageHeader` | `title`, `subtitle`, `actions` | Page title with subtitle and action buttons |
| `Badge` | `kind`, `children` | Status indicator (green, amber, red, blue, sky, violet, gray) |
| `Pagination` | `page`, `totalPages`, `total`, `onChange`, `pageSize`, `onPageSizeChange` | Page navigation with size selector |
| `Tabs` | `children`, `className` | Tab list with keyboard navigation |
| `Modal` | Re-exported from `./Modal` | Modal dialog |
| `ConfirmDialog` | `open`, `title`, `message`, `confirmLabel`, `danger`, `onConfirm`, `onClose`, `loading` | Confirmation modal |
| `ListToolbar` | `search`, `onSearch`, `children` | Search box + filter controls |
| `RequirePermission` | `anyOf`, `children`, `fallback` | Permission-based rendering guard |
| `ToastProvider` / `useToast` | Context + hook | Toast notifications (success, error, warning, info) |

### 4.2 DataTable (`DataTable.tsx` - 50 lines)

| Prop | Type | Purpose |
|------|------|---------|
| `columns` | `Column<T>[]` | Column definitions with key, header, render, width, sortable, sortValue |
| `rows` | `T[]` | Data rows |
| `loading` | `boolean` | Loading skeleton state |
| `error` | `string` | Error message with retry |
| `onRetry` | `() => void` | Retry callback |
| `emptyMessage` | `string` | Empty state message |
| `rowActions` | `(row: T) => ReactNode` | Action buttons per row |
| `rowClassName` | `(row: T) => string` | Conditional row styling |

**Features:** Client-side sorting (Persian-aware), sticky headers, horizontal scroll, loading skeletons, error state, empty state, row actions.

### 4.3 DatePicker (`DatePicker.tsx` - 54 lines)

| Prop | Type | Purpose |
|------|------|---------|
| `value` | `string` | Current value (Jalali or ISO) |
| `onValueChange` | `(value: string) => void` | Change handler |
| `output` | `'iso' \| 'jalali'` | Output format |
| `disabled` | `boolean` | Disable picker |
| `...props` | `InputHTMLAttributes` | Passed to input |

**Features:** Jalali calendar, Persian digits, keyboard navigation (arrows), today button, clear button, RTL layout.

### 4.4 EntityPicker (`EntityPicker.tsx` - 30 lines)

| Prop | Type | Purpose |
|------|------|---------|
| `value` | `string` | Selected entity ID |
| `onValueChange` | `(value: string) => void` | Selection handler |
| `endpoint` | `string` | API endpoint for search |
| `title` | `string` | Modal title |

**Features:** Search with debounce, pagination, manual ID entry, keyboard accessible.

### 4.5 Modal (`Modal.tsx` - 52 lines)

| Prop | Type | Purpose |
|------|------|---------|
| `open` | `boolean` | Visibility |
| `title` | `string` | Dialog title |
| `onClose` | `() => void` | Close handler |
| `children` | `ReactNode` | Dialog content |
| `footer` | `ReactNode` | Footer actions |
| `width` | `number` | Max width in px |

**Features:** Portal rendering, focus trap, Escape to close, backdrop click to close, scroll lock, animation.

---

## 5. Custom Hooks (2 total)

### 5.1 `useDeadlineClock.ts` (45 lines)

```typescript
function useDeadlineClock(active: boolean): number
```

**Purpose:** Shared clock for all countdown timers. Uses `useSyncExternalStore` for concurrent-safe subscriptions. Pauses in background tabs, catches up on focus.

**Returns:** Current timestamp (ms) when active, otherwise static snapshot.

**Used In:** `TaskCountdown.tsx`

### 5.2 `useList.ts` (163 lines)

```typescript
function useList<T>(url: string, baseParams?: Record<string, unknown>): ListReturn<T>
function useItem<T>(url: string | null, deps?: unknown[]): ItemReturn<T>
```

**Purpose:** Standardized data fetching with pagination, search, filters, and abort controller.

**Returns (useList):**
- `rows: T[]`
- `page, totalPages, total, pageSize`
- `search, setSearch`
- `filters, setFilter, clearFilters`
- `loading, error, reload`

**Returns (useItem):**
- `item: T | null`
- `loading, error, reload`

**Used In:** All pages with lists, `EntityPicker`, `TeamPresence`, `TeamWork`, `EmployeePanel`

---

## 6. Utility Libraries (10 total)

| File | Lines | Purpose | Key Exports |
|------|-------|---------|-------------|
| `api.ts` | 133 | Axios client with interceptors, token refresh, error handling | `api`, `setAccessToken`, `createAbortController`, `refreshAccessToken`, `apiErrorMessage`, `downloadFile`, `downloadReport`, `generateReport` |
| `auth.tsx` | 139 | Authentication context, permissions, login/logout | `AuthProvider`, `useAuth`, `AuthUser`, `AuthScope` |
| `format.ts` | 513 | Persian/Jalali formatting, status labels, currency, dates | `formatJalali`, `toPersianDigits`, `parseDateInput`, `toJalali`, `toGregorian`, `formatNumber`, `formatRial`, `formatToman`, `formatMinutes`, `formatPercent`, `statusLabel`, `badgeKind`, all label maps |
| `deadline.ts` | 46 | Task deadline calculations (Tehran midnight) | `taskDeadlineAt`, `taskCountdown`, `COUNTDOWN_WINDOW_MS` |
| `search.ts` | 6 | Search normalization (Arabic/Persian letters) | `normalizeSearch`, `matchesDocument` |
| `documentSearch.ts` | 22 | Client-side document search (server doesn't support search) | `searchDocuments` |
| `theme.ts` | 11 | Theme persistence (localStorage) | `readTheme`, `applyTheme`, `Theme` |
| `org.ts` | 11 | Organization utilities | `getDefaultCompanyId` |
| `workCategories.ts` | 17 | Work category definitions | `WORK_CATEGORIES`, `getWorkCategory`, `categoryStyle`, `categoryColor` |
| `workflowPayloads.ts` | 53 | Form payload builders with validation | `tehranDateTime`, `attendanceCorrectionPayload`, `missionPayload`, `leavePayload`, `missionCompletionPayload`, `assetPayload` |

---

## 7. Component Relationships

### 7.1 Dependency Graph (Simplified)

```
App.tsx
├── ErrorBoundary
│   └── Layout.tsx
│       ├── Sidebar (Menu, Permissions)
│       ├── Header (Search, Notifications, Theme, Profile, DailyAttendance)
│       ├── GlobalSearch (Modal)
│       ├── ChangePassword (Modal)
│       ├── PageBoundary
│       │   └── Outlet (Pages)
│       │       ├── Login.tsx
│       │       ├── Dashboard.tsx
│       │       │   ├── TeamPresence
│       │       │   ├── TeamWork
│       │       │   ├── TaskCountdown
│       │       │   ├── TaskStatusMark
│       │       │   └── WorkCategoryTag
│       │       ├── Employees.tsx
│       │       │   ├── EmployeeDetail (Modal with Tabs)
│       │       │   └── CreateEmployee (Modal)
│       │       ├── Tasks.tsx
│       │       │   └── TaskFormModal
│       │       ├── EmployeePanel.tsx
│       │       │   ├── MyTasks
│       │       │   ├── ProjectsTab
│       │       │   ├── LeavesTab
│       │       │   ├── MissionsTab
│       │       │   ├── PayrollTab
│       │       │   └── ProfileTab
│       │       └── ... (27 other pages)
│       └── ToastProvider
```

### 7.2 Shared Component Usage Matrix

| Component | Used In Pages | Used In Components |
|-----------|---------------|-------------------|
| `DataTable` | 28 | `EntityPicker` |
| `DatePicker` | 25 | `EmployeePanel`, `Tasks`, `Leaves` |
| `EntityPicker` | 20 | `Employees`, `Tasks`, `Leaves`, `Missions`, `Payroll` |
| `Modal` | 30 | `ChangePassword`, `EntityPicker`, `GlobalSearch`, `TaskRetryReview` |
| `TaskCountdown` | 5 | `Dashboard`, `Tasks`, `EmployeePanel`, `TeamWork` |
| `TaskStatusMark` | 6 | `Dashboard`, `Tasks`, `EmployeePanel`, `TeamWork` |
| `WorkCategoryTag/Picker` | 8 | `Dashboard`, `Tasks`, `Projects`, `EmployeePanel` |
| `Button` | All | All |
| `Field/Input/Select/Textarea` | All | All |
| `Card` | All | All |
| `PageHeader` | All | All |
| `Badge` | All | All |
| `Pagination` | 25 | `EntityPicker` |
| `Toast` | All | All |
| `RequirePermission` | `App.tsx` (routes) | None |

---

## 8. Component Quality Metrics

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Total Components | 65 | - | ✅ |
| TypeScript Coverage | 100% | 100% | ✅ |
| Components with State | 45 (69%) | - | ⚠️ High |
| Components with Effects | 39 (60%) | - | ⚠️ High |
| Components with API Calls | 42 (65%) | - | ⚠️ High |
| Components > 300 lines | 3 | 0 | ❌ |
| Components > 200 lines | 8 | < 5 | ⚠️ |
| Components with Tests | ~10 | 65 | ❌ |
| Components with JSDoc | ~5 | 65 | ❌ |
| Components with React.memo | ~5 | 20 | ❌ |

---

## 9. Component File Structure

```
frontend/src/
├── App.tsx                          # Root with routing, lazy loading
├── main.tsx                         # Entry point, providers
├── lib/
│   ├── api.ts                       # API client
│   ├── auth.tsx                     # Auth context
│   ├── format.ts                    # Formatting utilities
│   ├── deadline.ts                  # Deadline calculations
│   ├── search.ts                    # Search normalization
│   ├── documentSearch.ts            # Document search
│   ├── theme.ts                     # Theme management
│   ├── org.ts                       # Org utilities
│   ├── workCategories.ts            # Work categories
│   ├── workflowPayloads.ts          # Payload builders
│   ├── useDeadlineClock.ts          # Shared clock hook
│   └── useList.ts                   # List/data fetching hooks
├── layout/
│   └── Layout.tsx                   # Main layout (sidebar, header)
├── pages/                           # 31 page components
│   ├── Login.tsx
│   ├── Dashboard.tsx
│   ├── Employees.tsx
│   ├── Contracts.tsx
│   ├── Documents.tsx
│   ├── Attendance.tsx
│   ├── Shifts.tsx
│   ├── Leaves.tsx
│   ├── Missions.tsx
│   ├── Payroll.tsx
│   ├── Evaluations.tsx
│   ├── Tasks.tsx
│   ├── Projects.tsx
│   ├── EmployeePanel.tsx
│   ├── Assets.tsx
│   ├── Training.tsx
│   ├── Loans.tsx
│   ├── Recruitment.tsx
│   ├── Lifecycle.tsx
│   ├── Admin.tsx
│   ├── Announcements.tsx
│   ├── Notifications.tsx
│   ├── Reports.tsx
│   ├── Users.tsx
│   ├── Roles.tsx
│   ├── Org.tsx
│   ├── Audit.tsx
│   ├── Settings.tsx
│   ├── Backup.tsx
│   └── NotFound.tsx
├── components/
│   ├── ui/
│   │   ├── base.tsx                 # Base UI components
│   │   ├── DataTable.tsx            # Data table
│   │   ├── DatePicker.tsx           # Jalali date picker
│   │   ├── EntityPicker.tsx         # Entity selection
│   │   └── Modal.tsx                # Modal dialog
│   ├── ChangePassword.tsx
│   ├── CompanyPicker.tsx
│   ├── DailyAttendance.tsx
│   ├── ErrorBoundary.tsx
│   ├── GlobalSearch.tsx
│   ├── PageBoundary.tsx
│   ├── TaskCountdown.tsx
│   ├── TaskRetryReview.tsx
│   ├── TaskStatusMark.tsx
│   ├── TeamPresence.tsx
│   ├── TeamWork.tsx
│   ├── WorkCategory.tsx
│   └── ui.tsx                       # Barrel export
└── styles/
    ├── tokens.css                   # Design tokens (dark/light)
    ├── shell.css                    # Layout styles
    ├── controls.css                 # Control styles
    ├── workspace.css                # Page/workspace styles
    ├── motion.css                   # Animations
    └── global.css                   # Global styles
```

---

## 10. Component Evolution Plan

### 10.1 Immediate Splits (Phase 2)

| Current File | Target Components | Estimated New Files |
|--------------|-------------------|---------------------|
| `EmployeePanel.tsx` (809) | `MyTasks`, `ProjectsTab`, `LeavesTab`, `MissionsTab`, `PayrollTab`, `ProfileTab`, `EmployeePanel` (shell) | 7 |
| `Employees.tsx` (399) | `EmployeeList`, `EmployeeCreateModal`, `EmployeeDetailModal`, `Employees` (shell) | 4 |
| `Dashboard.tsx` (338) | `PersonalDashboard`, `ManagementDashboard`, `KanbanBoard`, `Gauge`, `Dashboard` (shell) | 5 |
| `Tasks.tsx` (220) | `TaskList`, `TaskFormModal`, `Tasks` (shell) | 3 |

### 10.2 New Shared Components Needed

| Component | Purpose | Location |
|-----------|---------|----------|
| `Skeleton` | Standardized loading skeletons | `components/ui/Skeleton.tsx` |
| `EmptyState` | Illustrated empty states | `components/ui/EmptyState.tsx` |
| `VirtualizedTable` | Virtualized DataTable | `components/ui/VirtualizedTable.tsx` |
| `ConfirmAction` | Reusable confirm action pattern | `components/ui/ConfirmAction.tsx` |
| `FormField` | Enhanced Field with validation | `components/ui/FormField.tsx` |

---

## 11. Testing Coverage by Component

| Component | Unit Tests | Component Tests | E2E Coverage |
|-----------|------------|-----------------|--------------|
| `format.ts` | ✅ Comprehensive | - | - |
| `deadline.ts` | ✅ Comprehensive | - | - |
| `workCategories.ts` | ✅ Comprehensive | - | - |
| `workflowPayloads.ts` | ✅ Comprehensive | - | - |
| `useDeadlineClock.ts` | ✅ Comprehensive | - | - |
| `search.ts` | ✅ Comprehensive | - | - |
| `TaskCountdown.tsx` | ✅ Render test | - | - |
| `TaskStatusMark.tsx` | ✅ Render test | - | - |
| `TaskRetryReview.tsx` | ✅ Render test | - | - |
| `WorkCategory.tsx` | ✅ Render test | - | - |
| `EntityPicker.tsx` | - | - | Via pages |
| `DataTable.tsx` | ✅ Render test | - | Via pages |
| `Modal.tsx` | - | - | Via pages |
| `DatePicker.tsx` | - | - | Via pages |
| `Button/Input/Select` | - | - | Via pages |
| Pages (31) | - | - | 12 journeys |

---

## 12. Conclusion

The Sana HRMS frontend has a well-organized component architecture with 65 components across pages, features, UI primitives, hooks, and utilities. The codebase demonstrates strong patterns:

**Strengths:**
- Consistent use of custom hooks for data fetching
- Comprehensive Persian/RTL/Jalali support built into components
- Good separation of concerns (pages vs components vs lib)
- Portal-based modals with focus management
- Shared clock for synchronized countdowns

**Areas for Improvement:**
- 3 components exceed 300 lines (EmployeePanel, Employees, Dashboard)
- Limited React.memo/useMemo optimization
- No virtualized lists for large datasets
- Minimal test coverage beyond utility functions
- Missing JSDoc documentation
- Some components have mixed responsibilities

**Recommended Priority:**
1. Enable TypeScript strict mode
2. Fix memory leaks in Layout polling
3. Split large components
4. Add virtualization to DataTable
5. Expand test coverage
6. Improve accessibility

---

**Document Version:** 1.0  
**Last Updated:** 2026-11-18  
**Next Review:** Sprint Planning  
**Owner:** Frontend Engineering Team