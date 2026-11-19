# Sana HRMS - Database PITR Validation Report

**Version:** 1.0  
**Date:** 2026-11-19  
**Classification:** INTERNAL  

---

## 1. Executive Summary

Point-in-Time Recovery (PITR) via WAL archiving is **not yet enabled** for production. Current RPO is 24 hours (daily backup). PITR configuration is documented and ready for Sprint 1 implementation.

**Status:** 📋 **Documented for Sprint 1** — Not yet enabled in production

---

## 2. Current Backup Strategy (Pre-PITR)

| Aspect | Configuration |
|--------|---------------|
| **Backup Type** | pg_dump custom format |
| **Schedule** | Daily 02:00 IRST |
| **Encryption** | AES-256-GCM |
| **Retention** | 10 daily + 12 monthly |
| **Offsite** | S3 Glacier IR |
| **RPO** | 24 hours (23h 12m measured) |
| **RTO** | 1h 39m (measured in DR drill) |

---

## 3. PITR Requirements

### 3.1 PostgreSQL Configuration Required

```yaml
environment:
  POSTGRES_WAL_LEVEL: "replica"
  POSTGRES_ARCHIVE_MODE: "on"
  POSTGRES_ARCHIVE_COMMAND: "cp %p /var/lib/postgresql/wal_archive/%f"
  POSTGRES_MAX_WAL_SENDERS: "10"
  POSTGRES_WAL_KEEP_SIZE: "1GB"
```

### 3.2 WAL Archive Storage

| Option | Pros | Cons |
|--------|------|------|
| **Local volume** | Simple, fast | Not durable across host failure |
| **S3/GCS** | Durable, scalable | Network latency; cost |
| **NFS** | Shared access | Single point of failure |

**Recommendation:** S3 with lifecycle policy to Glacier IR after 30 days.

### 3.3 Archive Command Examples

```bash
# Local (for testing)
archive_command = 'cp %p /var/lib/postgresql/wal_archive/%f'

# S3 (production)
archive_command = 'aws s3 cp %p s3://sana-hrms-wal-archive/%f --storage-class GLACIER_IR'
```

---

## 4. PITR Recovery Procedure

### 4.1 Recovery Steps

1. **Stop PostgreSQL**
   ```bash
   docker compose stop db
   ```

2. **Create Clean Data Directory**
   ```bash
   mv /var/lib/postgresql/data /var/lib/postgresql/data.corrupt
   mkdir /var/lib/postgresql/data
   chown 999:999 /var/lib/postgresql/data
   ```

3. **Restore Base Backup**
   ```bash
   # Download latest base backup from S3
   aws s3 cp s3://sana-hrms-backups/prod/latest.pgdump.enc ./backup.pgdump.enc
   # Decrypt
   node decrypt-backup.js backup.pgdump.enc backup.pgdump "$BACKUP_ENCRYPTION_KEY"
   # Restore
   pg_restore -d sana_hrms backup.pgdump
   ```

4. **Create recovery.signal**
   ```bash
   touch /var/lib/postgresql/data/recovery.signal
   ```

5. **Configure Recovery Target**
   ```bash
   cat > /var/lib/postgresql/data/postgresql.auto.conf << EOF
   restore_command = 'aws s3 cp s3://sana-hrms-wal-archive/%f %p'
   recovery_target_time = '2026-11-19 14:30:00+03:30'
   recovery_target_action = 'promote'
   EOF
   ```

6. **Start PostgreSQL**
   ```bash
   docker compose up -d db
   ```

7. **Verify Recovery**
   ```bash
   # Check recovery complete
   docker exec sana-db psql -U sana -d sana_hrms -c "SELECT pg_is_in_recovery();"
   # Should return 'f' (false = promoted)
   
   # Verify data consistency
   docker exec sana-db psql -U sana -d sana_hrms -c "SELECT count(*) FROM \"Employee\";"
   ```

---

## 4. Target RPO/RTO with PITR

| Metric | Current (Daily Backup) | With PITR |
|--------|------------------------|-----------|
| **RPO** | 23h 12m | < 1 minute |
| **RTO** | 1h 39m | < 30 minutes (with replica) |

---

## 5. Implementation Plan (Sprint 1)

### Week 1: Infrastructure
- [ ] Enable WAL archiving in PostgreSQL config
- [ ] Set up S3 bucket for WAL archive (`sana-hrms-wal-archive`)
- [ ] Configure `archive_command` to S3
- [ ] Test WAL archiving (verify files appear in S3)

### Week 2: Validation
- [ ] Perform PITR test to T-5 minutes
- [ ] Verify data consistency post-recovery
- [ ] Measure actual RPO/RTO
- [ ] Document recovery runbook

### Week 3: Automation
- [ ] Automate base backup + WAL archive sync
- [ ] Add monitoring for WAL archive lag
- [ ] Alert on archive failures

---

## 5. Monitoring & Alerting

### 5.1 Metrics to Expose

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `sana_wal_archive_lag_bytes` | Bytes of WAL not yet archived | > 100MB for 5m |
| `sana_wal_archive_last_success` | Timestamp of last successful archive | > 10 min ago |
| `sana_wal_archive_failures_total` | Failed archive attempts | > 0 for 1m |

### 5.2 Alert Rules

```yaml
- alert: WALArchiveLagHigh
  expr: sana_wal_archive_lag_bytes > 100000000
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "WAL archive lag > 100MB"

- alert: WALArchiveFailed
  expr: increase(sana_wal_archive_failures_total[5m]) > 0
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "WAL archiving failing"
```

---

## 6. Current Status

| Component | Status |
|-----------|--------|
| WAL Level | `replica` (not set) |
| Archive Mode | Off |
| Archive Command | Not configured |
| WAL Archive Storage | Not provisioned |
| PITR Tested | No |

---

## 7. Dependencies

| Dependency | Status |
|-----------|--------|
| S3 bucket for WAL archive | ❌ Not created |
| AWS credentials for archive | ❌ Not configured |
| WAL archive monitoring | ❌ Not implemented |
| PITR runbook | ✅ Documented (this file) |

---

## 7. Conclusion

**PITR is not yet enabled.** Current RPO is 24 hours (daily backup). Full PITR capability (< 1 min RPO) requires Sprint 1 implementation.

**Sprint 1 Commitment:** Enable WAL archiving to S3, validate PITR with T-5min recovery test, document runbook.

---

**Document Version:** 1.0  
**Date:** 2026-11-19  
**Status:** Documented for Sprint 1  
**Classification:** INTERNAL