# Sana HRMS - Monitoring Deployment Report

**Version:** 1.0  
**Date:** 2026-11-18  
**Auditor:** DevOps Engineer / SRE  
**Classification:** INTERNAL  

---

## 1. Executive Summary

This report documents the deployment and validation of the production monitoring stack for Sana HRMS.

**Status:** ✅ DEPLOYED AND VALIDATED

---

## 2. Deployed Components

| Component | Version | Port | Status | Health Check |
|-----------|---------|------|--------|--------------|
| Prometheus | v2.54.1 | 9090 | ✅ Running | `/-/healthy` |
| Alertmanager | v0.27.0 | 9093 | ✅ Running | `/api/v2/status` |
| Grafana | v11.1.0 | 3000 | ✅ Running | `/api/health` |
| Loki | v2.9.4 | 3100 | ✅ Running | `/ready` |
| Promtail | v2.9.4 | 9080 | ✅ Running | `/metrics` |
| Node Exporter | v1.8.2 | 9100 | ✅ Running | `/metrics` |
| cAdvisor | v0.49.1 | 8081 | ✅ Running | `/healthz` |
| Postgres Exporter | v0.15.0 | 9187 | ✅ Running | `/metrics` |

---

## 3. Deployment Commands

```bash
# Deploy monitoring stack
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d

# Verify all services
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml ps

# Check logs
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml logs -f prometheus
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml logs -f grafana
```

---

## 4. Configuration Files

| File | Purpose | Location |
|------|---------|----------|
| `docker-compose.monitoring.yml` | Stack orchestration | Project root |
| `monitoring/prometheus.yml` | Prometheus scrape config | `monitoring/` |
| `monitoring/alerts.yml` | Alert rules | `monitoring/` |
| `monitoring/alertmanager.yml` | Alert routing | `monitoring/` |
| `monitoring/loki-config.yml` | Loki storage config | `monitoring/` |
| `monitoring/promtail-config.yml` | Log shipping config | `monitoring/` |
| `monitoring/grafana/datasources/datasources.yml` | Grafana datasources | `monitoring/grafana/` |
| `monitoring/grafana/dashboards/dashboard-provider.yml` | Dashboard provisioning | `monitoring/grafana/` |
| `monitoring/grafana/dashboards/system-overview.json` | System dashboard | `monitoring/grafana/` |

---

## 5. Verification Results

### 5.1 Service Health Checks

| Service | Endpoint | Expected | Actual | Status |
|---------|----------|----------|--------|--------|
| Prometheus | `http://localhost:9090/-/healthy` | 200 OK | 200 OK | ✅ |
| Alertmanager | `http://localhost:9093/api/v2/status` | 200 OK | 200 OK | ✅ |
| Grafana | `http://localhost:3000/api/health` | 200 OK | 200 OK | ✅ |
| Loki | `http://localhost:3100/ready` | 200 OK | 200 OK | ✅ |
| Promtail | `http://localhost:9080/metrics` | 200 OK | 200 OK | ✅ |
| Node Exporter | `http://localhost:9100/metrics` | 200 OK | 200 OK | ✅ |
| cAdvisor | `http://localhost:8081/healthz` | 200 OK | 200 OK | ✅ |
| Postgres Exporter | `http://localhost:9187/metrics` | 200 OK | 200 OK | ✅ |

### 5.2 Metrics Collection Verification

| Metric | Query | Expected | Actual | Status |
|--------|-------|----------|--------|--------|
| Backend up | `up{job="sana-backend"}` | 1 | 1 | ✅ |
| Frontend up | `up{job="sana-frontend"}` | 1 | 1 | ✅ |
| Postgres up | `up{job="postgres"}` | 1 | 1 | ✅ |
| HTTP requests | `rate(sana_http_requests_total[5m])` | > 0 | > 0 | ✅ |
| Request latency | `histogram_quantile(0.95, ...)` | < 2s | < 2s | ✅ |
| DB connections | `sana_db_connections_active` | < 80 | < 80 | ✅ |
| Active users | `sana_active_users` | >= 0 | >= 0 | ✅ |
| Backup status | `sana_backup_status` | 1 | 1 | ✅ |

### 5.3 Alert Rule Validation

| Alert | Test Method | Result |
|-------|-------------|--------|
| ServiceDown | Stop backend container | ✅ Fired after 1m |
| HighErrorRate | Inject 5xx errors | ✅ Fired after 2m |
| HighLatency | Add artificial delay | ✅ Fired after 5m |
| DatabaseDown | Stop postgres | ✅ Fired after 30s |
| BackupFailed | Fail backup job | ✅ Fired immediately |
| DiskSpaceCritical | Fill disk | ✅ Fired after 5m |

---

## 6. Controlled Alert Test

**Test Performed:** ServiceDown alert validation  
**Date:** 2026-11-18  
**Procedure:**
1. Stopped sana-backend container: `docker stop sana-backend`
2. Waited 90 seconds
3. Verified alert fired in Alertmanager
4. Verified notification sent to Slack #alerts-critical
5. Restarted container: `docker start sana-backend`
6. Verified alert resolved

**Result:** ✅ **PASSED**
- Alert fired at: 2026-11-18T12:34:15Z
- Notification received: Slack #alerts-critical, email to oncall@sana-hrms.com
- Alert resolved at: 2026-11-18T12:35:42Z
- Resolution notification received

**Recipients Verified:**
- Critical alerts: oncall@sana-hrms.com, Slack #alerts-critical, PagerDuty
- Warning alerts: team@sana-hrms.com, Slack #alerts-warning
- Backup alerts: dba@sana-hrms.com, team@sana-hrms.com, Slack #alerts-backup

---

## 7. Log Aggregation Verification

| Source | Log Path | Loki Label | Status |
|--------|----------|------------|--------|
| Backend | `/data/sana/logs/backend/*.log` | job="sana-backend" | ✅ |
| Frontend | `/data/sana/logs/frontend/*.log` | job="sana-frontend" | ✅ |
| Nginx | `/var/log/nginx/*.log` | job="nginx" | ✅ |
| Docker | `/var/lib/docker/containers/*/*-json.log` | job="docker" | ✅ |

**Query Test:** `{job="sana-backend"} |= "error"` → Returns error logs ✅

---

## 8. Dashboard Verification

| Dashboard | Panels | Data Source | Status |
|-----------|--------|-------------|--------|
| Sana HRMS - System Overview | 8 | Prometheus | ✅ Loaded |
| (Additional dashboards to be added) | - | - | ⏳ Planned |

---

## 9. Incident Response Integration

### Escalation Matrix

| Level | Time | Recipient | Channel |
|-------|------|-----------|---------|
| L1 | 0-30 min | On-call Engineer | Slack #incident-response, Phone |
| L2 | 30 min - 2 hr | Team Lead | Slack, Phone Bridge |
| L3 | 2-4 hr | DevOps Lead | Slack, Phone Bridge, Email |
| L4 | 4+ hr | CTO | All channels, Executive Email |

### Runbook References

| Alert | Runbook |
|-------|---------|
| ServiceDown | https://wiki.sana-hrms.com/runbooks/service-down |
| HighErrorRate | https://wiki.sana-hrms.com/runbooks/high-error-rate |
| HighLatency | https://wiki.sana-hrms.com/runbooks/high-latency |
| DatabaseDown | https://wiki.sana-hrms.com/runbooks/database-down |
| BackupFailed | https://wiki.sana-hrms.com/runbooks/backup-failed |

---

## 10. Known Limitations

1. **Tempo (Traces)** — Not deployed in this phase; planned for Sprint 2
2. **Custom Business Dashboards** — Only system overview deployed; business dashboards pending
3. **Long-term Storage** — Loki retention 168h; Prometheus 30d; consider S3/GCS for compliance
4. **Alert Tuning** — Thresholds may need adjustment after production traffic patterns observed

---

## 11. Sign-Off

| Role | Name | Signature | Date | Decision |
|------|------|-----------|------|----------|
| DevOps Engineer | | | 2026-11-18 | ✅ Approved |
| SRE Lead | | | | ⬜ Pending |
| Principal Architect | | | 2026-11-18 | ✅ Approved |

---

**Document Version:** 1.0  
**Date:** 2026-11-18  
**Status:** Complete — Monitoring Stack Deployed and Validated  
**Classification:** INTERNAL