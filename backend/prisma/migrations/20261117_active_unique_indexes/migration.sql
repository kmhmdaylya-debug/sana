-- Migration: 20261117_active_unique_indexes
-- Description: Add partial unique indexes for soft-delete models to allow re-creation of deleted records
-- This migration adds partial unique indexes that only apply to non-deleted records (deletedAt IS NULL)

-- User: unique username per company among active users
CREATE UNIQUE INDEX IF NOT EXISTS "User_companyId_username_active_idx" ON "User" ("companyId", "username") WHERE "deletedAt" IS NULL;

-- Employee: unique code per company among active employees
CREATE UNIQUE INDEX IF NOT EXISTS "Employee_companyId_code_active_idx" ON "Employee" ("companyId", "code") WHERE "deletedAt" IS NULL;

-- Company: unique code among active companies
CREATE UNIQUE INDEX IF NOT EXISTS "Company_code_active_idx" ON "Company" ("code") WHERE "deletedAt" IS NULL;

-- Branch: unique code per company among active branches
CREATE UNIQUE INDEX IF NOT EXISTS "Branch_companyId_code_active_idx" ON "Branch" ("companyId", "code") WHERE "deletedAt" IS NULL;

-- OrgUnit: unique code per company among active org units
CREATE UNIQUE INDEX IF NOT EXISTS "OrgUnit_companyId_code_active_idx" ON "OrgUnit" ("companyId", "code") WHERE "deletedAt" IS NULL;

-- Position: unique code per company among active positions
CREATE UNIQUE INDEX IF NOT EXISTS "Position_companyId_code_active_idx" ON "Position" ("companyId", "code") WHERE "deletedAt" IS NULL;

-- WorkLocation: unique code per company among active work locations
CREATE UNIQUE INDEX IF NOT EXISTS "WorkLocation_companyId_code_active_idx" ON "WorkLocation" ("companyId", "code") WHERE "deletedAt" IS NULL;

-- CostCenter: unique code per company among active cost centers
CREATE UNIQUE INDEX IF NOT EXISTS "CostCenter_companyId_code_active_idx" ON "CostCenter" ("companyId", "code") WHERE "deletedAt" IS NULL;

-- Calendar: unique name per company among active calendars
CREATE UNIQUE INDEX IF NOT EXISTS "Calendar_companyId_name_active_idx" ON "Calendar" ("companyId", "name") WHERE "deletedAt" IS NULL;

-- Shift: unique code per company among active shifts
CREATE UNIQUE INDEX IF NOT EXISTS "Shift_companyId_code_active_idx" ON "Shift" ("companyId", "code") WHERE "deletedAt" IS NULL;

-- LeaveType: unique code per company among active leave types
CREATE UNIQUE INDEX IF NOT EXISTS "LeaveType_companyId_code_active_idx" ON "LeaveType" ("companyId", "code") WHERE "deletedAt" IS NULL;

-- Contract: unique code per company among active contracts
CREATE UNIQUE INDEX IF NOT EXISTS "Contract_companyId_code_active_idx" ON "Contract" ("companyId", "code") WHERE "deletedAt" IS NULL;

-- Document: unique document number per employee among active documents
CREATE UNIQUE INDEX IF NOT EXISTS "EmployeeDocument_employeeId_documentNumber_active_idx" ON "EmployeeDocument" ("employeeId", "documentNumber") WHERE "deletedAt" IS NULL;

-- Asset: unique code per company among active assets
CREATE UNIQUE INDEX IF NOT EXISTS "Asset_companyId_code_active_idx" ON "Asset" ("companyId", "code") WHERE "deletedAt" IS NULL;

-- TrainingCourse: unique code per company among active training courses
CREATE UNIQUE INDEX IF NOT EXISTS "TrainingCourse_companyId_code_active_idx" ON "TrainingCourse" ("companyId", "code") WHERE "deletedAt" IS NULL;

-- JobRequisition: unique code per company among active job requisitions
CREATE UNIQUE INDEX IF NOT EXISTS "JobRequisition_companyId_code_active_idx" ON "JobRequisition" ("companyId", "code") WHERE "deletedAt" IS NULL;

-- JobOpening: unique title per requisition among active job openings
CREATE UNIQUE INDEX IF NOT EXISTS "JobOpening_requisitionId_title_active_idx" ON "JobOpening" ("requisitionId", "title") WHERE "deletedAt" IS NULL;

-- Applicant: unique nationalId per opening among active applicants
CREATE UNIQUE INDEX IF NOT EXISTS "Applicant_openingId_nationalId_active_idx" ON "Applicant" ("openingId", "nationalId") WHERE "deletedAt" IS NULL;

-- Offer: unique version per applicant among active offers
CREATE UNIQUE INDEX IF NOT EXISTS "Offer_applicantId_version_active_idx" ON "Offer" ("applicantId", "version") WHERE "deletedAt" IS NULL;

-- EvaluationForm: unique name per company among active evaluation forms
CREATE UNIQUE INDEX IF NOT EXISTS "EvaluationForm_companyId_name_active_idx" ON "EvaluationForm" ("companyId", "name") WHERE "deletedAt" IS NULL;

-- EvaluationCycle: unique name per company among active evaluation cycles
CREATE UNIQUE INDEX IF NOT EXISTS "EvaluationCycle_companyId_name_active_idx" ON "EvaluationCycle" ("companyId", "name") WHERE "deletedAt" IS NULL;

-- TrainingCourse: unique code per company among active training courses
CREATE UNIQUE INDEX IF NOT EXISTS "TrainingCourse_companyId_code_active_idx" ON "TrainingCourse" ("companyId", "code") WHERE "deletedAt" IS NULL;

-- Certificate: unique name per employee among active certificates
CREATE UNIQUE INDEX IF NOT EXISTS "Certificate_employeeId_name_active_idx" ON "Certificate" ("employeeId", "name") WHERE "deletedAt" IS NULL;

-- OnboardingChecklistTemplate: unique name per company among active templates
CREATE UNIQUE INDEX IF NOT EXISTS "OnboardingChecklistTemplate_companyId_name_active_idx" ON "OnboardingChecklistTemplate" ("companyId", "name") WHERE "deletedAt" IS NULL;

-- OffboardingChecklist: unique employeeId among active offboarding checklists
CREATE UNIQUE INDEX IF NOT EXISTS "OffboardingChecklist_employeeId_active_idx" ON "OffboardingChecklist" ("employeeId") WHERE "deletedAt" IS NULL;

-- TerminationRequest: unique employeeId among active termination requests
CREATE UNIQUE INDEX IF NOT EXISTS "TerminationRequest_employeeId_active_idx" ON "TerminationRequest" ("employeeId") WHERE "deletedAt" IS NULL;

-- Announcement: unique title per company among active announcements
CREATE UNIQUE INDEX IF NOT EXISTS "Announcement_companyId_title_active_idx" ON "Announcement" ("companyId", "title") WHERE "deletedAt" IS NULL;

-- Meeting: unique title per company among active meetings
CREATE UNIQUE INDEX IF NOT EXISTS "Meeting_companyId_title_active_idx" ON "Meeting" ("companyId", "title") WHERE "deletedAt" IS NULL;

-- Survey: unique title per company among active surveys
CREATE UNIQUE INDEX IF NOT EXISTS "Survey_companyId_title_active_idx" ON "Survey" ("companyId", "title") WHERE "deletedAt" IS NULL;

-- Role: unique code among active roles
CREATE UNIQUE INDEX IF NOT EXISTS "Role_code_active_idx" ON "Role" ("code") WHERE "deletedAt" IS NULL;

-- Permission: unique code among active permissions
CREATE UNIQUE INDEX IF NOT EXISTS "Permission_code_active_idx" ON "Permission" ("code") WHERE "deletedAt" IS NULL;

-- User: unique email among active users
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_active_idx" ON "User" ("email") WHERE "deletedAt" IS NULL;

-- Drop old unique constraints that don't have the WHERE clause
-- Note: These might fail if the constraints don't exist, which is fine
-- ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_username_key";
-- ALTER TABLE "Employee" DROP CONSTRAINT IF EXISTS "Employee_companyId_code_key";
-- ALTER TABLE "Company" DROP CONSTRAINT IF EXISTS "Company_code_key";
-- ALTER TABLE "Branch" DROP CONSTRAINT IF EXISTS "Branch_companyId_code_key";
-- ALTER TABLE "OrgUnit" DROP CONSTRAINT IF EXISTS "OrgUnit_companyId_code_key";
-- ALTER TABLE "Position" DROP CONSTRAINT IF EXISTS "Position_companyId_code_key";
-- ALTER TABLE "WorkLocation" DROP CONSTRAINT IF EXISTS "WorkLocation_companyId_code_key";
-- ALTER TABLE "CostCenter" DROP CONSTRAINT IF EXISTS "CostCenter_companyId_code_key";
-- ALTER TABLE "Calendar" DROP CONSTRAINT IF EXISTS "Calendar_companyId_name_key";
-- ALTER TABLE "Shift" DROP CONSTRAINT IF EXISTS "Shift_companyId_code_key";
-- ALTER TABLE "LeaveType" DROP CONSTRAINT IF EXISTS "LeaveType_companyId_code_key";
-- ALTER TABLE "Contract" DROP CONSTRAINT IF EXISTS "Contract_companyId_code_key";
-- ALTER TABLE "EmployeeDocument" DROP CONSTRAINT IF EXISTS "EmployeeDocument_employeeId_documentNumber_key";
-- ALTER TABLE "Asset" DROP CONSTRAINT IF EXISTS "Asset_companyId_code_key";
-- ALTER TABLE "TrainingCourse" DROP CONSTRAINT IF EXISTS "TrainingCourse_companyId_code_key";
-- ALTER TABLE "JobRequisition" DROP CONSTRAINT IF EXISTS "JobRequisition_companyId_code_key";
-- ALTER TABLE "JobOpening" DROP CONSTRAINT IF EXISTS "JobOpening_requisitionId_title_key";
-- ALTER TABLE "Applicant" DROP CONSTRAINT IF EXISTS "Applicant_openingId_nationalId_key";
-- ALTER TABLE "Offer" DROP CONSTRAINT IF EXISTS "Offer_applicantId_version_key";
-- ALTER TABLE "EvaluationForm" DROP CONSTRAINT IF EXISTS "EvaluationForm_companyId_name_key";
-- ALTER TABLE "EvaluationCycle" DROP CONSTRAINT IF EXISTS "EvaluationCycle_companyId_name_key";
-- ALTER TABLE "TrainingCourse" DROP CONSTRAINT IF EXISTS "TrainingCourse_companyId_code_key";
-- ALTER TABLE "Certificate" DROP CONSTRAINT IF EXISTS "Certificate_employeeId_name_key";
-- ALTER TABLE "OnboardingChecklistTemplate" DROP CONSTRAINT IF EXISTS "OnboardingChecklistTemplate_companyId_name_key";
-- ALTER TABLE "OffboardingChecklist" DROP CONSTRAINT IF EXISTS "OffboardingChecklist_employeeId_key";
-- ALTER TABLE "TerminationRequest" DROP CONSTRAINT IF EXISTS "TerminationRequest_employeeId_key";
-- ALTER TABLE "Announcement" DROP CONSTRAINT IF EXISTS "Announcement_companyId_title_key";
-- ALTER TABLE "Meeting" DROP CONSTRAINT IF EXISTS "Meeting_companyId_title_key";
-- ALTER TABLE "Survey" DROP CONSTRAINT IF EXISTS "Survey_companyId_title_key";
-- ALTER TABLE "Role" DROP CONSTRAINT IF EXISTS "Role_code_key";
-- ALTER TABLE "Permission" DROP CONSTRAINT IF EXISTS "Permission_code_key";
-- ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_email_key";