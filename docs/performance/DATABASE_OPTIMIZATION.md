# Sana HRMS - Database Optimization Guide

**Version:** 1.0  
**Date:** 2026-11-18  
**Audience:** Database Engineers, Backend Developers, DevOps

---

## 1. Current Database State

### 1.1 Schema Overview

| Metric | Value |
|--------|-------|
| Models | 60+ |
| Tables | 60+ |
| Indexes | 150+ |
| Foreign Keys | 200+ |
| Enums | 25+ |

### 1.2 Current Index Coverage

| Table | Row Est. | Indexes | Coverage | Status |
|-------|----------|---------|----------|--------|
| Employee | 10,000+ | 8 | Good | ✅ |
| AttendanceRecord | 1,000,000+ | 5 | Good | ✅ |
| AttendanceEvent | 5,000,000+ | 2 | Basic | ⚠️ |
| LeaveRequest | 100,000+ | 4 | Good | ✅ |
| LeaveTransaction | 500,000+ | 3 | Good | ✅ |
| PayrollItem | 500,000+ | 3 | Good | ✅ |
| Contract | 50,000+ | 3 | Good | ✅ |
| Document | 100,000+ | 3 | Basic | ⚠️ |
| Task | 100,000+ | 5 | Good | ✅ |
| ProjectTask | 50,000+ | 4 | Basic | ⚠️ |
| AuditLog | 1,000,000+ | 3 | Basic | ⚠️ |

---

## 2. Index Optimization

### 2.1 Missing Critical Indexes

```sql
-- AttendanceEvent: Device sync queries
CREATE INDEX CONCURRENTLY idx_attendance_event_device_time 
ON "AttendanceEvent" ("deviceId", "eventTime" DESC);

-- AttendanceEvent: Dashboard todayAttendance queries
CREATE INDEX CONCURRENTLY idx_attendance_event_emp_time_type 
ON "AttendanceEvent" ("employeeId", "eventTime", "type");

-- AttendanceRecord: Dashboard queries with status filter
CREATE INDEX CONCURRENTLY idx_attendance_record_emp_date_status 
ON "AttendanceRecord" ("employeeId", "workDate", "status");

-- Employee: Dashboard filters
CREATE INDEX CONCURRENTLY idx_employee_company_status_orgunit 
ON "Employee" ("companyId", "status", "orgUnitId");

CREATE INDEX CONCURRENTLY idx_employee_company_status_branch 
ON "Employee" ("companyId", "status", "branchId");

CREATE INDEX CONCURRENTLY idx_employee_company_emp_type_status 
ON "Employee" ("companyId", "employmentType", "status");

-- AttendanceRecord: Soft delete queries
CREATE INDEX CONCURRENTLY idx_attendance_record_company_deleted_status 
ON "AttendanceRecord" ("companyId", "deletedAt", "status");
```

### 2.2 Composite Indexes for Common Query Patterns

```sql
-- Employees list with filters (company + status + orgUnit)
CREATE INDEX CONCURRENTLY idx_employee_company_status_orgunit 
ON "Employee" ("companyId", "status", "orgUnitId");

-- Employee search by company + status + branch
CREATE INDEX CONCURRENTLY idx_employee_company_status_branch 
ON "Employee" ("companyId", "status", "branchId");

-- Employee by company + employment type + status
CREATE INDEX CONCURRENTLY idx_employee_company_emptype_status 
ON "Employee" ("companyId", "employmentType", "status");

-- AttendanceRecord: dashboard queries with status filter
CREATE INDEX CONCURRENTLY idx_attendance_record_emp_date_status 
ON "AttendanceRecord" ("employeeId", "workDate", "status");

-- AttendanceRecord: month attendance queries
CREATE INDEX CONCURRENTLY idx_attendance_record_company_date_status 
ON "AttendanceRecord" ("companyId", "workDate", "status");

-- LeaveRequest: employee + date range queries
CREATE INDEX CONCURRENTLY idx_leave_request_emp_date_range 
ON "LeaveRequest" ("employeeId", "startAt", "endAt");

-- LeaveRequest: status + date range for dashboard
CREATE INDEX CONCURRENTLY idx_leave_request_status_date 
ON "LeaveRequest" ("status", "startAt");

-- AttendanceEvent: device sync queries
CREATE INDEX CONCURRENTLY idx_attendance_event_device_time 
ON "AttendanceEvent" ("deviceId", "eventTime" DESC);

-- AttendanceEvent: dashboard queries
CREATE INDEX CONCURRENTLY idx_attendance_event_emp_time_type 
ON "AttendanceEvent" ("employeeId", "eventTime", "type");
```

### 2.3 Partial Indexes for Soft Deletes

```sql
-- Already in migration 20261117_active_unique_indexes
-- But verify these exist:

-- Employee unique code per company (active only)
CREATE UNIQUE INDEX CONCURRENTLY idx_employee_company_code_active 
ON "Employee" ("companyId", "code") WHERE "deletedAt" IS NULL;

-- Employee unique nationalId (active only)
CREATE UNIQUE INDEX CONCURRENTLY idx_employee_national_id_active 
ON "Employee" ("nationalId") WHERE "deletedAt" IS NULL;

-- User unique username (active only)
CREATE UNIQUE INDEX CONCURRENTLY idx_user_username_active 
ON "User" ("username") WHERE "deletedAt" IS NULL;

-- Company unique code (active only)
CREATE UNIQUE INDEX CONCURRENTLY idx_company_code_active 
ON "Company" ("code") WHERE "deletedAt" IS NULL;
```

---

## 3. Query Optimization

### 3.1 Dashboard Query Optimization

**Problem**: 12 separate count queries in `managementDashboard`

**Solution 1: Single Aggregation Query**

```sql
-- Single query replacing 12 count queries
SELECT 
  (SELECT count(*) FROM employee WHERE deleted_at IS NULL AND company_id = $1) as total_employees,
  (SELECT count(*) FROM employee WHERE deleted_at IS NULL AND status = 'ACTIVE' AND company_id = $1) as active_employees,
  (SELECT count(*) FROM leave_request WHERE status IN ('SUBMITTED','PENDING_SUPERVISOR','PENDING_MANAGER','PENDING_HR') 
   AND employee_id IN (SELECT id FROM employee WHERE company_id = $1)) as pending_leaves,
  (SELECT count(*) FROM attendance_correction WHERE status = 'PENDING' 
   AND employee_id IN (SELECT id FROM employee WHERE company_id = $1)) as pending_corrections,
  (SELECT count(*) FROM mission WHERE status IN ('REQUESTED','PENDING_APPROVAL') 
   AND employee_id IN (SELECT id FROM employee WHERE company_id = $1)) as pending_missions,
  (SELECT count(*) FROM shift_swap_request WHERE status = 'PENDING' 
   AND (from_employee_id IN (SELECT id FROM employee WHERE company_id = $1) 
        OR to_employee_id IN (SELECT id FROM employee WHERE company_id = $1))) as pending_swaps,
  (SELECT count(*) FROM contract 
   WHERE deleted_at IS NULL AND status IN ('ACTIVE','EXPIRING') 
   AND employee_id IN (SELECT id FROM employee WHERE company_id = $1)
   AND EXISTS (SELECT 1 FROM contract_version cv 
               WHERE cv.contract_id = contract.id 
               AND cv.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days')) as expiring_contracts,
  (SELECT count(*) FROM attendance_record 
   WHERE work_date = CURRENT_DATE AND status = 'ABSENT' 
   AND employee_id IN (SELECT id FROM employee WHERE company_id = $1)) as absent_today,
  (SELECT count(*) FROM task WHERE status NOT IN ('DONE','CANCELLED') AND company_id = $1) as open_tasks,
  (SELECT count(*) FROM loan WHERE status = 'PENDING_APPROVAL' 
   AND employee_id IN (SELECT id FROM employee WHERE company_id = $1)) as pending_loans;
```

**Prisma Implementation:**

```typescript
async managementDashboard(user: AuthenticatedUser) {
  const scope = this.access.employeeWhereFor(user);
  const companyId = user.scope.companyIds[0]; // assuming single company
  
  const result = await this.prisma.$queryRaw`
    SELECT 
      (SELECT count(*) FROM employee WHERE deleted_at IS NULL AND company_id = ${companyId}) as total_employees,
      (SELECT count(*) FROM employee WHERE deleted_at IS NULL AND status = 'ACTIVE' AND company_id = ${companyId}) as active_employees,
      (SELECT count(*) FROM leave_request WHERE status IN ('SUBMITTED','PENDING_SUPERVISOR','PENDING_MANAGER','PENDING_HR') 
       AND employee_id IN (SELECT id FROM employee WHERE company_id = ${companyId})) as pending_leaves,
      -- ... all other counts in single query
  `;
  
  return { data: result[0], success: true };
}
```

**Alternative: Materialized View (Recommended for Production)**

```sql
CREATE MATERIALIZED VIEW mv_dashboard_counts AS
SELECT 
  company_id,
  COUNT(*) FILTER (WHERE deleted_at IS NULL) as total_employees,
  COUNT(*) FILTER (WHERE deleted_at IS NULL AND status = 'ACTIVE') as active_employees,
  COUNT(*) FILTER (WHERE status IN ('SUBMITTED','PENDING_SUPERVISOR','PENDING_MANAGER','PENDING_HR')) as pending_leaves,
  -- ... all counts
FROM employee
LEFT JOIN leave_request ON leave_request.employee_id = employee.id
-- ... all necessary joins
GROUP BY company_id;

-- Refresh every 5 minutes
CREATE OR REPLACE FUNCTION refresh_dashboard_counts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_counts;
  RETURN NULL;
END $$;

-- Trigger on relevant table changes
CREATE TRIGGER refresh_dashboard_after_employee_change
AFTER INSERT OR UPDATE OR DELETE ON employee
FOR EACH STATEMENT EXECUTE FUNCTION refresh_dashboard_counts();
```

---

## 3.2 Attendance Query Optimization

### Current Issue: N+1 in `employeesForDay`

```typescript
// Current: Multiple includes causing N+1
const employees = await tx.employee.findMany({
  where: { ... },
  include: {
    attendanceRecords: { where: { workDate } },
    attendances: { where: { type: 'IN', eventTime: { gte: start, lt: end } }, orderBy: { eventTime: 'asc' } },
    projectAttendances: { where: { workDate }, select: { id: true } },
    shiftAssignments: { where: { workDate, status: { notIn: ['CANCELLED', 'REJECTED', 'OFF', 'REST'] } }, include: { shift: true } },
    leaveRequests: { where: { status: 'APPROVED', startAt: { lt: end }, endAt: { gt: start } }, select: { startAt: true, endAt: true } },
    missions: { where: { status: { in: ['APPROVED', 'IN_PROGRESS', 'COMPLETED'] }, startAt: { lt: end }, endAt: { gt: start } }, select: { startAt: true, endAt: true } },
  },
});
```

**Optimized: Single Query with Aggregation**

```sql
SELECT 
  e.id, e.code, e."firstName", e."lastName", e."companyId",
  -- Attendance records
  COALESCE(json_agg(DISTINCT jsonb_build_object(
    'id', ar.id, 'workDate', ar."workDate", 'status', ar.status,
    'workMinutes', ar."workMinutes", 'overtimeMinutes', ar."overtimeMinutes"
  )) FILTER (WHERE ar.id IS NOT NULL), '[]') as attendanceRecords,
  
  -- Attendance events (IN)
  COALESCE(json_agg(DISTINCT jsonb_build_object(
    'id', ae.id, 'type', ae.type, 'eventTime', ae."eventTime",
    'source', ae.source, 'deviceId', ae."deviceId"
  )) FILTER (WHERE ae.id IS NOT NULL), '[]') as attendances,
  
  -- Shift assignments
  COALESCE(json_agg(DISTINCT jsonb_build_object(
    'id', sa.id, 'workDate', sa."workDate", 'status', sa.status,
    'shift', jsonb_build_object('id', s.id, 'title', s.title, 'startTime', s."startTime", 'endTime', s."endTime"))
  ) FILTER (WHERE sa.id IS NOT NULL), '[]') as shiftAssignments,
  
  -- Leave requests
  COALESCE(json_agg(DISTINCT jsonb_build_object(
    'id', lr.id, 'startAt', lr."startAt", 'endAt', lr."endAt"
  )) FILTER (WHERE lr.id IS NOT NULL), '[]') as leaveRequests,
  
  -- Missions
  COALESCE(json_agg(DISTINCT jsonb_build_object(
    'id', m.id, 'startAt', m."startAt", 'endAt', m."endAt"
  )) FILTER (WHERE m.id IS NOT NULL), '[]') as missions,
  
  -- Project attendances
  COALESCE(json_agg(DISTINCT jsonb_build_object(
    'id', pa.id
  )) FILTER (WHERE pa.id IS NOT NULL), '[]') as projectAttendances
  
FROM employee e
LEFT JOIN attendance_record ar ON ar."employeeId" = e.id AND ar."workDate" = $1
LEFT JOIN attendance_event ae ON ae."employeeId" = e.id AND ae.type = 'IN' 
  AND ae."eventTime" >= $2 AND ae."eventTime" < $3
LEFT JOIN shift_assignment sa ON sa."employeeId" = e.id AND sa."workDate" = $1
  AND sa.status NOT IN ('CANCELLED','REJECTED','OFF','REST')
LEFT JOIN shift s ON s.id = sa."shiftId"
LEFT JOIN leave_request lr ON lr."employeeId" = e.id 
  AND lr.status = 'APPROVED' 
  AND lr."startAt" < $3 AND lr."endAt" > $1
LEFT JOIN mission m ON m."employeeId" = e.id 
  AND m.status IN ('APPROVED','IN_PROGRESS','COMPLETED')
  AND m."startAt" < $3 AND m."endAt" > $1
LEFT JOIN project_attendance pa ON pa."employeeId" = e.id AND pa."workDate" = $1
WHERE e."companyId" = $4 
  AND e.status = 'ACTIVE' 
  AND e."deletedAt" IS NULL
  AND e."hireDate" <= $1
  AND (e."terminationDate" IS NULL OR e."terminationDate" >= $1)
  AND e."user" IS NOT NULL AND e."user"->>'status' = 'ACTIVE' AND e."user"->>'deletedAt' IS NULL
GROUP BY e.id;
```

---

## 3.3 Attendance Event Ingestion Optimization

### Current: Batched Insert with Idempotency

```typescript
// attendance.service.ts - ingestEvents
async ingestEvents(dto: IngestEventsDto, user: AuthenticatedUser) {
  const events = dto.events.map(e => ({
    employeeId: e.employeeId,
    deviceId: e.deviceId,
    type: e.type,
    eventTime: new Date(e.eventTime),
    source: e.source,
    idempotencyKey: e.idempotencyKey,
    rawPayload: e.rawPayload,
    status: AttendanceRecordStatus.COMPLETE,
    latitude: e.latitude,
    longitude: e.longitude,
    locationName: e.locationName,
    deviationSeconds: e.deviationSeconds,
  });

  // Batch insert with ON CONFLICT DO NOTHING
  await this.prisma.attendanceEvent.createMany({
    data: events,
    skipDuplicates: true, // Uses idempotencyKey unique constraint
  });
}
```

**Optimization**: Use `createMany` with `skipDuplicates` (already implemented)

---

## 3.4 Leave Request Optimization

### Current: Balance Calculation

```typescript
// leaves.service.ts - getLeaveBalance
async getLeaveBalance(employeeId: string, leaveTypeId: string, user: AuthenticatedUser) {
  const transactions = await this.prisma.leaveTransaction.findMany({
    where: { employeeId, leaveTypeId },
    orderBy: { occurredAt: 'asc' },
  });
  
  // Calculate in memory
  const granted = transactions.filter(t => t.type === 'GRANT').reduce((sum, t) => sum + t.minutes, 0);
  const consumed = transactions.filter(t => t.type === 'CONSUME').reduce((sum, t) => sum + t.minutes, 0);
  const reserved = transactions.filter(t => t.type === 'RESERVE').reduce((sum, t) => sum + t.minutes, 0);
  const released = transactions.filter(t => t.type === 'RELEASE').reduce((sum, t) => sum + t.minutes, 0);
  
  return { granted, consumed, reserved, released, balance: granted - consumed - reserved };
}
```

**Optimized: Database-Level Aggregation**

```sql
-- Single query with aggregation
SELECT 
  SUM(CASE WHEN type = 'GRANT' THEN minutes ELSE 0 END) as granted,
  SUM(CASE WHEN type = 'CONSUME' THEN minutes ELSE 0 END) as consumed,
  SUM(CASE WHEN type = 'RESERVE' THEN minutes ELSE 0 END) as reserved,
  SUM(CASE WHEN type = 'RELEASE' THEN minutes ELSE 0 END) as released
FROM leave_transaction
WHERE employee_id = $1 AND leave_type_id = $2;
```

```typescript
// Prisma implementation
async getLeaveBalance(employeeId: string, leaveTypeId: string, user: AuthenticatedUser) {
  const result = await this.prisma.leaveTransaction.groupBy({
    by: ['type'],
    where: { employeeId, leaveTypeId },
    _sum: { minutes: true },
  });
  
  const totals = { GRANT: 0, CONSUME: 0, RESERVE: 0, RELEASE: 0 };
  for (const row of result) {
    totals[row.type] = row._sum.minutes ?? 0;
  }
  
  return {
    granted: totals.GRANT,
    consumed: totals.CONSUME,
    reserved: totals.RESERVE,
    released: totals.RELEASE,
    balance: totals.GRANT - totals.CONSUME - totals.RESERVE + totals.RELEASE,
  };
}
```

---

## 4. Payroll Optimization

### 4.1 Payroll Calculation Optimization

**Current Issue**: `generatePayrollItems` processes employees one by one

```typescript
// Current: Loop through employees
for (const employee of employees) {
  for (const component of components) {
    await this.calculatePayrollItem(period, employee, component);
  }
}
```

**Optimized: Batch Processing with Transaction**

```typescript
async generatePayrollItems(periodId: string, user: AuthenticatedUser) {
  const period = await this.prisma.payrollPeriod.findUniqueOrThrow({ where: { id: periodId } });
  const employees = await this.prisma.employee.findMany({
    where: { companyId: period.companyId, deletedAt: null, status: 'ACTIVE' },
    select: { id: true, monthlyBaseSalary: true },
  });
  
  const components = await this.prisma.payComponent.findMany({
    where: { companyId: period.companyId, isActive: true },
  });
  
  // Batch create all payroll items in single transaction
  const items = employees.flatMap(emp => 
    components.map(comp => ({
      periodId,
      employeeId: emp.id,
      componentId: comp.id,
      amount: this.calculateComponentAmount(comp, emp),
      quantity: 1,
    }))
  );
  
  await this.prisma.payrollItem.createMany({
    data: items,
    skipDuplicates: true,
  });
  
  return { created: items.length };
}
```

---

## 5. Index Maintenance & Monitoring

### 4.1 Index Usage Monitoring

```sql
-- Check index usage
SELECT 
  schemaname, 
  tablename, 
  indexname, 
  idx_scan, 
  idx_tup_read, 
  idx_tup_fetch,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan ASC;

-- Find unused indexes (idx_scan = 0)
SELECT 
  schemaname, 
  tablename, 
  indexname, 
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public' AND idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;

-- Find missing indexes (sequential scans)
SELECT 
  schemaname, 
  relname as table_name,
  seq_scan, 
  seq_tup_read,
  seq_tup_read / NULLIF(seq_scan, 0) as avg_tup_per_scan
FROM pg_stat_user_tables
WHERE schemaname = 'public' 
  AND seq_scan > 0
ORDER BY seq_tup_read DESC
LIMIT 20;
```

### 4.2 Index Maintenance Schedule

```sql
-- Weekly: Reindex bloated indexes
REINDEX INDEX CONCURRENTLY idx_attendance_record_emp_date_status;

-- Monthly: Analyze table statistics
ANALYZE VERBOSE employee;
ANALYZE VERBOSE attendance_record;
ANALYZE VERBOSE attendance_event;
ANALYZE VERBOSE leave_request;
```

---

## 4. Partitioning Strategy (For Scale)

### 4.1 Partitioning Strategy

```sql
-- AttendanceEvent: Partition by month
CREATE TABLE "AttendanceEvent_partitioned" (
  LIKE "AttendanceEvent" INCLUDING ALL
) PARTITION BY RANGE ("eventTime");

-- Monthly partitions
CREATE TABLE "AttendanceEvent_2026_01" PARTITION OF "AttendanceEvent_partitioned"
FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE "AttendanceEvent_2026_02" PARTITION OF "AttendanceEvent_partitioned"
FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

-- ... create monthly partitions

-- AttendanceRecord: Partition by month
CREATE TABLE "AttendanceRecord_partitioned" (
  LIKE "AttendanceRecord" INCLUDING ALL
) PARTITION BY RANGE ("workDate");
```

---

## 5. Connection Pooling

### 5.1 Prisma Connection Pool

```typescript
// prisma.service.ts
constructor(private readonly config: ConfigService) {
  super({
    datasources: { 
      db: { 
        url: config.get<string>('app.database.url') 
      } 
    },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
  
  // Connection pool via DATABASE_URL
  // DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=20&pool_timeout=10"
}
```

```yaml
# docker-compose.yml - Add PgBouncer
services:
  pgbouncer:
    image: edoburu/pgbouncer:latest
    environment:
      DATABASES_HOST: db
      DATABASES_PORT: 5432
      DATABASES_DBNAME: sana_hrms
      POOL_MODE: transaction
      DEFAULT_POOL_SIZE: 20
      MAX_CLIENT_CONN: 100
    depends_on:
      - db
    ports:
      - "127.0.0.1:6432:6432"
```

---

## 6. Query Monitoring & Alerting

### 6.1 Slow Query Detection

```sql
-- Enable pg_stat_statements
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET pg_stat_statements.track = 'all';
ALTER SYSTEM SET pg_stat_statements.max = 10000;
SELECT pg_reload_conf();

-- Monitor slow queries
SELECT 
  query,
  calls,
  mean_time,
  total_time,
  rows,
  100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
FROM pg_stat_statements
WHERE mean_time > 100
ORDER BY mean_time DESC
LIMIT 20;
```

### Alerting Rules

```yaml
# Prometheus alerts
groups:
  - name: database
    rules:
      - alert: HighQueryLatency
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High database query latency"
          
      - alert: ConnectionPoolExhaustion
        expr: pgbouncer_pool_usage > 0.8
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Connection pool near exhaustion"
```

---

## 6. Migration Safety Checklist

### Pre-Migration Checklist

- [ ] Backup database
- [ ] Test migration on staging copy
- [ ] Verify no duplicate values for new unique indexes
- [ ] Check index size vs available disk space
- [ ] Plan migration during low-traffic window
- [ ] Have rollback plan ready
- [ ] Notify stakeholders of maintenance window

### Migration Execution Order

1. **Add new indexes** (CONCURRENTLY, no lock)
2. **Create materialized views** (if applicable)
3. **Add partial unique indexes** (CONCURRENTLY)
4. **Partition large tables** (requires downtime or pg_partman)
5. **Update Prisma schema**
5. **Deploy application code**
6. **Monitor query performance**
6. **Drop unused indexes** (after verification)

---

## 7. Checklist

### Pre-Deployment

- [ ] All new indexes created CONCURRENTLY
- [ ] Materialized view created and refreshed
- [ ] PgBouncer configured and tested
- [ ] Connection pool limits configured
- [ ] Slow query monitoring enabled
- [ ] Index usage monitoring enabled
- [ ] Backup verified
- [ ] Rollback plan documented

### Post-Deployment

- [ ] Monitor query performance for 24h
- [ ] Verify index usage (pg_stat_user_indexes)
- [ ] Check connection pool usage
- [ ] Monitor slow query log
- [ ] Verify materialized view refresh
- [ ] Update documentation

---

**Document Version:** 1.0  
**Last Updated:** 2026-11-18  
**Next Review:** Sprint Planning  
**Owner:** Database Engineering Team