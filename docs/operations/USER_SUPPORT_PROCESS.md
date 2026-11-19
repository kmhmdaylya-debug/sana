# Sana HRMS - User Support Process

**Version:** 1.0  
**Date:** 2026-11-18  
**Environment:** Production / Staging  
**Classification:** INTERNAL  

---

## 1. Purpose and Scope

This document defines the structured process for collecting, triaging, resolving, and tracking user-reported issues, feature requests, and operational feedback for Sana HRMS.

**Scope:** All user-facing support channels for Sana HRMS production and staging environments.

**Out of Scope:** Infrastructure incidents (covered by INCIDENT_MANAGEMENT_POLICY.md), security incidents (SECURITY_OPERATIONS_POLICY.md).

---

## 2. Support Channels

| Channel | Purpose | Availability | SLA (First Response) |
|---------|---------|--------------|----------------------|
| **In-App Help** | Self-service, FAQ, guided tours | 24/7 | Instant |
| **Email Support** | Formal tickets, complex issues | Business hours (9-18 IRST) | 4 hours |
| **Slack/Teams** | Quick questions, status updates | Business hours | 2 hours |
| **Phone** | Critical issues only | Business hours | 30 minutes |
| **In-App Feedback** | Feature requests, UX feedback | 24/7 | Next business day |

---

## 3. Ticket Categories

| Category | Description | Examples | Default Severity |
|----------|-------------|----------|------------------|
| **INCIDENT** | Service degradation or failure | Login fails, payroll stuck, data missing | High/Critical |
| **SERVICE_REQUEST** | Standard service fulfillment | Account unlock, password reset, access request | Medium |
| **ACCESS_ISSUE** | Permission or login problems | Cannot see module, 403 errors | High |
| **DATA_ISSUE** | Data quality or integrity | Wrong payslip amount, missing records | High |
| **PERFORMANCE** | Slow response times | Page loads > 10s, timeouts | Medium |
| **FEATURE_REQUEST** | New functionality | New report, workflow change | Low |
| **USABILITY** | UI/UX issues | Confusing flow, RTL issue, translation | Low |
| **INTEGRATION** | Third-party issues | Email not sending, import failing | Medium |
| **COMPLIANCE** | Legal/regulatory | Data export, audit request | High |

---

## 4. Severity Definitions (Support Context)

| Severity | Definition | Response SLA | Resolution SLA | Escalation |
|----------|------------|--------------|----------------|------------|
| **Critical (P1)** | Business-critical workflow blocked for all users | 30 min | 4 hours | Immediate to Engineering Lead |
| **High (P2)** | Major feature broken for subset of users | 2 hours | 8 hours | 2 hours to Team Lead |
| **Medium (P3)** | Minor feature degraded, workaround exists | 4 hours | 2 business days | 4 hours to Team Lead |
| **Low (P4)** | Cosmetic, enhancement, question | 1 business day | 5 business days | Next sprint planning |

---

## 5. Support Workflow

### 5.1 Ticket Lifecycle

```
CREATE → TRIAGE → ASSIGN → INVESTIGATE → RESOLVE → VERIFY → CLOSE
```

### 5.2 Detailed Process

#### 5.2.1 Create (User / Support)
- User submits via portal/email/Slack
- Auto-assign category based on keywords
- Capture: User, Company, Role, Steps to reproduce, Screenshots, Business impact

#### 5.2.2 Triage (Support Lead / On-Call)
- **Within SLA:** Acknowledge ticket
- Assign severity (P1-P4)
- Assign category
- Assign owner (Support / Engineering / DevOps)
- Check for duplicates / known issues
- Link to existing incident if applicable

#### 5.2.3 Assign
- Route to appropriate team:
  - **Auth/Access** → Security/Identity team
  - **Payroll/Financial** → Backend/Payroll team
  - **UI/Frontend** → Frontend team
  - **Performance** → DevOps/Backend
  - **Data/Reports** → Backend/Data team
  - **Infrastructure** → DevOps

#### 5.2.4 Investigate
- Reproduce in staging (if safe)
- Check logs (Loki), metrics (Grafana), audit logs
- Check recent deployments
- Check known issues / changelog
- Engage subject matter expert if needed

#### 5.2.5 Resolve
- Apply fix (code, config, data correction)
- Test in staging
- Deploy (hotfix if P1/P2, next release if P3/P4)
- Document resolution steps

#### 5.2.6 Verify
- User confirms resolution
- Automated test added (if applicable)
- Monitoring confirms no regression

#### 5.2.7 Close
- Resolution documented
- User satisfaction survey (optional)
- Knowledge base updated (if new issue)

---

## 6. Special Handling Procedures

### 6.1 Payroll-Related Support

| Scenario | Procedure |
|----------|-----------|
| **Wrong payslip amount** | 1. Verify with Finance <br> 2. Check payroll calculation logs <br> 3. If calculation error → Recalculate period <br> 4. If data error → Correct source data <br> 5. Reissue payslip <br> 6. Audit log entry |
| **Missing payslip** | 1. Check period status <br> 2. Check generation logs <br> 3. Regenerate if needed <br> 4. Notify employee |
| **Tax/Insurance discrepancy** | 1. Verify configuration <br> 2. Check POL-PR-01, POL-PR-02 policies <br> 3. Engage Finance/Legal <br> 4. Apply correction |

### 6.2 Data Correction Requests

| Request Type | Approval | Procedure |
|--------------|----------|-----------|
| **Employee Data** | HR Manager | Self-service portal → HR review → Update |
| **Financial Data** | Finance Director | Ticket → Finance verification → DBA correction + audit log |
| **Attendance Data** | Line Manager + HR | Ticket → Verification → Correction → Audit log |
| **Leave Balance** | HR Manager | Ticket → Verification → Adjustment → Audit log |

### 6.3 Access Issues

| Issue | Procedure |
|-------|-----------|
| **Cannot login** | 1. Check user status (ACTIVE) <br> 2. Check password/lockout <br> 3. Reset password / unlock <br> 4. Check SSO/IdP if applicable |
| **Missing permissions** | 1. Check role assignments <br> 2. Check ABAC policies <br> 3. Verify company scoping <br> 4. Grant/Adjust role |
| **403 Forbidden** | 1. Check audit log for FORBIDDEN <br> 2. Identify resource/action <br> 3. Fix ABAC policy or role |

### 6.4 Performance Complaints

| Complaint | Investigation |
|-----------|---------------|
| **Page slow** | 1. Check Grafana (p95 latency) <br> 2. Check specific endpoint in logs <br> 3. Check DB query performance <br> 4. Check frontend bundle size |
| **Report timeout** | 1. Check report generation logs <br> 2. Check query execution plan <br> 3. Consider async generation |
| **Bulk operation slow** | 1. Check batch size <br> 2. Check DB indexes <br> 3. Consider async processing |

---

## 7. Escalation Matrix

| Severity | Level 1 (0-30 min) | Level 2 (30-60 min) | Level 3 (1-2 hours) | Level 4 (2+ hours) |
|----------|-------------------|---------------------|---------------------|-------------------|
| **P1 Critical** | On-call Engineer | Team Lead + DevOps | Engineering Lead | CTO |
| **P2 High** | Support Engineer | Team Lead | Engineering Lead | — |
| **P3 Medium** | Support Engineer | Team Lead (next day) | — | — |
| **P4 Low** | Support Engineer | — | — | — |

### 6.5 Escalation Triggers

- SLA breach imminent
- Multiple users affected (P1: >10 users, P2: >50 users)
- No progress in 50% of SLA time
- Customer executive escalation
- Data loss or security implication

---

## 8. Communication Standards

### 8.1 User Communication

| Event | Template | Channel |
|-------|----------|---------|
| **Acknowledgment** | "We've received your request (TKT-XXXX). Severity: P2. We'll update within 2 hours." | Email/Slack |
| **Status Update** | "Update on TKT-XXXX: We've identified the cause (DB connection pool). Fix deploying in 30 min." | Email/Slack |
| **Resolution** | "TKT-XXXX resolved: Fixed DB pool config. Please verify payslip generation works." | Email/Slack |
| **Closure** | "TKT-XXXX closed. Please confirm resolution. Survey: [link]" | Email |

### 8.2 Internal Communication

| Event | Channel | Template |
|-------|---------|----------|
| **New P1** | Slack #support-p1 | "🚨 P1: [Title] - [User/Company] - [Impact] - Owner: @name" |
| **Status Change** | Ticket thread | "Status: Investigating → Fix Deployed" |
| **Escalation** | Slack #support-escalation | "⬆️ Escalating TKT-XXXX to [Role]: [Reason]" |
| **Resolution** | Ticket thread + Slack | "✅ TKT-XXXX resolved: [Summary]" |

---

## 9. Knowledge Management

### 9.1 Knowledge Base Articles

| Article Type | Template | Review Frequency |
|--------------|----------|------------------|
| **How-to** | Steps, screenshots, prerequisites | Quarterly |
| **Troubleshooting** | Symptoms, causes, solutions | Quarterly |
| **Known Issues** | Workaround, fix timeline, link to ticket | Per release |
| **FAQ** | Question, answer, links | Monthly |
| **Release Notes** | Features, fixes, breaking changes | Per release |

### 9.2 Knowledge Base Maintenance

| Action | Trigger | Owner |
|--------|---------|-------|
| **Create** | New issue pattern (>3 tickets) | Support Lead |
| **Update** | Fix deployed, process change | Engineer |
| **Archive** | Feature deprecated, issue fixed permanently | Support Lead |
| **Review** | Quarterly | Support Lead |

---

## 10. Metrics and Reporting

### 9.1 Key Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **First Response Time** | P1: 30m, P2: 2h, P3: 4h, P4: 1d | Ticket system |
| **Resolution Time** | P1: 4h, P2: 8h, P3: 2d, P4: 5d | Ticket system |
| **Customer Satisfaction (CSAT)** | > 4.5/5 | Post-resolution survey |
| **First Contact Resolution** | > 70% | Ticket system |
| **Reopen Rate** | < 10% | Ticket system |
| **Ticket Volume** | Trend monitoring | Ticket system |
| **SLA Compliance** | > 95% | Ticket system |

### 9.2 Reporting Cadence

| Report | Frequency | Audience | Content |
|--------|-----------|----------|---------|
| **Daily Standup** | Daily | Support Team | Open P1/P2, SLA risks |
| **Weekly Summary** | Weekly | Engineering + Product | Volume, trends, SLA, top issues |
| **Monthly Review** | Monthly | Management | Metrics, trends, improvements |
| **Quarterly Business Review** | Quarterly | Leadership | CSAT, volume, staffing, roadmap |

---

## 10. User Feedback Loop

### 9.1 Feedback Collection

| Channel | Method | Frequency |
|---------|--------|-----------|
| **In-App Feedback** | Widget (thumbs up/down + text) | Continuous |
| **Post-Resolution Survey** | 3-question (CSAT, effort, comment) | Per ticket |
| **NPS Survey** | Quarterly email | Quarterly |
| **User Interviews** | 30-min calls | Monthly |
| **Feature Request Portal** | Public board (upvote) | Continuous |

### 9.2 Feedback Processing

| Step | Action | Owner |
|------|--------|-------|
| **Collect** | Auto-ingest from channels | System |
| **Categorize** | Tag: bug, feature, ux, other | Support Lead |
| **Prioritize** | RICE score (Reach, Impact, Confidence, Effort) | Product |
| **Roadmap** | Add to backlog / sprint planning | Product + Engineering |
| **Communicate** | Update requester on status | Support |

---

## 10. Data Protection in Support

| Requirement | Implementation |
|-------------|----------------|
| **No PII in ticket titles** | Auto-redact national ID, bank account |
| **Minimal data in tickets** | Only required fields |
| **Access control** | Role-based ticket visibility |
| **Retention** | Tickets: 2 years, PII redacted after 1 year |
| **Export control** | Support data export requires DPO approval |

---

## 11. Staffing and Training

### 11.1 Support Team Structure

| Role | Count | Coverage |
|------|-------|----------|
| **Support Lead** | 1 | Business hours + on-call rotation |
| **Senior Support Engineer** | 2 | Business hours |
| **Support Engineer** | 2 | Business hours |
| **On-Call Engineer** | Rotation | 24/7 for P1 |

### 11.2 Training Program

| Training | Frequency | Audience |
|----------|-----------|----------|
| **Product Deep Dive** | Monthly | All Support |
| **Troubleshooting Workshop** | Quarterly | All Support |
| **New Feature Training** | Per release | All Support |
| **Security/Privacy** | Annually | All Support |
| **Communication Skills** | Semi-annually | All Support |

---

## 12. Continuous Improvement

| Activity | Frequency | Output |
|----------|-----------|--------|
| **Ticket Trend Analysis** | Weekly | Top issues, recurring patterns |
| **Root Cause Analysis** | Per P1/P2 | Action items for engineering |
| **Knowledge Gap Review** | Monthly | New KB articles needed |
| **Process Retrospective** | Quarterly | Process improvements |
| **Tool Evaluation** | Annually | Tool upgrade/replacement |

---

**Document Version:** 1.0  
**Date:** 2026-11-18  
**Status:** Active — Ready for Production  
**Classification:** INTERNAL