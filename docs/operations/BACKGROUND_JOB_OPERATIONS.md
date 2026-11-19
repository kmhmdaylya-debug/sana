# Sana HRMS - Background Job Operations

**Version:** 1.0  
**Date:** 2026-11-18  
**Environment:** Production / Staging  
**Classification:** INTERNAL  

---

## 1. Overview

This document covers the operational procedures for background jobs and scheduled tasks in Sana HRMS. It covers job inventory, scheduling, monitoring, failure handling, and scaling considerations.

**Current State:** Jobs run inline, via cron, or through the audit outbox processor. No dedicated queue system (Bull/BullMQ) implemented yet.

---

## 2. Job Inventory

### 2.1 Scheduled Jobs (Cron-based)

| Job | Schedule | Implementation | Timeout | Owner |
|-----|----------|----------------|---------|-------|
| **Database Backup** | Daily 02:00 | Host cron → `POST /api/v1/backup/run` | 60 min | DevOps |
| **Backup Cleanup** | Daily 03:00 | Host cron → Prisma delete | 5 min | DevOps |
| **Offsite Sync** | Post-backup | Host cron → `aws s3 sync` | 30 min | DevOps |

### 2.2 Event-Driven Jobs (Inline/Async)

| Job | Trigger | Implementation | Concurrency | Owner |
|-----|---------|----------------|-------------|-------|
| **Payroll Calculation** | Manual / Monthly | `PayrollService.calculate()` | Serial | Backend |
| **Payslip Generation** | After calc / Monthly | `PayrollService.generatePayslips()` | Serial | Backend |
| **Attendance Processing** | Real-time + Batch | `AttendanceService.process()` | Parallel | Backend |
| **Leave Accrual** | Daily / Monthly | `LeaveService.accrue()` | Serial | Backend |
| **Notification Delivery** | Event-driven | `NotificationService.send()` | High | Backend |
| **Audit Outbox Processing** | Continuous | `AuditOutboxProcessor` | Serial | Backend |
| **Report Generation** | On-demand / Scheduled | `ReportsService.generate()` | Parallel (3) | Backend |
| **Document Processing** | Upload event | `DocumentService.process()` | Parallel | Backend |

### 2.3 Audit Outbox Processor (Implemented)

| Property | Value |
|----------|-------|
| **Implementation** | `AuditOutboxProcessor` (NestJS) |
| **Pattern** | Polling / Transactional outbox |
| **Poll Interval** | 5 seconds |
| **Batch Size** | 100 records |
| **Retry Policy** | Exponential backoff (max 3) |
| **Dead Letter** | Not implemented |

---

## 3. Job Scheduling and Configuration

### 3.1 Cron Configuration (Host Level)

```bash
# /etc/cron.d/sana-hrms-backup
# Daily backup at 02:00
0 2 * * * root /usr/bin/docker exec sana-backend node -e "
const fetch = require('node-fetch');
fetch('http://127.0.0.1:4114/api/v1/backup/run', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + process.env.ADMIN_TOKEN }
}).then(r => console.log('Backup:', r.status));
"

# Cleanup at 03:00
0 3 * * * root /usr/bin/docker exec sana-backend node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const backups = await p.backupHistory.findMany({
    where: { result: 'SUCCESS' },
    orderBy: { startedAt: 'desc' },
    skip: 10,
    select: { id: true, fileName: true }
  });
  for (const b of backups) {
    await p.backupHistory.delete({ where: { id: b.id } });
    console.log('Deleted:', b.fileName);
  }
  await p.\$disconnect();
})();
"

# Offsite sync at 03:30
30 3 * * * root aws s3 sync /data/sana/backups s3://sana-hrms-backups/prod/ --storage-class GLACIER_IR --sse AES256
```

### 3.2 Application-Level Scheduling (Not Yet Implemented)

**Planned:** NestJS Schedule (`@nestjs/schedule`) or Bull/BullMQ for:
- Payroll calculation scheduling
- Leave accrual
- Report generation
- Audit outbox processing (replace polling)

---

## 4. Monitoring and Observability

### 4.1 Current Monitoring (Staging)

| Job | Monitoring | Alerting |
|-----|------------|----------|
| **Backup** | `BackupFailed`, `BackupTooOld` alerts | ✅ Critical/Warning |
| **Audit Outbox** | Log-based (manual) | ❌ |
| **Payroll** | Manual / Log-based | ❌ |
| **Notifications** | Log-based | ❌ |

### 4.2 Required Metrics (Not Yet Implemented)

| Metric | Name | Type | Labels |
|--------|------|------|--------|
| **Job Duration** | `sana_job_duration_seconds` | Histogram | job, status |
| **Job Success** | `sana_job_success_total` | Counter | job |
| **Job Failure** | `sana_job_failure_total` | Counter | job, error_type |
| **Queue Depth** | `sana_job_queue_depth` | Gauge | job |
| **Job Retry Count** | `sana_job_retry_total` | Counter | job |

### 4.3 Health Checks for Jobs

```bash
# Backup health
curl -H "Authorization: Bearer <token>" https://sana-hrms.com/api/v1/backup/history?limit=1
# Check: latest result == "SUCCESS", age < 36 hours

# Audit outbox lag
docker exec sana-db psql -U sana -d sana_hrms -c "
  SELECT count(*) as pending, max(created_at) as oldest
  FROM audit_outbox WHERE processed_at IS NULL;
"
# Alert if pending > 1000 or oldest > 1 hour

# Payroll status
curl -H "Authorization: Bearer <token>" https://sana-hrms.com/api/v1/payroll/periods?limit=5
# Check: latest period status != "CALCULATING" for > 30 min
```

---

## 5. Failure Handling and Retry

### 5.1 Current Retry Behavior

| Job | Retry Policy | Max Retries | Dead Letter |
|-----|--------------|-------------|-------------|
| **Backup** | Manual re-trigger | Manual | Manual |
| **Payroll** | Manual re-trigger | Manual | Manual |
| **Notifications** | None (fire-and-forget) | 0 | Lost |
| **Audit Outbox** | Exponential backoff | 3 | Not implemented |
| **Reports** | Manual re-trigger | Manual | Manual |

### 5.2 Required Retry Framework (Planned)

```typescript
// Planned: Bull/BullMQ with standardized retry
const jobDefaults = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 5000, // 5s, 10s, 20s
  },
  removeOnComplete: true,
  removeOnFail: false, // Keep for inspection
};

// Dead letter queue for failed jobs
const deadLetterQueue = new Queue('dead-letter');
```

### 5.3 Idempotency

| Job | Idempotency Key | Implementation |
|-----|-----------------|----------------|
| **Backup** | Timestamp + UUID | Unique backup ID |
| **Payroll** | Period ID | Single calculation per period |
| **Notifications** | Notification ID | Unique notification ID |
| **Audit** | Outbox ID | Unique outbox ID |
| **Reports** | Report ID + params | Unique report ID |

---

## 6. Scaling Considerations

### 6.1 Current Limits

| Job | Current Capacity | Bottleneck | Scaling Plan |
|-----|------------------|------------|--------------|
| **Backup** | ~45 min (1GB) | pg_dump single-threaded | Parallel pg_dump, incremental |
| **Payroll** | 8 min (1200 emp) | Single-threaded calc | Batch processing, worker pool |
| **Notifications** | Inline | Blocks API response | Queue + workers |
| **Reports** | 3 parallel | Memory | Worker pool + queue |
| **Audit Outbox** | Polling 5s | DB polling | Streaming / CDC |

### 6.2 Projected Scaling (2000 Employees)

| Job | Current | Projected | Mitigation |
|-----|---------|-----------|------------|
| **Backup** | 45 min | 2-3 hours | Parallel pg_dump, incremental |
| **Payroll** | 8 min | 30 min | Batch processing, background workers |
| **Notifications** | Inline | 10k/day | Redis + BullMQ workers |
| **Reports** | 3 parallel | 10 parallel | Worker pool + priority queue |
| **Audit** | Polling | High volume | PostgreSQL logical replication |

---

## 7. Operational Procedures

### 7.1 Manual Job Trigger

```bash
# Backup
curl -X POST https://sana-hrms.com/api/v1/backup/run \
  -H "Authorization: Bearer <admin-token>"

# Payroll Calculation
curl -X POST https://sana-hrms.com/api/v1/payroll/periods/<id>/calculate \
  -H "Authorization: Bearer <admin-token>"

# Payslip Generation
curl -X POST https://sana-hrms.com/api/v1/payroll/payslips/generate \
  -H "Authorization: Bearer <admin-token>" \
  -d '{"periodId": "<period-id>"}'

# Report Generation
curl -X POST https://sana-hrms.com/api/v1/reports/generate \
  -H "Authorization: Bearer <admin-token>" \
  -d '{"type": "payroll", "period": "2026-11"}'
```

### 7.2 Job Status Check

```bash
# Backup status
curl -H "Authorization: Bearer <token>" https://sana-hrms.com/api/v1/backup/history?limit=5

# Payroll period status
curl -H "Authorization: Bearer <token>" https://sana-hrms.com/api/v1/payroll/periods?limit=5

# Audit outbox lag
docker exec sana-db psql -U sana -d sana_hrms -c "
  SELECT count(*) as pending, max(created_at) as oldest
  FROM audit_outbox WHERE processed_at IS NULL;
"
```

### 7.3 Manual Retry

```bash
# Retry backup
curl -X POST https://sana-hrms.com/api/v1/backup/run -H "Authorization: Bearer <token>"

# Retry payroll calculation
curl -X POST https://sana-hrms.com/api/v1/payroll/periods/<id>/calculate -H "Authorization: Bearer <token>"

# Retry notification (resend)
curl -X POST https://sana-hrms.com/api/v1/notifications/resend \
  -H "Authorization: Bearer <token>" \
  -d '{"notificationId": "<id>"}'
```

### 7.4 Emergency Job Control

```bash
# Stop all background processing (stop backend)
docker compose stop backend

# Kill specific long-running query
docker exec sana-db psql -U sana -d sana_hrms -c "
  SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
  WHERE query LIKE '%payroll%' AND state = 'active' AND now() - query_start > INTERVAL '10 minutes';
"

# Clear audit outbox (emergency)
docker exec sana-db psql -U sana -d sana_hrms -c "
  DELETE FROM audit_outbox WHERE processed_at IS NULL AND created_at < NOW() - INTERVAL '24 hours';
"
```

---

## 8. Job Reliability Improvements (Planned)

### 8.1 Phase 1: Queue System (Sprint 1)

| Task | Effort | Priority |
|------|--------|----------|
| Add Bull/BullMQ dependency | 1 day | High |
| Create job queues (payroll, notifications, reports, audit) | 2 days | High |
| Migrate audit outbox to queue | 1 day | High |
| Add retry/dead-letter handling | 1 day | High |
| Add job metrics (Prometheus) | 1 day | High |

### 8.2 Phase 2: Worker Pool (Sprint 2)

| Task | Effort | Priority |
|------|--------|----------|
| Deploy worker containers (separate from API) | 2 days | High |
| Implement priority queues | 1 day | Medium |
| Add job scheduling (cron in Bull) | 1 day | Medium |
| Add job dashboard (Grafana) | 1 day | Medium |

### 8.3 Phase 3: Advanced (Sprint 3)

| Task | Effort | Priority |
|------|--------|----------|
| Distributed tracing for jobs | 3 days | Low |
| Job dependency graph | 2 days | Low |
| Auto-scaling workers | 3 days | Low |

---

## 9. Operational Runbooks

### 9.1 Backup Job Failure

See `BACKUP_AND_RECOVERY_OPERATIONS.md` Section 10.1

### 9.2 Payroll Job Stuck

See `INCIDENT_RESPONSE_PLAYBOOKS.md` Playbook 5

### 9.3 Notification Delivery Failure

1. Check SMTP connectivity: `telnet smtp.provider.com 587`
2. Check SMTP credentials in `.env`
3. Check notification logs: `docker compose logs backend | grep notification`
4. Retry failed notifications manually
5. If persistent → Engage DevOps

### 9.4 Audit Outbox Lag

```bash
# Check lag
docker exec sana-db psql -U sana -d sana_hrms -c "
  SELECT count(*) as pending, 
         max(created_at) as oldest,
         min(created_at) as newest
  FROM audit_outbox WHERE processed_at IS NULL;
"

# If pending > 1000 or oldest > 1 hour:
# 1. Check processor logs
docker compose logs backend | grep -i "audit.outbox"

# 2. Restart processor (restart backend)
docker compose restart backend

# 3. Manual processing (emergency)
docker exec sana-db psql -U sana -d sana_hrms -c "
  UPDATE audit_outbox SET processed_at = NOW(), error = 'manual_flush' 
  WHERE processed_at IS NULL AND created_at < NOW() - INTERVAL '1 hour';
"
```

---

## 10. Testing and Validation

### 10.1 Job Testing Checklist

| Test | Frequency | Method |
|------|-----------|--------|
| **Backup** | Daily (automated) | API + verification |
| **Payroll** | Monthly (manual) | Full calculation + verification |
| **Notifications** | Weekly | Test email/SMS |
| **Reports** | Per release | Generate sample reports |
| **Audit Outbox** | Continuous | Monitoring alert |

### 10.2 Load Testing Jobs

| Job | Test Scenario | Success Criteria |
|-----|---------------|------------------|
| **Backup** | 5GB database | < 60 min, verified |
| **Payroll** | 5000 employees | < 15 min, accurate |
| **Notifications** | 10,000/day | < 1s avg, 99.9% delivered |
| **Reports** | 10 concurrent | < 5 min each |
| **Audit** | 10,000 events/min | < 5s lag |

---

## 11. Documentation References

| Document | Location |
|----------|----------|
| Backup Guide | `docs/production/DATABASE_BACKUP_GUIDE.md` |
| Restore Guide | `docs/production/DATABASE_RESTORE_GUIDE.md` |
| Incident Playbooks | `docs/operations/INCIDENT_RESPONSE_PLAYBOOKS.md` (Playbooks 5, 7, 8) |
| Monitoring | `docs/operations/MONITORING_AND_OBSERVABILITY.md` |
| Disaster Recovery | `docs/production/DISASTER_RECOVERY_PLAN.md` |

---

**Document Version:** 1.0  
**Date:** 2026-11-18  
**Status:** Staging Verified — Queue System Pending  
**Classification:** INTERNAL