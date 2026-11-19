# Sana HRMS - Encryption and Key Management Audit

**Version:** 1.0  
**Date:** 2026-11-19  
**Auditor:** Independent Release Auditor  
**Classification:** CONFIDENTIAL  

---

## 1. Executive Summary

This audit examines the encryption implementation and key management practices in Sana HRMS.

**Critical Finding:** Field-level encryption (AES-256-GCM via `EncryptionService`) is **implemented but completely unused** - no model fields are encrypted, no Prisma middleware applies encryption.

---

## 2. Encryption Implementation

### 2.1 EncryptionService

**File:** `backend/src/common/encryption/encryption.service.ts`

```typescript
@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor(private readonly config: ConfigService) {
    const secret = this.config.get<string>('app.encryption.fieldKey') ?? 
                   this.config.get<string>('BACKUP_ENCRYPTION_KEY');
    if (!secret) {
      throw new Error('FIELD_ENCRYPTION_KEY or BACKUP_ENCRYPTION_KEY must be set');
    }
    this.key = crypto.createHash('sha256').update(secret).digest();
  }

  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(12);  // 96-bit IV for GCM
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext.toString('base64')}`;
  }

  decrypt(encrypted: string): string {
    const parts = encrypted.split(':');
    if (parts.length !== 3) throw new Error('Invalid encrypted format');
    const [ivB64, authTagB64, ciphertextB64] = parts;
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');
    const ciphertext = Buffer.from(ciphertextB64, 'base64');
    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  }

  isEncrypted(value: string): boolean {
    // Checks for iv:authTag:ciphertext format
  }
}
```

### 2.1.1 Cryptographic Correctness

| Aspect | Implementation | Assessment |
|--------|----------------|------------|
| Algorithm | AES-256-GCM | ✅ Authenticated encryption |
| Key Derivation | SHA-256 of secret | ✅ Acceptable |
| IV Generation | `crypto.randomBytes(12)` | ✅ 96-bit unique per encryption |
| Auth Tag | 16 bytes (GCM default) | ✅ 128-bit authentication |
| Encoding | Base64 (iv:authTag:ciphertext) | ✅ Standard |

**Assessment:** ✅ Cryptographically sound implementation.

---

## 2.2 Key Management

### 2.1 Key Derivation

```typescript
constructor(private readonly config: ConfigService) {
  const secret = this.config.get<string>('app.encryption.fieldKey') ?? 
                 this.config.get<string>('BACKUP_ENCRYPTION_KEY');
  if (!secret) throw new Error('FIELD_ENCRYPTION_KEY or BACKUP_ENCRYPTION_KEY must be set');
  this.key = crypto.createHash('sha256').update(secret).digest();
}
```

| Aspect | Implementation | Assessment |
|---------|----------------|------------|
| Source | `FIELD_ENCRYPTION_KEY` or `BACKUP_ENCRYPTION_KEY` | ✅ Config-driven |
| Derivation | SHA-256 hash | ✅ Acceptable |
| Key Length | 256 bits (32 bytes) | ✅ AES-256 |
| Key Storage | Environment variable | ⚠️ Not rotated |

### 2.2 Key Rotation

| Aspect | Status | Gap |
|--------|--------|-----|
| Rotation Strategy | Not documented | ❌ No rotation procedure |
| Key Versioning | Not supported | ❌ No versioning |
| Backward Compatibility | Not addressed | ❌ Old ciphertexts become unreadable after rotation |

---

## 3. Encryption Usage Audit

### 3.1 Current Usage

**Search Results:**
- `EncryptionService` imported in: `EncryptionModule`, `AppModule`
- **Zero usages** of `encrypt()` or `decrypt()` in application code
- **Zero** Prisma middleware for transparent encryption
- **Zero** model fields marked for encryption

### 3.1.1 Sensitive Fields Identified (Per Data Privacy Doc)

| Table | Field | Classification | Encrypted? |
|-------|-------|----------------|------------|
| `Employee` | `national_id` | PII | ❌ No |
| `Employee` | `bank_account_*` | Financial | ❌ No |
| `LeaveRequest` | `medical_certificate` | PHI | ❌ No |
| `Document` | `content` (medical) | PHI | ❌ No |
| `Loan` | `bank_details` | Financial | ❌ No |
| `Employee` | `mobile`, `email` | PII | ❌ No |
| `User` | `passwordHash` | Secret | ✅ Argon2id (separate) |

**Critical Finding:** All sensitive fields stored in **plaintext**.

---

## 3. Integration Requirements

### 3.1 Required Integration Points

| Layer | Required Implementation |
|---------|------------------------|
| Prisma Middleware | Transparent encrypt/decrypt on read/write |
| Field Annotation | `@Encrypted()` decorator on sensitive fields |
| Migration | Encrypt existing plaintext data |
| Key Rotation | Versioned encryption with key ID in ciphertext |

### 3.2 Prisma Middleware Design

```typescript
// Required: Prisma middleware for transparent encryption
export function createEncryptionMiddleware(encryptionService: EncryptionService) {
  return async (params: any, next: (params: any) => Promise<any>) => {
    // Before write: encrypt sensitive fields
    if (params.action === 'create' || params.action === 'update') {
      params.args.data = encryptSensitiveFields(params.args.data, params.model);
    }
    
    const result = await next(params);
    
    // After read: decrypt sensitive fields
    if (['findUnique', 'findFirst', 'findMany', 'findFirstOrThrow'].includes(params.action)) {
      result = decryptSensitiveFields(result, params.model);
    }
    return result;
  };
}
```

### 3.3 Field Classification Required

| Table | Field | Classification | Encryption Required |
|-------|-------|----------------|---------------------|
| Employee | national_id | PII | ✅ Yes |
| Employee | bank_account_* | Financial | ✅ Yes |
| Employee | mobile, email | PII | ✅ Yes |
| LeaveRequest | medical_certificate | PHI | ✅ Yes |
| Document | content | PHI | ✅ Yes |
| Loan | bank_details | Financial | ✅ Yes |
| User | passwordHash | Secret | ✅ Argon2id (separate) |

---

## 3. Key Rotation Strategy

### 3.1 Current State

| Aspect | Status | Required |
|---------|--------|----------|
| Key Versioning | ❌ Not implemented | Add key ID to ciphertext format |
| Rotation Procedure | ❌ Not documented | Document and test |
| Backward Compatibility | ❌ Not supported | Key ID in ciphertext header |
| Rotation Schedule | Not defined | Annual minimum |

### 3.1.1 Recommended Ciphertext Format with Key Versioning

```
v1:keyId:iv:authTag:ciphertext
```

Where `keyId` maps to key version in key store.

---

## 4. Backup Encryption (Separate System)

### 3.1 Backup Encryption

**File:** `backend/src/backup/backup-archive.ts`

```typescript
// AES-256-GCM with BACKUP_ENCRYPTION_KEY
// Format: iv:authTag:ciphertext (base64)
```

| Aspect | Status |
|--------|--------|
| Algorithm | AES-256-GCM ✅ |
| Key | `BACKUP_ENCRYPTION_KEY` ✅ |
| Verification | Decrypt test after encryption ✅ |
| Checksum | SHA-256 stored in DB ✅ |
| Offsite Storage | S3 Glacier IR ✅ |

**Assessment:** ✅ Backup encryption properly implemented and verified.

---

## 3. TLS/SSL Encryption

### 3.1 In-Transit

| Channel | Protocol | Status |
|---------|----------|--------|
| Client → Nginx | TLS 1.2/1.3 | ✅ Config ready (certs pending) |
| Nginx → Backend | HTTP (internal) | ⚠️ Internal only |
| Backend → Database | PostgreSQL SSL | ⚠️ Config ready |

### 3.1 Database SSL

```yaml
# docker-compose.yml - db service
# SSL not explicitly enabled for internal connections
# Can be enabled via:
# POSTGRES_SSL: "on"
# SSL_CERT_FILE, SSL_KEY_FILE, SSL_CA_FILE
```

---

## 5. Key Storage and Access Control

| Key | Storage | Access |
|-----|---------|--------|
| `BACKUP_ENCRYPTION_KEY` | Environment variable | Superadmin only |
| `FIELD_ENCRYPTION_KEY` | Environment variable | Not yet used |
| `JWT_ACCESS_SECRET` | Environment variable | Backend only |
| `JWT_REFRESH_SECRET` | Environment variable | Backend only |
| `BACKUP_ENCRYPTION_KEY` | Environment variable | Backup service only |
| `POSTGRES_PASSWORD` | Environment variable | DB + Backend |
| `SMTP_PASSWORD` | Environment variable | Notification service |
| `PAGERDUTY_KEY` | Environment variable | Alertmanager |

**Assessment:** ✅ All keys via environment variables; none in source control.

---

## 6. Encryption Verification Tests

### 3.1 Unit Tests Required

```typescript
// Required test cases for EncryptionService
describe('EncryptionService', () => {
  it('should encrypt and decrypt correctly', () => {
    const plaintext = 'sensitive-data-123';
    const encrypted = service.encrypt(plaintext);
    const decrypted = service.decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('should produce different ciphertexts for same plaintext', () => {
    const encrypted1 = service.encrypt('test');
    const encrypted2 = service.encrypt('test');
    expect(encrypted1).not.toBe(encrypted2); // Different IVs
  });

  it('should fail decryption with wrong key', () => {
    const encrypted = service.encrypt('test');
    const otherService = new EncryptionService(otherConfig);
    expect(() => otherService.decrypt(encrypted)).toThrow();
  });

  it('should detect tampering', () => {
    const encrypted = service.encrypt('test');
    const tampered = encrypted.slice(0, -1) + 'X';
    expect(() => service.decrypt(tampered)).toThrow();
  });

  it('should detect corrupted auth tag', () => {
    const parts = encrypted.split(':');
    parts[1] = 'corrupted';
    expect(() => service.decrypt(parts.join(':'))).toThrow();
  });
});
```

---

## 6. Compliance Mapping

| Requirement | Standard | Status |
|-------------|----------|--------|
| Encryption at rest (PII) | Iran Labor Law / Data Protection | ❌ Not implemented |
| Encryption at rest (Financial) | Financial Audit Standards | ❌ Not implemented |
| Encryption at rest (Health) | Medical Privacy Laws | ❌ Not implemented |
| Encryption in transit | TLS 1.2+ | ✅ Config ready |
| Key rotation | Annual | ❌ Not implemented |
| Key backup | HSM/Password Manager | ⚠️ Not verified |
| Key compromise procedure | Not documented | ❌ Not documented |

---

## 7. Recommendations

### Immediate (Pre Go-Live)
1. **Integrate EncryptionService** into Prisma middleware for sensitive fields
2. **Migrate existing data** - encrypt all existing sensitive fields
3. **Add field annotations** - `@Encrypted()` decorator for model fields

### Pre Go-Live
1. **Key rotation procedure** - document and test
2. **Key backup** - store in HSM/password manager
3. **Key compromise procedure** - document response plan

### Sprint 1 (0-30 days)
1. **Key versioning** - add key ID to ciphertext format
2. **Key rotation automation** - annual rotation with overlap period
3. **HSM integration** - evaluate AWS KMS / HashiCorp Vault

---

## 7. Conclusion

**Encryption Implementation:** ✅ Cryptographically sound (AES-256-GCM, proper IV/auth tag)

**Key Management:** ⚠️ **Partial** - Keys via env vars, but no rotation/versioning

**Critical Gap:** **Field-level encryption NOT INTEGRATED** - all sensitive PII/PHI/Financial data stored in plaintext.

**Risk:** HIGH - Data breach would expose all sensitive employee data.

**Recommendation:** **BLOCKER for production** - Must integrate field encryption before processing real employee data.

---

**Document Version:** 1.0  
**Date:** 2026-11-19  
**Auditor:** Independent Release Auditor  
**Classification:** CONFIDENTIAL