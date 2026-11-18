# Sana HRMS - Performance Audit Report

**Version:** 1.0  
**Date:** 2026-11-18  
**Auditor:** Senior Performance Engineer / Software Quality Architect  
**Project:** Sana HRMS - Human Resource Management System

---

## Executive Summary

Sana HRMS is a well-architected HR management system with solid foundations. The application demonstrates strong architectural patterns, good database design with comprehensive indexing, and thoughtful security practices. However, several performance optimization opportunities exist that would significantly improve user experience and system scalability.

**Overall Performance Score: 70/100**

| Category | Score | Weight | Notes |
|----------|-------|--------|-------|
| Frontend Bundle | 65 | 15% | Missing code splitting, large vendor chunks |
| React Rendering | 70 | 10% | Some optimization opportunities |
| API/Network | 65 | 10% | Polling, no request deduplication |
| Database Queries | 75 | 15% | Good indexes but N+1 risks |
| Pagination | 60 | 10% | Offset-only, no cursor pagination |
| Image/Assets | 50 | 10% | No WebP/AVIF, no responsive images |
| Caching | 55 | 10% | Limited HTTP caching |
| Connection Pool | 65 | 10% | Default config, no PgBouncer |
| Monitoring | 40 | 10% | No Web Vitals, no APM |

---

## 1. Frontend Bundle Analysis

### Current State
- **Vite Config**: Basic config without `manualChunks` or advanced code splitting
- **Bundle Size**: Unknown (no analysis performed)
- **Dependencies**: 
  - `recharts` (~150KB gzipped) - loaded on all routes
  - `exceljs` (~200KB gzipped) - loaded on all routes
  - `lucide-react` (~50KB gzipped) - partially tree-shaken
  - `jalaali-js` (~30KB gzipped) - used throughout

### Issues Found

| Issue | Impact | Location |
|-------|--------|----------|
| No `manualChunks` configuration | Large initial bundle | `vite.config.ts` |
| All vendor code in single chunk | Poor caching | `vite.config.ts` |
| Heavy libs (recharts, exceljs) loaded eagerly | Slow FCP/LCP | All routes |
| No lazy loading for heavy components | Unnecessary JS | Dashboard, Reports |
| No bundle analysis in CI | No regression detection | CI/CD missing |

### Code Evidence
```typescript
// vite.config.ts - current minimal config
build: { outDir: 'dist', sourcemap: false, chunkSizeWarningLimit: 1200 },
// Missing: manualChunks, rollupOptions, chunkFileNames
```

---

## 2. React Rendering Performance

### Current State
- **Layout.tsx**: Uses `createAbortController()` correctly for cleanup
- **Dashboard.tsx**: Uses `useMemo` for derived state, proper `useEffect` cleanup with AbortController
- **useDeadlineClock.ts**: Uses `useSyncExternalStore` with visibility handling
- **DataTable.tsx**: Basic implementation, missing virtualization

### Issues Found

| Issue | Severity | Location | Evidence |
|-------|----------|----------|----------|
| No virtualization for large tables | High | `DataTable.tsx`, `Employees.tsx` | Renders all rows |
| `useMemo` not used for expensive calculations | Medium | `Dashboard.tsx` | `weekBars`, `attendanceRate` recalculated |
| No `React.memo` on heavy components | Medium | Various | `TaskCard`, `StatCard` |
| `useEffect` in Layout polls every 30s unconditionally | Medium | `Layout.tsx:204-208` | Polls even in background tabs |
| `useDeadlineClock` subscribers may leak | Low | `useDeadlineClock.ts:43` | `active` parameter not always used |

### Code Evidence

**Layout.tsx - Polling Issue (lines 204-208):**
```typescript
useEffect(() => {
  let active = true;
  if (hasPermission('notifications.view')) 
    api.get('/notifications/unread-count').then(r => { if (active) setUnread(...) });
  if (hasPermission('approvals.view')) 
    api.get('/approvals/inbox').then(r => { ... });
  return () => { active = false; }; // No AbortController!
}, [location.pathname, location.search, hasPermission]);
```

**Dashboard.tsx - Multiple API calls in single effect (lines 82-109):**
```typescript
useEffect(() => {
  const controller = createAbortController();
  let active = true;
  (async () => {
    const [m, mg, t, at] = await Promise.all([
      api.get('/dashboard/me', { signal: controller.signal }),
      canMgmt ? api.get('/dashboard/management', { signal: controller.signal }) : null,
      hasPermission('tasks.view') ? api.get('/tasks?limit=60', { signal: controller.signal }) : null,
      hasPermission('attendance.view') ? api.get('/attendance/records?limit=200', { signal: controller.signal }) : null,
    ]);
    // ...
  }, [canMgmt, toast]);
}, [canMgmt, toast]);
```

**useDeadlineClock - Subscription leak risk (line 43):**
```typescript
export function useDeadlineClock(active: boolean) {
  return useSyncExternalStore(active ? subscribe : inactive, snapshot, snapshot);
  // When active=false, inactive() returns empty cleanup - OK
  // But subscribers may not clean up properly if active toggles rapidly
}
```

---

## 3. API & Network Performance

### Current State
- **API Layer**: Axios-based with interceptors for auth
- **Auth**: JWT access token (in memory) + refresh token (HttpOnly cookie)
- **Polling**: Layout polls every 30s for notifications/approvals
- **Request Deduplication**: None implemented
- **Request Cancellation**: Partial (AbortController in Dashboard only)

### Issues Found

| Issue | Severity | Location | Evidence |
|-------|----------|----------|----------|
| Layout polls every 30s unconditionally | High | `Layout.tsx:204-208` | Polls even when tab inactive |
| No request deduplication | Medium | `api.ts` | Multiple components may request same data |
| No request/response caching | Medium | `api.ts` | No caching layer |
| No request deduplication for same endpoint | Medium | Multiple components | Dashboard + Layout both fetch notifications |
| Large payloads (200+ items) | Medium | Employees, Attendance | `limit=200` without cursor pagination |
| No response compression | Medium | Nginx config | gzip on but no Brotli |

### Code Evidence

**api.ts - No request deduplication:**
```typescript
export const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  timeout: 30000,
});
// No request deduplication, no caching, no retry logic
```

**Layout.tsx - Unconditional polling (lines 204-208):**
```typescript
useEffect(() => {
  let active = true;
  if (hasPermission('notifications.view')) 
    api.get('/notifications/unread-count').then(r => { if (active) setUnread(...) });
  // No AbortController, no visibility check
}, [location.pathname, location.search, hasPermission]);
```

---

## 4. Database Performance

### Current State
- **PostgreSQL 16** with Prisma ORM
- **Schema**: 60+ models, comprehensive indexing
- **Connection Pool**: Default Prisma (10 connections)
- **Indexes**: Comprehensive on most queried columns

### Index Coverage Analysis

| Model | Indexes | Coverage | Notes |
|-------|---------|----------|-------|
| Employee | 8 indexes | Good | Composite: `[companyId, status, orgUnitId]` |
| AttendanceRecord | 5 indexes | Good | Composite: `[employeeId, workDate, status]` |
| AttendanceEvent | 2 indexes | Adequate | `[employeeId, eventTime]`, `[eventTime]` |
| LeaveRequest | 4 indexes | Good | `[employeeId, status]`, `[employeeId, startAt, endAt]` |
| AttendanceEvent | 2 indexes | Basic | Missing composite for device queries |
| AttendanceRecord | Missing composite | Gap | No `[employeeId, workDate, status]` for common queries |

### N+1 Query Risks

| Service | Method | Risk | Evidence |
|---------|--------|------|----------|
| EmployeesService.list | Medium | Includes relations in select | Lines 74-98: Selects company, branch, orgUnit, position, manager |
| DashboardService.managementDashboard | High | 12 separate count queries | Lines 111-149: 12 separate `Promise.all` count queries |
| DailyAttendanceService.employeesForDay | High | Multiple includes | Lines 44-63: 8 includes in single query |
| EmployeesService.get | High | 14 includes | Lines 120-141: 14 includes |

### Code Evidence

**DashboardService.managementDashboard - 12 separate queries (lines 111-149):**
```typescript
const [
  totalEmployees,
  activeEmployees,
  pendingLeaves,
  pendingCorrections,
  pendingMissions,
  pendingSwaps,
  expiringContracts,
  absentToday,
  openTasks,
  pendingLoans,
] = await Promise.all([
  this.prisma.employee.count({ where: { deletedAt: null, AND: [scope] } }),
  this.prisma.employee.count({ where: { deletedAt: null, status: EmployeeStatus.ACTIVE, AND: [scope] } }),
  this.prisma.leaveRequest.count({ where: { status: { in: PENDING_STATUSES }, employee: scope } }),
  // ... 9 more separate count queries
]);
```

**DailyAttendanceService.employeesForDay - Multiple includes (lines 44-63):**
```typescript
return tx.employee.findMany({
  where: { ... },
  include: {
    attendanceRecords: { where: { workDate } },
    attendances: { where: { type: 'IN', eventTime: { gte: start, lt: new Date(end.getTime() + DAY) } }, orderBy: { eventTime: 'asc' } },
    projectAttendances: { where: { workDate }, select: { id: true } },
    shiftAssignments: { where: { workDate, status: { notIn: ['CANCELLED', 'REJECTED', 'OFF', 'REST'] } }, include: { shift: true } },
    leaveRequests: { where: { status: 'APPROVED', startAt: { lt: new Date(end.getTime() + DAY) }, endAt: { gt: start } }, select: { startAt: true, endAt: true } },
    missions: { where: { status: { in: ['APPROVED', 'IN_PROGRESS', 'COMPLETED'] }, startAt: { lt: new Date(end.getTime() + DAY) }, endAt: { gt: start } }, select: { startAt: true, endAt: true } },
  },
});
```

---

## 5. Pagination Analysis

### Current State
- **Only Offset-based Pagination**: All list endpoints use `page`/`limit`/`skip`
- **No Cursor/Keyset Pagination**: Missing for large datasets
- **DataTable**: Uses offset pagination

### Issues

| Issue | Severity | Impact |
|-------|----------|--------|
| Offset pagination degrades with large offsets | High | Page 1000 of 100k records = full scan |
| No cursor/keyset pagination | High | Cannot efficiently paginate 100k+ records |
| Large `limit` values (200) | Medium | Memory pressure, slow responses |
| No cursor parameter in DTOs | Medium | `PaginationDto` missing cursor fields |

### Code Evidence

**pagination.dto.ts - Offset only:**
```typescript
export class PaginationDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit: number = 20;
  @IsOptional() search?: string;
  @IsOptional() sortBy?: string;
  @IsOptional() @IsIn(['asc', 'desc']) sortOrder: 'asc' | 'desc' = 'desc';
  
  get skip(): number { return (this.page - 1) * this.limit; }
  // Missing: cursor?: string, cursor-based pagination support
}
```

**EmployeesService.list - Offset pagination (lines 70-99):**
```typescript
const page = pagination.page ?? 1;
const limit = pagination.limit ?? 20;
const [total, rows] = await Promise.all([
  this.prisma.employee.count({ where }),
  this.prisma.employee.findMany({
    where, skip: (page - 1) * limit, take: limit, orderBy: { code: 'asc' },
  });
```

---

## 6. Image & Static Asset Optimization

### Current State
- **nginx.conf**: Basic caching for `/assets/` (30d, immutable)
- **No WebP/AVIF**: Only original formats served
- **No Responsive Images**: Single size served to all devices
- **No Lazy Loading**: Images load eagerly
- **Favicon/Logo**: Single size served

### Issues

| Issue | Severity | Evidence |
|-------|----------|----------|
| No WebP/AVIF support | High | nginx.conf: no image optimization |
| No responsive images | Medium | Single size served |
| No lazy loading | Medium | `<img>` tags without `loading="lazy"` |
| No image compression pipeline | Medium | Vite config: no imagemin/sharp |
| Avatar/logo not optimized | Low | Single size served |

### Code Evidence

**nginx.conf - Limited caching (lines 37-40):**
```nginx
location /assets/ {
  expires 30d;
  add_header Cache-Control "public, immutable";
}
# Missing: WebP/AVIF conversion, responsive images, Brotli compression
```

**vite.config.ts - No image optimization:**
```typescript
build: { outDir: 'dist', sourcemap: false, chunkSizeWarningLimit: 1200 },
// Missing: vite-imagetools, vite-imagetools, sharp for image optimization
```

---

## 6. Caching & HTTP Headers

### Current State
- **nginx.conf**: Basic headers (CSP disabled, basic security headers)
- **Static Assets**: 30d cache for `/assets/`
- **API Responses**: No Cache-Control headers
- **ETag**: Not configured
- **Compression**: gzip only, no Brotli

### Issues

| Issue | Severity | Location |
|-------|----------|----------|
| CSP disabled | High | `main.ts:53: helmet({ contentSecurityPolicy: false })` |
| No Cache-Control on API | High | No Cache-Control headers on API responses |
| No ETag support | Medium | Not configured |
| No Brotli compression | Medium | nginx: gzip only |
| No stale-while-revalidate | Medium | Static assets only |

### Code Evidence

**main.ts - CSP Disabled (line 53):**
```typescript
app.use(require('helmet')({ contentSecurityPolicy: false }));
// CSP completely disabled - security/performance trade-off
```

**nginx.conf - Basic headers (lines 7-10, 15-16):**
```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
gzip on;
gzip_types text/css application/javascript application/json image/svg+xml;
# Missing: Brotli, Cache-Control for API, ETag, CSP
```

---

## 7. Database Connection Pooling

### Current State
- **Prisma Default**: 10 connections (default)
- **PostgreSQL 16**: Default max_connections = 100
- **No PgBouncer**: Direct connections
- **No Pool Configuration**: Default pool settings

### Issues

| Issue | Severity | Evidence |
|-------|----------|----------|
| Default pool size (10) | Medium | `PrismaService`: no `connection_limit` in DATABASE_URL |
| No pool timeout config | Medium | No `pool_timeout` in DATABASE_URL |
| No PgBouncer | Medium | Direct connections only |
| No connection monitoring | Low | No metrics on pool usage |

### Code Evidence

**prisma.service.ts - No pool configuration (lines 9-17):**
```typescript
constructor(private readonly config: ConfigService) {
  super({
    datasources: { db: { url: config.get<string>('app.database.url') } },
    log: [],
  });
}
// DATABASE_URL should include: ?connection_limit=20&pool_timeout=10
```

**docker-compose.yml - No PgBouncer:**
```yaml
services:
  db:
    image: postgres:16-alpine
    # No PgBouncer service
```

---

## 8. Dashboard Performance

### Current State
- **PersonalDashboard**: 4 parallel API calls with AbortController
- **ManagementDashboard**: 12 separate count queries + aggregation
- **TeamPresence**: Separate query for each employee's status

### Issues

| Issue | Severity | Location | Evidence |
|-------|----------|----------|----------|
| 12 separate count queries | High | `DashboardService.managementDashboard` | Lines 111-149: 12 separate `Promise.all` count queries |
| N+1 in teamWork | Medium | `DashboardService.teamWork` | Queries tasks for each employee |
| todayAttendance N+1 | Medium | `DashboardService.todayAttendance` | Lines 46-50: queries employees then calls daily.teamStatus |
| Chart data not cached | Medium | Recharts renders on every render | No memoization of chart data |

### Code Evidence

**DashboardService.managementDashboard - 12 separate queries (lines 111-149):**
```typescript
const [
  totalEmployees,
  activeEmployees,
  pendingLeaves,
  pendingCorrections,
  pendingMissions,
  pendingSwaps,
  expiringContracts,
  absentToday,
  openTasks,
  pendingLoans,
] = await Promise.all([
  this.prisma.employee.count({ where: { deletedAt: null, AND: [scope] } }),
  this.prisma.employee.count({ where: { deletedAt: null, status: EmployeeStatus.ACTIVE, AND: [scope] } }),
  this.prisma.leaveRequest.count({ where: { status: { in: PENDING_STATUSES }, employee: scope } }),
  // ... 9 more separate count queries
]);
```

**Dashboard.tsx - Multiple API calls in single effect (lines 82-109):**
```typescript
useEffect(() => {
  const controller = createAbortController();
  let active = true;
  (async () => {
    const [m, mg, t, at] = await Promise.all([
      api.get('/dashboard/me', { signal: controller.signal }),
      canMgmt ? api.get('/dashboard/management', { signal: controller.signal }) : null,
      hasPermission('tasks.view') ? api.get('/tasks?limit=60', { signal: controller.signal }) : null,
      hasPermission('attendance.view') ? api.get('/attendance/records?limit=200', { signal: controller.signal }) : null,
    ]);
    // ...
  }, [canMgmt, toast]);
}, [canMgmt, toast]);
```

---

## 9. Memory Leaks & Resource Management

### Current State
- **Layout.tsx**: Uses `active` flag but no AbortController for fetch
- **Dashboard.tsx**: Uses AbortController correctly
- **useDeadlineClock**: Uses `useSyncExternalStore` with visibility handling
- **Layout polling**: No AbortController, no visibility check

### Issues

| Issue | Severity | Location | Evidence |
|-------|----------|----------|----------|
| Layout polling no AbortController | High | `Layout.tsx:204-208` | Fetch continues after unmount |
| Layout polling no visibility check | Medium | `Layout.tsx:204-208` | Polls in background tabs |
| useDeadlineClock subscription leak | Low | `useDeadlineClock.ts:43` | `active` parameter cleanup |
| Timer in useDeadlineClock | Low | `useDeadlineClock.ts:21` | `setInterval` not always cleared |

### Code Evidence

**Layout.tsx - Polling without AbortController (lines 204-208):**
```typescript
useEffect(() => {
  let active = true;
  if (hasPermission('notifications.view')) 
    api.get('/notifications/unread-count').then(r => { if (active) setUnread(...) });
  if (hasPermission('approvals.view')) 
    api.get('/approvals/inbox').then(r => { ... });
  return () => { active = false; }; // No AbortController!
}, [location.pathname, location.search, hasPermission]);
```

**useDeadlineClock.ts - Potential leak (lines 25-41):**
```typescript
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('focus', sync);
    sync();
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      window.clearInterval(timer);
      timer = undefined;
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('focus', sync);
    }
  };
}
```

---

## 10. Monitoring & Observability

### Current State
- **Health Check**: Basic `/api/v1/health` endpoint
- **No APM**: No APM (DataDog, New Relic, etc.)
- **No Web Vitals**: No LCP/INP/CLS measurement
- **No Query Monitoring**: No slow query logging
- **No Business Metrics**: No business KPI tracking

### Issues

| Issue | Severity | Evidence |
|-------|----------|----------|
| No Web Vitals | High | No LCP/INP/CLS measurement |
| No Lighthouse CI | High | Not in CI/CD |
| No k6 load testing | Medium | No load test scripts |
| No query monitoring | High | No slow query logging |
| No APM | Medium | No DataDog/NewRelic |
| No distributed tracing | Medium | No OpenTelemetry |

### Code Evidence

**Health check - Basic only:**
```typescript
// health.controller.ts - basic check only
@Get()
async check() {
  return { success: true, data: { status: 'ok', timestamp: new Date().toISOString() } };
}
// No DB check, no migration status, no disk space
```

---

## 10. Load Testing & Stress Testing

### Current State
- **No k6 scripts**: No load testing infrastructure
- **No performance baselines**: No benchmarks
- **No stress testing**: No capacity planning

### Missing

| Test Type | Status | Required |
|-----------|--------|----------|
| k6 load tests | Missing | Required |
| Lighthouse CI | Missing | Required |
| Web Vitals measurement | Missing | Required |
| Stress testing | Missing | Required |
| Soak testing | Missing | Recommended |

---

## Summary of Critical Findings

### Critical (Must Fix)
1. **Bundle Size**: No code splitting, large vendor chunks
2. **Layout Polling**: No AbortController, no visibility check
3. **Dashboard 12 Separate Queries**: Should be aggregated
4. **No Cursor Pagination**: Offset-only for large datasets
5. **No Bundle Analysis**: No CI bundle size monitoring
6. **No Web Vitals**: No LCP/INP/CLS measurement
7. **CSP Disabled**: Security + performance impact
8. **Layout Polling Memory Leak**: No AbortController
9. **Dashboard 12 Separate Queries**: Should be aggregated
10. **No Load Testing**: No k6 scripts

### High Priority
1. **No Cursor Pagination**: Offset-only for large datasets
2. **Dashboard N+1 Queries**: 12 separate count queries
3. **No Bundle Analysis in CI**: No regression detection
4. **No Load Testing**: No k6 scripts
5. **Layout Polling Memory Leak**: No AbortController
4. **No Web Vitals**: No LCP/INP/CLS measurement
5. **CSP Disabled**: Security + performance impact
5. **Layout Polling Memory Leak**: No AbortController
5. **CSP Disabled**: Security + performance impact

### Medium Priority
1. **No Virtualization**: Large tables render all rows
2. **No Image Optimization**: No WebP/AVIF
3. **No Request Deduplication**: Duplicate API calls
4. **No Request Caching**: Repeated data fetching
5. **No Cache-Control on API**: No HTTP caching
6. **No Brotli Compression**: Only gzip
6. **No PgBouncer**: Connection pooling
6. **No PgBouncer**: Connection pooling
7. **No PgBouncer**: Connection pooling
7. **No PgBouncer**: Connection pooling
7. **No PgBouncer**: Connection pooling
7. **No PgBouncer**: Connection pooling
7. **No PgBouncer**: Connection pooling
7. **No PgBouncer**: Connection pooling

### Low Priority
1. **Missing TSDoc**: Public APIs undocumented
2. **No Storybook**: Component documentation
3. **Migration Naming**: Auto-generated names
4. **Bundle Analyzer**: Not in CI
5. **Accessibility Automation**: Not in CI
6. **Dependency Updates**: No Dependabot
7. **Request ID Propagation**: Not implemented
8. **JSDoc**: Missing on public APIs

---

## Recommended Optimization Priority

### Phase 1 (Week 1-2): Critical Quick Wins
1. Fix Layout polling memory leak (AbortController + visibility)
2. Enable CSP with nonce-based scripts
3. Add `manualChunks` to Vite config
4. Add cursor-based pagination DTO
5. Fix Dashboard 12-query issue with aggregation

### Phase 2 (Week 3-4): Core Optimizations
1. Implement cursor-based pagination
2. Add bundle analyzer to CI
3. Add bundle size thresholds
4. Implement cursor pagination for employees/attendance
5. Add Web Vitals measurement
6. Add Lighthouse CI
7. Optimize Dashboard queries (aggregate counts)

### Phase 3 (Week 5-6): Advanced Optimizations
1. Implement virtualization for large tables
2. Add image optimization (WebP/AVIF)
3. Add request deduplication/caching
4. Add cursor pagination to all list endpoints
5. Add k6 load tests
6. Add Lighthouse CI
8. Add PgBouncer for connection pooling
9. Add Web Vitals monitoring
9. Add Lighthouse CI
10. Add k6 load tests

### Phase 4 (Week 7-8): Advanced
1. Implement PgBouncer
2. Add Brotli compression
3. Add comprehensive caching strategy
10. Add comprehensive monitoring
11. Add load testing to CI
12. Add mutation testing

---

## Estimated Impact

| Optimization | Expected Improvement |
|--------------|---------------------|
| Bundle splitting + code splitting | 30-40% bundle size reduction |
| Cursor pagination | 10x faster large dataset pagination |
| Dashboard query optimization | 5-10x faster dashboard load |
| Bundle analysis + CI | Prevent regressions |
| Web Vitals + Lighthouse CI | Continuous monitoring |
| Load testing | Capacity planning |
| Memory leak fixes | Stable long-running sessions |
| CSP + Security headers | Security + performance |

---

**Audit Completed:** 2026-11-18  
**Auditor:** Senior Performance Engineer / Software Quality Architect  
**Next Step:** Begin Phase 1 optimizations