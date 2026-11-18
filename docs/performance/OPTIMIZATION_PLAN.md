# Sana HRMS - Performance Optimization Plan

**Version:** 1.0  
**Date:** 2026-11-18  
**Audience:** Performance Engineering Team, Backend/Frontend Leads, DevOps  
**Status:** Approved for Implementation

---

## Executive Summary

Based on the comprehensive performance audit (PERFORMANCE_AUDIT.md) and baseline establishment (PERFORMANCE_BASELINE.md), this document outlines a phased optimization plan to improve Sana HRMS performance from **70/100 to 90/100**.

**Objective**: Achieve ≥90/100 performance score through measurable, evidence-based optimizations.

**Timeline**: 8 weeks (4 phases × 2 weeks)

---

## Phase 1: Critical Quick Wins (Week 1-2)

**Goal**: Fix critical issues with immediate high impact, low risk.

### 1.1 Fix Layout Polling Memory Leak (Critical)
**File**: `frontend/src/layout/Layout.tsx` (lines 204-208)
**Effort**: 2 hours
**Impact**: Eliminates memory leak, reduces CPU/battery drain

```typescript
// BEFORE (leaky)
useEffect(() => {
  let active = true;
  if (hasPermission('notifications.view')) 
    api.get('/notifications/unread-count').then(r => { if (active) setUnread(...) });
  // ...
  return () => { active = false; };
}, [location.pathname, location.search, hasPermission]);

// AFTER (fixed)
useEffect(() => {
  const controller = createAbortController();
  let active = true;
  if (hasPermission('notifications.view')) 
    api.get('/notifications/unread-count', { signal: controller.signal })
      .then(r => { if (active) setUnread(r?.data?.data?.unreadCount ?? 0); });
  // ...
  return () => {
    active = false;
    controller.abort();
  };
}, [location.pathname, location.search, hasPermission]);
```

**Verification**: Chrome DevTools → Memory tab → Heap snapshot before/after navigation

---

### 1.2 Enable CSP with Nonce (Critical)
**File**: `backend/src/main.ts` (line 53)
**Effort**: 4 hours
**Impact**: XSS protection + performance (CSP enables browser optimizations)

```typescript
// BEFORE
app.use(require('helmet')({ contentSecurityPolicy: false }));

// AFTER
app.use(require('helmet')({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
      imgSrc: ["'self'", 'data:', 'https:'],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", 'https:'],
      fontSrc: ["'self'", 'https:'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
    },
  },
}));
```

**Frontend Integration**: Add nonce to Vite HTML template
```html
<!-- index.html -->
<script nonce="<%= cspNonce %>">...</script>
```

**Verification**: CSP header present in response, no console errors

---

### 1.3 Add Vite manualChunks (High)
**File**: `frontend/vite.config.ts`
**Effort**: 2 hours
**Impact**: 30-40% bundle size reduction, better caching

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-axios': ['axios'],
          'vendor-recharts': ['recharts'],
          'vendor-lucide': ['lucide-react'],
          'vendor-forms': ['react-hook-form'],
          'vendor-jalaali': ['jalaali-js'],
          'vendor-utils': ['clsx', 'date-fns'],
        },
        chunkFileNames: 'js/[name]-[hash].js',
        entryFileNames: 'js/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
});
```

**Verification**: `npm run build -- --mode=analyze` → check chunk sizes

---

### 1.4 Reduce Refresh Token Grace Period (Critical)
**Files**: `backend/src/common/config/configuration.ts`, `backend/src/auth/auth.service.ts`
**Effort**: 1 hour
**Impact**: Reduces replay attack window from 60s → 15s

```typescript
// configuration.ts
refreshGraceSeconds: parseInt(process.env.JWT_REFRESH_GRACE_SECONDS ?? '15', 10),

// auth.service.ts (line ~234)
const graceSeconds = Math.max(
  0,
  Math.min(15, this.config.get<number>("app.jwt.refreshGraceSeconds") ?? 15),
);
```

**Env Update**: `JWT_REFRESH_GRACE_SECONDS=15` in `.env.example` and docker-compose

---

### 1.5 File Upload Magic Bytes Validation (Critical)
**Files**: New `backend/src/common/utils/file-validation.util.ts`, updated `documents.controller.ts`
**Effort**: 4 hours
**Impact**: Prevents malicious file uploads (RCE, XSS)

```typescript
// file-validation.util.ts
export function validateUploadedFile(file: UploadedFilePayload): { ext: string } {
  const signatures: Record<string, { mime: string[]; prefix: number[] }> = {
    '.pdf': { mime: ['application/pdf'], prefix: [0x25, 0x50, 0x44, 0x46, 0x2d] },
    '.png': { mime: ['image/png'], prefix: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
    '.jpg': { mime: ['image/jpeg'], prefix: [0xff, 0xd8, 0xff] },
    // ...
  };
  // Validate magic bytes + MIME + size + extension
}
```

---

### 1.6 Enable CSP + Add Bundle Analyzer to CI (High)
**Files**: `.github/workflows/test.yml`, `frontend/vite.config.ts`
**Effort**: 3 hours

```yaml
# .github/workflows/test.yml
- name: Bundle Analysis
  run: |
    cd frontend
    npm run build -- --mode=analyze
    # Check bundle sizes against thresholds
```

---

### 1.7 Add Cursor Pagination DTO (High)
**File**: `backend/src/common/dto/pagination.dto.ts`

```typescript
export class CursorPaginationDto {
  @ApiPropertyOptional()
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200)
  limit: number = 20;

  @ApiPropertyOptional()
  @IsOptional()
  cursor?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsIn(['asc', 'desc']) sortOrder: 'asc' | 'desc' = 'desc';
}
```

---

## Phase 2: Core Optimizations (Week 3-4)

---

### 2.1 Cursor-Based Pagination Implementation (High)
**Effort**: 16 hours
**Impact**: 10x faster pagination for large datasets

**Files to Modify**:
- `backend/src/common/dto/pagination.dto.ts` - Add `CursorPaginationDto`
- `backend/src/employees/employees.service.ts` - Implement cursor pagination
- `backend/src/attendance/attendance.service.ts` - Add cursor pagination
- `backend/src/leaves/leaves.service.ts` - Add cursor pagination
- All list endpoints

```typescript
// Cursor pagination implementation pattern
async list(cursorDto: CursorPaginationDto, user: AuthenticatedUser) {
  const where = this.buildWhere(query, user);
  const limit = cursorDto.limit ?? 20;
  
  const whereClause = {
    ...where,
    ...(cursorDto.cursor ? { id: { lt: cursorDto.cursor } } : {}),
  };

  const rows = await this.prisma.model.findMany({
    where: whereClause,
    take: limit + 1, // Fetch one extra to detect hasNext
    orderBy: { id: cursorDto.sortOrder ?? 'desc' },
  });

  const hasNext = rows.length > limit;
  const items = hasNext ? rows.slice(0, -1) : rows;
  const nextCursor = hasNext ? items[items.length - 1].id : undefined;

  return { data: items, nextCursor, hasNext };
}
```

---

### 2.2 Dashboard Query Optimization (Critical)
**File**: `backend/src/dashboard/dashboard.service.ts`
**Effort**: 8 hours
**Impact**: 5-10x faster dashboard load

**Current Problem**: 12 separate count queries in `managementDashboard`

**Optimization**: Single aggregation query using `$facet` or materialized view

```typescript
// Optimized: Single aggregation query
async managementDashboard(user: AuthenticatedUser) {
  const scope = this.access.employeeWhereFor(user);
  const from = new Date(); from.setHours(0,0,0,0);
  const to = new Date(from.getTime() + 86_400_000);
  const monthFrom = new Date(); monthFrom.setDate(1); monthFrom.setHours(0,0,0,0);

  const result = await this.prisma.$queryRaw`
    SELECT 
      (SELECT count(*) FROM employee WHERE deleted_at IS NULL AND ${scope}) as total_employees,
      (SELECT count(*) FROM employee WHERE deleted_at IS NULL AND status = 'ACTIVE' AND ${scope}) as active_employees,
      (SELECT count(*) FROM leave_request WHERE status IN (...) AND employee_id IN (SELECT id FROM employee WHERE ${scope})) as pending_leaves,
      -- ... all counts in single query
  `;

  return { data: result[0], success: true };
}
```

**Alternative**: Materialized view refreshed every 5 minutes

---

### 2.3 Cursor Pagination for All List Endpoints (High)
**Scope**: All list endpoints (Employees, Attendance, Leaves, Contracts, Documents, etc.)
**Effort**: 20 hours
**Impact**: 10x faster pagination for large datasets

**Implementation Pattern**:
```typescript
// Common pagination service
@Injectable()
export class PaginationService {
  async paginateWithCursor<T>(
    model: any,
    where: any,
    cursorDto: CursorPaginationDto,
    select?: any,
  ) {
    const limit = cursorDto.limit ?? 20;
    const whereClause = cursorDto.cursor 
      ? { ...where, id: { lt: cursorDto.cursor } }
      : where;

    const rows = await this.prisma[model].findMany({
      where: whereClause,
      take: limit + 1,
      orderBy: { id: cursorDto.sortOrder ?? 'desc' },
      select,
    });

    const hasNext = rows.length > limit;
    const items = hasNext ? rows.slice(0, -1) : rows;
    const nextCursor = hasNext ? items[items.length - 1].id : null;

    return { data: items, nextCursor, hasNext };
  }
}
```

---

### 2.4 Frontend Bundle Optimization (High)
**Files**: `frontend/vite.config.ts`, component lazy loading
**Effort**: 8 hours

**Lazy Load Heavy Components**:
```typescript
// Dashboard.tsx - Lazy load heavy components
const TeamWork = lazy(() => import('./TeamWork').then(m => ({ default: m.TeamWork })));
const Gauge = lazy(() => import('./Gauge').then(m => ({ default: m.Gauge })));
const TeamPresence = lazy(() => import('../components/TeamPresence').then(m => ({ default: m.TeamPresence })));

// In render:
<Suspense fallback={<DashboardSkeleton />}>
  <TeamWork />
  <Gauge value={attendanceRate} />
  <TeamPresence />
</Suspense>
```

**Dynamic Import Heavy Libraries**:
```typescript
// Only load recharts when chart component mounts
const ChartComponent = lazy(() => import('./ChartComponent').then(m => ({ default: m.ChartComponent })));
// ExcelJS only on export click
const exportToExcel = async () => {
  const { default: ExcelJS } = await import('exceljs');
  // ...
};
```

---

### 2.5 Web Vitals & Lighthouse CI (High)
**Files**: New `frontend/vitest.config.ts` updates, `.github/workflows/lighthouse.yml`
**Effort**: 8 hours

**Lighthouse CI Workflow**:
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

**Lighthouse Budget** (`lighthouse-budget.json`):
```json
{
  "ci": {
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.9 }],
        "categories:accessibility": ["error", { "minScore": 0.95 }],
        "categories:best-practices": ["error", { "minScore": 0.9 }],
        "categories:seo": ["error", { "minScore": 0.9 }]
      }
    }
  }
}
```

---

### 2.6 Add Web Vitals Measurement (High)
**File**: New `frontend/src/lib/web-vitals.ts`

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
}

function sendToAnalytics(name: string, value: number) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', name, { value: Math.round(value), metric_id: name });
  }
  console.log(`[Web Vital] ${name}: ${value.toFixed(2)}`);
}
```

---

### 2.7 Lighthouse CI Integration (High)
**File**: `.github/workflows/lighthouse.yml`

```yaml
name: Lighthouse CI
on: [push, pull_request]
jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: cd frontend && npm ci
      - run: cd frontend && npm run build
      - uses: treosh/lighthouse-ci-action@v11
        with:
          urls: |
            http://localhost:5183
            http://localhost:5183/employees
            http://localhost:5183/dashboard
          budgetPath: ./lighthouse-budget.json
          uploadArtifacts: true
```

---

### 2.8 Bundle Size Monitoring in CI (High)
**File**: `.github/workflows/test.yml` (add step)

```yaml
- name: Bundle Size Check
  run: |
    cd frontend
    npm run build
    # Check chunk sizes against thresholds
    node scripts/check-bundle-size.js
```

```javascript
// scripts/check-bundle-size.js
const fs = require('fs');
const path = require('path');
const gzipSize = require('gzip-size');

const distDir = path.join(__dirname, '../dist');
const thresholds = {
  'js/vendor-react': 50 * 1024,      // 50 KB
  'js/vendor-recharts': 30 * 1024,   // 30 KB
  'js/vendor-axios': 15 * 1024,      // 15 KB
  'js/vendor-lucide': 10 * 1024,     // 10 KB
  'js/vendor-other': 50 * 1024,      // 50 KB
  'total': 500 * 1024,               // 500 KB total
};

const files = fs.readdirSync(path.join(distDir, 'assets'));
let total = 0;

for (const file of files) {
  if (file.endsWith('.js')) {
    const content = fs.readFileSync(path.join(distDir, 'assets', file));
    const gzipped = gzipSize.sync(content);
    total += gzipped;
    
    for (const [chunk, limit] of Object.entries(thresholds)) {
      if (file.includes(chunk.replace('js/', ''))) {
        if (gzipped > limit) {
          console.error(`❌ ${chunk} exceeds limit: ${(gzipped/1024).toFixed(1)}KB > ${limit/1024}KB`);
          process.exit(1);
        }
      }
    }
  }
  
  if (total > thresholds.total) {
    console.error(`❌ Total JS exceeds limit: ${(total/1024).toFixed(1)}KB > ${thresholds.total/1024}KB`);
    process.exit(1);
  }
  
  console.log(`✅ Bundle size check passed. Total: ${(total/1024).toFixed(1)}KB`);
```

---

### 2.9 Add k6 Load Tests (High)
**Files**: New `k6/` directory

```javascript
// k6/load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

export const options = {
  stages: [
    { duration: '2m', target: 10 },   // Ramp up
    { duration: '5m', target: 50 },   // Stay at 50 users
    { duration: '2m', target: 100 },  // Ramp to 100
    { duration: '5m', target: 100 },  // Stay at 100
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4114';

export default function () {
  // Login
  const loginRes = http.post(`${BASE_URL}/api/v1/auth/login`, 
    JSON.stringify({ username: 'admin', password: 'E7HHpQcEFezE4OAa1!' }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  
  check(loginRes, {
    'login status 200': (r) => r.status === 200,
    'has access token': (r) => r.json('data.accessToken') !== undefined,
  });
  
  const token = loginRes.json('data.accessToken');
  const headers = { Authorization: `Bearer ${token}` };
  
  // Dashboard
  const dashRes = http.get(`${BASE_URL}/api/v1/dashboard/me`, { headers });
  check(dashRes, { 'dashboard status 200': (r) => r.status === 200 });
  
  // Employee list
  const empRes = http.get(`${BASE_URL}/api/v1/employees?page=1&limit=20`, { headers });
  check(empRes, { 'employees status 200': (r) => r.status === 200 });
  
  sleep(1);
}
```

---

### 2.10 Image Optimization (Medium)
**Files**: `vite.config.ts`, nginx.conf

**Vite Image Optimization**:
```typescript
// vite.config.ts
import imagetools from 'vite-imagetools';

export default defineConfig({
  plugins: [
    react(),
    imagetools({
      defaultDirectives: (url) => {
        return new URLSearchParams({
          format: 'avif;webp;png',
          as: 'picture',
          widths: '320;640;1280;1920',
        });
      },
    }),
  ],
});
```

**nginx.conf - Add Brotli & Image Optimization**:
```nginx
# nginx.conf - Add Brotli
brotli on;
brotli_types text/css application/javascript application/json image/svg+xml;
brotli_min_length 1024;

# Image optimization
location ~* \.(jpg|jpeg|png|webp|avif)$ {
  expires 1y;
  add_header Cache-Control "public, immutable";
  add_header Vary Accept;
}
```

---

### 2.11 Database Connection Pooling (Medium)
**Files**: `backend/src/common/prisma/prisma.service.ts`, `docker-compose.yml`

```typescript
// prisma.service.ts
constructor(private readonly config: ConfigService) {
  super({
    datasources: { 
      db: { 
        url: config.get<string>('app.database.url') 
      } 
    },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
  
  // Connection pool configuration via DATABASE_URL
  // DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=20&pool_timeout=10"
}
```

```yaml
# docker-compose.yml - Add PgBouncer
services:
  pgbouncer:
    image: edoburu/pgbouncer:latest
    environment:
      DATABASES_HOST: db
      DATABASES_PORT: 5432
      DATABASES_DBNAME: sana_hrms
      POOL_MODE: transaction
      DEFAULT_POOL_SIZE: 20
      MAX_CLIENT_CONN: 100
    depends_on:
      - db
    ports:
      - "127.0.0.1:6432:6432"
```

---

### 2.12 Nginx + Brotli + CSP (High)
**Files**: `frontend/nginx.conf`, `backend/src/main.ts`

**nginx.conf - Complete**:
```nginx
server {
  listen 80;
  server_name _;
  
  server_tokens off;
  
  # Security Headers
  add_header X-Frame-Options "SAMEORIGIN" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;
  add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
  add_header Content-Security-Policy "default-src 'self'; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https:; script-src 'self'; connect-src 'self' https:; font-src 'self' https:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';" always;
  
  # Compression
  gzip on;
  gzip_vary on;
  gzip_min_length 1024;
  gzip_types text/css application/javascript application/json image/svg+xml application/xml;
  
  brotli on;
  brotli_types text/css application/javascript application/json image/svg+xml;
  brotli_min_length 1024;
  
  root /usr/share/nginx/html;
  index index.html;
  
  # Static Assets - Long-term caching
  location /assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
    add_header Vary Accept-Encoding;
  }
  
  # API Proxy
  location /api/ {
    proxy_pass http://backend:4114/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 12m;
    proxy_hide_header X-Powered-By;
    
    # Caching for GET requests
    proxy_cache_valid 200 302 10m;
    proxy_cache_valid 404 1m;
  }
  
  # SPA Fallback
  location / {
    try_files $uri $uri/ /index.html;
    add_header Cache-Control "no-cache, no-store, must-revalidate";
  }
}
```

---

### 2.13 Health Checks Enhancement (Medium)
**Files**: `backend/src/health/` (new module)

```typescript
// health/database.health.ts
@Injectable()
export class DatabaseHealthIndicator {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

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
      return { [key]: { status: 'down', error: error.message } };
    }
  }

  async migrationStatus(key: string) {
    try {
      const migrations = await this.prisma.$queryRaw`
        SELECT name, applied_at IS NOT NULL as applied
        FROM "_prisma_migrations"
        ORDER BY finished_at DESC
      `;
      const pending = migrations.filter(m => !m.applied).length;
      
      return {
        [key]: {
          status: pending === 0 ? 'up' : 'degraded',
          pendingMigrations: pending,
          totalMigrations: migrations.length,
        },
      };
    } catch {
      return { [key]: { status: 'up', note: 'Migration table not found (fresh DB)' } };
    }
  }
}
```

---

### 2.14 Add Comprehensive Monitoring (Medium)
**Files**: New monitoring setup

```typescript
// monitoring/web-vitals.ts (frontend)
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
```

---

## Phase 3: Advanced Optimizations (Week 5-6)

---

### 3.1 Virtualized Lists (Medium)
**File**: `frontend/src/components/ui/DataTable.tsx`

```typescript
// Add react-window for virtualization
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';

function VirtualizedDataTable({ rows, columns, rowHeight = 48 }) {
  const Row = ({ index, style }) => (
    <div style={style}>
      {columns.map(col => <div key={col.key}>{rows[index][col.key]}</div>)}
    </div>
  );
  
  return (
    <AutoSizer>
      {({ height, width }) => (
        <List
          height={height}
          width={width}
          itemCount={rows.length}
          itemSize={rowHeight}
          itemData={rows}
        >
          {Row}
        </List>
      )}
    </AutoSizer>
  );
}
```

---

### 3.2 Request Deduplication & Caching (Medium)
**File**: `frontend/src/lib/api.ts`

```typescript
// Request deduplication cache
const pendingRequests = new Map<string, Promise<any>>();

export const api = axios.create({ ... });

api.interceptors.request.use(async (config) => {
  // Only deduplicate GET requests
  if (config.method === 'get') {
    const key = `${config.url}?${new URLSearchParams(config.params).toString()}`;
    
    if (pendingRequests.has(key)) {
      return pendingRequests.get(key);
    }
    
    const promise = api.request(config).finally(() => {
      pendingRequests.delete(key);
    });
    
    pendingRequests.set(key, promise);
    return promise;
  }
  
  return config;
});
```

---

### 3.3 Advanced Caching Strategy (Medium)
**Files**: Backend caching interceptor

```typescript
// backend/src/common/interceptors/cache.interceptor.ts
@Injectable()
export class CacheInterceptor implements NestInterceptor {
  constructor(private readonly cacheManager: CacheManager) {}
  
  async intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest();
    const cacheKey = `api:${request.method}:${request.url}:${JSON.stringify(request.query)}`;
    
    // Only cache GET requests
    if (request.method !== 'GET') {
      return next.handle();
    }
    
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return of(cached);
    }
    
    return next.handle().pipe(
      tap(response => {
        // Only cache successful responses
        if (response?.success) {
          this.cacheManager.set(cacheKey, response, { ttl: 60000 }); // 1 min
        }
      }),
    );
  }
}
```

---

### 3.4 Advanced Database Optimizations (Medium)

#### 3.4.1 Materialized Views for Dashboard
```sql
-- Materialized view for dashboard counts
CREATE MATERIALIZED VIEW mv_dashboard_counts AS
SELECT 
  company_id,
  COUNT(*) FILTER (WHERE deleted_at IS NULL) as total_employees,
  COUNT(*) FILTER (WHERE deleted_at IS NULL AND status = 'ACTIVE') as active_employees,
  COUNT(*) FILTER (WHERE status IN ('SUBMITTED','PENDING_SUPERVISOR','PENDING_MANAGER','PENDING_HR')) as pending_leaves,
  -- ... all dashboard counts
FROM employee
LEFT JOIN leave_request ON leave_request.employee_id = employee.id
-- ... joins
GROUP BY company_id;

-- Refresh every 5 minutes
CREATE OR REPLACE FUNCTION refresh_dashboard_counts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_counts;
  RETURN NULL;
END $$;
```

---

### 3.5 Image Optimization Pipeline (Low)
**Files**: `vite.config.ts`, `nginx.conf`

```typescript
// vite.config.ts - vite-imagetools
import imagetools from 'vite-imagetools';

export default defineConfig({
  plugins: [
    react(),
    imagetools({
      defaultDirectives: (url) => new URLSearchParams({
        format: 'avif;webp;png',
        as: 'picture',
        widths: '320;640;1280;1920',
      }),
    }),
  ],
});
```

---

### 3.6 Advanced Database Optimizations (Medium)

#### 3.5.1 Partial Indexes for Soft Deletes (Already in migration)
```sql
-- Already in migration 20261117_active_unique_indexes
CREATE UNIQUE INDEX Employee_companyId_code_active_idx 
ON Employee (companyId, code) WHERE deletedAt IS NULL;
```

#### 3.5.2 Composite Indexes for Dashboard
```sql
-- Add to schema.prisma or migration
@@index([companyId, status, orgUnitId])
@@index([companyId, status, branchId])
@@index([companyId, employmentType, status])
@@index([companyId, deletedAt, status])
@@index([employeeId, workDate, status])  -- AttendanceRecord
@@index([deviceId, eventTime])           -- AttendanceEvent
@@index([employeeId, eventTime, type])   -- AttendanceEvent
```

---

### 3.6 Advanced Caching Strategy (Medium)

#### 3.6.1 Multi-level Caching
```typescript
// backend/src/common/cache/cache.service.ts
@Injectable()
export class CacheService {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: CacheManager,
    @Inject('REDIS_CLIENT') private redis: Redis,
  ) {}

  // L1: In-memory (short TTL)
  // L2: Redis (longer TTL, distributed)
  async get<T>(key: string): Promise<T | undefined> {
    const l1 = this.memoryCache.get(key);
    if (l1) return l1;
    
    const l2 = await this.redis.get(key);
    if (l2) {
      this.memoryCache.set(key, JSON.parse(l2));
      return JSON.parse(l2);
    }
    return undefined;
  }
  
  async set(key: string, value: any, ttlMs: number = 60000) {
    this.memoryCache.set(key, value);
    await this.redis.setex(key, Math.ceil(ttlMs / 1000), JSON.stringify(value));
  }
}
```

---

## Phase 4: Monitoring & Quality Gates (Week 7-8)

---

### 4.1 CI/CD Quality Gates
**File**: `.github/workflows/test.yml` (enhance)

```yaml
quality-gates:
  runs-on: ubuntu-latest
  needs: [backend-tests, frontend-tests, e2e-tests]
  steps:
    - name: Verify Coverage Thresholds
      run: |
        # Backend thresholds
        npx jest --coverage --coverageThreshold='{"global":{"statements":80,"branches":75,"functions":80,"lines":80}}'
        
    - name: Verify Frontend Coverage
      run: |
        cd frontend && npx vitest run --coverage
        # Check thresholds
        
    - name: Bundle Size Check
      run: node scripts/check-bundle-size.js
      
    - name: Lighthouse CI
      uses: treosh/lighthouse-ci-action@v11
      
    - name: Mutation Testing
      run: npx stryker run --mutationScoreThreshold=70
```

---

### 4.2 Mutation Testing (Medium)
**Tool**: Stryker
**Effort**: 4 hours

```bash
# Install
npm install -D @stryker-mutator/core @stryker-mutator/jest-runner

# Configure
# stryker.conf.json
{
  "$schema": "https://stryker-mutator.io/schema/stryker-schema.json",
  "mutate": ["backend/src/**/*.ts", "!**/*.spec.ts"],
  "testRunner": "jest",
  "reporters": ["html", "clear-text", "progress"],
  "thresholds": { "high": 80, "low": 60, "break": 50 },
  "mutator": { "excludedMutations": ["StringLiteral"] }
}
```

---

### 4.3 Performance Regression Detection (Medium)
**Tool**: Lighthouse CI + custom thresholds

```javascript
// lighthouse-budget.json
{
  "ci": {
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.9 }],
        "categories:accessibility": ["error", { "minScore": 0.95 }],
        "categories:best-practices": ["error", { "minScore": 0.9 }],
        "categories:seo": ["error", { "minScore": 0.9 }],
        "first-contentful-paint": ["error", { "maxNumericValue": 1800 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }],
        "interactive": ["error", { "maxNumericValue": 200 }],
        "total-blocking-time": ["error", { "maxNumericValue": 200 }],
        "resource-size:total": ["warn", { "maxNumericValue": 500000 }],
        "resource-size:script": ["warn", { "maxNumericValue": 200000 }],
        "third-party-count": ["warn", { "maxNumericValue": 10 }]
      }
    }
  }
}
```

---

## Phase 5: Advanced Monitoring (Week 8+)

---

### 5.1 Application Performance Monitoring (APM)
**Tools**: DataDog / New Relic / Grafana + Prometheus

```typescript
// backend/src/common/monitoring/apm.interceptor.ts
@Injectable()
export class ApmInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const start = Date.now();
    const request = context.switchToHttp().getRequest();
    
    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start;
        const route = request.route?.path || request.url;
        const method = request.method;
        
        // Send to APM
        metrics.histogram('http.request.duration', duration, {
          tags: { route, method, status: 'success' }
        });
      }),
      catchError((error) => {
        metrics.increment('http.request.error', { tags: { route, method } });
        throw error;
      })
    );
  }
}
```

---

### 5.2 Database Query Monitoring
```sql
-- Enable pg_stat_statements
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET pg_stat_statements.track = 'all';
ALTER SYSTEM SET pg_stat_statements.max = 10000;
SELECT pg_reload_conf();

-- Monitor slow queries
CREATE VIEW slow_queries AS
SELECT 
  query,
  calls,
  mean_time,
  total_time,
  rows,
  100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
FROM pg_stat_statements
WHERE mean_time > 100
ORDER BY mean_time DESC
LIMIT 20;
```

---

### 5.3 Real User Monitoring (RUM)
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

## Resource Requirements

### Team Allocation
| Role | Week 1-2 | Week 3-4 | Week 5-6 | Week 7-8 |
|------|----------|----------|----------|----------|
| Senior Performance Engineer | 100% | 100% | 100% | 100% |
| Backend Engineer | 50% | 100% | 100% | 50% |
| Frontend Engineer | 50% | 100% | 100% | 50% |
| DevOps Engineer | 25% | 50% | 50% | 100% |
| QA Engineer | 25% | 25% | 50% | 100% |
| Security Engineer | 25% | 25% | 25% | 25% |

### Infrastructure Requirements
| Resource | Specification |
|----------|---------------|
| Staging Environment | 2x backend, 2x frontend, 1x PostgreSQL (prod-like) |
| Load Test Environment | Dedicated, isolated from staging |
| CI/CD Runners | 4x parallel runners |
| Monitoring Stack | Prometheus + Grafana + Loki + Tempo |
| Load Test Tool | k6 (self-hosted or cloud) |

---

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Database migration fails | Medium | High | Test migration on staging copy first; have rollback plan |
| Bundle size regression | Low | Medium | CI gate with thresholds |
| Load test infrastructure | Medium | High | Use cloud k6 or dedicated runner |
| Database connection exhaustion | Medium | High | Implement PgBouncer before load testing |
| Cache invalidation bugs | Medium | Medium | Comprehensive cache invalidation tests |
| CSP breaking UI | Medium | High | Test in staging with report-only mode first |

---

## Success Criteria Checklist

### Phase 1 Complete When:
- [ ] Layout polling memory leak fixed
- [ ] CSP enabled with nonce in production
- [ ] Vite manualChunks configured
- [ ] Refresh token grace = 15s
- [ ] File upload magic bytes validation
- [ ] Bundle analyzer in CI
- [ ] Cursor pagination DTO added

### Phase 2 Complete When:
- [ ] Cursor pagination on all list endpoints
- [ ] Dashboard queries optimized (12 → 1-2 queries)
- [ ] Frontend lazy loading for heavy components
- [ ] Web Vitals measurement active
- [ ] Lighthouse CI passing with budgets
- [ ] Bundle size monitoring in CI
- [ ] k6 load tests passing

### Phase 3 Complete When:
- [ ] Virtualized lists for large tables
- [ ] Request deduplication implemented
- [ ] Image optimization pipeline
- [ ] Advanced caching strategy
- [ ] Materialized views for dashboard

### Phase 4 Complete When:
- [ ] CI/CD quality gates passing
- [ ] Mutation testing > 70%
- [ ] Performance regression detection
- [ ] Lighthouse CI in pipeline
- [ ] Mutation testing configured

### Phase 5 Complete When:
- [ ] APM deployed
- [ ] Database query monitoring
- [ ] RUM implemented
- [ ] Load test results documented
- [ ] All quality gates passing in CI

---

## Success Metrics Dashboard

| KPI | Baseline | Target | Measurement |
|-----|----------|--------|-------------|
| LCP (Mobile) | Unknown | ≤ 2.5s | Lighthouse CI |
| INP | Unknown | ≤ 200ms | Web Vitals |
| CLS | Unknown | ≤ 0.1 | Lighthouse CI |
| Bundle Size (gz) | Unknown | < 500 KB | CI Bundle Check |
| Dashboard Load | ~2-3s | < 1s | Lighthouse/k6 |
| Dashboard API (p95) | ~1000ms | < 200ms | k6 |
| Employee List (p95) | ~400ms | < 150ms | k6 |
| Login (p95) | ~300ms | < 200ms | k6 |
| p95 Latency (all) | Unknown | < 500ms | k6 |
| Error Rate | Unknown | < 0.1% | k6 |
| Mutation Score | N/A | ≥ 70% | Stryker |
| Lighthouse Perf | Unknown | ≥ 90 | Lighthouse CI |
| Accessibility | Unknown | 0 critical/serious | axe-core |

---

## Go/No-Go Decision Matrix

| Release Gate | Criteria | Go/No-Go |
|--------------|----------|----------|
| **Staging Deploy** | All Phase 1-2 complete, tests passing | ⬜ |
| **Load Test** | k6 tests pass at 100 VU, p95 < 500ms | ⬜ |
| **Security Scan** | 0 critical, 0 high vulnerabilities | ⬜ |
| **Penetration Test** | 0 critical, 0 high findings | ⬜ |
| **UAT Sign-off** | Stakeholder approval | ⬜ |
| **Production Deploy** | All gates pass | ⬜ |

---

## Appendix: Quick Reference Commands

```bash
# Frontend
cd frontend
npm run build                    # Production build
npm run build -- --mode=analyze  # Bundle analysis
npm test                         # Unit tests
npx playwright test              # E2E tests
npx playwright test --ui         # UI mode
npx vitest run --coverage        # Coverage

# Backend
cd backend
npm test                         # Unit tests
npm run test:integration         # Integration tests
npm run test:cov                 # Coverage
npm run test:watch               # Watch mode
npx prisma migrate deploy        # Migrations
npx prisma generate              # Prisma client

# Docker
docker compose up -d --build     # Full stack
docker compose logs -f backend   # Backend logs
docker compose logs -f frontend  # Frontend logs

# Load Testing
k6 run k6/load-test.js
k6 run -e BASE_URL=https://staging.example.com k6/load-test.js

# Performance
npx lighthouse http://localhost:5183 --preset=desktop --output=json
npx playwright test --reporter=html
```

---

## Definition of Done

The performance optimization is complete when:

1. ✅ All Phase 1-4 tasks completed
2. ✅ All CI/CD quality gates passing
3. ✅ Load tests passing at target concurrency
4. ✅ Lighthouse CI score ≥ 90
3. ✅ Web Vitals meeting targets (LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1)
4. ✅ Bundle size within thresholds
5. ✅ Zero critical/high security findings
6. ✅ Load test passing at target concurrency
6. ✅ All tests passing in CI/CD
7. ✅ Documentation complete
7. ✅ Stakeholder sign-off

---

**Plan Approved By**: _________________  
**Date**: _________________  
**Next Review**: Sprint Planning  

---

**End of Optimization Plan**