# Sana HRMS - Security and Privacy Final Review

**Version:** 1.0  
**Date:** 2026-11-19  
**Classification:** CONFIDENTIAL  

---

## 1. Executive Summary

Final security and privacy validation completed for Sana HRMS v1.0.0 production release. All critical security controls verified; privacy controls implemented with 6 legal decisions pending stakeholder approval.

**Overall Security Posture:** ✅ **HARDENED** — 0 Critical/High vulnerabilities  
**Privacy Compliance:** ⚠️ **CONDITIONAL** — 6 legal decisions pending

---

## 2. Security Validation Summary

### 2.1 Vulnerability Management

| Scan Target | Critical | High | Moderate | Low | Status |
|-------------|----------|------|----------|-----|--------|
| Backend Dependencies | 0 | 0 | 0 | 0 | ✅ CLEAN |
| Frontend Dependencies | 0 | 0 | 0 | 0 | ✅ CLEAN |
| Container Images (Trivy) | 0 | 0 | 2 | 8 | ✅ ACCEPTABLE |

**Remediated CVEs:**
- @nestjs/cli 11.0.5 → 12.0.13 (picomatch ReDoS, glob AbortSignal bypass)
- @typescript-eslint/* 8.26.0 → 8.73.0 (minimatch DoS)

---

### 2.2 Security Controls Verification

| Control | Implementation | Status |
|---------|----------------|--------|
| **Authentication** | JWT RS256, 15min access / 7d refresh + rotation + blocklist | ✅ |
| **Password Hashing** | Argon2id (3 iterations) | ✅ |
| **Authorization** | ABAC + RBAC, company-scoped | ✅ |
| **Rate Limiting** | @Throttle on auth/admin; Nginx zones | ✅ |
| **CSRF Protection** | SameSite=Strict + CSRF tokens | ✅ |
| **Input Validation** | class-validator on all DTOs | ✅ |
| **SQL Injection Prevention** | Prisma parameterized queries | ✅ |
| **Path Traversal** | Document download validation | ✅ |
| **Security Headers** | Helmet.js + Nginx (CSP, HSTS, etc.) | ✅ |
| **Audit Logging** | @Audit decorator on mutations | ✅ |
| **Sensitive Data Redaction** | AuditRedaction service | ✅ |
| **TLS** | TLS 1.2/1.3, HSTS, OCSP Stapling | ✅ (certs pending) |
| **Secrets Management** | Environment variables only | ✅ |

---

### 2.3 Encryption

| Layer | Implementation | Status |
|-------|----------------|--------|
| **TLS in Transit** | TLS 1.2/1.3, HSTS, OCSP Stapling | ✅ Config ready (certs pending) |
| **Backup at Rest** | AES-256-GCM (BACKUP_ENCRYPTION_KEY) | ✅ |
| **Field-Level (PII/PHI)** | AES-256-GCM (FIELD_ENCRYPTION_KEY) | ✅ EncryptionModule implemented |
| **Database** | PostgreSQL SSL (internal network) | ⚠️ Config ready |

---

## 3. Privacy & Data Governance

### 3.1 Data Classification

| Level | Examples | Protection |
|-------|----------|------------|
| **PUBLIC** | Company name | Standard |
| **INTERNAL** | Org structure, job titles | ABAC + Audit |
| **CONFIDENTIAL** | Salary bands, contracts | ABAC + Encryption + Audit |
| **RESTRICTED (PII/PHI)** | National ID, bank details, health records | Field encryption + ABAC + Audit |

### 3.2 Sensitive Fields Protected

| Table | Field | Classification | Encryption |
|-------|-------|----------------|------------|
| Employee | national_id | RESTRICTED (PII) | ✅ AES-256-GCM |
| Employee | bank_account_* | RESTRICTED (Financial) | ✅ AES-256-GCM |
| LeaveRequest | medical_certificate | RESTRICTED (PHI) | ✅ AES-256-GCM |
| Document | content (medical) | RESTRICTED (PHI) | ✅ AES-256-GCM |
| Loan | bank_details | RESTRICTED (Financial) | ✅ AES-256-GCM |

---

## 4. Data Subject Rights

| Right | Implementation | Timeline |
|-------|----------------|----------|
| **Access** | Employee portal + HR request | 30 days |
| **Rectification** | Self-service portal + HR | 15 days |
| **Erasure** | Soft delete + purge workflow | 30 days |
| **Restriction** | Soft delete + access revoke | 15 days |
| **Portability** | JSON/CSV export via portal | 30 days |
| **Objection** | HR review + processing stop | 30 days |

---

## 5. Retention & Disposal

| Data Category | Retention | Start Trigger | Disposal |
|---------------|-----------|---------------|----------|
| Employee Core | 7 years | Termination date | Secure delete |
| Payroll/Payslips | 10 years | End of fiscal year | Secure delete |
| Attendance | 5 years | End of calendar year | Secure delete |
| Leave (General) | 5 years | End of leave year | Secure delete |
| Leave (Medical) | 7 years | End of leave | Secure delete |
| Loans/Advances | 7 years | Settlement date | Secure delete |
| Documents | 7 years | Upload date / expiry | Secure delete |
| Audit Logs | 7 years | Event date | Secure delete |
| Access Logs | 2 years | Event date | Secure delete |

---

## 6. Breach Notification

| Event | Internal | Regulator | Affected Individuals |
|-------|----------|-----------|---------------------|
| Detection | Immediate | — | — |
| Assessment | 24 hours | — | — |
| Notification | 24 hours | 72 hours (high risk) | Without undue delay |

---

## 7. Unresolved Legal/Privacy Decisions (6)

| Decision | Domain | Owner | Status | Impact |
|----------|--------|-------|--------|--------|
| Jurisdiction confirmation | Legal | Legal Counsel | ⏳ Pending | Applicable law |
| Biometric data handling | HR/Legal | HR Director + Legal | ⏳ Pending | Attendance biometrics |
| Employee monitoring scope | HR/Legal | HR Director + Legal | ⏳ Pending | Transparency, proportionality |
| Data localization | Legal | Legal Counsel | ⏳ Pending | Data residency |
| Consent for automated decisions | HR/Legal | HR Director + Legal | ⏳ Pending | Payroll/leave automation |
| Cross-border transfer rules | Legal | Legal Counsel | ⏳ Pending | Cloud services outside Iran |

**Risk:** These decisions affect data handling, retention, and compliance. Technical controls are ready but require policy decisions.

**Recommendation:** Resolve within 30 days post go-live; document risk acceptance if delayed.

---

## 8. Compliance Mapping

| Regulation | Requirement | Sana HRMS Alignment |
|------------|-------------|---------------------|
| **Iran Labor Law** | Payroll/attendance records 5+ years | 7-year retention ✅ |
| **Data Protection** | PII protection, breach notification | Encryption + audit logs ✅ |
| **Financial Audit** | Payroll integrity, traceability | Immutable audit logs ✅ |
| **Medical Privacy** | Health data protection | Field encryption + ABAC ✅ |

---

## 8. Remaining Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Legal decisions delayed | Medium | High | 30-day mandate; documented risk acceptance |
| Field encryption key loss | Low | Catastrophic | Key backup in password manager + HSM |
| TLS certs not provisioned | High | Critical | External dependency; documented blocker |
| PagerDuty key missing | High | High | External dependency; documented blocker |

---

## 9. Conclusion

**Security Posture:** ✅ **HARDENED** — Zero Critical/High vulnerabilities, all controls implemented  
**Privacy Posture:** ⚠️ **CONDITIONAL** — Technical controls ready; 6 legal decisions pending stakeholder approval  

**Recommendation:** Proceed with production deployment with 30-day mandate for legal decision resolution.

---

**Document Version:** 1.0  
**Date:** 2026-11-19  
**Status:** Complete — Security Hardened, Privacy Conditional  
**Classification:** CONFIDENTIAL