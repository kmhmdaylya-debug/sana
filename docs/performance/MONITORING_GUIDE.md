# Sana HRMS - Monitoring Guide

**Version:** 1.0  
**Date:** 2026-11-18  
**Audience:** DevOps Engineers, SREs, Performance Engineers  

---

## 1. Monitoring Stack Overview

### 1.1 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Sana HRMS Monitoring                      │
├─────────────────────────────────────────────────────────────┤
│  Frontend (React)          │  Backend (NestJS)              │
│  ├── Web Vitals            │  ├── HTTP Metrics              │
│  ├── Resource Timing       │  ├── DB Query Metrics          │
│  ├── Error Tracking        │  ├── Cache Metrics             │
│  └── User Interactions     │  ├── Queue Metrics             │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Monitoring Stack                          │
├─────────────────────────────────────────────────────────────┤
│  Prometheus ← Metrics Collection                            │
│  Grafana ← Visualization                                    │
│  Loki ← Log Aggregation                                     │
│  Tempo ← Distributed Tracing                                │
│  AlertManager ← Alerting                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Metrics Collection

### 2.1 Backend Metrics (Prometheus)

```typescript
// backend/src/common/monitoring/metrics.ts
import { Counter, Histogram, Gauge, Registry } from 'prom-client';

export const metrics = {
  // HTTP Metrics
  httpRequestsTotal: new Counter({
    name: 'http_requests_total',
    help: 'Total HTTP requests',
    labelNames: ['method', 'route', 'status'],
    registers: [registry],
  }),
  
  httpRequestDuration: new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.01, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10],
    registers: [registry],
  }),
  
  // Database Metrics
  dbQueryDuration: new Histogram({
    name: 'db_query_duration_seconds',
    help: 'Database query duration in seconds',
    labelNames: ['query_type', 'table'],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
    registers: [registry],
  }),
  
  dbConnectionsActive: new Gauge({
    name: 'db_connections_active',
    help: 'Active database connections',
    labelNames: ['pool'],
    registers: [registry],
  }),
  
  // Cache Metrics
  cacheHits: new Counter({
    name: 'cache_hits_total',
    help: 'Cache hits',
    labelNames: ['cache_name'],
    registers: [registry],
  }),
  
  cacheMisses: new Counter({
    name: 'cache_misses_total',
    help: 'Cache misses',
    labelNames: ['cache_name'],
    registers: [registry],
  }),
  
  // Business Metrics
  activeUsers: new Gauge({
    name: 'active_users',
    help: 'Currently active users',
    registers: [registry],
  }),
  
  activeEmployees: new Gauge({
    name: 'active_employees',
    help: 'Active employees count',
    labelNames: ['company_id'],
    registers: [registry],
  }),
  
  pendingApprovals: new Gauge({
    name: 'pending_approvals',
    help: 'Pending approvals count',
    labelNames: ['type'],
    registers: [registry],
  },
};

export const registry = new Registry();
metrics.register = registry;
```

### 2.2 Metrics Interceptor

```typescript
// backend/src/common/interceptors/metrics.interceptor.ts
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const start = Date.now();
    const route = request.route?.path || request.url;
    const method = request.method;
    
    return next.handle().pipe(
      tap(() => {
        const duration = (Date.now() - start) / 1000;
        metrics.httpRequestDuration.observe({ method, route, status: 'success' }, duration);
        metrics.httpRequestsTotal.inc({ method, route, status: 'success' });
      }),
      catchError((error) => {
        const duration = (Date.now() - start) / 1000;
        metrics.httpRequestDuration.observe({ method, route, status: 'error' }, duration);
        metrics.httpRequestsTotal.inc({ method, route, status: 'error' });
        throw error;
      }),
    );
  }
}
```

---

## 3. Database Monitoring

### 2.1 Prisma Query Metrics

```typescript
// backend/src/common/prisma/prisma.service.ts
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly config: ConfigService) {
    super({
      datasources: { db: { url: config.get<string>('app.database.url') } },
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
    
    // Middleware for query metrics
    this.$use(async (params, next) => {
      const start = Date.now();
      const result = await next(params);
      const duration = (Date.now() - start) / 1000;
      
      metrics.dbQueryDuration.observe({ 
        query_type: params.action, 
        table: params.model || 'unknown' 
      }, duration);
      
      return result;
    });
  }
  
  async onModuleInit() {
    await this.$connect();
  }
}
```

---

## 3. Frontend Monitoring

### 3.1 Web Vitals Collection

```typescript
// frontend/src/lib/web-vitals.ts
import { onCLS, onFID, onLCP, onFCP, onTTFB, onINP } from 'web-vitals';

export function initWebVitals() {
  onCLS(metric => sendToAnalytics('CLS', metric.value));
  onFID(metric => sendToAnalytics('FID', metric.value));
  onLCP(metric => sendToAnalytics('LCP', metric.value));
  onFCP(metric => sendToAnalytics('FCP', metric.value));
  onTTFB(metric => sendToAnalytics('TTFB', metric.value));
  onINP(metric => sendToAnalytics('INP', metric.value));
  
  function sendToAnalytics(name: string, value: number) {
    if (window.gtag) window.gtag('event', name, { value: Math.round(value) });
    console.log(`[Web Vital] ${name}: ${value.toFixed(2)}`);
  }
}

// App.tsx
function App() {
  useEffect(() => {
    initWebVitals();
  }, []);
  
  return <AppContent />;
}
```

### 3.2 Resource Timing

```typescript
// frontend/src/lib/rum.ts
export function initRUM() {
  // Page load timing
  window.addEventListener('load', () => {
    setTimeout(() => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      sendToAnalytics('page_load', {
        dns: nav.domainLookupEnd - nav.domainLookupStart,
        tcp: nav.connectEnd - nav.connectStart,
        tls: nav.secureConnectionStart ? nav.connectEnd - nav.secureConnectionStart : 0,
        ttfb: nav.responseStart - nav.requestStart,
        download: nav.responseEnd - nav.responseStart,
        dom: nav.domComplete - nav.domInteractive,
        load: nav.loadEventEnd - nav.loadEventStart,
      });
    }, 0);
  });
  
  // Resource timing
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.entryType === 'resource') {
        sendToAnalytics('resource_timing', {
          name: entry.name,
          duration: entry.duration,
          size: (entry as any).transferSize,
        });
      }
    });
  });
  observer.observe({ entryTypes: ['resource', 'navigation'] });
}
```

---

## 4. Logging & Log Aggregation

### 2.1 Structured Logging

```typescript
// backend/src/common/interceptors/logging.interceptor.ts
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);
  
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, ip, headers } = request;
    const userAgent = headers['user-agent'];
    const requestId = headers['x-request-id'] || crypto.randomUUID();
    
    const start = Date.now();
    
    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start;
        this.logger.log(`${method} ${url} ${duration}ms`, { 
          requestId, ip, userAgent, duration, statusCode: 200 
        });
      }),
      catchError((error) => {
        const duration = Date.now() - start;
        this.logger.error(`${method} ${url} ${duration}ms`, { 
          requestId, ip, userAgent, duration, error: error.message, statusCode: error.status 
        });
        throw error;
      }),
    );
  }
}
```

### 4.2 Loki Configuration

```yaml
# loki-config.yml
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

## 5. Distributed Tracing

### 5.1 Tempo Configuration

```yaml
# tempo.yaml
server:
  http_listen_port: 3200

distributor:
  receivers:
    otlp:
      protocols:
        grpc:
        http:

ingester:
  trace_idle_period: 10s
  max_block_duration: 5m
  max_block_bytes: 1_000_000

storage:
  trace:
    backend: local
    local:
      path: /tmp/tempo
    wal:
      path: /tmp/tempo/wal
      encoding: snappy

compactor:
  compaction:
    block_retention: 1h
    compacted_block_retention: 10m
    retention: 48h
```

### 5.2 OpenTelemetry Instrumentation

```typescript
// backend/src/main.ts
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import { PrismaInstrumentation } from '@prisma/instrumentation';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';

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
```

---

## 6. Alerting

### 6.1 AlertManager Configuration

```yaml
# alertmanager.yml
global:
  resolve_timeout: 5m
  smtp_smarthost: 'smtp.gmail.com:587'
  smtp_from: 'alerts@sana-hrms.com'
  smtp_auth_username: 'alerts@sana-hrms.com'
  smtp_auth_password: '${SMTP_PASSWORD}'

route:
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'default'
  routes:
    - match:
        severity: critical
      receiver: 'critical-alerts'
      continue: true
    - match:
        severity: warning
      receiver: 'warning-alerts'

receivers:
  - name: 'default'
    email_configs:
      - to: 'team@sana-hrms.com'
        send_resolved: true
  
  - name: 'critical-alerts'
    email_configs:
      - to: 'oncall@sana-hrms.com'
        send_resolved: true
    slack_configs:
      - api_url: '${SLACK_WEBHOOK_URL}'
        channel: '#alerts-critical'
        title: '🚨 Critical Alert: {{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.summary }}\n{{ end }}'
  
  - name: 'warning-alerts'
    email_configs:
      - to: 'team@sana-hrms.com'
        send_resolved: true
    slack_configs:
      - api_url: '${SLACK_WEBHOOK_URL}'
        channel: '#alerts-warning'
```

---

## 7. Health Checks

### 7.1 Comprehensive Health Checks

```typescript
// backend/src/health/health.controller.ts
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: DatabaseHealthIndicator,
    private readonly http: HttpHealthIndicator,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.isHealthy('database'),
      () => this.db.migrationStatus('migrations'),
      () => this.http.pingCheck('frontend', this.config.get<string>('CORS_ORIGINS')?.split(',')[0] ?? 'http://localhost:5183'),
    ]);
  }

  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([
      () => this.db.isHealthy('database'),
      () => this.db.migrationStatus('migrations'),
    ]);
  }

  @Get('live')
  @HealthCheck()
  live() {
    return this.health.check([
      () => this.db.isHealthy('database'),
    ]);
  }
}
```

### Database Health Indicator

```typescript
// backend/src/health/database.health.ts
@Injectable()
export class DatabaseHealthIndicator {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async isHealthy(key: string) {
    try {
      const start = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      const latency = Date.now() - start;
      
      return {
        [key]: {
          status: latency < 5000 ? 'up' : 'degraded',
          latency: `${latency}ms`,
        },
      };
    } catch (error) {
      return {
        [key]: {
          status: 'down',
          error: error.message,
        },
      };
    }
  }

  async migrationStatus(key: string) {
    try {
      const migrations = await this.prisma.$queryRaw<Array<{ name: string; applied: boolean }>>`
        SELECT name, applied_at IS NOT NULL as applied
        FROM "_prisma_migrations"
        ORDER BY finished_at DESC
      `;

      const pending = migrations.filter(m => !m.applied).length;
      const isHealthy = pending === 0;

      return {
        [key]: {
          status: isHealthy ? 'up' : 'degraded',
          pendingMigrations: pending,
          totalMigrations: migrations.length,
        },
      };
    } catch (error) {
      return {
        [key]: {
          status: 'up',
          note: 'Migration table not found (fresh DB)',
        },
      };
    }
  }
}
```

---

## 7. Dashboard Templates

### 7.1 Grafana Dashboard JSON

```json
{
  "dashboard": {
    "title": "Sana HRMS - System Overview",
    "panels": [
      {
        "title": "Request Rate (RPS)",
        "type": "graph",
        "targets": [
          { "expr": "rate(http_requests_total[1m])", "legendFormat": "{{method}} {{route}}" }
        ]
      },
      {
        "title": "Latency (p50, p95, p99)",
        "type": "graph",
        "targets": [
          { "expr": "histogram_quantile(0.50, rate(http_request_duration_seconds_bucket[5m]))", "legendFormat": "p50" },
          { "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))", "legendFormat": "p95" },
          { "expr": "histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))", "legendFormat": "p99" }
        ]
      },
      {
        "title": "Error Rate",
        "type": "graph",
        "targets": [
          { "expr": "rate(http_requests_total{status=~\"5..\"}[5m])", "legendFormat": "5xx" },
          { "expr": "rate(http_requests_total{status=~\"4..\"}[5m])", "legendFormat": "4xx" }
        ]
      },
      {
        "title": "Database Connections",
        "type": "graph",
        "targets": [
          { "expr": "pgbouncer_pool_usage", "legendFormat": "Pool Usage" },
          { "expr": "pgbouncer_pool_size", "legendFormat": "Pool Size" }
        ]
      },
      {
        "title": "Cache Hit Rate",
        "type": "graph",
        "targets": [
          { "expr": "rate(cache_hits_total[5m]) / (rate(cache_hits_total[5m]) + rate(cache_misses_total[5m]))", "legendFormat": "Hit Rate" }
        ]
      },
      {
        "title": "Database Query Latency",
        "type": "graph",
        "targets": [
          { "expr": "histogram_quantile(0.95, rate(db_query_duration_seconds_bucket[5m]))", "legendFormat": "p95" }
        ]
      }
    ]
  }
}
```

---

## 8. Runbook

### 9.1 Common Incidents

| Incident | Symptoms | Diagnosis | Resolution |
|----------|----------|-----------|------------|
| High API Latency | p95 > 1s | Check DB slow queries, connection pool, CPU | Scale DB, optimize queries, increase pool |
| High Error Rate | 5xx > 5% | Check logs, recent deployments | Rollback, fix bug, scale |
| DB Connection Exhaustion | Pool usage > 80% | Check pgbouncer_pool_usage | Increase pool size, fix connection leaks |
| High Memory | > 85% | Check heap dumps, GC | Restart, fix memory leaks |
| High CPU | > 85% | Check CPU profiling | Optimize queries, scale |
| Slow Queries | p95 > 1s | Check pg_stat_statements | Add indexes, optimize queries |
| High Memory (Frontend) | > 100MB growth/hr | Chrome DevTools | Fix memory leaks |

---

**Document Version:** 1.0  
**Last Updated:** 2026-11-18  
**Next Review:** Sprint Planning  
**Owner:** DevOps / SRE Team