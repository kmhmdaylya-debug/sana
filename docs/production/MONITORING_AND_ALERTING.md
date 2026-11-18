# Sana HRMS - Monitoring and Alerting Guide

**Version:** 1.0  
**Date:** 2026-11-18  
**Audience:** DevOps Engineers, SREs, Operations Team  

---

## 1. Monitoring Architecture

### 1.1 Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Sana HRMS Observability Stack                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │  Backend     │    │  Frontend    │    │  Database    │      │
│  │  (NestJS)    │    │  (React)     │    │  (PostgreSQL)│      │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘      │
│         │                   │                   │              │
│         ▼                   ▼                   ▼              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    OpenTelemetry Collector                │  │
│  │  (Metrics, Logs, Traces)                                 │  │
│  └──────────────────────────┬───────────────────────────────┘  │
│                             │                                   │
│         ┌───────────────────┼───────────────────┐              │
│         ▼                   ▼                   ▼              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │  Prometheus  │    │    Loki      │    │   Tempo      │      │
│  │  (Metrics)   │    │  (Logs)      │    │  (Traces)    │      │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘      │
│         │                   │                   │              │
│         └───────────────────┼───────────────────┘              │
│                             ▼                                   │
│                    ┌──────────────┐                             │
│                    │   Grafana    │                             │
│                    │  (Dashboards)│                             │
│                    └──────┬───────┘                             │
│                             │                                   │
│                             ▼                                   │
│                    ┌──────────────┐                             │
│                    │ Alertmanager │                             │
│                    │  (Alerts)    │                             │
│                    └──────────────┘                             │
│                             │                                   │
│                    ┌────────┴────────┐                          │
│                    ▼                 ▼                          │
│             ┌───────────┐     ┌───────────┐                    │
│             │  Slack    │     │  Email    │                    │
│             │  PagerDuty│     │  Webhook  │                    │
│             └───────────┘     └───────────┘                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Metrics Collection

### 2.1 Backend Metrics (Prometheus)

**File:** `backend/src/common/monitoring/metrics.ts`

```typescript
import { Counter, Histogram, Gauge, Registry } from 'prom-client';

export const registry = new Registry();

// Default metrics
registry.setDefaultLabels({ app: 'sana-hrms-backend' });
collectDefaultMetrics({ register: registry, prefix: 'sana_' });

// HTTP Metrics
export const httpRequestsTotal = new Counter({
  name: 'sana_http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [registry],
});

export const httpRequestDuration = new Histogram({
  name: 'sana_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10],
  registers: [registry],
});

// Database Metrics
export const dbQueryDuration = new Histogram({
  name: 'sana_db_query_duration_seconds',
  help: 'Database query duration in seconds',
  labelNames: ['query_type', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [registry],
});

export const dbConnectionsActive = new Gauge({
  name: 'sana_db_connections_active',
  help: 'Active database connections',
  labelNames: ['pool'],
  registers: [registry],
});

// Business Metrics
export const activeUsers = new Gauge({
  name: 'sana_active_users',
  help: 'Currently active users (sessions in last 15 min)',
  registers: [registry],
});

export const activeEmployees = new Gauge({
  name: 'sana_active_employees',
  help: 'Active employees count',
  labelNames: ['company_id'],
  registers: [registry],
});

export const pendingApprovals = new Gauge({
  name: 'sana_pending_approvals',
  help: 'Pending approvals count',
  labelNames: ['type'],
  registers: [registry],
});

export const backupStatus = new Gauge({
  name: 'sana_backup_status',
  help: 'Backup status (1=success, 0=failed)',
  labelNames: ['database'],
  registers: [registry],
});

export const backupAge = new Gauge({
  name: 'sana_backup_age_hours',
  help: 'Hours since last successful backup',
  labelNames: ['database'],
  registers: [registry],
});
```

### 2.2 Metrics Interceptor

**File:** `backend/src/common/interceptors/metrics.interceptor.ts`

```typescript
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { httpRequestsTotal, httpRequestDuration } from '../monitoring/metrics';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const route = request.route?.path || request.url;
    const method = request.method;
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = (Date.now() - start) / 1000;
        const statusCode = context.switchToHttp().getResponse().statusCode;
        httpRequestsTotal.inc({ method, route, status_code: statusCode.toString() });
        httpRequestDuration.observe({ method, route, status_code: statusCode.toString() }, duration);
      }),
      catchError((error) => {
        const duration = (Date.now() - start) / 1000;
        const statusCode = error.status || 500;
        httpRequestsTotal.inc({ method, route, status_code: statusCode.toString() });
        httpRequestDuration.observe({ method, route, status_code: statusCode.toString() }, duration);
        throw error;
      }),
    );
  }
}
```

### 2.3 Database Metrics Middleware

**File:** `backend/src/common/prisma/prisma.service.ts` (add to constructor)

```typescript
import { dbQueryDuration, dbConnectionsActive } from '../monitoring/metrics';

// In PrismaService constructor, after super():
this.$use(async (params, next) => {
  const start = Date.now();
  const result = await next(params);
  const duration = (Date.now() - start) / 1000;
  
  dbQueryDuration.observe({ 
    query_type: params.action, 
    table: params.model || 'unknown' 
  }, duration);
  
  return result;
});

// Update connection gauge periodically
setInterval(async () => {
  try {
    const counts = await this.$queryRaw<{ count: bigint }[]>`
      SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()
    `;
    dbConnectionsActive.set({ pool: 'primary' }, Number(counts[0]?.count || 0));
  } catch {
    // Ignore
  }
}, 30000);
```

---

## 3. Logging

### 3.1 Structured Logging

**File:** `backend/src/common/interceptors/logging.interceptor.ts`

```typescript
import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { randomUUID } from 'crypto';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, ip, headers } = request;
    const userAgent = headers['user-agent'];
    const requestId = headers['x-request-id'] || randomUUID();
    
    // Add to request for downstream use
    request.requestId = requestId;

    const start = Date.now();
    const userId = request.user?.id || 'anonymous';

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start;
        const statusCode = context.switchToHttp().getResponse().statusCode;
        this.logger.log(`${method} ${url} ${statusCode} ${duration}ms`, {
          requestId, ip, userAgent, duration, statusCode, userId,
          // Don't log sensitive data
        });
      }),
      catchError((error) => {
        const duration = Date.now() - start;
        this.logger.error(`${method} ${url} ${error.status || 500} ${duration}ms`, {
          requestId, ip, userAgent, duration, error: error.message, stack: error.stack,
        });
        throw error;
      }),
    );
  }
}
```

### 3.2 Log Format (JSON for Loki)

**File:** `backend/src/main.ts` (add to bootstrap)

```typescript
import { Logger } from '@nestjs/common';

// Configure JSON logging for production
if (config.get<string>('app.env') === 'production') {
  const originalLog = console.log;
  const originalError = console.error;
  
  console.log = (...args) => {
    originalLog(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '),
    }));
  };
  
  console.error = (...args) => {
    originalError(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'error',
      message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '),
    }));
  };
}
```

### 3.3 Loki Configuration

**File:** `monitoring/loki-config.yml`

```yaml
auth_enabled: false

server:
  http_listen_port: 3100
  grpc_listen_port: 9096

ingester:
  wal:
    enabled: true
    dir: /tmp/loki/wal
  lifecycler:
    address: 127.0.0.1
    ring:
      kvstore:
        store: inmemory
      replication_factor: 1
    final_sleep: 0s
  chunk_idle_period: 5m
  chunk_retain_period: 30s
  max_transfer_retries: 0

schema_config:
  configs:
    - from: 2024-01-01
      store: boltdb-shipper
      object_store: filesystem
      schema: v11
      index:
        prefix: index_
        period: 24h

storage_config:
  boltdb_shipper:
    active_index_directory: /tmp/loki/boltdb-shipper-active
    cache_location: /tmp/loki/boltdb-shipper-cache
    cache_ttl: 24h
    shared_store: filesystem
  filesystem:
    directory: /tmp/loki/chunks

limits_config:
  reject_old_samples: true
  reject_old_samples_max_age: 168h
```

---

## 4. Distributed Tracing

### 4.1 OpenTelemetry Setup

**File:** `backend/src/main.ts` (add early in bootstrap)

```typescript
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import { PrismaInstrumentation } from '@prisma/instrumentation';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';

if (config.get<string>('app.env') === 'production') {
  const provider = new NodeTracerProvider();
  
  provider.addSpanProcessor(new BatchSpanProcessor(new JaegerExporter({
    endpoint: 'http://jaeger:14268/api/traces',
  })));
  
  provider.register();
  
  registerInstrumentations({
    instrumentations: [
      new HttpInstrumentation(),
      new ExpressInstrumentation(),
      new NestInstrumentation(),
      new PrismaInstrumentation(),
      new PgInstrumentation(),
    ],
  });
}
```

---

## 5. Alerting Rules

### 5.1 Prometheus Alert Rules

**File:** `monitoring/alerts.yml`

```yaml
groups:
  - name: sana-hrms-critical
    interval: 30s
    rules:
      # Service Availability
      - alert: ServiceDown
        expr: up{job="sana-backend"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Sana HRMS Backend is down"
          description: "Backend service has been down for more than 1 minute"
          runbook_url: "https://wiki.sana-hrms.com/runbooks/service-down"

      - alert: FrontendDown
        expr: up{job="sana-frontend"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Sana HRMS Frontend is down"

      # Database
      - alert: DatabaseDown
        expr: up{job="postgres"} == 0
        for: 30s
        labels:
          severity: critical
        annotations:
          summary: "PostgreSQL is down"

      - alert: DatabaseConnectionPoolHigh
        expr: sana_db_connections_active / 100 > 0.8
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Database connection pool > 80% utilized"

      # API Health
      - alert: HighErrorRate
        expr: |
          sum(rate(sana_http_requests_total{status_code=~"5.."}[5m])) 
          / sum(rate(sana_http_requests_total[5m])) > 0.05
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "API error rate > 5%"

      - alert: HighLatency
        expr: |
          histogram_quantile(0.95, 
            sum(rate(sana_http_request_duration_seconds_bucket[5m])) by (le, route)
          ) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "API p95 latency > 2 seconds"

      # Business Metrics
      - alert: BackupFailed
        expr: increase(sana_backup_status{database="sana_hrms"}[1h]) == 0 and sana_backup_status == 0
        for: 0m
        labels:
          severity: critical
        annotations:
          summary: "Database backup failed"

      - alert: BackupTooOld
        expr: sana_backup_age_hours{database="sana_hrms"} > 36
        for: 0m
        labels:
          severity: warning
        annotations:
          summary: "Last backup older than 36 hours"

      - alert: PendingApprovalsHigh
        expr: sana_pending_approvals > 1000
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High number of pending approvals"

      # Infrastructure
      - alert: DiskSpaceCritical
        expr: (node_filesystem_avail_bytes / node_filesystem_size_bytes) < 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Disk space < 10%"

      - alert: MemoryHigh
        expr: (container_memory_usage_bytes / container_spec_memory_limit_bytes) > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Container memory > 90%"

      - alert: CPUHigh
        expr: rate(container_cpu_usage_seconds_total[5m]) > 0.85
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Container CPU > 85%"

      - alert: ContainerRestartLoop
        expr: rate(container_restart_count[15m]) > 0.1
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Container restarting frequently"

  - name: sana-hrms-security
    interval: 1m
    rules:
      - alert: RepeatedAuthFailures
        expr: increase(sana_http_requests_total{route=~".*/auth/login",status_code="401"}[5m]) > 20
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: "High authentication failure rate - possible brute force"

      - alert: UnauthorizedAccessAttempts
        expr: increase(sana_http_requests_total{status_code="403"}[5m]) > 50
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High unauthorized access attempts"

      - alert: AuditLogFailures
        expr: increase(sana_audit_log_failures_total[5m]) > 0
        for: 0m
        labels:
          severity: critical
        annotations:
          summary: "Audit logging failures - sensitive operations blocked"
```

---

## 6. Alertmanager Configuration

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

receivers:
  - name: 'default'
    email_configs:
      - to: 'team@sana-hrms.com'
        send_resolved: true
    slack_configs:
      - api_url: '${SLACK_WEBHOOK_URL}'
        channel: '#alerts'
        title: '{{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.summary }}\n{{ end }}'

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

  - name: 'warning-alerts'
    email_configs:
      - to: 'team@sana-hrms.com'
        send_resolved: true
    slack_configs:
      - api_url: '${SLACK_WEBHOOK_URL}'
        channel: '#alerts-warning'
        title: '⚠️ WARNING: {{ .GroupLabels.alertname }}'
        color: 'warning'

  - name: 'backup-alerts'
    email_configs:
      - to: 'dba@sana-hrms.com, team@sana-hrms.com'
        send_resolved: true
    slack_configs:
      - api_url: '${SLACK_WEBHOOK_URL}'
        channel: '#alerts-backup'
        title: '💾 BACKUP: {{ .GroupLabels.alertname }}'

inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname', 'instance']
```

---

## 7. Grafana Dashboards

### 7.1 System Overview Dashboard

```json
{
  "dashboard": {
    "title": "Sana HRMS - System Overview",
    "tags": ["sana-hrms", "overview"],
    "timezone": "browser",
    "panels": [
      {
        "title": "Request Rate (RPS)",
        "type": "graph",
        "gridPos": {"x": 0, "y": 0, "w": 12, "h": 8},
        "targets": [
          { "expr": "rate(sana_http_requests_total[1m])", "legendFormat": "{{method}} {{route}}" }
        ]
      },
      {
        "title": "Latency (p50, p95, p99)",
        "type": "graph",
        "gridPos": {"x": 12, "y": 0, "w": 12, "h": 8},
        "targets": [
          { "expr": "histogram_quantile(0.50, sum(rate(sana_http_request_duration_seconds_bucket[5m])) by (le, route))", "legendFormat": "p50" },
          { "expr": "histogram_quantile(0.95, sum(rate(sana_http_request_duration_seconds_bucket[5m])) by (le, route))", "legendFormat": "p95" },
          { "expr": "histogram_quantile(0.99, sum(rate(sana_http_request_duration_seconds_bucket[5m])) by (le, route))", "legendFormat": "p99" }
        ]
      },
      {
        "title": "Error Rate",
        "type": "graph",
        "gridPos": {"x": 0, "y": 8, "w": 12, "h": 8},
        "targets": [
          { "expr": "rate(sana_http_requests_total{status_code=~\"5..\"}[5m])", "legendFormat": "5xx" },
          { "expr": "rate(sana_http_requests_total{status_code=~\"4..\"}[5m])", "legendFormat": "4xx" }
        ]
      },
      {
        "title": "Database Connections",
        "type": "graph",
        "gridPos": {"x": 12, "y": 8, "w": 12, "h": 8},
        "targets": [
          { "expr": "sana_db_connections_active", "legendFormat": "Active Connections" }
        ]
      },
      {
        "title": "Cache Hit Rate",
        "type": "gauge",
        "gridPos": {"x": 0, "y": 16, "w": 6, "h": 6},
        "targets": [
          { "expr": "rate(sana_cache_hits_total[5m]) / (rate(sana_cache_hits_total[5m]) + rate(sana_cache_misses_total[5m]))", "legendFormat": "Hit Rate" }
        ]
      },
      {
        "title": "Active Users",
        "type": "stat",
        "gridPos": {"x": 6, "y": 16, "w": 6, "h": 6},
        "targets": [
          { "expr": "sana_active_users", "legendFormat": "Active Users" }
        ]
      },
      {
        "title": "Backup Status",
        "type": "stat",
        "gridPos": {"x": 12, "y": 16, "w": 6, "h": 6},
        "targets": [
          { "expr": "sana_backup_status{database=\"sana_hrms\"}", "legendFormat": "Backup OK" }
        ]
      },
      {
        "title": "Backup Age (hours)",
        "type": "stat",
        "gridPos": {"x": 18, "y": 16, "w": 6, "h": 6},
        "targets": [
          { "expr": "sana_backup_age_hours{database=\"sana_hrms\"}", "legendFormat": "Hours Since Backup" }
        ]
      }
    ]
  }
}
```

---

## 8. Health Check Endpoints

### 8.1 Backend Health Endpoints

| Endpoint | Purpose | Checks |
|----------|---------|--------|
| `GET /api/v1/health` | Full health | DB, Migrations, Disk, Frontend |
| `GET /api/v1/health/ready` | Readiness probe | DB, Migrations, Disk |
| `GET /api/v1/health/live` | Liveness probe | DB only |

### 8.2 Frontend Health Endpoint

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Returns 200 "healthy" |

### 8.3 Kubernetes Probes

```yaml
livenessProbe:
  httpGet:
    path: /api/v1/health/live
    port: 4114
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /api/v1/health/ready
    port: 4114
  initialDelaySeconds: 10
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3
```

---

## 9. Runbook: Common Incidents

| Incident | Symptoms | Diagnosis | Resolution |
|----------|----------|-----------|------------|
| **High API Latency** | p95 > 2s | Check DB slow queries, connection pool, CPU | Scale DB, optimize queries, increase pool |
| **High Error Rate** | 5xx > 5% | Check logs, recent deployments | Rollback, fix bug, scale |
| **DB Connection Exhaustion** | Pool usage > 80% | Check `sana_db_connections_active` | Increase pool size, fix connection leaks |
| **High Memory** | > 90% | Check heap dumps, GC | Restart, fix memory leaks |
| **High CPU** | > 85% | Check CPU profiling | Optimize queries, scale |
| **Slow Queries** | p95 > 1s | Check `pg_stat_statements` | Add indexes, optimize queries |
| **Backup Failed** | Alert fired | Check backup service logs, disk space | Fix root cause, re-run backup |
| **Disk Space Critical** | < 10% free | Check logs, backups, uploads | Cleanup, expand volume |

---

## 10. SLO Definitions

| Service | SLI | SLO | Measurement Window |
|---------|-----|-----|-------------------|
| **API Availability** | Successful requests / Total requests | 99.9% | 30 days |
| **API Latency (p95)** | Request duration | < 500ms | 30 days |
| **API Latency (p99)** | Request duration | < 2s | 30 days |
| **Frontend Availability** | Successful page loads | 99.95% | 30 days |
| **Database Availability** | Successful connections | 99.99% | 30 days |
| **Backup Success** | Successful backups / Scheduled | 100% | 30 days |
| **Auth Success** | Successful logins / Attempts | 99.5% | 30 days |

---

**Document Version:** 1.0  
**Last Updated:** 2026-11-18  
**Next Review:** Sprint Planning  
**Owner:** DevOps / SRE Team