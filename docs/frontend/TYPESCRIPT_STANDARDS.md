# Sana HRMS - TypeScript Standards

**Version:** 1.0  
**Date:** 2026-11-18  
**Audience:** Frontend Developers  

---

## 1. TypeScript Configuration

### 1.1 tsconfig.json

The project uses strict TypeScript configuration:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "lib": ["ES2022"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "jsx-jsx",
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "useUnknownInCatchVariables": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "noImplicitReturns": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "useUnknownInCatchVariables": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "noImplicitReturns": true,
    "noUncheckedIndexedAccess": true
  }
}
```

---

## 2. TypeScript Standards

### 2.1 Type Definitions

All TypeScript types must follow these conventions:

```typescript
// Good: Explicit types with descriptive names
interface Employee {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  nationalId?: string;
  status: EmployeeStatus;
  employmentType: EmploymentType;
  hireDate?: string;
  mobile?: string;
  email?: string;
  position?: { id: string; title: string } | null;
  companyId: string;
}

// Bad: Using `any` type
interface Employee {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  position?: any; // BAD: Use specific type
  companyId: string;
}
```

### 2.2 API Response Types

All API responses must follow the standard format:

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
  };
  timestamp: string;
}

interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
    nextCursor?: string | null;
  };
}
```

### 2.3 Component Props Types

All component props must be explicitly typed:

```typescript
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'success';
  size?: 'sm' | 'md';
  loading?: boolean;
}

export function Button({ variant = 'primary', size = 'md', loading, className = '', children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      className={`btn btn-${variant}${size === 'sm' ? ' btn-sm' : ''} ${className}`}
      disabled={disabled || loading}
      type="button"
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <LoaderCircle className="button-spinner" size={15} aria-hidden="true" />}
      {children}
    </button>
  );
}
```

### 2.4 Form Data Types

All form data must be typed:

```typescript
interface EmployeeForm {
  companyId: string;
  code: string;
  firstName: string;
  lastName: string;
  nationalId?: string;
  mobile?: string;
  email?: string;
  hireDate?: string;
  employmentType: EmploymentType;
  monthlyBaseSalary?: number;
}
```

### 2.5 Error Types

All errors must be typed:

```typescript
interface ApiError {
  code: string;
  message: string;
  details?: Array<{ field: string; message: string }>;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  timestamp: string;
}
```

---

## 3. TypeScript Best Practices

### 3.1 Do's

```typescript
// ✅ Explicit types
interface User {
  id: string;
  username: string;
  email: string | null;
}

// ✅ Type guards
function isString(value: unknown): value is string {
  return typeof value === 'string';
}

// ✅ Discriminated unions
type Status = 
  | { status: 'PENDING' }
  | { status: 'APPROVED', approvedAt: string }
  | { status: 'REJECTED', reason: string };

// ✅ Readonly for immutable data
interface Config {
  readonly apiUrl: string;
  readonly timeout: number;
}

// ✅ Type guards for API responses
function isEmployee(data: unknown): data is Employee {
  return data && typeof data === 'object' && 'id' in data && 'code' in data;
}
```

### 3.2 Don'ts

```typescript
// ❌ Avoid any
interface User {
  id: any;
  username: any;
  email: any;
}

// ❌ Avoid implicit any
function processData(data) {
  return data.value;
}

// ❌ Avoid unnecessary type assertions
const user = data as User; // BAD: Unnecessary assertion
const user = data as unknown as User; // BAD: Double assertion

// ❌ Avoid loose object types
interface Config {
  [key: string]: any; // BAD: Too loose
}
```

---

## 4. Common Type Patterns

### 4.1 API Response Types

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
  };
  timestamp: string;
}

interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
    nextCursor?: string | null;
  };
}
```

### 4.2 Component Props Types

```typescript
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'success';
  size?: 'sm' | 'md';
  loading?: boolean;
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  required?: boolean;
  error?: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  required?: boolean;
  error?: string;
  options: { id: string; label: string }[];
}
```

### 4.3 Error Types

```typescript
interface ApiError {
  code: string;
  message: string;
  details?: Array<{ field: string; message: string }>;
}

interface ValidationError extends ApiError {
  code: 'VALIDATION_ERROR';
  details: Array<{ field: string; message: string }>;
}
```

---

## 5. Type Safety Checklist

| Check | Status |
|-------|--------|
| No `any` types | ☐ |
| No implicit any | ☐ |
| Strict null checks | ☐ |
| Strict function types | ☐ |
| Strict property initialization | ☐ |
| No implicit this | ☐ |
| No unused locals | ☐ |
| No unused parameters | ☐ |
| No fallthrough cases | ☐ |
| Exact optional property types | ☐ |
| No implicit override | ☐ |
| No property access from index signature | ☐ |
| No implicit returns | ☐ |
| No unchecked indexed access | ☐ |

---

## 6. Common Type Patterns

### 6.1 API Response Types

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  timestamp: string;
}

interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
    nextCursor?: string | null;
  };
}
```

### 6.2 Component Props Types

```typescript
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'success';
  size?: 'sm' | 'md';
  loading?: boolean;
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  required?: boolean;
  error?: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  required?: boolean;
  error?: string;
  options: { id: string; label: string }[];
}
```

### 6.3 Error Types

```typescript
interface ApiError {
  code: string;
  message: string;
  details?: Array<{ field: string; message: string }>;
}

interface ValidationError extends ApiError {
  code: 'VALIDATION_ERROR';
  details: Array<{ field: string; message: string }>;
}
```

---

## 7. Type Checking Commands

```bash
# TypeScript type check
npx tsc --noEmit

# Watch mode
npx tsc --noEmit --watch

# With project references
npx tsc --build
```

---

## 8. TypeScript Version

| Package | Version |
|---------|---------|
| TypeScript | ^5.7.2 |
| @types/react | ^18.3.18 |
| @types/react-dom | ^18.3.5 |

---

## 9. Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/)
- [TypeScript React CheatSheet](https://github.com/typescript-cheatsheets/react-typescript-cheatsheet)

---

**Document Version:** 1.0  
**Last Updated:** 2026-11-18  
**Next Review:** Sprint Planning  
**Owner:** Frontend Engineering Team