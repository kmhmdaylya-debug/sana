# Sana HRMS - Incident Response Guide

**Version:** 1.0  
**Date:** 2026-11-18  
**Classification:** CONFIDENTIAL - Internal Use Only  
**Audience:** Incident Response Team, On-Call Engineers, Management  

---

## 1. Overview

This guide defines the incident response process for Sana HRMS production incidents. It follows the NIST SP 800-61 Incident Handling framework adapted for our architecture.

### 1.1 Incident Classification

| Severity | Definition | Response Time | Examples |
|----------|------------|---------------|----------|
| **SEV-1 (Critical)** | Complete service outage, data loss, security breach | 15 minutes | All services down, DB corruption, ransomware |
| **SEV-2 (High)** | Major feature unavailable, significant performance degradation | 30 minutes | API 5xx > 10%, auth broken, backup failing |
| **SEV-3 (Medium)** | Minor feature degraded, non-critical service issue | 2 hours | Report export slow, email delayed, minor UI bug |
| **SEV-4 (Low)** | Cosmetic issue, documentation, enhancement | Next business day | Typos, minor UI misalignment |

### 1.2 Response Time Targets

| Phase | SEV-1 | SEV-2 | SEV-3 | SEV-4 |
|-------|-------|-------|-------|-------|
| **Acknowledgment** | 5 min | 15 min | 1 hour | 4 hours |
| **Triage** | 15 min | 30 min | 2 hours | 8 hours |
| **Mitigation** | 1 hour | 2 hours | 8 hours | Next release |
| **Resolution** | 4 hours | 8 hours | 24 hours | Next sprint |
| **Post-Mortem** | 48 hours | 72 hours | 1 week | N/A |

---

## 2. Incident Response Process

### 2.1 Phase 1: Detection & Alerting

```
Detection Sources:
├── Monitoring Alerts (Prometheus/Alertmanager)
├── User Reports (Support tickets, Slack)
├── Automated Health Checks (Kubernetes, Docker)
├── Security Tools (WAF, SIEM, Audit logs)
└── Scheduled Job Failures (Cron, pg_cron)
```

**Auto-ticketing:** All alerts create tickets in incident tracking system with severity.

### 2.2 Phase 2: Triage (First 15-30 minutes)

**Triage Checklist:**

| Step | Action | Owner |
|------|--------|-------|
| 1 | Acknowledge alert in tracking system | On-call |
| 2 | Verify alert validity (not false positive) | On-call |
| 3 | Determine severity (SEV-1/2/3/4) | On-call + Lead |
| 4 | Assign Incident Commander | Lead |
| 5 | Create incident channel (Slack #incident-XXX) | IC |
| 6 | Notify stakeholders per severity | IC |
| 6 | Begin timeline documentation | IC |

**Severity Upgrade Criteria:**
- User impact expanding
- Data integrity at risk
- Security breach confirmed
- SLA breach imminent

### 2.3 Phase 3: Investigation & Mitigation

**Investigation Steps:**

| Step | Action | Tools |
|------|--------|-------|
| 1 | Check service health endpoints | `/api/v1/health`, `/health` |
| 2 | Review recent deployments | GitHub Actions, ArgoCD |
| 3 | Check infrastructure metrics | Grafana, Prometheus |
| 4 | Review application logs | Loki, `docker logs` |
| 5 | Check database status | `pg_stat_activity`, health checks |
| 6 | Verify dependencies | External APIs, DNS, certs |

**Common Mitigation Patterns:**

| Issue | Quick Mitigation |
|-------|------------------|
| High CPU/Memory | Restart affected container |
| DB Connection Exhaustion | Increase pool, restart backend |
| Slow Queries | Kill long-running, add index |
| Deployment Issue | Rollback to previous image |
| Certificate Expiry | Renew cert, reload nginx |
| Disk Full | Cleanup logs, expand volume |

### 2.4 Phase 4: Resolution & Recovery

**Resolution Steps:**

1. **Root Cause Fix**: Apply permanent fix (code, config, infra)
2. **Verification**: All health checks pass, smoke tests pass
3. **Monitoring**: Enhanced monitoring for 2x normal period
4. **Documentation**: Update runbooks, runbook links in alerts
5. **Communication**: Stakeholder notification, status page update

### 2.5 Phase 5: Post-Incident Activities

**Within 48 hours (SEV-1/2) / 1 week (SEV-3):**

| Activity | Owner | Deliverable |
|----------|-------|-------------|
| Timeline Reconstruction | IC | Incident timeline doc |
| Root Cause Analysis (5 Whys) | IC + Team | RCA document |
| Impact Assessment | IC + PO | User/data impact report |
| Action Items | Team | Prioritized JIRA tickets |
| Process Improvements | IC + Leads | Updated runbooks/alerts |
| Post-Mortem Review | All stakeholders | Meeting + action items |

---

## 3. Communication Protocols

### 3.1 Internal Communication

| Channel | Purpose | Participants |
|---------|---------|--------------|
| **Slack #incident-XXX** | Real-time coordination | Responders, IC |
| **Slack #incident-command** | Leadership visibility | IC, Leads, CTO |
| **Phone Bridge** | Complex coordination | IC + Leads |
| **Email** | Formal notifications | Execs, Legal, Compliance |

### 3.2 External Communication

| Audience | Channel | Timing | Template |
|----------|---------|--------|----------|
| **Customers** | Status page, Email | SEV-1: 30min, SEV-2: 1hr | Incident notification |
| **Partners** | Email, Slack | SEV-1: 1hr | Partner-specific impact |
| **Regulators** | Email, Portal | Per regulation | Breach notification |
| **Public** | Twitter, Blog | Major outages only | Public statement |

### 3.3 Status Page Updates

| Status | When | Message |
|--------|------|---------|
| **Investigating** | Triage complete | "We're investigating reports of..." |
| **Identified** | Root cause found | "We've identified the cause..." |
| **Monitoring** | Fix deployed | "Fix deployed, monitoring..." |
| **Resolved** | Verified | "Issue resolved. Root cause: ..." |

---

## 4. Runbooks for Common Incidents

### 4.1 Service Down (SEV-1)

```
1. Check: docker compose ps / kubectl get pods
2. Check: Health endpoints /api/v1/health
3. Check: Recent deployments (GitHub Actions)
4. Check: Infrastructure (AWS/GCP status, DNS)
5. Mitigate: Restart failed containers
6. If DB: Check connections, restart if needed
7. If deploy: Rollback to previous version
8. Verify: Health checks, smoke tests
```

### 4.2 High Error Rate (SEV-2)

```
1. Check: Error rate by endpoint (Grafana)
2. Check: Recent deployments
3. Check: Application logs (Loki)
4. Check: Database errors (pg_stat_statements)
5. Mitigate: Rollback if deploy-related
6. Fix: Hotfix or config change
7. Verify: Error rate < 1%
```

### 4.3 Database Issues (SEV-1/2)

```
1. Check: pg_isready, connection count
2. Check: Long-running queries (pg_stat_activity)
3. Check: Disk space, memory, CPU
4. Check: Replication lag (if replica)
5. Mitigate: Kill blocking queries, restart pool
6. If corruption: Restore from backup (see DATABASE_RESTORE_GUIDE.md)
```

### 4.4 Security Incident (SEV-1)

```
1. Isolate: Network segment affected systems
2. Preserve: Logs, memory dumps, disk images
3. Rotate: All credentials (JWT, DB, API keys)
4. Revoke: All active sessions
5. Audit: Review access logs for scope
6. Notify: Legal, compliance, insurance
7. Communicate: Per regulatory requirements
```

---

## 5. Tools & Access

### 5.1 Required Access for On-Call

| System | Access Level | Method |
|--------|--------------|--------|
| **GitHub** | Admin (repo) | GitHub CLI, Web |
| **Container Registry** | Read/Write | `docker`, `ghcr.io` |
| **Production Server** | SSH + sudo | SSH key |
| **Database** | Superuser | `psql`, `pgAdmin` |
| **Monitoring** | Admin | Grafana, Prometheus, Alertmanager |
| **Logs** | Read | Loki, `docker logs` |
| **Secrets** | Read | Vault/Secret Manager |
| **DNS/CDN** | Read/Write | Cloudflare/AWS Console |

### 5.2 Key Commands

```bash
# Service status
docker compose ps
kubectl get pods -n production

# Health checks
curl -f http://localhost:8080/api/v1/health/ready
curl -f http://localhost:8080/health

# Logs
docker logs sana-backend --tail 100 -f
docker logs sana-frontend --tail 50 -f
docker logs sana-db --tail 50 -f

# Database
docker exec sana-db psql -U sana -d sana_hrms -c "SELECT * FROM pg_stat_activity;"
docker exec sana-db pg_isready -U sana

# Restart services
docker compose restart backend
docker compose restart frontend
docker compose up -d --force-recreate backend

# Deploy rollback
docker compose pull
docker compose up -d --force-recreate
```

---

## 6. Escalation Contacts

### 6.1 On-Call Rotation

| Week | Primary | Secondary | Manager |
|------|---------|-----------|---------|
| Week 1 | Engineer A | Engineer B | DevOps Lead |
| Week 2 | Engineer C | Engineer D | DevOps Lead |
| Week 3 | Engineer E | Engineer A | DevOps Lead |
| Week 4 | Engineer B | Engineer C | DevOps Lead |

### 6.2 Escalation Matrix

| Time | SEV-1 | SEV-2 | SEV-3 |
|------|-------|-------|-------|
| **0-15 min** | On-call | On-call | On-call |
| **15-30 min** | DevOps Lead | DevOps Lead | Team Lead |
| **30-60 min** | CTO | DevOps Lead | Team Lead |
| **1-2 hours** | CEO + CTO | CTO | DevOps Lead |
| **2+ hours** | CEO + Board | CEO | CTO |

---

## 7. Post-Incident Report Template

```markdown
# Incident Report: INC-YYYYMMDD-XXX

## Summary
- **Incident ID**: INC-20261118-001
- **Title**: Brief description
- **Severity**: SEV-1/2/3/4
- **Status**: Resolved / Monitoring
- **Start Time**: 2026-11-18 14:30 UTC
- **End Time**: 2026-11-18 15:45 UTC
- **Duration**: 1h 15m
- **Incident Commander**: Name

## Impact
- **Services Affected**: List
- **Users Affected**: Count / percentage
- **Data Loss**: Yes/No (details)
- **Revenue Impact**: Estimate

## Timeline
| Time (UTC) | Event | Details |
|------------|-------|---------|
| 14:30 | Alert fired | Prometheus alert: HighErrorRate |
| 14:32 | Acknowledged | On-call Engineer A |
| 14:35 | Triage | SEV-2 confirmed, IC assigned |
| 14:40 | Investigation | Logs reviewed, deploy identified |
| 14:50 | Mitigation | Rollback to v1.1.3 |
| 15:00 | Verification | Health checks passing |
| 15:45 | Resolved | All checks green, monitoring |

## Root Cause
**Primary**: Description
**Contributing Factors**: List

## Resolution
**Actions Taken**: List with times
**Fix Applied**: Description

## Action Items
| ID | Action | Owner | Due Date | Status |
|-----|--------|-------|----------|--------|
| 1 | Add test case for X | Engineer | 2026-11-25 | Open |
| 2 | Improve alert threshold | DevOps | 2026-11-20 | In Progress |
| 3 | Update runbook | DevOps | 2026-11-22 | Open |

## Lessons Learned
- What went well?
- What didn't?
- What will we change?
```

---

## 7. Training & Drills

### 7.1 Quarterly Drills

| Drill Type | Frequency | Participants | Scenario |
|------------|-----------|--------------|----------|
| **Tabletop** | Monthly | All responders | Scenario walkthrough |
| **Simulation** | Quarterly | On-call + Leads | Simulated outage |
| **Failover Test** | Semi-annually | DevOps + DBA | DR site activation |
| **Security Drill** | Semi-annually | Security + IR | Breach simulation |

### 7.2 New Responder Onboarding

1. Shadow 2 incidents
2. Complete runbook review
3. Access provisioning
4. Participate in drill
5. Solo on-call with backup

---

## 8. Metrics & KPIs

| Metric | Target | Current |
|--------|--------|---------|
| **MTTA (Mean Time to Acknowledge)** | < 5 min (SEV-1) | TBD |
| **MTTR (Mean Time to Resolve)** | < 4 hours (SEV-1) | TBD |
| **Incident Recurrence Rate** | < 5% | TBD |
| **Post-Mortem Completion** | 100% within SLA | TBD |
| **Action Item Closure** | 90% within 30 days | TBD |

---

**Document Version:** 1.0  
**Last Updated:** 2026-11-18  
**Next Review:** Quarterly  
**Owner:** DevOps Lead / Incident Response Manager