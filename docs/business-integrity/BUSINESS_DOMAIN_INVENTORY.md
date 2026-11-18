# Sana HRMS - Business Domain Inventory

**Version:** 1.0  
**Date:** 2026-11-18  
**Auditor:** Senior Business Logic Auditor  
**Classification:** INTERNAL  

---

## 1. Overview

This document catalogs all business domains implemented in Sana HRMS, their core entities, workflows, and current implementation status based on the Prisma schema (2,938 lines), service implementations, and API endpoints.

---

## 2. Business Domains Inventory

### 2.1 Core HR Domains

| Domain | Implementation Status | Primary Entities | Key Services | API Routes |
|--------|----------------------|------------------|--------------|------------|
| **Employee Management** | ✅ Complete | Employee, Contract, ContractVersion, EmploymentType | EmployeesService, EmployeePanelService | `/api/v1/employees`, `/api/v1/panel` |
| **Organizational Structure** | ✅ Complete | Company, Branch, OrgUnit, Position, Department | OrgService | `/api/v1/org` |
| **Employment Lifecycle** | ✅ Complete | OnboardingChecklist, OffboardingChecklist, TerminationRequest | LifecycleService | `/api/v1/lifecycle` |
| **Employee Panel (Self-Service)** | ✅ Complete | EmployeePanel (Tasks, Projects, Leaves, Missions, Payroll) | EmployeePanelService | `/api/v1/panel` |

### 2.2 Attendance & Time Management

| Domain | Implementation Status | Primary Entities | Key Services | API Routes |
|--------|----------------------|------------------|--------------|------------|
| **Daily Attendance** | ✅ Complete | AttendanceRecord, AttendanceEvent, ShiftAssignment, Shift | DailyAttendanceService, AttendanceService | `/api/v1/attendance`, `/api/v1/shifts` |
| **Attendance Calculation** | ✅ Complete | AttendanceCalculation logic | attendance-calculation.ts | Internal |
| **Shift Management** | ✅ Complete | Shift, ShiftAssignment, ShiftSwap | ShiftsService | `/api/v1/shifts` |
| **Project Attendance** | ✅ Complete | ProjectAttendance, ProjectTask | ProjectsService | `/api/v1/projects` |

### 2.3 Leave Management

| Domain | Implementation Status | Primary Entities | Key Services | API Routes |
|--------|----------------------|------------------|--------------|------------|
| **Leave Types & Policies** | ✅ Complete | LeaveType, LeavePolicy | LeavesService | `/api/v1/leaves` |
| **Leave Requests** | ✅ Complete | LeaveRequest, LeaveRequestEvent, LeaveTransaction | LeavesService | `/api/v1/leaves` |
| **Leave Balances** | ✅ Complete | LeaveTransaction (GRANT, CONSUME, RESERVE, ADJUST, EXPIRE) | LeavesService | `/api/v1/leaves/balance` |

### 2.4 Payroll & Compensation

| Domain | Implementation Status | Primary Entities | Key Services | API Routes |
|--------|----------------------|------------------|--------------|------------|
| **Pay Components** | ✅ Complete | PayComponent, PayRuleVersion | PayrollService | `/api/v1/payroll/components` |
| **Payroll Periods** | ✅ Complete | PayrollPeriod, PayrollStatus (DRAFT→REVIEWED→LOCKED→PUBLISHED) | PayrollService | `/api/v1/payroll/periods` |
| **Payroll Generation** | ✅ Complete | PayrollItem, Payslip | PayrollService | `/api/v1/payroll/generate` |
| **Payroll Amendments** | ✅ Complete | PayrollAmendment, PayrollAmendmentItem | PayrollService | `/api/v1/payroll/amendments` |
| **Payroll Reports** | ✅ Complete | ReportRun, Export utilities | PayrollService | `/api/v1/payroll/reports` |

### 2.5 Loans, Advances & Benefits

| Domain | Implementation Status | Primary Entities | Key Services | API Routes |
|--------|----------------------|------------------|--------------|------------|
| **Loans & Installments** | ✅ Complete | Loan, LoanInstallment, LoanInstallmentPayment | LoansService | `/api/v1/loans` |
| **Benefit Types & Packages** | ✅ Complete | BenefitType, BenefitPackage, BenefitPackageItem, EmployeeBenefit | LoansService | `/api/v1/loans/benefits` |
| **Advances** | ⚠️ Partially Implemented | Loan (loanType=ADVANCE) | LoansService | `/api/v1/loans` |

### 2.6 Recruitment & Onboarding

| Domain | Implementation Status | Primary Entities | Key Services | API Routes |
|--------|----------------------|------------------|--------------|------------|
| **Job Requisitions** | ✅ Complete | JobRequisition, JobOpening | RecruitmentService | `/api/v1/recruitment` |
| **Applicants & Interviews** | ✅ Complete | Applicant, Interview, InterviewFeedback, Offer | RecruitmentService | `/api/v1/recruitment` |
| **Onboarding/Offboarding** | ✅ Complete | OnboardingChecklist, OffboardingChecklist | LifecycleService | `/api/v1/lifecycle` |

### 2.7 Performance & Training

| Domain | Implementation Status | Primary Entities | Key Services | API Routes |
|--------|----------------------|------------------|--------------|------------|
| **Evaluations** | ✅ Complete | EvaluationForm, EvaluationItem, EvaluationCycle, Evaluation, EvaluationScore | EvaluationsService | `/api/v1/evaluations` |
| **Goals** | ✅ Complete | Goal | EvaluationsService | `/api/v1/evaluations/goals` |
| **Training & Certificates** | ✅ Complete | TrainingCourse, TrainingRecord, Certificate | TrainingService | `/api/v1/training` |

### 2.8 Assets & Equipment

| Domain | Implementation Status | Primary Entities | Key Services | API Routes |
|--------|----------------------|------------------|--------------|------------|
| **Asset Management** | ✅ Complete | Asset, AssetHandover, AssetMaintenance, AssetDepreciation | AssetsService | `/api/v1/assets` |

### 2.9 Administrative & Communication

| Domain | Implementation Status | Primary Entities | Key Services | API Routes |
|--------|----------------------|------------------|--------------|------------|
| **Correspondence** | ✅ Complete | Correspondence, CorrespondenceAttachment, CorrespondenceReferral | AdminService | `/api/v1/admin` |
| **Meetings** | ✅ Complete | Meeting, MeetingParticipant, MeetingAction | AdminService | `/api/v1/admin/meetings` |
| **Surveys & Suggestions** | ✅ Complete | Survey, SurveyQuestion, SurveyResponse, Suggestion | AdminService | `/api/v1/admin` |
| **Announcements** | ✅ Complete | Announcement, AnnouncementAck | AnnouncementsService | `/api/v1/announcements` |
| **Notifications** | ✅ Complete | Notification (multi-channel) | NotificationsService | `/api/v1/notifications` |

### 2.10 Projects & Tasks

| Domain | Implementation Status | Primary Entities | Key Services | API Routes |
|--------|----------------------|------------------|--------------|------------|
| **Project Management** | ✅ Complete | Project, ProjectMember, ProjectTask, ProjectAttendance | ProjectsService | `/api/v1/projects` |
| **Task Management** | ✅ Complete | Task, TaskAssignee, TaskComment, TaskAttachment, TaskDependency | TasksService | `/api/v1/tasks` |

### 2.11 System & Security

| Domain | Implementation Status | Primary Entities | Key Services | API Routes |
|--------|----------------------|------------------|--------------|------------|
| **Authentication & Authorization** | ✅ Complete | User, Role, Permission, UserSession, RefreshToken | AuthService, AccessService | `/api/v1/auth` |
| **Audit Logging** | ✅ Complete | AuditLog, AuditOutbox, SystemError | AuditService | `/api/v1/audit` |
| **Document Management** | ✅ Complete | Document, DocumentVersion | DocumentsService | `/api/v1/documents` |
| **Settings & Custom Fields** | ✅ Complete | Setting, CustomFieldDefinition, CustomFieldValue | SettingsService | `/api/v1/settings` |
| **Backup & Restore** | ✅ Complete | BackupHistory | BackupService | `/api/v1/backup` |

---

## 3. Cross-Domain Dependencies

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CROSS-DOMAIN DEPENDENCY MAP                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  EMPLOYEE ─────────────────────────────────────────────────────────────┐   │
│    │                                                                   │   │
│    ├──→ CONTRACTS (salary, allowances, work hours)                     │   │
│    ├──→ ATTENDANCE (shift assignments, overtime, check-ins)           │   │
│    ├──→ LEAVES (balance, requests, approvals)                         │   │
│    ├──→ PAYROLL (base salary, allowances, overtime, deductions)       │   │
│    ├──→ LOANS (installment deductions from payroll)                   │   │
│    ├──→ MISSIONS (attendance exemption, expense tracking)             │   │
│    ├──→ PROJECTS (task assignment, project attendance)                │   │
│    ├──→ ASSETS (handover tracking)                                    │   │
│    ├──→ DOCUMENTS (employee document storage)                         │   │
│    ├──→ APPROVALS (leave, mission, loan, attendance, payroll)         │   │
│    └──→ LIFECYCLE (onboarding, offboarding, termination)              │   │
│                                                                          │   │
│  ORG UNIT ─────────────────────────────────────────────────────────────┤   │
│    ├──→ DEPARTMENTS & POSITIONS                                        │   │
│    ├──→ EMPLOYEE ASSIGNMENTS                                           │   │
│    ├──→ ATTENDANCE SCOPE                                               │   │
│    ├──→ LEAVE APPROVAL SCOPE                                           │   │
│    └──→ PAYROLL SCOPE                                                  │   │
│                                                                          │   │
│  COMPANY ──────────────────────────────────────────────────────────────┤   │
│    ├──→ MULTI-TENANT ISOLATION                                         │   │
│    ├──→ CALENDARS & HOLIDAYS                                           │   │
│    ├──→ PAYROLL SETTINGS                                               │   │
│    └──→ BRANCHES & ORG UNITS                                           │   │
│                                                                          │   │
│  PAYROLL PERIOD ───────────────────────────────────────────────────────┤   │
│    ├──→ LOCKS GENERATION                                               │   │
│    ├──→ TRIGGERS LOAN INSTALLMENT DEDUCTIONS                          │   │
│    ├──→ GENERATES PAYSLIPS                                             │   │
│    ├──→ FEEDS APPROVAL WORKFLOW                                        │   │
│    └──→ ENABLES REPORTS                                                │   │
│                                                                          │   │
│  APPROVAL FLOW ────────────────────────────────────────────────────────┤   │
│    ├──→ LEAVE (specialized handler)                                    │   │
│    ├──→ MISSION                                                        │   │
│    ├──→ LOAN                                                           │   │
│    ├──→ ATTENDANCE_CORRECTION                                          │   │
│    ├──→ TERMINATION                                                    │   │
│    ├──→ PAYROLL (period review/lock/publish)                          │   │
│    └──→ SHIFT_SWAP                                                     │   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Domain Implementation Quality Assessment

| Domain | Data Model | Business Logic | API Coverage | Tests | Overall |
|--------|------------|----------------|--------------|-------|---------|
| Employee Management | ✅ Complete | ✅ Complete | ✅ Complete | ✅ Good | **Strong** |
| Attendance | ✅ Complete | ✅ Complete | ✅ Complete | ✅ Good | **Strong** |
| Leave Management | ✅ Complete | ✅ Complete | ✅ Complete | ✅ Good | **Strong** |
| Payroll | ✅ Complete | ✅ Complete | ✅ Complete | ✅ Good | **Strong** |
| Loans & Benefits | ✅ Complete | ✅ Complete | ✅ Complete | ✅ Good | **Strong** |
| Recruitment | ✅ Complete | ⚠️ Partial | ✅ Complete | ⚠️ Limited | **Good** |
| Approvals | ✅ Complete | ✅ Complete | ✅ Complete | ⚠️ Limited | **Good** |
| Projects/Tasks | ✅ Complete | ✅ Complete | ✅ Complete | ⚠️ Limited | **Good** |
| Assets | ✅ Complete | ✅ Complete | ✅ Complete | ⚠️ Limited | **Good** |
| Admin/Communication | ✅ Complete | ✅ Complete | ✅ Complete | ⚠️ Limited | **Good** |
| Settings/Config | ✅ Complete | ✅ Complete | ✅ Complete | ⚠️ Limited | **Good** |

---

## 5. Key Business Rules Identified

| Domain | Rule Count (Estimated) | Critical Rules | Configurable |
|--------|----------------------|----------------|--------------|
| Attendance Calculation | ~25 | 12 | 8 |
| Leave Balance & Quotas | ~15 | 8 | 7 |
| Payroll Calculation | ~35 | 15 | 10 |
| Loan Installments | ~15 | 8 | 5 |
| Approval Transitions | ~20 | 12 | 8 |
| Employee Lifecycle | ~20 | 10 | 5 |
| Organizational Scope | ~15 | 8 | 5 |

---

## 6. Summary Statistics

| Metric | Value |
|--------|-------|
| Total Prisma Models | ~95 |
| Business Domain Modules | 21 |
| API Controllers | 31 |
| Service Classes | 31 |
| DTO Classes | 150+ |
| Enums | 30+ |
| Custom Types | 15+ |
| Repository Methods | 1,200+ |
| Business Rules (Estimated) | 165+ |
| Test Files | 38 |

---

**Document Version:** 1.0  
**Last Updated:** 2026-11-18  
**Status:** Complete - Ready for detailed audits