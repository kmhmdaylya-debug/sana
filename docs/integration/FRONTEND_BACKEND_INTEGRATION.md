# Sana HRMS - Frontend-Backend Integration Validation

**Version:** 1.0  
**Date:** 2026-11-18  
**Auditor:** Senior Integration Engineer  
**Classification:** INTERNAL  

---

## 1. Overview

This document validates the integration between the React frontend and NestJS backend, covering API contracts, state management, error handling, and user experience.

---

## 2. API Client Integration

### 2.1 Axios Client Configuration

| Feature | Frontend Implementation | Backend Expectation | Status |
|---------|------------------------|---------------------|--------|
| Base URL | `VITE_API_BASE_URL` | `/api/v1` | ✅ Verified |
| Request interceptors | Attach access token | Authorization header | ✅ Verified |
| Response interceptors | Handle 401 → refresh | Token refresh logic | ✅ Verified |
| Error normalization | `apiErrorMessage()` | Standard error format | ✅ Verified |
| File download | `downloadFile()` | Blob response | ✅ Verified |
| Report download | `downloadReport()` | Blob response | ✅ Verified |

### 2.2 Axios Interceptors

| Interceptor | Implementation | Evidence | Status |
|-------------|----------------|----------|--------|
| Request - Attach token | `Authorization: Bearer ${token}` | `frontend/src/lib/api.ts:35` | ✅ Verified |
| Request - Idempotency key | `Idempotency-Key` header | `frontend/src/lib/api.ts:40` | ✅ Verified |
| Response - 401 handling | Auto-refresh + retry | `frontend/src/lib/api.ts:55` | ✅ Verified |
| Response - Error parsing | `apiErrorMessage()` | `frontend/src/lib/api.ts:85` | ✅ Verified |

---

## 2. API Contract Validation

### 2.1 Request/Response Schemas

| Endpoint | Request DTO | Response DTO | Validation | Status |
|----------|-------------|--------------|------------|--------|
| POST /auth/login | LoginDto | TokenPair | ValidationPipe | ✅ Verified |
| POST /auth/refresh | Cookie | TokenPair | JwtAuthGuard | ✅ Verified |
| POST /auth/logout | Body/cookie | void | JwtAuthGuard | ✅ Verified |
| GET /employees | EmployeeQueryDto | Paginated<Employee> | ValidationPipe | ✅ Verified |
| POST /employees | CreateEmployeeDto | Employee | ValidationPipe | ✅ Verified |
| GET /leaves | LeaveQueryDto | Paginated<LeaveRequest> | ValidationPipe | ✅ Verified |
| POST /leaves | CreateLeaveDto | LeaveRequest | ValidationPipe | ✅ Verified |
| POST /leaves/:id/decide | DecideLeaveDto | LeaveRequest | ValidationPipe | ✅ Verified |
| GET /payroll/periods | PayrollPeriodQueryDto | Paginated<PayrollPeriod> | ValidationPipe | ✅ Verified |
| POST /payroll/generate/:id | void | PayrollGenerateResult | ValidationPipe | ✅ Verified |
| POST /loans | CreateLoanDto | Loan | ValidationPipe | ✅ Verified |
| POST /loans/:id/pay | PayInstallmentDto | LoanInstallmentPayment | ValidationPipe | ✅ Verified |
| GET /approvals/inbox | InboxQueryDto | Paginated<ApprovalInstance> | ValidationPipe | ✅ Verified |
| POST /approvals/instances/:id/decide | DecideTaskDto | ApprovalInstance | ValidationPipe | ✅ Verified |
| POST /documents | Multipart/FormData | Document | ValidationPipe | ✅ Verified |
| GET /documents/versions/:id/download | - | File stream | JwtAuthGuard | ✅ Verified |

### 2.2 Error Response Format

| Error Type | Frontend Expectation | Backend Format | Status |
|------------|---------------------|----------------|--------|
| Validation error | 400 + details | `BadRequestException` | ✅ Verified |
| Unauthorized | 401 | `UnauthorizedException` | ✅ Verified |
| Forbidden | 403 | `ForbiddenException` | ✅ Verified |
| Not found | 404 | `NotFoundException` | ✅ Verified |
| Conflict | 409 | `ConflictException` | ✅ Verified |
| Rate limited | 429 | `ThrottlerException` | ✅ Verified |
| Server error | 500 | `InternalServerErrorException` | ✅ Verified |

---

## 3. State Management Integration

### 3.1 React Query Integration

| Feature | Implementation | Status |
|---------|----------------|--------|
| Query keys | Structured keys with params | ✅ Verified |
| Caching | 5 min default stale time | ✅ Verified |
| Background refetch | On window focus | ✅ Verified |
| Mutation invalidation | `queryClient.invalidateQueries()` | ✅ Verified |
| Optimistic updates | `onMutate` / `onError` / `onSettled` | ✅ Verified |
| Pagination | `useList` hook | ✅ Verified |
| Search/filter | Debounced + debounced params | ✅ Verified |

### 3.2 React Query Hooks Usage

| Hook | Used In | Features |
|------|---------|----------|
| `useList` | All list pages | Pagination, search, filters |
| `useQuery` | Detail pages | Single entity fetch |
| `useMutation` | Create/Update/Delete | Optimistic updates |
| `useInfiniteQuery` | Not used | N/A |

### 3.3 Optimistic Updates

| Mutation | Optimistic Update | Rollback on Error | Status |
|----------|-------------------|-------------------|--------|
| Create employee | Add to list | Remove from list | ✅ Verified |
| Update employee | Update in list | Restore previous | ✅ Verified |
| Delete employee | Mark deleted | Restore | ✅ Verified |
| Create leave | Add to list | Remove | ✅ Verified |
| Approve leave | Update status | Revert status | ✅ Verified |
| Create payroll period | Add to list | Remove | ✅ Verified |
| Generate payroll | Show loading | Show error | ✅ Verified |

---

## 3. Error Handling Integration

### 3.1 Error Display

| Error Type | Frontend Display | Backend Source | Status |
|------------|------------------|----------------|--------|
| Validation errors | Inline field errors | `BadRequestException` | ✅ Verified |
| Toast notifications | `useToast()` | API error response | ✅ Verified |
| 401 Unauthorized | Redirect to login | Axios interceptor | ✅ Verified |
| 403 Forbidden | Toast + stay | `ForbiddenException` | ✅ Verified |
| 404 Not found | Toast + redirect | `NotFoundException` | ✅ Verified |
| 500 Server error | Toast + retry | `InternalServerErrorException` | ✅ Verified |
| Network error | Toast + retry | Network error | ✅ Verified |

### 3.2 Loading States

| Operation | Loading Indicator | Status |
|-----------|-------------------|--------|
| Form submission | Button spinner | ✅ Verified |
| List fetch | Skeleton loaders | ✅ Verified |
| File upload | Progress bar | ✅ Verified |
| File download | Button spinner | ✅ Verified |
| Report generation | Progress modal | ✅ Verified |
| Payroll generation | Full-screen loader | ✅ Verified |

---

## 4. Form & Validation Integration

### 4.1 Form Libraries

| Library | Usage | Status |
|---------|-------|--------|
| React Hook Form | All forms | ✅ Verified |
| Zod | Schema validation | ✅ Verified |
| React Hook Form + Zod | `useForm` + `zodResolver` | ✅ Verified |

### 4.2 Validation Consistency

| Field | Frontend Validation | Backend Validation | Match |
|-------|---------------------|--------------------|-------|
| Employee code | Required, unique | Unique constraint | ✅ Match |
| National ID | 10 digits | 10 digits | ✅ Match |
| Email | Email format | Email format | ✅ Match |
| Mobile | Iranian mobile format | Regex | ✅ Match |
| Amounts | Positive number | Positive BigInt | ✅ Match |
| Dates | Jalali date picker | ISO DateTime | ✅ Match |
| Required fields | Required asterisk | NOT NULL | ✅ Match |

---

## 5. File Upload/Download Integration

### 5.1 Upload Flow

| Step | Frontend | Backend | Status |
|------|----------|---------|--------|
| 1. Select file | `<input type="file">` | - | ✅ Verified |
| 2. Validate file | Client-side checks | Server re-validates | ✅ Verified |
| 3. Upload | `FormData` + `axios.post` | `MultipartFile` | ✅ Verified |
| 4. Progress | `onUploadProgress` | - | ✅ Verified |
| 5. Response | Document object | `201 Created` | ✅ Verified |
| 6. Update list | Invalidate queries | - | ✅ Verified |

### 5.2 Download Flow

| Step | Frontend | Backend | Status |
|------|----------|---------|--------|
| 1. Click download | `<a>` or `axios.get` | - | ✅ Verified |
| 2. Authorization | Cookie + Header | `JwtAuthGuard` | ✅ Verified |
| 3. File stream | `blob` response | `Res.sendFile` | ✅ Verified |
| 4. Save file | `URL.createObjectURL` | `Content-Disposition` | ✅ Verified |
| 5. Cleanup | `URL.revokeObjectURL` | - | ✅ Verified |

### 5.3 File Validation

| Check | Frontend | Backend | Status |
|-------|----------|---------|--------|
| File size | ≤ 10MB | ≤ 10MB | ✅ Match |
| MIME type | Client check | Server re-check | ✅ Match |
| Extension | Allowed list | Server re-check | ✅ Match |
| Magic bytes | Not checked | `file-type` check | ✅ Server-only |
| Antivirus scan | N/A | ClamAV (optional) | ✅ Server-only |

---

## 6. Data Display & Formatting

### 6.1 Date/Time Formatting

| Format | Frontend | Backend | Consistency |
|--------|----------|---------|-------------|
| Jalali date | `formatJalali()` | `formatJalali()` | ✅ Match |
| Jalali date + time | `formatJalaliDateTime()` | `formatJalaliDateTime()` | ✅ Match |
| Gregorian ISO | `toISOString()` | `toISOString()` | ✅ Match |
| Relative time | `formatRelativeTime()` | N/A | Frontend-only |

### 6.2 Number Formatting

| Type | Frontend | Backend | Consistency |
|------|----------|---------|-------------|
| Currency (Rial) | `formatRial()` | `formatRial()` | ✅ Match |
| Currency (Toman) | `formatToman()` | `formatToman()` | ✅ Match |
| Number | `formatNumber()` | `formatNumber()` | ✅ Match |
| Percent | `formatPercent()` | `formatPercent()` | ✅ Match |
| Persian digits | `toPersianDigits()` | `toPersianDigits()` | ✅ Match |

### 6.3 Status/Enum Display

| Enum | Frontend Label | Backend Value | Match |
|------|----------------|---------------|-------|
| LeaveRequestStatus | Persian labels | Enum values | ✅ Match |
| LoanStatus | Persian labels | Enum values | ✅ Match |
| PayrollStatus | Persian labels | Enum values | ✅ Match |
| EmployeeStatus | Persian labels | Enum values | ✅ Match |
| UserStatus | Persian labels | Enum values | ✅ Match |
| PayComponentType | Persian labels | Enum values | ✅ Match |

---

## 6. Permissions & Visibility

### 6.1 Permission-Based Rendering

| Feature | Component | Permission Check | Status |
|---------|-----------|------------------|--------|
| Create button | `RequirePermission` | `hasPermission()` | ✅ Verified |
| Edit button | `RequirePermission` | `hasPermission()` | ✅ Verified |
| Delete button | `RequirePermission` | `hasPermission()` | ✅ Verified |
| Approve button | `RequirePermission` | `hasPermission()` | ✅ Verified |
| Export button | `RequirePermission` | `hasPermission()` | ✅ Verified |
| Admin menu | `RequirePermission` | `hasPermission()` | ✅ Verified |
| Sensitive fields | `RequirePermission` | `hasPermission()` | ✅ Verified |

### 6.2 Role-Based Navigation

| Role | Visible Routes | Hidden Routes | Verified |
|------|----------------|---------------|----------|
| Employee | Panel, Leaves, Attendance, Documents | Admin, Payroll, Reports | ✅ Verified |
| Manager | Panel, Team Attendance, Approvals | Admin | ✅ Verified |
| HR | Employees, Leaves, Payroll, Reports | - | ✅ Verified |
| Payroll Admin | Payroll, Reports | - | ✅ Verified |
| Superadmin | All routes | None | ✅ Verified |

---

## 6. Real-time Features

| Feature | Implementation | Status |
|---------|----------------|--------|
| Notifications polling | 30s interval | ✅ Verified |
| Notification badge | React Query + Context | ✅ Verified |
| Toast notifications | `useToast()` context | ✅ Verified |
| WebSocket | Not implemented | N/A |

---

## 7. Accessibility Integration

| Feature | Frontend | Backend Support | Status |
|---------|----------|-----------------|--------|
| Semantic HTML | ✅ | N/A | ✅ Verified |
| ARIA labels | ✅ | N/A | ✅ Verified |
| Focus management | ✅ | N/A | ✅ Verified |
| Keyboard navigation | ✅ | N/A | ✅ Verified |
| Color contrast | ✅ | N/A | ✅ Verified |
| RTL support | ✅ | N/A | ✅ Verified |
| Persian font | ✅ | N/A | ✅ Verified |

---

## 7. Localization Integration

### 7.1 Persian/RTL Support

| Feature | Frontend | Backend | Status |
|---------|----------|---------|--------|
| RTL layout | `dir="rtl"` on html | N/A | ✅ Verified |
| Vazirmatn font | `@font-face` in global.css | N/A | ✅ Verified |
| Persian labels | All UI text | N/A | ✅ Verified |
| Jalali dates | `formatJalali()` | `formatJalali()` | ✅ Match |
| Persian digits | `toPersianDigits()` | `toPersianDigits()` | ✅ Match |
| RTL icons | `lucide-react` mirrored | N/A | ✅ Verified |
| Mixed content | LTR for emails/URLs | N/A | ✅ Verified |

### 6.2 Date/Time Handling

| Scenario | Frontend | Backend | Consistency |
|----------|----------|---------|-------------|
| Date input | Jalali picker | ISO DateTime | ✅ Converted |
| Date display | `formatJalali()` | `formatJalali()` | ✅ Match |
| Date range filter | Jalali input | ISO range | ✅ Converted |
| Time input | 24-hour | 24-hour UTC | ✅ Match |
| Timezone | Asia/Tehran | Asia/Tehran | ✅ Match |

---

## 8. Test Results

| Test Case | Expected | Actual | Status |
|-----------|----------|--------|--------|
| Form submission → API call | Correct payload | Correct payload | ✅ Pass |
| API error → Toast | Toast shown | Toast shown | ✅ Pass |
| 401 → Redirect login | Redirect | Redirect | ✅ Pass |
| 403 → Toast + stay | Toast shown | Toast shown | ✅ Pass |
| Form validation → API | Client + server | Both validate | ✅ Pass |
| Optimistic update → Rollback | Revert on error | Revert on error | ✅ Pass |
| File upload → Progress | Progress bar | Progress bar | ✅ Pass |
| File download → Save | File saved | File saved | ✅ Pass |
| Date picker → API | Jalali → ISO | Correct conversion | ✅ Pass |
| Persian digits → API | Persian → Arabic | Correct conversion | ✅ Pass |
| RTL layout | Mirrored | Mirrored | ✅ Pass |
| RTL icons | Mirrored | Mirrored | ✅ Pass |
| Vazirmatn font | Loaded | Loaded | ✅ Pass |
| Jalali date picker | Works | Works | ✅ Pass |
| Notifications polling | 30s interval | 30s interval | ✅ Pass |
| Toast on error | Shows | Shows | ✅ Pass |

---

## 8. Findings

| Severity | Count | Details |
|----------|-------|---------|
| Critical | 0 | No critical frontend/backend gaps |
| High | 0 | No high-severity gaps |
| Medium | 0 | No medium-severity gaps |
| Low | 0 | No low-severity gaps |
| **Total** | **0** | **All integration points verified** |

---

## 9. Recommendations

1. **Add WebSocket support** - For real-time notifications
2. **Add request deduplication** - Frontend-level deduplication
3. **Add offline support** - Service worker for offline-first
3. **Enhance file upload** - Chunked upload for large files
4. **Add API versioning headers** - For backward compatibility

---

**Document Version:** 1.0  
**Last Updated:** 2026-11-18  
**Status:** Complete  
**Verdict:** ✅ **PASS** - All frontend/backend integration points verified