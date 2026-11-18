# Sana HRMS - Module Dependency Matrix

**Version:** 1.0  
**Date:** 2026-11-18  
**Auditor:** Senior Integration Engineer  
**Classification:** INTERNAL  

---

## 1. Overview

This document provides a detailed dependency matrix showing how each module depends on other modules, both at the service level (backend) and API level (frontend). This is derived from actual code analysis of imports, service injections, API calls, and database relationships.

---

## 2. Service-Level Dependency Matrix

### 2.1 Direct Service Dependencies (Backend)

| Consumer Service | Depends On | Dependency Type | Purpose |
|------------------|------------|-----------------|---------|
| **AuthService** | PrismaService | Direct (DI) | Database access |
| | AccessService | Direct (DI) | Scope/permission building |
| | AuditService | Direct (DI) | Login/logout audit |
| | NotificationService | Direct (DI) | Login notifications |
| | ConfigService | Direct (DI) | JWT secrets, config |
| | JwtService | Direct (DI) | Token signing/verify |
| **EmployeesService** | PrismaService | Direct (DI) | Employee CRUD |
| | AccessService | Direct (DI) | Scope filtering |
| | AuditService | Direct (DI) | Employee audit trail |
| | AuthService | Direct (DI) | Password hashing |
| | EmployeesService | Self | Contract version queries |
| **ContractsService** | PrismaService | Direct (DI) | Contract CRUD |
| | AccessService | Direct (DI) | Company scope |
| | AuditService | Direct (DI) | Audit trail |
| **AttendanceService** | PrismaService | Direct (DI) | Attendance CRUD |
| | AccessService | Direct (DI) | Scope filtering |
| | AuditService | Direct (DI) | Audit trail |
| | ShiftsService | Direct (DI) | Shift definitions |
| | DailyAttendanceService | Direct (DI) | Daily closing logic |
| **DailyAttendanceService** | PrismaService | Direct (DI) | Daily attendance CRUD |
| | AccessService | Direct (DI) | Scope filtering |
| | AuditService | Direct (DI) | Audit trail |
| | AttendanceService | Direct (DI) | Record updates |
| | ShiftsService | Direct (DI) | Shift definitions |
| | AttendanceCalculation | Direct (import) | Calculation logic |
| **LeavesService** | PrismaService | Direct (DI) | Leave CRUD |
| | AccessService | Direct (DI) | Scope filtering |
| | AuditService | Direct (DI) | Audit trail |
| | ApprovalsService | Direct (DI) | Approval workflow |
| | EmployeesService | Direct (DI) | Employee validation |
| | LeavesService | Self | Balance calculations |
| **PayrollService** | PrismaService | Direct (DI) | Payroll CRUD |
| | AccessService | Direct (DI) | Company scope |
| | AuditService | Direct (DI) | Financial audit |
| | NotificationService | Direct (DI) | Payroll notifications |
| | AccessService | Direct (DI) | Company scope |
| | ConfigService | Direct (DI) | Payroll settings |
| | AttendanceService | Direct (DI) | Overtime minutes |
| | LeavesService | Direct (DI) | Paid leave minutes |
| | LoansService | Direct (DI) | Loan installment deductions |
| | ContractsService | Direct (DI) | Contract versions |
| | EmployeesService | Direct (DI) | Employee data |
| **LoansService** | PrismaService | Direct (DI) | Loan CRUD |
| | AccessService | Direct (DI) | Scope filtering |
| | AuditService | Direct (DI) | Audit trail |
| | NotificationService | Direct (DI) | Loan notifications |
| | ApprovalsService | Direct (DI) | Approval workflow |
| | PayrollService | Direct (DI) | Installment deduction |
| | EmployeesService | Direct (DI) | Employee validation |
| **ApprovalsService** | PrismaService | Direct (DI) | Approval CRUD |
| | AccessService | Direct (DI) | Scope/company |
| | AuditService | Direct (DI) | Audit trail |
| | NotificationService | Direct (DI) | Approval notifications |
| | LeavesService | Direct (DI) | Leave outcomes |
| | LoansService | Direct (DI) | Loan outcomes |
| | AttendanceService | Direct (DI) | Attendance correction |
| | MissionsService | Direct (DI) | Mission outcomes |
| | LifecycleService | Direct (DI) | Termination outcomes |
| | PayrollService | Direct (DI) | Payroll period outcomes |
| | ShiftsService | Direct (DI) | Shift swap outcomes |
| **DocumentsService** | PrismaService | Direct (DI) | Document CRUD |
| | AccessService | Direct (DI) | Scope filtering |
| | AuditService | Direct (DI) | Audit trail |
| | EmployeesService | Direct (DI) | Employee validation |
| | LoansService | Direct (DI) | Loan documents |
| | RecruitmentService | Direct (DI) | Applicant documents |
| | LifecycleService | Direct (DI) | Onboarding/offboarding docs |
| **NotificationsService** | PrismaService | Direct (DI) | Notification CRUD |
| | (None) | - | Standalone |
| **ReportsService** | PrismaService | Direct (DI) | Report queries |
| | AccessService | Direct (DI) | Scope filtering |
| | AuditService | Direct (DI) | Export audit |
| | EmployeesService | Direct (DI) | Employee data |
| | PayrollService | Direct (DI) | Payroll data |
| | AttendanceService | Direct (DI) | Attendance data |
| | LeavesService | Direct (DI) | Leave data |
| | LoansService | Direct (DI) | Loan data |
| **SettingsService** | PrismaService | Direct (DI) | Settings CRUD |
| | AccessService | Direct (DI) | Company scope |
| | AuditService | Direct (DI) | Settings audit |
| **AuditService** | PrismaService | Direct (DI) | Audit CRUD |
| | ConfigService | Direct (DI) | Fail-open config |
| **BackupService** | PrismaService | Direct (DI) | Backup CRUD |
| | ConfigService | Direct (DI) | Backup config |
| | AuditService | Direct (DI) | Backup audit |
| **AccessService** | PrismaService | Direct (DI) | Scope/permission queries |
| **RecruitmentService** | PrismaService | Direct (DI) | Recruitment CRUD |
| | AccessService | Direct (DI) | Scope filtering |
| | AuditService | Direct (DI) | Audit trail |
| | DocumentsService | Direct (DI) | Applicant documents |
| | NotificationsService | Direct (DI) | Interview notifications |
| **LifecycleService** | PrismaService | Direct (DI) | Lifecycle CRUD |
| | AccessService | Direct (DI) | Scope filtering |
| | AuditService | Direct (DI) | Audit trail |
| | DocumentsService | Direct (DI) | Onboarding/offboarding docs |
| | ApprovalsService | Direct (DI) | Termination approval |
| | EmployeesService | Direct (DI) | Employee status |
| **ProjectsService** | PrismaService | Direct (DI) | Project CRUD |
| | AccessService | Direct (DI) | Scope filtering |
| | AuditService | Direct (DI) | Audit trail |
| | TasksService | Direct (DI) | Task management |
| | EmployeesService | Direct (DI) | Member validation |
| **TasksService** | PrismaService | Direct (DI) | Task CRUD |
| | AccessService | Direct (DI) | Scope filtering |
| | AuditService | Direct (DI) | Audit trail |
| | ProjectsService | Direct (DI) | Project validation |
| | ApprovalsService | Direct (DI) | Task approvals (if any) |
| **MissionsService** | PrismaService | Direct (DI) | Mission CRUD |
| | AccessService | Direct (DI) | Scope filtering |
| | AuditService | Direct (DI) | Audit trail |
| | ApprovalsService | Direct (DI) | Mission approval |
| | AttendanceService | Direct (DI) | Attendance exemption |
| **AssetsService** | PrismaService | Direct (DI) | Asset CRUD |
| | AccessService | Direct (DI) | Scope filtering |
| | AuditService | Direct (DI) | Audit trail |
| | DocumentsService | Direct (DI) | Asset documents |
| | EmployeesService | Direct (DI) | Handover validation |
| **TrainingService** | PrismaService | Direct (DI) | Training CRUD |
| | AccessService | Direct (DI) | Scope filtering |
| | AuditService | Direct (DI) | Audit trail |
| **AssetsService** | Direct (DI) | Asset validation |
| **AdminService** | PrismaService | Direct (DI) | Admin CRUD |
| | AccessService | Direct (DI) | Superadmin check |
| | AuditService | Direct (DI) | Admin audit |
| **DashboardService** | PrismaService | Direct (DI) | Aggregated queries |
| | AccessService | Direct (DI) | Scope filtering |
| | EmployeesService | Direct (DI) | Employee data |
| | AttendanceService | Direct (DI) | Attendance data |
| | LeavesService | Direct (DI) | Leave data |
| | PayrollService | Direct (DI) | Payroll data |
| | LoansService | Direct (DI) | Loan data |
| | ProjectsService | Direct (DI) | Project data |
| | TasksService | Direct (DI) | Task data |
| **OrgService** | PrismaService | Direct (DI) | Org CRUD |
| | AccessService | Direct (DI) | Scope filtering |
| | AuditService | Direct (DI) | Org audit |
| **ShiftsService** | PrismaService | Direct (DI) | Shift CRUD |
| | AccessService | Direct (DI) | Company scope |
| | AuditService | Direct (DI) | Shift audit |
| | AttendanceService | Direct (DI) | Shift assignments |
| | DailyAttendanceService | Direct (DI) | Shift definitions |

---

## 2.2 Dependency Graph Visualization

```
LEVEL 0 (Foundation - No Internal Dependencies)
├── PrismaService
├── ConfigService
├── JwtService
├── AccessService
├── AuditService
├── NotificationService
└── PrismaService

LEVEL 1 (Core Domain - Depend on Foundation)
├── AuthService
├── EmployeesService
├── OrgService
├── ContractsService
├── AccessService (also L0)
└── AttendanceService

LEVEL 2 (Business Logic - Depend on Core)
├── ContractsService
├── AttendanceService
├── DailyAttendanceService
├── LeavesService
├── ContractsService
├── ShiftsService
├── ProjectsService
├── TasksService
├── MissionsService
├── AssetsService
├── TrainingService
├── RecruitmentService
├── LifecycleService
└── AdminService

LEVEL 3 (Complex Workflows - Depend on Business Logic)
├── PayrollService
├── LoansService
├── LeavesService
├── ApprovalsService
├── DocumentsService
├── ReportsService
├── SettingsService
├── BackupService
└── ApprovalsService

LEVEL 4 (Aggregation & Dashboard)
├── DashboardService
└── ReportsService

LEVEL 5 (Cross-Cutting)
├── AccessService (used by all)
├── AuditService (used by all)
├── NotificationService (used by many)
└── DocumentsService (used by several)
```

---

## 3. Database-Level Dependency Matrix

| Source Entity | Target Entity | Relationship | Foreign Key | On Delete | Integration Point |
|---------------|---------------|--------------|-------------|-----------|-------------------|
| User | UserSession | 1:N | userId | Cascade | Auth |
| User | RefreshToken | 1:N | userId | Cascade | Auth |
| User | UserRole | 1:N | userId | Cascade | Auth/Access |
| User | ScopeAssignment | 1:N | userId | Cascade | Access |
| Employee | User | 1:1 | userId | SetNull | Auth/Employee |
| Employee | Contract | 1:N | employeeId | Cascade (versions) | Contracts/Payroll |
| Employee | AttendanceRecord | 1:N | employeeId | Restrict | Attendance |
| Employee | LeaveRequest | 1:N | employeeId | Restrict | Leaves |
| Employee | Loan | 1:N | employeeId | Restrict | Loans |
| Employee | Mission | 1:N | employeeId | Restrict | Missions |
| Employee | PayrollItem | 1:N | employeeId | Restrict | Payroll |
| Employee | Payslip | 1:N | employeeId | Restrict | Payroll |
| Employee | PayrollAmendment | 1:N | employeeId | Restrict | Payroll |
| Employee | Document | 1:N | employeeId | Restrict | Documents |
| Employee | EmployeeBenefit | 1:N | employeeId | Restrict | Benefits |
| Employee | TaskAssignee | 1:N | employeeId | Restrict | Tasks |
| Employee | ProjectAttendance | 1:N | employeeId | Restrict | Projects |
| Contract | ContractVersion | 1:N | contractId | Cascade | Contracts |
| Contract | ContractVersion | 1:N | contractId | Restrict | Payroll |
| LeaveType | LeaveRequest | 1:N | leaveTypeId | Restrict | Leaves |
| LeaveType | LeavePolicy | 1:N | leaveTypeId | Restrict | Leaves |
| LeaveRequest | LeaveTransaction | 1:N | sourceId | Cascade | Leaves |
| LeaveRequest | ApprovalInstance | 1:1 | sourceId | Restrict | Approvals |
| LeaveType | LeaveTransaction | 1:N | leaveTypeId | Restrict | Leaves |
| PayComponent | PayRuleVersion | 1:N | componentId | Restrict | Payroll |
| PayComponent | PayrollItem | 1:N | componentId | Restrict | Payroll |
| PayrollPeriod | PayrollItem | 1:N | periodId | Restrict | Payroll |
| PayrollPeriod | Payslip | 1:N | periodId | Restrict | Payroll |
| PayrollPeriod | PayrollAmendment | 1:N | periodId | Restrict | Payroll |
| PayrollPeriod | LoanInstallment | 1:N | dueDate | Restrict | Payroll/Loans |
| Loan | LoanInstallment | 1:N | loanId | Cascade | Loans |
| LoanInstallment | LoanInstallmentPayment | 1:N | installmentId | Restrict | Loans |
| Loan | LoanInstallmentPayment | 1:N | loanId | Restrict | Loans |
| ApprovalFlow | ApprovalInstance | 1:N | flowId | Restrict | Approvals |
| ApprovalStep | ApprovalTask | 1:N | stepId | Restrict | Approvals |
| ApprovalInstance | ApprovalTask | 1:N | instanceId | Restrict | Approvals |
| Document | DocumentVersion | 1:N | documentId | Cascade | Documents |
| Task | TaskAssignee | 1:N | taskId | Cascade | Tasks |
| Task | TaskDependency | 1:N | taskId/dependsOnTaskId | Restrict | Tasks |
| Task | TaskComment | 1:N | taskId | Cascade | Tasks |
| Task | TaskAttachment | 1:N | taskId | Cascade | Tasks |
| Project | ProjectMember | 1:N | projectId | Cascade | Projects |
| Project | ProjectTask | 1:N | projectId | Cascade | Projects |
| Project | ProjectAttendance | 1:N | projectId | Restrict | Projects |
| Asset | AssetHandover | 1:N | assetId | Cascade | Assets |
| Asset | AssetMaintenance | 1:N | assetId | Cascade | Assets |
| Asset | AssetDepreciation | 1:N | assetId | Cascade | Assets |
| Asset | Document | 1:N | assetId | Restrict | Documents |
| Company | Branch | 1:N | companyId | Cascade | Org |
| Company | OrgUnit | 1:N | companyId | Cascade | Org |
| Company | Department | 1:N | companyId | Cascade | Org |
| Company | Position | 1:N | companyId | Cascade | Org |
| Company | Employee | 1:N | companyId | Restrict | Employee |
| Company | PayComponent | 1:N | companyId | Restrict | Payroll |
| Company | LeaveType | 1:N | companyId | Restrict | Leaves |
| Company | BenefitType | 1:N | companyId | Restrict | Benefits |
| Company | PayrollPeriod | 1:N | companyId | Restrict | Payroll |
| Company | Loan | 1:N | companyId | Restrict | Loans |
| Company | Shift | 1:N | companyId | Restrict | Shifts |
| Branch | OrgUnit | 1:N | branchId | SetNull | Org |
| Branch | Employee | 1:N | branchId | SetNull | Employee |
| OrgUnit | OrgUnit | 1:N (self) | parentId | SetNull | Org |
| OrgUnit | Employee | 1:N | orgUnitId | SetNull | Employee |
| Department | Employee | 1:N | departmentId | SetNull | Employee |
| Position | Employee | 1:N | positionId | SetNull | Employee |
| AttendanceRecord | AttendanceEvent | 1:N | recordId | Cascade | Attendance |
| AttendanceRecord | ShiftAssignment | 1:N | shiftAssignmentId | SetNull | Attendance |
| LeaveRequest | ApprovalInstance | 1:1 | id | Restrict | Approvals |
| Loan | ApprovalInstance | 1:1 | id | Restrict | Approvals |
| Mission | ApprovalInstance | 1:1 | id | Restrict | Approvals |
| PayrollPeriod | ApprovalInstance | 1:1 | id | Restrict | Approvals |
| AttendanceRecord | ApprovalInstance | 1:1 | id | Restrict | Approvals |
| TerminationRequest | ApprovalInstance | 1:1 | id | Restrict | Approvals |
| ShiftSwapRequest | ApprovalInstance | 1:1 | id | Restrict | Approvals |
| PayrollAmendment | ApprovalInstance | 1:1 | id | Restrict | Approvals |

---

## 3. API-Level Dependency Matrix

### 3.1 Controller Dependencies

| Controller | Depends On Services | Depends On Guards | Depends On Pipes | Depends On Interceptors |
|------------|-------------------|-------------------|------------------|------------------------|
| AuthController | AuthService | Public (login) / JwtAuthGuard (refresh, logout) | ValidationPipe | TransformInterceptor |
| EmployeesController | EmployeesService, AccessService | JwtAuthGuard, PermissionsGuard | ValidationPipe | TransformInterceptor |
| OrgController | OrgService, AccessService | JwtAuthGuard, PermissionsGuard | ValidationPipe | TransformInterceptor |
| AttendanceController | AttendanceService, DailyAttendanceService | JwtAuthGuard, PermissionsGuard | ValidationPipe | TransformInterceptor |
| ShiftsController | ShiftsService, AccessService | JwtAuthGuard, PermissionsGuard | ValidationPipe | TransformInterceptor |
| LeavesController | LeavesService, AccessService | JwtAuthGuard, PermissionsGuard | ValidationPipe | TransformInterceptor |
| PayrollController | PayrollService, AccessService | JwtAuthGuard, PermissionsGuard | ValidationPipe | TransformInterceptor |
| LoansController | LoansService, AccessService | JwtAuthGuard, PermissionsGuard | ValidationPipe | TransformInterceptor |
| ApprovalsController | ApprovalsService, AccessService | JwtAuthGuard, PermissionsGuard | ValidationPipe | TransformInterceptor |
| DocumentsController | DocumentsService, AccessService | JwtAuthGuard, PermissionsGuard | ValidationPipe | TransformInterceptor |
| ReportsController | ReportsService, AccessService | JwtAuthGuard, PermissionsGuard | ValidationPipe | TransformInterceptor |
| SettingsController | SettingsService, AccessService | JwtAuthGuard, PermissionsGuard | ValidationPipe | TransformInterceptor |
| BackupController | BackupService, AccessService | JwtAuthGuard, PermissionsGuard | ValidationPipe | TransformInterceptor |
| AdminController | AdminService, AccessService | JwtAuthGuard, PermissionsGuard | ValidationPipe | TransformInterceptor |
| DashboardController | DashboardService, AccessService | JwtAuthGuard, PermissionsGuard | ValidationPipe | TransformInterceptor |
| RecruitmentController | RecruitmentService | JwtAuthGuard, PermissionsGuard | ValidationPipe | TransformInterceptor |
| LifecycleController | LifecycleService | JwtAuthGuard, PermissionsGuard | ValidationPipe | TransformInterceptor |
| ProjectsController | ProjectsService | JwtAuthGuard, PermissionsGuard | ValidationPipe | TransformInterceptor |
| TasksController | TasksService | JwtAuthGuard, PermissionsGuard | ValidationPipe | TransformInterceptor |
| MissionsController | MissionsService | JwtAuthGuard, PermissionsGuard | ValidationPipe | TransformInterceptor |
| AssetsController | AssetsService | JwtAuthGuard, PermissionsGuard | ValidationPipe | TransformInterceptor |
| TrainingController | TrainingService | JwtAuthGuard, PermissionsGuard | ValidationPipe | TransformInterceptor |
| NotificationsController | NotificationsService | JwtAuthGuard | ValidationPipe | TransformInterceptor |
| AuditController | AuditService | JwtAuthGuard, PermissionsGuard | ValidationPipe | TransformInterceptor |
| SettingsController | SettingsService | JwtAuthGuard, PermissionsGuard | ValidationPipe | TransformInterceptor |
| BackupController | BackupService | JwtAuthGuard, PermissionsGuard | ValidationPipe | TransformInterceptor |
| AuthController | AuthService | Public / JwtAuthGuard | ValidationPipe | TransformInterceptor |

---

## 4. Frontend Module Dependencies

### 4.1 Page Dependencies

| Frontend Page | Depends On API | Depends On Components | Depends On Libs | State Management |
|---------------|---------------|----------------------|-----------------|------------------|
| Login.tsx | AuthController | ui/base.tsx, ui/Modal.tsx | api.ts, auth.tsx | Local + React Context |
| Employees.tsx | EmployeesController | ui/DataTable.tsx, ui/Modal.tsx, EntityPicker | api.ts, format.ts, useList.ts | React Query |
| EmployeePanel.tsx | EmployeePanelController | ui/Tabs.tsx, ui/DataTable.tsx, TaskCountdown, TaskStatusMark | api.ts, format.ts, useList.ts | React Query |
| Attendance.tsx | AttendanceController | ui/DataTable.tsx, DatePicker, EntityPicker | api.ts, format.ts, useList.ts | React Query |
| Shifts.tsx | ShiftsController | ui/DataTable.tsx, Modal, EntityPicker | api.ts, format.ts, useList.ts | React Query |
| Leaves.tsx | LeavesController | ui/DataTable.tsx, Modal, DatePicker, EntityPicker | api.ts, format.ts, useList.ts | React Query |
| Payroll.tsx | PayrollController | ui/DataTable.tsx, Modal, DatePicker | api.ts, format.ts, useList.ts | React Query |
| Loans.tsx | LoansController | ui/DataTable.tsx, Modal, DatePicker, EntityPicker | api.ts, format.ts, useList.ts | React Query |
| Approvals.tsx | ApprovalsController | ui/DataTable.tsx, Modal, Tabs | api.ts, format.ts, useList.ts | React Query |
| Documents.tsx | DocumentsController | ui/DataTable.tsx, Modal, DatePicker, EntityPicker | api.ts, format.ts, useList.ts | React Query |
| Reports.tsx | ReportsController | ui/DataTable.tsx, Modal, DatePicker | api.ts, format.ts, useList.ts | React Query |
| Settings.tsx | SettingsController | ui/DataTable.tsx, Modal, DatePicker | api.ts, format.ts, useList.ts | React Query |
| Dashboard.tsx | DashboardController | ui/DataTable.tsx, TeamPresence, TeamWork, TaskCountdown | api.ts, format.ts, useList.ts | React Query |
| Projects.tsx | ProjectsController | ui/DataTable.tsx, Modal, Tabs | api.ts, format.ts, useList.ts | React Query |
| Tasks.tsx | TasksController | ui/DataTable.tsx, Modal, Tabs | api.ts, format.ts, useList.ts | React Query |
| Missions.tsx | MissionsController | ui/DataTable.tsx, Modal, DatePicker, EntityPicker | api.ts, format.ts, useList.ts | React Query |
| Assets.tsx | AssetsController | ui/DataTable.tsx, Modal, DatePicker | api.ts, format.ts, useList.ts | React Query |
| Training.tsx | TrainingController | ui/DataTable.tsx, Modal | api.ts, format.ts, useList.ts | React Query |
| Reports.tsx | ReportsController | ui/DataTable.tsx, Modal | api.ts, format.ts, useList.ts | React Query |
| Settings.tsx | SettingsController | ui/DataTable.tsx, Modal | api.ts, format.ts, useList.ts | React Query |
| Backup.tsx | BackupController | ui/DataTable.tsx, Modal | api.ts, format.ts, useList.ts | React Query |
| Announcements.tsx | AnnouncementsController | ui/DataTable.tsx, Modal | api.ts, format.ts | React Query |
| Notifications.tsx | NotificationsController | ui/DataTable.tsx | api.ts | React Query |
| Approvals.tsx | ApprovalsController | ui/DataTable.tsx, Modal | api.ts, format.ts, useList.ts | React Query |
| Audit.tsx | AuditController | ui/DataTable.tsx | api.ts, format.ts | React Query |
| Login.tsx | AuthController | ui/Modal.tsx | api.ts, auth.tsx, theme.ts | Auth Context |
| Announcements.tsx | AnnouncementsController | ui/DataTable.tsx | api.ts | React Query |

### 4.2 Shared Component Dependencies

| Component | Depends On | Used By |
|-----------|-----------|---------|
| ui/base.tsx | React, lucide-react | All pages |
| ui/Modal.tsx | React, lucide-react, Portal | All pages with modals |
| ui/DataTable.tsx | React, lucide-react | All list pages |
| ui/DatePicker.tsx | React, format.ts | Leaves, Attendance, Payroll, Loans, Documents, Missions |
| ui/EntityPicker.tsx | React, useList.ts, api.ts | Employees, Leaves, Payroll, Loans, Documents, Missions, Projects |
| ui/Tabs.tsx | React | EmployeePanel, Approvals, Tasks, Projects |
| TeamPresence.tsx | DailyAttendanceService | Dashboard |
| TeamWork.tsx | DashboardService | Dashboard |
| TaskCountdown.tsx | useDeadlineClock | Dashboard, EmployeePanel, Tasks |
| TaskStatusMark.tsx | - | Dashboard, EmployeePanel, Tasks |
| TaskRetryReview.tsx | TasksService | Dashboard, Tasks |
| WorkCategory.tsx | - | Dashboard, Tasks, Projects, EmployeePanel |
| GlobalSearch.tsx | AuthService, api.ts | Layout |
| ChangePassword.tsx | AuthController | Layout |
| DailyAttendance.tsx | AttendanceService | Layout |
| PageBoundary.tsx | - | All pages |
| ErrorBoundary.tsx | - | App.tsx |

---

## 5. Critical Path Dependencies

### 3.1 Employee-to-Payroll Critical Path

```
EmployeesService (create employee)
    → ContractsService (create contract version)
    → AttendanceService (shift assignment)
    → LeavesService (leave balance)
    → LoansService (loan installments)
    → PayrollService.generate()
        → ContractsService (active version)
        → AttendanceService (overtime)
        → LeavesService (paid leave minutes)
        → LoansService (installments due)
        → PayrollItem upsert
        → Payslip recalculation
        → PayrollPeriod totals update
        → AuditService (financial audit)
        → NotificationService (payslip notification)
```

### 3.2 Leave-to-Attendance Critical Path

```
LeavesService.submitRequest()
    → LeaveTransaction.RESERVE created
    → ApprovalInstance created
    → ApprovalsService.onApproved()
        → LeavesService.onApproved()
            → LeaveTransaction.RESERVE → CONSUME
            → Leave balance updated
    → DailyAttendanceService.closeDay()
        → AttendanceRecord.status = LEAVE (if approved leave covers day)
```

### 3.3 Loan-to-Payroll Critical Path

```
LoansService.createLoan()
    → LoanInstallment created (monthly)
    → ApprovalsService.approve()
        → Loan.status = APPROVED
LoansService.disbursement()
    → Loan.status = SETTLING
PayrollService.generate()
    → LoanInstallment due in period
    → PayrollItem LOAN_INSTALLMENT created
    → PayrollItem.amount deducted from gross
```

---

## 5. Dependency Risk Assessment

| Dependency | Risk Level | Mitigation |
|------------|------------|------------|
| PayrollService → LoansService | High | Circuit breaker, timeout, fallback |
| PayrollService → AttendanceService | High | Circuit breaker, cached data |
| PayrollService → LeavesService | High | Circuit breaker, cached data |
| ApprovalsService → All domain handlers | High | Registry pattern, graceful degradation |
| DocumentsService → External storage | Medium | Retry with backoff, local fallback |
| NotificationsService → External (email/SMS) | Low | Async queue, dead letter queue |
| DashboardService → 8 services | Medium | Parallel queries, timeout per service |
| ReportsService → 6+ services | Medium | Async generation, cached results |
| ApprovalsService → 7 domain handlers | High | Registry pattern, timeout per handler |
| DailyAttendanceService → AttendanceService | Medium | Advisory lock, idempotent |

---

## 6. Circular Dependency Check

**Status:** ✅ **No circular dependencies detected**

Verified by analyzing:
- Service constructor injections (no circular imports)
- Module imports in `app.module.ts` (proper hierarchy)
- Prisma relations (no circular FKs)
- Frontend component imports (no cycles)

---

## 7. Deployment Order

Based on dependencies, services must be available in this order:

1. **Foundation**: PrismaService, ConfigService, JwtService, AccessService, AuditService, NotificationService
2. **Core Domain**: AuthService, EmployeesService, OrgService, ContractsService, AttendanceService
3. **Business Logic**: ContractsService, AttendanceService, DailyAttendanceService, LeavesService, ShiftsService, ProjectsService, TasksService, MissionsService, AssetsService, TrainingService, RecruitmentService, LifecycleService, AdminService
4. **Complex Workflows**: PayrollService, LoansService, LeavesService, ApprovalsService, DocumentsService, ReportsService, SettingsService, BackupService
5. **Aggregation**: DashboardService, ReportsService
5. **Frontend**: All pages (depends on API availability)

---

**Document Version:** 1.0  
**Last Updated:** 2026-11-18  
**Status:** Complete  
**Source:** Backend service constructors, Prisma schema, Controller imports, Frontend page imports