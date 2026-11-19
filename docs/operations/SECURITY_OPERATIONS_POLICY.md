# Sana HRMS - Security Operations Policy

**Version:** 1.0  
**Date:** 2026-11-18  
**Status:** Active — Staging Verified, Production Pending  
**Classification:** CONFIDENTIAL — Security / Operations Only  

---

## 1. Purpose and Scope

This policy defines the continuous security operations for Sana HRMS, including vulnerability management, secrets rotation, access control, monitoring, and incident response.

**Scope:** All Sana HRMS environments (production, staging, development), including:
- Application code and dependencies
- Infrastructure (Docker, PostgreSQL, Nginx)
- CI/CD pipeline
- Monitoring and logging systems
- Third-party integrations

---

## 2. Security Controls Inventory

### 2.1 Implemented Controls (Staging Verified)

| Control | Implementation | Status |
|---------|----------------|--------|
| **Authentication** | JWT RS256, 15min access / 7d refresh, rotation + blocklist | ✅ |
| **Password Hashing** | Argon2id (3 iterations) | ✅ |
| **Authorization** | ABAC + RBAC, company-scoped | ✅ |
| **Rate Limiting** | @Throttle on auth/admin endpoints | ✅ |
| **SameSite Cookies** | Strict | ✅ |
| **CSRF Protection** | SameSite=Strict + CSRF tokens on forms | ✅ |
| **Input Validation** | class-validator on all DTOs | ✅ |
| **SQL Injection Prevention** | Prisma parameterized queries | ✅ |
| **Path Traversal** | Document download validation | ✅ |
| **Security Headers** | Helmet.js + Nginx CSP/HSTS | ✅ |
| **Audit Logging** | @Audit decorator on mutations | ✅ |
| **Sensitive Data Redaction** | AuditRedaction service | ✅ |
| **TLS Termination** | Nginx (production) | ⚠️ Staging only |
| **Secrets Management** | Environment variables + Docker secrets | ⚠️ Partial |

### 2.2 Deferred Security Items (Stage 11)

| CVE / Issue | Component | Severity | Status | Target |
|-------------|-----------|----------|--------|--------|
| picomatch ReDoS | @nestjs/cli (build-time) | Critical | ⏸️ Deferred | Sprint 1 |
| minimatch DoS | @typescript-eslint (build-time) | Critical | ⏸️ Deferred | Sprint 1 |
| glob AbortSignal bypass | @nestjs/cli (build-time) | Critical | ⏸️ Deferred | Sprint 1 |

**Risk Assessment:** Build-time dependencies only; no runtime exploit path in production containers.

---

## 3. Vulnerability Management

### 3.1 Process

```
DETECT → CLASSIFY → PRIORITIZE → REMEDIATE → VERIFY → DEPLOY
```

### 3.2 Detection Sources

| Source | Frequency | Tool |
|--------|-----------|------|
| **Dependency Scan** | Per PR + Daily | `npm audit`, Trivy |
| **Container Scan** | Per Build | Trivy |
| **Code Scan** | Per PR | ESLint security rules |
| **CVE Monitoring** | Daily | GitHub Dependabot, NVD |
| **Penetration Test** | Quarterly | External |

### 3.3 Classification (CVSS + Context)

| Severity | CVSS Range | SLA | Example |
|----------|------------|-----|---------|
| **Critical** | 9.0-10.0 | 24 hours | RCE, auth bypass, data exposure |
| **High** | 7.0-8.9 | 72 hours | Privilege escalation, DoS |
| **Medium** | 4.0-6.9 | 30 days | Information disclosure, XSS |
| **Low** | 0.1-3.9 | 90 days | Minor info leak, config issue |

### 3.4 Remediation Workflow

| Step | Action | Owner | Tool |
|------|--------|-------|------|
| 1. **Detect** | Alert from scanner | DevOps | Trivy/Dependabot |
| 2. **Triage** | Assess exploitability, impact | Security Engineer | CVSS + context |
| 3. **Patch** | Update dependency / apply fix | Backend/Frontend Lead | npm/yarn |
| 4. **Test** | Regression + security tests | QA | Jest/Playwright |
| 5. **Deploy** | Staging → Production | Release Manager | CI/CD |
| 6. **Verify** | Re-scan, confirm fix | Security Engineer | Trivy |

### 3.5 Exception Process

If patch cannot be applied within SLA:
1. Document compensating controls (WAF rules, network isolation, monitoring)
2. Get approval from Security Engineer + Engineering Lead
3. Track in risk register with target resolution date
4. Review weekly until resolved

---

## 4. Secrets Management

### 4.1 Current State

| Secret | Storage | Rotation | Status |
|--------|---------|----------|--------|
| `POSTGRES_PASSWORD` | .env + Docker secret | Annual | ✅ |
| `JWT_ACCESS_SECRET` | .env | 90 days | ✅ |
| `JWT_REFRESH_SECRET` | .env | 90 days | ✅ |
| `BACKUP_ENCRYPTION_KEY` | .env | Annual | ✅ |
| `ADMIN_PASSWORD` | .env | On compromise | ✅ |
| `SMTP_PASSWORD` | .env | Per provider policy | ✅ |
| `SLACK_WEBHOOK_URL` | .env | On compromise | ⚠️ In .env |
| `PAGERDUTY_KEY` | .env | On compromise | ❌ Not set |

### 4.2 Rotation Schedule

| Secret | Frequency | Trigger | Process |
|--------|-----------|---------|---------|
| JWT Secrets | 90 days | Scheduled | Generate → Update .env → Restart backend |
| DB Password | Annual | Scheduled | Generate → Update .env → Restart DB + backend |
| Backup Key | Annual | Scheduled | Re-encrypt backups (optional) |
| SMTP/PagerDuty | On compromise | Incident | Update provider → Update .env → Restart |

### 4.3 Rotation Procedure (JWT Secrets Example)

```bash
# 1. Generate new secrets
ACCESS_SECRET=$(openssl rand -base64 64)
REFRESH_SECRET=$(openssl rand -base64 64)

# 2. Update .env
sed -i "s/JWT_ACCESS_SECRET=.*/JWT_ACCESS_SECRET=$ACCESS_SECRET/" .env
sed -i "s/JWT_REFRESH_SECRET=.*/JWT_REFRESH_SECRET=$REFRESH_SECRET/" .env

# 3. Restart backend (invalidates all existing tokens)
docker compose restart backend

# 4. Verify
curl -X POST https://sana-hrms.com/api/v1/auth/login ...
```

### 4.4 Secrets Storage Policy

| Environment | Storage | Access |
|-------------|---------|--------|
| **Production** | Docker Secrets / HashiCorp Vault | DevOps Lead, DBA |
| **Staging** | .env (restricted) | DevOps, Leads |
| **Development** | .env.local (gitignored) | Developers |

**Never:** Commit secrets to Git, store in plaintext files, share via chat/email.

---

## 5. Access Control

### 5.1 Principle of Least Privilege

| Role | Database | Application | Infrastructure | Monitoring |
|------|----------|-------------|----------------|------------|
| **DBA** | Full | Read | Read | Admin |
| **DevOps Lead** | Read | Deploy | Admin | Admin |
| **Backend Lead** | Read | Write (code) | Read | Read |
| **Frontend Lead** | — | Write (code) | — | Read |
| **Security Engineer** | Read | Read | Read | Admin |
| **On-call Engineer** | Read | Read | Restart | Read |
| **Developer** | — | Write (feature branch) | — | — |

### 5.2 Access Review

| Review | Frequency | Owner |
|--------|-----------|-------|
| **User Access** | Quarterly | Engineering Lead |
| **Service Accounts** | Monthly | DevOps Lead |
| **API Keys** | Monthly | DevOps Lead |
| **SSH Keys** | Quarterly | DevOps Lead |
| **Database Users** | Quarterly | DBA |

### 5.3 Privileged Access Management

- **No standing privileged access** — Use just-in-time elevation
- **All admin actions logged** — AuditLog with IMPERSONATE action
- **Break-glass procedure** — Documented for emergency DB access
- **MFA required** — For all admin console access

---

## 6. Network Security

### 6.1 Network Segmentation (Docker)

```
┌─────────────────────────────────────────────────────────────────┐
│                         Docker Network                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐         ┌─────────────┐                        │
│  │  Frontend   │────────▶│  Backend    │                        │
│  │  (Nginx)    │  :4114  │  (NestJS)   │                        │
│  └─────────────┘         └──────┬──────┘                        │
│                                 │                                │
│                    ┌────────────┴────────┐                       │
│                    ▼                     ▼                       │
│             ┌───────────┐        ┌─────────────┐                │
│             │ Database  │        │ Monitoring  │                │
│             │ (Postgres)│        │ (Prometheus,│                │
│             │  :5432    │        │  Loki, etc.)│                │
│             └───────────┘        └─────────────┘                │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Firewall Rules (Host Level)

| Port | Source | Destination | Purpose |
|------|--------|-------------|---------|
| 80/443 | Internet | Frontend (Nginx) | HTTPS traffic |
| 4114 | Frontend | Backend | API proxy |
| 5432 | Backend | Database | PostgreSQL |
| 9090 | Monitoring | Prometheus | Metrics |
| 3000 | Internal | Grafana | Dashboards |
| 9093 | Internal | Alertmanager | Alerts |

### 6.3 TLS Configuration

| Component | Protocol | Cipher Suite | Certificate |
|-----------|----------|--------------|-------------|
| **Frontend (Nginx)** | TLS 1.2/1.3 | ECDHE+AES-GCM | Let's Encrypt (prod) |
| **Database** | TLS 1.2+ | — | Self-signed (internal) |
| **Monitoring** | TLS 1.2+ | — | Self-signed (internal) |

---

## 7. Application Security

### 7.1 Secure Coding Standards

| Practice | Enforcement |
|----------|-------------|
| **No raw SQL** | Prisma only — ESLint rule |
| **Parameterized queries** | Prisma only — ESLint rule |
| **Input validation** | class-validator on all DTOs — CI check |
| **Output encoding** | React auto-escape — ESLint rule |
| **Auth checks** | @AuthGuard on all controllers — CI check |
| **ABAC checks** | PermissionGuard on all mutating endpoints — CI check |
| **Rate limiting** | @Throttle on auth/admin — CI check |
| **Audit logging** | @Audit on all mutations — CI check |

### 7.2 Security Testing in CI/CD

| Test | Tool | Stage | Gate |
|------|------|-------|------|
| **SAST** | ESLint security | PR | Required |
| **Dependency Scan** | `npm audit --audit-level=high` | PR | Required |
| **Container Scan** | Trivy | Build | Required |
| **Secrets Scan** | TruffleHog | PR | Required |
| **DAST** | OWASP ZAP (planned) | Staging | Optional |

---

## 8. Incident Response (Security)

### 8.1 Security Incident Types

| Type | Examples | Initial Severity |
|------|----------|------------------|
| **Credential Compromise** | Phishing, token theft | SEV-1 |
| **Unauthorized Access** | ABAC bypass, IDOR | SEV-1 |
| **Data Exposure** | PII/Financial leak | SEV-1 |
| **Injection Attack** | SQLi, XSS, command injection | SEV-1 |
| **DoS/DDoS** | Resource exhaustion | SEV-2 |
| **Malware/Ransomware** | Encrypted files, ransom note | SEV-1 |
| **Insider Threat** | Privilege abuse, data theft | SEV-1 |

### 8.2 Security Incident Response Flow

```
DETECT → CONTAIN → ERADICATE → RECOVER → REVIEW
```

**Containment (First 15 min):**
- Block malicious IPs at firewall
- Revoke compromised sessions/tokens
- Rotate compromised secrets
- Preserve evidence (logs, memory dumps)

**Eradication:**
- Root cause analysis
- Remove attacker persistence
- Patch vulnerability
- Harden defenses

**Recovery:**
- Restore from clean backup if needed
- Verify integrity
- Monitor for recurrence

### 8.3 Evidence Preservation

| Evidence | Retention | Storage |
|----------|-----------|---------|
| **Logs** | 7 years | Loki + S3 archive |
| **Memory Dumps** | 1 year | Encrypted S3 |
| **Disk Images** | 1 year | Encrypted S3 |
| **Network Captures** | 1 year | Encrypted S3 |
| **Forensic Reports** | 7 years | Secure storage |

---

## 9. Compliance and Audit

### 9.1 Regulatory Requirements

| Regulation | Requirement | Implementation |
|------------|-------------|----------------|
| **Iran Labor Law** | Payroll records 5+ years | 7-year retention ✅ |
| **Data Protection** | PII protection, breach notification | Encryption + audit logs ✅ |
| **Financial Audit** | Payroll integrity, traceability | Immutable audit logs ✅ |

### 9.2 Audit Requirements

| Audit Type | Frequency | Scope | Owner |
|------------|-----------|-------|-------|
| **Internal Security Audit** | Quarterly | Controls, configs, logs | Security Engineer |
| **Dependency Audit** | Monthly | npm audit, Trivy | DevOps |
| **Access Review** | Quarterly | User roles, permissions | Engineering Lead |
| **Penetration Test** | Annually | Full application | External |
| **Compliance Review** | Semi-annually | Regulatory alignment | Legal/Compliance |

### 9.3 Audit Trail Requirements

| Event | Logged | Fields |
|-------|--------|--------|
| **Authentication** | ✅ | user, ip, userAgent, success/failure, timestamp |
| **Authorization** | ✅ | user, resource, action, allowed/denied, timestamp |
| **Data Access** | ✅ | user, resource, fields, timestamp |
| **Data Modification** | ✅ | user, resource, before/after, timestamp |
| **Admin Actions** | ✅ | admin, action, target, timestamp |
| **Security Events** | ✅ | type, severity, source, details, timestamp |

---

## 9. Security Monitoring

### 9.1 Key Security Metrics

| Metric | Alert Threshold | Dashboard |
|--------|-----------------|-----------|
| Failed logins / 5min | > 20 | Auth |
| 403 errors / 5min | > 50 | Auth |
| Audit log failures | > 0 | Audit |
| New admin accounts | > 0 | Access |
| Privilege escalation | > 0 | Access |
| Failed MFA | > 10/hr | Auth |

### 9.2 Log Sources for Security

| Source | Tool | Retention |
|--------|------|-----------|
| **Application** | Loki | 7 days |
| **Audit Log** | Database + Loki | 7 years |
| **Nginx Access** | Loki | 7 days |
| **Database** | pgAudit + Loki | 7 days |
| **Container** | Loki | 7 days |
| **Network** | (Planned) Zeek | 90 days |

---

## 10. Third-Party Risk Management

| Vendor | Service | Risk Level | Assessment |
|--------|---------|------------|------------|
| **PostgreSQL** | Database | Low | Regular updates |
| **NestJS/React** | Framework | Low | Regular updates |
| **Docker** | Container | Low | Regular updates |
| **Nginx** | Proxy | Low | Regular updates |
| **SMTP Provider** | Email | Medium | Annual review |
| **S3/GCS** | Storage | Low | Annual review |
| **Monitoring Stack** | Observability | Low | Regular updates |

---

## 10. Security Training

| Training | Frequency | Audience |
|----------|-----------|----------|
| **Secure Coding** | Quarterly | Developers |
| **Incident Response** | Quarterly | On-call, Leads |
| **Phishing Awareness** | Semi-annually | All staff |
| **Secrets Handling** | Annually | All engineers |
| **Incident Response Drill** | Quarterly | Incident Commanders |

---

## 11. Policy Review

| Trigger | Frequency | Owner |
|---------|-----------|-------|
| **Scheduled Review** | Quarterly | Security Engineer |
| **Post-Incident** | After each SEV-1 | Incident Commander |
| **Regulatory Change** | As needed | Legal/Compliance |
| **Architecture Change** | As needed | Engineering Lead |

---

**Document Version:** 1.0  
**Date:** 2026-11-18  
**Status:** Active — Staging Verified  
**Classification:** CONFIDENTIAL