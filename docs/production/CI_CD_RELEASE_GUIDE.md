# Sana HRMS - CI/CD Release Guide

**Version:** 1.0  
**Date:** 2026-11-18  
**Audience:** DevOps Engineers, Release Managers, Development Team  

---

## 1. Release Strategy

### 1.1 Branching Model

```
main ─────────────────────────────────────────────────────► (Production)
  │
  ├── release/v1.2.0 ───────────────────────────────────► (Release candidate)
  │       │
  │       ├── hotfix/v1.2.1 ────────────────────────────► (Patch)
  │
  ├── develop ──────────────────────────────────────────► (Staging/Integration)
  │       │
  │       ├── feature/employee-portal ─────────────────► (Feature)
  │       ├── feature/payroll-reports ─────────────────► (Feature)
  │       └── bugfix/attendance-timezone ──────────────► (Bug fix)
  │
  └── feature/* ────────────────────────────────────────► (Short-lived features)
```

### 1.2 Environment Mapping

| Branch | Environment | Deployment Trigger |
|--------|-------------|-------------------|
| `main` | Production | Manual approval (workflow_dispatch) |
| `release/*` | Staging | Auto on push to release branch |
| `develop` | Staging | Auto on push |
| `feature/*` | Preview (optional) | Auto on PR |
| `hotfix/*` | Staging → Production | Auto on push, manual to prod |

---

## 2. Pipeline Stages

### 2.1 Pipeline Overview

```
┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│   Lint &    │──►│  Unit Tests │──►│ Integration │──►│  Security   │──►│  Docker     │
│  TypeCheck  │   │  (Parallel) │   │  Tests      │   │  Scans      │   │  Build      │
└─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘
       │                │                │                │                │
       ▼                ▼                ▼                ▼                ▼
  Quality Gates    Coverage >80%    All Pass         No Critical      Images
  Must Pass        Required         Required         Vulns            Pushed
```

### 2.2 Stage Details

| Stage | Tools | Timeout | Artifacts |
|-------|-------|---------|-----------|
| **Lint & TypeScript** | ESLint, tsc | 10 min | - |
| **Backend Unit Tests** | Jest, Supertest | 15 min | Coverage (lcov) |
| **Frontend Unit Tests** | Vitest, RTL | 10 min | Coverage (lcov) |
| **Integration Tests** | Docker Compose, Jest | 30 min | Test results |
| **Security Scans** | npm audit, Trivy | 15 min | SARIF reports |
| **Docker Build** | Buildx, BuildKit | 20 min | Multi-arch images |

---

## 3. Quality Gates

### 3.1 Mandatory Gates (Block Deployment)

| Gate | Threshold | Failure Action |
|------|-----------|----------------|
| **TypeScript** | 0 errors | Block |
| **ESLint** | 0 errors, 0 warnings | Block |
| **Backend Tests** | 100% pass | Block |
| **Frontend Tests** | 100% pass | Block |
| **Integration Tests** | 100% pass | Block |
| **Security Audit** | 0 critical, 0 high | Block |
| **Coverage (Backend)** | ≥ 80% statements | Block |
| **Coverage (Frontend)** | ≥ 70% statements | Block |
| **Docker Build** | Success | Block |

### 3.2 Advisory Gates (Warning Only)

| Gate | Threshold | Action |
|------|-----------|--------|
| **Bundle Size** | < 250KB gzipped | Warn |
| **Dependencies** | No major version drift | Warn |
| **License** | No GPL/AGPL | Warn |

---

## 4. Release Versioning

### 4.1 Semantic Versioning

```
MAJOR.MINOR.PATCH[-PRERELEASE][+BUILD]

Examples:
  1.0.0           - Initial production release
  1.1.0           - New features, backward compatible
  1.1.1           - Bug fixes
  2.0.0           - Breaking changes
  1.2.0-rc.1      - Release candidate
  1.2.0-beta.3    - Beta release
  1.1.1+build.42  - Build metadata
```

### 4.2 Version Bumping

```bash
# Automated via release workflow
npm version patch|minor|major --no-git-tag-version

# Or manual
# 1. Update package.json version
# 2. Update CHANGELOG.md
# 3. Create git tag: git tag -a v1.2.0 -m "Release v1.2.0"
# 4. Push tag: git push origin v1.2.0
```

### 4.3 Release Tags

| Tag Pattern | Description |
|-------------|-------------|
| `v*` | Production releases |
| `v*-rc.*` | Release candidates |
| `v*-beta.*` | Beta releases |
| `v*-alpha.*` | Alpha/internal |

---

## 5. Deployment Process

### 5.1 Production Deployment Checklist

```markdown
## Pre-Deployment
- [ ] All quality gates passing
- [ ] Release notes prepared (CHANGELOG.md)
- [ ] Database migration reviewed (if any)
- [ ] Backup completed (< 1 hour ago)
- [ ] Rollback plan documented
- [ ] Stakeholders notified
- [ ] Maintenance window scheduled (if breaking changes)

## Deployment
- [ ] Trigger workflow_dispatch with `deploy_target: production`
- [ ] Monitor pipeline stages
- [ ] Verify health checks post-deployment
- [ ] Smoke test critical paths
- [ ] Verify monitoring/alerting active

## Post-Deployment
- [ ] Update deployment log
- [ ] Close related issues/PRs
- [ ] Notify stakeholders
- [ ] Monitor for 30 minutes
- [ ] Update status page
```

### 5.2 Deployment Commands

```bash
# Option 1: GitHub Actions (Recommended)
# Trigger via GitHub UI or CLI
gh workflow run ci-cd.yml -f deploy_target=production

# Option 2: Manual Docker Compose (Emergency)
# On production server:
docker compose -f docker-compose.yml -f docker-compose.prod.yml pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --remove-orphans

# Option 3: Kubernetes (Future)
kubectl apply -f k8s/production/
kubectl rollout status deployment/sana-backend
kubectl rollout status deployment/sana-frontend
```

### 5.3 Rollback Procedure

```bash
# Docker Compose Rollback
# 1. Identify previous image tag
docker images | grep sana-backend

# 2. Update docker-compose.prod.yml with previous tag
# 3. Deploy
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Database Rollback (if migration applied)
# 1. Stop backend
docker compose stop backend

# 2. Restore pre-migration backup
./scripts/restore-backup.sh <backup-id>

# 3. Start backend
docker compose up -d backend
```

---

## 6. Release Artifacts

### 6.1 Required Artifacts

| Artifact | Location | Retention |
|----------|----------|-----------|
| **Docker Images** | `ghcr.io/org/sana-hrms-backend:vX.Y.Z` | 1 year |
| **Docker Images** | `ghcr.io/org/sana-hrms-frontend:vX.Y.Z` | 1 year |
| **Source Archive** | GitHub Release assets | Permanent |
| **SBOM** | GitHub Release assets | 1 year |
| **Release Notes** | CHANGELOG.md + GitHub Release | Permanent |
| **Migration Scripts** | GitHub Release (if DB changes) | Permanent |

### 6.2 SBOM Generation

```bash
# In CI pipeline
- name: Generate SBOM
  uses: anchore/sbom-action@v0
  with:
    image: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}-backend:${{ steps.meta-backend.outputs.tags }}
    format: spdx-json
    output-file: sbom-backend.spdx.json

- name: Upload SBOM
  uses: github/codeql-action/upload-sarif@v2
  with:
    sarif_file: sbom-backend.spdx.json
    category: sbom
```

---

## 7. Database Migrations in CI/CD

### 7.1 Migration Safety Rules

1. **Never** run destructive migrations (`DROP`, `TRUNCATE`) without explicit approval
2. **Always** test migrations on production-like data volume
3. **Always** have a rollback plan (forward-fix or backup restore)
4. **Separate** schema changes from data migrations
5. **Run** migrations before application startup (`command: sh -c "npx prisma migrate deploy && node dist/main.js"`)

### 7.2 Migration in Pipeline

```yaml
# In integration-tests job
- name: Run migrations on test DB
  run: |
    cd backend
    npx prisma migrate deploy
  env:
    DATABASE_URL: postgresql://sana:test@localhost:5432/sana_test

# In deploy-staging job
- name: Run migrations on staging
  run: |
    # Connect to staging DB and run migrations
    kubectl exec -n staging deploy/sana-backend -- npx prisma migrate deploy
```

---

## 8. Release Communication

### 8.1 Release Notes Template

```markdown
# Sana HRMS v1.2.0 - Release Notes

## 🚀 New Features
- Feature 1: Description
- Feature 2: Description

## 🐛 Bug Fixes
- Fix 1: Description
- Fix 2: Description

## ⚡ Performance Improvements
- Improvement 1: Description

## 🔒 Security
- Security fix: Description

## 📦 Dependency Updates
- Package: old → new

## 💥 Breaking Changes
- Change 1: Migration guide link

## 📋 Migration Notes
- Run `npx prisma migrate deploy` after deployment
- Backup database before applying

## 📥 Download
- Backend: `docker pull ghcr.io/org/sana-hrms-backend:v1.2.0`
- Frontend: `docker pull ghcr.io/org/sana-hrms-frontend:v1.2.0`
```

### 8.2 Communication Channels

| Channel | Audience | Timing |
|---------|----------|--------|
| **GitHub Release** | Developers, Ops | Immediate |
| **Slack #releases** | Internal team | Immediate |
| **Email** | Stakeholders | Within 1 hour |
| **Status Page** | Customers | If user-facing changes |
| **Changelog** | All users | With release |

---

## 9. Hotfix Process

### 9.1 When to Hotfix

- Critical security vulnerability
- Data corruption bug
- Complete service outage
- Regulatory compliance issue

### 9.2 Hotfix Workflow

```bash
# 1. Create hotfix branch from main
git checkout main
git pull
git checkout -b hotfix/v1.2.1

# 2. Apply fix, test locally
# 3. Update version (patch)
npm version patch  # Updates to 1.2.1

# 4. Push and create PR to main
git push origin hotfix/v1.2.1
gh pr create --base main --title "Hotfix v1.2.1: <description>"

# 5. After review and CI pass, merge to main
# 6. Tag is created automatically via workflow

# 7. Deploy to production
gh workflow run ci-cd.yml -f deploy_target=production

# 8. Backport to develop if needed
git checkout develop
git cherry-pick <hotfix-commit>
git push origin develop
```

---

## 10. Compliance & Audit

### 10.1 Release Audit Trail

Each release must have:

| Record | Location |
|--------|----------|
| Git tag | `git tag -a v1.2.0` |
| GitHub Release | `github.com/org/repo/releases/tag/v1.2.0` |
| Pipeline Run | GitHub Actions run URL |
| Deploy Log | Deployment system logs |
| Verification Results | Post-deploy smoke test report |
| Rollback Plan | Documented in release PR |

### 10.2 Retention

| Artifact | Retention |
|----------|-----------|
| Release tags | Permanent |
| Pipeline logs | 2 years |
| Docker images | 1 year |
| Deployment logs | 3 years |

---

## 11. Emergency Procedures

### 11.1 Emergency Deploy (Bypass Normal Pipeline)

```bash
# Only for critical security fixes
# Requires: CTO + Security Lead approval

# 1. Build locally with exact same commit
docker build -t ghcr.io/org/sana-hrms-backend:emergency-fix ./backend
docker build -t ghcr.io/org/sana-hrms-frontend:emergency-fix ./frontend

# 2. Push to registry
docker push ghcr.io/org/sana-hrms-backend:emergency-fix
docker push ghcr.io/org/sana-hrms-frontend:emergency-fix

# 3. Deploy to production
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
  pull backend frontend
# Update image tags in docker-compose.prod.yml to emergency-fix
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# 4. Document everything for post-incident review
```

### 11.2 Post-Emergency Actions

1. Create proper hotfix branch
2. Run full CI/CD pipeline
3. Replace emergency images with proper release
4. Conduct incident review within 48 hours

---

## 12. Release Calendar

| Week | Activity |
|------|----------|
| **Mon** | Sprint planning, version bump decision |
| **Tue-Wed** | Feature development, PR reviews |
| **Thu** | Release candidate branch cut |
| **Fri** | RC testing, bug fixes |
| **Mon (next)** | Production deployment (if approved) |

---

**Document Version:** 1.0  
**Last Updated:** 2026-11-18  
**Next Review:** Sprint Planning  
**Owner:** DevOps / Release Management