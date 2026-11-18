# Sana HRMS - Load Testing Guide

**Version:** 1.0  
**Date:** 2026-11-18  
**Audience:** Performance Engineers, QA Engineers, DevOps  

---

## 1. Overview

This guide covers load testing methodology, tools, scenarios, and analysis for Sana HRMS.

### Tools Used
- **k6**: Primary load testing tool
- **autocannon**: Quick HTTP benchmarking
- **Prometheus + Grafana**: Metrics collection & visualization
- **Lighthouse CI**: Frontend performance

---

## 2. k6 Load Testing

### 2.1 Installation

```bash
# Windows
choco install k6

# Linux/macOS
brew install k6
# or
sudo apt-get install k6
```

### 2.2 Test Scripts

#### 2.1.1 Basic Load Test (`k6/load-test.js`)

```javascript
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const loginDuration = new Trend('login_duration');
const dashboardDuration = new Trend('dashboard_duration');
const employeeListDuration = new Trend('employee_list_duration');

export const options = {
  stages: [
    { duration: '2m', target: 10 },    // Warm up
    { duration: '5m', target: 50 },    // Ramp to 50 users
    { duration: '10m', target: 100 },  // Ramp to 100 users
    { duration: '10m', target: 100 },  // Sustained load
    { duration: '5m', target: 200 },   // Stress test
    { duration: '5m', target: 0 },     // Cool down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
    login_duration: ['p(95)<500'],
    dashboard_duration: ['p(95)<800'],
    employee_list_duration: ['p(95)<400'],
    errors: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4114';

export default function () {
  const loginRes = http.post(`${BASE_URL}/api/v1/auth/login`, 
    JSON.stringify({ username: 'admin', password: 'E7HHpQcEFezE4OAa1!' }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  
  check(loginRes, {
    'login status 200': (r) => r.status === 200,
    'has access token': (r) => r.json('data.accessToken') !== undefined,
  }) || errorRate.add(1);
  
  loginDuration.add(loginRes.timings.duration);
  
  const token = loginRes.json('data.accessToken');
  const headers = { Authorization: `Bearer ${token}` };
  
  // Dashboard
  group('Dashboard', () => {
    const dashRes = http.get(`${BASE_URL}/api/v1/dashboard/me`, { headers });
    check(dashRes, { 'dashboard status 200': (r) => r.status === 200 });
    dashboardDuration.add(dashRes.timings.duration);
  });
  
  // Employee List
  group('Employee List', () => {
    const empRes = http.get(`${BASE_URL}/api/v1/employees?page=1&limit=20`, { headers });
    check(empRes, { 'employees status 200': (r) => r.status === 200 });
    employeeListDuration.add(empRes.timings.duration);
  });
  
  // Employee Search
  group('Employee Search', () => {
    const searchRes = http.get(`${BASE_URL}/api/v1/employees?search=test&page=1&limit=20`, { headers });
    check(searchRes, { 'search status 200': (r) => r.status === 200 });
  });
  
  sleep(1);
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'summary.json': JSON.stringify(data, null, 2),
  };
}
```

#### 2.1.2 Stress Test (`k6/stress-test.js`)

```javascript
// k6/stress-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 10 },
    { duration: '5m', target: 100 },
    { duration: '10m', target: 500 },  // Peak load
    { duration: '10m', target: 500 },  // Sustained peak
    { duration: '5m', target: 0 },     // Cool down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
    http_req_failed: ['rate<0.05'],
  },
};

export default function () {
  // Same as load test but higher concurrency
  // ...
}
```

#### 2.1.3 Spike Test (`k6/spike-test.js`)

```javascript
// k6/spike-test.js
export const options = {
  stages: [
    { duration: '1m', target: 10 },   // Baseline
    { duration: '30s', target: 1000 }, // Sudden spike
    { duration: '2m', target: 1000 },  // Sustain spike
    { duration: '30s', target: 10 },   // Drop
    { duration: '2m', target: 10 },    // Recovery
  ],
  thresholds: {
    http_req_duration: ['p(99)<2000'],
    http_req_failed: ['rate<0.1'],
  },
};

export default function () {
  // Same as load test
}
```

#### 2.1.4 Soak Test (`k6/soak-test.js`)

```javascript
// k6/soak-test.js
export const options = {
  stages: [
    { duration: '10m', target: 50 },
    { duration: '4h', target: 50 },   // 4 hours sustained
    { duration: '10m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(99)<1000'],
    http_req_failed: ['rate<0.01'],
  },
};
```

---

## 3. Running Load Tests

### 3.1 Local Development

```bash
# Start services
cd sana-hrms
docker compose up -d

# Wait for services to be healthy
docker compose ps

# Run load test
cd frontend
k6 run ../k6/load-test.js

# With custom base URL
k6 run -e BASE_URL=https://staging.example.com k6/load-test.js

# Run stress test
k6 run ../k6/stress-test.js

# Run spike test
k6 run ../k6/spike-test.js

# Run soak test (4+ hours)
k6 run ../k6/soak-test.js
```

### 3.2 CI/CD Integration

```yaml
# .github/workflows/load-test.yml
name: Load Test
on:
  schedule:
    - cron: '0 2 * * 0'  # Weekly on Sunday
  workflow_dispatch:

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      
      - name: Start services
        run: docker compose up -d
      
      - name: Wait for services
        run: |
          timeout 120 bash -c 'until curl -f http://localhost:4114/api/v1/health; do sleep 2; done'
      
      - name: Run load test
        run: |
          cd frontend
          npm ci
          npx playwright install --with-deps
          k6 run ../k6/load-test.js -e BASE_URL=http://localhost:4114
      
      - name: Upload results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: k6-results
          path: output/
```

---

## 4. Autocannon Quick Benchmarks

```bash
# Install
npm install -g autocannon

# Login benchmark
autocannon -c 50 -d 30s -m POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -b '{"username":"admin","password":"E7HHpQcEFezE4OAa1!"}' \
  http://localhost:4114/api/v1/auth/login

# GET endpoints
autocannon -c 50 -d 30s \
  -H "Authorization: Bearer <token>" \
  http://localhost:4114/api/v1/employees

# Dashboard
autocannon -c 50 -d 30s \
  -H "Authorization: Bearer <token>" \
  http://localhost:4114/api/v1/dashboard/me
```

---

## 4. Lighthouse CI

### 4.1 Configuration

```bash
# Install
npm install -g @lhci/cli

# Run
npx lighthouse http://localhost:5183 --preset=desktop --output=json --output-path=./lighthouse-report.json
```

### 4.2 CI Integration

```yaml
# .github/workflows/lighthouse.yml
name: Lighthouse CI
on: [push, pull_request]
jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: cd frontend && npm ci && npm run build
      - uses: treosh/lighthouse-ci-action@v11
        with:
          urls: |
            http://localhost:5183
            http://localhost:5183/employees
            http://localhost:5183/dashboard
          budgetPath: ./lighthouse-budget.json
          uploadArtifacts: true
```

```json
// lighthouse-budget.json
{
  "ci": {
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.9 }],
        "categories:accessibility": ["error", { "minScore": 0.95 }],
        "categories:best-practices": ["error", { "minScore": 0.9 }],
        "first-contentful-paint": ["error", { "maxNumericValue": 1800 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }],
        "interactive": ["error", { "maxNumericValue": 200 }],
        "total-blocking-time": ["error", { "maxNumericValue": 200 }]
      }
    }
  }
}
```

---

## 5. Prometheus + Grafana Monitoring

### 5.1 Backend Metrics Export

```typescript
// backend/src/common/monitoring/metrics.interceptor.ts
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const start = Date.now();
    const route = request.route?.path || request.url;
    const method = request.method;
    
    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start;
        metrics.histogram('http_request_duration_seconds', duration / 1000, {
          labels: { route, method, status: 'success' }
        });
        metrics.increment('http_requests_total', { labels: { route, method, status: 'success' } });
      }),
      catchError((error) => {
        metrics.increment('http_requests_total', { labels: { route, method, status: 'error' } });
        throw error;
      })
    );
  }
}
```

### Prometheus Metrics

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'sana-backend'
    static_configs:
      - targets: ['backend:4114']
    metrics_path: /metrics
  
  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']
      
  - job_name: 'pgbouncer'
    static_configs:
      - targets: ['pgbouncer:6432']
```

### Grafana Dashboards

Key dashboards to create:
1. **API Performance**: Request rate, latency (p50, p95, p99), error rate
2. **Database**: Connection pool usage, query latency, slow queries
3. **Frontend**: Web Vitals, bundle size, bundle chunks
3. **Business**: Active users, API calls per endpoint, error rates

---

## 5. Alerting Rules

```yaml
# prometheus/alerts.yml
groups:
  - name: sana-hrms
    rules:
      - alert: HighAPILatency
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High API latency (p95 > 1s)"
          
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "High error rate ({{ $value | humanizePercentage }})"
          
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "High error rate ({{ $value | humanizePercentage }})"
          
      - alert: DatabaseSlowQueries
        expr: pg_stat_statements_mean_time > 1000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Slow database queries detected"
          
      - alert: ConnectionPoolExhaustion
        expr: pgbouncer_pool_usage > 0.8
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Connection pool near exhaustion ({{ $value | humanizePercentage }})"
          
      - alert: HighMemoryUsage
        expr: (container_memory_usage_bytes / container_spec_memory_limit_bytes) > 0.85
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage ({{ $value | humanizePercentage }})"
          
      - alert: HighCPUUsage
        expr: rate(container_cpu_usage_seconds_total[5m]) > 0.8
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High CPU usage ({{ $value | humanizePercentage }})"
```

---

## 6. Grafana Dashboard JSON

```json
{
  "dashboard": {
    "title": "Sana HRMS - API Performance",
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
      }
    ]
  }
}
```

---

## 12. CI/CD Performance Gates

```yaml
# .github/workflows/performance.yml
name: Performance Gates

on: [push, pull_request]

jobs:
  performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      
      - name: Install dependencies
        run: |
          cd backend && npm ci
          cd ../frontend && npm ci
      
      - name: Build
        run: |
          cd backend && npm run build
          cd ../frontend && npm run build
      
      - name: Backend Tests
        run: cd backend && npm test -- --coverage
      
      - name: Frontend Tests
        run: cd frontend && npm test
      
      - name: E2E Tests
        run: |
          cd frontend
          npx playwright install --with-deps
          npx playwright test
      
      - name: Coverage Gates
        run: |
          # Backend coverage thresholds
          # Statements: 80%, Branches: 75%, Functions: 80%
          
      - name: Bundle Size Check
        run: node scripts/check-bundle-size.js
      
      - name: Lighthouse CI
        uses: treosh/lighthouse-ci-action@v11
        with:
          urls: |
            http://localhost:5183
            http://localhost:5183/employees
            http://localhost:5183/dashboard
          budgetPath: ./lighthouse-budget.json
      
      - name: Mutation Testing
        run: npx stryker run --mutationScoreThreshold=70
```

---

## Summary

This load testing guide provides:

1. **k6 Scripts**: Load, stress, spike, and soak tests
2. **Autocannon**: Quick HTTP benchmarks
3. **Lighthouse CI**: Frontend performance budgets
4. **Prometheus/Grafana**: Monitoring and alerting
5. **CI/CD Gates**: Automated quality gates

### Quick Commands Reference

```bash
# Quick benchmarks
autocannon -c 50 -d 30s -H "Authorization: Bearer $TOKEN" http://localhost:4114/api/v1/employees

# Load test
k6 run k6/load-test.js -e BASE_URL=https://staging.example.com

# Stress test
k6 run ../k6/stress-test.js

# Soak test (4 hours)
k6 run ../k6/soak-test.js

# Lighthouse
npx lighthouse http://localhost:5183 --preset=desktop --output=json

# Lighthouse CI
npx lighthouse-ci --config=lighthouse-budget.json
```

---

**Document Version:** 1.0  
**Last Updated:** 2026-11-18  
**Next Review:** Sprint Planning  
**Owner:** Performance Engineering Team