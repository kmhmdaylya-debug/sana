# Sana HRMS - SLI/SLO Definitions

**Version:** 1.0  
**Date:** 2026-11-18  
**Status:** Proposed — Pending Stakeholder Approval  
**Classification:** INTERNAL  

---

## 1. Overview

This document defines Service Level Indicators (SLIs) and Service Level Objectives (SLOs) for Sana HRMS based on the actual architecture, business requirements, and operational capacity documented in OPERATIONAL_BASELINE.md.

**Important:** These SLOs are **proposed** and require formal stakeholder approval (Engineering Lead, Product Owner, Finance Director, HR Director) before becoming operational targets. Current staging measurements are provided as baseline evidence.

---

## 2. SLI/SLO Framework

### 2.1 Definitions

| Term | Definition |
|------|------------|
| **SLI** | Service Level Indicator — A quantifiable measure of service behavior (e.g., request latency) |
| **SLO** | Service Level Objective — A target value for an SLI over a measurement window (e.g., 99% of requests < 500ms) |
| **Error Budget** | The inverse of SLO — the amount of unreliability permitted (100% - SLO) |
| **Measurement Window** | Rolling time period over which SLO is evaluated (typically 30 days) |

### 2.2 SLO Target Selection Principles

1. **Based on actual staging measurements** — Not aspirational targets
2. **Aligned with business impact** — Critical workflows get tighter SLOs
3. **Realistic for current architecture** — Accounts for single-instance PostgreSQL, containerized deployment
4. **Measurable with current monitoring** — Requires implemented metrics (see gaps in OPERATIONAL_BASELINE.md)

---

## 3. SLI/SLO Definitions

### 3.1 Availability SLIs

#### SLI-A1: API Availability
| Attribute | Definition |
|-----------|------------|
| **Name** | `api_availability` |
| **Description** | Proportion of valid API requests that receive a successful response (2xx, 3xx) |
| **Formula** | `sum(rate(sana_http_requests_total{status_code=~"2..|3.."}[5m])) / sum(rate(sana_http_requests_total[5m]))` |
| **Data Source** | Prometheus (requires `sana_http_requests_total` metric) |
| **Measurement Window** | Rolling 30 days |
| **Current Staging Baseline** | 100% (no observed failures in acceptance testing) |

| SLO Tier | Target | Error Budget (30d) | Status |
|----------|--------|-------------------|--------|
| **SLO-A1-Critical** | 99.9% | 43.2 minutes | ⏳ Pending Approval |
| **SLO-A1-Standard** | 99.5% | 3.6 hours | ⏳ Pending Approval |

**Rationale:** 99.9% allows ~43 min downtime/month — suitable for HR system where payroll/attendance are time-sensitive. Staging shows 100% but production will have maintenance windows.

#### SLI-A2: Frontend Availability
| Attribute | Definition |
|-----------|------------|
| **Name** | `frontend_availability` |
| **Description** | Proportion of frontend health checks returning 200 OK |
| **Formula** | `sum(rate(frontend_health_check_total{status="up"}[5m])) / sum(rate(frontend_health_check_total[5m]))` |
| **Data Source** | Prometheus (requires frontend health endpoint metrics) |
| **Measurement Window** | Rolling 30 days |
| **Current Staging Baseline** | 100% |

| SLO Tier | Target | Error Budget (30d) | Status |
|----------|--------|-------------------|--------|
| **SLO-A2** | 99.95% | 21.6 minutes | ⏳ Pending Approval |

#### SLI-A3: Database Availability
| Attribute | Definition |
|-----------|------------|
| **Name** | `database_availability` |
| **Description** | Proportion of time PostgreSQL accepts connections and serves queries |
| **Formula** | `sum(rate(pg_up[5m])) / count(pg_up)` (or `sana_db_health_check_total{status="up"}`) |
| **Data Source** | Prometheus (Postgres Exporter `pg_up` or custom health check) |
| **Measurement Window** | Rolling 30 days |
| **Current Staging Baseline** | 100% |

| SLO Tier | Target | Error Budget (30d) | Status |
|----------|--------|-------------------|--------|
| **SLO-A3** | 99.99% | 4.3 minutes | ⏳ Pending Approval |

**Rationale:** Database is single point of failure — higher target reflects criticality.

---

### 3.2 Latency SLIs

#### SLI-L1: API Latency (p50)
| Attribute | Definition |
|-----------|------------|
| **Name** | `api_latency_p50` |
| **Description** | Median API response time |
| **Formula** | `histogram_quantile(0.50, sum(rate(sana_http_request_duration_seconds_bucket[5m])) by (le, route))` |
| **Data Source** | Prometheus (requires `sana_http_request_duration_seconds_bucket`) |
| **Measurement Window** | Rolling 30 days |
| **Current Staging Baseline** | 87ms |

| SLO Tier | Target | Status |
|----------|--------|--------|
| **SLO-L1** | < 200ms | ⏳ Pending Approval |

#### SLI-L2: API Latency (p95)
| Attribute | Definition |
|-----------|------------|
| **Name** | `api_latency_p95` |
| **Description** | 95th percentile API response time |
| **Formula** | `histogram_quantile(0.95, sum(rate(sana_http_request_duration_seconds_bucket[5m])) by (le, route))` |
| **Data Source** | Prometheus (requires `sana_http_request_duration_seconds_bucket`) |
| **Measurement Window** | Rolling 30 days |
| **Current Staging Baseline** | 234ms |

| SLO Tier | Target | Status |
|----------|--------|--------|
| **SLO-L2** | < 500ms | ⏳ Pending Approval |

#### SLI-L3: API Latency (p99)
| Attribute | Definition |
|-----------|------------|
| **Name** | `api_latency_p99` |
| **Description** | 99th percentile API response time |
| **Formula** | `histogram_quantile(0.99, sum(rate(sana_http_request_duration_seconds_bucket[5m])) by (le, route))` |
| **Data Source** | Prometheus (requires `sana_http_request_duration_seconds_bucket`) |
| **Measurement Window** | Rolling 30 days |
| **Current Staging Baseline** | 892ms |

| SLO Tier | Target | Status |
|----------|--------|--------|
| **SLO-L3** | < 2s | ⏳ Pending Approval |

**Rationale:** p99 < 2s accounts for occasional GC pauses, cold starts, and complex report queries. Staging p99 is 892ms.

#### SLI-L4: Database Query Latency (p95)
| Attribute | Definition |
|-----------|------------|
| **Name** | `db_query_latency_p95` |
| **Description** | 95th percentile database query duration |
| **Formula** | `histogram_quantile(0.95, sum(rate(sana_db_query_duration_seconds_bucket[5m])) by (le, query_type, table))` |
| **Data Source** | Prometheus (requires `sana_db_query_duration_seconds_bucket` — NOT YET IMPLEMENTED) |
| **Measurement Window** | Rolling 30 days |
| **Current Staging Baseline** | 45ms (manual sampling) |

| SLO Tier | Target | Status |
|----------|--------|--------|
| **SLO-L4** | < 100ms | ⏳ Pending Approval / Metric Not Implemented |

---

### 3.3 Error Rate SLIs

#### SLI-E1: API Error Rate (5xx)
| Attribute | Definition |
|-----------|------------|
| **Name** | `api_error_rate_5xx` |
| **Description** | Proportion of API requests returning 5xx server errors |
| **Formula** | `sum(rate(sana_http_requests_total{status_code=~"5.."}[5m])) / sum(rate(sana_http_requests_total[5m]))` |
| **Data Source** | Prometheus (requires `sana_http_requests_total`) |
| **Measurement Window** | Rolling 30 days |
| **Current Staging Baseline** | 0% |

| SLO Tier | Target | Error Budget (30d) | Status |
|----------|--------|-------------------|--------|
| **SLO-E1** | < 0.1% | 43 min equivalent | ⏳ Pending Approval |

#### SLI-E2: Authentication Failure Rate
| Attribute | Definition |
|-----------|------------|
| **Name** | `auth_failure_rate` |
| **Description** | Proportion of login attempts failing due to invalid credentials (excluding rate-limited) |
| **Formula** | `sum(rate(sana_http_requests_total{route=~".*/auth/login",status_code="401"}[5m])) / sum(rate(sana_http_requests_total{route=~".*/auth/login"}[5m]))` |
| **Data Source** | Prometheus (requires `sana_http_requests_total`) |
| **Measurement Window** | Rolling 30 days |
| **Current Staging Baseline** | N/A (not measured separately) |

| SLO Tier | Target | Status |
|----------|--------|--------|
| **SLO-E2** | < 5% (legitimate failures) | ⏳ Pending Approval |

---

### 3.4 Business Workflow SLIs

#### SLI-B1: Critical Workflow Success Rate
| Attribute | Definition |
|-----------|------------|
| **Name** | `workflow_success_rate` |
| **Description** | Proportion of critical business workflows completing successfully |
| **Critical Workflows:** | Payroll calculation, Payslip generation, Leave approval, Attendance check-in, Employee termination |
| **Formula** | `sum(rate(sana_workflow_completion_total{status="success",workflow=~"payroll|payslip|leave|attendance|termination"}[5m])) / sum(rate(sana_workflow_completion_total{workflow=~"payroll|payslip|leave|attendance|termination"}[5m]))` |
| **Data Source** | Prometheus (requires custom `sana_workflow_completion_total` metric — NOT YET IMPLEMENTED) |
| **Measurement Window** | Rolling 30 days |
| **Current Staging Baseline** | 100% (350/350 regression tests pass) |

| SLO Tier | Target | Error Budget (30d) | Status |
|----------|--------|-------------------|--------|
| **SLO-B1** | 99.9% | 43.2 minutes | ⏳ Pending Approval / Metric Not Implemented |

#### SLI-B2: Payroll Processing Reliability
| Attribute | Definition |
|-----------|------------|
| **Name** | `payroll_reliability` |
| **Description** | Proportion of payroll periods completing calculation and publishing without manual intervention |
| **Formula** | `payroll_periods_completed_auto / payroll_periods_total` |
| **Data Source** | Application database (PayrollPeriod status) or custom metric |
| **Measurement Window** | Per payroll period (monthly) |
| **Current Staging Baseline** | 100% (tested in acceptance) |

| SLO Tier | Target | Status |
|----------|--------|--------|
| **SLO-B2** | 100% per period | ⏳ Pending Approval |

---

### 3.5 Background Job SLIs

#### SLI-J1: Backup Success Rate
| Attribute | Definition |
|-----------|------------|
| **Name** | `backup_success_rate` |
| **Description** | Proportion of scheduled backups completing successfully |
| **Formula** | `sum(increase(sana_backup_status{result="success"}[1d])) / sum(increase(sana_backup_total[1d]))` |
| **Data Source** | Prometheus (requires `sana_backup_status` and `sana_backup_total`) |
| **Measurement Window** | Rolling 30 days |
| **Current Staging Baseline** | 100% (daily verified) |

| SLO Tier | Target | Status |
|----------|--------|--------|
| **SLO-J1** | 100% | ⏳ Pending Approval |

#### SLI-J2: Scheduled Job Success Rate
| Attribute | Definition |
|-----------|------------|
| **Name** | `scheduled_job_success_rate` |
| **Description** | Proportion of scheduled/cron jobs completing successfully |
| **Formula** | Custom metric per job type |
| **Data Source** | Application logs / custom metrics (NOT YET IMPLEMENTED) |
| **Measurement Window** | Rolling 30 days |
| **Current Staging Baseline** | Unknown (not measured) |

| SLO Tier | Target | Status |
|----------|--------|--------|
| **SLO-J2** | 99% | ⏳ Pending Approval / Metric Not Implemented |

---

## 4. Error Budget Policy

### 4.1 Error Budget Calculation

| SLO | Target | Monthly Error Budget | Weekly Error Budget |
|-----|--------|---------------------|-------------------|
| API Availability (99.9%) | 99.9% | 43.2 min | 10.8 min |
| Frontend Availability (99.95%) | 99.95% | 21.6 min | 5.4 min |
| Database Availability (99.99%) | 99.99% | 4.3 min | 1.1 min |
| API Latency p95 (<500ms) | 95th %ile | N/A (percentile) | N/A |
| API Error Rate 5xx (<0.1%) | 0.1% | 43 min equivalent | 10.8 min |
| Critical Workflow Success (99.9%) | 99.9% | 43.2 min | 10.8 min |
| Backup Success (100%) | 100% | 0 failures | 0 failures |

### 4.2 Error Budget Consumption Actions

| Consumption Level | Action | Responsible |
|-------------------|--------|-------------|
| **< 25%** | Normal operations | — |
| **25-50%** | Review in weekly ops meeting | DevOps Lead |
| **50-75%** | Halt non-critical deployments; prioritize reliability work | Engineering Lead |
| **75-100%** | Freeze all non-hotfix deployments; incident response mode | Incident Commander |
| **> 100% (Exhausted)** | Post-incident review mandatory; reliability sprint required | CTO / Engineering Lead |

### 4.3 Error Budget Reset

- Reset at start of each calendar month (aligned with measurement window)
- Carryover not permitted — each month starts fresh
- Exhaustion triggers mandatory reliability improvement sprint

---

## 5. Measurement Implementation Status

### 5.1 Implemented Metrics (Available in Staging)

| Metric | Prometheus Metric | Status |
|-------|-------------------|--------|
| Health checks | `up{job="sana-backend"}`, `up{job="sana-frontend"}`, `up{job="postgres"}` | ✅ |
| Container metrics | `container_cpu_usage_seconds_total`, `container_memory_usage_bytes` | ✅ (cAdvisor) |
| Node metrics | `node_filesystem_avail_bytes`, `node_cpu_seconds_total` | ✅ (Node Exporter) |
| PostgreSQL metrics | `pg_up`, `pg_stat_database_*` | ✅ (Postgres Exporter) |

### 5.2 Missing Application Metrics (Required for SLOs)

| Metric | Required For | Implementation Effort | Priority |
|--------|-------------|----------------------|----------|
| `sana_http_requests_total` | SLI-A1, SLI-E1, SLI-E2, SLI-L1/L2/L3 | 2 days (interceptor) | **Critical** |
| `sana_http_request_duration_seconds_bucket` | SLI-L1, SLI-L2, SLI-L3 | 2 days (interceptor) | **Critical** |
| `sana_db_query_duration_seconds_bucket` | SLI-L4 | 1 day (Prisma middleware) | **High** |
| `sana_db_connections_active` | Database capacity | 1 day (gauge) | **High** |
| `sana_active_users` | Business capacity | 1 day (gauge) | Medium |
| `sana_pending_approvals` | SLI-B1 | 1 day (gauge) | Medium |
| `sana_backup_status` / `sana_backup_age_hours` | SLI-J1 | 0.5 day (existing backup service) | **High** |
| `sana_workflow_completion_total` | SLI-B1 | 2 days (instrumentation) | **High** |

**Total Estimated Effort:** ~12 days to implement all required metrics

---

## 6. Alert Thresholds (Derived from SLOs)

| Alert | SLO Reference | Threshold | Severity | Action |
|-------|---------------|-----------|----------|--------|
| ServiceDown | SLO-A1 | `up == 0 for 1m` | Critical | Page on-call |
| HighErrorRate | SLO-E1 | `5xx rate > 5% for 2m` | Critical | Page on-call |
| HighLatency | SLO-L2 | `p95 > 2s for 5m` | Warning | Notify team |
| DatabaseDown | SLO-A3 | `pg_up == 0 for 30s` | Critical | Page on-call |
| BackupFailed | SLO-J1 | `backup_status == 0` | Critical | Page on-call |
| DBConnectionPoolHigh | Capacity | `connections > 80% for 5m` | Warning | Notify team |
| DiskSpaceCritical | Capacity | `disk < 10% for 5m` | Critical | Page on-call |

**Note:** These alerts are already configured and tested in staging (see ALERT_VERIFICATION_REPORT.md). Thresholds should be reviewed after production metrics stabilize.

---

## 7. Stakeholder Approval Matrix

| SLO | Engineering Lead | Product Owner | Finance Director | HR Director | Status |
|-----|-----------------|---------------|------------------|-------------|--------|
| SLO-A1: API Availability 99.9% | ☐ | ☐ | — | — | ⏳ Pending |
| SLO-A2: Frontend Availability 99.95% | ☐ | ☐ | — | — | ⏳ Pending |
| SLO-A3: Database Availability 99.99% | ☐ | ☐ | — | — | ⏳ Pending |
| SLO-L2: API p95 < 500ms | ☐ | ☐ | — | — | ⏳ Pending |
| SLO-L3: API p99 < 2s | ☐ | ☐ | — | — | ⏳ Pending |
| SLO-E1: 5xx Error Rate < 0.1% | ☐ | ☐ | — | — | ⏳ Pending |
| SLO-B1: Critical Workflow 99.9% | ☐ | ☐ | ☐ | ☐ | ⏳ Pending |
| SLO-B2: Payroll 100% | ☐ | — | ☐ | ☐ | ⏳ Pending |
| SLO-J1: Backup 100% | ☐ | — | — | — | ⏳ Pending |

---

## 8. Review and Revision Schedule

| Activity | Frequency | Responsible |
|----------|-----------|-------------|
| **SLO Target Review** | Quarterly | Engineering Lead + Product Owner |
| **Error Budget Review** | Monthly (with monthly reset) | DevOps Lead |
| **Metric Implementation Audit** | Per sprint | DevOps Lead |
| **Stakeholder Approval Renewal** | Annually | All signatories |
| **Post-Incident SLO Adjustment** | Post-incident | Incident Commander + Engineering Lead |

---

## 8. Current Status Summary

| Category | SLIs Defined | SLOs Proposed | Metrics Implemented | Stakeholder Approved |
|----------|--------------|---------------|---------------------|---------------------|
| Availability | 3 | 3 | 0/3 | 0/3 |
| Latency | 4 | 4 | 0/4 | 0/4 |
| Error Rate | 2 | 2 | 0/2 | 0/2 |
| Business Workflow | 2 | 2 | 0/2 | 0/2 |
| Background Jobs | 2 | 2 | 0/2 | 0/2 |
| **Total** | **13** | **13** | **0/13** | **0/13** |

---

## 9. Next Steps

1. **Immediate (Pre Go-Live):**
   - Implement `sana_http_requests_total` and `sana_http_request_duration_seconds_bucket` via NestJS interceptor
   - Implement `sana_backup_status` and `sana_backup_age_hours` from existing backup service
   - Obtain stakeholder approval for SLO-A1, SLO-A2, SLO-A3, SLO-L2, SLO-E1

2. **Sprint 1 (0-30 days post go-live):**
   - Implement remaining application metrics (db queries, connections, workflows)
   - Deploy Grafana SLO dashboards with error budget visualization
   - Configure alert thresholds based on approved SLOs

3. **Sprint 2 (30-60 days):**
   - Validate SLO targets against production data
   - Adjust targets if staging baselines prove inaccurate
   - Implement error budget alerting (budget burn rate alerts)

---

**Document Version:** 1.0  
**Date:** 2026-11-18  
**Status:** Proposed — Awaiting Stakeholder Approval  
**Classification:** INTERNAL