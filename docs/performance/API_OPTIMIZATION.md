# Sana HRMS - API Optimization Guide

**Version:** 1.0  
**Date:** 2026-11-18  
**Audience:** Backend Developers, API Engineers, Performance Engineers

---

## 1. API Design Principles

### 1.1 RESTful Design Standards

| Principle | Implementation |
|-----------|----------------|
| **Resource-based URLs** | `/api/v1/employees`, `/api/v1/employees/{id}` |
| **HTTP Methods** | GET (read), POST (create), PUT (update), PATCH (partial), DELETE |
| **Status Codes** | 200 (OK), 201 (Created), 400 (Bad Request), 401 (Unauthorized), 403 (Forbidden), 404 (Not Found), 409 (Conflict), 422 (Validation Error), 429 (Rate Limited), 500 (Server Error) |
| **Response Format** | `{ success: boolean, data?: T, error?: { code, message, details }, timestamp: string }` |
| **Versioning** | URL versioning: `/api/v1/` |
| **Pagination** | Cursor-based (preferred) + offset fallback |

### 1.2 Response Format Standard

```typescript
// Success Response
{
  "success": true,
  "data": { ... },
  "timestamp": "2026-11-18T12:00:00.000Z"
}

// Paginated Response
{
  "success": true,
  "data": [...],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false,
    "nextCursor": "abc123"  // for cursor pagination
  },
  "timestamp": "2026-11-18T12:00:00.000Z"
}

// Error Response
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      { "field": "email", "message": "Invalid email format" }
    ]
  },
  "timestamp": "2026-11-18T12:00:00.000Z"
}
```

---

## 2. API Performance Optimization

### 2.1 Request/Response Optimization

#### 2.1.1 Field Selection (Sparse Fields)

```typescript
// Query parameter: fields=id,code,firstName,lastName
// Controller
@Get()
async list(@Query() query: EmployeeQueryDto, @Query('fields') fields?: string) {
  const select = fields?.split(',').reduce((acc, field) => {
    acc[field.trim()] = true;
    return acc;
  }, {} as Record<string, boolean>);
  
  return this.service.list(query, pagination, user, select);
}

// Service
async list(query, pagination, user, select?: Record<string, boolean>) {
  return this.prisma.employee.findMany({
    where: this.buildWhere(query, user),
    select: select || EMPLOYEE_SUMMARY, // Default to summary, allow override
    // ...
  });
}
```

#### 2.1.2 Response Compression

```typescript
// main.ts
import * as compression from 'compression';

app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
  threshold: 1024, // Only compress responses > 1KB
  level: 6, // Balance between speed and compression
}));
```

---

## 2.2 Request Optimization

### 2.2.1 Request Deduplication

```typescript
// src/common/interceptors/deduplication.interceptor.ts
@Injectable()
export class DeduplicationInterceptor implements NestInterceptor {
  private pendingRequests = new Map<string, Promise<any>>();

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    
    // Only deduplicate GET requests
    if (request.method !== 'GET') {
      return next.handle();
    }

    const key = `${request.method}:${request.url}?${new URLSearchParams(request.query).toString()}`;
    
    if (this.pendingRequests.has(key)) {
      return from(this.pendingRequests.get(key)!);
    }

    const observable = next.handle().pipe(
      finalize(() => this.pendingRequests.delete(key))
    );

    this.pendingRequests.set(key, lastValueFrom(observable));
    return observable;
  }
}
```

```typescript
// app.module.ts
providers: [
  { provide: APP_INTERCEPTOR, useClass: DeduplicationInterceptor },
]
```

---

### 2.2.2 Request Cancellation

```typescript
// Already implemented in api.ts with AbortController
// Frontend usage:
const controller = new AbortController();
const response = await api.get('/employees', { signal: controller.signal });

// Cancel on unmount
useEffect(() => {
  return () => controller.abort();
}, []);
```

---

## 3. Response Optimization

### 3.1 Payload Size Reduction

#### 3.1.1 Sparse Fieldsets

```typescript
// Controller
@Get()
async list(
  @Query() query: PaginationDto,
  @Query('fields') fields?: string,
  @CurrentUser() user: AuthenticatedUser,
) {
  const select = fields?.split(',').reduce((acc, field) => {
    acc[field.trim()] = true;
    return acc;
  }, {} as Record<string, boolean>);

  return this.service.list(query, pagination, user, select);
}

// Service
async list(query, pagination, user, select?: Record<string, boolean>) {
  return this.prisma.employee.findMany({
    where: this.buildWhere(query, user),
    select: select || EMPLOYEE_SUMMARY, // Default to summary
    // ...
  });
}
```

#### 3.1.2 Conditional Fields Based on Permissions

```typescript
// employee-privacy.ts
export function employeeVisibility(user: AuthenticatedUser) {
  const canViewSensitive = user.permissions.includes('employees.view.sensitive') || user.isSuperAdmin;
  
  return {
    personal: canViewSensitive,
    bank: user.permissions.includes('employees.view.bank') || canViewSensitive,
    salary: user.permissions.includes('employees.view.salary') || canViewSensitive,
  };
}

// In service
const visibility = employeeVisibility(user);
const select = {
  ...EMPLOYEE_SUMMARY,
  ...(visibility.personal ? { nationalId: true, mobile: true, email: true } : {}),
  ...(visibility.bank ? { bankAccounts: true } : {}),
  ...(visibility.salary ? { monthlyBaseSalary: true } : {}),
};
```

---

## 3.2 Response Caching

### 4.1 HTTP Caching Headers

```typescript
// backend/src/common/interceptors/cache.interceptor.ts
@Injectable()
export class CacheInterceptor implements NestInterceptor {
  constructor(private readonly cacheManager: CacheManager) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    
    // Only cache GET requests
    if (request.method !== 'GET') {
      return next.handle();
    }

    const cacheKey = `api:${request.method}:${request.url}:${JSON.stringify(request.query)}`;
    
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      // Set cache headers
      const response = context.switchToHttp().getResponse();
      response.setHeader('X-Cache', 'HIT');
      response.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      return of(cached);
    }

    return next.handle().pipe(
      tap(async (response) => {
        // Only cache successful responses
        if (response?.success) {
          await this.cacheManager.set(cacheKey, response, { ttl: 60000 }); // 1 min
        }
        
        const response = context.switchToHttp().getResponse();
        response.setHeader('X-Cache', 'MISS');
        response.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      }),
    );
  }
}
```

```typescript
// Apply to controllers
@Controller('employees')
@UseInterceptors(CacheInterceptor)
export class EmployeesController { ... }
```

### 4.2 ETag Support

```typescript
// backend/src/common/interceptors/etag.interceptor.ts
@Injectable()
export class ETagInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    if (request.method !== 'GET') {
      return next.handle();
    }

    return next.handle().pipe(
      map((data) => {
        const etag = `"${crypto.createHash('md5').update(JSON.stringify(data)).digest('hex')}"`;
        
        // Check If-None-Match
        const ifNoneMatch = request.headers['if-none-match'];
        if (ifNoneMatch === etag) {
          throw new HttpException('', HttpStatus.NOT_MODIFIED);
        }
        
        // Set ETag header
        response.setHeader('ETag', etag);
        return data;
      }),
    );
  }
}
```

---

## 3.3 Pagination Optimization

### 5.1 Cursor-Based Pagination

```typescript
// backend/src/common/dto/pagination.dto.ts
export class CursorPaginationDto {
  @ApiPropertyOptional({ description: 'Number of items per page', default: 20 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200)
  limit: number = 20;

  @ApiPropertyOptional({ description: 'Cursor for next page' })
  @IsOptional() @IsString()
  cursor?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional() @IsIn(['asc', 'desc'])
  sortOrder: 'asc' | 'desc' = 'desc';
}

// Service implementation
async listWithCursor(dto: CursorPaginationDto, user: AuthenticatedUser) {
  const limit = dto.limit ?? 20;
  const where = this.buildWhere(query, user);
  
  const whereClause = dto.cursor 
    ? { ...where, id: { lt: dto.cursor } }  // For descending order
    : where;

  const rows = await this.prisma.model.findMany({
    where: whereClause,
    take: dto.limit + 1, // Fetch one extra to detect hasNext
    orderBy: { id: dto.sortOrder ?? 'desc' },
  });

  const hasNext = rows.length > dto.limit;
  const items = hasNext ? rows.slice(0, -1) : rows;
  const nextCursor = hasNext ? rows[rows.length - 1].id : null;

  return {
    data: items,
    meta: { hasNext, nextCursor },
  };
}
```

### 4.2 Cursor Pagination DTO

```typescript
// backend/src/common/dto/pagination.dto.ts
export class CursorPaginationDto {
  @ApiPropertyOptional({ description: 'Number of items per page', default: 20 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200)
  limit: number = 20;

  @ApiPropertyOptional({ description: 'Cursor for next page' })
  @IsOptional() @IsString()
  cursor?: string;

  @ApiPropertyOptional({ description: 'Sort direction', default: 'desc' })
  @IsOptional() @IsIn(['asc', 'desc'])
  sortOrder: 'asc' | 'desc' = 'desc';
}
```

---

## 8. API Security & Rate Limiting

### 8.1 Rate Limiting

```typescript
// backend/src/main.ts
app.use(require('helmet')({
  contentSecurityPolicy: { /* ... */ },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: 'same-origin' },
  originAgentCluster: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

app.use(require('express-rate-limit')({
  windowMs: 60 * 1000, // 1 minute
  max: 300, // 300 requests per minute
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
}));

// Auth-specific rate limiting
@Post('login')
@Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute
@HttpCode(HttpStatus.OK)
async login(@Body() dto: LoginDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
  return this.auth.login(dto, request, response);
}

@Post('refresh')
@Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute
@HttpCode(HttpStatus.OK)
async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
  return this.auth.refresh(request, response);
}
```

### 8.2 API Security Headers

```typescript
// main.ts
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
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: 'same-origin' },
  originAgentCluster: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));
```

---

## 9. Monitoring & Observability

### 9.1 Request/Response Logging

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

---

## 10. API Documentation

### 10.1 Swagger/OpenAPI

```typescript
// main.ts
const config = new DocumentBuilder()
  .setTitle('Sana HRMS API')
  .setDescription('Human Resource Management System API')
  .setVersion('1.0.0')
  .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer')
  .addTag('auth', 'احراز هویت')
  .addTag('org', 'ساختار سازمانی')
  .addTag('employees', 'پرونده پرسنلی')
  .addTag('contracts', 'قراردادها')
  .addTag('documents', 'مدارک')
  .addTag('attendance', 'حضور و غیاب')
  .addTag('shifts', 'شیفت و برنامه کاری')
  .addTag('leaves', 'مرخصی')
  .addTag('payroll', 'حقوق و دستمزد')
  .addTag('evaluations', 'ارزیابی عملکرد')
  .addTag('tasks', 'Task')
  .addTag('assets', 'دارایی و تجهیزات')
  .addTag('training', 'آموزش و گواهینامه')
  .addTag('approvals', 'گردش تأیید')
  .addTag('recruitment', 'استخدام و جذب')
  .addTag('lifecycle', 'ورود و خروج نیرو')
  .addTag('missions', 'مأموریت')
  .addTag('loans', 'وام و مزایا')
  .addTag('admin', 'مکاتبات، جلسات و نظرسنجی')
  .addTag('announcements', 'اعلان‌ها و اعلامیه‌ها')
  .addTag('users', 'کاربران')
  .addTag('roles', 'نقش‌ها و مجوزها')
  .addTag('reports', 'گزارش‌ها')
  .addTag('dashboard', 'داشبورد')
  .addTag('audit', 'ممیزی و امنیت')
  .addTag('settings', 'تنظیمات')
  .addTag('backup', 'پشتیبان‌گیری')
  .build();

const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('api/docs', app, document, {
  swaggerOptions: { persistAuthorization: true, docExpansion: 'none', filter: true },
  customSiteTitle: 'Sana HRMS - API Docs',
});
```

---

## 11. API Versioning & Deprecation

```typescript
// Versioning via URL
@Controller({ path: 'employees', version: '1' })
export class EmployeesController { }

// Deprecation headers
@Get()
@Header('Deprecation', 'true')
@Header('Sunset', 'Sat, 01 Jan 2027 00:00:00 GMT')
@Header('Link', '<https://api.example.com/v2/employees>; rel="successor-version"')
@Get()
async list(@Query() query: EmployeeQueryDto, @CurrentUser() user: AuthenticatedUser) {
  return this.service.list(query, pagination, user);
}
```

---

## 12. Testing API Performance

```bash
# Load test with k6
k6 run k6/load-test.js

# Autocannon for quick benchmarks
npx autocannon -c 50 -d 30s -m POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -b '{"username":"admin","password":"..."}' \
  http://localhost:4114/api/v1/auth/login

# Autocannon for GET
npx autocannon -c 50 -d 30s \
  -H "Authorization: Bearer <token>" \
  http://localhost:4114/api/v1/employees
```

---

**Document Version:** 1.0  
**Last Updated:** 2026-11-18  
**Next Review:** Sprint Planning  
**Owner:** API Engineering Team