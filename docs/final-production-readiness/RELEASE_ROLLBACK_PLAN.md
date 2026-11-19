# Sana HRMS - Release & Rollback Plan

**Version:** 1.0  
**Date:** 2026-11-18  
**Auditor:** Senior DevOps Engineer  
**Classification:** INTERNAL  

---

## 1. Release Strategy

### 1.1 Versioning

```
MAJOR.MINOR.PATCH[-PRERELEASE][+BUILD]

Examples:
  1.0.0           - Initial production release
  1.1.0           - New features, backward compatible
  1.1.1           - Bug fixes
  2.0.0           - Breaking changes
  1.2.0-rc.1      - Release candidate
  1.2.0-beta.3    - Beta release
  1.1.1+build.42  - Build metadata
```

### 1.2 Release Branching

```
main ─────────────────────────────────────────────────────► (Production)
  │
  ├── release/v1.2.0 ─────────────────────────────────────► (Release candidate)
  │       │
  │       ├── hotfix/v1.2.1 ──────────────────────────────► (Patch)
  │
  ├── develop ─────────────────────────────────────────────► (Staging/Integration)
  │       │
  │       ├── feature/employee-portal ────────────────────► (Feature)
  │       ├── feature/payroll-reports ────────────────────► (Feature)
  │       └── bugfix/attendance-timezone ─────────────────► (Bug fix)
  │
  └── feature/* ──────────────────────────────────────────► (Short-lived features)
```

### 1.3 Environment Mapping

| Branch | Environment | Deployment Trigger |
|--------|-------------|-------------------|
| `main` | Production | Manual (workflow_dispatch) |
| `release/*` | Staging | Auto on push |
| `develop` | Staging | Auto on push |
| `feature/*` | Preview (optional) | Auto on PR |
| `hotfix/*` | Staging → Production | Manual approval |

---

## 2. Deployment Process

### 2.1 Production Deployment Checklist

```markdown
## Pre-Deployment
- [ ] All quality gates passing
- [ ] Release notes prepared (CHANGELOG.md)
- [ ] Database migration reviewed (if any)
- [ ] Backup completed (< 1 hour ago)
- [ ] Rollback plan documented
- [ ] Stakeholders notified
- [ ] Maintenance window scheduled (if breaking changes)

## Deployment
- [ ] Trigger workflow_dispatch with deploy_target=production
- [ ] Monitor pipeline stages
- [ ] Verify health checks post-deployment
- [ ] Smoke test critical paths
- [ ] Verify monitoring/alerting active
- [ ] Update status page

## Post-Deployment
- [ ] Monitor error rates (30 min)
- [ ] Monitor latency (30 min)
- [ ] Verify critical workflows
- [ ] Notify stakeholders
- [ ] Update status page
- [ ] Close deployment ticket
```

### 2.2 Deployment Commands

```bash
# Option 1: GitHub Actions (Recommended)
gh workflow run ci-cd.yml -f deploy_target=production

# Option 2: Manual Docker Compose (Emergency)
docker compose -f docker-compose.yml -f docker-compose.prod.yml pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --remove-orphans

# Option 3: Kubernetes (Future)
kubectl apply -f k8s/production/
kubectl rollout status deployment/sana-backend
kubectl rollout status deployment/sana-frontend
```

---

## 3. Rollback Procedures

### 3.1 Application Rollback

```bash
# 1. Identify previous stable image tag
docker images | grep sana-hrms-backend

# 2. Update docker-compose.prod.yml with previous tag
sed -i 's|sana-hrms-backend:v1.2.1|sana-hrms-backend:v1.2.0|' docker-compose.prod.yml

# 3. Deploy previous version
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate backend frontend

# 4. Verify health
curl -f https://hr.company.com/api/v1/health/ready
curl -f https://hr.company.com/health
```

### 3.2 Database Rollback (If Migration Applied)

```bash
# 1. Stop application
docker compose stop backend

# 2. Restore pre-migration backup
./scripts/restore-backup.sh <pre-migration-backup-id>

# 3. Start application
docker compose up -d backend

# 4. Verify
curl -f https://hr.company.com/api/v1/health/ready
```

### 3.3 Rollback Time Targets

| Rollback Type | Target | Max |
|---------------|--------|-----|
| Application only | 5 min | 10 min |
| Database + App | 15 min | 30 min |
| Full DR | 4 hours | 4 hours |

---

## 3. Rollback Decision Matrix

| Scenario | Action | Approval |
|-----------|--------|----------|
| Critical bug in production | Immediate rollback | On-call engineer |
| Performance degradation > 50% | Rollback if not fixable in 15 min | Team lead |
| Data corruption | Immediate DB restore + app rollback | Tech lead + DBA |
| Security breach | Immediate isolate + rollback | CTO + Security |
| Failed deployment | Automatic rollback (CI/CD) | Automatic |

---

## 4. Post-Rollback Verification

| Check | Command | Expected |
|-------|---------|----------|
| Health endpoint | `curl -f https://hr.company.com/api/v1/health/ready` | 200 OK |
| Frontend load | `curl -f https://hr.company.com/health` | 200 OK |
| Database connectivity | `docker exec sana-db pg_isready` | Accepting connections |
| Critical API | `curl -H "Authorization: Bearer $TOKEN" https://hr.company.com/api/v1/employees?limit=1` | 200 OK + data |
| Error rate | Grafana dashboard | < 0.1% |

---

## 3. Communication Plan

| Audience | Channel | Timing |
|----------|---------|--------|
| Engineering team | Slack #incidents | Immediate |
| Product/Management | Email + Slack | Within 15 min |
| Customers (if affected) | Email + Status page | Within 30 min |
| Executives | Email | Within 1 hour |
| Post-incident review | Meeting + doc | Within 48 hours |

---

## 3. Post-Rollback Actions

1. Create incident ticket
2. Root cause analysis (within 24h)
3. Fix implemented in hotfix branch
5. Re-deploy with fix
5. Update runbooks
5. Team retrospective

---

## 5. Release Calendar (Example)

| Week | Activity |
|------|----------|
| Mon | Sprint planning, version bump decision |
| Tue | Release candidate branch cut |
| Wed | Staging deployment + testing |
| Thu | Staging validation + stakeholder demo |
| Fri | Production deployment (if approved) |
| Sat-Sun | Monitoring + support |

---

## 6. Emergency Contacts

| Role | Name | Phone | Slack |
|------|------|-------|-------|
| On-call Engineer | | | |
| DevOps Lead | | | |
| Backend Lead | | | |
| Frontend Lead | | | |
| DBA | | | |
| Security Lead | | | |
| CTO | | | |

---

**Document Version:** 1.0  
**Date:** 2026-11-18  
**Status:** Complete  
**Classification:** INTERNAL