# Sana HRMS - Disaster Recovery Plan

**Version:** 1.0  
**Date:** 2026-11-18  
**Classification:** CONFIDENTIAL - Internal Use Only  
**Audience:** Executive Leadership, DevOps, DBA, Security, IT Operations  

---

## 1. Executive Summary

This Disaster Recovery Plan (DRP) defines the procedures, responsibilities, and resources required to recover the Sana HRMS system following a disruptive event. The plan covers scenarios from minor service degradation to complete site loss.

### 1.1 Recovery Objectives

| Metric | Target | Measurement |
|--------|--------|-------------|
| **RPO (Recovery Point Objective)** | ≤ 24 hours | Daily automated backups |
| **RTO (Recovery Time Objective)** | ≤ 4 hours | Restore + verification |
| **RTO (Critical Services)** | ≤ 1 hour | Health checks, auth |
| **Maximum Data Loss** | 24 hours | Last successful backup |

### 1.2 Scope

**In Scope:**
- Sana HRMS Backend API (NestJS)
- Sana HRMS Frontend (React)
- PostgreSQL 16 Database
- File Uploads (documents, attachments)
- Audit Logs
- Configuration & Secrets

**Out of Scope:**
- Client-side browser issues
- Third-party service outages (email, SMS)
- Physical facility disasters (covered by hosting provider)

---

## 2. Risk Assessment & Scenarios

### 2.1 Disaster Scenarios

| Scenario | Likelihood | Impact | RTO | RPO |
|----------|------------|--------|-----|-----|
| **Database Corruption** | Medium | Critical | 4h | 24h |
| **Server Failure (Single)** | Low | High | 2h | 0h (HA) |
| **Container Failure** | Medium | High | 15m | 0h |
| **Accidental Data Deletion** | Low | Critical | 4h | 24h |
| **Failed Migration** | Low | High | 2h | 0h |
| **Credential Compromise** | Low | Critical | 1h | 0h |
| **Network Outage** | Low | High | 1h | 0h |
| **Storage Failure** | Low | Critical | 4h | 24h |
| **Ransomware/Malware** | Low | Critical | 8h | 24h |
| **Complete Site Loss** | Very Low | Catastrophic | 24h | 24h |

### 2.2 Critical Data Assets

| Asset | Classification | Backup Frequency | Retention |
|-------|----------------|------------------|-----------|
| Employee Records | PII/Confidential | Daily | 7 years |
| Payroll Data | Financial/Confidential | Daily | 10 years |
| Attendance Records | Operational | Daily | 5 years |
| Audit Logs | Security/Compliance | Continuous | 7 years |
| Documents/Files | Confidential | Daily | 7 years |
| System Configuration | Operational | On change | 1 year |

---

## 3. Roles & Responsibilities

### 3.1 Incident Response Team

| Role | Primary | Backup | Responsibilities |
|------|---------|--------|------------------|
| **Incident Commander** | DevOps Lead | CTO | Overall coordination, executive communication |
| **Database Recovery** | Senior DBA | DevOps Engineer | DB restore, validation, performance |
| **Application Recovery** | Backend Lead | Frontend Lead | Service restart, config, health checks |
| **Infrastructure** | DevOps Engineer | Cloud Provider Support | Server, network, storage recovery |
| **Security** | Security Engineer | CISO | Credential rotation, forensic analysis |
| **Communications** | Project Manager | HR Lead | Stakeholder updates, user communication |

### 3.2 Escalation Matrix

```
Level 1 (0-30 min):     On-call Engineer → Team Lead
Level 2 (30 min-2 hr):  Team Lead → DevOps Lead
Level 3 (2-4 hr):       DevOps Lead → CTO
Level 4 (4+ hr):        CTO → CEO + Legal + Compliance
```

### 3.3 Communication Channels

| Channel | Purpose | Participants |
|---------|---------|--------------|
| **Slack #incident-response** | Real-time coordination | All responders |
| **Phone Bridge** | Voice coordination | Incident Commander + Leads |
| **Email (incidents@sana-hrms.com)** | Formal notifications | Executives, Legal, Compliance |
| **Status Page** | User-facing updates | Customers, Users |

---

## 4. Recovery Procedures by Scenario

### 4.1 Database Corruption

**Detection:** Health check fails, `pg_dump` errors, checksum mismatches

**Procedure:**
1. **Isolate**: Stop backend connections to DB
2. **Assess**: Run `pg_dump --schema-only` to assess corruption scope
3. **Restore**: Execute [DATABASE_RESTORE_GUIDE.md] Section 6.1
4. **Verify**: Row counts, foreign keys, business invariants
5. **Restart**: Backend with restored DB

**Timeline:** 2-4 hours

### 4.2 Server Failure (Single Node)

**Detection:** Container health checks fail, host unreachable

**Procedure:**
1. **Failover**: Docker Swarm/K8s restarts containers on healthy node
2. **Verify**: Health checks pass, API responds
3. **Monitor**: Watch for cascading failures

**Timeline:** 15-30 minutes (automatic)

### 4.3 Container Failure

**Detection:** Health check fails, `docker ps` shows restarting/exited

**Procedure:**
1. **Diagnose**: `docker logs sana-backend --tail 100`
2. **Fix**: Config issue → restart; Code issue → rollback image
3. **Restart**: `docker compose restart backend`

**Timeline:** 15 minutes

### 4.4 Accidental Data Deletion

**Detection:** User reports missing data, audit log shows DELETE

**Procedure:**
1. **Identify**: Scope of deletion (table, rows, time)
2. **Point-in-time**: If WAL archiving enabled → PITR
3. **Restore Table**: From latest backup using `pg_restore --table=...`
4. **Verify**: Row counts, relationships intact

**Timeline:** 1-4 hours

### 4.5 Failed Database Migration

**Detection:** `prisma migrate deploy` fails, health check shows pending migrations

**Procedure:**
1. **Assess**: Migration error, partial apply?
2. **Rollback**: If forward-fix possible → create corrective migration
3. **Full Restore**: If destructive → restore from pre-migration backup
4. **Validate**: Run all migrations from clean state

**Timeline:** 2 hours

### 4.6 Credential Compromise

**Detection:** Unusual access patterns, external notification, audit alerts

**Procedure:**
1. **Immediate**: Rotate all secrets (JWT, DB, backup, admin)
2. **Revoke**: All active sessions, refresh tokens
3. **Audit**: Review audit logs for unauthorized access
4. **Notify**: Affected parties per compliance requirements
5. **Monitor**: Enhanced logging for 30 days

**Timeline:** 1 hour

### 4.7 Network Outage

**Detection:** Health checks fail externally, internal OK

**Procedure:**
1. **Diagnose**: DNS, firewall, load balancer, CDN
2. **Mitigate**: Failover to backup region (if configured)
3. **Communicate**: Status page update
4. **Restore**: When network recovered, verify all services

**Timeline:** 1 hour

### 4.8 Storage Failure

**Detection:** Disk full errors, I/O errors, volume unmounted

**Procedure:**
1. **Isolate**: Stop writes to affected volume
2. **Replace**: Provision new volume from snapshot/backup
3. **Restore**: Database from backup, uploads from volume backup
4. **Verify**: Full health check

**Timeline:** 2-4 hours

### 4.9 Ransomware/Malware

**Detection:** Encrypted files, ransom notes, unusual process activity

**Procedure:**
1. **Isolate**: Network disconnect affected systems
2. **Identify**: Scope of encryption, patient zero
3. **Eradicate**: Rebuild from clean images
4. **Restore**: From clean backups (verify backup integrity first!)
4. **Forensics**: Preserve evidence, notify authorities
5. **Harden**: Apply lessons learned

**Timeline:** 8+ hours

### 4.10 Complete Site Loss

**Detection:** All services down, hosting provider outage

**Procedure:**
1. **Activate**: DR site / cloud failover
2. **Provision**: New infrastructure (IaC)
3. **Restore**: Database from offsite backup
4. **Deploy**: Application from container registry
5. **DNS**: Update records to DR site
6. **Verify**: Full acceptance test suite

**Timeline:** 24 hours

---

## 5. Recovery Validation Checklist

### 5.1 Post-Recovery Verification

| Check | Method | Pass Criteria |
|-------|--------|---------------|
| Database Connectivity | `pg_isready` | Accepts connections |
| Migration Status | `health/ready` | All migrations applied |
| API Health | `health/check` | All checks "up" |
| Frontend Access | HTTP 200 on `/` | Loads without errors |
| Authentication | Login flow | Valid token returned |
| RBAC/ABAC | Test matrix | All permissions enforced |
| File Uploads | Upload/download | Files accessible |
| Audit Logging | Query audit log | Recent entries present |
| Backup System | Create test backup | Success + download works |
| Email/SMS | Test notification | Delivered |

### 5.2 Business Function Validation

| Function | Test | Owner |
|----------|------|-------|
| Employee CRUD | Create, read, update, delete | HR |
| Attendance | Check-in, reports | Manager |
| Leave Request | Submit, approve | Employee/Mgr |
| Payroll Run | Calculate, export | Finance |
| Reports | Generate, download | Management |
| Documents | Upload, view, download | All |

---

## 6. Infrastructure Requirements

### 6.1 Minimum Recovery Environment

| Component | Specification |
|-----------|---------------|
| **Compute** | 4 vCPU, 8GB RAM (backend), 2 vCPU, 4GB RAM (DB) |
| **Storage** | 100GB SSD (DB), 50GB SSD (uploads), 200GB backup |
| **Network** | Private VPC, 1Gbps internal, TLS termination |
| **Database** | PostgreSQL 16, same major version |
| **Secrets** | Access to Vault/Secret Manager |

### 6.2 DR Site Options

| Option | RTO | Cost | Complexity |
|--------|-----|------|------------|
| **Warm Standby (Same Region)** | 30 min | Medium | Low |
| **Cold Standby (Different AZ)** | 2 hours | Low | Medium |
| **Cloud Failover (Different Region)** | 4 hours | High | High |
| **Manual Rebuild** | 24 hours | Very Low | Very High |

---

## 7. Backup & Restore Integration

### 7.1 Backup Dependencies

- Daily automated backup (02:00)
- Offsite replication to S3/GCS (post-backup)
- Backup encryption key in secret manager
- Backup verification in CI/CD pipeline

### 7.2 Restore Dependencies

- Empty staging database (`sana_restore_*`)
- `BACKUP_RESTORE_DATABASE_URL` configured
- Superadmin credentials available
- Network path to backup storage

---

## 8. Testing & Maintenance

### 8.1 DR Testing Schedule

| Test | Frequency | Scope | Owner |
|------|-----------|-------|-------|
| **Automated Backup/Restore** | Every PR | Full cycle in isolated DB | CI/CD |
| **Staging Rehearsal** | Weekly | Restore to staging + smoke test | DevOps |
| **Tabletop Exercise** | Monthly | Scenario walkthrough | All Leads |
| **Full DR Drill** | Quarterly | Complete site loss simulation | All Teams |
| **Backup Integrity** | Daily | Checksum verification | Automated |

### 8.2 Test Documentation

Each test must produce:
- Test plan and scenarios
- Execution log with timestamps
- Pass/fail results per validation checklist
- Issues found and remediation actions
- RTO/RPO measurements

---

## 9. Post-Incident Activities

### 9.1 Incident Review (Within 48 hours)

1. **Timeline Reconstruction**: Events, actions, decisions
2. **Root Cause Analysis**: 5 Whys / Fishbone diagram
3. **Impact Assessment**: Data loss, downtime, user impact
4. **Gap Analysis**: Plan vs. actual, missing procedures
5. **Action Items**: Prioritized improvements with owners

### 9.2 Plan Updates

- Update DRP within 1 week of incident
- Incorporate lessons learned
- Update contact lists, procedures, runbooks
- Communicate changes to all responders

---

## 10. Compliance & Legal

### 10.1 Regulatory Requirements

| Regulation | Requirement | DRP Alignment |
|------------|-------------|---------------|
| **Iran Labor Law** | Payroll/attendance records 5+ years | 7-year retention |
| **Data Protection** | PII protection, breach notification | Encryption, audit logs |
| **Financial Audit** | Payroll integrity, traceability | Immutable audit logs |

### 10.2 Insurance

- Cyber insurance policy: Review annually
- Coverage: Data restoration, business interruption, liability
- Notification requirements: 24-72 hours per policy

---

## 11. Contact Information

### 11.1 Internal Contacts

| Role | Name | Phone | Email | Slack |
|------|------|-------|-------|-------|
| Incident Commander | | | | |
| DevOps Lead | | | | |
| Senior DBA | | | | |
| Backend Lead | | | | |
| Security Engineer | | | | |

### 11.2 External Contacts

| Vendor | Service | Contact | SLA |
|--------|---------|---------|-----|
| Cloud Provider | Infrastructure | | |
| PostgreSQL Support | Database | | |
| Certificate Authority | TLS Certs | | |
| Cyber Insurance | Incident Response | | |

---

## 12. Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-18 | DevOps Lead | Initial version |

**Review Cycle:** Quarterly  
**Next Review:** 2027-02-18  
**Approved By:** CTO / CISO  

---

**End of Document**