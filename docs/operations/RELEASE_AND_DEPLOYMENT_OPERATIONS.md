# Sana HRMS - Release and Deployment Operations

**Version:** 1.0  
**Date:** 2026-11-18  
**Environment:** Production / Staging  
**Classification:** INTERNAL  

---

## 1. Overview

This document defines the controlled release and deployment process for Sana HRMS, based on the Stage 11 go-live procedures and ongoing operational deployments.

**Current State:** Manual docker-compose deployment with documented runbooks. CI/CD pipeline exists but production deployment requires manual approval.

---

## 2. Release Strategy

### 2.1 Release Types

| Type | Version Pattern | Frequency | Approval | Deployment |
|------|-----------------|-----------|----------|------------|
| **Major** | X.0.0 | ~12 months | Full (All leads + CTO) | Full process |
| **Minor** | X.Y.0 | ~6 weeks | Engineering + Product | Standard |
| **Patch** | X.Y.Z | As needed | Engineering Lead | Expedited |
| **Hotfix** | X.Y.Z-hotfix.N | Emergency | Incident Commander | Emergency |

### 2.2 Release Branching

```
main (production-ready)
  ├── release/v1.0.0 (stabilization)
  │   ├── hotfix/v1.0.1 (emergency fixes)
  ├── develop (integration)
  │   ├── feature/* (feature branches)
  │   ├── bugfix/* (bug fixes)
  │   └── release/v1.1.0 (next minor)
```

### 2.3 Release Tags

| Format | Example | Meaning |
|--------|---------|---------|
| `v<major>.<minor>.<patch>` | `v1.0.0` | Production release |
| `v<major>.<minor>.<patch>-rc.<n>` | `v1.0.0-rc.1` | Release candidate |
| `v<major>.<minor>.<patch>-hotfix.<n>` | `v1.0.1-hotfix.1` | Hotfix |

---

## 3. CI/CD Pipeline

### 3.1 Pipeline Stages

| Stage | Tool | Trigger | Gate | Artifacts |
|-------|------|---------|------|-----------|
| **Code Checkout** | Git | PR / Push | — | Source |
| **TypeScript Check** | `npx tsc --noEmit` | PR / Push | Required (0 errors) | — |
| **Lint** | ESLint + Prettier | PR / Push | Required (0 errors) | — |
| **Unit Tests** | Jest (backend) / Custom (frontend) | PR / Push | Required (100% pass) | Test Report |
| **Security Scan** | `npm audit --audit-level=high` + Trivy | Build | Required (0 Critical/High) | Scan Report |
| **Build** | Docker multi-stage | Merge to develop/main | Required | Docker Images |
| **Integration Tests** | Jest (backend) | Merge to develop/main | Required | Test Report |
| **Staging Deploy** | Manual docker-compose | Tag `v*-rc.*` | Manual approval | Staging URL |
| **E2E Tests** | Playwright | Staging deploy | Required (100% pass) | Test Report |
| **Production Deploy** | Manual docker-compose | Tag `v*` (no -rc) | Full approval | Production |

### 3.2 Quality Gates

| Gate | Criteria | Enforcement |
|------|----------|-------------|
| **TypeScript** | 0 errors, strict mode | CI fail |
| **Lint** | 0 errors, 0 warnings | CI fail |
| **Tests** | 100% pass, no skipped | CI fail |
| **Security** | 0 Critical, 0 High vulns | CI fail |
| **Bundle Size** | Frontend < 250KB gzipped | CI warn |
| **Coverage** | Backend ≥ 85% statements | CI warn |
| **Accessibility** | 0 axe-core violations | CI fail |

---

## 4. Deployment Procedures

### 4.1 Staging Deployment

```bash
# 1. Ensure images are built and pushed
docker compose -f docker-compose.yml -f docker-compose.prod.yml build
docker tag sana-hrms-backend:latest registry/sana-hrms-backend:v1.0.0-rc.1
docker tag sana-hrms-frontend:latest registry/sana-hrms-frontend:v1.0.0-rc.1
docker push registry/sana-hrms-backend:v1.0.0-rc.1
docker push registry/sana-hrms-frontend:v1.0.0-rc.1

# 2. Deploy to staging
cd /opt/sana-hrms/staging
docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.monitoring.yml pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.monitoring.yml up -d

# 3. Verify health
for i in {1..12}; do
  if curl -sf https://staging.sana-hrms.com/api/v1/health/ready > /dev/null; then
    echo "Staging healthy"; break
  fi
  sleep 5
done

# 4. Run smoke tests
./run-smoke-tests.sh
```

### 4.2 Production Deployment (Go-Live)

**Prerequisites:**
- [ ] All CI gates passed
- [ ] Staging acceptance signed off
- [ ] RPO/RTO formally approved
- [ ] PagerDuty configured
- [ ] Production TLS certificates installed
- [ ] Team on standby
- [ ] Rollback plan reviewed

```bash
# 1. Pre-deployment backup
curl -X POST https://sana-hrms.com/api/v1/backup/run \
  -H "Authorization: Bearer <admin-token>"
# Verify backup completed

# 2. Enable maintenance mode (if needed)
# Update nginx config or set env var

# 3. Pull new images
cd /opt/sana-hrms/production
docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.monitoring.yml pull

# 4. Database migration (if any)
docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy

# 5. Deploy backend (zero-downtime if possible)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d backend

# 6. Verify backend health (max 60s)
for i in {1..12}; do
  if curl -sf https://sana-hrms.com/api/v1/health/ready > /dev/null; then
    echo "Backend healthy"; break
  fi
  sleep 5
done

# 7. Deploy frontend
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d frontend

# 8. Deploy proxy (if config changed)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d proxy

# 9. Post-deployment verification (T+0 to T+10min)
./run-production-smoke-tests.sh

# 10. Go/No-Go decision (T+30min)
# If all criteria met → PROCEED
# If critical issues → ROLLBACK
```

### 4.3 Post-Deployment Verification

| Check | Command | Expected | Timeout |
|-------|---------|----------|---------|
| Backend Liveness | `curl -f /api/v1/health/live` | 200 OK | 2 min |
| Backend Readiness | `curl -f /api/v1/health/ready` | 200 OK | 2 min |
| Frontend | `curl -f /health` | 200 OK | 1 min |
| Admin Login | `POST /api/v1/auth/login` | 200 + tokens | 2 min |
| Key APIs | `GET /api/v1/employees?limit=1` | 200 + data | 1 min |
| Monitoring | Prometheus targets up | All green | 5 min |

---

## 5. Rollback Procedures

### 5.1 Application Rollback (No DB Changes)

```bash
# Target: < 5 minutes
# 1. Tag failed images
docker tag sana-hrms-backend:latest sana-hrms-backend:failed-$(date +%s)
docker tag sana-hrms-frontend:latest sana-hrms-frontend:failed-$(date +%s)

# 2. Restore previous images
docker tag sana-hrms-backend:v1.0.0-prev sana-hrms-backend:latest
docker tag sana-hrms-frontend:v1.0.0-prev sana-hrms-frontend:latest

# 3. Restart
docker compose up -d backend frontend

# 4. Verify health
curl -f https://sana-hrms.com/api/v1/health/ready
```

### 5.2 Database Rollback (With Migration)

```bash
# Target: < 15 minutes
# 1. STOP ALL APPLICATION TRAFFIC
docker compose stop backend frontend

# 2. Restore from pre-migration backup
curl -X POST "https://sana-hrms.com/api/v1/backup/restore" \
  -H "Authorization: Bearer <superadmin-token>" \
  -H "Content-Type: application/json" \
  -d '{"backupId": "<pre-migration-backup-id>", "currentPassword": "<admin-pwd>", "confirmationDatabase": "sana_hrms"}'

# 3. Verify restoration
docker exec sana-db psql -U sana -d sana_hrms -c "SELECT count(*) FROM \"_prisma_migrations\";"

# 4. Restart application with previous image
docker compose up -d backend frontend

# 5. Verify health
curl -f https://sana-hrms.com/api/v1/health/ready
```

### 5.3 Rollback Decision Matrix

| Scenario | Rollback Type | Target Time | Decision Authority |
|----------|---------------|-------------|-------------------|
| Backend health check failing > 5 min | Application | 5 min | Release Manager |
| Critical error rate > 10% for 5 min | Application | 5 min | Release Manager |
| DB migration failure | Database | 15 min | Release Manager + DBA |
| Data corruption detected | Database | 15 min | Incident Commander |
| Performance degradation > 50% | Application | 10 min | Engineering Lead |
| Critical workflow broken | Application | 10 min | Product Owner + Eng Lead |

---

## 6. Release Communication

### 6.1 Pre-Release (T-1 week)

| Audience | Channel | Content |
|----------|---------|---------|
| **Engineering** | Slack #releases | Release plan, branch, timeline |
| **Product** | Email | Feature summary, timeline |
| **Support** | Email + Doc | Known issues, workarounds |
| **Management** | Email | Timeline, risk assessment |

### 6.2 Deployment Day (T-0)

| Time | Audience | Channel | Message |
|------|----------|---------|---------|
| T-30 min | Internal | Slack #incident-go-live | "Go-live starting in 30 min" |
| T-0 | Internal | Slack #incident-go-live | "Go-live started" |
| T+30 min | Internal | Slack #incident-go-live | "Go-live successful" / "Rollback initiated" |
| T+1 hour | All Staff | Email | "Maintenance complete" |
| T+30 min | Customers | Status Page | "Maintenance complete" |
| T+4 hours | Management | Email | "Go-live report" |

### 6.3 Release Notes Template

```markdown
# Sana HRMS v1.0.0 Release Notes

## Highlights
- [Major feature 1]
- [Major feature 2]

## New Features
- [Feature 1] - [Description]
- [Feature 2] - [Description]

## Improvements
- [Improvement 1]
- [Improvement 2]

## Bug Fixes
- [Fix 1] - [Issue #]
- [Fix 2] - [Issue #]

## Security
- [Security fix 1]

## Breaking Changes
- [Change 1] - Migration required

## Known Issues
- [Issue 1] - Workaround

## Migration Notes
- Run `npx prisma migrate deploy`
- [Specific migration notes]
```

---

## 7. Hotfix Process

### 7.1 Hotfix Criteria

| Criteria | Example |
|----------|---------|
| **SEV-1 Bug** | Data loss, security breach, complete outage |
| **Critical Regression** | Core workflow broken (payroll, login, payroll) |
| **Security Vulnerability** | CVE with exploit in production |

### 7.2 Hotfix Process

```bash
# 1. Create hotfix branch from production tag
git checkout v1.0.0
git checkout -b hotfix/v1.0.1

# 2. Apply fix
# ... code changes ...

# 3. Run full CI pipeline
# All quality gates must pass

# 4. Deploy to staging for verification
# Tag: v1.0.1-hotfix.1

# 5. Deploy to production (expedited)
# Reduced verification: smoke tests only
# Target: < 1 hour from fix to production

# 6. Merge back to main and develop
git checkout main && git merge hotfix/v1.0.1
git checkout develop && git merge hotfix/v1.0.1
```

---

## 8. Release Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Release Frequency** | Minor: 6 weeks | Calendar |
| **Lead Time** | < 2 weeks (commit to prod) | CI/CD metrics |
| **Deployment Frequency** | On-demand | CI/CD metrics |
| **Change Failure Rate** | < 5% | Incidents / Deployments |
| **MTTR (Deployment)** | < 30 min | Incident metrics |
| **Rollback Rate** | < 10% | Rollbacks / Deployments |

---

## 8. Release Checklist

### Pre-Release
- [ ] All CI gates pass
- [ ] Staging acceptance signed off
- [ ] Release notes drafted
- [ ] Migration scripts reviewed
- [ ] Rollback plan reviewed
- [ ] Team availability confirmed
- [ ] Communication sent

### Deployment Day
- [ ] Pre-deployment backup verified
- [ ] Maintenance mode enabled (if needed)
- [ ] Images pulled and verified
- [ ] Migrations applied (if any)
- [ ] Backend deployed and healthy
- [ ] Frontend deployed and healthy
- [ ] Smoke tests pass
- [ ] Go/No-Go decision made

### Post-Deployment
- [ ] Monitoring verified
- [ ] Smoke tests repeated
- [ ] Business validation completed
- [ ] Rollback plan confirmed (30 min window)
- [ ] Communication sent
- [ ] Release notes published
- [ ] Hotfix branch merged back

---

## 9. Version Compatibility

| Component | Version Strategy |
|-----------|------------------|
| **Backend API** | Semantic versioning, backward compatible within minor |
| **Frontend** | Locked to backend version |
| **Database** | Prisma migrations, forward-only |
| **Monitoring** | Independent, backward compatible |
| **Infrastructure** | Independent, tested per release |

---

## 10. Emergency Contacts

| Role | Name | Phone | Slack | Email |
|------|------|-------|-------|-------|
| **Release Manager** | | | | |
| **DevOps Lead** | | | | |
| **Backend Lead** | | | | |
| **Frontend Lead** | | | | |
| **DBA** | | | | |
| **Engineering Lead** | | | | |
| **Product Owner** | | | | |

---

**Document Version:** 1.0  
**Date:** 2026-11-18  
**Status:** Active — Staging Verified  
**Classification:** INTERNAL