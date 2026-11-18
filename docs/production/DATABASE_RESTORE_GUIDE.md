# Sana HRMS - Database Restore Guide

**Version:** 1.0  
**Date:** 2026-11-18  
**Audience:** System Administrators, DevOps Engineers, DBA  
**Classification:** CONFIDENTIAL - Contains Recovery Procedures  

---

## 1. Overview

This guide covers the database restoration procedures for Sana HRMS. **Restoration is only supported on a separate, empty staging database** - never directly on the production database.

### 1.1 Restore Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Sana HRMS Restore Flow                    │
├─────────────────────────────────────────────────────────────┤
│  1. Select Backup Archive                                   │
│         │                                                    │
│         ▼                                                    │
│  2. Verify Archive (Checksum + Decryption + pg_restore)     │
│         │                                                    │
│         ▼                                                    │
│  3. Validate Destination (Empty sana_restore_* DB)          │
│         │                                                    │
│         ▼                                                    │
│  4. Create Safety Backup of Source DB                       │
│         │                                                    │
│         ▼                                                    │
│  5. Restore with --exit-on-error --single-transaction       │
│         │                                                    │
│         ▼                                                    │
│  6. Revoke Restored Sessions/Tokens                         │
│         │                                                    │
│         ▼                                                    │
│  7. Verify Row Counts & Business Invariants                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Prerequisites

### 2.1 Required Infrastructure

| Component | Requirement |
|-----------|-------------|
| **Staging Database** | Separate empty PostgreSQL 16 database named `sana_restore_*` |
| **Backup Archive** | Valid `.pgdump.enc` file from backup history |
| **Admin Credentials** | Current superadmin password |
| **Network Access** | Staging DB accessible from backend container |

### 2.2 Environment Configuration

```env
# In docker-compose.yml or .env
BACKUP_RESTORE_DATABASE_URL=postgresql://sana:${POSTGRES_PASSWORD}@db:5432/sana_restore_rehearsal?schema=public
```

### 2.3 Create Staging Database

```bash
# On database host (run once)
docker exec sana-db createdb -U sana sana_restore_rehearsal

# Or via backend container
docker exec sana-backend pg_dump --version  # Verify pg_restore 16.x
```

---

## 3. Restore Procedure (Staging Only)

### 3.1 Via API (Superadmin Only)

```bash
# 1. List available backups
curl -X GET "http://localhost:8080/api/v1/backup/history?limit=5" \
  -H "Authorization: Bearer <superadmin-token>"

# 2. Initiate restore
curl -X POST "http://localhost:8080/api/v1/backup/restore" \
  -H "Authorization: Bearer <superadmin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "backupId": "<backup-uuid-from-history>",
    "currentPassword": "<your-current-admin-password>",
    "confirmationDatabase": "sana_restore_rehearsal"
  }'

# 3. Response
{
  "success": true,
  "data": {
    "database": "sana_restore_rehearsal",
    "safetyBackupId": "uuid-of-safety-backup",
    "restoredAt": "2026-11-18T10:30:00.000Z",
    "restoredBy": "admin"
  }
}
```

### 3.2 Restore Process Details

The API performs these steps automatically:

1. **Authorization**: Verifies superadmin + current password
2. **Archive Validation**: 
   - Checksum verification (SHA-256)
   - Decryption test (AES-256-GCM)
   - `pg_restore --list` validation
3. **Destination Validation**:
   - Database name starts with `sana_restore_`
   - Database is empty (no tables)
   - Advisory lock acquired
4. **Safety Backup**: Creates backup of current source DB
5. **Restore Execution**:
   ```bash
   pg_restore --exit-on-error --single-transaction \
     --no-owner --no-privileges \
     -d sana_restore_rehearsal < decrypted-archive
   ```
6. **Session Revocation**: All restored refresh tokens/sessions revoked
7. **Verification**: Row counts checked automatically

---

## 4. Post-Restore Verification

### 4.1 Automated Checks

The system verifies:
- ✅ User count matches (1 admin in staging)
- ✅ No active sessions copied from production
- ✅ Schema version matches migrations

### 4.2 Manual Verification

```bash
# Connect to staging database
docker exec -it sana-db psql -U sana -d sana_restore_rehearsal

# Check row counts
SELECT 
  (SELECT count(*) FROM "User") as users,
  (SELECT count(*) FROM "Employee") as employees,
  (SELECT count(*) FROM "Company") as companies,
  (SELECT count(*) FROM "_prisma_migrations") as migrations;

# Verify no active sessions
SELECT count(*) FROM "UserSession" WHERE "revokedAt" IS NULL;
-- Should return 0

# Check admin user
SELECT "username", "status" FROM "User" WHERE "username" = 'admin';
```

### 4.3 Application Smoke Test

```bash
# Point frontend to staging backend (update CORS_ORIGINS)
# Or use backend directly

# 1. Health check
curl http://staging-backend:4114/api/v1/health/ready

# 2. Login with admin credentials
curl -X POST http://staging-backend:4114/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<admin-password>"}'

# 3. Verify key endpoints
curl -H "Authorization: Bearer <token>" \
  http://staging-backend:4114/api/v1/employees?limit=5
```

---

## 5. Production Cutover Procedure

> **WARNING:** This is a high-risk operation. Follow exactly.

### 5.1 Pre-Cutover Checklist

- [ ] Staging restore verified and smoke-tested
- [ ] Maintenance window scheduled and communicated
- [ ] Write freeze on production application
- [ ] Fresh production backup created
- [ ] Rollback procedure reviewed
- [ ] DNS TTL lowered to 60s (if using external DNS)

### 5.2 Cutover Steps

```bash
# 1. Enable maintenance mode (if implemented)
# 2. Create final production backup
curl -X POST http://prod-backend:4114/api/v1/backup/run \
  -H "Authorization: Bearer <prod-superadmin-token>"

# 3. Stop production backend
docker compose -f docker-compose.prod.yml stop backend

# 4. Promote staging database (RENAME)
# On database host:
docker exec sana-db psql -U postgres -c "
  ALTER DATABASE sana_hrms RENAME TO sana_hrms_old_$(date +%s);
  ALTER DATABASE sana_restore_rehearsal RENAME TO sana_hrms;
"

# 5. Update connection strings if needed
# 6. Start backend with new database
docker compose -f docker-compose.prod.yml up -d backend

# 7. Verify production
curl http://prod-backend:4114/api/v1/health/ready
```

### 5.3 Rollback Procedure

```bash
# If issues detected within 30 minutes:
# 1. Stop backend
docker compose -f docker-compose.prod.yml stop backend

# 2. Revert database names
docker exec sana-db psql -U postgres -c "
  ALTER DATABASE sana_hrms RENAME TO sana_hrms_failed_$(date +%s);
  ALTER DATABASE sana_hrms_old_<timestamp> RENAME TO sana_hrms;
"

# 3. Restart backend
docker compose -f docker-compose.prod.yml up -d backend
```

---

## 6. Emergency Restore (Disaster Recovery)

### 6.1 Complete Database Loss

```bash
# 1. Provision new PostgreSQL 16 instance
# 2. Create empty database
createdb -U postgres sana_hrms

# 3. Download latest backup from offsite storage
aws s3 cp s3://sana-hrms-backups/prod/latest.pgdump.enc ./latest.pgdump.enc

# 3. Decrypt
node decrypt-backup.js latest.pgdump.enc latest.pgdump "$BACKUP_ENCRYPTION_KEY"

# 4. Restore
pg_restore --exit-on-error --single-transaction \
  --no-owner --no-privileges \
  -d sana_hrms latest.pgdump

# 5. Run migrations (in case backup predates migrations)
cd backend && npx prisma migrate deploy

# 6. Verify
psql -U sana -d sana_hrms -c "SELECT count(*) FROM \"User\";"
```

### 6.2 Point-in-Time Recovery (PITR)

> **Not currently implemented.** Requires PostgreSQL WAL archiving.

---

## 7. Restore Testing Schedule

| Test Type | Frequency | Scope |
|-----------|-----------|-------|
| **Automated (CI)** | Every PR | Full backup/restore cycle in isolated DB |
| **Staging Rehearsal** | Weekly | Full restore to staging, smoke test |
| **Production DR Drill** | Quarterly | Full disaster recovery simulation |
| **Backup Integrity** | Daily | Checksum verification of latest backup |

---

## 8. Troubleshooting

### 8.1 Common Errors

| Error | Cause | Resolution |
|-------|-------|------------|
| `Checksum mismatch` | Corrupted backup file | Use previous backup; verify storage integrity |
| `Invalid backup path` | File moved/deleted | Restore from offsite storage |
| `Decryption failed` | Wrong encryption key | Verify BACKUP_ENCRYPTION_KEY matches backup era |
| `Destination not empty` | Previous restore failed | Drop staging DB and recreate |
| `Advisory lock failed` | Concurrent restore | Wait and retry; only one restore at a time |
| `pg_restore version mismatch` | Major version difference | Use PostgreSQL 16 client for PostgreSQL 16 dumps |

### 8.2 Debug Commands

```bash
# Inspect backup without restoring
pg_restore --list backup.pgdump | head -50

# Check backup metadata
pg_restore --list backup.pgdump | grep -E "(TABLE|SEQUENCE|INDEX)" | wc -l

# Test decryption
node -e "
const crypto = require('crypto');
const fs = require('fs');
const key = crypto.createHash('sha256').update('KEY').digest();
const data = fs.readFileSync('backup.pgdump.enc');
try {
  const iv = data.subarray(0, 12);
  const authTag = data.subarray(12, 28);
  const ct = data.subarray(28);
  const dec = crypto.createDecipheriv('aes-256-gcm', key, iv);
  dec.setAuthTag(authTag);
  console.log('Decrypt OK:', dec.update(ct).length + dec.final().length);
} catch(e) { console.error('FAIL:', e.message); }
"
```

---

## 9. Security Considerations

- Backup archives contain **all tenant data + password hashes**
- Treat as **highly confidential** even when encrypted
- Never attach to support tickets or emails
- Audit log records every download (EXPORT action)
- Staging databases must be isolated from production network
- Admin password required for every restore

---

## 10. RTO Validation

| Scenario | Target RTO | Measured |
|----------|------------|----------|
| Staging restore (10GB) | ≤ 30 min | TBD |
| Full DR (new server) | ≤ 4 hours | TBD |
| Point-in-time (WAL) | Not implemented | N/A |

---

**Document Version:** 1.0  
**Last Updated:** 2026-11-18  
**Next Review:** Monthly (before DR drills)  
**Owner:** DBA / DevOps Team  
**Classification:** CONFIDENTIAL