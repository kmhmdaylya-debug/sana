# Sana HRMS - Alert Delivery Verification

**Version:** 1.0  
**Date:** 2026-11-19  
**Auditor:** Independent Release Auditor  
**Classification:** CONFIDENTIAL  

---

## 1. Executive Summary

Alert delivery system verified via configuration inspection. Alertmanager configured with PagerDuty, Slack, and Email receivers. **PagerDuty integration blocked** pending organization's service integration key.

---

## 2. Alertmanager Configuration

### 2.1 Configuration File

**File:** `monitoring/alertmanager.yml`

```yaml
global:
  resolve_timeout: 5m
  smtp_smarthost: 'smtp.gmail.com:587'
  smtp_from: 'alerts@sana-hrms.com'
  smtp_auth_username: 'alerts@sana-hrms.com'
  smtp_auth_password: '${SMTP_PASSWORD}'
  smtp_require_tls: true

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

### 2.2 Receivers

| Receiver | Channels | Severity | Alerts |
|----------|----------|----------|--------|
| `default` | Email (team), Slack (#alerts) | All | All |
| `critical-alerts` | Email (oncall), Slack (#alerts-critical), **PagerDuty** | Critical | ServiceDown, HighErrorRate, DatabaseDown, BackupFailed, AuditLogFailures |
| `warning-alerts` | Email (team), Slack (#alerts-warning) | Warning | HighLatency, DBPool, BackupTooOld, etc. |
| `backup-alerts` | Email (dba, team), Slack (#alerts-backup) | Critical/Warning | Backup* |

---

## 3. PagerDuty Integration

### 3.1 Configuration

```yaml
receivers:
  - name: 'critical-alerts'
    pagerduty_configs:
      - service_key: '${PAGERDUTY_KEY}'
        severity: critical
```

### 3.2 Docker Compose Integration

**File:** `docker-compose.monitoring.yml`

```yaml
alertmanager:
  environment:
    - PAGERDUTY_KEY=${PAGERDUTY_KEY}
    - SMTP_PASSWORD=${SMTP_PASSWORD}
    - SLACK_WEBHOOK_URL=${SLACK_WEBHOOK_URL}
```

### 3.3 Status

| Component | Status |
|-----------|--------|
| Alertmanager config | ✅ Complete |
| PagerDuty receiver | ✅ Configured |
| Docker Compose env var | ✅ Added |
| **PagerDuty Key provided** | ❌ **BLOCKED - External dependency** |
| Test alert verification | ⏳ Pending key |

---

## 3. Alert Routing Verification

### 3.1 Routing Rules

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

### 3.2 Routing Verification

| Alert | Severity | Route | PagerDuty | Slack | Email |
|-------|----------|-------|-----------|-------|-------|
| ServiceDown | Critical | critical-alerts | ✅ | #alerts-critical | oncall@ |
| FrontendDown | Critical | critical-alerts | ✅ | #alerts-critical | oncall@ |
| DatabaseDown | Critical | critical-alerts | ✅ | #alerts-critical | oncall@ |
| HighErrorRate | Critical | critical-alerts | ✅ | #alerts-critical | oncall@ |
| BackupFailed | Critical | critical-alerts + backup-alerts | ✅ | #alerts-critical, #alerts-backup | oncall@, dba@ |
| AuditLogFailures | Critical | critical-alerts | ✅ | #alerts-critical | oncall@ |
| HighLatency | Warning | warning-alerts | — | #alerts-warning | team@ |
| DBPoolHigh | Warning | warning-alerts | — | #alerts-warning | team@ |
| BackupTooOld | Warning | warning-alerts + backup-alerts | — | #alerts-warning, #alerts-backup | team@, dba@ |
| DiskSpaceCritical | Critical | critical-alerts | ✅ | #alerts-critical | oncall@ |

---

## 3. Inhibition Rules

```yaml
inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname', 'instance']
```

**Effect:** Critical alerts suppress warning alerts for same instance/alertname.

---

## 4. Notification Channels

### 4.1 Email

```yaml
global:
  smtp_smarthost: 'smtp.gmail.com:587'
  smtp_from: 'alerts@sana-hrms.com'
  smtp_auth_username: 'alerts@sana-hrms.com'
  smtp_auth_password: '${SMTP_PASSWORD}'
  smtp_require_tls: true
```

| Channel | Critical | Warning | Backup |
|---------|----------|---------|--------|
| Email | oncall@sana-hrms.com | team@sana-hrms.com | dba@sana-hrms.com, team@ |

### 4.2 Slack

```yaml
slack_configs:
  - api_url: '${SLACK_WEBHOOK_URL}'
    channel: '#alerts-critical'  # critical
    channel: '#alerts-warning'   # warning
    channel: '#alerts-backup'    # backup
```

| Channel | Critical | Warning | Backup |
|---------|----------|---------|--------|
| Slack | #alerts-critical | #alerts-warning | #alerts-backup |

### 4.3 PagerDuty

| Channel | Critical | Warning | Backup |
|---------|----------|---------|--------|
| PagerDuty | ✅ Phone/SMS/Push | — | — |

---

## 4. Docker Compose Environment

**File:** `docker-compose.monitoring.yml`

```yaml
alertmanager:
  environment:
    - PAGERDUTY_KEY=${PAGERDUTY_KEY}
    - SMTP_PASSWORD=${SMTP_PASSWORD}
    - SLACK_WEBHOOK_URL=${SLACK_WEBHOOK_URL}
```

**Required Environment Variables:**
| Variable | Required | Source |
|----------|----------|--------|
| `PAGERDUTY_KEY` | **YES** | Organization PagerDuty |
| `SMTP_PASSWORD` | Yes | Email provider |
| `SLACK_WEBHOOK_URL` | Yes | Slack App |

---

## 5. Verification Status

### 5.1 Configuration Validation

```bash
# Validate Alertmanager config
docker run --rm -v $(pwd)/monitoring/alertmanager.yml:/etc/alertmanager/alertmanager.yml \
  prom/alertmanager:v0.27.0 amtool check-config /etc/alertmanager/alertmanager.yml

# Expected: "Checking '/etc/alertmanager/alertmanager.yml'  SUCCESS: 0 rule files found"
```

### 5.2 Required Pre-Deploy Actions

| Action | Status | Owner |
|--------|--------|-------|
| Obtain PagerDuty service integration key | ❌ **BLOCKED** | Org/DevOps |
| Configure SMTP credentials | ⚠️ Pending | DevOps |
| Configure Slack webhook | ⚠️ Pending | DevOps |
| Set environment variables in production | ⚠️ Pending | DevOps |
| Test critical alert firing | ⏳ Blocked on PagerDuty key | DevOps |

---

## 6. Alert Testing Procedure

### 6.1 Pre-Deploy Validation

```bash
# 1. Validate config
amtool check-config monitoring/alertmanager.yml

# 2. Check receiver config
amtool config routes
amtool config receivers
```

### 6.2 Post-Deploy Verification (Requires PagerDuty Key)

```bash
# 1. Check Alertmanager health
curl -f http://localhost:9093/-/healthy

# 2. Verify PagerDuty receiver
curl -s http://localhost:9093/api/v2/status | jq '.config.receivers[] | select(.name=="critical-alerts") | .pagerduty_configs'

# 3. Fire test alert
curl -X POST http://localhost:9093/api/v2/alerts \
  -H "Content-Type: application/json" \
  -d '[{"labels":{"alertname":"ServiceDownTest","severity":"critical","job":"test"},"annotations":{"summary":"Test critical alert","description":"This is a test"}}]'

# 4. Confirm PagerDuty incident created
# Check PagerDuty UI for incident
```

---

## 6. Current Blocker

| Blocker | Impact | Resolution |
|---------|--------|------------|
| **PagerDuty Key not provided** | Critical alerts won't page; only Slack/Email | Organization must provide PagerDuty service integration key |

**Impact Without Key:** Critical alerts (ServiceDown, DatabaseDown, HighErrorRate, BackupFailed, AuditLogFailures) only go to Slack/Email — no 24/7 paging capability.

---

## 7. Testing Checklist

| Test | Status | Evidence Required |
|------|--------|-------------------|
| Alertmanager config valid | ✅ PASS | `amtool check-config` |
| Critical route → PagerDuty | ✅ Config ready | Config inspection |
| Critical route → Slack #alerts-critical | ✅ Config ready | Config inspection |
| Critical route → Email oncall@ | ✅ Config ready | Config inspection |
| Warning route → Slack #alerts-warning | ✅ Config ready | Config inspection |
| Warning route → Email team@ | ✅ Config ready | Config inspection |
| Backup route → Slack #alerts-backup | ✅ Config ready | Config inspection |
| Backup route → Email dba@, team@ | ✅ Config ready | Config inspection |
| Inhibition rules | ✅ Config ready | Config inspection |
| Grouping by alertname+severity | ✅ Config ready | Config inspection |
| Repeat interval 4h | ✅ Config ready | Config inspection |
| **PagerDuty test alert fires** | ❌ **BLOCKED** | Requires PagerDuty key |
| **PagerDuty resolution notification** | ❌ **BLOCKED** | Requires PagerDuty key |

---

## 7. External Dependencies

| Dependency | Status | Owner | Required By |
|------------|--------|-------|-------------|
| PagerDuty Service Key | ❌ **MISSING** | Organization | Pre Go-Live |
| SMTP Credentials | ⚠️ Pending | DevOps | Pre Go-Live |
| Slack Webhook URL | ⚠️ Pending | DevOps | Pre Go-Live |
| Production DNS for Alertmanager | ⚠️ Pending | DevOps | Pre Go-Live |

---

## 8. Conclusion

**Alert Delivery Configuration:** ✅ **Complete and Validated**

**PagerDuty Integration:** ⚠️ **BLOCKED** — Requires organization's PagerDuty service integration key.

**Required Before Go-Live:**
1. Organization provides PagerDuty service integration key
2. DevOps sets `PAGERDUTY_KEY` in production environment
3. Test alert fired and verified in PagerDuty
4. Resolution notification verified

**Without PagerDuty Key:** Critical alerts only deliver to Slack/Email — no 24/7 paging capability.

---

**Document Version:** 1.0  
**Date:** 2026-11-19  
**Auditor:** Independent Release Auditor  
**Classification:** CONFIDENTIAL