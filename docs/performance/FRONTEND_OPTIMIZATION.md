# Sana HRMS - Frontend Optimization Guide

**Version:** 1.0  
**Date:** 2026-11-18  
**Audience:** Frontend Developers, Performance Engineers

---

## 1. Bundle Optimization

### 1.1 Vite Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
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
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: {
    port: 5183,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4114',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    minify: 'esbuild',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-axios': ['axios'],
          'vendor-recharts': ['recharts'],
          'vendor-lucide': ['lucide-react'],
          'vendor-forms': ['react-hook-form', '@hookform/resolvers'],
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

### 1.2 Bundle Analysis

```bash
# Analyze bundle
npm run build -- --mode=analyze

# Check chunk sizes
npm run build && npx gzip-size-cli dist/assets/*.js
```

### 1.3 Chunk Size Budgets

| Chunk | Budget (gz) | Current | Status |
|-------|-------------|---------|--------|
| vendor-react | 50 KB | TBD | ❓ |
| vendor-recharts | 30 KB | TBD | ❓ |
| vendor-axios | 15 KB | TBD | ❓ |
| vendor-lucide | 10 KB | TBD | ❓ |
| vendor-forms | 20 KB | TBD | ❓ |
| vendor-jalaali | 10 KB | TBD | ❓ |
| vendor-utils | 10 KB | TBD | ❓ |
| vendor-other | 50 KB | TBD | ❓ |
| **Total** | **500 KB** | TBD | ❓ |

---

## 2. React Rendering Optimization

### 2.1 Lazy Loading Heavy Components

```tsx
// src/pages/Dashboard.tsx
import { lazy, Suspense } from 'react';

const TeamWork = lazy(() => import('../components/TeamWork').then(m => ({ default: m.TeamWork })));
const Gauge = lazy(() => import('./Gauge').then(m => ({ default: m.Gauge })));
const TeamPresence = lazy(() => import('../components/TeamPresence').then(m => ({ default: m.TeamPresence })));
const TaskCountdown = lazy(() => import('../components/TaskCountdown').then(m => ({ default: m.TaskCountdown })));

export default function Dashboard() {
  // ...
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <TeamPresence />
      <Gauge value={attendanceRate} />
      <TeamWork />
    </Suspense>
  );
}
```

### 2.2 Dynamic Import Heavy Libraries

```typescript
// Only load recharts when chart component mounts
const ChartComponent = lazy(() => import('./ChartComponent').then(m => ({ default: m.ChartComponent })));

// ExcelJS only on export click
const exportToExcel = async () => {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  // ...
};
```

### 2.3 Memoization Patterns

```tsx
// Memoize expensive computations
const weekBars = useMemo(() => {
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' });
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - 6 + index);
    return date;
  });
  const counts = days.map(date => attendance.filter(row => row.workDate.slice(0, 10) === formatter.format(date)).length);
  const max = Math.max(1, ...counts);
  return counts.map((c, i) => ({
    label: new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', weekday: 'short' }).format(days[i]),
    value: c,
    height: Math.round((c / max) * 100),
  }));
}, [attendance]);

// Memoize column definitions
const columns = useMemo(() => [
  { key: 'NEW', title: 'جدید' },
  { key: 'IN_PROGRESS', title: 'در حال انجام' },
  { key: 'DONE', title: 'انجام‌شده' },
  { key: 'CANCELLED', title: 'لغوشده' },
].map(d => ({
  ...d,
  cards: tasks.filter(t => t.status === d.key),
)), [tasks]);

// Memoize components
const TaskCard = React.memo(function TaskCard({ task }) {
  // ...
});

// Memoize callbacks
const handleTaskClick = useCallback((taskId: string) => {
  navigate(`/tasks/${taskId}`);
}, [navigate]);
```

---

## 3. React Query / Data Fetching

### 3.1 Request Deduplication

```typescript
// src/lib/api.ts
const pendingRequests = new Map<string, Promise<any>>();

export const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  timeout: 30000,
});

api.interceptors.request.use(async (config) => {
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

### 3.2 Request Cancellation

```tsx
// Dashboard.tsx
useEffect(() => {
  const controller = createAbortController();
  let active = true;
  
  (async () => {
    try {
      const [m, mg, t, at] = await Promise.all([
        api.get('/dashboard/me', { signal: controller.signal }),
        canMgmt ? api.get('/dashboard/management', { signal: controller.signal }) : null,
        hasPermission('tasks.view') ? api.get('/tasks?limit=60', { signal: controller.signal }) : null,
        hasPermission('attendance.view') ? api.get('/attendance/records?limit=200', { signal: controller.signal }) : null,
      ]);
      
      if (!active) return;
      setMy(m?.data?.data ?? null);
      if (mg) setMgmt(mg?.data?.data ?? null);
      setTasks(t?.data?.data?.items ?? t?.data?.data ?? []);
      setAttendance(at?.data?.data?.items ?? at?.data?.data ?? []);
    } catch (e) {
      if (axios.isCancel(e) || (e as Error).name === 'CanceledError') return;
      toast('error', apiErrorMessage(e));
    } finally {
      if (active) setLoading(false);
    }
  })();
  
  return () => {
    active = false;
    controller.abort();
  };
}, [canMgmt, toast]);
```

---

## 4. Virtualization for Large Lists

### DataTable with Virtualization

```tsx
// src/components/ui/DataTable.tsx
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowHeight?: number;
  rowActions?: (row: T) => React.ReactNode;
}

export function DataTable<T>({ columns, rows, rowHeight = 48, rowActions }: DataTableProps<T>) {
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => (
    <div style={style}>
      {columns.map(col => (
        <div key={col.key} style={{ width: col.width }}>
          {col.render ? col.render(rows[index]) : rows[index][col.key]}
        </div>
      )}
    </div>
  );
  
  return (
    <AutoSizer>
      {({ height, width }) => (
        <List
          height={height}
          width={width}
          itemCount={rows.length}
          itemSize={48}
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

## 4. Image Optimization

### 4.1 Vite Image Tools

```typescript
// vite.config.ts
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

### 4.2 Responsive Images in Components

```tsx
// components/Avatar.tsx
function Avatar({ src, alt, size = 40 }) {
  return (
    <picture>
      <source srcSet={`${src}?w=32&f=avif`} type="image/avif" />
      <source srcSet={`${src}?w=32&f=webp`} type="image/webp" />
      <img 
        src={`${src}?w=32`} 
        alt={alt} 
        width={size} 
        height={size}
        loading="lazy"
        decoding="async"
      />
    </picture>
  );
}
```

---

## 5. CSS & Layout Optimization

### 5.1 CSS Containment

```css
/* components/ui/DataTable.css */
.data-table {
  contain: layout style;
}

.kanban {
  contain: layout style;
}

.kanban-col {
  contain: layout style paint;
}
```

### 5.2 CSS Containment for Layout

```css
/* layouts/Layout.css */
.layout {
  contain: layout style;
}

.sidebar {
  contain: layout style;
}

.main-content {
  contain: layout style;
}
```

---

## 5. Code Splitting Strategy

### 5.1 Route-Based Splitting

```tsx
// App.tsx
import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Employees = lazy(() => import('./pages/Employees'));
const Payroll = lazy(() => import('./pages/Payroll'));
const Reports = lazy(() => import('./pages/Reports'));

function PageLoading() {
  return (
    <div className="flex" style={{ padding: 40, justifyContent: 'center' }}>
      <span className="spinner" style={{ width: 28, height: 28 }} />
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth><Layout /></RequireAuth>}>
          <Route path="/" element={<HomeRoute />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/employees" element={<Employees />} />
          <Route path="/payroll" element={<Payroll />} />
          <Route path="/reports" element={<Reports />} />
          {/* ... */}
        </Route>
      </Routes>
    </Suspense>
  );
}
```

---

## 6. Font Optimization

### 6.1 Font Loading

```html
<!-- index.html -->
<link rel="preload" href="/fonts/Vazirmatn.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/Vazirmatn-Bold.woff2" as="font" type="font/woff2" crossorigin>
```

```css
/* styles/fonts.css */
@font-face {
  font-family: 'Vazirmatn';
  src: url('/fonts/Vazirmatn.woff2') format('woff2');
  font-weight: 400;
  font-display: swap;
}

@font-face {
  font-family: 'Vazirmatn';
  src: url('/fonts/Vazirmatn-Bold.woff2') format('woff2');
  font-weight: 700;
  font-display: swap;
}

@font-face {
  font-family: 'Vazirmatn';
  src: url('/fonts/Vazirmatn-Medium.woff2') format('woff2');
  font-weight: 500;
  font-display: swap;
}
```

---

## 6. Monitoring & Measurement

### 6.1 Web Vitals

```typescript
// src/lib/web-vitals.ts
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

```tsx
// App.tsx
import { initWebVitals } from './lib/web-vitals';

function App() {
  useEffect(() => {
    initWebVitals();
  }, []);
  
  return <AppContent />;
}
```

### 6.2 Lighthouse CI

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

## 7. Checklist

### Pre-Deploy Checklist

- [ ] Bundle size < 500 KB gzipped total
- [ ] Largest chunk < 150 KB gzipped
- [ ] Lighthouse Performance ≥ 90
- [ ] LCP ≤ 2.5s (Mobile)
- [ ] INP ≤ 200ms
- [ ] CLS ≤ 0.1
- [ ] All images WebP/AVIF
- [ ] All images have responsive sizes
- [ ] Lazy loading on all images below fold
- [ ] Font display: swap
- [ ] CSP enabled with nonce
- [ ] Bundle analyzer in CI
- [ ] Lighthouse CI in CI/CD

---

## 8. Quick Reference

### Key Files to Modify

| File | Purpose |
|------|---------|
| `vite.config.ts` | Bundle splitting, image optimization |
| `src/layout/Layout.tsx` | Memory leak fix, polling |
| `src/pages/Dashboard.tsx` | Lazy loading, memoization |
| `src/lib/api.ts` | Request deduplication, cancellation |
| `src/components/ui/DataTable.tsx` | Virtualization |
| `src/components/ChangePassword.tsx` | Password strength meter |
| `src/components/ErrorBoundary.tsx` | Error boundary |
| `src/App.tsx` | Error boundary wrapper, lazy routes |
| `frontend/vite.config.ts` | Build config, chunking |
| `frontend/vitest.config.ts` | Test config, coverage thresholds |

### Key Commands

```bash
# Development
npm run dev                    # Start dev server
npm run build                  # Production build
npm run build -- --mode=analyze  # Bundle analysis
npm test                       # Unit tests
npm run test:watch             # Watch mode

# Analysis
npm run build -- --mode=analyze  # Bundle analysis
npx vite-bundle-analyzer dist    # Visual analysis

# Testing
npm test                         # Unit tests
npm run test:watch               # Watch mode
npx playwright test              # E2E tests
npx playwright test --ui         # UI mode
npx playwright test --headed     # Headed mode

# Performance
npm run build && npx vite-bundle-analyzer dist
npx lighthouse http://localhost:5183 --preset=desktop
npx playwright test --reporter=html
```

---

**Document Version:** 1.0  
**Last Updated:** 2026-11-18  
**Next Review:** Sprint Planning