# Sana HRMS - Go-Live Runbook

**Version:** 1.0  
**Date:** 2026-11-18  
**Release:** v1.0.0  
**Classification:** CONFIDENTIAL — Operations Only  

---

## 1. Go-Live Overview

| Item | Detail |
|------|--------|
| **Release Version** | v1.0.0 |
| **Go-Live Date** | TBD (pending final approval) |
| **Go-Live Window** | 02:00 — 06:00 IRST (low traffic) |
| **Environment** | Production (`sana-hrms.com`) |
| **Release Manager** | [Name] |
| **Incident Commander** | [Name] |
| **Rollback Decision Deadline** | T+30 minutes post go-live |

---

## 2. Pre-Go-Live Checklist (T-24h to T-0)

### T-24 Hours
- [ ] Final release candidate tagged: `v1.0.0`
- [ ] Docker images pushed to registry: `sana-hrms-backend:v1.0.0`, `sana-hrms-frontend:v1.0.0`, `sana-hrms-proxy:v1.0.0`
- [ ] Database migration script reviewed: `prisma migrate deploy` (no breaking changes)
- [ ] Backup completed: `docker exec sana-backend node -e "fetch('http://localhost:4114/api/v1/backup/run', {method:'POST',headers:{Authorization:'Bearer '+process.env.ADMIN_TOKEN}})"`
- [ ] Backup verified: Checksum + decrypt test
- [ ] Staging acceptance signed off
- [ ] Monitoring stack deployed and validated
- [ ] DR drill completed successfully
- [ ] Runbook reviewed by all leads
- [ ] On-call schedule confirmed for go-live + 48h
- [ ] Communication plan distributed (status page, Slack, email)

### T-2 Hours
- [ ] Maintenance window announced on status page
- [ ] DNS TTL lowered to 60s (if external DNS)
- [ ] Team on standby (DevOps, Backend, Frontend, DBA)
- [ ] Slack #incident-go-live channel created
- [ ] Phone bridge opened
- [ ] Final production backup triggered and verified

### T-30 Minutes
- [ ] Write freeze on production application (enable maintenance mode)
- [ ] Final production backup completed
- [ ] Team confirmed ready on bridge
- [ ] Rollback procedure reviewed one final time

---

## 3. Go-Live Procedure (T-0)

### 3.1 Database Migration
```bash
# 1. Verify current production DB state
docker exec sana-db psql -U sana -d sana_hrms -c "SELECT count(*) FROM \"_prisma_migrations\";"

# 2. Run migrations (if any)
docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy

# 3. Verify migration success
docker exec sana-db psql -U sana -d sana_hrms -c "SELECT * FROM \"_prisma_migrations\" ORDER BY \"finishedAt\" DESC LIMIT 5;"
```

### 3.2 Application Deployment
```bash
# 1. Pull new images
docker compose -f docker-compose.yml -f docker-compose.prod.yml pull backend frontend proxy

# 2. Stop current backend (drain connections)
docker compose -f docker-compose.yml -f docker-compose.prod.yml stop backend

# 3. Start new backend
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d backend

# 4. Wait for backend health (max 60s)
for i in {1..12}; do
  if curl -sf http://localhost:4114/api/v1/health/ready > /dev/null; then echo "Backend healthy"; break; fi
  sleep 5
done

# 5. Deploy frontend
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d frontend

# 6. Deploy proxy (if config changed)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d proxy
```

### 3.3 Post-Deployment Verification (T+0 to T+10min)

| Check | Command | Expected | Timeout |
|-------|---------|----------|---------|
| Backend Liveness | `curl -f https://sana-hrms.com/api/v1/health/live` | 200 OK | 2 min |
| Backend Readiness | `curl -f https://sana-hrms.com/api/v1/health/ready` | 200 OK | 2 min |
| Frontend | `curl -f https://sana-hrms.com/health` | 200 OK | 1 min |
| Admin Login | `curl -X POST https://sana-hrms.com/api/v1/auth/login ...` | 200 + tokens | 2 min |
| Key API | `curl -H "Auth: Bearer <token>" https://sana-hrms.com/api/v1/employees?limit=1` | 200 + data | 1 min |
| Database | `docker exec sana-db pg_isready -U sana -d sana_hrms` | Accepts | 30 sec |

---

## 4. Go-Live Validation (T+10min to T+30min)

### 4.1 Critical User Journeys
- [ ] Admin login → Dashboard loads
- [ ] Employee check-in/out
- [ ] Leave request → approval flow
- [ ] Payroll period → calculation → payslip view
- [ ] Document upload/download
- [ ] Approval inbox → decision

### 4.2 Monitoring Verification
- [ ] Prometheus scraping all targets
- [ ] Grafana dashboards updating
- [ ] Alertmanager receiving test alert
- [ ] Logs flowing to Loki

### 4.3 Business Validation
- [ ] Finance team: Payroll calculation spot-check
- [ ] HR team: Employee data integrity spot-check
- [ ] IT team: Performance baseline comparison

---

## 5. Go/No-Go Decision Point (T+30min)

| Criteria | Status |
|----------|--------|
| All health checks passing | ☐ |
| Critical journeys working | ☐ |
| No critical alerts firing | ☐ |
| Performance within baseline | ☐ |
| Team confident | ☐ |

**Decision:** ☐ **PROCEED** — Go-live successful  
**Decision:** ☐ **ROLLBACK** — Initiate rollback procedure

---

## 6. Post Go-Live (T+30min to T+4h)

### T+30min to T+2h
- [ ] Monitor error rates, latency, error logs
- [ ] Verify backup job runs at 02:00
- [ ] Confirm monitoring alerts configured
- [ ] Team debrief on bridge

### T+2h to T+4h
- [ ] Business user acceptance confirmation
- [ ] Performance metrics vs baseline
- [ ] Error budget consumption check
- [ ] Update status page: "Operational"

### T+24h
- [ ] Full regression smoke test
- [ ] Backup verification
- [ ] Log review for anomalies
- [ ] Team stand-down (if stable)

---

## 7. Communication Plan

| Audience | Channel | Message | Timing |
|----------|---------|---------|--------|
| Internal Team | Slack #releases | Go-live started | T-0 |
| Internal Team | Slack #releases | Go-live successful | T+30min |
| All Staff | Email | Maintenance complete | T+1h |
| Customers | Status Page | Maintenance complete | T+30min |
| Management | Email | Go-live report | T+4h |

---

## 8. Emergency Contacts

| Role | Name | Phone | Slack | Email |
|------|------|-------|-------|-------|
| Release Manager | | | | |
| DevOps Lead | | | | |
| Backend Lead | | | | |
| Frontend Lead | | | | |
| DBA | | | | |
| DBA Backup | | | | |
| Incident Commander | | | | |

---

## 9. Quick Reference Commands

```bash
# View logs
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f frontend

# Restart single service
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart backend

# Check container status
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps

# Database connection test
docker exec sana-db pg_isready -U sana -d sana_hrms

# Manual backup
curl -X POST https://sana-hrms.com/api/v1/backup/run -H "Authorization: Bearer <admin-token>"
```

---

**Document Version:** 1.0  
**Date:** 2026-11-18  
**Status:** Ready for Go-Live  
**Classification:** CONFIDENTIAL