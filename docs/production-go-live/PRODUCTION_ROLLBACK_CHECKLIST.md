# Sana HRMS - Production Rollback Checklist

**Version:** 1.0  
**Date:** 2026-11-18  
**Release:** v1.0.0  
**Classification:** CONFIDENTIAL — Operations Only  

---

## 1. Rollback Triggers

**AUTOMATIC ROLLBACK IF ANY:**
- [ ] Backend health check failing > 5 minutes post-deployment
- [ ] Critical error rate > 10% for 5 minutes
- [ ] Database migration failure
- [ ] Data corruption detected
- [ ] Security breach confirmed

**MANUAL ROLLBACK IF ANY (Team Decision):**
- [ ] Performance degradation > 50% baseline
- [ ] Critical business workflow broken
- [ ] Major UI regression reported by users
- [ ] Integration failures with external systems

---

## 2. Rollback Decision Authority

| Role | Authority |
|------|-----------|
| **Incident Commander** | Final rollback decision |
| **Release Manager** | Can initiate rollback |
| **DevOps Lead** | Execute rollback |
| **DBA** | Database rollback execution |
| **CTO** | Notified for business impact > $10k |

---

## 3. Rollback Procedures

### 3.1 Application Rollback (Containers Only) — Target: < 5 minutes

**When:** New containers deployed but DB schema unchanged

```bash
# 1. Stop new backend
docker compose -f docker-compose.yml -f docker-compose.prod.yml stop backend

# 2. Start previous backend image (tagged as v1.0.0-prev)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d backend

# 3. Verify health
curl -f https://sana-hrms.com/api/v1/health/ready

# 4. Restart frontend if needed
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart frontend
```

**Verification:**
- [ ] Backend health: 200 OK
- [ ] Frontend loads: 200 OK
- [ ] Admin login works
- [ ] Key API endpoints respond

---

### 3.2 Database Rollback (Schema Change) — Target: < 15 minutes

**When:** Migration applied but causing issues

```bash
# 1. STOP ALL APPLICATION TRAFFIC
docker compose -f docker-compose.yml -f docker-compose.prod.yml stop backend frontend

# 2. Verify pre-migration backup exists (created at T-30min)
docker exec sana-backend node -e "
  const {PrismaClient} = require('@prisma/client');
  const p = new PrismaClient();
  p.backupHistory.findFirst({where:{result:'SUCCESS'}, orderBy:{startedAt:'desc'}})
    .then(b => console.log('Latest backup:', b.fileName, b.startedAt));
"

# 3. Restore database from pre-migration backup
# Option A: Via API (preferred)
curl -X POST "https://sana-hrms.com/api/v1/backup/restore" \
  -H "Authorization: Bearer <superadmin-token>" \
  -H "Content-Type: application/json" \
  -d '{"backupId": "<pre-migration-backup-uuid>", "currentPassword": "<admin-pwd>", "confirmationDatabase": "sana_hrms"}'

# Option B: Direct pg_restore (if API unavailable)
# Download backup from S3
aws s3 cp s3://sana-hrms-backups/prod/<pre-migration-backup>.pgdump.enc ./restore.pgdump.enc
# Decrypt
node decrypt-backup.js restore.pgdump.enc restore.pgdump "$BACKUP_ENCRYPTION_KEY"
# Restore
docker exec -i sana-db pg_restore --exit-on-error --single-transaction --no-owner --no-privileges -d sana_hrms < restore.pgdump

# 4. Verify restoration
docker exec sana-db psql -U sana -d sana_hrms -c "SELECT count(*) FROM \"_prisma_migrations\";"
docker exec sana-db psql -U sana -d sana_hrms -c "SELECT count(*) FROM \"User\";"

# 5. Restart application with previous image
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d backend frontend

# 6. Verify health
curl -f https://sana-hrms.com/api/v1/health/ready
```

**Verification:**
- [ ] Migration count rolled back
- [ ] User/Employee counts match pre-deployment
- [ ] Admin login works
- [ ] Key workflows functional

---

### 3.3 Full Disaster Rollback — Target: < 30 minutes

**When:** Data corruption or major failure requiring full DR

```bash
# 1. Activate DR protocol (see DISASTER_RECOVERY_PLAN.md Section 4.10)
# 2. Provision DR environment if needed
# 3. Restore from latest known-good backup (S3)
# 4. Deploy application from known-good images
# 5. Update DNS to DR endpoint
# 6. Full validation per DISASTER_RECOVERY_PLAN.md Section 5
```

---

## 4. Rollback Verification Checklist

### Post-Rollback Validation (Must Complete Within 10 Minutes)

| Check | Command/Action | Expected | ✅ |
|-------|----------------|----------|----|
| Backend Liveness | `curl -f /api/v1/health/live` | 200 OK | ☐ |
| Backend Readiness | `curl -f /api/v1/health/ready` | 200 OK | ☐ |
| Frontend | `curl -f /health` | 200 OK | ☐ |
| Admin Login | POST /auth/login | 200 + tokens | ☐ |
| Employee List | GET /api/v1/employees | 200 + data | ☐ |
| Attendance Check-in | POST /api/v1/attendance/check-in | 200 | ☐ |
| Leave Request | POST /api/v1/leaves | 200 | ☐ |
| Error Rate | Prometheus `rate(5xx)` | < 1% | ☐ |
| Latency p95 | Prometheus `histogram_quantile(0.95)` | < 500ms | ☐ |
| Database Connections | `sana_db_connections_active` | < 50 | ☐ |

---

## 5. Post-Rollback Actions

### Immediate (0-30 min)
- [ ] Confirm rollback successful on bridge
- [ ] Update status page: "Degraded Performance" → "Operational"
- [ ] Notify stakeholders: "Rollback completed, service restored"
- [ ] Document incident timeline

### Short-term (30 min - 4h)
- [ ] Root cause analysis started
- [ ] Failed deployment artifacts preserved
- [ ] Monitoring alerts reviewed
- [ ] Team debrief scheduled

### Long-term (24-72h)
- [ ] Complete RCA document
- [ ] Fix root cause in new release branch
- [ ] Re-test in staging
- [ ] Schedule new go-live

---

## 6. Rollback Communication

| Audience | Message | Channel |
|----------|---------|---------|
| Internal Team | "ROLLBACK INITIATED - [reason]" | Slack #incident-go-live |
| Internal Team | "ROLLBACK COMPLETE - Service restored" | Slack #incident-go-live |
| All Staff | "Brief service interruption resolved" | Email |
| Customers | "Brief maintenance completed" | Status Page |
| Management | "Rollback executed, RCA in progress" | Email |

---

## 7. Rollback Metrics Tracking

| Metric | Target | Actual | Notes |
|--------|--------|--------|-------|
| Decision to Rollback Start | < 5 min | | |
| Application Rollback Time | < 5 min | | |
| Database Rollback Time | < 15 min | | |
| Full Verification Time | < 10 min | | |
| Total Rollback Duration | < 30 min | | |
| Data Loss | 0 | | Must be 0 |
| User Impact Duration | < 15 min | | |

---

## 8. Rollback Readiness (Pre-Go-Live)

- [ ] Previous Docker images tagged: `v1.0.0-prev`
- [ ] Pre-migration backup verified and accessible
- [ ] Database restore procedure tested (DR drill)
- [ ] Rollback commands documented and accessible
- [ ] Team trained on rollback procedures
- [ ] Communication templates prepared
- [ ] Status page access confirmed
- [ ] PagerDuty/on-call notified of go-live

---

## 9. No-Rollback Scenarios (Require Fix Forward)

**DO NOT ROLLBACK IF:**
- [ ] Issue is frontend-only CSS/visual bug
- [ ] Issue is non-critical feature with workaround
- [ ] Issue affects < 1% users with known workaround
- [ ] Rollback would cause MORE data inconsistency than fix-forward

**In these cases:** Hotfix branch → staging validation → emergency deploy

---

## 10. Sign-Off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Incident Commander | | | |
| Release Manager | | | |
| DevOps Lead | | | |
| DBA | | | |

---

**Document Version:** 1.0  
**Date:** 2026-11-18  
**Status:** Ready for Go-Live  
**Classification:** CONFIDENTIAL