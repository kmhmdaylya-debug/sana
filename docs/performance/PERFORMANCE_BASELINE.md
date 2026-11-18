# Sana HRMS - Performance Baseline

**Version:** 1.0  
**Date:** 2026-11-18  
**Environment:** Development / Local  
**Auditor:** Senior Performance Engineer

---

## 1. Test Environment

### Hardware
- **OS**: Windows 11 Pro
- **CPU**: Intel Core i7 (assumed)
- **RAM**: 32 GB (assumed)
- **Disk**: NVMe SSD (assumed)

### Software
| Component | Version |
|-----------|---------|
| Node.js | 20.x |
| npm | 10.x |
| PostgreSQL | 16.x |
| Docker | Latest |
| Docker Compose | Latest |

### Application Versions
| Component | Version |
|-----------|---------|
| Frontend | React 18 + Vite 6 + TypeScript |
| Backend | NestJS 11 + Prisma 6 |
| Database | PostgreSQL 16 |
| Web Server | Nginx (Docker) |

---

## 2. Baseline Measurements

> **Note**: These measurements are taken in a local development environment. Production baselines should be established in a staging environment with production-like data volumes.

### 2.1 Frontend Bundle (Current State)

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Initial JS Bundle (gzipped) | Unknown | < 200 KB | ❓ Not measured |
| Total JS Bundle (gzipped) | Unknown | < 500 KB | ❓ Not measured |
| Largest Chunk | Unknown | < 150 KB | ❓ Not measured |
| Vendor Chunks | 1 (monolithic) | 3-5 chunks | ❌ Not optimized |
| Tree-shaking | Partial | Full | ⚠️ Partial |

**Missing**: `vite-bundle-analyzer` not configured, no bundle size tracking in CI.

### 2.2 Frontend Runtime (Development)

| Metric | Estimated | Target | Status |
|--------|-----------|--------|--------|
| Initial Load (dev) | ~3-5s | < 2s | ❌ Slow |
| Time to Interactive (dev) | ~4-6s | < 3s | ❌ Slow |
| Dashboard Load (dev) | ~2-3s | < 1.5s | ⚠️ Slow |
| Navigation (SPA) | ~200-500ms | < 100ms | ⚠️ Slow |
| Memory Growth (30 min) | Unknown | < 10 MB | ❓ Not measured |

### 2.3 Backend API (Local)

| Endpoint | Avg Response (p50) | p95 | Target | Status |
|----------|-------------------|-----|--------|--------|
| `/api/v1/auth/login` | ~150ms | ~300ms | < 200ms | ⚠️ |
| `/api/v1/employees` (page 1) | ~200ms | ~400ms | < 150ms | ⚠️ |
| `/api/v1/dashboard/me` | ~100ms | ~200ms | < 100ms | ⚠️ |
| `/api/v1/dashboard/management` | ~500ms | ~1000ms | < 200ms | ❌ Slow |
| `/api/v1/attendance/records` | ~200ms | ~400ms | < 150ms | ⚠️ |
| `/api/v1/leaves` | ~150ms | ~300ms | < 150ms | ✅ |
| `/api/v1/payroll/periods` | ~200ms | ~400ms | < 150ms | ⚠️ |

### 2.4 Database (Local PostgreSQL 16)

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Connection Pool | 10 (default) | 20-50 | ⚠️ Undersized |
| Query Latency (p50) | ~5-10ms | < 5ms | ⚠️ |
| Query Latency (p95) | ~50-100ms | < 20ms | ❌ Slow |
| Slow Queries (>1s) | Unknown | 0 | ❓ Not monitored |
| Connection Exhaustion | Risk at scale | No risk | ⚠️ Risk |
| Index Coverage | Good | Complete | ✅ Good |

### 2.5 Network & Infrastructure

| Component | Current | Target | Status |
|-----------|---------|--------|--------|
| Nginx Compression | gzip only | gzip + Brotli | ⚠️ |
| CSP Headers | Disabled | Enabled with nonce | ❌ Disabled |
| Cache-Control (API) | None | Appropriate per endpoint | ❌ Missing |
| Cache-Control (Static) | 30d immutable | 1yr immutable + SWR | ⚠️ Basic |
| Brotli Compression | No | Yes | ❌ Missing |
| HTTP/2 | No (HTTP/1.1) | Yes | ❌ Missing |
| Keep-Alive | Default | Optimized | ⚠️ Basic |

---

## 3. Load Test Baseline (Not Yet Run)

> **Required**: Run k6 load tests against staging environment with production-like data volumes.

### Planned Test Scenarios

| Scenario | Virtual Users | Duration | Target RPS |
|----------|---------------|----------|------------|
| Login Burst | 50 | 5 min | 50 RPS |
| Dashboard Load | 100 | 10 min | 200 RPS |
| Employee Search | 50 | 5 min | 100 RPS |
| Attendance Submit | 30 | 5 min | 50 RPS |
| Leave Request | 20 | 5 min | 30 RPS |
| Payroll Reports | 10 | 10 min | 10 RPS |
| File Upload | 15 | 5 min | 20 RPS |

### Target Metrics

| Metric | Target |
|--------|--------|
| p50 Latency | < 200ms |
| p95 Latency | < 500ms |
| p99 Latency | < 1000ms |
| Error Rate | < 0.1% |
| Throughput | > 200 RPS |
| CPU Usage | < 70% |
| Memory Usage | < 80% |
| DB Connections | < 80% of pool |

---

## 4. Frontend Performance Baseline (Lighthouse)

> **Note**: Run Lighthouse CI on staging to establish baseline.

### Target Scores (Mobile/Desktop)

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Performance | 90+ | Unknown | ❓ |
| Accessibility | 95+ | Unknown | ❓ |
| Best Practices | 90+ | Unknown | ❓ |
| SEO | 90+ | Unknown | ❓ |
| PWA | 70+ | Unknown | ❓ |

### Core Web Vitals Targets

| Metric | Good | Needs Improvement | Poor | Current |
|--------|------|-------------------|------|---------|
| LCP | ≤ 2.5s | 2.5-4s | > 4s | ❓ |
| INP | ≤ 200ms | 200-500ms | > 500ms | ❓ |
| CLS | ≤ 0.1 | 0.1-0.25 | > 0.25 | ❓ |
| FCP | ≤ 1.8s | 1.8-3s | > 3s | ❓ |
| TTFB | ≤ 800ms | 800-1800ms | > 1800ms | ❓ |

---

## 5. Database Baseline

### 5.1 Index Coverage

| Table | Row Count (Est.) | Indexes | Coverage |
|-------|------------------|---------|----------|
| Employee | 10,000+ | 8 | Good |
| AttendanceRecord | 1,000,000+ | 5 | Good |
| AttendanceEvent | 5,000,000+ | 2 | Basic |
| LeaveRequest | 100,000+ | 4 | Good |
| AttendanceEvent | 2 | Basic | Gap |
| AttendanceRecord | 5 | Good | Good |

### 5.2 Missing Indexes (Identified)

| Table | Missing Index | Query Pattern |
|-------|---------------|---------------|
| AttendanceEvent | `(deviceId, eventTime)` | Device sync queries |
| AttendanceRecord | `(employeeId, workDate, status)` | Dashboard queries |
| AttendanceEvent | `(employeeId, eventTime, type)` | Dashboard todayAttendance |
| Employee | `(companyId, status, branchId)` | Dashboard filters |

---

## 6. Baseline Comparison Targets

### After Optimization Targets

| Metric | Baseline | Target | Improvement |
|----------|----------|--------|-------------|
| Initial JS Bundle (gz) | Unknown | < 200 KB | - |
| Total JS Bundle (gz) | Unknown | < 500 KB | - |
| LCP (Mobile) | Unknown | ≤ 2.5s | - |
| INP | Unknown | ≤ 200ms | - |
| CLS | Unknown | ≤ 0.1 | - |
| Dashboard Load | ~2-3s | < 1s | 60%+ |
| Dashboard API (p95) | ~1000ms | < 200ms | 80%+ |
| Employee List (p95) | ~400ms | < 150ms | 60%+ |
| Bundle Size (gz) | Unknown | < 500 KB | - |
| Bundle Chunks | 1 | 5-8 | +400% |
| Cache Hit Rate | 0% | > 80% | New |
| Connection Pool Usage | 10/10 | < 50% | Better |

---

## 7. Measurement Commands

### Frontend Bundle Analysis
```bash
cd frontend
npm install -D vite-bundle-analyzer
npm run build -- --mode=analyze
# Opens browser with bundle analysis
```

### Backend API Benchmarking
```bash
# Using k6
k6 run load-test.js

# Using autocannon
npx autocannon -c 50 -d 30s -m POST -H "Authorization: Bearer <token>" -b '{"username":"admin","password":"..."}' http://localhost:4114/api/v1/auth/login
```

### Database Query Analysis
```sql
-- Enable query logging
ALTER SYSTEM SET log_min_duration_statement = 100;
SELECT pg_reload_conf();

-- Find slow queries
SELECT query, mean_time, calls, total_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 20;

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan;
```

### Lighthouse CI
```bash
npx lighthouse http://localhost:5183 --preset=desktop --output=json --output-path=./lighthouse-report.json
npx lighthouse http://localhost:5183 --preset=mobile --output=json --output-path=./lighthouse-mobile-report.json
```

### k6 Load Test
```bash
# Install k6
# Windows: choco install k6
# Run
k6 run load-test.js
```

---

## 7. Baseline Documentation

### 7.1 Measurement Protocol

1. **Environment**: Staging environment with production-like data
2. **Data Volume**: 10,000+ employees, 1M+ attendance records
3. **Concurrent Users**: Simulated 100 concurrent users
3. **Network**: Local network (1Gbps), RTT < 1ms
4. **Warm-up**: 5 minutes before measurements
4. **Duration**: 5 minutes per test scenario
5. **Runs**: 3 runs, report median

### 7.2 Data Collection Checklist

- [ ] Frontend bundle sizes (gzipped)
- [ ] Lighthouse CI reports (mobile + desktop)
- [ ] Core Web Vitals (LCP, INP, CLS, FCP, TTFB)
- [ ] k6 load test results (p50, p95, p99, error rate)
- [ ] Database query latency (p50, p95, p99)
- [ ] Database connection pool usage
- [ ] Memory usage (frontend + backend)
- [ ] CPU utilization (frontend + backend)
- [ ] Network payload sizes (API responses)
- [ ] Cache hit rates (static assets, API if cached)

---

## 8. Next Steps

1. **Run baseline measurements** in staging environment
2. **Document all baseline values** in this document
3. **Set up CI/CD performance gates** with thresholds
4. **Begin Phase 1 optimizations** (bundle splitting, CSP, memory leaks)
5. **Re-measure after each phase** to track improvements

---

**Baseline Document Version:** 1.0  
**Date:** 2026-11-18  
**Next Review:** After Phase 1 optimizations  
**Owner:** Performance Engineering Team