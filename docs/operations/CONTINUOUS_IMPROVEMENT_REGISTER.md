# Sana HRMS - Continuous Improvement Register

**Version:** 1.0  
**Date:** 2026-11-18  
**Status:** Active — Staging Verified, Production Pending  
**Classification:** INTERNAL  

---

## 1. Purpose

This register tracks all identified operational improvements for Sana HRMS, classified by domain, prioritized by risk and value, and tracked through implementation.

**Source:** Derived from Stage 11 reconciliation, Stage 12 operational baseline, and ongoing operational observations.

---

## 2. Register Structure

| Field | Description |
|-------|-------------|
| **ID** | Unique identifier (IMP-<domain>-<number>) |
| **Domain** | Reliability / Security / Performance / Database / UX / Maintainability / Data Governance / Infrastructure |
| **Title** | Brief description |
| **Description** | Detailed explanation |
| **Evidence** | Source of identification (reconciliation, monitoring, incident, audit) |
| **Risk** | Critical / High / Medium / Low |
| **Priority** | P0 (Immediate) / P1 (Sprint 1) / P2 (Sprint 2) / P3 (Backlog) |
| **Effort** | Small (1-2 days) / Medium (1-2 weeks) / Large (1+ month) |
| **Dependencies** | Other improvements, external factors |
| **Owner** | Role responsible |
| **Acceptance Criteria** | Measurable done definition |
| **Status** | Proposed / In Progress / Done / Deferred |
| **Target Date** | Planned completion |

---

## 3. Improvement Register

### 3.1 Reliability Improvements

| ID | Title | Description | Evidence | Risk | Priority | Effort | Dependencies | Owner | Acceptance Criteria | Status |
|----|-------|-------------|----------|------|----------|--------|--------------|-------|---------------------|--------|
| IMP-REL-001 | Implement application metrics | Add 7 critical Prometheus metrics (HTTP requests, latency, DB connections, active users, pending approvals, backup status, workflow success) | SLI_SLO_DEFINITIONS.md gap analysis | High | P0 | Medium (5 days) | Prometheus client lib | Backend Lead | All 7 metrics exposed on `/api/v1/metrics`, scraped by Prometheus | Proposed |
| IMP-REL-002 | Deploy distributed tracing | Add OpenTelemetry + Tempo for request tracing across services | MONITORING_AND_OBSERVABILITY.md gap | Medium | P2 | Medium (1 week) | Tempo deployment | DevOps Lead | Traces visible in Grafana for 100% of requests | Proposed |
| IMP-REL-003 | Implement queue system | Replace inline jobs with Bull/BullMQ for payroll, notifications, reports, audit | BACKGROUND_JOB_OPERATIONS.md gap | High | P1 | Medium (1 week) | Redis deployment | Backend Lead | All background jobs queued, retry/DLQ working, metrics exposed | Proposed |
| IMP-REL-004 | Add synthetic monitoring | Deploy uptime checks for critical endpoints from multiple regions | SLI_SLO_DEFINITIONS.md SLO-A1/A2 | Medium | P2 | Small (2 days) | Grafana Cloud / Blackbox Exporter | DevOps Lead | Synthetic checks running, alerting on failure | Proposed |
| IMP-REL-005 | Implement error budget alerting | Alert on error budget burn rate (fast/slow) per SLI_SLO_DEFINITIONS.md | SLI_SLO_DEFINITIONS.md Section 4 | Medium | P2 | Small (2 days) | Metrics implemented | DevOps Lead | Alerts fire at 25%, 50%, 75%, 100% budget consumption | Proposed |

### 3.2 Security Improvements

| ID | Title | Description | Evidence | Risk | Priority | Effort | Dependencies | Owner | Acceptance Criteria | Status |
|----|-------|-------------|----------|------|----------|--------|--------------|-------|---------------------|--------|
| IMP-SEC-001 | Upgrade @nestjs/cli | Resolve picomatch ReDoS, glob AbortSignal bypass (3 deferred Critical CVEs) | Stage 11 deferred items | Critical | P0 | Small (1 day) | Breaking change testing | DevOps Lead | `npm audit` shows 0 Critical/High in production deps | Proposed |
| IMP-SEC-002 | Upgrade @typescript-eslint | Resolve minimatch DoS (deferred Critical CVE) | Stage 11 deferred items | Critical | P0 | Small (1 day) | Breaking change testing | DevOps Lead | `npm audit` shows 0 Critical/High in production deps | Proposed |
| IMP-SEC-003 | Implement field-level encryption | Encrypt PII/PHI fields (national_id, bank_account, medical data) at rest | DATA_PRIVACY_AND_GOVERNANCE.md gap | High | P1 | Medium (1 week) | Key management, Prisma middleware | Backend Lead | Encrypted fields unreadable in DB, transparent to app | Proposed |
| IMP-SEC-004 | Deploy WAF | Add Cloudflare WAF or ModSecurity for OWASP Top 10 protection | SECURITY_OPERATIONS_POLICY.md gap | Medium | P2 | Small (2 days) | Cloudflare/ModSecurity | DevOps Lead | WAF blocking SQLi, XSS, path traversal attempts | Proposed |
| IMP-SEC-005 | Implement secrets rotation automation | Automate JWT secret, DB password, backup key rotation | SECURITY_OPERATIONS_POLICY.md Section 4 | Medium | P2 | Medium (1 week) | Vault/Sealed Secrets | DevOps Lead | Secrets rotated per schedule without manual intervention | Proposed |
| IMP-SEC-006 | Comprehensive log PII audit | Scan all log outputs for PII leakage, implement redaction | SECURITY_OPERATIONS_POLICY.md Section 11 | Medium | P1 | Medium (3 days) | Log analysis | Security Engineer | Zero PII in logs, automated redaction verified | Proposed |

### 3.3 Performance Improvements

| ID | Title | Description | Evidence | Risk | Priority | Effort | Dependencies | Owner | Acceptance Criteria | Status |
|----|-------|-------------|----------|------|----------|--------|--------------|-------|---------------------|--------|
| IMP-PERF-001 | Increase DB max_connections | Set to 300 (from default 100) to prevent pool exhaustion | PERFORMANCE_AND_CAPACITY_REPORT.md bottleneck | Critical | P0 | Small (config change + restart) | DB restart | DBA | Pool utilization < 80% at peak load | Proposed |
| IMP-PERF-002 | Add 7 high-priority database indexes | Composite indexes for employee, attendance, audit, payslip queries | PERFORMANCE_AND_CAPACITY_REPORT.md Section 6.2 | High | P1 | Small (2 days) | Migration window | DBA | Query p95 < 100ms for indexed queries | Proposed |
| IMP-PERF-003 | Increase backend memory to 2GB | Prevent OOM during payroll batch processing | PERFORMANCE_AND_CAPACITY_REPORT.md bottleneck | High | P0 | Small (config change) | Docker restart | DevOps Lead | No OOM kills during payroll runs | Proposed |
| IMP-PERF-004 | Configure Prisma connection pool | Set `connection_limit=20` per instance | PERFORMANCE_AND_CAPACITY_REPORT.md | High | P1 | Small (config) | Backend restart | Backend Lead | Pool exhaustion eliminated | Proposed |
| IMP-PERF-005 | Implement Redis caching | Cache employee lists, leave balances, configs, report results | BACKGROUND_JOB_OPERATIONS.md Section 8.2 | Medium | P2 | Medium (1 week) | Redis deployment | Backend Lead | Cache hit rate > 80%, p95 latency reduced 30% | Proposed |
| IMP-PERF-006 | Add CDN for static assets | Cloudflare for fonts, JS, CSS, images globally | PERFORMANCE_AND_CAPACITY_REPORT.md Section 9.2 | Medium | P1 | Small (2 days) | Cloudflare account | DevOps Lead | FCP/LCP improved 20%, origin traffic reduced 80% | Proposed |
| IMP-PERF-007 | Optimize payroll calculation | Batch processing, background workers, async progress | PERFORMANCE_AND_CAPACITY_REPORT.md Section 9.2 | Medium | P2 | Large (2 weeks) | Queue system | Backend Lead | Payroll calc < 5 min for 5000 employees | Proposed |

### 3.4 Database Improvements

| ID | Title | Description | Evidence | Risk | Priority | Effort | Dependencies | Owner | Acceptance Criteria | Status |
|----|-------|-------------|----------|------|----------|--------|--------------|-------|---------------------|--------|
| IMP-DB-001 | Enable WAL archiving for PITR | Point-in-time recovery to any second | BACKUP_AND_RECOVERY_OPERATIONS.md Section 11.1 | High | P1 | Medium (3 days) | WAL archive storage | DBA | PITR to any second within 24h | Proposed |
| IMP-DB-002 | Deploy read replica | Offload reporting/analytics queries from primary | PERFORMANCE_AND_CAPACITY_REPORT.md Section 6.1 | High | P2 | Medium (1 week) | Streaming replication setup | DBA | Replica lag < 1s, reporting queries on replica | Proposed |
| IMP-DB-003 | Configure pg_stat_statements | Enable for slow query monitoring | DATABASE_MAINTENANCE_RUNBOOK.md Section 5.2 | High | P1 | Small (config) | DB restart | DBA | Top 20 slow queries visible in Grafana | Proposed |
| IMP-DB-004 | Implement logical replication | For CDC / audit streaming / real-time sync | BACKGROUND_JOB_OPERATIONS.md Section 6.2 | Medium | P3 | Large (2 weeks) | Logical replication setup | DBA | CDC events streaming to Kafka/Redis | Proposed |
| IMP-DB-005 | Automate VACUUM/ANALYZE tuning | Dynamic autovacuum thresholds based on table size | DATABASE_MAINTENANCE_RUNBOOK.md Section 4.1 | Medium | P2 | Small (config) | DB restart | DBA | Bloat < 10% on all tables | Proposed |

### 3.5 UX/Accessibility Improvements

| ID | Title | Description | Evidence | Risk | Priority | Effort | Dependencies | Owner | Acceptance Criteria | Status |
|----|-------|-------------|----------|------|----------|--------|--------------|-------|---------------------|--------|
| IMP-UX-001 | Fix Safari RTL/font issues | Font loading optimization, RTL layout fixes for Safari | STAGING_ACCEPTANCE_REPORT.md Section 9 | Medium | P1 | Medium (1 week) | Font optimization | Frontend Lead | Zero visual regressions in Safari 17+ | Proposed |
| IMP-UX-002 | Add Service Worker / PWA | Offline support, background sync, install prompt | PERFORMANCE_AND_CAPACITY_REPORT.md Section 7.2 | Low | P3 | Medium (1 week) | Workbox | Frontend Lead | Lighthouse PWA score > 90 | Proposed |
| IMP-UX-003 | Virtualized lists for large datasets | react-window for employee lists, audit logs | PERFORMANCE_AND_CAPACITY_REPORT.md Section 7.2 | Medium | P2 | Small (3 days) | react-window | Frontend Lead | 10k+ rows render smoothly | Proposed |
| IMP-UX-004 | Image optimization (WebP/AVIF) | Automatic conversion, responsive images | PERFORMANCE_AND_CAPACITY_REPORT.md Section 7.2 | Low | P3 | Small (2 days) | Sharp/ImageMagick | Frontend Lead | Image payload reduced 50% | Proposed |
| IMP-UX-005 | Critical CSS inlining | Inline above-fold CSS for faster FCP | PERFORMANCE_AND_CAPACITY_REPORT.md Section 7.2 | Low | P3 | Small (1 day) | Vite plugin | Frontend Lead | FCP < 1s on 3G | Proposed |

### 3.6 Maintainability Improvements

| ID | Title | Description | Evidence | Risk | Priority | Effort | Dependencies | Owner | Acceptance Criteria | Status |
|----|-------|-------------|----------|------|----------|--------|--------------|-------|---------------------|--------|
| IMP-MAINT-001 | Migrate audit outbox to queue | Replace polling with Bull/BullMQ | BACKGROUND_JOB_OPERATIONS.md Section 8.1 | High | P1 | Small (1 day) | Queue system | Backend Lead | Audit lag < 5s, no polling | Proposed |
| IMP-MAINT-002 | Add OpenAPI/Swagger generation | Auto-generate from NestJS decorators | Not documented | Medium | P2 | Small (2 days) | @nestjs/swagger | Backend Lead | Swagger UI at `/api/docs` | Proposed |
| IMP-MAINT-003 | Implement contract testing | Pact for frontend-backend contracts | Not documented | Medium | P3 | Medium (1 week) | Pact | QA Lead | Contract tests in CI | Proposed |
| IMP-MAINT-004 | Automate dependency updates | Dependabot + auto-merge for patch | SECURITY_OPERATIONS_POLICY.md Section 3 | Medium | P2 | Small (1 day) | GitHub Actions | DevOps Lead | Patch updates auto-merged weekly | Proposed |
| IMP-MAINT-005 | Add contract tests for API | Prevent breaking changes | Not documented | Medium | P3 | Medium (1 week) | Pact | QA Lead | Contract tests in CI | Proposed |

### 3.7 Data Governance Improvements

| ID | Title | Description | Evidence | Risk | Priority | Effort | Dependencies | Owner | Acceptance Criteria | Status |
|----|-------|-------------|----------|------|----------|--------|--------------|-------|---------------------|--------|
| IMP-DG-001 | Resolve jurisdiction confirmation | Confirm Iranian legal requirements for all data handling | DATA_PRIVACY_AND_GOVERNANCE.md Section 13 | Critical | P0 | N/A (Legal) | Legal Counsel | Legal | Documented legal opinion | Proposed |
| IMP-DG-002 | Biometric data handling policy | Define collection, storage, retention for attendance biometrics | DATA_PRIVACY_AND_GOVERNANCE.md Section 13 | High | P1 | N/A (Legal/HR) | Legal/HR | Legal/HR | Documented policy | Proposed |
| IMP-DG-003 | Employee monitoring scope | Define transparent, proportional monitoring | DATA_PRIVACY_AND_GOVERNANCE.md Section 13 | High | P1 | N/A (Legal/HR) | Legal/HR | Legal/HR | Documented policy | Proposed |
| IMP-DG-004 | Data localization requirements | Confirm if data must stay in Iran | DATA_PRIVACY_AND_GOVERNANCE.md Section 13 | Critical | P0 | N/A (Legal) | Legal Counsel | Legal | Documented requirement | Proposed |
| IMP-DG-005 | Automated data retention/deletion | Implement scheduled purging per retention schedule | DATA_PRIVACY_AND_GOVERNANCE.md Section 5 | Medium | P2 | Medium (1 week) | Cron job / Prisma | Backend Lead | Expired data purged automatically | Proposed |
| IMP-DG-006 | Consent management | Track, withdraw, audit consent for processing | DATA_PRIVACY_AND_GOVERNANCE.md Section 6 | Medium | P2 | Medium (1 week) | DB schema | Backend Lead | Consent tracked, withdrawable, auditable | Proposed |

### 3.8 Infrastructure Improvements

| ID | Title | Description | Evidence | Risk | Priority | Effort | Dependencies | Owner | Acceptance Criteria | Status |
|----|-------|-------------|----------|------|----------|--------|--------------|-------|---------------------|--------|
| IMP-INFRA-001 | Migrate to Kubernetes | Replace docker-compose with K8s for scaling, HA | Not documented | Medium | P3 | Large (1 month) | K8s cluster | DevOps Lead | All services on K8s, HPA working | Proposed |
| IMP-INFRA-002 | Implement blue-green deployments | Zero-downtime deployments with instant rollback | RELEASE_AND_DEPLOYMENT_OPERATIONS.md | Medium | P2 | Medium (1 week) | K8s/Ingress | DevOps Lead | Zero-downtime deploys, instant rollback | Proposed |
| IMP-INFRA-003 | Add infrastructure as code | Terraform for all cloud resources | Not documented | Medium | P3 | Large (2 weeks) | Terraform | DevOps Lead | All infra in Git, reproducible | Proposed |
| IMP-INFRA-004 | Implement chaos engineering | Regular chaos experiments (Litmus/Gremlin) | Not documented | Low | P3 | Medium (1 week) | Litmus/Gremlin | DevOps Lead | Monthly chaos experiments | Proposed |
| IMP-INFRA-005 | Multi-AZ deployment | Deploy primary + standby in separate AZs | Not documented | High | P2 | Large (2 weeks) | Cloud provider | DevOps Lead | RTO < 30 min for AZ failure | Proposed |

---

## 4. Improvement Tracking

### 4.1 Status Board

| Status | Count |
|--------|-------|
| Proposed | 32 |
| In Progress | 0 |
| Done | 0 |
| Deferred | 0 |

### 4.2 By Priority

| Priority | Count |
|----------|-------|
| P0 (Immediate) | 7 |
| P1 (Sprint 1) | 12 |
| P2 (Sprint 2) | 10 |
| P3 (Backlog) | 3 |

### 4.3 By Domain

| Domain | Count |
|--------|-------|
| Reliability | 5 |
| Security | 6 |
| Performance | 7 |
| Database | 5 |
| UX/Accessibility | 5 |
| Maintainability | 5 |
| Data Governance | 6 |
| Infrastructure | 5 |
| **Total** | **44** |

---

## 5. Improvement Process

### 5.1 Lifecycle

```
PROPOSED → APPROVED → IN_PROGRESS → TESTING → DONE
                ↓
            DEFERRED (with reason)
```

### 5.2 Approval Gates

| Gate | Criteria | Approver |
|------|----------|----------|
| **Proposed → Approved** | Business case, effort estimate, owner assigned | Engineering Lead |
| **Approved → In Progress** | Dependencies resolved, sprint planned | Sprint Planning |
| **In Progress → Testing** | Code complete, unit tests pass | Code Review |
| **Testing → Done** | All acceptance criteria met, deployed | QA Lead + Owner |

### 5.3 Deferral Criteria

- Dependencies not resolvable in current sprint
- Higher priority work emerges
- Risk reassessment lowers priority
- External dependency (vendor, legal) blocks progress

---

## 6. Reporting

| Report | Frequency | Audience | Content |
|--------|-----------|----------|---------|
| **Improvement Status** | Weekly (Sprint) | Engineering Team | Progress, blockers, velocity |
| **Risk Register** | Monthly | Engineering Lead | P0/P1 status, risks |
| **Improvement Roadmap** | Quarterly | Leadership | Strategic initiatives, investments |
| **Technical Debt Report** | Quarterly | Leadership | Debt trends, paydown plan |

---

## 7. Completed Improvements (Baseline)

| ID | Title | Completed Date | Notes |
|----|-------|----------------|-------|
| Stage 11 fixes | 4 Critical UX defects fixed | 2026-11-18 | DataTable mobile, Modal focus, Kanban keyboard, Contrast |
| Stage 11 fixes | 8 High UX defects fixed | 2026-11-18 | EmployeePanel tabs, aria-describedby, DatePicker, etc. |
| Stage 11 | Monitoring stack deployed | 2026-11-18 | Prometheus, Grafana, Loki, Alertmanager |
| Stage 11 | 18 alerts verified | 2026-11-18 | All critical/warning/security alerts |
| Stage 11 | DR drill completed | 2026-11-18 | RPO 23h12m, RTO 1h39m |
| Stage 11 | Staging deployment verified | 2026-11-18 | All smoke tests, E2E scenarios pass |
| Stage 11 | 350 regression tests pass | 2026-11-18 | 100% pass rate |

---

**Document Version:** 1.0  
**Date:** 2026-11-18  
**Status:** Active — Register Established  
**Classification:** INTERNAL