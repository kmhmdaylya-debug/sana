
-- Add performance indexes for common query patterns
-- Created: 2026-11-19

-- 1. Employee list queries: company_id + org_unit_id + status
CREATE INDEX IF NOT EXISTS idx_employee_company_org_status
ON "Employee" ("companyId", "orgUnitId", "status");

-- 2. Attendance queries: employee_id + work_date (descending for recent first)
CREATE INDEX IF NOT EXISTS idx_attendance_employee_date
ON "AttendanceRecord" ("employeeId", "workDate" DESC);

-- 3. Audit log queries: user_id + created_at (descending for recent first)
CREATE INDEX IF NOT EXISTS idx_audit_log_user_created
ON "AuditLog" ("userId", "createdAt" DESC);

-- 4. Payslip queries: period_id + employee_id
CREATE INDEX IF NOT EXISTS idx_payslip_period_employee
ON "Payslip" ("periodId", "employeeId");

-- 5. Leave requests: status + start_at (descending)
CREATE INDEX IF NOT EXISTS idx_leave_request_status_date
ON "LeaveRequest" ("status", "startAt" DESC);

-- 6. Documents: employee_id + doc_type
CREATE INDEX IF NOT EXISTS idx_document_employee_type
ON "EmployeeDocument" ("employeeId", "docType");

-- 7. Notifications: user_id + read_at (partial index for unread)
CREATE INDEX IF NOT EXISTS idx_notification_user_read
ON "Notification" ("userId", "readAt")
WHERE "readAt" IS NULL;
