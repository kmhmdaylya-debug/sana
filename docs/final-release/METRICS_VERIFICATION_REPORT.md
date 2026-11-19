# Sana HRMS - Metrics Verification Report

**Version:** 1.0  
**Date:** 2026-11-19  
**Auditor:** Independent Release Auditor  
**Classification:** CONFIDENTIAL  

---

## 1. Executive Summary

This report verifies the actual behavior of the implemented metrics through code inspection and configuration validation. It does NOT rely on running production systems but inspects the implementation code and configuration.

**Overall:** 7/7 metrics implemented in code; 4/7 fully functional; 3 require integration work.

---

## 2. Code-Level Verification

### 2.1 MetricsService Registration

**File:** `backend/src/common/monitoring/metrics.service.ts`

```typescript
// Registry creation
private readonly registry: Registry;

// All 7 metrics registered to same registry
this.httpRequestsTotal = new Counter({..., registers: [this.registry]});
this.httpRequestDuration = new Histogram({..., registers: [this.registry]});
this.dbQueryDuration = new Histogram({..., registers: [this.registry]});
this.dbConnectionsActive = new Gauge({..., registers: [this.registry]});
this.backupStatus = new Gauge({..., registers: [this.registry]});
this.backupAgeHours = new Gauge({..., registers: [this.registry]});
this.workflowCompletionTotal = new Counter({..., registers: [this.registry]});
```

✅ All 7 metrics registered to same Prometheus registry.

### 2.2 Metrics Interceptor (Global)

**File:** `backend/src/common/monitoring/metrics.interceptor.ts`

```typescript
// Applied globally via APP_INTERCEPTOR in AppModule
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const startTime = process.hrtime.bigint();
    const route = this.normalizeRoute(request.route?.path ?? request.path);
    
    return next.handle().pipe(
      tap({
        next: () => {
          const durationSeconds = Number(process.hrtime.bigint() - startTime) / 1e9;
          this.metricsService.incrementHttpRequests(method, route, statusCode);
          this.metricsService.observeHttpDuration(method, route, statusCode, durationSeconds);
        },
        error: (error) => {
          // Records error status codes
          this.metricsService.incrementHttpRequests(method, route, error.status ?? 500);
          this.metricsService.observeHttpDuration(method, route, error.status ?? 500, durationSeconds);
        },
      }),
    );
  }
}
```

**Verification:**
- ✅ Applied globally via `APP_INTERCEPTOR` in AppModule
- ✅ Normalizes routes (UUIDs → `:uuid`, IDs → `:id`, tokens → `:token`)
- ✅ Records both success and error paths
- ✅ Uses high-resolution timer (`process.hrtime.bigint()`)

### 2.3 Prisma Metrics Middleware

**File:** `backend/src/common/monitoring/prisma-metrics.middleware.ts`

```typescript
export function createPrismaMetricsMiddleware(metricsService: any) {
  return async (params: any, next: (params: any) => Promise<any>) => {
    const startTime = process.hrtime.bigint();
    const model = params.model ?? 'unknown';
    const action = params.action;
    
    try {
      return await next(params);
    } finally {
      const durationSeconds = Number(process.hrtime.bigint() - startTime) / 1e9;
      const queryType = mapActionToQueryType(action);
      const table = model;
      metricsService.observeDbQueryDuration(queryType, table, durationSeconds);
    }
  };
}
```

**Applied in:** `PrismaService` constructor via `applyMetricsMiddleware(this, this.metricsService)`

**Query Type Mapping:**
| Prisma Action | Query Type |
|--------------|------------|
| findUnique, findFirst, findMany | select |
| create, createMany | insert |
| update, updateMany, upsert | update |
| delete, deleteMany | delete |
| count | count |
| aggregate, groupBy | aggregate |
| $queryRaw, $executeRaw | raw |
| $transaction | transaction |

### 2.4 Backup Service Integration

**File:** `backend/src/backup/backup.service.ts`

```typescript
async runBackup(user: AuthenticatedUser) {
  // ... backup logic ...
  
  // Update backup metrics
  this.metrics.setBackupStatus('sana_hrms', true);
  this.metrics.setBackupAgeHours('sana_hrms', 0);
  
  // On failure:
  this.metrics.setBackupStatus('sana_hrms', false);
}
```

**Gap:** `setBackupAgeHours('sana_hrms', 0)` resets to 0 but no mechanism increments it over time.

---

## 3. Prometheus Configuration Verification

### 3.1 Scrape Configuration

**File:** `monitoring/prometheus.yml`

```yaml
scrape_configs:
  - job_name: 'sana-backend'
    metrics_path: '/metrics'           # ✅ Correct path
    static_configs:
      - targets: ['backend:4114']      # ✅ Internal DNS name
        labels:
          service: 'sana-backend'
```

**Issue:** Frontend job configured but frontend doesn't expose `/metrics`:
```yaml
- job_name: 'sana-frontend'
  metrics_path: '/metrics'
  static_configs:
    - targets: ['frontend:8080']  # ❌ Frontend has no /metrics endpoint
```

### 3.2 Alert Rules Reference

**File:** `monitoring/alerts.yml`

All alerts reference correctly implemented metrics except:
- `sana_db_connections_active` - gauge not updated (divisor uses 100, should be 200)
- `sana_backup_age_hours` - not auto-updated
- `sana_pending_approvals` - not implemented
- `sana_audit_log_failures_total` - not implemented

---

## 3. Label Cardinality Analysis

| Metric | Labels | Cardinality Risk |
|------|--------|------------------|
| `sana_http_requests_total` | method, route, status_code | Low (route normalized) |
| `sana_http_request_duration_seconds` | method, route, status_code | Low |
| `sana_db_query_duration_seconds` | query_type, table | Low (~50 tables) |
| `sana_db_connections_active` | pool | Very low |
| `sana_backup_status` | database | Very low |
| `sana_backup_age_hours` | database | Very low |
| `sana_workflow_completion_total` | workflow, status | Low |

**Route Normalization:** `metrics.interceptor.ts:46-52`
```typescript
normalizeRoute(path: string): string {
  return path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:uuid')
    .replace(/\/[0-9]+/g, '/:id')
    .replace(/\/[a-zA-Z0-9_-]{20,}/g, '/:token');
}
```
✅ Prevents high cardinality from UUIDs and IDs.

---

## 4. Security and Privacy

| Metric | Sensitive Data in Labels | Risk |
|------|------------------------|------|
| `sana_http_requests_total` | route (normalized), method, status | None |
| `sana_http_request_duration_seconds` | route (normalized) | None |
| `sana_db_query_duration_seconds` | table name | Low (schema info) |
| `sana_db_connections_active` | pool name | None |
| `sana_backup_status` | database name | None |
| `sana_backup_age_hours` | database name | None |
| `sana_workflow_completion_total` | workflow name | Low |

✅ No sensitive data (PII, tokens, IDs) in metric labels.

---

## 5. Missing Metrics from SLI_SLO_DEFINITIONS.md

| Missing Metric | Required For | Status |
|-------------|--------------|--------|
| `sana_active_users` | SLO-A2 | ❌ Not implemented |
| `sana_pending_approvals` | Alert rule | ❌ Not implemented |
| `sana_audit_log_failures_total` | Alert rule | ❌ Not implemented |

---

## 6. Verification Checklist

| Check | Result | Evidence |
|-------|--------|----------|
| All 7 metrics registered | ✅ PASS | metrics.service.ts |
| Global interceptor registered | ✅ PASS | app.module.ts |
| Prisma middleware applied | ✅ PASS | prisma.service.ts |
| Backup service updates metrics | ✅ PASS | backup.service.ts |
| Prometheus scrape config correct | ✅ PASS | prometheus.yml |
| Alert rules reference valid metrics | ⚠️ PARTIAL | alerts.yml (3 refs invalid) |
| Label cardinality controlled | ✅ PASS | normalizeRoute() |
| No PII in labels | ✅ PASS | Code inspection |
| Metrics endpoint accessible | ⚠️ UNTESTED | /metrics endpoint |
| Frontend metrics endpoint | ❌ MISSING | Frontend has no /metrics |

---

## 5. Conclusion

**Metrics Implementation:** ✅ **7/7 core metrics implemented in code**

**Fully Functional (4/7):**
- `sana_http_requests_total` ✅
- `sana_http_request_duration_seconds` ✅
- `sana_db_query_duration_seconds` ✅
- `sana_backup_status` ✅

**Partially Functional (3/7):**
- `sana_db_connections_active` - Gauge exists but not updated
- `sana_backup_age_hours` - Reset on backup but not auto-incremented
- `sana_workflow_completion_total` - Counter exists but not called

**Missing (3):**
- `sana_active_users` 
- `sana_pending_approvals`
- `sana_audit_log_failures_total`

**Critical Fixes Needed:**
1. Add periodic DB connection pool monitoring
2. Implement backup age auto-increment (cron job)
3. Integrate workflow completion counter in business services
4. Fix alert divisor: `sana_db_connections_active / 200` (not 100)

---

**Document Version:** 1.0  
**Date:** 2026-11-19  
**Auditor:** Independent Release Auditor  
**Classification:** CONFIDENTIAL