# Sana HRMS - Production Operations Checklist

**Version:** 1.0  
**Date:** 2026-11-18  
**Auditor:** Senior DevOps Engineer  
**Classification:** INTERNAL  

---

## 1. Pre-Deployment Checklist

### 1.1 Code Quality Gates
- [ ] TypeScript compilation: 0 errors (`npx tsc --noEmit`)
- [ ] ESLint: 0 errors, 0 warnings
- [ ] Frontend unit tests: 100% pass
- [ ] Backend unit tests: 100% pass
- [ ] Integration tests: 100% pass
- [ ] Security audit: 0 critical/high vulnerabilities
- [ ] Frontend build: Success
- [ ] Backend build: Success

### 1.2 Security
- [ ] JWT secrets rotated (64+ char base64)
- [ ] Database password rotated
- [ ] Backup encryption key rotated
- [ ] Admin password set (strong, 20+ chars)
- [ ] CORS origins configured for production
- [ ] Trusted proxies configured
- [ ] Swagger disabled in production
- [ ] Rate limiting configured
- [ ] CSP headers configured
- [ ] HSTS enabled
- [ ] CSP headers configured

### 1.3 Database
- [ ] Migrations reviewed
- [ ] Pre-deployment backup completed
- [ ] Migration rollback plan documented
- [ ] Seed data disabled (SEED_DEMO_DATA=false)
- [ ] Connection pooling configured
- [ ] Connection limits set

### 1.4 Infrastructure
- [ ] Docker images built and pushed
- [ ] Docker images scanned (Trivy: 0 critical/high)
- [ ] Docker images signed (cosign)
- [ ] Docker Compose production file reviewed
- [ ] Resource limits set (CPU/Memory)
- [ ] Health checks configured
- [ ] Logging configured (JSON, rotation)
- [ ] Volumes mounted (pgdata, backups, uploads)
- [ ] Certificates valid (>30 days)
- [ ] DNS records updated
- [ ] Firewall rules reviewed

---

## 2. Deployment Day Checklist

### 2.1 Pre-Deployment (T-60 min)
- [ ] Team assembled in incident channel
- [ ] Maintenance window announced
- [ ] Stakeholders notified
- [ ] Rollback plan reviewed
- [ ] Backup completed (< 1 hour ago)
- [ ] Monitoring dashboards open
- [ ] Alerting verified
- [ ] Rollback plan accessible

### 2.2 Deployment (T-0)
- [ ] Trigger deployment workflow
- [ ] Monitor pipeline stages
- [ ] Verify image pull
- [ ] Verify container startup
- [ ] Verify health checks pass
- [ ] Verify database migrations
- [ ] Verify API responsiveness
- [ ] Verify frontend loads
- [ ] Verify authentication works
- [ ] Verify critical APIs

### 2.3 Post-Deployment (T+0 to T+30 min)
- [ ] Smoke test critical paths
- [ ] Verify error rates < 0.1%
- [ ] Verify latency p95 < 500ms
- [ ] Verify authentication flow
- [ ] Verify role-based access
- [ ] Verify critical workflows
- [ ] Verify monitoring/alerting
- [ ] Update status page
- [ ] Notify stakeholders

### 2.4 Post-Deployment (T+30 min to T+2h)
- [ ] Monitor error rates
- [ ] Monitor latency
- [ ] Monitor resource usage
- [ ] Verify backup job runs
- [ ] Verify audit logs
- [ ] Verify audit alerts
- [ ] Collect stakeholder feedback
- [ ] Close deployment ticket

---

## 3. Daily Operations

### 3.1 Morning Checks (08:00-09:00)
```bash
# Service status
docker compose ps

# Health checks
curl -s http://localhost:8080/health | jq .
curl -s http://localhost:8080/api/v1/health/ready | jq .

# Backup status (last 24h)
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:8080/api/v1/backup/history?limit=5" | jq '.data[] | {fileName, result, startedAt, size}'

# Disk space
df -h /data/sana/

# Error rate (last hour)
docker compose logs --since 1h backend | grep -i error | wc -l
```

### 3.2 Monitoring Dashboard Checks
- [ ] All services green
- [ ] Error rate < 0.1%
- [ ] Latency p95 < 500ms
- [ ] CPU < 70%
- [ ] Memory < 80%
- [ ] Disk < 80%
- [ ] Backup age < 24h
- [ ] SSL cert > 30 days

---

## 3. Weekly Operations

### 3.1 Weekly Maintenance (Sunday 02:00-04:00)
- [ ] OS updates (`apt update && apt upgrade -y`)
- [ ] Docker image updates (`docker compose pull && docker compose up -d`)
- [ ] Certificate renewal check (`certbot renew --dry-run`)
- [ ] Backup cleanup (remove > retention)
- [ ] Log rotation check
- [ ] Index maintenance (`REINDEX DATABASE sana_hrms`)
- [ ] Vacuum analyze (`VACUUM ANALYZE`)
- [ ] Index usage review

### 3.2 Weekly Security
- [ ] Dependency audit (`npm audit --audit-level=high`)
- [ ] Certificate expiry check
- [ ] Access review (inactive users)
- [ ] Audit log review (anomalies)
- [ ] Failed login review

---

## 4. Monthly Operations

### 4.1 Monthly Maintenance (1st Saturday)
- [ ] PostgreSQL minor version upgrade (if available)
- [ ] Docker base image updates
- [ ] Dependency updates (minor/patch)
- [ ] Certificate renewal (if < 30 days)
- [ ] Backup restore test (staging)
- [ ] DR drill (quarterly)
- [ ] Performance baseline update
- [ ] Capacity planning review

### 4.2 Monthly Security
- [ ] Dependency audit (`npm audit --audit-level=high`)
- [ ] Container scan (Trivy)
- [ ] Penetration test (quarterly)
- [ ] Access review (admin/superadmin)
- [ ] Secret rotation (quarterly)

---

## 5. Incident Response

### 5.1 Severity Levels

| Severity | Definition | Response Time | Escalation |
|----------|------------|---------------|------------|
| SEV-1 | Complete outage, data loss, security breach | 15 min | On-call → DevOps Lead → CTO |
| SEV-2 | Major feature down, perf degradation | 30 min | On-call → DevOps Lead |
| SEV-3 | Minor feature degraded | 2 hours | On-call |
| SEV-4 | Cosmetic, enhancement | Next business day | Team lead |

### 5.1 Incident Response Flow

```
1. Alert received → Acknowledge (5 min)
2. Triage → Severity assignment (10 min)
3. Diagnose → Root cause (30 min)
4. Mitigate → Workaround/fix (variable)
5. Verify → Health checks pass
6. Communicate → Stakeholders notified
7. Document → Incident ticket + timeline
8. Review → Post-mortem (48h)
```

### 5.2 Key Commands for Incidents

```bash
# Service restart
docker compose restart backend

# View logs
docker compose logs -f backend --tail 200

# Database queries
docker exec sana-db psql -U sana -d sana_hrms -c "SELECT * FROM pg_stat_activity;"

# Kill long queries
docker exec sana-db psql -U sana -d sana_hrms -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'active' AND now() - query_start > interval '5 minutes';"

# Restart DB
docker compose restart db

# Clear cache
docker compose restart frontend

# Scale (if Swarm/K8s)
docker service scale sana_backend=3
```

---

## 6. Backup & Recovery

### 6.1 Backup Schedule
- Daily: 02:00 (automated)
- Retention: 10 daily + 12 monthly + 5 yearly
- Offsite: S3/GCS (GLACIER_IR, SSE-KMS)

### 6.2 Restore Commands

```bash
# List backups
curl -H "Authorization: Bearer $TOKEN" "http://localhost:8080/api/v1/backup/history?limit=5"

# Restore to staging
curl -X POST "http://localhost:8080/api/v1/backup/restore" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"backupId":"<id>","currentPassword":"<pwd>","confirmationDatabase":"sana_restore_test"}'

# Manual restore (emergency)
docker exec sana-db pg_restore --exit-on-error --single-transaction \
  --no-owner --no-privileges -d sana_hrms < backup.pgdump
```

---

## 7. Scaling & Performance

### 7.1 Scaling Triggers

| Metric | Threshold | Action |
|--------|-----------|--------|
| CPU > 80% (5min) | Scale backend +1 | Auto |
| Memory > 85% | Scale backend +1 | Auto |
| DB connections > 150 | Add PgBouncer | Manual |
| Latency p95 > 2s | Investigate | Alert |
| Error rate > 1% | Investigate | Alert |

### 6.2 Manual Scaling

```bash
# Docker Compose
docker compose up -d --scale backend=3 --scale frontend=2

# Kubernetes (future)
kubectl scale deployment sana-backend --replicas=5
```

---

## 8. Certificate Management

### 8.1 Certificate Inventory

| Cert | Expiry | Renewal | Auto |
|-----|--------|---------|------|
| hr.company.com | 2027-02-15 | 2027-01-15 | Certbot |
| api.hr.company.com | 2027-02-15 | 2027-01-15 | Certbot |
| Internal CA | 2028-11-18 | 2028-10-18 | Manual |

### 8.2 Renewal Procedure

```bash
# Certbot renewal
certbot renew --nginx --quiet

# Verify
certbot certificates

# Reload nginx
docker exec sana-proxy nginx -s reload
```

---

## 9. Capacity Planning

| Resource | Current | Threshold | Action |
|----------|---------|-----------|--------|
| DB Storage | 45 GB / 500 GB | 80% | Expand volume |
| DB Connections | 85 / 200 | 80% | Add PgBouncer |
| Backend Memory | 512 MB / 1 GB | 80% | Scale up |
| Frontend Memory | 128 MB / 256 MB | 80% | Scale up |
| Backup Storage | 120 GB / 500 GB | 80% | Expand/cleanup |
| SSL Cert Expiry | 89 days | 30 days | Renew |

---

## 10. Communication Plan

| Event | Channel | Audience | Timing |
|-------|---------|----------|--------|
| Planned maintenance | Email + Slack | All users | 48h before |
| Emergency maintenance | Slack + Email | Affected users | Immediate |
| Security incident | Slack + Email + Phone | All | Immediate |
| Deployment | Slack | Engineering | Start/End |
| Post-incident | Email + Wiki | All stakeholders | 48h after |

---

**Document Version:** 1.0  
**Last Updated:** 2026-11-18  
**Next Review:** Monthly  
**Owner:** DevOps Team  
**Classification:** INTERNAL