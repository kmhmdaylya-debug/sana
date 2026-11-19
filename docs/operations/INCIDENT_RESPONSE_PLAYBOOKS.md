# Sana HRMS - Incident Response Playbooks

**Version:** 1.0  
**Date:** 2026-11-18  
**Status:** Staging Verified — Production Pending  
**Classification:** CONFIDENTIAL — Operations Only  

---

## 1. Overview

This document contains step-by-step response procedures for the 12 critical incident scenarios identified for Sana HRMS. Each playbook follows the incident management policy and includes detection, diagnosis, mitigation, and verification steps.

**Testing Status:** All playbooks reviewed in staging tabletop exercises. Production execution pending.

---

## 2. Playbook Index

| # | Playbook | Severity | Primary Owner | Last Tested |
|---|----------|----------|---------------|-------------|
| 1 | Application Unavailable | SEV-1 | DevOps Lead | Staging Tabletop |
| 2 | Database Unavailable | SEV-1 | DBA | Staging Tabletop |
| 3 | Database Storage Exhaustion | SEV-1 | DBA / DevOps | Staging Tabletop |
| 4 | Authentication Failures | SEV-1 | Backend Lead | Staging Tabletop |
| 5 | Payroll Processing Failure | SEV-1 | Backend Lead | Staging Tabletop |
| 6 | Incorrect Financial Calculations | SEV-1 | Backend Lead + Finance | Staging Tabletop |
| 7 | Background Job Failure | SEV-2 | DevOps Lead | Staging Tabletop |
| 8 | Backup Failure | SEV-1 | DBA / DevOps | Staging Tabletop |
| 9 | Security Incident | SEV-1 | Security Engineer | Staging Tabletop |
| 10 | Unauthorized Access | SEV-2 | Security Engineer | Staging Tabletop |
| 11 | Data Corruption | SEV-1 | DBA | Staging Tabletop |
| 12 | Failed Deployment | SEV-2 | DevOps Lead | Staging Tabletop |

---

## 3. Playbook 1: Application Unavailable

### 3.1 Detection
- **Alert:** `ServiceDown` (Prometheus: `up{job="sana-backend"} == 0` or `up{job="sana-frontend"} == 0`)
- **Health Check:** `GET /api/v1/health/live` returns non-200 or timeout
- **User Reports:** Unable to access application

### 3.2 Diagnosis (Target: < 5 minutes)

```bash
# 1. Check container status
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps

# 2. Check backend logs
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f backend --tail 100

# 3. Check frontend logs
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f frontend --tail 100

# 4. Check health endpoint directly
curl -v http://localhost:4114/api/v1/health/live

# 5. Check database connectivity
docker exec sana-db pg_isready -U sana -d sana_hrms

# 6. Check resource usage
docker stats --no-stream
```

### 3.3 Common Causes and Mitigations

| Cause | Symptoms | Mitigation |
|-------|----------|------------|
| **Container crashed** | Container status `Exited` or `Restarting` | Check logs for OOM, segfault, unhandled exception → Fix root cause → Restart |
| **OOM Kill** | `docker inspect` shows `OOMKilled: true` | Increase memory limit → Investigate memory leak |
| **Database unavailable** | Backend logs show connection errors | See Playbook 2 |
| **Port conflict** | `address already in use` | Check for duplicate containers → Stop conflicting service |
| **Migration pending** | Logs show `prisma migrate deploy` stuck | Wait or cancel → Check migration status |
| **Config error** | Missing env vars (CORS_ORIGINS, etc.) | Set missing variables → Restart |

### 3.4 Mitigation Steps (Priority Order)

1. **Quick Restart** (if transient):
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.prod.yml restart backend frontend
   ```

2. **Rollback to Previous Version** (if recent deploy):
   ```bash
   # Tag current as failed
   docker tag sana-hrms-backend:latest sana-hrms-backend:failed-$(date +%s)
   docker tag sana-hrms-frontend:latest sana-hrms-frontend:failed-$(date +%s)
   
   # Restore previous images
   docker tag sana-hrms-backend:v1.0.0-prev sana-hrms-backend:latest
   docker tag sana-hrms-frontend:v1.0.0-prev sana-hrms-frontend:latest
   
   # Restart
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d backend frontend
   ```

3. **Full Restart** (if state corrupted):
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.prod.yml down
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
   ```

### 3.5 Verification

- [ ] `GET /api/v1/health/live` returns 200
- [ ] `GET /api/v1/health/ready` returns 200 with all checks "ok"
- [ ] `GET /health` (frontend) returns 200
- [ ] Admin login works
- [ ] Key API endpoints respond: `/api/v1/employees`, `/api/v1/attendance/check-in`

### 3.6 Escalation

- If not resolved in 15 min → Engage DevOps Lead
- If not resolved in 30 min → Engage Engineering Lead + Incident Commander
- If database related → Engage DBA immediately

---

## 4. Playbook 2: Database Unavailable

### 4.1 Detection
- **Alert:** `DatabaseDown` (Prometheus: `up{job="postgres"} == 0`)
- **Health Check:** `GET /api/v1/health/ready` fails on database check
- **Application Errors:** Connection refused, timeout, or authentication errors in logs

### 4.2 Diagnosis (Target: < 5 minutes)

```bash
# 1. Check PostgreSQL container
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps db

# 2. Check PostgreSQL logs
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f db --tail 200

# 3. Test direct connection
docker exec sana-db pg_isready -U sana -d sana_hrms

# 3. Check disk space
docker exec sana-db df -h /var/lib/postgresql/data

# 4. Check memory
docker stats sana-db --no-stream

# 5. Check connections
docker exec sana-db psql -U sana -d sana_hrms -c "SELECT count(*) FROM pg_stat_activity;"
```

### 4.3 Common Causes and Mitigations

| Cause | Symptoms | Mitigation |
|-------|----------|------------|
| **Container crashed** | Status `Exited` | Check logs → Restart container |
| **Disk full** | `df -h` shows 100% | Clean up / expand volume |
| **OOM Kill** | `OOMKilled: true` | Increase memory limit |
| **Corruption** | `pg_isready` fails, checksum errors | See Playbook 11 (Data Corruption) |
| **Max connections** | `count(*) FROM pg_stat_activity` > 95 | Increase `max_connections` or fix leaks |
| **Lock contention** | Long-running queries, idle in transaction | Kill blocking queries |
| **Config error** | Wrong password, pg_hba.conf | Fix .env / config → Restart |

### 4.4 Mitigation Steps

1. **Restart Database Container:**
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.prod.yml restart db
   ```

2. **Wait for Health** (max 60s):
   ```bash
   for i in {1..12}; do
     if docker exec sana-db pg_isready -U sana -d sana_hrms; then
       echo "DB healthy"; break
     fi
     sleep 5
   done
   ```

3. **Restart Application** (after DB healthy):
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.prod.yml restart backend
   ```

4. **If Disk Full - Emergency Cleanup:**
   ```bash
   # Check what's using space
   docker exec sana-db du -sh /var/lib/postgresql/data/*
   
   # Clean old WAL files (careful!)
   docker exec sana-db pg_controldata | grep "Latest checkpoint"
   
   # Vacuum if bloat
   docker exec sana-db psql -U sana -d sana_hrms -c "VACUUM FULL;"
   ```

### 4.5 Verification

- [ ] `pg_isready` accepts connections
- [ ] `GET /api/v1/health/ready` returns all checks "ok"
- [ ] Application queries execute normally
- [ ] Connection pool normal (< 50 connections)

### 4.6 Escalation

- If not resolved in 10 min → Engage DBA immediately
- If corruption suspected → See Playbook 11
- If disk full and cannot clean → Engage DevOps for volume expansion

---

## 5. Playbook 3: Database Storage Exhaustion

### 5.1 Detection
- **Alert:** `DiskSpaceCritical` (Prometheus: `(node_filesystem_avail_bytes / node_filesystem_size_bytes) < 0.1`)
- **Health Check:** `GET /api/v1/health` disk check fails
- **Application Errors:** "No space left on device" in logs

### 5.2 Diagnosis

```bash
# 1. Check host disk
df -h /data/sana/pgdata

# 2. Check container disk
docker exec sana-db df -h /var/lib/postgresql/data

# 3. Analyze PostgreSQL size
docker exec sana-db psql -U sana -d sana_hrms -c "
  SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
  FROM pg_tables 
  WHERE schemaname = 'public'
  ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
  LIMIT 20;
"

# 4. Check WAL size
docker exec sana-db du -sh /var/lib/postgresql/data/pg_wal

# 5. Check backup volume
df -h /data/sana/backups
```

### 5.3 Mitigation Steps (Priority Order)

1. **Clean Backup Volume** (if backups consuming space):
   ```bash
   # List backups
   ls -lh /data/sana/backups/
   
   # Keep last 3, remove older (emergency)
   ls -t /data/sana/backups/*.pgdump.enc | tail -n +4 | xargs rm -f
   ```

2. **Vacuum Database** (reclaim space):
   ```bash
   docker exec sana-db psql -U sana -d sana_hrms -c "VACUUM FULL;"
   ```

3. **Clean WAL Files** (if safe):
   ```bash
   # Check current checkpoint
   docker exec sana-db pg_controldata | grep "Latest checkpoint"
   
   # Remove WAL files before checkpoint (DANGEROUS - only if absolutely necessary)
   # pg_archivecleanup /var/lib/postgresql/data/pg_wal <oldest_wal_to_keep>
   ```

4. **Expand Volume** (if persistent):
   ```bash
   # Host level - expand LVM / filesystem
   lvextend -L +10G /dev/mapper/data-pgdata
   resize2fs /dev/mapper/data-pgdata
   ```

### 5.4 Verification

- [ ] Disk usage < 80%
- [ ] Health check disk check passes
- [ ] Database accepting writes
- [ ] New backups completing

---

## 6. Playbook 4: Authentication Failures

### 6.1 Detection
- **Alert:** `RepeatedAuthFailures` (>20 failed logins/5min) or `HighErrorRate` on auth endpoints
- **User Reports:** Unable to login, "Invalid credentials" errors
- **Logs:** High rate of 401 on `/api/v1/auth/login`

### 6.2 Diagnosis

```bash
# 1. Check auth logs
docker compose logs -f backend | grep -i "auth\|login\|jwt\|token"

# 2. Check recent failed logins
docker exec sana-db psql -U sana -d sana_hrms -c "
  SELECT username, count(*), max(created_at) 
  FROM audit_log 
  WHERE action = 'LOGIN' AND status = 'FAILURE' 
  AND created_at > NOW() - INTERVAL '1 hour'
  GROUP BY username ORDER BY count DESC LIMIT 20;
"

# 3. Check rate limiting
docker compose logs -f backend | grep -i "throttle\|rate.limit"

# 4. Verify JWT secrets
docker compose exec backend printenv | grep JWT

# 5. Check Redis/session store (if applicable)
```

### 6.3 Common Causes and Mitigations

| Cause | Symptoms | Mitigation |
|-------|----------|------------|
| **Brute force attack** | Many failed logins from same IP | Rate limiting active → Block IP at firewall |
| **JWT secret mismatch** | All logins fail, tokens invalid | Verify `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` match across deployments |
| **Expired secrets** | Tokens fail validation | Rotate secrets → Restart backend |
| **Database issue** | User lookup fails | Check DB connectivity (Playbook 2) |
| **Clock skew** | Tokens immediately expired | Sync NTP on all hosts |

### 6.4 Mitigation Steps

1. **Verify JWT Secrets:**
   ```bash
   # Check current secrets
   docker compose exec backend printenv JWT_ACCESS_SECRET JWT_REFRESH_SECRET
   
   # Compare with .env
   cat .env | grep JWT
   ```

2. **Restart Backend** (if secret rotation):
   ```bash
   docker compose restart backend
   ```

3. **Block Attacker IPs** (if brute force):
   ```bash
   # At host firewall
   iptables -A INPUT -s <attacker_ip> -j DROP
   
   # Or at cloud firewall
   ```

4. **Check Rate Limiting Config:**
   ```bash
   # Verify @Throttle decorators on auth endpoints
   grep -r "@Throttle" backend/src/auth/
   ```

### 6.5 Verification

- [ ] Admin login works
- [ ] Token refresh works
- [ ] Failed login rate returns to baseline
- [ ] No 500 errors on auth endpoints

---

## 7. Playbook 5: Payroll Processing Failure

### 7.1 Detection
- **Alert:** Custom payroll workflow metric (not yet implemented) or user report
- **User Reports:** Payroll calculation stuck, payslips not generating, period not locking
- **Logs:** Errors in payroll service

### 7.2 Diagnosis

```bash
# 1. Check payroll logs
docker compose logs -f backend | grep -i "payroll\|payslip\|period"

# 2. Check payroll period status
docker exec sana-db psql -U sana -d sana_hrms -c "
  SELECT id, year, month, status, created_at, locked_at 
  FROM payroll_period 
  ORDER BY year DESC, month DESC 
  LIMIT 10;
"

# 3. Check for stuck calculations
docker exec sana-db psql -U sana -d sana_hrms -c "
  SELECT pp.id, pp.year, pp.month, pp.status, 
         COUNT(ps.id) as payslips_generated,
         COUNT(ps.id) FILTER (WHERE ps.status = 'PUBLISHED') as published
  FROM payroll_period pp
  LEFT JOIN payslip ps ON ps.period_id = pp.id
  GROUP BY pp.id
  ORDER BY pp.year DESC, pp.month DESC;
"

# 4. Check for deadlocks
docker exec sana-db psql -U sana -d sana_hrms -c "
  SELECT * FROM pg_stat_activity 
  WHERE state = 'active' 
  AND query LIKE '%payroll%' 
  AND now() - query_start > INTERVAL '5 minutes';
"
```

### 7.3 Common Causes and Mitigations

| Cause | Symptoms | Mitigation |
|-------|----------|------------|
| **Deadlock** | Calculation stuck, no progress | Kill blocking query → Retry |
| **Data integrity** | Constraint violation, null values | Fix data → Retry calculation |
| **Memory/CPU** | Calculation times out | Increase resources → Retry |
| **Concurrent runs** | Two calculations for same period | Lock period → Cancel duplicate |
| **Missing data** | Employees without contracts/salary | Fix employee data → Retry |

### 7.4 Mitigation Steps

1. **Kill Stuck Queries:**
   ```bash
   docker exec sana-db psql -U sana -d sana_hrms -c "
     SELECT pg_terminate_backend(pid) 
     FROM pg_stat_activity 
     WHERE query LIKE '%payroll%' 
     AND state = 'active' 
     AND now() - query_start > INTERVAL '10 minutes';
   "
   ```

2. **Reset Period Status** (if stuck):
   ```bash
   docker exec sana-db psql -U sana -d sana_hrms -c "
     UPDATE payroll_period 
     SET status = 'DRAFT', locked_at = NULL 
     WHERE id = '<period-id>';
   "
   ```

3. **Retry Calculation:**
   ```bash
   # Via API
   curl -X POST https://sana-hrms.com/api/v1/payroll/periods/<id>/calculate \
     -H "Authorization: Bearer <admin-token>"
   ```

4. **Manual Payslip Generation** (if calculation succeeds but generation fails):
   ```bash
   curl -X POST https://sana-hrms.com/api/v1/payroll/payslips/generate \
     -H "Authorization: Bearer <admin-token>" \
     -d '{"periodId": "<period-id>"}'
   ```

### 7.5 Verification

- [ ] Period status shows `CALCULATED` or `LOCKED`
- [ ] Payslips generated for all employees
- [ ] Totals match expected (spot check)
- [ ] Employee payslip view works

---

## 8. Playbook 6: Incorrect Financial Calculations

### 8.1 Detection
- **User Reports:** Payslip amounts don't match expectations
- **Finance Review:** Totals don't match bank transfers
- **Audit:** Discrepancy in payroll reports

### 8.2 Diagnosis

```bash
# 1. Compare payslip with expected calculation
docker exec sana-db psql -U sana -d sana_hrms -c "
  SELECT 
    e.code as employee_code,
    e.first_name, e.last_name,
    ps.gross_amount, ps.deduction_amount, ps.net_amount,
    p.year, p.month
  FROM payslip ps
  JOIN employee e ON e.id = ps.employee_id
  JOIN payroll_period p ON p.id = ps.period_id
  WHERE p.year = 2026 AND p.month = 11
  ORDER BY e.code;
"

# 2. Check component breakdown
docker exec sana-db psql -U sana -d sana_hrms -c "
  SELECT 
    pi.component_id,
    c.code, c.name, c.type,
    SUM(pi.amount) as total,
    COUNT(*) as count
  FROM payslip_item pi
  JOIN payslip ps ON ps.id = pi.payslip_id
  JOIN payroll_period p ON p.id = ps.period_id
  JOIN payroll_component c ON c.id = pi.component_id
  WHERE p.year = 2026 AND p.month = 11
  GROUP BY pi.component_id, c.code, c.name, c.type
  ORDER BY c.type, c.code;
"

# 3. Verify overtime calculation
docker exec sana-db psql -U sana -d sana_hrms -c "
  SELECT * FROM payroll_overtime_calculation_log 
  WHERE period_year = 2026 AND period_month = 11
  ORDER BY employee_id;
"
```

### 8.3 Mitigation Steps

1. **Identify Scope:** Single employee, department, or entire company
2. **Check Configuration:** Overtime base, insurance base, tax brackets
3. **Verify Business Policies:** POL-PR-01, POL-PR-02, POL-PR-03 (see BUSINESS_POLICY_APPROVAL_STATUS.md)
4. **Recalculate:** If configuration fix, recalculate affected period
5. **Reissue Payslips:** If payslips already published

### 8.4 Verification

- [ ] Spot check 10+ employees match manual calculation
- [ ] Totals match bank transfer amounts
- [ ] Audit log shows recalculation with reason
- [ ] Finance team sign-off obtained

---

## 9. Playbook 7: Background Job Failure

### 9.1 Detection
- **Alert:** Custom job metric (not yet implemented) or log monitoring
- **Logs:** Errors in notification delivery, report generation, audit processing
- **User Reports:** Notifications not received, reports not generated

### 9.2 Diagnosis

```bash
# 1. Check job-related logs
docker compose logs -f backend | grep -i "job\|queue\|worker\|cron\|scheduled"

# 2. Check audit outbox processor
docker compose logs -f backend | grep -i "audit.outbox\|outbox"

# 3. Check notification service
docker compose logs -f backend | grep -i "notification\|email\|sms"

# 4. Check for stuck jobs (if using queue)
# Note: No queue system currently implemented - jobs run inline or via cron
```

### 9.3 Common Causes and Mitigations

| Cause | Symptoms | Mitigation |
|-------|----------|------------|
| **Cron not running** | Scheduled jobs not executing | Check host cron / container cron |
| **API failure** | Job calls failing endpoint | Check endpoint health → Retry |
| **Timeout** | Job exceeds timeout | Increase timeout / optimize query |
| **Memory leak** | Worker consumes all memory | Restart / fix leak |
| **Duplicate execution** | Job runs multiple times | Add idempotency keys |

### 9.4 Mitigation Steps

1. **Identify Failed Job Type:**
   - Backup → See Playbook 8
   - Notifications → Check SMTP config
   - Reports → Check report service
   - Audit → Check outbox processor

2. **Manual Retry:**
   ```bash
   # Backup
   curl -X POST https://sana-hrms.com/api/v1/backup/run \
     -H "Authorization: Bearer <admin-token>"
   
   # Report generation
   curl -X POST https://sana-hrms.com/api/v1/reports/generate \
     -H "Authorization: Bearer <admin-token>" \
     -d '{"type": "payroll", "period": "2026-11"}'
   ```

3. **Restart Backend** (if worker stuck):
   ```bash
   docker compose restart backend
   ```

### 9.5 Verification

- [ ] Job completes successfully on retry
- [ ] No duplicate execution
- [ ] Output verified (backup exists, email sent, report generated)

---

## 10. Playbook 8: Backup Failure

### 10.1 Detection
- **Alert:** `BackupFailed` (Prometheus: `sana_backup_status == 0`)
- **Logs:** Error in backup service
- **API:** `GET /api/v1/backup/history` shows failed status

### 10.2 Diagnosis

```bash
# 1. Check backup service logs
docker compose logs -f backend | grep -i "backup"

# 2. Check backup history
curl -H "Authorization: Bearer <admin-token>" \
  https://sana-hrms.com/api/v1/backup/history?limit=5

# 3. Check disk space
df -h /data/sana/backups

# 3. Check database connectivity
docker exec sana-db pg_isready -U sana -d sana_hrms

# 4. Check pg_dump availability
docker exec sana-backend pg_dump --version
```

### 10.3 Common Causes and Mitigations

| Cause | Symptoms | Mitigation |
|-------|----------|------------|
| **Disk full** | No space for backup | Clean up / expand volume (Playbook 3) |
| **DB connection failed** | Cannot connect to PostgreSQL | Check DB health (Playbook 2) |
| **pg_dump error** | Permission, version mismatch | Check pg_dump version / permissions |
| **Encryption failure** | Key mismatch | Verify `BACKUP_ENCRYPTION_KEY` |
| **Timeout** | Large DB, backup takes too long | Increase timeout / parallel pg_dump |

### 10.4 Mitigation Steps

1. **Manual Backup Trigger:**
   ```bash
   curl -X POST https://sana-hrms.com/api/v1/backup/run \
     -H "Authorization: Bearer <admin-token>"
   ```

2. **Emergency Manual Backup:**
   ```bash
   # On database host
   docker exec sana-db pg_dump -U sana -Fc --no-owner --no-privileges sana_hrms > /tmp/manual-backup.pgdump
   
   # Encrypt
   openssl enc -aes-256-gcm -salt -in /tmp/manual-backup.pgdump \
     -out /data/sana/backups/manual-$(date +%Y%m%d).pgdump.enc \
     -k "$BACKUP_ENCRYPTION_KEY"
   ```

3. **Verify Backup:**
   ```bash
   # Decrypt and test
   pg_restore --list /tmp/manual-backup.pgdump | head -20
   ```

### 10.5 Verification

- [ ] Backup status shows `SUCCESS`
- [ ] Backup file exists in volume and S3
- [ ] `pg_restore --list` works
- [ ] Checksum matches

---

## 11. Playbook 9: Security Incident

### 11.1 Detection
- **Alert:** `AuditLogFailures`, `RepeatedAuthFailures`, `UnauthorizedAccessAttempts`
- **SIEM/Log Analysis:** Anomalous patterns
- **User/External Report:** Suspicious activity, data breach notification

### 11.2 Immediate Response (First 15 Minutes)

1. **Contain:**
   ```bash
   # Block suspicious IPs
   iptables -A INPUT -s <suspicious_ip> -j DROP
   
   # Revoke all sessions for compromised accounts
   docker exec sana-db psql -U sana -d sana_hrms -c "
     UPDATE user_session SET revoked_at = NOW() 
     WHERE user_id = '<compromised_user_id>';
   "
   
   # Rotate JWT secrets
   # Generate new secrets, update .env, restart backend
   ```

2. **Preserve Evidence:**
   ```bash
   # Export relevant logs
   docker compose logs backend > /tmp/security-incident-logs-$(date +%s).txt
   
   # Export audit logs for affected users
   docker exec sana-db psql -U sana -d sana_hrms -c "
     SELECT * FROM audit_log 
     WHERE user_id = '<compromised_user_id>' 
     AND created_at > NOW() - INTERVAL '24 hours'
   " > /tmp/audit-export-$(date +%s).csv
   ```

3. **Notify:**
   - Security Engineer
   - Legal/Compliance
   - Engineering Lead
   - CTO (if data exposure confirmed)

### 11.3 Investigation

- Identify attack vector (credential stuffing, token theft, SQLi, etc.)
- Determine scope (which users, what data accessed)
- Check for persistence (backdoors, new admin accounts)
- Review audit logs for privilege escalation

### 11.4 Recovery

- Rotate all secrets (JWT, DB password, encryption keys)
- Force password reset for affected users
- Review and harden access controls
- Deploy WAF rules if applicable

### 11.5 Post-Incident

- Mandatory PIR within 24 hours
- Legal/Compliance review for notification requirements
- Update security controls
- Penetration test if warranted

---

## 12. Playbook 10: Unauthorized Access

### 12.1 Detection
- **Alert:** `UnauthorizedAccessAttempts` (>50 403s/5min)
- **Audit Logs:** Repeated 403s for same user/resource
- **User Report:** "I can see data I shouldn't"

### 12.2 Diagnosis

```bash
# 1. Check 403 patterns
docker compose logs -f backend | grep "403\|Forbidden"

# 2. Check audit logs
docker exec sana-db psql -U sana -d sana_hrms -c "
  SELECT user_id, resource, action, count(*), max(created_at)
  FROM audit_log
  WHERE status = 'FORBIDDEN' 
  AND created_at > NOW() - INTERVAL '1 hour'
  GROUP BY user_id, resource, action
  ORDER BY count DESC LIMIT 20;
"

# 3. Check ABAC policies for affected resources
grep -r "ABAC\|Permission" backend/src/common/guards/
```

### 12.3 Common Causes and Mitigations

| Cause | Mitigation |
|-------|------------|
| **Misconfigured ABAC** | Review and fix permission policies |
| **Missing company scoping** | Add company_id validation to queries |
| **Role privilege escalation** | Audit role assignments, revoke excess |
| **Token confusion** | Verify token contains correct claims |

### 12.4 Mitigation Steps

1. **Revoke Suspicious Sessions:**
   ```bash
   docker exec sana-db psql -U sana -d sana_hrms -c "
     UPDATE user_session SET revoked_at = NOW() 
     WHERE user_id IN (<suspicious_user_ids>);
   "
   ```

2. **Audit User Permissions:**
   ```bash
   docker exec sana-db psql -U sana -d sana_hrms -c "
     SELECT u.username, r.name as role, p.name as permission
     FROM user u
     JOIN user_role ur ON ur.user_id = u.id
     JOIN role r ON r.id = ur.role_id
     JOIN role_permission rp ON rp.role_id = r.id
     JOIN permission p ON p.id = rp.permission_id
     WHERE u.id = '<user_id>';
   "
   ```

3. **Fix ABAC Policy** (if misconfiguration):
   - Deploy fix → Restart backend

### 12.5 Verification

- [ ] 403 rate returns to baseline
- [ ] Affected users have correct access
- [ ] No data exposure confirmed

---

## 13. Playbook 11: Data Corruption

### 13.1 Detection
- **Alert:** `DatabaseDown` or application errors
- **Symptoms:** Constraint violations, missing rows, checksum errors, query crashes
- **User Reports:** Missing data, incorrect calculations

### 13.2 Diagnosis

```bash
# 1. Check PostgreSQL logs for corruption
docker compose logs db | grep -i "corrupt\|checksum\|invalid\|damaged"

# 2. Check specific tables
docker exec sana-db psql -U sana -d sana_hrms -c "
  SELECT schemaname, tablename, 
         pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
  FROM pg_tables WHERE schemaname = 'public'
  ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"

# 3. Run integrity checks
docker exec sana-db psql -U sana -d sana_hrms -c "
  -- Check for orphaned rows
  SELECT 'employee_company' as check, count(*) 
  FROM employee e LEFT JOIN company c ON c.id = e.company_id 
  WHERE c.id IS NULL
  UNION ALL
  SELECT 'payslip_period', count(*) 
  FROM payslip ps LEFT JOIN payroll_period p ON p.id = ps.period_id 
  WHERE p.id IS NULL;
"

# 4. Try pg_dump (will fail on corruption)
pg_dump -U sana -Fc sana_hrms > /dev/null
```

### 13.3 Mitigation Steps

1. **Stop All Writes:**
   ```bash
   docker compose stop backend frontend
   ```

2. **Assess Scope:**
   - Single table? Multiple tables? Indexes only?
   - Run `pg_dump --schema-only` to see if schema intact

3. **Restore from Backup** (see DATABASE_RESTORE_GUIDE.md):
   ```bash
   # Identify latest clean backup
   curl -H "Authorization: Bearer <admin-token>" \
     https://sana-hrms.com/api/v1/backup/history?limit=5
   
   # Restore to staging first
   # Then verify integrity
   ```

4. **If No Clean Backup:**
   - Attempt `pg_dump` with `--exclude-table-data` for corrupted tables
   - Manual data reconstruction from audit logs
   - Engage PostgreSQL support

### 13.4 Verification

- [ ] `pg_dump` completes without errors
- [ ] All foreign key constraints valid
- [ ] Business invariants hold (see FINANCIAL_INTEGRITY_VALIDATION.md)
- [ ] Critical workflows functional

---

## 14. Playbook 12: Failed Deployment

### 14.1 Detection
- **CI/CD:** Pipeline fails
- **Health Checks:** Post-deploy health checks fail
- **Alerts:** ServiceDown or HighErrorRate after deploy

### 14.2 Diagnosis

```bash
# 1. Check deployment logs
# CI/CD pipeline output

# 2. Check container status
docker compose ps

# 3. Check new container logs
docker compose logs -f backend --tail 200

# 4. Check health endpoint
curl -v http://localhost:4114/api/v1/health/ready

# 5. Check migration status
docker exec sana-db psql -U sana -d sana_hrms -c "
  SELECT * FROM _prisma_migrations 
  ORDER BY finished_at DESC LIMIT 10;
"
```

### 14.3 Mitigation Steps

1. **Immediate Rollback (Application Only):**
   ```bash
   # Tag failed images
   docker tag sana-hrms-backend:latest sana-hrms-backend:failed-$(date +%s)
   docker tag sana-hrms-frontend:latest sana-hrms-frontend:failed-$(date +%s)
   
   # Restore previous
   docker tag sana-hrms-backend:v1.0.0-prev sana-hrms-backend:latest
   docker tag sana-hrms-frontend:v1.0.0-prev sana-hrms-frontend:latest
   
   # Restart
   docker compose up -d backend frontend
   ```

2. **Database Rollback** (if migration applied):
   ```bash
   # Use pre-deployment backup
   curl -X POST https://sana-hrms.com/api/v1/backup/restore \
     -H "Authorization: Bearer <admin-token>" \
     -H "Content-Type: application/json" \
     -d '{"backupId": "<pre-deploy-backup-id>", "currentPassword": "<pwd>", "confirmationDatabase": "sana_hrms"}'
   
   # Or manual pg_restore
   ```

3. **Verify Rollback:**
   - Health checks pass
   - Application functional
   - No data loss

### 14.4 Verification

- [ ] Health checks all pass
- [ ] Critical workflows functional
- [ ] No data inconsistency
- [ ] Monitoring shows normal patterns

---

## 15. Playbook Testing and Maintenance

### 15.1 Testing Schedule

| Playbook | Test Type | Frequency | Last Tested |
|----------|-----------|-----------|-------------|
| 1. Application Unavailable | Tabletop | Monthly | 2026-11-18 |
| 2. Database Unavailable | Tabletop | Monthly | 2026-11-18 |
| 3. Storage Exhaustion | Tabletop | Quarterly | 2026-11-18 |
| 4. Auth Failures | Tabletop | Monthly | 2026-11-18 |
| 5. Payroll Failure | Tabletop | Monthly | 2026-11-18 |
| 6. Financial Calculations | Tabletop | Quarterly | 2026-11-18 |
| 7. Background Job Failure | Tabletop | Quarterly | 2026-11-18 |
| 8. Backup Failure | Live Drill | Monthly | 2026-11-18 (DR Drill) |
| 9. Security Incident | Tabletop | Quarterly | 2026-11-18 |
| 10. Unauthorized Access | Tabletop | Quarterly | 2026-11-18 |
| 11. Data Corruption | Tabletop | Quarterly | 2026-11-18 |
| 12. Failed Deployment | Live Drill | Per Release | 2026-11-18 (DR Drill) |

### 15.2 Playbook Review

| Trigger | Action |
|---------|--------|
| Post-incident | Update playbook with lessons learned |
| New feature release | Add relevant playbook sections |
| Infrastructure change | Update affected playbooks |
| Quarterly review | Full playbook audit |

---

**Document Version:** 1.0  
**Date:** 2026-11-18  
**Status:** Staging Tabletop Verified — Production Execution Pending  
**Classification:** CONFIDENTIAL