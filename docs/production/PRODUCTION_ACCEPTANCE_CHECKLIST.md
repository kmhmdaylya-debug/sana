# Sana HRMS - Production Acceptance Checklist

**Version:** 1.0  
**Date:** 2026-11-18  
**Audience:** Release Manager, QA Lead, DevOps Lead, Security Lead, Product Owner  
**Classification:** INTERNAL - Release Gate Document  

---

## 1. Overview

This checklist must be completed and signed off before any production deployment. Each item must be verified with evidence (test results, logs, screenshots, or command output).

**Release Version:** ___________  
**Deployment Date:** ___________  
**Release Manager:** ___________  

---

## 2. Pre-Deployment Checklist

### 2.1 Code Quality Gates

| # | Check | Status | Evidence | Verified By |
|---|-------|--------|----------|-------------|
| 1 | TypeScript compilation (0 errors) | ☐ Pass ☐ Fail | `npx tsc --noEmit` output | |
| 2 | ESLint (0 errors, 0 warnings) | ☐ Pass ☐ Fail | `npm run lint` output | |
| 3 | Backend unit tests (100% pass) | ☐ Pass ☐ Fail | `npm test` output + coverage | |
| 4 | Frontend unit tests (100% pass) | ☐ Pass ☐ Fail | `npm test` output + coverage | |
| 5 | Backend coverage ≥ 80% | ☐ Pass ☐ Fail | Coverage report | |
| 6 | Frontend coverage ≥ 70% | ☐ Pass ☐ Fail | Coverage report | |
| 7 | Integration tests (100% pass) | ☐ Pass ☐ Fail | `npm run test:integration` output | |
| 8 | Security audit (0 critical, 0 high) | ☐ Pass ☐ Fail | `npm audit --audit-level=high` | |
| 9 | Dependency scan (Trivy) | ☐ Pass ☐ Fail | SARIF report | |
| 10 | Docker build success | ☐ Pass ☐ Fail | Build logs | |

### 2.2 Security Validation

| # | Check | Status | Evidence | Verified By |
|---|-------|--------|----------|-------------|
| 11 | No hardcoded secrets in code | ☐ Pass ☐ Fail | `grep -r "CHANGE_ME\|password\|secret" --include="*.ts"` | |
| 12 | .env files not committed | ☐ Pass ☐ Fail | `git status` | |
| 13 | JWT secrets ≥ 32 chars, high entropy | ☐ Pass ☐ Fail | Config validation logs | |
| 14 | Backup encryption key ≥ 32 chars | ☐ Pass ☐ Fail | Config validation logs | |
| 15 | CORS origins configured for production | ☐ Pass ☐ Fail | `CORS_ORIGINS` value | |
| 16 | Swagger disabled in production | ☐ Pass ☐ Fail | `SWAGGER_ENABLED=false` | |
| 17 | Rate limiting configured | ☐ Pass ☐ Fail | Config + test results | |
| 18 | CSP headers present | ☐ Pass ☐ Fail | `curl -I` headers | |
| 19 | TLS certificates valid > 30 days | ☐ Pass ☐ Fail | `openssl x509 -checkend` | |
| 20 | Cookie settings: Secure, HttpOnly, SameSite=Strict | ☐ Pass ☐ Fail | Set-Cookie headers | |

### 2.3 Database & Migrations

| # | Check | Status | Evidence | Verified By |
|---|-------|--------|----------|-------------|
| 21 | Migration status: 0 pending | ☐ Pass ☐ Fail | `npx prisma migrate status` | |
| 22 | Pre-deployment backup completed | ☐ Pass ☐ Fail | Backup ID + timestamp | |
| 23 | Migration tested on staging | ☐ Pass ☐ Fail | Staging deployment logs | |
| 24 | No destructive migrations | ☐ Pass ☐ Fail | Migration SQL review | |
| 25 | Rollback procedure documented | ☐ Pass ☐ Fail | Rollback plan document | |

### 2.4 Infrastructure & Configuration

| # | Check | Status | Evidence | Verified By |
|---|-------|--------|----------|-------------|
| 25 | Docker images built & pushed | ☐ Pass ☐ Fail | Registry tags | |
| 26 | Resource limits configured | ☐ Pass ☐ Fail | `docker-compose.prod.yml` | |
| 27 | Health checks configured | ☐ Pass ☐ Fail | Compose healthcheck section | |
| 28 | Log rotation configured | ☐ Pass ☐ Fail | Compose logging section | |
| 29 | Volume mounts persistent | ☐ Pass ☐ Fail | Compose volumes section | |
| 30 | Non-root containers | ☐ Pass ☐ Fail | Dockerfile USER directive | |
| 31 | Environment separation | ☐ Pass ☐ Fail | Separate .env files | |
| 32 | Secrets in secret manager | ☐ Pass ☐ Fail | No secrets in .env files | |
| 33 | Timezone configured | ☐ Pass ☐ Fail | `TZ=Asia/Tehran` | |

---

## 3. Staging Acceptance Tests

### 3.1 Functional Tests (Staging Environment)

| # | Test Case | Status | Evidence | Verified By |
|---|-----------|--------|----------|-------------|
| 26 | Clean installation from scratch | ☐ Pass ☐ Fail | Fresh deploy logs | |
| 27 | Admin login with generated credentials | ☐ Pass ☐ Fail | Login screenshot | |
| 28 | Role-based access control (RBAC) | ☐ Pass ☐ Fail | Permission matrix test | |
| 29 | Employee CRUD operations | ☐ Pass ☐ Fail | Test case results | |
| 30 | Attendance check-in/out | ☐ Pass ☐ Fail | Test case results | |
| 31 | Leave request workflow | ☐ Pass ☐ Fail | Test case results | |
| 32 | Payroll period creation & calculation | ☐ Pass ☐ Fail | Test case results | |
| 33 | Document upload/download | ☐ Pass ☐ Fail | Test case results | |
| 34 | Audit log generation | ☐ Pass ☐ Fail | Audit log query | |
| 35 | Backup creation & download | ☐ Pass ☐ Fail | Backup API test | |
| 36 | Restore to staging database | ☐ Pass ☐ Fail | Restore API test | |
| 37 | Persian/RTL/Jalali rendering | ☐ Pass ☐ Fail | Visual verification | |
| 38 | Responsive design (375px, 768px, 1920px) | ☐ Pass ☐ Fail | Browser dev tools | |
| 39 | Accessibility (axe-core) | ☐ Pass ☐ Fail | Axe report | |
| 39 | Multi-company isolation | ☐ Pass ☐ Fail | Cross-company test | |

### 3.2 Performance Tests

| # | Test Case | Target | Actual | Status | Evidence |
|---|-----------|--------|--------|--------|----------|
| 40 | API p95 latency (list endpoints) | < 500ms | _____ms | ☐ Pass ☐ Fail | Load test report |
| 41 | API p95 latency (complex queries) | < 2s | _____ms | ☐ Pass ☐ Fail | Load test report |
| 42 | Frontend LCP (mobile) | < 2.5s | _____s | ☐ Pass ☐ Fail | Lighthouse report |
| 43 | Frontend TBT (mobile) | < 200ms | _____ms | ☐ Pass ☐ Fail | Lighthouse report |
| 44 | Bundle size (gzipped) | < 250KB | _____KB | ☐ Pass ☐ Fail | Build output |
| 45 | Concurrent users (100) | No errors | _____ | ☐ Pass ☐ Fail | Load test report |
| 46 | Database connection pool | < 80% usage | _____% | ☐ Pass ☐ Fail | Grafana dashboard |

### 3.3 Security Tests

| # | Test Case | Status | Evidence | Verified By |
|---|-----------|--------|----------|-------------|
| 47 | Authentication bypass attempts blocked | ☐ Pass ☐ Fail | Auth test results | |
| 48 | JWT token validation (expired, tampered) | ☐ Pass ☐ Fail | Test results | |
| 49 | Refresh token rotation works | ☐ Pass ☐ Fail | Test results | |
| 50 | Password change invalidates tokens | ☐ Pass ☐ Fail | Test results | |
| 51 | IDOR protection on all endpoints | ☐ Pass ☐ Fail | Test results | |
| 52 | Cross-company data isolation | ☐ Pass ☐ Fail | Test results | |
| 53 | File upload restrictions (exe, size, MIME) | ☐ Pass ☐ Fail | Test results | |
| 54 | CSRF protection on auth endpoints | ☐ Pass ☐ Fail | Test results | |
| 55 | Rate limiting enforced | ☐ Pass ☐ Fail | Test results | |
| 56 | Sensitive data not in logs/responses | ☐ Pass ☐ Fail | Log inspection | |

---

## 4. Production Deployment Verification

### 4.1 Immediate Post-Deployment (0-15 minutes)

| # | Check | Status | Evidence | Verified By |
|---|-------|--------|----------|-------------|
| 57 | All containers healthy | ☐ Pass ☐ Fail | `docker compose ps` | |
| 58 | Health endpoints responding | ☐ Pass ☐ Fail | `curl /health` outputs | |
| 58 | Admin login successful | ☐ Pass ☐ Fail | Login test | |
| 59 | No error spikes in logs | ☐ Pass ☐ Fail | `docker logs` | |
| 60 | Monitoring alerts clear | ☐ Pass ☐ Fail | Grafana/Alertmanager | |

### 4.2 Short-term Verification (15-60 minutes)

| # | Check | Status | Evidence | Verified By |
|---|-------|--------|----------|-------------|
| 61 | Smoke test critical paths | ☐ Pass ☐ Fail | Test execution log | |
| 62 | API response times normal | ☐ Pass ☐ Fail | Grafana dashboard | |
| 63 | Error rate < 0.1% | ☐ Pass ☐ Fail | Prometheus query | |
| 64 | Database connections stable | ☐ Pass ☐ Fail | `pg_stat_activity` | |
| 65 | Backup job runs successfully | ☐ Pass ☐ Fail | Backup history | |

### 4.3 Extended Verification (1-24 hours)

| # | Check | Status | Evidence | Verified By |
|---|-------|--------|----------|-------------|
| 66 | All scheduled jobs execute | ☐ Pass ☐ Fail | Job logs | |
| 67 | Audit logs generating | ☐ Pass ☐ Fail | Audit log query | |
| 68 | Email/SMS notifications work | ☐ Pass ☐ Fail | Test notification | |
| 69 | File uploads/downloads work | ☐ Pass ☐ Fail | Test upload | |
| 70 | No memory leaks detected | ☐ Pass ☐ Fail | Container stats | |

---

## 5. Rollback Readiness

| # | Check | Status | Evidence | Verified By |
|---|-------|--------|----------|-------------|
| 71 | Previous Docker image tags available | ☐ Pass ☐ Fail | `docker images` | |
| 72 | Database rollback procedure tested | ☐ Pass ☐ Fail | Restore test log | |
| 73 | Rollback time < 15 minutes | ☐ Pass ☐ Fail | Rollback drill log | |
| 74 | Data loss window < 1 hour | ☐ Pass ☐ Fail | Backup schedule | |

---

## 6. Documentation & Handoff

| # | Check | Status | Evidence | Verified By |
|---|-------|--------|----------|-------------|
| 75 | CHANGELOG.md updated | ☐ Pass ☐ Fail | Git diff | |
| 76 | Release notes published | ☐ Pass ☐ Fail | GitHub Release URL | |
| 77 | Runbooks updated | ☐ Pass ☐ Fail | Doc links | |
| 78 | On-call notified | ☐ Pass ☐ Fail | Slack/email | |
| 79 | Stakeholders informed | ☐ Pass ☐ Fail | Communication log | |
| 80 | Status page updated | ☐ Pass ☐ Fail | Status page URL | |

---

## 7. Sign-Off

### 6.1 Required Approvals

| Role | Name | Signature | Date | Status |
|------|------|-----------|------|--------|
| **Release Manager** | | | | ☐ Approved ☐ Rejected |
| **QA Lead** | | | | ☐ Approved ☐ Rejected |
| **DevOps Lead** | | | | ☐ Approved ☐ Rejected |
| **Security Lead** | | | | ☐ Approved ☐ Rejected |
| **Product Owner** | | | | ☐ Approved ☐ Rejected |
| **Engineering Lead** | | | | ☐ Approved ☐ Rejected |

### 6.2 Deployment Authorization

- [ ] All mandatory checks **PASSED**
- [ ] No **BLOCKING** issues remain
- [ ] Rollback plan **CONFIRMED**
- [ ] Team **READY** for deployment
- [ ] Deployment **AUTHORIZED**

**Final Decision:** ☐ **APPROVED FOR PRODUCTION DEPLOYMENT**  
**Decision:** ☐ **REJECTED - REWORK REQUIRED**

---

## 7. Post-Deployment Follow-Up (24-48 hours)

| # | Action | Owner | Due Date | Status |
|---|--------|-------|----------|--------|
| 1 | Monitor error rates & latency | DevOps | +24h | |
| 2 | Verify backup completion | DevOps | +24h | |
| 3 | Check audit log integrity | Security | +24h | |
| 4 | Review user feedback | Product | +48h | |
| 5 | Update runbooks if needed | DevOps | +48h | |
| 6 | Close deployment ticket | Release Mgr | +48h | |

---

## 8. Notes & Exceptions

| Item # | Description | Exception Reason | Mitigation | Approved By |
|--------|-------------|------------------|------------|-------------|
| | | | | |

---

**Checklist Version:** 1.0  
**Release Version:** ___________  
**Completed By:** ___________  
**Date:** ___________  

**Final Status:** ☐ **ALL CHECKS PASSED - READY FOR PRODUCTION**  
☐ **CONDITIONAL PASS - EXCEPTIONS DOCUMENTED**  
☐ **FAILED - DO NOT DEPLOY**