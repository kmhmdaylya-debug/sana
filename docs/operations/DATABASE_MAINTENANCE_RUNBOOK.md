# Sana HRMS - Database Maintenance Runbook

**Version:** 1.0  
**Date:** 2026-11-18  
**Environment:** Production / Staging  
**Classification:** CONFIDENTIAL — DBA / Operations Only  

---

## 1. Overview

This runbook covers routine and emergency database maintenance procedures for the Sana HRMS PostgreSQL 16 database. All procedures reference the actual schema (45+ tables, 87 migrations) and infrastructure (Docker, docker-compose).

**Current State:** PostgreSQL 16 in Docker container (`sana-db`), data volume at `/data/sana/pgdata`.

---

## 2. Routine Maintenance Schedule

### 2.1 Daily (Automated via Backup Service)

| Task | Time | Command / Check | Alert on Failure |
|------|------|-----------------|------------------|
| **Full Backup** | 02:00 | `POST /api/v1/backup/run` | `BackupFailed` alert |
| **Backup Verification** | Post-backup | Checksum + `pg_restore --list` | `BackupFailed` alert |
| **Backup Cleanup** | 03:00 | Retain 10 daily + 12 monthly | Log only |

### 2.2 Weekly (Manual / Semi-Automated)

| Task | Day | Command | Verification |
|------|-----|---------|--------------|
| **VACUUM ANALYZE** | Sunday 03:00 | See Section 4.1 | Query `pg_stat_user_tables` |
| **Index Usage Check** | Monday | See Section 4.2 | Identify unused indexes |
| **Connection Pool Check** | Wednesday | `SELECT * FROM pg_stat_activity;` | Alert if > 80% |
| **Slow Query Review** | Thursday | `pg_stat_statements` top 20 | Log top 5 for optimization |
| **Disk Space Check** | Friday | `df -h /data/sana/pgdata` | Alert if > 80% |

### 2.3 Monthly

| Task | Command | Owner |
|------|---------|-------|
| **Full VACUUM FULL** (if bloat > 20%) | `VACUUM FULL;` (downtime required) | DBA |
| **Index Rebuild** (if fragmentation > 30%) | `REINDEX DATABASE sana_hrms;` | DBA |
| **Statistics Reset** | `SELECT pg_stat_reset();` | DBA |
| **Backup Restore Test** | `POST /api/v1/backup/restore` to staging | DevOps |
| **DR Drill** | Full disaster recovery | All Teams |

### 2.4 Quarterly

| Task | Description |
|------|-------------|
| **Capacity Review** | Project 12-month growth, plan scaling |
| **Parameter Tuning** | Review `postgresql.conf` for workload changes |
| **Security Audit** | Review users, roles, permissions, SSL |
| **Extension Updates** | Check for PostgreSQL/contrib updates |

---

## 3. PostgreSQL Configuration

### 3.1 Current Settings (docker-compose.yml + defaults)

| Parameter | Current Value | Recommended (Production) | Notes |
|-----------|---------------|--------------------------|-------|
| `max_connections` | 100 (default) | **300** | **Critical** - increase pre go-live |
| `shared_buffers` | 128 MB (default) | **1 GB** (25% RAM) | Set to 25% of container memory |
| `effective_cache_size` | 4 GB (default) | **3 GB** | 75% of container memory |
| `work_mem` | 4 MB (default) | **16 MB** | For complex sorts/hashes |
| `maintenance_work_mem` | 64 MB (default) | **512 MB** | For VACUUM, CREATE INDEX |
| `wal_buffers` | 16 MB (default) | **64 MB** | For high write workloads |
| `checkpoint_completion_target` | 0.5 (default) | **0.9** | Spread checkpoint I/O |
| `random_page_cost` | 4.0 (default) | **1.1** | For SSD storage |
| `effective_io_concurrency` | 1 (default) | **200** | For SSD/NVMe |
| `max_worker_processes` | 8 (default) | **4** | Match CPU cores |
| `max_parallel_workers_per_gather` | 2 (default) | **2** | For parallel queries |
| `max_parallel_workers` | 8 (default) | **4** | Match CPU cores |

### 3.2 Applying Configuration Changes

```bash
# 1. Create custom postgresql.conf
cat > /data/sana/pgdata/postgresql.conf << 'EOF'
# Sana HRMS Production Tuning
max_connections = 300
shared_buffers = 1GB
effective_cache_size = 3GB
work_mem = 16MB
maintenance_work_mem = 512MB
wal_buffers = 64MB
checkpoint_completion_target = 0.9
random_page_cost = 1.1
effective_io_concurrency = 200
max_worker_processes = 4
max_parallel_workers_per_gather = 2
max_parallel_workers = 4
# Logging
log_min_duration_statement = 1000
log_checkpoints = on
log_connections = on
log_disconnections = on
log_lock_waits = on
log_temp_files = 1024
EOF

# 2. Apply (requires restart)
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart db

# 3. Verify
docker exec sana-db psql -U sana -d sana_hrms -c "SHOW max_connections; SHOW shared_buffers;"
```

---

## 4. Routine Maintenance Procedures

### 4.1 VACUUM and ANALYZE

#### 4.1.1 Autovacuum (Should Be Enabled by Default)

```sql
-- Verify autovacuum is running
SELECT name, setting FROM pg_settings WHERE name LIKE 'autovacuum%';

-- Check autovacuum activity
SELECT * FROM pg_stat_progress_vacuum;
```

#### 4.1.2 Manual VACUUM ANALYZE (Weekly)

```bash
# Run on all tables (non-blocking)
docker exec sana-db psql -U sana -d sana_hrms -c "VACUUM ANALYZE;"

# Or specific high-churn tables
docker exec sana-db psql -U sana -d sana_hrms -c "
  VACUUM ANALYZE attendance_record, leave_request, payslip, audit_log, employee;
"
```

#### 4.1.3 VACUUM FULL (Monthly - Requires Downtime)

```bash
# 1. Stop application
docker compose stop backend frontend

# 2. Run VACUUM FULL
docker exec sana-db psql -U sana -d sana_hrms -c "VACUUM FULL;"

# 3. Restart application
docker compose up -d backend frontend
```

### 4.2 Index Maintenance

#### 4.2.1 Identify Unused Indexes

```sql
-- Run weekly
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;
```

#### 4.2.2 Index Bloat Check

```sql
-- Check for index bloat (requires pgstattuple extension)
CREATE EXTENSION IF NOT EXISTS pgstattuple;

SELECT 
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as size,
  round(100 * (1 - (idx_tuple_count * (idx_tuple_length + 8) + 24) / pg_relation_size(indexrelid))) as bloat_pct
FROM pg_stat_user_indexes
JOIN pg_index USING (indexrelid)
JOIN pg_class ON pg_class.oid = indexrelid
WHERE schemaname = 'public'
  AND pg_relation_size(indexrelid) > 100000
ORDER BY bloat_pct DESC;
```

#### 4.2.3 REINDEX (Monthly if Bloat > 30%)

```bash
# 1. Stop application
docker compose stop backend frontend

# 2. Reindex database
docker exec sana-db psql -U sana -d sana_hrms -c "REINDEX DATABASE sana_hrms;"

# 3. Restart application
docker compose up -d backend frontend
```

#### 4.2.4 REINDEX CONCURRENTLY (No Downtime - PG 12+)

```sql
-- For specific bloated indexes
REINDEX INDEX CONCURRENTLY idx_attendance_employee_date;
REINDEX INDEX CONCURRENTLY idx_audit_log_user_created;
```

### 4.3 Statistics Maintenance

```bash
# Reset statistics (monthly)
docker exec sana-db psql -U sana -d sana_hrms -c "SELECT pg_stat_reset();"

# Update table statistics (after bulk loads)
docker exec sana-db psql -U sana -d sana_hrms -c "ANALYZE;"

# Check table statistics age
SELECT 
  relname,
  last_autovacuum,
  last_autoanalyze,
  last_vacuum,
  last_analyze
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY last_autoanalyze ASC NULLS FIRST;
```

---

## 5. Monitoring Queries

### 5.1 Connection Pool Monitoring

```sql
-- Current connections
SELECT 
  count(*) as total,
  count(*) FILTER (WHERE state = 'active') as active,
  count(*) FILTER (WHERE state = 'idle') as idle,
  count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_tx,
  max_connections as max_allowed,
  round(100.0 * count(*) / max_connections, 1) as pct_used
FROM pg_stat_activity, (SELECT setting::int as max_connections FROM pg_settings WHERE name = 'max_connections') s;

-- Connections by user
SELECT usename, count(*) 
FROM pg_stat_activity 
GROUP BY usename 
ORDER BY count DESC;
```

### 5.2 Slow Query Detection

```sql
-- Enable pg_stat_statements (in postgresql.conf)
-- shared_preload_libraries = 'pg_stat_statements'
-- pg_stat_statements.max = 10000
-- pg_stat_statements.track = all

-- Top 20 slowest queries (by total time)
SELECT 
  query,
  calls,
  round(total_exec_time::numeric, 2) as total_ms,
  round(mean_exec_time::numeric, 2) as mean_ms,
  rows
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;

-- Top 20 slowest by mean time
SELECT 
  query,
  calls,
  round(mean_exec_time::numeric, 2) as mean_ms,
  round(total_exec_time::numeric, 2) as total_ms
FROM pg_stat_statements
WHERE calls > 100
ORDER BY mean_exec_time DESC
LIMIT 20;
```

### 5.3 Lock and Blocking Monitoring

```sql
-- Current locks
SELECT 
  blocked_locks.pid AS blocked_pid,
  blocked_activity.usename AS blocked_user,
  blocking_locks.pid AS blocking_pid,
  blocking_activity.usename AS blocking_user,
  blocked_activity.query AS blocked_query,
  blocking_activity.query AS blocking_query,
  blocked_activity.query_start AS blocked_start,
  blocking_activity.query_start AS blocking_start
FROM pg_locks blocked_locks
JOIN pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_locks blocking_locks 
  ON blocking_locks.locktype = blocked_locks.locktype
  AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
  AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
  AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
  AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
  AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
  AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
  AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
  AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
  AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
  AND blocking_locks.pid != blocked_locks.pid
JOIN pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;

-- Long-running transactions
SELECT 
  pid,
  usename,
  query_start,
  now() - query_start as duration,
  state,
  query
FROM pg_stat_activity
WHERE state IN ('active', 'idle in transaction')
  AND now() - query_start > INTERVAL '5 minutes'
ORDER BY query_start;
```

### 5.4 Table and Index Bloat

```sql
-- Table bloat (requires pgstattuple)
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
  round(100 * (1 - (tuple_count * (tuple_length + 8) + 24) / pg_total_relation_size(schemaname||'.'||tablename))) as bloat_pct
FROM pg_stat_user_tables
JOIN pg_class ON pg_class.relname = tablename
WHERE schemaname = 'public'
  AND pg_total_relation_size(schemaname||'.'||tablename) > 1000000
ORDER BY bloat_pct DESC;
```

---

## 6. Emergency Procedures

### 6.1 Connection Pool Exhaustion

```bash
# 1. Check current connections
docker exec sana-db psql -U sana -d sana_hrms -c "
  SELECT count(*) as total, max_connections, 
         round(100.0 * count(*) / max_connections, 1) as pct
  FROM pg_stat_activity, 
       (SELECT setting::int as max_connections FROM pg_settings WHERE name = 'max_connections') s;
"

# 2. Kill idle connections (emergency)
docker exec sana-db psql -U sana -d sana_hrms -c "
  SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
  WHERE state = 'idle'
    AND now() - state_change > INTERVAL '10 minutes'
    AND pid <> pg_backend_pid();
"

# 3. Increase max_connections temporarily (requires restart)
# Edit postgresql.conf: max_connections = 500
# docker compose restart db
```

### 6.2 Long-Running Query Killing

```bash
# Kill queries running > 10 minutes
docker exec sana-db psql -U sana -d sana_hrms -c "
  SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
  WHERE state = 'active'
    AND now() - query_start > INTERVAL '10 minutes'
    AND pid <> pg_backend_pid();
"

# Kill specific blocking query
docker exec sana-db psql -U sana -d sana_hrms -c "
  SELECT pg_terminate_backend(<blocking_pid>);
"
```

### 6.3 Corruption Recovery

```bash
# 1. Stop application
docker compose stop backend frontend

# 2. Check corruption extent
docker exec sana-db pg_dump -U sana -Fc sana_hrms > /dev/null 2>&1
# If fails, note error

# 3. Attempt pg_dump with --exclude-table-data for corrupted tables
# pg_dump -U sana -Fc --exclude-table-data=corrupted_table sana_hrms > clean_backup.pgdump

# 4. If pg_dump fails entirely -> restore from backup (see Playbook 11)
```

---

## 6. Migration Safety

### 6.1 Pre-Migration Checklist

- [ ] Backup completed and verified
- [ ] Migration files reviewed (`prisma migrate status`)
- [ ] Destructive changes identified (DROP COLUMN, DROP TABLE, etc.)
- [ ] Rollback plan documented
- [ ] Maintenance window scheduled
- [ ] Team notified

### 6.2 Safe Migration Execution

```bash
# 1. Check pending migrations
docker compose run --rm backend npx prisma migrate status

# 2. Apply migrations (with timeout)
timeout 300 docker compose run --rm backend npx prisma migrate deploy

# 2. If timeout or failure -> check logs
docker compose logs backend --tail 200

# 3. Verify migration
docker exec sana-db psql -U sana -d sana_hrms -c "
  SELECT * FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 5;
"
```

### 6.3 Migration Rollback

```bash
# 1. Identify migration to rollback
docker exec sana-db psql -U sana -d sana_hrms -c "
  SELECT migration_name, finished_at 
  FROM _prisma_migrations 
  ORDER BY finished_at DESC LIMIT 10;
"

# 2. Create down migration (manual SQL)
# Create file: prisma/migrations/<timestamp>_rollback/migration.sql

# 3. Apply down migration
docker compose run --rm backend npx prisma migrate resolve --rolled-back "<migration_name>"

# 3. If destructive -> restore from backup (see DATABASE_RESTORE_GUIDE.md)
```

---

## 7. User and Permission Management

### 7.1 Application User (sana)

```sql
-- Verify permissions
SELECT grantee, privilege_type 
FROM information_schema.role_table_grants 
WHERE grantee = 'sana';

-- Should have: SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on all tables
-- USAGE, SELECT on all sequences
```

### 7.2 Read-Only User (for reporting)

```sql
-- Create read-only user
CREATE USER sana_readonly WITH PASSWORD '<secure_password>';
GRANT CONNECT ON DATABASE sana_hrms TO sana_readonly;
GRANT USAGE ON SCHEMA public TO sana_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO sana_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO sana_readonly;
```

### 7.3 Monitoring User (for Prometheus exporter)

```sql
-- Create monitoring user
CREATE USER sana_monitor WITH PASSWORD '<secure_password>';
GRANT CONNECT ON DATABASE sana_hrms TO sana_monitor;
GRANT pg_monitor TO sana_monitor;  -- For pg_stat_statements, etc.
```

---

## 8. Disaster Recovery Procedures

### 8.1 Point-in-Time Recovery (PITR) - NOT CURRENTLY CONFIGURED

**Required for Production:**
1. Enable WAL archiving in `postgresql.conf`:
   ```conf
   wal_level = replica
   archive_mode = on
   archive_command = 'cp %p /data/sana/wal_archive/%f'
   max_wal_senders = 10
   wal_keep_size = 1GB
   ```

2. Base backup + WAL archive enables PITR to any second

### 8.2 Streaming Replication (Read Replica)

**For Production Scaling:**
1. Primary: `wal_level = replica`, `max_wal_senders = 10`
2. Replica: `recovery_target_timeline = 'latest'`, `primary_conninfo = 'host=primary port=5432 user=replicator password=...'`

### 8.3 Complete Restore (from Backup)

See `DATABASE_RESTORE_GUIDE.md` and `DISASTER_RECOVERY_PLAN.md`.

---

## 8. Maintenance Windows

| Window | Duration | Activities Allowed |
|--------|----------|-------------------|
| **Daily** | 02:00-04:00 | Backup, cleanup, light maintenance |
| **Weekly** | Sunday 03:00-05:00 | VACUUM ANALYZE, index check, stats reset |
| **Monthly** | Saturday 02:00-06:00 | VACUUM FULL, REINDEX, major maintenance |
| **Emergency** | Any time | Critical fixes, corruption recovery |

---

## 9. Documentation and Runbooks

| Document | Location |
|----------|----------|
| Database Backup Guide | `docs/production/DATABASE_BACKUP_GUIDE.md` |
| Database Restore Guide | `docs/production/DATABASE_RESTORE_GUIDE.md` |
| Disaster Recovery Plan | `docs/production/DISASTER_RECOVERY_PLAN.md` |
| Migration Guide | `docs/production/DATABASE_MIGRATION_GUIDE.md` |
| Incident Playbooks | `docs/operations/INCIDENT_RESPONSE_PLAYBOOKS.md` (Playbooks 2, 3, 11) |

---

## 10. Contacts and Escalation

| Role | Name | Phone | Slack | Email |
|------|------|-------|-------|-------|
| **Primary DBA** | | | | |
| **Secondary DBA** | | | | |
| **DevOps Lead** | | | | |
| **Engineering Lead** | | | | |

---

**Document Version:** 1.0  
**Date:** 2026-11-18  
**Status:** Staging Verified — Production Ready with Config Changes  
**Classification:** CONFIDENTIAL