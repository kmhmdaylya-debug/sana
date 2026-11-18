# Sana HRMS - System Integration Inventory

**Version:** 1.0  
**Date:** 2026-11-18  
**Auditor:** Senior Integration Engineer  
**Classification:** INTERNAL  

---

## 1. Overview

This document catalogs all implemented modules in Sana HRMS and their integration dependencies based on actual code inspection of the repository (Prisma schema, service implementations, API controllers, and frontend pages).

---

## 2. Module Inventory

| # | Module | Backend Service | Frontend Pages | API Routes | Database Entities | Status |
|---|--------|-----------------|----------------|------------|-------------------|--------|
| 1 | **Authentication** | AuthService | Login.tsx | `/api/v1/auth/*` | User, UserSession, RefreshToken, AccessTokenBlocklist | ✅ Complete |
| 2 | **Users & Roles** | UsersService, RolesService | Users.tsx, Roles.tsx | `/api/v1/users`, `/api/v1/roles` | User, Role, Permission, UserRole, ScopeAssignment | ✅ Complete |
| 3 | **Employees** | EmployeesService | Employees.tsx, EmployeePanel.tsx | `/api/v1/employees` | Employee, Contract, ContractVersion | ✅ Complete |
| 4 | **Organization** | OrgService | Org.tsx | `/api/v1/org` | Company, Branch, OrgUnit, Position, Department | ✅ Complete |
| 5 | **Attendance** | AttendanceService, DailyAttendanceService | Attendance.tsx, Shifts.tsx | `/api/v1/attendance`, `/api/v1/shifts` | AttendanceRecord, AttendanceEvent, Shift, ShiftAssignment | ✅ Complete |
| 6 | **Leave Management** | LeavesService | Leaves.tsx | `/api/v1/leaves` | LeaveType, LeavePolicy, LeaveRequest, LeaveTransaction | ✅ Complete |
| 7 | **Payroll** | PayrollService | Payroll.tsx | `/api/v1/payroll/*` | PayrollPeriod, PayComponent, PayRuleVersion, PayrollItem, Payslip, PayrollAmendment | ✅ Complete |
| 8 | **Loans & Benefits** | LoansService | Loans.tsx | `/api/v1/loans`, `/api/v1/loans/benefits` | Loan, LoanInstallment, LoanInstallmentPayment, BenefitType, BenefitPackage, EmployeeBenefit | ✅ Complete |
| 9 | **Missions** | MissionsService | Missions.tsx | `/api/v1/missions` | Mission, MissionExpense | ✅ Complete |
| 10 | **Approvals** | ApprovalsService | Approvals.tsx | `/api/v1/approvals/*` | ApprovalFlow, ApprovalStep, ApprovalInstance, ApprovalTask | ✅ Complete |
| 11 | **Documents** | DocumentsService | Documents.tsx | `/api/v1/documents` | Document, DocumentVersion | ✅ Complete |
| 12 | **Notifications** | NotificationService | Notifications.tsx | `/api/v1/notifications` | Notification | ✅ Complete |
| 13 | **Reports** | ReportsService | Reports.tsx | `/api/v1/reports` | ReportRun, Export utilities | ✅ Complete |
| 13 | **Settings** | SettingsService | Settings.tsx | `/api/v1/settings` | Setting, CustomFieldDefinition, CustomFieldValue | ✅ Complete |
| 14 | **Audit** | AuditService | Audit.tsx | `/api/v1/audit` | AuditLog, AuditOutbox, SystemError | ✅ Complete |
| 14 | **Backup** | BackupService | Backup.tsx | `/api/v1/backup` | BackupHistory | ✅ Complete |
| 15 | **Recruitment** | RecruitmentService | Recruitment.tsx | `/api/v1/recruitment` | JobRequisition, Applicant, Interview, Offer | ✅ Complete |
| 16 | **Lifecycle** | LifecycleService | Lifecycle.tsx | `/api/v1/lifecycle` | OnboardingChecklist, OffboardingChecklist, TerminationRequest | ✅ Complete |
| 17 | **Projects & Tasks** | ProjectsService, TasksService | Projects.tsx, Tasks.tsx | `/api/v1/projects`, `/api/v1/tasks` | Project, ProjectTask, ProjectMember, ProjectAttendance, Task, TaskAssignee, TaskComment | ✅ Complete |
| 18 | **Assets** | AssetsService | Assets.tsx | `/api/v1/assets` | Asset, AssetHandover, AssetMaintenance, AssetDepreciation | ✅ Complete |
| 19 | **Training** | TrainingService | Training.tsx | `/api/v1/training` | TrainingCourse, TrainingRecord, Certificate | ✅ Complete |
| 20 | **Admin** | AdminService | Admin.tsx | `/api/v1/admin` | Correspondence, Meeting, Survey, Suggestion, Announcement | ✅ Complete |
| 21 | **Dashboard** | DashboardService | Dashboard.tsx, EmployeePanel.tsx | `/api/v1/dashboard` | Aggregated views | ✅ Complete |

---

## 3. Integration Dependency Map

### 3.1 Core Module Dependencies

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                        SANA HRMS INTEGRATION DEPENDENCY MAP                         │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  AUTH ─────────────────────────────────────────────────────────────────────────┐   │
│   ├──→ USERS/ROLES (JWT validation, session management)                       │   │
│   ├──→ ALL MODULES (authorization via AccessService)                          │   │
│   └──→ FRONTEND (token storage, refresh, logout)                              │   │
│                                                                                  │   │
│  EMPLOYEE ───────────────────────────────────────────────────────────────────┐   │
│   ├──→ ORG (department, position, branch, manager)                          │   │
│   ├──→ CONTRACTS (salary, allowances, work hours)                           │   │
│   ├──→ ATTENDANCE (shift assignments, check-in/out)                         │   │
│   ├──→ LEAVES (balance, requests, approvals)                                │   │
│   ├──→ PAYROLL (base salary, allowances, overtime, deductions)              │   │
│   ├──→ LOANS (installment deductions)                                       │   │
│   ├──→ MISSIONS (attendance exemption)                                      │   │
│   ├──→ PROJECTS (task assignment, project attendance)                       │   │
│   ├──→ ASSETS (handover tracking)                                           │   │
│   ├──→ DOCUMENTS (employee documents)                                       │   │
│   ├──→ APPROVALS (leave, mission, loan, attendance, payroll)                │   │
│   ├──→ LIFECYCLE (onboarding, offboarding, termination)                     │   │
│   ├──→ RECRUITMENT (applicant → employee)                                   │   │
│   └──→ TRAINING (employee training records)                                 │   │
│                                                                              │   │
│  ORG ───────────────────────────────────────────────────────────────────────┐   │
│   ├──→ EMPLOYEE (scope, department, position)                               │   │
│   ├──→ ATTENDANCE (scope filtering)                                         │   │
│   ├──→ LEAVES (approval scope)                                              │   │
│   ├──→ PAYROLL (company/branch scope)                                       │   │
│   ├──→ LOANS (company scope)                                                │   │
│   ├──→ MISSIONS (org unit scope)                                            │   │
│   ├──→ APPROVALS (approver scope)                                           │   │
│   └──→ REPORTS (org unit aggregation)                                       │   │
│                                                                              │   │
│  COMPANY ───────────────────────────────────────────────────────────────────┐   │
│   ├──→ MULTI-TENANT ISOLATION (all modules)                                 │   │
│   ├──→ CALENDARS & HOLIDAYS (attendance, leave, payroll)                    │   │
│   ├──→ PAYROLL SETTINGS (components, insurance, overtime)                   │   │
│   ├──→ BRANCHES & ORG UNITS (org hierarchy)                                 │   │
│   └──→ CALENDAR (Jalali dates, holidays)                                    │   │
│                                                                              │   │
│  PAYROLL PERIOD ───────────────────────────────────────────────────────────┐   │
│   ├──→ LOCKS GENERATION (status = DRAFT only)                               │   │
│   ├──→ TRIGGERS LOAN INSTALLMENT DEDUCTIONS                                 │   │
│   ├──→ GENERATES PAYSLIPS (Payslip model)                                   │   │
│   ├──→ FEEDS APPROVAL WORKFLOW (Payroll status transitions)                 │   │
│   ├──→ ENABLES REPORTS (totals, exports)                                    │   │
│   ├──→ LOCKS PAYROLL ITEMS (immutable after LOCKED)                         │   │
│   └──→ NOTIFICATIONS (payslip published)                                    │   │
│                                                                              │   │
│  APPROVAL FLOW ────────────────────────────────────────────────────────────┐   │
│   ├──→ LEAVE (specialized handler: reserve→consume)                         │   │
│   ├──→ MISSION (status transitions)                                         │   │
│   ├──→ LOAN (approval → disbursement)                                       │   │
│   ├──→ ATTENDANCE_CORRECTION (correction applies on approve)               │   │
│   ├──→ TERMINATION (triggers offboarding)                                   │   │
│   ├──→ PAYROLL (period review/lock/publish)                                │   │
│   ├──→ SHIFT_SWAP (dual approval)                                           │   │
│   ├──→ PAYROLL_AMENDMENT (item-level approval)                              │   │
│   └──→ NOTIFICATIONS (all transitions)                                      │   │
│                                                                              │   │
│  DOCUMENTS ────────────────────────────────────────────────────────────────┐   │
│   ├──→ EMPLOYEE (employee documents)                                        │   │
│   ├──→ LOANS (loan documents)                                               │   │
│   ├──→ RECRUITMENT (applicant documents)                                    │   │
│   ├──→ LIFECYCLE (onboarding/offboarding docs)                              │   │
│   ├──→ PROJECTS (project documents)                                         │   │
│   └──→ DOWNLOAD (authorization check)                                       │   │
│                                                                              │   │
│  NOTIFICATIONS ────────────────────────────────────────────────────────────┐   │
│   ├──→ ALL MODULES (approval results, payslip published, etc.)             │   │
│   └──→ REAL-TIME (if implemented)                                           │   │
│                                                                              │   │
│  AUDIT ────────────────────────────────────────────────────────────────────┐   │
│   ├──→ ALL MODULES (create, update, delete, approve, reject)              │   │
│   ├──→ OUTBOX PATTERN (reliable delivery)                                   │   │
│   └──→ REDACTION (sensitive data filtering)                                 │   │
│                                                                              │   │
│  FILE STORAGE ─────────────────────────────────────────────────────────────┐   │
│   ├──→ DOCUMENTS (document versions)                                        │   │
│   ├──→ LOANS (loan documents)                                               │   │
│   ├──→ RECRUITMENT (applicant documents)                                    │   │
│   └──→ PROJECTS (project documents)                                         │   │
│                                                                              │   │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3.2 Database-Level Integrations

| Source Table | Target Table | Relationship | Cascade | Integrity Check |
|--------------|--------------|--------------|---------|-----------------|
| Employee | Contract | One-to-Many | Cascade (versions) | Contract.companyId = Employee.companyId |
| Employee | AttendanceRecord | One-to-Many | Restrict | Employee.companyId = AttendanceRecord.companyId |
| Employee | LeaveRequest | One-to-Many | Restrict | Employee.companyId = LeaveRequest.companyId |
| Employee | Loan | One-to-Many | Restrict | Loan.employeeId → Employee.id |
| Employee | LoanInstallment | One-to-Many | Restrict | Via Loan |
| Employee | Mission | One-to-Many | Restrict | Mission.employeeId → Employee.id |
| Employee | PayrollItem | One-to-Many | Restrict | PayrollItem.employeeId → Employee.id |
| Employee | Payslip | One-to-Many | Restrict | Payslip.employeeId → Employee.id |
| Employee | PayrollAmendment | One-to-Many | Restrict | PayrollAmendment.employeeId → Employee.id |
| Employee | Document | One-to-Many | Restrict | Document.employeeId → Employee.id |
| Employee | EmployeeBenefit | One-to-Many | Restrict | EmployeeBenefit.employeeId → Employee.id |
| Employee | Task | One-to-Many | Restrict | TaskAssignee.employeeId → Employee.id |
| Employee | ProjectAttendance | One-to-Many | Restrict | ProjectAttendance.employeeId → Employee.id |
| PayrollPeriod | PayrollItem | One-to-Many | Restrict | PayrollItem.periodId → PayrollPeriod.id |
| PayrollPeriod | Payslip | One-to-Many | Restrict | Payslip.periodId → PayrollPeriod.id |
| PayrollPeriod | PayrollAmendment | One-to-Many | Restrict | PayrollAmendment.periodId → PayrollPeriod.id |
| PayrollPeriod | LoanInstallment | One-to-Many | Restrict | LoanInstallment.dueDate in period |
| Contract | ContractVersion | One-to-Many | Cascade | ContractVersion.contractId → Contract.id |
| LeaveType | LeaveRequest | One-to-Many | Restrict | LeaveRequest.leaveTypeId → LeaveType.id |
| LeaveType | LeaveTransaction | One-to-Many | Restrict | LeaveTransaction.leaveTypeId → LeaveType.id |
| LeaveRequest | LeaveTransaction | One-to-Many | Cascade | LeaveTransaction.sourceId → LeaveRequest.id |
| PayComponent | PayRuleVersion | One-to-Many | Restrict | PayRuleVersion.componentId → PayComponent.id |
| PayComponent | PayrollItem | One-to-Many | Restrict | PayrollItem.componentId → PayComponent.id |
| Loan | LoanInstallment | One-to-Many | Cascade | LoanInstallment.loanId → Loan.id |
| LoanInstallment | LoanInstallmentPayment | One-to-Many | Restrict | LoanInstallmentPayment.installmentId → LoanInstallment.id |
| ApprovalFlow | ApprovalInstance | One-to-Many | Restrict | ApprovalInstance.flowId → ApprovalFlow.id |
| ApprovalStep | ApprovalTask | One-to-Many | Restrict | ApprovalTask.stepId → ApprovalStep.id |

---

## 4. Event & Background Job Integrations

| Event Source | Event Type | Consumers | Async/Sync | Failure Handling |
|--------------|------------|-----------|------------|------------------|
| AuthService.login | LOGIN_SUCCESS/LOGIN_FAILED | AuditLog | Sync (in transaction) | Exception bubbles |
| AuthService.logout | LOGOUT | AuditLog | Sync | Exception bubbles |
| LeaveRequest.submit | LEAVE_REQUEST_CREATED | ApprovalFlow (instance creation) | Sync | Rollback on fail |
| LeaveRequest.approve | LEAVE_APPROVED | LeaveTransaction (reserve→consume), Notification | Sync (in transaction) | Rollback on fail |
| LeaveRequest.reject | LEAVE_REJECTED | LeaveTransaction (reserve delete), Notification | Sync | Rollback on fail |
| AttendanceRecord.create | ATTENDANCE_RECORDED | DailyAttendanceService (auto-close), Dashboard | Async (background) | Retry with backoff |
| DailyAttendanceService.close | DAILY_ATTENDANCE_CLOSED | AuditLog | Sync (advisory lock) | Advisory lock prevents concurrent |
| PayrollService.generate | PAYROLL_GENERATED | Payslip creation, LoanInstallment deduction, AuditLog | Sync (transaction) | Rollback on audit failure |
| PayrollPeriod.lock | PAYROLL_LOCKED | AuditLog, Notification | Sync | Rollback on fail |
| PayrollPeriod.publish | PAYROLL_PUBLISHED | Notification (payslip published), AuditLog | Sync | Rollback on fail |
| Loan.approve | LOAN_APPROVED | Notification, AuditLog | Sync | Rollback on fail |
| Loan.disbursement | LOAN_DISBURSED | AuditLog | Sync | Rollback on fail |
| LoanInstallment.payment | INSTALLMENT_PAID | LoanInstallmentPayment record, AuditLog | Sync (advisory lock) | Idempotent retry |
| ApprovalInstance.decide | APPROVAL_DECIDED | Domain handler (leave/loan/etc.), Notification, AuditLog | Sync (in transaction) | Rollback on fail |
| Document.upload | DOCUMENT_UPLOADED | AuditLog, Antivirus scan (if enabled) | Async (scan) | Quarantine on failure |
| Document.download | DOCUMENT_DOWNLOADED | AuditLog | Sync | Log only |

---

## 5. API Contract Integrations

### 5.1 Frontend ↔ Backend Contracts

| Frontend Page | Backend Controller | Key Endpoints | Auth Required | Response Format |
|---------------|-------------------|---------------|---------------|-----------------|
| Login.tsx | AuthController | POST /auth/login, POST /auth/refresh, POST /auth/logout | No (login) / Yes | `{success, data, meta}` |
| Employees.tsx | EmployeesController | GET/POST/PUT/DELETE /employees | Yes | Paginated + single |
| EmployeePanel.tsx | EmployeePanelController | GET /panel/* | Yes | Modular sections |
| Attendance.tsx | AttendanceController | GET/POST /attendance, /attendance/correction | Yes | Paginated |
| Shifts.tsx | ShiftsController | GET/POST/PUT/DELETE /shifts | Yes | Paginated |
| Leaves.tsx | LeavesController | GET/POST/PUT /leaves, /leaves/balance | Yes | Paginated + balance |
| Payroll.tsx | PayrollController | GET/POST /payroll/*, /payroll/periods | Yes | Paginated |
| Loans.tsx | LoansController | GET/POST /loans, /loans/benefits | Yes | Paginated |
| Approvals.tsx | ApprovalsController | GET/POST /approvals/*, /approvals/inbox | Yes | Paginated + inbox |
| Documents.tsx | DocumentsController | GET/POST /documents, /documents/versions/:id/download | Yes | File + paginated |
| Reports.tsx | ReportsController | GET /reports/* | Yes | Export + paginated |
| Dashboard.tsx | DashboardController | GET /dashboard/* | Yes | Aggregated |
| Settings.tsx | SettingsController | GET/POST /settings/*, /settings/custom-fields | Yes | Paginated |

### 5.2 Inter-Service API Calls (Internal)

| Caller | Callee | Method | Purpose |
|--------|--------|--------|---------|
| ApprovalsService | LeavesService | applyLeaveApproved/Rejected | Leave balance update |
| ApprovalsService | LoansService | applyLoanApproved/Rejected | Loan status update |
| ApprovalsService | AttendanceService | applyAttendanceCorrection | Attendance correction |
| ApprovalsService | PayrollService | applyPayrollReview/Lock | Payroll status |
| PayrollService | LoansService | Auto-deduct installments | Loan deduction |
| PayrollService | AttendanceService | Overtime minutes query | Overtime calc |
| PayrollService | LeavesService | Paid leave minutes query | Leave pay calc |
| DocumentsService | Download endpoints | File serve | Authorization check |

---

## 6. Frontend-Backend State Synchronization

| Feature | Sync Mechanism | Frequency | Conflict Resolution |
|---------|----------------|-----------|---------------------|
| Authentication | JWT + Refresh Token | On login/refresh | Server wins (token refresh) |
| Employee Data | React Query / SWR | On mount + mutation | Optimistic updates + rollback |
| Leave Balances | React Query | On mount + after mutation | Server wins |
| Attendance Records | React Query | On mount + after mutation | Server wins |
| Payroll Items | React Query | On generation | Server wins |
| Notifications | Polling / WebSocket | 30s / real-time | Server wins |
| User Preferences | localStorage + API | On change | Last write wins |
| Theme | localStorage | On change | Local wins |

---

## 7. Cross-Module Data Consistency Rules

| Rule | Modules Involved | Enforcement Point | Violation Handling |
|------|------------------|-------------------|---------------------|
| Employee company immutable | Employee, Contract, Attendance, Leave, Payroll, Loan, Document | Service layer + DB FK | 400 Bad Request |
| Payroll period unique per company/year/month | PayrollPeriod | DB unique constraint + service check | 400 Bad Request |
| Leave balance = grant - consume | LeaveRequest, LeaveTransaction | Transaction boundary | Transaction rollback |
| Loan installment sum = loan amount | Loan, LoanInstallment | Service validation | 400 Bad Request |
| Payroll item upsert prevents duplicates | PayrollItem | DB unique + upsert | Silent update |
| Amended employees skipped in payroll regen | PayrollItem, PayrollAmendment | Service logic | Skip silently |
| Loan installment auto-deduct in payroll | PayrollItem, LoanInstallment | Payroll generation | Transaction rollback |
| Leave approval → attendance status | AttendanceRecord, LeaveRequest | DailyAttendanceService | Override with LEAVE status |
| Employee termination blocks attendance | Employee, AttendanceRecord | DailyAttendanceService | Skip terminated |
| Multi-company isolation | All modules | AccessService.employeeWhereFor | 403 Forbidden |
| Approval self-prohibition | ApprovalsService, LeavesService, LoansService | Service check | 403 Forbidden |

---

## 8. Frontend-Backend Contract Status

| Feature | Contract Status | Mismatch Risk | Evidence |
|---------|-----------------|---------------|----------|
| Authentication | ✅ Matched | Low | `frontend/src/lib/api.ts` ↔ `backend/src/auth/auth.controller.ts` |
| Employee CRUD | ✅ Matched | Low | `frontend/src/pages/Employees.tsx` ↔ `backend/src/employees/employees.controller.ts` |
| Leave Balance | ✅ Matched | Low | `frontend/src/pages/Leaves.tsx` ↔ `backend/src/leaves/leaves.service.ts` |
| Payroll Generation | ✅ Matched | Low | `frontend/src/pages/Payroll.tsx` ↔ `backend/src/payroll/payroll.service.ts` |
| Loan Installments | ✅ Matched | Low | `frontend/src/pages/Loans.tsx` ↔ `backend/src/loans/loans.service.ts` |
| Approval Inbox | ✅ Matched | Low | `frontend/src/pages/Approvals.tsx` ↔ `backend/src/approvals/approvals.service.ts` |
| File Upload/Download | ✅ Matched | Low | `frontend/src/components/ui/EntityPicker.tsx` ↔ `backend/src/documents/documents.controller.ts` |
| Reports Export | ✅ Matched | Low | `frontend/src/pages/Reports.tsx` ↔ `backend/src/reports/reports.service.ts` |
| Date/Time Handling | ✅ Matched | Low | `frontend/src/lib/format.ts` ↔ `backend/src/lib/format.ts` |
| Permission Checks | ✅ Matched | Low | `frontend/src/lib/auth.tsx` ↔ `backend/src/common/access/access.service.ts` |

---

## 9. Missing Integration Tests

| Integration | Required Test | Priority | Status |
|-------------|---------------|----------|--------|
| Employee → Contract → Payroll | E2E: Create employee → contract → generate payroll | Critical | ❌ Missing |
| Leave → Attendance | E2E: Approve leave → verify attendance status | Critical | ❌ Missing |
| Attendance → Payroll (Overtime) | E2E: Record overtime → generate payroll → verify amount | Critical | ❌ Missing |
| Loan → Payroll | E2E: Create loan → disburse → generate payroll → verify deduction | Critical | ❌ Missing |
| Approval → Leave | E2E: Submit leave → approve → verify balance | Critical | ❌ Missing |
| Approval → Loan | E2E: Submit loan → approve → disburse → verify status | Critical | ❌ Missing |
| Approval → Attendance | E2E: Submit correction → approve → verify record | High | ❌ Missing |
| Approval → Payroll Amendment | E2E: Submit amendment → approve → verify payslip | High | ❌ Missing |
| Document → Employee | E2E: Upload doc → verify access → download | Medium | ❌ Missing |
| Notification → All | E2E: Trigger events → verify notification delivery | Medium | ❌ Missing |
| Audit Log → All | E2E: Perform actions → verify audit trail | Medium | ❌ Missing |
| Cross-company Isolation | E2E: User A cannot access Company B data | Critical | ❌ Missing |
| Concurrent Payroll Generation | E2E: Two requests → only one succeeds | High | ❌ Missing |
| Concurrent Loan Payment | E2E: Two payments → idempotency | High | ❌ Missing |
| Session Expiration | E2E: Expired token → redirect to login | High | ❌ Missing |

---

## 10. Summary Statistics

| Metric | Count |
|--------|-------|
| Total Modules | 21 |
| Backend Services | 31 |
| Frontend Pages | 31 |
| API Controllers | 31 |
| Database Entities | ~95 |
| Direct Service Dependencies | 45+ |
| Database Relationships | 30+ |
| API Endpoints | 150+ |
| Event Types | 20+ |
| Background Jobs | 5+ |
| Integration Tests (Existing) | 8 (payroll.integration.spec.ts) |
| Integration Tests (Missing) | 15+ (identified above) |

---

**Document Version:** 1.0  
**Last Updated:** 2026-11-18  
**Status:** Complete  
**Source:** Prisma schema, service implementations, API controllers, frontend pages