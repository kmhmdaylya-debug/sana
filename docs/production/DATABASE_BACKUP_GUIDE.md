# Sana HRMS - Database Backup Guide

**Version:** 1.0  
**Date:** 2026-11-18  
**Audience:** System Administrators, DevOps Engineers  

---

## 1. Overview

This guide covers the automated and manual backup procedures for the Sana HRMS PostgreSQL database. The backup system uses `pg_dump` with custom format, AES-256-GCM encryption, and integrity verification.

### 1.1 Backup Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Sana HRMS Backup Flow                     │
├─────────────────────────────────────────────────────────────┤
│  1. Trigger (API / Cron)                                    │
│         │                                                    │
│         ▼                                                    │
│  2. pg_dump --format=custom --no-owner --no-privileges      │
│         │                                                    │
│         ▼                                                    │
│  3. AES-256-GCM Encryption (BACKUP_ENCRYPTION_KEY)          │
│         │                                                    │
│         ▼                                                    │
│  4. Checksum Verification (SHA-256)                         │
│         │                                                    │
│         ▼                                                    │
│  5. Store to Volume (sana-backups)                          │
│         │                                                    │
│         ▼                                                    │
│  6. Record in BackupHistory table                           │
│         │                                                    │
│         ▼                                                    │
│  7. Audit Log (BACKUP action)                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Configuration

### 2.1 Required Environment Variables

```env
# Database
DATABASE_URL=postgresql://sana:${POSTGRES_PASSWORD}@db:5432/sana_hrms?schema=public

# Backup
BACKUP_DIR=/app/backups
BACKUP_ENCRYPTION_KEY=<32+ char random secret>
BACKUP_MAX_FILES=10
PG_DUMP_PATH=pg_dump
PG_RESTORE_PATH=pg_restore

# Restore (separate empty database)
BACKUP_RESTORE_DATABASE_URL=postgresql://sana:${POSTGRES_PASSWORD}@db:5432/sana_restore?schema=public
```

### 2.2 Docker Volumes

```yaml
volumes:
  sana-backups:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /data/sana/backups
```

---

## 3. Automated Backup Schedule

### 3.1 Cron Configuration (Recommended)

Add to crontab on the host or in a dedicated backup container:

```bash
# Daily backup at 02:00
0 2 * * * /usr/bin/docker exec sana-backend node -e "
const fetch = require('node-fetch');
fetch('http://127.0.0.1:4114/api/v1/backup/run', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + process.env.ADMIN_TOKEN }
}).then(r => console.log('Backup:', r.status));
"
```

### 3.2 Kubernetes CronJob (Alternative)

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: sana-backup
spec:
  schedule: "0 2 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: curlimages/curl:latest
            command:
            - /bin/sh
            - -c
            - |
              curl -X POST http://backend:4114/api/v1/backup/run \
                -H "Authorization: Bearer $ADMIN_TOKEN"
          restartPolicy: OnFailure
```

---

## 4. Manual Backup Creation

### 4.1 Via API (Superadmin Only)

```bash
# Create backup
curl -X POST http://localhost:8080/api/v1/backup/run \
  -H "Authorization: Bearer <superadmin-access-token>"

# Response
{
  "success": true,
  "data": {
    "id": "uuid",
    "fileName": "sana-2026-11-18T02-00-00.000Z-uuid.pgdump.enc",
    "size": 12345678,
    "checksum": "sha256...",
    "result": "SUCCESS",
    "startedAt": "2026-11-18T02:00:00.000Z",
    "finishedAt": "2026-11-18T02:00:05.000Z"
  }
}
```

### 4.2 List Backup History

```bash
curl -X GET "http://localhost:8080/api/v1/backup/history?page=1&limit=20" \
  -H "Authorization: Bearer <superadmin-access-token>"
```

### 4.3 Download Backup

```bash
curl -X GET "http://localhost:8080/api/v1/backup/<backup-id>/download" \
  -H "Authorization: Bearer <superadmin-access-token>" \
  -o sana-backup-20261118.pgdump.enc
```

---

## 5. Backup Verification

### 5.1 Automatic Verification (Built-in)

The backup service automatically:
1. Encrypts the dump
2. Decrypts to verify integrity
3. Verifies `pg_restore --list` works
4. Stores SHA-256 checksum

### 5.2 Manual Verification

```bash
# 1. Download backup
curl -H "Authorization: Bearer <token>" \
  "http://localhost:8080/api/v1/backup/<id>/download" -o backup.pgdump.enc

# 2. Decrypt (requires BACKUP_ENCRYPTION_KEY)
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

# 3. Verify pg_dump format
pg_restore --list backup.pgdump | head -20
```

---

## 6. Backup Retention

### 6.1 Automatic Cleanup

Configure a daily cleanup job:

```bash
# Keep last 10 backups (configured via BACKUP_MAX_FILES)
0 3 * * * /usr/bin/docker exec sana-backend node -e "
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

## 7. Secure Backup Storage

### 7.1 Offsite Replication

```bash
# Sync to S3/GCS (run daily after backup)
aws s3 sync /data/sana/backups s3://sana-hrms-backups/prod/ \
  --storage-class GLACIER_IR \
  --sse AES256
```

### 7.2 Encryption at Rest

- Volume encryption: Use LUKS/dm-crypt on host
- Cloud storage: SSE-S3 or SSE-KMS
- Key rotation: Annual (documented in DISASTER_RECOVERY_PLAN.md)

---

## 8. Monitoring & Alerting

### 8.1 Backup Success Alert

```yaml
# Prometheus alert rule
- alert: BackupFailed
  expr: increase(sana_backup_total{result="FAILED"}[1h]) > 0
  for: 0m
  labels:
    severity: critical
  annotations:
    summary: "Sana HRMS backup failed"
    description: "Backup job failed at {{ $labels.instance }}"
```

### 8.2 Backup Age Alert

```yaml
- alert: BackupTooOld
  expr: time() - sana_backup_last_success_timestamp > 86400
  for: 0m
  labels:
    severity: warning
  annotations:
    summary: "Sana HRMS backup older than 24 hours"
```

---

## 9. RPO/RTO Definitions

| Metric | Value | Notes |
|--------|-------|-------|
| **RPO** | ≤ 24 hours | Daily backup schedule |
| **RTO** | ≤ 4 hours | Restore + verification time |
| **Retention** | 10 daily + 12 monthly | Configurable via BACKUP_MAX_FILES |
| **Verification** | Per backup | Automated integrity check |

---

## 10. Emergency Procedures

### 10.1 Backup Service Unavailable

If the backup API is unavailable, create manual dump:

```bash
# On database host
docker exec sana-db pg_dump -U sana -Fc --no-owner --no-privileges sana_hrms > manual-backup.pgdump

# Encrypt manually
openssl enc -aes-256-gcm -salt -in manual-backup.pgdump -out manual-backup.pgdump.enc -k "$BACKUP_ENCRYPTION_KEY"
```

### 10.2 Disk Space Exhaustion

```bash
# Check backup volume
df -h /data/sana/backups

# Emergency cleanup (keep last 3)
ls -t /data/sana/backups/*.pgdump.enc | tail -n +4 | xargs rm -f
```

---

**Document Version:** 1.0  
**Last Updated:** 2026-11-18  
**Next Review:** Monthly  
**Owner:** DevOps / DBA Team