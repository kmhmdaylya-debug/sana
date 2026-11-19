# Sana HRMS - Incident Management Policy

**Version:** 1.0  
**Date:** 2026-11-18  
**Status:** Active — Staging Verified, Production Pending  
**Classification:** INTERNAL  

---

## 1. Purpose and Scope

This policy defines the incident management process for Sana HRMS. It covers detection, response, communication, resolution, and post-incident review for all severity levels.

**Scope:** All Sana HRMS production and staging environments, including:
- Backend API (NestJS)
- Frontend (React + Nginx)
- PostgreSQL Database
- Monitoring Stack (Prometheus, Grafana, Loki, Alertmanager)
- Docker Host Infrastructure

**Out of Scope:** Third-party service outages (SMTP, DNS, cloud provider) — covered by vendor SLAs.

---

## 2. Severity Definitions

| Severity | Label | Definition | Business Impact | Examples |
|----------|-------|------------|-----------------|----------|
| **SEV-1** | Critical | Complete service outage or data loss affecting all users | Payroll cannot run; employees cannot check in/out; data corruption | Backend down, Database down, Data corruption, Security breach with data exposure |
| **SEV-2** | Major | Significant degradation of critical functionality | Payroll delayed; leave approvals blocked; authentication failing for some users | High error rate (>5%), High latency (>2s p95), Auth failures, Backup failure |
| **SEV-3** | Minor | Limited functionality disruption affecting subset of users | Report generation slow; non-critical feature broken; cosmetic issues | Single report failing, UI bug in non-critical page, Slow non-critical API |
| **SEV-4** | Low | Cosmetic issue, documentation error, or enhancement request | No user-facing impact | Typo in UI, Missing documentation, Feature request |

---

## 3. Detection Mechanisms

| Detection Method | Severity Coverage | Response Time |
|------------------|-------------------|---------------|
| **Prometheus Alerts** | SEV-1, SEV-2 | < 1 minute (critical), < 5 minutes (warning) |
| **Health Check Failures** | SEV-1 | < 15 seconds (liveness), < 30 seconds (readiness) |
| **Log Anomalies (Loki)** | SEV-2, SEV-3 | < 5 minutes |
| **User Reports** | SEV-2, SEV-3, SEV-4 | Variable |
| **Synthetic Monitoring** | SEV-1, SEV-2 | < 1 minute (planned) |

### 3.1 Alert-to-Severity Mapping

| Alert | Severity | Auto-Creates Incident |
|-------|----------|----------------------|
| ServiceDown (Backend/Frontend/DB) | SEV-1 | ✅ Yes |
| DatabaseDown | SEV-1 | ✅ Yes |
| HighErrorRate (>5%) | SEV-1 | ✅ Yes |
| BackupFailed | SEV-1 | ✅ Yes |
| AuditLogFailures | SEV-1 | ✅ Yes |
| HighLatency (p95 > 2s) | SEV-2 | ✅ Yes |
| DatabaseConnectionPoolHigh | SEV-2 | ✅ Yes |
| BackupTooOld | SEV-2 | ✅ Yes |
| PendingApprovalsHigh | SEV-2 | ✅ Yes |
| DiskSpaceCritical | SEV-2 | ✅ Yes |
| MemoryHigh / CPUHigh | SEV-2 | ✅ Yes |
| ContainerRestartLoop | SEV-2 | ✅ Yes |
| RepeatedAuthFailures | SEV-2 | ✅ Yes |
| UnauthorizedAccessAttempts | SEV-2 | ✅ Yes |

---

## 4. Notification and Escalation

### 4.1 Notification Channels by Severity

| Severity | Primary Channel | Secondary Channel | Tertiary Channel |
|----------|-----------------|-------------------|------------------|
| **SEV-1** | PagerDuty (page) + Slack #incident-sev1 | Phone bridge | Email (executives) |
| **SEV-2** | Slack #incident-sev2 + Email (oncall) | Phone (if > 30 min) | — |
| **SEV-3** | Slack #incident-sev3 | Email (team) | — |
| **SEV-4** | Slack #incident-sev4 (daily digest) | — | — |

### 4.2 Escalation Matrix

| Time Since Alert | SEV-1 | SEV-2 | SEV-3 |
|------------------|-------|-------|-------|
| **0-15 min** | On-call Engineer | On-call Engineer | Team Lead (next business day) |
| **15-30 min** | Team Lead + DevOps Lead | Team Lead | — |
| **30-60 min** | Engineering Lead + Incident Commander | Engineering Lead | — |
| **60-120 min** | CTO + Legal (if data/security) | CTO (if business impact) | — |
| **120+ min** | CEO + Legal + Compliance | — | — |

### 4.3 Communication Templates

**SEV-1 Initial Notification:**
```
🚨 SEV-1 INCIDENT: [Service] - [Brief Description]
Impact: [User-facing impact]
Started: [Timestamp]
Incident Commander: [Name]
Bridge: [Phone/Meet link]
Status Page: [Link]
Next Update: [Timestamp + 15 min]
```

**Status Update (every 15 min for SEV-1, 30 min for SEV-2):**
```
🔄 UPDATE: [Incident ID] - [Current Status]
Progress: [What's been done]
Next Steps: [What's happening next]
ETA: [Estimated resolution]
```

**Resolution Notification:**
```
✅ RESOLVED: [Incident ID] - [Service] restored
Root Cause: [Brief]
Resolution: [What fixed it]
Impact Duration: [Start → End]
Post-Incident Review: [Scheduled date]
```

---

## 5. Incident Response Process

### 5.1 Incident Lifecycle

```
DETECT → TRIAGE → RESPOND → RESOLVE → REVIEW → IMPROVE
```

### 5.2 Phase Definitions

#### 5.2.1 Detect (0-5 minutes)
- Alert fires or user reports issue
- Monitoring system creates incident record
- On-call engineer receives notification
- **Goal:** Acknowledge within 5 minutes

#### 5.2.2 Triage (5-15 minutes)
- On-call engineer assesses:
  - What is affected?
  - How many users impacted?
  - Is data at risk?
  - What is the blast radius?
- Assign severity (SEV-1 through SEV-4)
- Assign Incident Commander
- Open incident channel (Slack/Teams)
- **Goal:** Severity assigned and IC appointed within 15 minutes

#### 5.2.3 Respond (15 minutes - resolution)
- Incident Commander coordinates response
- Subject matter experts engaged as needed
- Mitigation actions taken (rollback, restart, scale, fix)
- Status updates per communication schedule
- **Goal:** Mitigation in progress within 30 minutes

#### 5.2.4 Resolve
- Root cause identified
- Fix implemented and verified
- Service restored to normal operation
- Monitoring confirms stability (15 min observation)
- **Goal:** Resolution confirmed

#### 5.2.5 Review (Within 48 hours)
- Post-incident review meeting scheduled
- Timeline reconstructed
- Root cause analysis (5 Whys / Fishbone)
- Action items created with owners and deadlines
- Incident report published

#### 5.2.6 Improve
- Action items tracked in improvement register
- Monitoring/alerting improved
- Runbooks updated
- Process improvements implemented

---

## 6. Roles and Responsibilities

| Role | Responsibility | SEV-1 | SEV-2 | SEV-3 |
|------|----------------|-------|-------|-------|
| **Incident Commander** | Overall coordination, communication, decisions | ✅ Required | ✅ Required | Optional |
| **On-call Engineer** | First response, triage, initial mitigation | ✅ Required | ✅ Required | ✅ Required |
| **Subject Matter Expert** | Deep technical knowledge for affected system | As needed | As needed | As needed |
| **DevOps Lead** | Infrastructure, deployment, rollback | ✅ Required | ✅ Required | Optional |
| **DBA** | Database issues, recovery, performance | As needed | As needed | — |
| **Backend/Frontend Lead** | Application code issues | As needed | As needed | As needed |
| **Engineering Lead** | Escalation, resource allocation, stakeholder communication | ✅ Required | Optional | — |
| **CTO** | Executive escalation, business decisions | Optional | Optional | — |
| **Communications Lead** | Status page, user communication, executive updates | ✅ Required | Optional | — |

---

## 6. Incident Commander Checklist

### Upon Assignment
- [ ] Acknowledge incident in monitoring system
- [ ] Open/join incident Slack channel
- [ ] Assign scribe (for timeline documentation)
- [ ] Confirm severity assessment
- [ ] Notify stakeholders per escalation matrix
- [ ] Start incident timeline document

### During Response
- [ ] Coordinate mitigation efforts
- [ ] Ensure status updates per schedule (15 min SEV-1, 30 min SEV-2)
- [ ] Manage stakeholder communication
- [ ] Escalate per matrix if needed
- [ ] Track all actions in timeline

### Upon Resolution
- [ ] Confirm service stability (15 min observation)
- [ ] Close incident in monitoring system
- [ ] Send resolution notification
- [ ] Schedule post-incident review (within 48 hours)
- [ ] Archive incident channel/logs

---

## 7. Incident Documentation

### 7.1 Required Fields

| Field | Description |
|-------|-------------|
| Incident ID | Auto-generated (e.g., INC-20261118-001) |
| Title | Brief description |
| Severity | SEV-1 through SEV-4 |
| Status | Open / Investigating / Mitigating / Resolved / Closed |
| Detected At | Timestamp (UTC) |
| Detected By | Alert name / User report / Manual |
| Affected Services | List of services |
| User Impact | Description of user-facing impact |
| Incident Commander | Name |
| Scribe | Name |
| Timeline | Chronological events |
| Root Cause | Final determination |
| Resolution | What fixed it |
| Action Items | List with owners/dates |

### 7.2 Timeline Format

```
[YYYY-MM-DD HH:MM:SS UTC] [EVENT] Description
[2026-11-18 12:00:00 UTC] [ALERT] ServiceDown fired for sana-backend
[2026-11-18 12:00:05 UTC] [ACK] On-call engineer acknowledged
[2026-11-18 12:00:10 UTC] [TRIAGE] SEV-1 assigned, IC: John Doe
[2026-11-18 12:00:15 UTC] [ACTION] Rolling back backend to v1.0.0-prev
[2026-11-18 12:02:00 UTC] [UPDATE] Backend health checks passing
[2026-11-18 12:05:00 UTC] [RESOLVED] Service restored, monitoring stable
```

---

## 8. Post-Incident Review (PIR)

### 8.1 Timing
- **SEV-1:** Within 48 hours
- **SEV-2:** Within 5 business days
- **SEV-3:** Within 10 business days (or next sprint retrospective)

### 8.2 PIR Agenda

1. **Timeline Review** (10 min) — Walk through incident timeline
2. **Root Cause Analysis** (20 min) — 5 Whys or Fishbone diagram
3. **What Went Well** (10 min) — Successful detection, response, tools
4. **What Could Improve** (15 min) — Gaps in detection, response, communication
5. **Action Items** (15 min) — Specific, measurable, owned, dated

### 8.3 PIR Output

| Output | Format | Audience |
|--------|--------|----------|
| **Incident Report** | Markdown/Confluence | All stakeholders |
| **Action Items** | Tracker (Jira/GitHub) | Assigned owners |
| **Runbook Updates** | Git PR | Operations team |
| **Monitoring Improvements** | Git PR | DevOps team |

### 8.4 Blameless Culture

- Focus on **systems and processes**, not individuals
- Use "we" language, not "you"
- Assume everyone acted reasonably given their information
- Goal: Prevent recurrence, not assign fault

---

## 9. War Room Procedures

### 9.1 When to Open War Room
- SEV-1 lasting > 30 minutes
- SEV-1 with unknown root cause after 15 minutes
- Multiple SEV-2s simultaneously
- Data loss or security incident suspected

### 9.2 War Room Setup
- Dedicated Slack channel: `#warroom-[incident-id]`
- Video bridge: Google Meet / Teams (link in channel)
- Shared timeline document (Google Doc / Confluence)
- Scribe assigned (rotates every 30 min)

### 9.3 War Room Roles
| Role | Person | Responsibility |
|------|--------|----------------|
| **Commander** | Incident Commander | Decisions, coordination |
| **Scribe** | Rotating | Timeline, decisions, action items |
| **Technical Lead** | Domain expert | Technical mitigation |
| **Communications** | Comms lead | Status page, stakeholder updates |
| **Liaison** | Engineering lead | Executive communication |

---

## 10. Special Incident Types

### 10.1 Security Incident
- **Additional Steps:**
  - Immediate containment (block IPs, revoke tokens)
  - Preserve evidence (logs, memory dumps)
  - Notify Legal/Compliance immediately
  - Engage external forensics if needed
  - Follow data breach notification laws

### 10.2 Data Loss / Corruption
- **Additional Steps:**
  - Stop all writes immediately
  - Assess scope (tables, time range, users)
  - Execute DR procedure (see DISASTER_RECOVERY_PLAN.md)
  - Verify restore completeness
  - Notify affected users

### 10.3 Failed Deployment
- **Additional Steps:**
  - Execute rollback (see PRODUCTION_ROLLBACK_CHECKLIST.md)
  - Verify health checks pass
  - Assess if data migration needs reversal
  - Document deployment failure in CI/CD

---

## 11. Metrics and KPIs

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Mean Time to Acknowledge (MTTA)** | < 5 min | Alert → Acknowledge |
| **Mean Time to Triage (MTTT)** | < 15 min | Alert → Severity assigned |
| **Mean Time to Mitigate (MTTM)** | < 30 min (SEV-1) | Alert → Mitigation started |
| **Mean Time to Resolve (MTTR)** | < 4 hours (SEV-1) | Alert → Resolved |
| **Incident Recurrence Rate** | 0 for same root cause | Per quarter |
| **Post-Incident Review Completion** | 100% within SLA | Per quarter |

---

## 12. Training and Drills

| Activity | Frequency | Participants |
|----------|-----------|--------------|
| **Incident Response Training** | Quarterly | All on-call engineers |
| **Tabletop Exercise** | Monthly | Incident Commanders + Leads |
| **War Room Drill** | Quarterly | All roles |
| **Post-Incident Review Shadowing** | Per incident | Junior engineers |
| **Runbook Walkthrough** | Monthly | On-call rotation |

---

## 13. Tools and Access

| Tool | Purpose | Access |
|------|---------|--------|
| **Prometheus/Alertmanager** | Alerting | On-call, DevOps, Leads |
| **Grafana** | Dashboards | All engineers |
| **Loki** | Log search | All engineers |
| **Slack** | Communication | All engineers |
| **Phone Bridge** | War room | IC, Leads, Executives |
| **Status Page** | User communication | Comms lead, IC |
| **Incident Tracker** | Documentation | All engineers |

---

## 14. Policy Review

| Review Trigger | Frequency | Owner |
|----------------|-----------|-------|
| **Scheduled Review** | Quarterly | Engineering Lead |
| **Post-Major-Incident** | After each SEV-1 | Incident Commander |
| **Process Change** | As needed | Engineering Lead |
| **Tool Change** | As needed | DevOps Lead |

---

## 15. References

| Document | Location |
|----------|----------|
| Incident Response Playbooks | `docs/operations/INCIDENT_RESPONSE_PLAYBOOKS.md` |
| Disaster Recovery Plan | `docs/production/DISASTER_RECOVERY_PLAN.md` |
| Production Rollback Checklist | `docs/production-go-live/PRODUCTION_ROLLBACK_CHECKLIST.md` |
| Go-Live Runbook | `docs/production-go-live/GO_LIVE_RUNBOOK.md` |
| Monitoring and Alerting | `docs/operations/MONITORING_AND_OBSERVABILITY.md` |
| Operational Baseline | `docs/operations/OPERATIONAL_BASELINE.md` |

---

**Document Version:** 1.0  
**Date:** 2026-11-18  
**Status:** Active — Staging Verified  
**Classification:** INTERNAL