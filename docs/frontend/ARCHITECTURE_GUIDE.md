# Sana HRMS - Frontend Architecture Guide

**Version:** 1.0  
**Date:** 2026-11-18  
**Audience:** Frontend Developers, Architects  

---

## 1. Architecture Overview

The Sana HRMS frontend follows a modern React architecture with clear separation of concerns, lazy loading, and type safety. The architecture is designed for scalability, maintainability, and performance.

### 1.1 Architecture Diagram

```
src/
├── App.tsx                 # Application root with routing
├── lib/                    # Core libraries and utilities
│   ├── api.ts              # API client with interceptors
│   ├── auth.tsx            # Authentication context
│   ├── format.ts           # Persian date/time formatting
│   ├── useDeadlineClock.ts # Deadline countdown hook
│   ├── useList.ts          # List data fetching hook
│   └── theme.ts            # Theme management
├── layout/                 # Application layout
│   └── Layout.tsx          # Main layout with sidebar and header
├── lib/                    # Shared utilities
│   ├── api.ts              # API client
│   ├── auth.tsx            # Auth context
│   ├── format.ts           # Formatting utilities
│   ├── useDeadlineClock.ts # Deadline countdown
│   ├── useList.ts          # List data fetching
│   ├── workCategories.ts   // Work category definitions
│   └── workflowPayloads.ts // Workflow payload builders
├── pages/                  # Page components (31 pages)
│   ├── App.tsx             # Main app with routing
│   ├── Dashboard.tsx       # Main dashboard
│   ├── Employees.tsx       # Employee management
│   ├── ...                 # Other pages
├── components/             # Reusable components
│   ├── ui/                 # Base UI components
│   │   ├── base.tsx        # Base components (Button, Input, etc.)
│   │   ├── DataTable.tsx   # Data table with sorting
│   │   ├── DatePicker.tsx  # Persian date picker
│   │   ├── EntityPicker.tsx # Entity selection
│   │   └── Modal.tsx       # Modal dialog
│   ├── ChangePassword.tsx  # Password change
│   ├── ErrorBoundary.tsx   # Error boundary
│   ├── DailyAttendance.tsx # Daily attendance
│   ├── GlobalSearch.tsx    # Global search
│   ├── PageBoundary.tsx    # Page boundary wrapper
│   ├── TaskCountdown.tsx   # Task countdown
│   ├── TaskRetryReview.tsx # Task retry review
│   ├── TaskStatusMark.tsx  # Task status mark
│   ├── TeamPresence.tsx    # Team presence
│   └── TeamWork.tsx        # Team work overview
└── styles/                 # Styles
    └── tokens.css          # Design tokens
```

---

## 2. Architecture Patterns

### 2.1 Component Hierarchy

```
App
├── ErrorBoundary
│   └── Layout
│       ├── Sidebar
│       ├── Header
│       │   ├── User Profile
│       │   ├── Notifications
│       │   └── Settings
│       └── Main Content
│           ├── Pages (31 total)
│           │   ├── Login
│           │   ├── Dashboard
│           │   ├── Employees
│           │   ├── Contracts
│           │   └── ...
│           └── NotFound
```

### 2.2 State Management

The frontend uses a hybrid state management approach:

1. **React Context** - For global authentication state (`useAuth`)
2. **Custom Hooks** - For data fetching (`useList`, `useItem`)
3. **Local Component State** - For UI state (forms, modals, toggles)
4. **URL State** - For shareable filters and pagination (via URLSearchParams)

### 2.3 Data Flow

```
User Action → Component → Custom Hook → API Client → Backend API
                                      ↓
                              Response → Component State → UI Update
```

---

## 3. Directory Structure Guidelines

### 3.1 Feature-Based Organization

```
src/
├── pages/          # Page components (route-level)
├── components/     # Reusable UI components
│   ├── ui/         # Base UI components
│   └── *.tsx       # Feature-specific components
├── lib/            # Shared libraries and utilities
│   ├── api.ts      # API client
│   ├── auth.tsx    # Authentication
│   ├── format.ts   # Formatting utilities
│   ├── useDeadlineClock.ts
│   ├── useList.ts
│   └── ...
├── layout/         # Application layout
└── styles/         # Global styles and design tokens
```

### 3.2 Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Components | PascalCase | `EmployeePanel`, `DataTable` |
| Functions | camelCase | `useList`, `formatJalali` |
| Constants | UPPER_SNAKE_CASE | `EMPLOYEE_STATUS_LABELS` |
| Files | kebab-case | `employee-panel.tsx` |
| CSS classes | kebab-case | `.employee-panel`, `.btn-primary` |
| IDs | kebab-case | `employee-search-input` |

---

## 4. Component Development Guidelines

### 4.1 Component Template

```tsx
import { useEffect, useMemo, useState, useCallback } from 'react';

interface ComponentProps {
  prop1: string;
  prop2?: number;
  onChange?: (value: string) => void;
  className?: string;
}

export function ComponentName({ prop1, prop2 = '', onChange, className = '', ...rest }: ComponentProps) {
  // Derived state
  const derivedValue = useMemo(() => {
    return compute(prop1);
  }, [prop1]);

  // Event handlers
  const handleChange = useCallback((value: string) => {
    onChange?.(value);
  }, [onChange]);

  // Effects
  useEffect(() => {
    // Side effects
    return () => {
      // Cleanup
    };
  }, [prop1]);

  return (
    <div className={`component ${className}`}>
      {/* Content */}
    </div>
  );
}
```

### 4.2 Component Checklist

- [ ] TypeScript types for all props
- [ ] Proper error handling
- [ ] Loading states
- [ ] Empty states
- [ ] Accessibility attributes (aria-label, role)
- [ ] Keyboard navigation
- [ ] Responsive design
- [ ] RTL support
- [ ] JSDoc documentation

---

## 5. State Management Guidelines

### 5.1 State Ownership

| State Type | Location | Example |
|------------|----------|---------|
| Local UI State | Component state | Form inputs, modal open/close |
| Shared UI State | Context | Authentication, theme |
| Server State | Custom hooks | Employee list, task data |
| URL State | URLSearchParams | Filters, pagination, search |

### 5.2 State Management Rules

1. **Component-local state** for UI interactions (form inputs, modal open/close)
2. **Shared state** for genuinely shared application concerns (auth, theme)
3. **Server state** for backend-managed data (employee list, task data)
4. **URL state** for shareable filters and pagination

### 5.3 Context Usage

Use Context sparingly for truly global state:

```typescript
// Good: Authentication context
const { user, hasPermission } = useAuth();

// Good: Theme context
const { dark, setDark } = useTheme();

// Bad: Component-specific state in Context
const { employeeList } = useEmployeeContext(); // Should be useList hook
```

---

## 6. API Integration Guidelines

### 6.1 API Client Usage

All API calls must go through the centralized `api` client:

```typescript
import { api } from '../lib/api';

// GET request
const response = await api.get('/api/v1/employees', { params: { page: 1, limit: 20 } });

// POST request
const response = await api.post('/api/v1/employees', data);

// PUT request
const response = await api.put(`/api/v1/employees/${id}`, data);

// DELETE request
const response = await api.delete(`/api/v1/employees/${id}`);
```

### 6.2 Error Handling

All API calls must handle errors:

```typescript
try {
  const response = await api.get('/api/v1/employees');
  setRows(response.data.data);
} catch (error) {
  setError(apiErrorMessage(error));
  setRows([]);
}
```

### 6.3 Request Cancellation

All long-running requests must support cancellation:

```typescript
useEffect(() => {
  const controller = new AbortController();
  
  (async () => {
    try {
      const response = await api.get('/api/v1/employees', { signal: controller.signal });
      setRows(response.data.data);
    } catch (e) {
      if (axios.isCancel(e) || (e as Error).name === 'CanceledError') return;
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  })();
  
  return () => {
    controller.abort();
  };
}, [dependency]);
```

---

## 7. Forms and Validation Guidelines

### 7.1 Form Structure

All forms must follow this structure:

```tsx
<Field label="Field Label" required>
  <Input 
    type="text" 
    className="ltr" 
    value={form.field} 
    onChange={(e) => setForm((f) => ({ ...f, field: e.target.value }))} 
  />
</Field>
```

### 7.2 Validation Rules

All validation rules must match backend validation:

- Password: Minimum 10 characters, upper/lower case, digit, symbol
- National ID: 10 digits
- Mobile: Iranian mobile format (09xxxxxxxxx)
- Email: Valid email format
- Date: Jalali date format (۱۴۰۵/۰۸/۲۴)

### 7.3 Error Display

All form errors must be displayed inline:

```tsx
{error && <span className="text-red-500 text-xs">{error}</span>}
```

---

## 8. Persian, RTL, and Jalali Guidelines

### 8.1 RTL Layout

All components must support RTL layout:

```css
/* Use logical properties */
margin-inline-start: 1rem;
padding-inline-end: 1rem;
text-align: start;
direction: rtl;
```

### 8.2 Jalali Date Handling

All date handling must use Jalali calendar:

```typescript
import { formatJalali, toPersianDigits, parseDateInput } from '../lib/format';

// Display date
const formatted = formatJalali(date);

// Parse input
const iso = parseDateInput('۱۴۰۵/۰۸/۲۴');

// Format for display
const display = toPersianDigits(date);
```

### 8.3 Font Usage

All text must use Vazirmatn font:

```css
font-family: 'Vazirmatn', Tahoma, sans-serif;
```

---

## 8. Testing Guidelines

### 8.1 Unit Tests

All components must have unit tests:

```tsx
import { test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChangePassword } from './ChangePassword';

test('shows strength meter for weak password', async () => {
  const user = userEvent.setup();
  renderWithProviders(<ChangePassword />);
  
  await user.click(screen.getByTitle('تغییر گذرواژهٔ من'));
  await user.type(screen.getByRole('textbox', { name: /گذرواژهٔ جدید/i }), '123');
  
  await expect(screen.getByText('بسیار ضعیف')).toBeVisible();
});
```

### 8.2 E2E Tests

All critical user journeys must have E2E tests:

```typescript
// frontend/tests/e2e/journeys.spec.ts
test('Login with valid credentials', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[placeholder="نام کاربری"]', 'admin');
  await page.fill('input[type="password"]', 'E7HHpQcEFezE4OAa1!');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/');
});
```

---

## 8. Performance Guidelines

### 8.1 Component Performance

- Use `React.memo` for pure components
- Use `useMemo` for expensive calculations
- Use `useCallback` for stable function references
- Lazy load heavy components
- Virtualize large lists

### 8.2 Bundle Size

- Lazy load heavy components
- Code split by route
- Tree-shake unused imports
- Optimize images

---

## 8. Accessibility Guidelines

### 8.1 ARIA Attributes

All interactive elements must have appropriate ARIA attributes:

```tsx
<button 
  type="button" 
  className="header-icon-btn" 
  title="تغییر گذرواژهٔ من" 
  aria-label="تغییر گذرواژهٔ من"
  onClick={() => { clear(); setOpen(true); }}
>
  <KeyRound size={18} />
</button>
```

### 8.2 Keyboard Navigation

All interactive components must be keyboard navigable:

- Tab order must be logical
- Focus indicators must be visible
- Escape key must close modals and dropdowns
- Arrow keys must navigate within components

### 8.3 Color Contrast

All text must meet WCAG 2.1 AA contrast ratio (4.5:1 for normal text, 3:1 for large text).

---

## 8. Testing Guidelines

### 8.1 Unit Tests

All components must have unit tests:

```tsx
// frontend/src/components/ChangePassword.test.tsx
import { test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChangePassword } from './ChangePassword';

test('shows strength meter for weak password', async () => {
  const user = userEvent.setup();
  renderWithProviders(<ChangePassword />);
  
  await user.click(screen.getByTitle('تغییر گذرواژهٔ من'));
  await user.type(screen.getByRole('textbox', { name: /گذرواژهٔ جدید/i }), '123');
  
  await expect(screen.getByText('بسیار ضعیف')).toBeVisible();
});
```

### 8.2 E2E Tests

All critical user journeys must have E2E tests:

```typescript
// frontend/tests/e2e/journeys.spec.ts
test('Login with valid credentials', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[placeholder="نام کاربری"]', 'admin');
  await page.fill('input[type="password"]', 'E7HHpQcEFezE4OAa1!');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/');
});
```

---

## 8. Deployment Checklist

### 8.1 Pre-Deploy Checklist

- [ ] All unit tests pass
- [ ] All E2E tests pass
- [ ] TypeScript compilation successful
- [ ] ESLint passes
- [ ] Bundle size within limits
- [ ] Lighthouse CI passing
- [ ] Accessibility tests passing
- [ ] Persian RTL verification
- [ ] Jalali calendar verification
- [ ] Responsive design verification

---

## 8. Rollback Plan

If issues are discovered after deployment:

1. Revert frontend changes using git
2. Clear browser cache for users
3. Monitor error rates in Sentry
4. Roll back to previous version if critical issues

---

## 8. Appendix

### 8.1 Key Files Modified

| File | Purpose |
|------|---------|
| `frontend/src/App.tsx` | Application root with routing |
| `frontend/src/layout/Layout.tsx` | Main layout with sidebar and header |
| `frontend/src/lib/api.ts` | API client with interceptors |
| `frontend/src/lib/auth.tsx` | Authentication context |
| `frontend/src/lib/format.ts` | Persian date/time formatting |
| `frontend/src/lib/useList.ts` | List data fetching hook |
| `frontend/src/lib/useDeadlineClock.ts` | Deadline countdown hook |
| `frontend/src/components/ui/base.tsx` | Base UI components |
| `frontend/src/components/ui/DataTable.tsx` | Data table with sorting |
| `frontend/src/components/ui/DatePicker.tsx` | Persian date picker |
| `frontend/src/components/ui/EntityPicker.tsx` | Entity selection |
| `frontend/src/components/ui/Modal.tsx` | Modal dialog |
| `frontend/src/components/ChangePassword.tsx` | Password change |
| `frontend/src/components/ErrorBoundary.tsx` | Error boundary |
| `frontend/src/pages/Dashboard.tsx` | Main dashboard |
| `frontend/src/pages/Employees.tsx` | Employee management |
| `frontend/src/styles/tokens.css` | Design tokens |

### 8.2 Testing Commands

```bash
# Frontend tests
cd frontend
npm test

# E2E tests
npx playwright test

# TypeScript check
npm run build

# Bundle analysis
npm run build -- --mode=analyze
```

---

**Document Version:** 1.0  
**Last Updated:** 2026-11-18  
**Next Review:** Sprint Planning  
**Owner:** Frontend Engineering Team