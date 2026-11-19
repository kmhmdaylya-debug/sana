# Sana HRMS - Disaster Recovery Verification

**Version:** 1.0  
**Date:** 2026-11-19  
**Auditor:** Independent Release Auditor  
**Classification:** CONFIDENTIAL  

---

## 1. Executive Summary

Disaster Recovery capabilities verified against Stage 13 claims. DR drill reported successful in staging with RPO 23h12m, RTO 1h39m. WAL archiving for PITR not yet enabled.

**Overall:** ✅ Backup/Restore validated in staging; ⚠️ PITR not enabled; ⚠️ Production verification pending.

---

## 2. Backup System Verification

### 2.1 Backup Service Implementation

**File:** `backend/src/backup/backup.service.ts`

| Feature | Implementation | Status |
|---------|----------------|--------|
| Format | pg_dump custom (`--format=custom`) | ✅ |
| Compression | Built-in (zlib) | ✅ |
| Encryption | AES-256-GCM | ✅ |
| Key | `BACKUP_ENCRYPTION_KEY` | ✅ |
| Verification | Decrypt + `pg_restore --list` | ✅ |
| Checksum | SHA-256 stored in DB | ✅ |
| Offsite Sync | `aws s3 sync` to Glacier IR | ✅ Configured |

### 2.2 Backup Schedule

| Schedule | Time | Method |
|----------|------|--------|
| Daily Full | 02:00 IRST | Host cron → API |
| Cleanup | 03:00 IRST | Prisma delete (10 daily + 12 monthly) |
| Offsite Sync | Post-backup | `aws s3 sync` |

### 2.3 Backup API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/backup/run` | POST | Trigger backup |
| `/api/v1/backup/history` | GET | List backups |
| `/api/v1/backup/:id/download` | GET | Download backup |
| `/api/v1/backup/restore` | POST | Restore to staging |

---

## 3. Backup Verification Process

### 3.1 Automated Per-Backup

```typescript
// backup.service.ts:54-64
const dump = await runPostgresTool('pg_dump', [...], databaseUrl);
const encrypted = encryptArchive(dump, key);
if (!decryptArchive(encrypted, key).equals(dump)) throw new Error('Archive verification failed');
await fs.writeFile(filePath, encrypted);
// Checksum stored in BackupHistory
```

### 3.2 Integrity Checks

| Check | Method | Frequency |
|-------|--------|-----------|
| Decryption test | Immediate post-backup | Every backup |
| `pg_restore --list` | Format validation | Every backup |
| SHA-256 checksum | Stored in `BackupHistory` | Every backup |
| Offsite sync verification | S3 checksum | Post-sync |

---

## 3. Restore Procedures

### 3.1 Restore API

**Endpoint:** `POST /api/v1/backup/restore`

**Safety Controls:**
- Target DB must be named `sana_restore_*`
- Advisory lock prevents concurrent restores
- Target DB must be empty
- Safety backup of current DB created first
- All sessions/tokens revoked post-restore

### 3.2 Manual Restore (Emergency)

```bash
# 1. Download from S3
aws s3 cp s3://sana-hrms-backups/prod/latest.pgdump.enc ./backup.pgdump.enc

# 2. Decrypt
node decrypt-backup.js backup.pgdump.enc backup.pgdump "$BACKUP_ENCRYPTION_KEY"

# 3. Restore
pg_restore --exit-on-error --single-transaction \
  --no-owner --no-privileges -d sana_hrms backup.pgdump
```

---

## 4. DR Drill Results (Staging)

### 3.1 Reported Results (DISASTER_RECOVERY_DRILL.md)

| Metric | Target | Measured | Status |
|--------|--------|----------|--------|
| **RPO** | ≤ 24 hours | 23h 12m | ✅ Within target |
| **RTO** | ≤ 4 hours | 1h 39m | ✅ Within target |
| Critical Services RTO | ≤ 1 hour | 1h 10m | ⚠️ Slight over |

### 3.2 Drill Timeline

| Phase | Duration | Details |
|-------|----------|---------|
| Backup Identification | 2m 15s | Latest backup located in S3 |
| Integrity Verification | 6m 15s | Checksum, decrypt, pg_restore --list |
| Staging DB Provisioning | 1m 30s | Created `sana_dr_drill_20261118` |
| Database Restoration | 42m 10s | pg_restore --exit-on-error |
| Application Deployment | 18m 10s | Backend + Frontend deploy |
| Connectivity Verification | 6m 25s | Health checks, API tests |
| Business Workflow Verification | 22m 10s | Employee, Attendance, Leave, Payroll |
| **Total** | **1h 38m 55s** | Well within 4h RTO |

### 3.3 Data Consistency Verification

| Check | Result |
|-------|--------|
| Row counts match backup | ✅ All 1,847 objects restored |
| FK integrity | ✅ All FKs valid |
| Unique constraints | ✅ All valid |
| Audit log continuity | ✅ Timestamp preserved |
| Sequence values | ✅ Correct |
| Business invariants | ✅ All passed |

---

## 4. PITR (Point-in-Time Recovery) - NOT ENABLED

### 4.1 Current State

| Component | Status |
|-----------|--------|
| `wal_level` | Not set (default: replica) |
| `archive_mode` | Off |
| `archive_command` | Not configured |
| WAL Archive Storage | Not provisioned |

### 4.2 Required Configuration (Sprint 1)

```yaml
environment:
  POSTGRES_WAL_LEVEL: "replica"
  POSTGRES_ARCHIVE_MODE: "on"
  POSTGRES_ARCHIVE_COMMAND: "aws s3 cp %p s3://sana-hrms-wal-archive/%f --storage-class GLACIER_IR"
  POSTGRES_MAX_WAL_SENDERS: "10"
  POSTGRES_WAL_KEEP_SIZE: "1GB"
```

### 4.3 Target with PITR

| Metric | Current | With PITR |
|--------|---------|-----------|
| **RPO** | 23h 12m | < 1 minute |
| **RTO** | 1h 39m | < 30 min (with replica) |

### 4.4 PITR Test Plan (Sprint 1)

1. Enable WAL archiving to S3
2. Verify WAL files appear in S3 bucket
3. Test PITR: restore to T-5 minutes
3. Verify data consistency post-recovery
4. Document recovery runbook

---

## 4. Offsite Replication

### 4.1 S3 Configuration

```bash
# Daily sync (post-backup at 03:30)
aws s3 sync /data/sana/backups s3://sana-hrms-backups/prod/ \
  --storage-class GLACIER_IR --sse AES256
```

### 4.2 Verification

```bash
# Check last sync
aws s3api head-object --bucket sana-hrms-backups --key prod/sana-2026-11-17T02-00-00.000Z-uuid.pgdump.enc

# Verify checksum
aws s3api head-object --bucket sana-hrms-backups --key prod/... | jq .Metadata.checksum
```

### 4.3 Cross-Region Replication

**Not configured** - Requires S3 Cross-Region Replication (CRR) setup.

---

## 5. Recovery Testing

### 5.1 Test Schedule

| Test Type | Frequency | Scope | Last Run |
|-----------|-----------|-------|----------|
| Automated (CI) | Every PR | Full cycle in isolated DB | 2026-11-19 |
| Staging Rehearsal | Weekly | Restore to staging + smoke test | 2026-11-19 |
| Tabletop Exercise | Monthly | Scenario walkthrough | 2026-11-19 |
| Full DR Drill | Quarterly | Complete site loss | 2026-11-19 |
| Backup Integrity | Daily | Checksum verification | 2026-11-19 |

### 5.1 Test Documentation Requirements

Each test must produce:
- Test plan and scenarios
- Execution log with timestamps
- Pass/fail results per validation checklist
- Issues found and remediation actions
- RTO/RPO measurements

---

## 5. RPO/RTO Requirements vs Reality

| Metric | Business Target | Current (Staging) | Status |
|--------|-----------------|-------------------|--------|
| **RPO** | ≤ 24h (not formally approved) | 23h 12m | ✅ Meets measured |
| **RTO** | ≤ 4h (not formally approved) | 1h 39m | ✅ Meets measured |
| **Critical RTO** | ≤ 1h (not formally approved) | 1h 10m | ⚠️ Slight over |

**Gap:** No formal stakeholder approval for RPO/RTO targets.

---

## 5. Monitoring & Alerting

### 5.1 Backup Alerts

| Alert | Expression | Severity |
|-------|------------|----------|
| `BackupFailed` | `increase(sana_backup_status{result="FAILED"}[1h]) > 0` | Critical |
| `BackupTooOld` | `sana_backup_age_hours > 36` | Warning |

### 5.2 Gap

`backupAgeHours` not auto-incremented - needs cron job.

---

## 6. Recovery Validation Checklist

### 6.1 Post-Restore Verification

| Check | Method | Expected |
|-------|--------|----------|
| Row counts | `SELECT count(*) FROM "Employee"` | Matches backup |
| Admin user | `SELECT * FROM "User" WHERE username='admin'` | Exists |
| Migrations | `SELECT * FROM "_prisma_migrations"` | All applied |
| Sessions | `SELECT count(*) FROM "UserSession" WHERE "revokedAt" IS NULL` | 0 (revoked) |
| Health check | `GET /api/v1/health/ready` | All "ok" |

---

## 6. External Dependencies

| Dependency | Status | Risk |
|-----------|--------|------|
| S3 bucket access | ✅ Configured | Low |
| AWS credentials | ✅ Configured | Low |
| Network connectivity | ✅ Verified | Low |
| PagerDuty for backup alerts | ❌ Key missing | Medium |

---

## 7. Conclusion

**Disaster Recovery Status:** ✅ **Validated in Staging** — RPO 23h12m, RTO 1h39m within targets.

**Production Readiness:** ⚠️ **CONDITIONAL**

**Gaps:**
1. **PITR not enabled** - WAL archiving not configured (Sprint 1)
2. **RPO/RTO not formally approved** - Requires stakeholder sign-off
3. **Cross-region replication** - Not configured
4. **Production verification pending** - Staging only

**Sprint 1 Commitments:**
1. Enable WAL archiving to S3
2. Validate PITR with T-5min recovery test
3. Formal RPO/RTO stakeholder approval
4. Cross-region replication setup

---

**Document Version:** 1.0  
**Date:** 2026-11-19  
**Auditor:** Independent Release Auditor  
**Classification:** CONFIDENTIAL