# Full Site Inventory - Sana HRMS

**Date**: 2026-11-18
**App Version**: 1.0.0
**Routes Discovered**: 38 (including login and 404)

---

## Route Inventory Table

| # | Route | Component | Permission(s) Required | Role Access | Linked in Nav | Notes |
|---|-------|-----------|------------------------|-------------|---------------|-------|
| 1 | `/login` | Login | (none) | All (unauthenticated) | N/A | Public entry point |
| 2 | `/` | Dashboard / EmployeePanel | `dashboard.view.management` OR `panel.view` | SUPER_ADMIN, HR_ADMIN, MANAGER → Dashboard; EMPLOYEE → Panel | Yes (logo/home) | Smart redirect based on role |
| 3 | `/approvals` | Approvals | `approvals.view` | SUPER_ADMIN, HR_ADMIN, MANAGER | Yes (sidebar) | Inbox + flow management |
| 4 | `/employees` | Employees | `employees.view` | SUPER_ADMIN, HR_ADMIN, MANAGER | Yes (sidebar) | List + create |
| 5 | `/employees/:employeeId` | Employees | `employees.view` | SUPER_ADMIN, HR_ADMIN, MANAGER | No (from list) | Detail/edit view |
| 6 | `/contracts` | Contracts | `contracts.view` | SUPER_ADMIN, HR_ADMIN, MANAGER | Yes (sidebar) | List + versioning |
| 7 | `/documents` | Documents | `documents.view` | SUPER_ADMIN, HR_ADMIN, MANAGER, EMPLOYEE (own) | Yes (sidebar) | Document management |
| 8 | `/attendance` | Attendance | `dashboard.view.management` AND `attendance.view` | SUPER_ADMIN, HR_ADMIN, MANAGER | Yes (sidebar) | Daily attendance |
| 9 | `/shifts` | Shifts | `shifts.view` | SUPER_ADMIN, HR_ADMIN, MANAGER | Yes (sidebar) | Shift definitions + assignments |
| 10 | `/leaves` | Leaves | `leaves.view` | SUPER_ADMIN, HR_ADMIN, MANAGER, EMPLOYEE | Yes (sidebar) | Requests + balances |
| 11 | `/missions` | Missions | `missions.view` | SUPER_ADMIN, HR_ADMIN, MANAGER, EMPLOYEE | Yes (sidebar) | Mission requests + expenses |
| 12 | `/payroll` | Payroll | `payroll.view` OR `payroll.view.own` | SUPER_ADMIN, HR_ADMIN, MANAGER, EMPLOYEE (own) | Yes (sidebar) | Periods + payslips |
| 13 | `/evaluations` | Evaluations | `evaluations.view` | SUPER_ADMIN, HR_ADMIN, MANAGER | Yes (sidebar) | Cycles + forms + goals |
| 14 | `/tasks` | Tasks | `tasks.view` | SUPER_ADMIN, HR_ADMIN, MANAGER, EMPLOYEE | Yes (sidebar) | Task board + details |
| 15 | `/projects` | Projects | `projects.view` | SUPER_ADMIN, HR_ADMIN, MANAGER | Yes (sidebar) | Gantt + project tasks |
| 16 | `/panel` | EmployeePanel | `panel.view` | EMPLOYEE | Yes (sidebar for employees) | Personal dashboard |
| 17 | `/assets` | Assets | `assets.view` | SUPER_ADMIN, HR_ADMIN, MANAGER | Yes (sidebar) | Asset registry + handovers |
| 18 | `/training` | Training | `training.view` | SUPER_ADMIN, HR_ADMIN, MANAGER, EMPLOYEE | Yes (sidebar) | Courses + records + certificates |
| 19 | `/loans` | Loans | `loans.view` | SUPER_ADMIN, HR_ADMIN, MANAGER, EMPLOYEE | Yes (sidebar) | Loan requests + installments |
| 20 | `/recruitment` | Recruitment | `recruitment.view` | SUPER_ADMIN, HR_ADMIN, MANAGER | Yes (sidebar) | Requisitions + openings + applicants |
| 21 | `/lifecycle` | Lifecycle | `lifecycle.view` | SUPER_ADMIN, HR_ADMIN, MANAGER | Yes (sidebar) | Onboarding/offboarding/terminations |
| 22 | `/admin` | Admin | `admin.view` | SUPER_ADMIN, HR_ADMIN | Yes (sidebar) | Correspondence + meetings + surveys + suggestions |
| 23 | `/announcements` | Announcements | `announcements.view` | All authenticated | Yes (sidebar) | Company-wide announcements |
| 24 | `/notifications` | Notifications | `notifications.view` | All authenticated | Yes (header bell) | Personal notifications |
| 25 | `/reports` | Reports | `reports.view` | SUPER_ADMIN, HR_ADMIN, MANAGER | Yes (sidebar) | Report definitions + runs |
| 26 | `/users` | Users | `users.view` | SUPER_ADMIN, HR_ADMIN | Yes (sidebar) | User management |
| 27 | `/roles` | Roles | `roles.view` | SUPER_ADMIN, HR_ADMIN | Yes (sidebar) | Role + permission management |
| 28 | `/org` | Org | `org.view` | SUPER_ADMIN, HR_ADMIN, MANAGER | Yes (sidebar) | Companies, branches, org units, positions |
| 29 | `/audit` | Audit | `audit.view` | SUPER_ADMIN, HR_ADMIN | Yes (sidebar) | Audit log viewer |
| 30 | `/settings` | Settings | `settings.view` | SUPER_ADMIN, HR_ADMIN | Yes (sidebar) | System settings + custom fields |
| 31 | `/backup` | Backup | `backup.manage` | SUPER_ADMIN | Yes (sidebar) | Backup history + restore |
| 32 | `*` (404) | NotFound | (none) | All | N/A | Catch-all |

---

## Role-to-Route Visibility Matrix

| Route | SUPER_ADMIN | HR_ADMIN | MANAGER | EMPLOYEE |
|-------|-------------|----------|---------|----------|
| `/login` | ✅ | ✅ | ✅ | ✅ |
| `/` (Dashboard) | ✅ | ✅ | ✅ | ❌ (redirects to /panel) |
| `/panel` | ❌ (no panel.view) | ❌ | ❌ | ✅ |
| `/approvals` | ✅ | ✅ | ✅ | ❌ |
| `/employees` | ✅ | ✅ | ✅ | ❌ |
| `/employees/:id` | ✅ | ✅ | ✅ | ❌ |
| `/contracts` | ✅ | ✅ | ✅ | ❌ |
| `/documents` | ✅ | ✅ | ✅ | ✅ (own only via ABAC) |
| `/attendance` | ✅ | ✅ | ✅ | ❌ |
| `/shifts` | ✅ | ✅ | ✅ | ❌ |
| `/leaves` | ✅ | ✅ | ✅ | ✅ |
| `/missions` | ✅ | ✅ | ✅ | ✅ |
| `/payroll` | ✅ | ✅ | ✅ | ✅ (own only) |
| `/evaluations` | ✅ | ✅ | ✅ | ❌ |
| `/tasks` | ✅ | ✅ | ✅ | ✅ |
| `/projects` | ✅ | ✅ | ✅ | ❌ |
| `/assets` | ✅ | ✅ | ✅ | ❌ |
| `/training` | ✅ | ✅ | ✅ | ✅ |
| `/loans` | ✅ | ✅ | ✅ | ✅ |
| `/recruitment` | ✅ | ✅ | ✅ | ❌ |
| `/lifecycle` | ✅ | ✅ | ✅ | ❌ |
| `/admin` | ✅ | ✅ | ❌ | ❌ |
| `/announcements` | ✅ | ✅ | ✅ | ✅ |
| `/notifications` | ✅ | ✅ | ✅ | ✅ |
| `/reports` | ✅ | ✅ | ✅ | ❌ |
| `/users` | ✅ | ✅ | ❌ | ❌ |
| `/roles` | ✅ | ✅ | ❌ | ❌ |
| `/org` | ✅ | ✅ | ✅ | ❌ |
| `/audit` | ✅ | ✅ | ❌ | ❌ |
| `/settings` | ✅ | ✅ | ❌ | ❌ |
| `/backup` | ✅ | ❌ | ❌ | ❌ |

---

## Navigation Structure (Sidebar)

### Main Sections (Visible to All Authenticated)
- **داشبورد** → `/` (managers) / `/panel` (employees)
- **اعلامیه‌ها** → `/announcements`
- **اعلان‌ها** → `/notifications` (header bell)

### مدیریت پرسنلی (SUPER_ADMIN, HR_ADMIN, MANAGER)
- **نیروها** → `/employees`
- **قراردادها** → `/contracts`
- **مراکز** → `/documents`
- **مرخصی** → `/leaves`
- **حضور و غیاب** → `/attendance`
- **شیفت‌ها** → `/shifts`
- **ماموریت‌ها** → `/missions`

### حقوق و دستمزد (SUPER_ADMIN, HR_ADMIN, MANAGER)
- **حقوق و دستمزد** → `/payroll`
- **وام‌ها** → `/loans`

### ارزیابی و وظایف (SUPER_ADMIN, HR_ADMIN, MANAGER, EMPLOYEE for tasks)
- **ارزیابی‌ها** → `/evaluations`
- **وظایف** → `/tasks`
- **پروژه‌ها** → `/projects`

### توسعه و آموزش (SUPER_ADMIN, HR_ADMIN, MANAGER, EMPLOYEE for training)
- **آموزش** → `/training`
- **دارایی** → `/assets`

### استخدام و چرخه حیات (SUPER_ADMIN, HR_ADMIN, MANAGER)
- **استخدام** → `/recruitment`
- **چرخه حیات** → `/lifecycle`

### مدیریت سیستم (SUPER_ADMIN, HR_ADMIN)
- **سازمان** → `/org`
- **کاربران** → `/users`
- **نقش‌ها** → `/roles`
- **تنظیمات** → `/settings`
- **بازبینی** → `/audit`
- **پشتیبان‌گیری** → `/backup` (SUPER_ADMIN only)
- **مدیریت** → `/admin` (correspondence, meetings, surveys, suggestions)

### گزارشات (SUPER_ADMIN, HR_ADMIN, MANAGER)
- **گزارش‌ها** → `/reports`

---

## API Endpoint Inventory (from Swagger)

Total endpoints: ~200+ (grouped by controller)

| Controller | Base Path | Key Endpoints |
|------------|-----------|---------------|
| AuthController | `/api/auth` | login, refresh, logout, change-password, me |
| UsersController | `/api/users` | list, get, create, update, delete, reset-password, assign-roles, assign-scopes, lock/unlock |
| RolesController | `/api/roles` | list, get, create, update, delete, assign/revoke permissions |
| EmployeesController | `/api/employees` | list, get, create, update, delete, bulk, import, export, position-history, dependents, skills, bank-accounts |
| ContractsController | `/api/contracts` | list, get, create, update, versions, approve, reject |
| DocumentsController | `/api/documents` | list, get, create, upload, download, versions, delete |
| AttendanceController | `/api/attendance` | records, daily-close, corrections, devices, stats |
| ShiftsController | `/api/shifts` | list, create, update, delete, assignments, swaps |
| LeavesController | `/api/leaves` | types, requests, balances, transactions, approve/reject/cancel |
| MissionsController | `/api/missions` | list, create, update, approve/reject, expenses |
| PayrollController | `/api/payroll` | components, periods, generate, lock, publish, payslips, amendments |
| EvaluationsController | `/api/evaluations` | forms, cycles, evaluations, scores, feedback, goals |
| TasksController | `/api/tasks` | list, create, update, delete, assignees, comments, dependencies |
| ProjectsController | `/api/projects` | list, create, update, delete, tasks, timeline, members |
| EmployeePanelController | `/api/panel` | my-tasks, my-leaves, my-missions, my-payslips, my-attendance, profile |
| AssetsController | `/api/assets` | list, create, update, delete, handovers, maintenances, depreciations |
| TrainingController | `/api/training` | courses, records, certificates |
| LoansController | `/api/loans` | list, create, update, approve/reject, disburse, installments, benefit-types, packages, employee-benefits |
| RecruitmentController | `/api/recruitment` | requisitions, openings, applicants, interviews, offers |
| LifecycleController | `/api/lifecycle` | onboarding-templates, onboarding-checklists, offboarding, terminations |
| AdminController | `/api/admin` | correspondences, meetings, surveys, suggestions, confidential-reports |
| AnnouncementsController | `/api/announcements` | list, create, get, update, delete, acknowledge |
| NotificationsController | `/api/notifications` | list, unread-count, mark-read, mark-all-read |
| ReportsController | `/api/reports` | definitions, runs, run, stats, export |
| DashboardController | `/api/dashboard` | team-work, attendance-today, me, management, leave-trend |
| OrgController | `/api/org` | companies, branches, org-units, positions, work-locations, cost-centers, calendars, holidays |
| AuditLogController | `/api/audit-log` | list, get, export, stats |
| SettingsController | `/api/settings` | list, get, update, groups, custom-fields, saved-filters |
| BackupController | `/api/backup` | history, run, restore, download |
| HealthController | `/api/health` | liveness, readiness, db, migrations, frontend |

---

## Orphaned / Unlinked Routes

| Route | Status | Notes |
|-------|--------|-------|
| `/employees/:employeeId` | ❌ Not in nav | Accessed from employee list row click |
| `/panel` | ⚠️ Conditional | Only visible to EMPLOYEE role (redirect from `/`) |

---

## Potential Permission Issues (To Verify)

| Route | Current Permission | Concern |
|-------|-------------------|---------|
| `/attendance` | `dashboard.view.management` AND `attendance.view` | Dual permission - may block HR_ADMIN who has attendance.view but not dashboard.view.management |
| `/payroll` | `payroll.view` OR `payroll.view.own` | EMPLOYEE gets `payroll.view.own` but page may show management features |
| `/documents` | `documents.view` | EMPLOYEE has this but ABAC should limit to own documents |
| `/tasks` | `tasks.view` | EMPLOYEE has this but should only see assigned tasks |
| `/panel` | `panel.view` | Only EMPLOYEE has this - correct |

---

## Actions Available Per Route (High-Level)

| Route | Create | Read | Update | Delete | Approve | Export | Other |
|-------|--------|------|--------|--------|---------|--------|-------|
| `/employees` | ✅ | ✅ | ✅ | ✅ (soft) | - | ✅ | Import, Position History |
| `/contracts` | ✅ | ✅ | ✅ | - | ✅ | ✅ | Versioning |
| `/leaves` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Balance mgmt |
| `/attendance` | ✅ | ✅ | ✅ | - | - | ✅ | Corrections, Daily close |
| `/payroll` | ✅ | ✅ | ✅ | - | ✅ | ✅ | Generate, Lock, Publish |
| `/evaluations` | ✅ | ✅ | ✅ | ✅ | - | ✅ | Cycles, Forms, Goals |
| `/tasks` | ✅ | ✅ | ✅ | ✅ | - | ✅ | Dependencies, Comments |
| `/projects` | ✅ | ✅ | ✅ | ✅ | - | ✅ | Gantt, Timeline |
| `/assets` | ✅ | ✅ | ✅ | ✅ | - | ✅ | Handovers, Maintenance |
| `/training` | ✅ | ✅ | ✅ | ✅ | - | ✅ | Records, Certificates |
| `/loans` | ✅ | ✅ | ✅ | - | ✅ | ✅ | Installments, Benefits |
| `/recruitment` | ✅ | ✅ | ✅ | - | ✅ | ✅ | Applicants, Interviews, Offers |
| `/lifecycle` | ✅ | ✅ | ✅ | - | ✅ | ✅ | Onboarding/Offboarding |
| `/org` | ✅ | ✅ | ✅ | ✅ | - | ✅ | Full hierarchy |
| `/users` | ✅ | ✅ | ✅ | ✅ | - | ✅ | Roles, Scopes, Lock |
| `/roles` | ✅ | ✅ | ✅ | ✅ | - | ✅ | Permissions |
| `/settings` | - | ✅ | ✅ | - | - | - | Custom fields, Saved filters |

---

## Next Steps for Phase 2

1. Write Playwright tests for 12 journeys covering each major flow
2. Test each route as each role (4 roles × 32 routes = 128 test scenarios)
3. Verify API-level authorization matches UI permissions
4. Check for horizontal overflow at 375px, 768px, 1440px
5. Run axe on all routes