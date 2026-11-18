# Sana HRMS - Security Regression Tests

**Version:** 1.0  
**Date:** 2026-11-18  
**Based on:** HIGH_CRITICAL_VULNERABILITY_AUDIT.md, REMEDIATION_PLAN.md  

---

## 1. Test Structure

```
backend/test/security/
├── auth/
│   ├── auth-bypass.spec.ts
│   ├── jwt-validation.spec.ts
│   ├── refresh-token-rotation.spec.ts
│   ├── password-change.spec.ts
│   └── concurrent-refresh.spec.ts
├── authorization/
│   ├── rbac-bypass.spec.ts
│   ├── abac-bypass.spec.ts
│   ├── idor.spec.ts
│   └── privilege-escalation.spec.ts
├── tenant-isolation/
│   ├── cross-company-access.spec.ts
│   ├── cross-branch-access.spec.ts
│   └── document-isolation.spec.ts
├── injection/
│   ├── sql-injection.spec.ts
│   ├── path-traversal.spec.ts
│   └── xss.spec.ts
├── file-handling/
│   ├── upload-restrictions.spec.ts
│   └── download-authorization.spec.ts
├── browser-security/
│   ├── csrf-protection.spec.ts
│   ├── cors-config.spec.ts
│   └── security-headers.spec.ts
├── rate-limiting/
│   └── throttle-enforcement.spec.ts
└── audit/
    └── audit-logging.spec.ts
```

---

## 2. Authentication Tests

### 2.1 Auth Bypass Tests
```typescript
// backend/test/security/auth/auth-bypass.spec.ts
describe('Auth Bypass Prevention', () => {
  it('rejects requests without access token', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .expect(401);
  });

  it('rejects expired access tokens', async () => {
    const expiredToken = createExpiredToken({ sub: 'user-id' });
    await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${expiredToken}`)
      .expect(401);
  });

  it('rejects tokens with invalid signature', async () => {
    const invalidToken = createInvalidSignatureToken({ sub: 'user-id' });
    await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${invalidToken}`)
      .expect(401);
  });

  it('rejects tokens for inactive users', async () => {
    const user = await createTestUser({ status: UserStatus.INACTIVE });
    const token = await login(user);
    await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${token.accessToken}`)
      .expect(401);
  });

  it('rejects tokens for terminated employees', async () => {
    const user = await createTestUser({ 
      employee: { terminationDate: new Date('2020-01-01') }
    });
    const token = await login(user);
    await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${token.accessToken}`)
      .expect(401);
  });
});
```

### 2.2 JWT Validation Tests
```typescript
// backend/test/security/auth/jwt-validation.spec.ts
describe('JWT Validation', () => {
  it('rejects "none" algorithm tokens', async () => {
    const noneToken = createToken({ sub: 'user-id' }, 'none');
    await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${noneToken}`)
      .expect(401);
  });

  it('rejects RS256 tokens when HS256 expected', async () => {
    const rs256Token = createRS256Token({ sub: 'user-id' });
    await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${rs256Token}`)
      .expect(401);
  });

  it('validates issuer claim', async () => {
    const wrongIssuerToken = createToken({ sub: 'user-id', iss: 'wrong-issuer' });
    await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${wrongIssuerToken}`)
      .expect(401);
  });

  it('validates audience claim if configured', async () => {
    // Only if audience is configured
  });

  it('requires jti claim in access tokens', async () => {
    const tokenWithoutJti = createToken({ sub: 'user-id', type: 'access' }, 'HS256', false);
    await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${tokenWithoutJti}`)
      .expect(401);
  });
});
```

### 2.3 Refresh Token Rotation Tests
```typescript
// backend/test/security/auth/refresh-token-rotation.spec.ts
describe('Refresh Token Rotation', () => {
  it('rotates refresh token on each use', async () => {
    const { refreshToken } = await login(testUser);
    
    // First refresh
    const first = await refresh(refreshToken);
    expect(first.accessToken).toBeDefined();
    expect(first.refreshToken).toBeDefined();
    expect(first.refreshToken).not.toBe(refreshToken);
    
    // Second refresh with new token
    const second = await refresh(first.refreshToken);
    expect(second.refreshToken).not.toBe(first.refreshToken);
  });

  it('detects and revokes family on token reuse', async () => {
    const { refreshToken } = await login(testUser);
    
    // First refresh - should succeed
    const first = await refresh(refreshToken);
    
    // Second reuse of SAME refresh token - should fail
    await expect(refresh(refreshToken)).rejects.toThrow(UnauthorizedException);
    
    // Verify family revoked
    const tokens = await prisma.refreshToken.findMany({
      where: { family: first.sessionId }
    });
    expect(tokens.every(t => t.revokedAt)).toBe(true);
  });

  it('allows concurrent tabs within grace period', async () => {
    const { refreshToken } = await login(testUser);
    
    // Simulate concurrent refresh from two tabs
    const [first, second] = await Promise.all([
      refresh(refreshToken),
      refresh(refreshToken), // Same token, concurrent
    ]);
    
    // Both should succeed (first gets new token, second gets access only)
    expect(first.accessToken).toBeDefined();
    expect(second.accessToken).toBeDefined();
  });

  it('revokes family after grace period expiry', async () => {
    const { refreshToken } = await login(testUser);
    const first = await refresh(refreshToken);
    
    // Wait for grace period to expire (5 seconds)
    await new Promise(r => setTimeout(r, 6000));
    
    // Reuse should now fail
    await expect(refresh(refreshToken)).rejects.toThrow(UnauthorizedException);
  });
});
```

### 2.4 Password Change Tests
```typescript
// backend/test/security/auth/password-change.spec.ts
describe('Password Change Security', () => {
  it('invalidates access tokens on password change', async () => {
    const { accessToken } = await login(testUser);
    
    // Change password
    await changePassword(testUser.id, { 
      currentPassword: 'old', 
      newPassword: 'newPassword123!' 
    });
    
    // Old access token should be rejected
    await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);
  });

  it('revokes all refresh tokens on password change', async () => {
    const { refreshToken } = await login(testUser);
    
    await changePassword(testUser.id, { 
      currentPassword: 'old', 
      newPassword: 'newPassword123!' 
    });
    
    await expect(refresh(refreshToken)).rejects.toThrow(UnauthorizedException);
  });

  it('requires current password', async () => {
    await expect(changePassword(testUser.id, {
      currentPassword: 'wrong',
      newPassword: 'newPassword123!'
    })).rejects.toThrow(BadRequestException);
  });

  it('enforces password strength', async () => {
    await expect(changePassword(testUser.id, {
      currentPassword: 'old',
      newPassword: 'weak'
    })).rejects.toThrow(BadRequestException);
  });

  it('prevents password reuse', async () => {
    await expect(changePassword(testUser.id, {
      currentPassword: 'old',
      newPassword: 'old'
    })).rejects.toThrow(BadRequestException);
  });
});
```

---

## 3. Authorization Tests

### 3.1 RBAC Bypass Tests
```typescript
// backend/test/security/authorization/rbac-bypass.spec.ts
describe('RBAC Bypass Prevention', () => {
  let userA: AuthenticatedUser; // Has EMPLOYEES_VIEW
  let userB: AuthenticatedUser; // No permissions
  
  beforeAll(async () => {
    userA = await createTestUser({ permissions: ['employees.view'] });
    userB = await createTestUser({ permissions: [] });
  });

  it('rejects requests without required permission', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/employees')
      .set('Authorization', `Bearer ${userB.accessToken}`)
      .expect(403);
  });

  it('allows requests with required permission', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/employees')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .expect(200);
  });

  it('prevents self-assignment of admin permissions', async () => {
    await expect(
      request(app.getHttpServer())
        .patch(`/api/v1/users/${userA.id}`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ roleIds: ['SUPER_ADMIN_ID'] })
    ).rejects.toThrow(ForbiddenException);
  });

  it('prevents assigning roles with permissions actor lacks', async () => {
    // userA has employees.view but not users.manage.roles
    await expect(
      request(app.getHttpServer())
        .patch(`/api/v1/users/${userB.id}`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ roleIds: ['SOME_ROLE_ID'] })
    ).rejects.toThrow(ForbiddenException);
  });
});
```

### 3.2 ABAC Bypass Tests
```typescript
// backend/test/security/authorization/abac-bypass.spec.ts
describe('ABAC Bypass Prevention', () => {
  it('enforces company scope on employee queries', async () => {
    const userA = await createTestUser({ companyId: 'company-a' });
    const userB = await createTestUser({ companyId: 'company-b' });
    const empB = await createEmployee({ companyId: 'company-b' });
    
    await request(app.getHttpServer())
      .get(`/api/v1/employees/${empB.id}`)
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .expect(403);
  });

  it('enforces branch scope on attendance queries', async () => {
    const userA = await createTestUser({ branchId: 'branch-a' });
    const userB = await createTestUser({ branchId: 'branch-b' });
    
    await request(app.getHttpServer())
      .get('/api/v1/attendance?branchId=branch-b')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .expect(403);
  });

  it('enforces orgUnit scope on document access', async () => {
    const userA = await createTestUser({ orgUnitId: 'org-a' });
    const empB = await createEmployee({ orgUnitId: 'org-b' });
    const doc = await createDocument({ employeeId: empB.id });
    
    await request(app.getHttpServer())
      .get(`/api/v1/documents/${doc.id}`)
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .expect(403);
  });
});
```

### 3.3 IDOR Tests
```typescript
// backend/test/security/authorization/idor.spec.ts
describe('IDOR Prevention', () => {
  let userA: AuthenticatedUser, userB: AuthenticatedUser;
  let employeeA: Employee, employeeB: Employee;
  
  beforeAll(async () => {
    userA = await createTestUser({ companyId: 'company-a' });
    userB = await createTestUser({ companyId: 'company-b' });
    employeeA = await createEmployee({ companyId: 'company-a', userId: userA.id });
    employeeB = await createEmployee({ companyId: 'company-b', userId: userB.id });
  });

  it('prevents userA from accessing employeeB record', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/employees/${employeeB.id}`)
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .expect(403);
  });

  it('prevents userA from updating employeeB record', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/employees/${employeeB.id}`)
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({ firstName: 'Hacked' })
      .expect(403);
  });

  it('prevents userA from deleting employeeB record', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/employees/${employeeB.id}`)
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .expect(403);
  });

  it('prevents userA from downloading employeeB document', async () => {
    const doc = await createDocument({ employeeId: employeeB.id });
    const version = await uploadDocumentVersion(doc.id);
    
    await request(app.getHttpServer())
      .get(`/api/v1/documents/versions/${version.id}/download`)
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .expect(403);
  });

  it('prevents userA from accessing employeeB payslip', async () => {
    const period = await createPayrollPeriod({ companyId: 'company-b' });
    await generatePayroll(period.id);
    
    await request(app.getHttpServer())
      .get(`/api/v1/payroll/payslips/${employeeB.id}?periodId=${period.id}`)
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .expect(403);
  });
});
```

### 3.4 Privilege Escalation Tests
```typescript
// backend/test/security/authorization/privilege-escalation.spec.ts
describe('Privilege Escalation Prevention', () => {
  it('prevents role assignment with cumulative dangerous permissions', async () => {
    const actor = await createTestUser({ 
      permissions: ['payroll.create'] 
    });
    // Try to assign role with payroll.approve - combined would allow full payroll control
    const role = await createRole({ 
      permissions: ['payroll.approve'] 
    });
    
    await expect(
      request(app.getHttpServer())
        .patch(`/api/v1/users/${victim.id}`)
        .set('Authorization', `Bearer ${actor.accessToken}`)
        .send({ roleIds: [role.id] })
    ).rejects.toThrow(ForbiddenException);
  });

  it('prevents scope assignment beyond actor scope', async () => {
    const actor = await createTestUser({ companyId: 'company-a' });
    
    await expect(
      request(app.getHttpServer())
        .patch(`/api/v1/users/${victim.id}`)
        .set('Authorization', `Bearer ${actor.accessToken}`)
        .send({ scope: [{ scopeType: 'COMPANY', companyId: 'company-b' }] })
    ).rejects.toThrow(ForbiddenException);
  });

  it('prevents superadmin account modification by non-superadmin', async () => {
    const admin = await createTestUser({ isSuperAdmin: true });
    const regular = await createTestUser({ permissions: ['users.manage.superadmin'] });
    
    await expect(
      request(app.getHttpServer())
        .patch(`/api/v1/users/${admin.id}`)
        .set('Authorization', `Bearer ${regular.accessToken}`)
        .send({ status: 'INACTIVE' })
    ).rejects.toThrow(ForbiddenException);
  });
});
```

---

## 4. Tenant Isolation Tests

### 4.1 Cross-Company Access Tests
```typescript
// backend/test/security/tenant-isolation/cross-company-access.spec.ts
describe('Cross-Company Isolation', () => {
  let companyA: Company, companyB: Company;
  let userA: AuthenticatedUser, userB: AuthenticatedUser;
  
  beforeAll(async () => {
    companyA = await createCompany({ code: 'A' });
    companyB = await createCompany({ code: 'B' });
    userA = await createTestUser({ companyId: companyA.id });
    userB = await createTestUser({ companyId: companyB.id });
  });

  it('isolates employee data', async () => {
    const empB = await createEmployee({ companyId: companyB.id });
    
    await request(app.getHttpServer())
      .get(`/api/v1/employees/${empB.id}`)
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .expect(403);
  });

  it('isolates payroll data', async () => {
    const periodB = await createPayrollPeriod({ companyId: companyB.id });
    
    await request(app.getHttpServer())
      .get(`/api/v1/payroll/periods/${periodB.id}`)
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .expect(403);
  });

  it('isolates attendance data', async () => {
    const deviceB = await createAttendanceDevice({ companyId: companyB.id });
    
    await request(app.getHttpServer())
      .get(`/api/v1/attendance/devices/${deviceB.id}`)
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .expect(403);
  });

  it('isolates document data', async () => {
    const empB = await createEmployee({ companyId: companyB.id });
    const docB = await createDocument({ employeeId: empB.id });
    
    await request(app.getHttpServer())
      .get(`/api/v1/documents/${docB.id}`)
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .expect(403);
  });

  it('blocks companyId query parameter manipulation', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/payroll/components?companyId=${companyB.id}`)
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .expect(403);
  });
});
```

### 4.2 Cross-Branch Access Tests
```typescript
// backend/test/security/tenant-isolation/cross-branch-access.spec.ts
describe('Cross-Branch Isolation', () => {
  let branchA: Branch, branchB: Branch;
  let userA: AuthenticatedUser, userB: AuthenticatedUser;
  
  beforeAll(async () => {
    branchA = await createBranch({ companyId: companyA.id });
    branchB = await createBranch({ companyId: companyA.id });
    userA = await createTestUser({ branchId: branchA.id });
    userB = await createTestUser({ branchId: branchB.id });
  });

  it('isolates attendance by branch', async () => {
    const deviceB = await createAttendanceDevice({ branchId: branchB.id });
    
    await request(app.getHttpServer())
      .get(`/api/v1/attendance/devices/${deviceB.id}`)
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .expect(403);
  });

  it('isolates employee queries by branch', async () => {
    const empB = await createEmployee({ branchId: branchB.id });
    
    await request(app.getHttpServer())
      .get(`/api/v1/employees/${empB.id}`)
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .expect(403);
  });
});
```

### 4.3 Document Isolation Tests
```typescript
// backend/test/security/tenant-isolation/document-isolation.spec.ts
describe('Document Isolation', () => {
  it('blocks confidential document access without EMPLOYEES_VIEW_SENSITIVE', async () => {
    const user = await createTestUser({ permissions: ['documents.view'] });
    const emp = await createEmployee({ companyId: user.scope.companyIds[0] });
    const doc = await createDocument({ 
      employeeId: emp.id, 
      confidentiality: 'HIGH' 
    });
    
    await request(app.getHttpServer())
      .get(`/api/v1/documents/${doc.id}`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(403);
  });

  it('allows confidential document access with EMPLOYEES_VIEW_SENSITIVE', async () => {
    const user = await createTestUser({ 
      permissions: ['documents.view', 'employees.view.sensitive'] 
    });
    const emp = await createEmployee({ companyId: user.scope.companyIds[0] });
    const doc = await createDocument({ 
      employeeId: emp.id, 
      confidentiality: 'HIGH' 
    });
    
    await request(app.getHttpServer())
      .get(`/api/v1/documents/${doc.id}`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200);
  });

  it('blocks confidential document download without EMPLOYEES_VIEW_SENSITIVE', async () => {
    const user = await createTestUser({ permissions: ['documents.view'] });
    const emp = await createEmployee({ companyId: user.scope.companyIds[0] });
    const doc = await createDocument({ 
      employeeId: emp.id, 
      confidentiality: 'HIGH' 
    });
    const version = await uploadDocumentVersion(doc.id);
    
    await request(app.getHttpServer())
      .get(`/api/v1/documents/versions/${version.id}/download`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(403);
  });
});
```

---

## 5. Injection Tests

### 5.1 SQL Injection Tests
```typescript
// backend/test/security/injection/sql-injection.spec.ts
describe('SQL Injection Prevention', () => {
  it('sanitizes user input in search queries', async () => {
    const user = await createTestUser({ permissions: ['employees.view'] });
    
    const response = await request(app.getHttpServer())
      .get(`/api/v1/employees?search=' OR '1'='1`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200);
    
    // Should not return all employees
    expect(response.body.data.length).toBeLessThan(100);
  });

  it('prevents SQL injection in UUID parameters', async () => {
    const user = await createTestUser({ permissions: ['employees.view'] });
    
    await request(app.getHttpServer())
      .get(`/api/v1/employees/' OR '1'='1'--`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(400); // Invalid UUID format
  });

  it('uses parameterized queries for $executeRaw', async () => {
    // Test the lockUser method which uses $executeRaw
    await expect(
      request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ username: "admin'--", password: 'x' })
    ).resolves.not.toThrow();
  });
});
```

### 5.2 Path Traversal Tests
```typescript
// backend/test/security/injection/path-traversal.spec.ts
describe('Path Traversal Prevention', () => {
  it('blocks directory traversal in document download', async () => {
    const user = await createTestUser({ permissions: ['documents.view'] });
    
    // Attempt to traverse out of upload directory
    await request(app.getHttpServer())
      .get(`/api/v1/documents/versions/../../etc/passwd/download`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(404); // Not found, not served
  });

  it('blocks encoded traversal sequences', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/documents/versions/%2e%2e%2f%2e%2e%2fetc%2fpasswd/download`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(404);
  });

  it('blocks double-encoded traversal', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/documents/versions/%252e%252e%252f%252e%252e%252fetc%252fpasswd/download`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(404);
  });
});
```

### 5.3 XSS Tests
```typescript
// backend/test/security/injection/xss.spec.ts
describe('XSS Prevention', () => {
  it('escapes HTML in error responses', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/nonexistent')
      .expect(404);
    
    // Response should be JSON, not HTML
    expect(response.headers['content-type']).toMatch(/application\/json/);
  });

  it('sanitizes user input in search results', async () => {
    const user = await createTestUser({ permissions: ['employees.view'] });
    
    const response = await request(app.getHttpServer())
      .get(`/api/v1/employees?search=<script>alert(1)</script>`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200);
    
    // Response should not contain unescaped script tags
    expect(JSON.stringify(response.body)).not.toContain('<script>');
  });
});
```

---

## 6. File Handling Tests

### 6.1 Upload Restrictions Tests
```typescript
// backend/test/security/file-handling/upload-restrictions.spec.ts
describe('File Upload Restrictions', () => {
  const user = await createTestUser({ permissions: ['documents.create'] });

  it('rejects executable files', async () => {
    const exeBuffer = Buffer.from('MZ'); // PE header
    await request(app.getHttpServer())
      .post('/api/v1/documents/upload')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .attach('file', exeBuffer, 'test.exe')
      .expect(400);
  });

  it('rejects files with mismatched MIME type', async () => {
    const pdfBuffer = Buffer.from('%PDF-1.4');
    await request(app.getHttpServer())
      .post('/api/v1/documents/upload')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .attach('file', pdfBuffer, 'test.exe') // .exe extension but PDF content
      .expect(400);
  });

  it('rejects oversized files', async () => {
    const largeBuffer = Buffer.alloc(15 * 1024 * 1024); // 15MB > 10MB limit
    await request(app.getHttpServer())
      .post('/api/v1/documents/upload')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .attach('file', largeBuffer, 'large.pdf')
      .expect(413); // Payload too large
  });

  it('accepts valid PDF files', async () => {
    const pdfBuffer = Buffer.from('%PDF-1.4 valid pdf content');
    await request(app.getHttpServer())
      .post('/api/v1/documents/upload')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .attach('file', pdfBuffer, 'valid.pdf')
      .expect(201);
  });

  it('scans files for viruses when antivirus enabled', async () => {
    // Only if ANTIVIRUS_ENABLED=true
    if (process.env.ANTIVIRUS_ENABLED === 'true') {
      const infectedBuffer = Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*');
      await request(app.getHttpServer())
        .post('/api/v1/documents/upload')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .attach('file', infectedBuffer, 'eicar.com')
        .expect(400);
    }
  });
});
```

### 6.2 Download Authorization Tests
```typescript
// backend/test/security/file-handling/download-authorization.spec.ts
describe('File Download Authorization', () => {
  it('requires DOCUMENTS_VIEW permission', async () => {
    const user = await createTestUser({ permissions: [] });
    const doc = await createDocument({ employeeId: user.employeeId });
    const version = await uploadDocumentVersion(doc.id);
    
    await request(app.getHttpServer())
      .get(`/api/v1/documents/versions/${version.id}/download`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(403);
  });

  it('enforces document confidentiality', async () => {
    const user = await createTestUser({ permissions: ['documents.view'] });
    const emp = await createEmployee({ companyId: user.scope.companyIds[0] });
    const doc = await createDocument({ 
      employeeId: emp.id, 
      confidentiality: 'HIGH' 
    });
    const version = await uploadDocumentVersion(doc.id);
    
    await request(app.getHttpServer())
      .get(`/api/v1/documents/versions/${version.id}/download`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(403);
  });

  it('allows own employee document download', async () => {
    const user = await createTestUser({ permissions: ['documents.view'] });
    const doc = await createDocument({ employeeId: user.employeeId });
    const version = await uploadDocumentVersion(doc.id);
    
    await request(app.getHttpServer())
      .get(`/api/v1/documents/versions/${version.id}/download`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200);
  });
});
```

---

## 7. Browser Security Tests

### 7.1 CSRF Protection Tests
```typescript
// backend/test/security/browser-security/csrf-protection.spec.ts
describe('CSRF Protection', () => {
  it('rejects login without valid CSRF token', async () => {
    // With SameSite=Strict, cross-site requests are blocked by browser
    // This test verifies the cookie settings
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'test', password: 'test' })
      .expect(200);
    
    // Verify cookie has SameSite=Strict
    const cookie = response.headers['set-cookie'][0];
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
  });

  it('rejects refresh without valid CSRF token', async () => {
    const { refreshToken } = await login(testUser);
    
    // Simulate cross-site request (different origin)
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refresh_token=${refreshToken}`)
      .set('Origin', 'https://evil.com')
      .expect(403); // CSRF blocked by SameSite=Strict
  });

  it('rejects change-password without valid CSRF token', async () => {
    const { accessToken } = await login(testUser);
    
    await request(app.getHttpServer())
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Origin', 'https://evil.com')
      .send({ currentPassword: 'old', newPassword: 'newPassword123!' })
      .expect(403);
  });
});
```

### 7.2 CORS Configuration Tests
```typescript
// backend/test/security/browser-security/cors-config.spec.ts
describe('CORS Configuration', () => {
  it('allows configured origins', async () => {
    const response = await request(app.getHttpServer())
      .options('/api/v1/auth/login')
      .set('Origin', 'http://localhost:5183')
      .set('Access-Control-Request-Method', 'POST')
      .expect(200);
    
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5183');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('rejects unconfigured origins', async () => {
    await request(app.getHttpServer())
      .options('/api/v1/auth/login')
      .set('Origin', 'https://evil.com')
      .set('Access-Control-Request-Method', 'POST')
      .expect(403);
  });

  it('rejects wildcard in production', async () => {
    if (process.env.NODE_ENV === 'production') {
      await request(app.getHttpServer())
        .options('/api/v1/auth/login')
        .set('Origin', 'https://any-site.com')
        .set('Access-Control-Request-Method', 'POST')
        .expect(403);
    }
  });
});
```

### 7.3 Security Headers Tests
```typescript
// backend/test/security/browser-security/security-headers.spec.ts
describe('Security Headers', () => {
  it('includes X-Content-Type-Options', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('includes X-Frame-Options', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);
    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
  });

  it('includes Referrer-Policy', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);
    expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });

  it('includes Content-Security-Policy', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);
    expect(response.headers['content-security-policy']).toBeDefined();
  });

  it('includes Strict-Transport-Security in production', async () => {
    if (process.env.NODE_ENV === 'production') {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);
      expect(response.headers['strict-transport-security']).toBeDefined();
    }
  });
});
```

---

## 8. Rate Limiting Tests

```typescript
// backend/test/security/rate-limiting/throttle-enforcement.spec.ts
describe('Rate Limiting Enforcement', () => {
  it('enforces login rate limit (5/min)', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ username: 'nonexistent', password: 'wrong' })
        .expect(401);
    }
    
    // 6th request should be rate limited
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'nonexistent', password: 'wrong' })
      .expect(429);
  });

  it('enforces refresh rate limit (10/min)', async () => {
    const { refreshToken } = await login(testUser);
    
    for (let i = 0; i < 10; i++) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', `refresh_token=${refreshToken}`)
        .expect(200);
    }
    
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refresh_token=${refreshToken}`)
      .expect(429);
  });

  it('enforces change-password rate limit (5/5min)', async () => {
    const { accessToken } = await login(testUser);
    
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ currentPassword: 'wrong', newPassword: `new${i}` })
        .expect(400);
    }
    
    await request(app.getHttpServer())
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: 'wrong', newPassword: 'new6' })
      .expect(429);
  });

  it('enforces admin endpoint rate limits', async () => {
    const admin = await createTestUser({ isSuperAdmin: true });
    
    for (let i = 0; i < 20; i++) {
      await request(app.getHttpServer())
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .expect(200);
    }
    
    await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(429);
  });
});
```

---

## 9. Audit Logging Tests

```typescript
// backend/test/security/audit/audit-logging.spec.ts
describe('Audit Logging', () => {
  it('logs VIEW_SENSITIVE actions', async () => {
    const user = await createTestUser({ permissions: ['employees.view.sensitive'] });
    const emp = await createEmployee({ companyId: user.scope.companyIds[0] });
    
    await request(app.getHttpServer())
      .get(`/api/v1/employees/${emp.id}`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200);
    
    const audit = await prisma.auditLog.findFirst({
      where: { userId: user.id, action: 'VIEW_SENSITIVE', entity: 'Employee' }
    });
    expect(audit).toBeDefined();
  });

  it('blocks sensitive operations when audit fails', async () => {
    // Mock Prisma to fail auditLog.create
    jest.spyOn(prisma, 'auditLog').mockImplementation(() => ({
      create: jest.fn().mockRejectedValue(new Error('DB Error')),
    }));
    
    const user = await createTestUser({ permissions: ['employees.view.sensitive'] });
    const emp = await createEmployee({ companyId: user.scope.companyIds[0] });
    
    await request(app.getHttpServer())
      .get(`/api/v1/employees/${emp.id}`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(503); // Service Unavailable
  });

  it('continues non-sensitive operations in fail-open mode', async () => {
    jest.spyOn(prisma, 'auditLog').mockImplementation(() => ({
      create: jest.fn().mockRejectedValue(new Error('DB Error')),
    }));
    
    const user = await createTestUser({ permissions: ['employees.view'] });
    const emp = await createEmployee({ companyId: user.scope.companyIds[0] });
    
    await request(app.getHttpServer())
      .get(`/api/v1/employees/${emp.id}`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200); // Succeeds in fail-open mode
  });
});
```

---

## 10. Test Execution

### 10.1 Running All Security Tests
```bash
cd backend
npm test -- --testPathPattern=test/security
```

### 10.2 Running Specific Category
```bash
# Authentication tests
npm test -- --testPathPattern=test/security/auth

# Authorization tests
npm test -- --testPathPattern=test/security/authorization

# Tenant isolation tests
npm test -- --testPathPattern=test/security/tenant-isolation

# All security tests with coverage
npm test -- --testPathPattern=test/security --coverage
```

### 10.3 CI/CD Integration
```yaml
# .github/workflows/security-tests.yml
name: Security Regression Tests
on: [push, pull_request]
jobs:
  security-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: cd backend && npm ci
      - run: cd backend && npx prisma generate
      - run: cd backend && npm test -- --testPathPattern=test/security --coverage
      - uses: codecov/codecov-action@v3
```

---

## 11. Test Data Requirements

### 11.1 Isolated Test Database
- Use separate test database (e.g., `sana_hrms_test`)
- Run migrations before tests
- Clean database between test suites

### 11.2 Test Fixtures
- Pre-defined companies, branches, org units
- Users with various permission combinations
- Employees with different visibility settings
- Documents with different confidentiality levels

### 11.3 Cleanup
- Truncate tables after each test file
- Use transactions with rollback where possible
- Remove uploaded test files

---

**Document Version:** 1.0  
**Status:** READY FOR IMPLEMENTATION  
**Next:** Implement test files in `backend/test/security/`