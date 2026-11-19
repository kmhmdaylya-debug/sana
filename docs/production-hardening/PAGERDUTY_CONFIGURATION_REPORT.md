# Sana HRMS - PagerDuty Configuration Report

**Version:** 1.0  
**Date:** 2026-11-19  
**Classification:** INTERNAL  

---

## 1. Executive Summary

PagerDuty integration has been configured in Alertmanager. The integration is ready but requires the organization's PagerDuty service integration key (`PAGERDUTY_KEY`) to be provided at deployment time.

**Status:** ✅ Configured — ⚠️ Requires `PAGERDUTY_KEY` environment variable at deploy time

---

## 2. Configuration

### 2.1 Alertmanager Configuration

File: `monitoring/alertmanager.yml`

```yaml
receivers:
  - name: 'critical-alerts'
    email_configs:
      - to: 'oncall@sana-hrms.com'
        send_resolved: true
    slack_configs:
      - api_url: '${SLACK_WEBHOOK_URL}'
        channel: '#alerts-critical'
        title: '🚨 CRITICAL: {{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.summary }}\n{{ .Annotations.description }}\n{{ end }}'
        color: 'danger'
    pagerduty_configs:
      - service_key: '${PAGERDUTY_KEY}'
        severity: critical
```

### 2.2 Docker Compose Environment

File: `docker-compose.monitoring.yml`

```yaml
alertmanager:
  environment:
    - PAGERDUTY_KEY=${PAGERDUTY_KEY}
    - SMTP_PASSWORD=${SMTP_PASSWORD}
    - SLACK_WEBHOOK_URL=${SLACK_WEBHOOK_URL}
```

---

## 3. Alert Routing

### 3.1 Critical Alerts → PagerDuty

| Alert | Severity | PagerDuty |
|-------|----------|-----------|
| ServiceDown (Backend) | Critical | ✅ |
| ServiceDown (Frontend) | Critical | ✅ |
| DatabaseDown | Critical | ✅ |
| HighErrorRate | Critical | ✅ |
| BackupFailed | Critical | ✅ |
| AuditLogFailures | Critical | ✅ |
| ContainerRestartLoop | Critical | ✅ |
| DiskSpaceCritical | Critical | ✅ |

### 3.2 Routing Logic

```yaml
route:
  group_by: ['alertname', 'severity']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  receiver: 'default'
  routes:
    - match:
        severity: critical
      receiver: 'critical-alerts'
      continue: true
    - match:
        severity: warning
      receiver: 'warning-alerts'
    - match_re:
        alertname: 'Backup.*'
      receiver: 'backup-alerts'
```

### 3.3 Inhibition Rules

```yaml
inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname', 'instance']
```

**Effect:** Critical alerts suppress warning alerts for the same instance/alertname.

---

## 3. Deployment Requirements

### 3.1 Required Environment Variables

| Variable | Source | Required |
|----------|--------|----------|
| `PAGERDUTY_KEY` | PagerDuty service integration key | **YES** |
| `SMTP_PASSWORD` | Email password for alerts | Yes |
| `SLACK_WEBHOOK_URL` | Slack webhook URL | Yes |

### 3.2 PagerDuty Setup Steps

1. **Create Service in PagerDuty**
   - Go to Services → New Service
   - Name: "Sana HRMS Production"
   - Integration: "Events API V2"
   - Copy the **Integration Key** (32-char string)

2. **Configure Escalation Policy**
   - Level 1: On-call Engineer (immediate)
   - Level 2: Team Lead (15 min)
   - Level 3: Engineering Lead (30 min)
   - Level 4: CTO (60 min)

3. **Add to Environment**
   ```bash
   # In .env.production or deployment secrets
   PAGERDUTY_KEY=your-32-char-integration-key
   ```

3. **Verify Deployment**
   ```bash
   # Check Alertmanager config
   curl -s http://alertmanager:9093/api/v2/status | jq .config.receivers[].pagerduty_configs
   
   # Test alert
   curl -X POST http://alertmanager:9093/api/v2/alerts \
     -H "Content-Type: application/json" \
     -d '[{"labels":{"alertname":"TestAlert","severity":"critical"},"annotations":{"summary":"Test alert from Sana HRMS"}}]'
   ```

---

## 4. Notification Channels

| Channel | Critical | Warning | Backup |
|---------|----------|---------|--------|
| **PagerDuty** | ✅ Phone/SMS/Push | — | — |
| **Slack** | #alerts-critical | #alerts-warning | #alerts-backup |
| **Email** | oncall@sana-hrms.com | team@sana-hrms.com | dba@sana-hrms.com, team@sana-hrms.com |

---

## 5. Escalation Matrix

| Time | Critical | Warning |
|------|----------|---------|
| 0-15 min | On-call Engineer (paged) | On-call Engineer (Slack) |
| 15-30 min | Team Lead + DevOps Lead | Team Lead |
| 30-60 min | Engineering Lead + Incident Commander | Engineering Lead |
| 60+ min | CTO + Legal | — |

---

## 6. Testing

### 6.1 Pre-Deploy Validation

```bash
# Validate Alertmanager config
docker run --rm -v $(pwd)/monitoring/alertmanager.yml:/etc/alertmanager/alertmanager.yml prom/alertmanager:v0.27.0 amtool check-config /etc/alertmanager/alertmanager.yml

# Check PagerDuty integration in config
grep -A 5 "pagerduty_configs" monitoring/alertmanager.yml
```

### 6.2 Post-Deploy Verification

```bash
# 1. Check Alertmanager is up
curl -f http://localhost:9093/-/healthy

# 2. Verify PagerDuty receiver configured
curl -s http://localhost:9093/api/v2/status | jq '.config.receivers[] | select(.name=="critical-alerts") | .pagerduty_configs'

# 3. Fire test alert
curl -X POST http://localhost:9093/api/v2/alerts \
  -H "Content-Type: application/json" \
  -d '[{"labels":{"alertname":"ServiceDownTest","severity":"critical","job":"test"},"annotations":{"summary":"Test critical alert","description":"This is a test"}]}'

# 4. Confirm PagerDuty incident created
# Check PagerDuty UI for incident
```

---

## 6. Current Status

| Item | Status |
|------|--------|
| Alertmanager config | ✅ Complete |
| Docker Compose env var | ✅ Added |
| PagerDuty receiver config | ✅ Complete |
| Routing rules | ✅ Complete |
| Inhibition rules | ✅ Complete |
| **PagerDuty Key provided** | ❌ **BLOCKED - External dependency** |
| Test alert verification | ⏳ Pending key |

---

## 6. Blocker

**BLOCKER-CRIT-006:** `PAGERDUTY_KEY` environment variable not provided by organization.

**Action Required:** Organization must provide PagerDuty service integration key before production go-live.

**Impact Without Key:** Critical alerts will only go to Slack/Email — no 24/7 paging capability.

---

**Document Version:** 1.0  
**Date:** 2026-11-19  
**Status:** Configured — Blocked on External Dependency  
**Classification:** INTERNAL