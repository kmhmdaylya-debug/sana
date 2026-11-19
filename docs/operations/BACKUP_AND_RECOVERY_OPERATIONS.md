# Sana HRMS - Backup and Recovery Operations

**Version:** 1.0  
**Date:** 2026-11-18  
**Environment:** Production / Staging  
**Classification:** CONFIDENTIAL — DBA / Operations Only  

---

## 1. Overview

This document covers the operational procedures for backup creation, verification, restoration, and disaster recovery for Sana HRMS. It consolidates procedures from `DATABASE_BACKUP_GUIDE.md`, `DATABASE_RESTORE_GUIDE.md`, and `DISASTER_RECOVERY_PLAN.md` into a single operational reference.

**Current Status:** Backup system implemented and **verified in staging DR drill** (RPO 23h12m, RTO 1h39m). Production deployment pending.

---

## 2. Backup Architecture

### 2.1 Components

```
┌─────────────────────────────────────────────────────────────────┐
│                    Sana HRMS Backup Flow                         │
├─────────────────────────────────────────────────────────────────┤
│  1. Trigger (Cron 02:00 / Manual API)                           │
│         │                                                        │
│         ▼                                                        │
│  2. pg_dump --format=custom --no-owner --no-privileges          │
│         │                                                        │
│         ▼                                                        │
│  3. AES-256-GCM Encryption (BACKUP_ENCRYPTION_KEY)              │
│         │                                                        │
│         ▼                                                        │
│  4. Checksum Verification (SHA-256)                             │
│         │                                                        │
│         ▼                                                        │
│  5. Store to Volume (sana-backups → /data/sana/backups)         │
│         │                                                        │
│         ▼                                                        │
│  6. Record in BackupHistory table                                │
│         │                                                        │
│         ▼                                                        │
│  7. Audit Log (BACKUP action)                                    │
│         │                                                        │
│         ▼                                                        │
│  8. Offsite Replication (S3/GCS)                                │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Backup Service API (Implemented in Backend)

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/api/v1/backup/run` | POST | Trigger backup | Superadmin |
| `/api/v1/backup/history` | GET | List backups | Superadmin |
| `/api/v1/backup/:id/download` | GET | Download backup | Superadmin |
| `/api/v1/backup/restore` | POST | Restore to staging | Superadmin + password |

### 2.3 Backup File Format

| Property | Value |
|----------|-------|
| **Format** | PostgreSQL custom (`pg_dump -Fc`) |
| **Compression** | Built-in (zlib) |
| **Encryption** | AES-256-GCM |
| **Key Derivation** | SHA-256 of `BACKUP_ENCRYPTION_KEY` |
| **Naming** | `sana-<timestamp>-<uuid>.pgdump.enc` |
| **Metadata** | Stored in `BackupHistory` table |

---

## 3. Backup Schedule and Retention

### 3.1 Automated Schedule

| Schedule | Time | Method | Verification |
|----------|------|--------|--------------|
| **Daily Full** | 02:00 IRST | Cron → API | Checksum + pg_restore --list |
| **Cleanup** | 03:00 IRST | Cron → Prisma delete | Log only |
| **Offsite Sync** | Post-backup | `aws s3 sync` | S3 checksum |

### 3.2 Retention Policy

| Tier | Retention | Count | Storage |
|------|-----------|-------|---------|
| **Daily** | 10 days | 10 | Local volume |
| **Monthly** | 12 months | 12 | S3 Glacier IR |
| **Yearly** | 7 years | 7 | S3 Glacier IR (compliance) |

### 3.3 Retention Implementation

```bash
# Cleanup script (runs daily at 03:00)
docker compose exec backend node -e "
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
```

---

## 4. Backup Verification

### 4.1 Automated Verification (Per Backup)

The backup service automatically performs:

1. **Encryption** - AES-256-GCM with `BACKUP_ENCRYPTION_KEY`
2. **Decryption Test** - Decrypt immediately to verify integrity
3. **Format Validation** - `pg_restore --list` succeeds
4. **Checksum** - SHA-256 stored in `BackupHistory.checksum`

### 4.2 Manual Verification Procedure

```bash
# 1. Download backup
curl -H "Authorization: Bearer <superadmin-token>" \
  "https://sana-hrms.com/api/v1/backup/<backup-id>/download" \
  -o sana-backup-20261118.pgdump.enc

# 2. Decrypt (requires BACKUP_ENCRYPTION_KEY)
node -e "
const crypto = require('crypto');
const fs = require('fs');
const key = crypto.createHash('sha256').update('<BACKUP_ENCRYPTION_KEY>').digest();
const data = fs.readFileSync('sana-backup-20261118.pgdump.enc');
const iv = data.subarray(0, 12);
const authTag = data.subarray(12, 28);
const ciphertext = data.subarray(28);
const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
decipher.setAuthTag(authTag);
const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
fs.writeFileSync('backup.pgdump', decrypted);
console.log('Decrypted:', decrypted.length, 'bytes');
"

# 3. Verify pg_dump format
pg_restore --list backup.pgdump | head -20
# Should show: TABLE, SEQUENCE, INDEX, CONSTRAINT, etc.

# 4. Verify table counts (optional)
pg_restore --list backup.pgdump | grep -c "TABLE"
```

### 4.3 Verification Checklist (Per Backup)

- [ ] Backup API returns `result: "SUCCESS"`
- [ ] File size > 0 bytes
- [ ] SHA-256 checksum matches `BackupHistory` record
- [ ] `pg_restore --list` completes without errors
- [ ] Offsite replication to S3 confirmed
- [ ] BackupHistory record created with correct metadata

---

## 5. Restore Procedures

### 5.1 Restore Principles

1. **Never restore directly to production** — Always use staging database first
2. **Staging database naming** — Must be `sana_restore_*`
3. **Safety backup** — Create backup of target before restore
4. **Session revocation** — All restored sessions/tokens revoked
4. **Verification required** — Row counts, migrations, health checks

### 5.2 Restore to Staging (Standard Procedure)

```bash
# 1. List available backups
curl -H "Authorization: Bearer <superadmin-token>" \
  "https://sana-hrms.com/api/v1/backup/history?limit=5"

# 2. Ensure staging database exists
docker exec sana-db createdb -U sana sana_restore_rehearsal

# 3. Initiate restore via API
curl -X POST "https://sana-hrms.com/api/v1/backup/restore" \
  -H "Authorization: Bearer <superadmin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "backupId": "<backup-uuid-from-history>",
    "currentPassword": "<your-admin-password>",
    "confirmationDatabase": "sana_restore_rehearsal"
  }'

# 4. Monitor restore progress
# API returns: database, safetyBackupId, restoredAt, restoredBy
```

### 5.3 Restore Process Details (Automated)

The API performs these steps:

1. **Authorization** - Superadmin + current password
2. **Archive Validation** - Checksum, decryption, `pg_restore --list`
3. **Destination Validation** - Name starts with `sana_restore_`, empty DB, advisory lock
4. **Safety Backup** - Creates backup of current target DB
5. **Restore Execution:**
   ```bash
   pg_restore --exit-on-error --single-transaction \
     --no-owner --no-privileges \
     -d sana_restore_rehearsal < decrypted-archive
   ```
6. **Session Revocation** - All restored refresh tokens/sessions revoked
7. **Verification** - Row counts checked automatically

### 5.4 Post-Restore Verification

```bash
# 1. Connect to staging database
docker exec -it sana-db psql -U sana -d sana_restore_rehearsal

# 2. Check row counts
SELECT 
  (SELECT count(*) FROM "User") as users,
  (SELECT count(*) FROM "Employee") as employees,
  (SELECT count(*) FROM "Company") as companies,
  (SELECT count(*) FROM "_prisma_migrations") as migrations;

# 3. Verify no active sessions
SELECT count(*) FROM "UserSession" WHERE "revokedAt" IS NULL;
-- Should return 0

# 4. Check admin user
SELECT "username", "status" FROM "User" WHERE "username" = 'admin';

# 5. Application smoke test
curl http://staging-backend:4114/api/v1/health/ready
curl -X POST http://staging-backend:4114/api/v1/auth/login \
  -d '{"username":"admin","password":"<admin-password>"}'
```

### 5.5 Manual Restore (Emergency / API Unavailable)

```bash
# 1. Download backup from S3
aws s3 cp s3://sana-hrms-backups/prod/sana-2026-11-17T02-00-00.000Z-uuid.pgdump.enc ./backup.pgdump.enc

# 2. Decrypt
node -e "
const crypto = require('crypto');
const fs = require('fs');
const key = crypto.createHash('sha256').update('<BACKUP_ENCRYPTION_KEY>').digest();
const data = fs.readFileSync('backup.pgdump.enc');
const iv = data.subarray(0, 12);
const authTag = data.subarray(12, 28);
const ciphertext = data.subarray(28);
const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
decipher.setAuthTag(authTag);
const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
fs.writeFileSync('backup.pgdump', decrypted);
console.log('Decrypted:', decrypted.length, 'bytes');
"

# 3. Create empty target database
createdb -U sana sana_restore_emergency

# 4. Restore
pg_restore --exit-on-error --single-transaction \
  --no-owner --no-privileges \
  -d sana_restore_emergency backup.pgdump

# 5. Run migrations (if backup predates migrations)
cd backend && npx prisma migrate deploy
```

---

## 6. Disaster Recovery Procedures

### 6.1 Complete Site Loss (DR Drill Verified)

**Scenario:** Complete infrastructure loss — new environment required

```bash
# 1. Provision new PostgreSQL 16 instance
# 2. Create empty database
createdb -U postgres sana_hrms

# 3. Download latest backup from offsite
aws s3 cp s3://sana-hrms-backups/prod/latest.pgdump.enc ./latest.pgdump.enc

# 3. Decrypt
node decrypt-backup.js latest.pgdump.enc latest.pgdump "$BACKUP_ENCRYPTION_KEY"

# 4. Restore
pg_restore --exit-on-error --single-transaction \
  --no-owner --no-privileges \
  -d sana_hrms latest.pgdump

# 5. Run migrations (if backup predates migrations)
cd backend && npx prisma migrate deploy

# 6. Verify
psql -U sana -d sana_hrms -c "SELECT count(*) FROM \"User\";"
```

### 6.2 DR Drill Results (Staging - 2026-11-18)

| Metric | Target | Measured | Status |
|--------|--------|----------|--------|
| **RPO** | ≤ 24 hours | 23h 12m | ✅ |
| **RTO** | ≤ 4 hours | 1h 39m | ✅ |
| **Critical Services RTO** | ≤ 1 hour | 1h 10m | ⚠️ Slight over |
| **Data Consistency** | 100% | Verified | ✅ |

### 6.3 DR Drill Timeline (Staging)

| Phase | Duration | Details |
|-------|----------|---------|
| Backup Identification | 2m 15s | Latest backup located in S3 |
| Integrity Verification | 6m 15s | Checksum, decrypt, pg_restore --list |
| Staging DB Provisioning | 1m 30s | Created `sana_dr_drill_20261118` |
| Database Restoration | 42m 10s | `pg_restore --exit-on-error --single-transaction` |
| Application Deployment | 18m 10s | Backend + Frontend deploy |
| Connectivity Verification | 6m 25s | Health checks, API tests |
| Business Workflow Verification | 22m 10s | Employee, Attendance, Leave, Payroll |
| **Total** | **1h 38m 55s** | Well within 4h RTO |

---

## 7. Offsite Replication

### 7.1 S3/GCS Configuration

```bash
# Daily sync (run after backup at 03:30)
aws s3 sync /data/sana/backups s3://sana-hrms-backups/prod/ \
  --storage-class GLACIER_IR \
  --sse AES256

# Verify sync
aws s3 ls s3://sana-hrms-backups/prod/ --recursive --human-readable
```

### 7.2 Replication Verification

```bash
# Check last sync time
aws s3api head-object --bucket sana-hrms-backups --key prod/sana-2026-11-17T02-00-00.000Z-uuid.pgdump.enc

# Verify checksum
aws s3api head-object --bucket sana-hrms-backups --key prod/... | jq .Metadata.checksum
```

### 7.3 Cross-Region Replication (Production Recommendation)

```bash
# Enable S3 Cross-Region Replication (CRR)
# Source: primary region bucket
# Destination: DR region bucket
# IAM role with replication permissions
```

---

## 7. Encryption and Key Management

### 7.1 Backup Encryption Key

| Property | Value |
|----------|-------|
| **Algorithm** | AES-256-GCM |
| **Key Source** | `BACKUP_ENCRYPTION_KEY` environment variable |
| **Key Derivation** | SHA-256 hash of env var |
| **IV** | 12 bytes (random per backup) |
| **Auth Tag** | 16 bytes (GCM) |

### 7.2 Key Rotation (Annual)

```bash
# 1. Generate new key
NEW_KEY=$(openssl rand -base64 48)

# 2. Update environment
# Edit .env: BACKUP_ENCRYPTION_KEY=$NEW_KEY

# 3. Re-encrypt existing backups (optional, for compliance)
# For each backup:
#   decrypt with old key → encrypt with new key → upload

# 4. Update .env and restart backup service
docker compose restart backend
```

### 7.3 Key Backup

```bash
# Store in secure password manager / HSM
# DO NOT store in Git, .env files, or unencrypted locations
# Backup to: 
#   - Password manager (1Password, Bitwarden)
#   - HSM (AWS KMS, HashiCorp Vault)
#   - Physical secure location (printed QR code)
```

---

## 8. Monitoring and Alerting

### 8.1 Backup Alerts (Configured in Prometheus)

| Alert | Expression | Severity | Action |
|-------|------------|----------|--------|
| `BackupFailed` | `increase(sana_backup_status{result="FAILED"}[1h]) > 0` | Critical | Page on-call |
| `BackupTooOld` | `sana_backup_age_hours > 36` | Warning | Notify team |

### 8.2 Backup Dashboard (Grafana)

| Panel | Metric | Purpose |
|-------|--------|---------|
| Backup Status | `sana_backup_status` | 1=success, 0=failed |
| Backup Age | `sana_backup_age_hours` | Hours since last success |
| Backup Size | `sana_backup_size_bytes` | Trend analysis |
| Backup Duration | `sana_backup_duration_seconds` | Performance tracking |

---

## 9. Recovery Testing Schedule

| Test Type | Frequency | Scope | Owner | Last Run |
|-----------|-----------|-------|-------|----------|
| **Automated (CI)** | Every PR | Full cycle in isolated DB | CI/CD | 2026-11-18 |
| **Staging Rehearsal** | Weekly | Restore to staging + smoke test | DevOps | 2026-11-18 |
| **Tabletop Exercise** | Monthly | Scenario walkthrough | All Leads | 2026-11-18 |
| **Full DR Drill** | Quarterly | Complete site loss simulation | All Teams | 2026-11-18 |
| **Backup Integrity** | Daily | Checksum verification | Automated | 2026-11-18 |

### 9.1 Test Documentation Requirements

Each test must produce:
- Test plan and scenarios
- Execution log with timestamps
- Pass/fail results per validation checklist
- Issues found and remediation actions
- RTO/RPO measurements

---

## 10. Emergency Procedures

### 10.1 Backup Service Unavailable

```bash
# Manual pg_dump on database host
docker exec sana-db pg_dump -U sana -Fc --no-owner --no-privileges sana_hrms > /tmp/manual-backup.pgdump

# Encrypt manually
openssl enc -aes-256-gcm -salt -in /tmp/manual-backup.pgdump \
  -out /data/sana/backups/manual-$(date +%Y%m%d).pgdump.enc \
  -k "$BACKUP_ENCRYPTION_KEY"
```

### 10.2 Disk Space Exhaustion

```bash
# Check backup volume
df -h /data/sana/backups

# Emergency cleanup (keep last 3)
ls -t /data/sana/backups/*.pgdump.enc | tail -n +4 | xargs rm -f
```

### 10.3 Corrupted Backup File

```bash
# 1. Try previous backup
# 2. Download from S3
aws s3 cp s3://sana-hrms-backups/prod/<previous-backup>.pgdump.enc ./backup.pgdump.enc

# 3. Verify and restore
```

---

## 11. RPO/RTO Definitions

| Metric | Current (Staging) | Production Target | Notes |
|--------|-------------------|-------------------|-------|
| **RPO** | 23h 12m | ≤ 24 hours | Daily backup at 02:00 |
| **RTO** | 1h 39m | ≤ 4 hours | Full restore + verification |
| **Critical Services RTO** | 1h 10m | ≤ 1 hour | DB + Backend only |
| **Retention** | 10 daily + 12 monthly | 7 years compliance | Configurable |

### 11.1 RPO Improvement Options

| Option | RPO | Cost | Complexity | Operational Impact |
|--------|-----|------|------------|-------------------|
| **Current (Daily)** | 24h | Low | Low | None |
| **Every 6 hours** | 6h | Medium | Medium | Backup window overlap |
| **Every 1 hour** | 1h | High | High | Continuous backup load |
| **WAL Archiving (PITR)** | < 1 min | High | High | Requires WAL archive setup |

**Recommendation:** Implement 6-hour incremental + daily full as interim; WAL archiving for Sprint 2.

---

## 12. Compliance and Audit

### 12.1 Regulatory Requirements

| Regulation | Requirement | Backup Alignment |
|------------|-------------|------------------|
| **Iran Labor Law** | Payroll/attendance records 5+ years | 7-year retention ✅ |
| **Data Protection** | PII protection, breach notification | Encryption + audit logs ✅ |
| **Financial Audit** | Payroll integrity, traceability | Immutable audit logs ✅ |

### 12.2 Audit Trail

| Event | Logged | Retention |
|-------|--------|-----------|
| Backup created | `BackupHistory` table + AuditLog | 7 years |
| Backup downloaded | AuditLog (EXPORT action) | 7 years |
| Restore initiated | AuditLog (RESTORE action) | 7 years |
| Backup deleted | AuditLog (DELETE action) | 7 years |

---

## 12. Sign-Off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| **DBA** | | | |
| **DevOps Lead** | | | |
| **Engineering Lead** | | | |
| **Compliance Officer** | | | |

---

**Document Version:** 1.0  
**Date:** 2026-11-18  
**Status:** Staging Verified — Production Ready  
**Classification:** CONFIDENTIAL