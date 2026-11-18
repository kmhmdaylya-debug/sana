# Sana HRMS - Operations Runbook

**Version:** 1.0  
**Date:** 2026-11-18  
**Audience:** System Administrators, DevOps Engineers, On-Call Engineers  
**Classification:** INTERNAL - Operational Procedures  

---

## 1. Quick Reference

### 1.1 Service Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Sana HRMS Production                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Internet                                                    │
│     │                                                        │
│     ▼                                                        │
│  ┌─────────────────┐                                        │
│  │  Nginx Proxy    │  :80/:443 (TLS termination)            │
│  │  (sana-proxy)   │                                        │
│  └────────┬────────┘                                        │
│           │                                                 │
│     ┌─────┴─────┐                                           │
│     ▼           ▼                                           │
│  ┌─────────┐ ┌─────────┐                                    │
│  │ Frontend │ │ Backend  │                                    │
│  │ (nginx)  │ │ (NestJS) │                                    │
│  │ :8080    │ │ :4114    │                                    │
│  └─────────┘ └────┬────┘                                    │
│                   │                                         │
│                   ▼                                         │
│            ┌─────────────┐                                  │
│            │ PostgreSQL  │                                  │
│            │ (sana-db)   │                                  │
│            │ :5432       │                                  │
│            └─────────────┘                                  │
│                                                              │
│  Volumes: sana-pgdata, sana-backups, sana-uploads           │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Key Ports & Endpoints

| Service | Internal Port | External Port | Health Check |
|---------|---------------|---------------|--------------|
| Frontend (nginx) | 8080 | 80/443 (via proxy) | `GET /health` |
| Backend API | 4114 | Internal only | `GET /api/v1/health/ready` |
| PostgreSQL | 5432 | Internal only | `pg_isready` |
| Reverse Proxy | 80/443 | 80/443 | `GET /health` |

---

## 2. Daily Operations

### 2.1 Morning Checks (08:00-09:00)

```bash
#!/bin/bash
# scripts/morning-checks.sh

echo "=== Sana HRMS Morning Health Check ==="
echo "Date: $(date)"
echo ""

# 1. Service Status
echo "1. Container Status:"
docker compose ps

echo ""
echo "2. Health Checks:"
curl -s http://localhost:8080/health | jq .
curl -s http://localhost:8080/api/v1/health/ready | jq .

echo ""
echo "3. Backup Status (last 24h):"
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:8080/api/v1/backup/history?limit=5" | jq '.data[] | {fileName, result, startedAt, size}'

echo ""
echo "4. Disk Space:"
df -h /data/sana/

echo ""
echo "5. Pending Migrations:"
docker exec sana-backend npx prisma migrate status

echo ""
echo "6. Error Rate (last hour):"
# Query Prometheus or check logs
docker logs sana-backend --since 1h 2>&1 | grep -c "ERROR" || echo "0"

echo ""
echo "=== Check Complete ==="
```

### 2.2 Automated Monitoring

Key metrics to monitor continuously:

| Metric | Warning | Critical | Source |
|--------|---------|----------|--------|
| API Error Rate | > 1% | > 5% | Prometheus |
| API Latency (p95) | > 500ms | > 2s | Prometheus |
| DB Connections | > 80% | > 95% | Prometheus |
| Disk Usage | > 80% | > 90% | Node Exporter |
| Memory Usage | > 85% | > 95% | cAdvisor |
| Backup Age | > 24h | > 36h | Custom |
| Pending Migrations | > 0 | > 0 | Health Check |

---

## 3. Service Management

### 3.1 Starting Services

```bash
# Full stack startup
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Individual services
docker compose up -d db
docker compose up -d backend
docker compose up -d frontend
docker compose up -d proxy
```

### 3.2 Stopping Services

```bash
# Graceful shutdown (30s timeout)
docker compose stop

# Force stop (immediate)
docker compose kill

# Stop specific service
docker compose stop backend
```

### 3.3 Restarting Services

```bash
# Graceful restart
docker compose restart backend

# Force recreate (new image/config)
docker compose up -d --force-recreate backend

# Rolling restart (zero-downtime for stateless)
docker compose up -d --no-deps --force-recreate backend
```

### 3.4 Viewing Logs

```bash
# All services
docker compose logs -f --tail 100

# Specific service
docker compose logs -f backend --tail 200
docker compose logs -f frontend --tail 50
docker compose logs -f db --tail 50

# Last hour only
docker compose logs --since 1h backend

# Search for errors
docker compose logs backend | grep -i error
docker compose logs backend | grep -i "exception\|fatal\|panic"
```

---

## 4. Database Operations

### 4.1 Health Checks

```bash
# Quick health
docker exec sana-db pg_isready -U sana -d sana_hrms

# Detailed status
docker exec sana-db psql -U sana -d sana_hrms -c "
SELECT 
  now() as current_time,
  pg_database_size('sana_hrms') as db_size,
  (SELECT count(*) FROM pg_stat_activity WHERE datname='sana_hrms') as active_connections,
  (SELECT setting FROM pg_settings WHERE name='max_connections') as max_connections;
"

# Long-running queries
docker exec sana-db psql -U sana -d sana_hrms -c "
SELECT pid, now() - pg_stat_activity.query_start AS duration, query 
FROM pg_stat_activity 
WHERE state = 'active' AND now() - pg_stat_activity.query_start > interval '30 seconds'
ORDER BY duration DESC;
"
```

### 4.2 Backup Operations

```bash
# Create backup (via API)
curl -X POST http://localhost:8080/api/v1/backup/run \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# List backups
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:8080/api/v1/backup/history?limit=10" | jq .

# Download backup
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:8080/api/v1/backup/<backup-id>/download" \
  -o backup-$(date +%Y%m%d).pgdump.enc

# Manual backup (if API unavailable)
docker exec sana-db pg_dump -U sana -Fc --no-owner --no-privileges sana_hrms > manual-backup.pgdump
# Encrypt manually if needed
```

### 4.3 Restore Operations

```bash
# Only on staging! See DATABASE_RESTORE_GUIDE.md

# 1. Create staging DB
docker exec sana-db createdb -U sana sana_restore_test

# 2. Restore via API
curl -X POST http://localhost:8080/api/v1/backup/restore \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"backupId":"<id>","currentPassword":"<pwd>","confirmationDatabase":"sana_restore_test"}'

# 3. Manual restore (emergency only)
docker exec sana-db pg_restore --exit-on-error --single-transaction \
  --no-owner --no-privileges -d sana_restore_test < backup.pgdump
```

### 4.4 Migration Operations

```bash
# Check status
docker exec sana-backend npx prisma migrate status

# Apply pending migrations
docker exec sana-backend npx prisma migrate deploy

# Create new migration (dev only)
docker exec -it sana-backend npx prisma migrate dev --name migration_name

# Reset database (DANGER - dev only!)
docker exec sana-backend npx prisma migrate reset --force
```

---

## 5. Frontend Operations

### 5.1 Build & Deploy

```bash
# Build production image
docker build -t sana-frontend:latest ./frontend

# Deploy new version
docker compose pull frontend
docker compose up -d --force-recreate frontend

# Verify
curl -f http://localhost:8080/health
```

### 5.2 Cache Management

```bash
# Clear nginx cache (if configured)
docker exec sana-frontend nginx -s reload

# Clear browser cache headers (verify)
curl -I http://localhost:8080/assets/ | grep -i cache-control
```

### 5.3 Static Asset Verification

```bash
# Check asset sizes
docker exec sana-frontend du -sh /usr/share/nginx/html/assets/

# Verify CSP headers
curl -I http://localhost:8080/ | grep -i content-security-policy
```

---

## 6. Configuration Management

### 6.1 Environment Variables

```bash
# View current config (sanitized)
docker exec sana-backend env | grep -v PASSWORD | grep -v SECRET | grep -v KEY | sort

# Update config
# 1. Edit .env file
# 2. Restart affected service
docker compose restart backend
```

### 6.2 Secrets Rotation

```bash
# JWT Secrets (requires full logout)
# 1. Generate new secrets
openssl rand -base64 48

# 2. Update .env
# 3. Restart backend (invalidates all sessions)
docker compose restart backend

# Database password
# 1. Update in PostgreSQL
docker exec sana-db psql -U postgres -c "ALTER USER sana PASSWORD 'new_password';"

# 2. Update .env
# 3. Restart all services
docker compose restart

# Backup encryption key (requires re-encrypting all backups!)
# 1. Generate new key
# 2. Update .env
# 3. Re-encrypt existing backups (manual process)
```

---

## 6. Security Operations

### 6.1 Certificate Management

```bash
# Check certificate expiry
openssl x509 -in /data/sana/proxy/certs/fullchain.pem -text -noout | grep "Not After"

# Renew Let's Encrypt (if using certbot)
certbot renew --nginx

# Reload nginx after renewal
docker exec sana-proxy nginx -s reload
```

### 6.2 Audit Log Review

```bash
# Recent security events
docker exec sana-backend psql -U sana -d sana_hrms -c "
SELECT \"timestamp\", \"action\", \"entity\", \"entityId\", \"userId\", \"ip\"
FROM \"AuditLog\"
WHERE \"action\" IN ('LOGIN', 'LOGOUT', 'PASSWORD_CHANGE', 'VIEW_SENSITIVE', 'EXPORT', 'BACKUP', 'RESTORE')
ORDER BY \"timestamp\" DESC
LIMIT 50;
"

# Failed login attempts
docker exec sana-backend psql -U sana -d sana_hrms -c "
SELECT \"timestamp\", \"ip\", \"userAgent\"
FROM \"AuditLog\"
WHERE \"action\" = 'LOGIN_FAILED'
ORDER BY \"timestamp\" DESC
LIMIT 20;
"
```

### 6.3 Access Review

```bash
# Active admin users
docker exec sana-backend psql -U sana -d sana_hrms -c "
SELECT u.\"username\", u.\"fullName\", u.\"status\", u.\"lastLoginAt\", r.\"name\" as role
FROM \"User\" u
LEFT JOIN \"UserRole\" ur ON u.id = ur.\"userId\"
LEFT JOIN \"Role\" r ON ur.\"roleId\" = r.id
WHERE u.\"isSuperAdmin\" = true OR r.\"name\" = 'SUPER_ADMIN'
ORDER BY u.\"lastLoginAt\" DESC;
"

# Users with sensitive permissions
docker exec sana-backend psql -U sana -d sana_hrms -c "
SELECT DISTINCT u.\"username\", p.\"code\" as permission
FROM \"User\" u
JOIN \"UserRole\" ur ON u.id = ur.\"userId\"
JOIN \"Role\" r ON ur.\"roleId\" = r.id
JOIN \"RolePermission\" rp ON r.id = rp.\"roleId\"
JOIN \"Permission\" p ON rp.\"permissionId\" = p.id
WHERE p.\"code\" IN ('EMPLOYEES_VIEW_SENSITIVE', 'PAYROLL_VIEW', 'BACKUP_MANAGE', 'USERS_MANAGE')
ORDER BY u.\"username\";
"
```

---

## 7. Performance Tuning

### 7.1 Database Optimization

```bash
# Analyze table statistics
docker exec sana-db psql -U sana -d sana_hrms -c "ANALYZE;"

# Check index usage
docker exec sana-db psql -U sana -d sana_hrms -c "
SELECT schemaname, tablename, indexname, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_tup_read DESC
LIMIT 20;
"

# Find missing indexes
docker exec sana-db psql -U sana -d sana_hrms -c "
SELECT * FROM pg_stat_user_tables
WHERE seq_scan > 1000 AND idx_scan < seq_scan / 10
ORDER BY seq_scan DESC;
"
```

### 7.2 Container Resource Tuning

```bash
# Check current usage
docker stats --no-stream

# Adjust limits in docker-compose.prod.yml
# deploy:
#   resources:
#     limits:
#       cpus: '4'
#       memory: 4G
#     reservations:
#       cpus: '1'
#       memory: 1G
```

---

## 8. Disaster Recovery Operations

### 8.1 DR Site Activation

```bash
# See DISASTER_RECOVERY_PLAN.md for full procedure

# 1. Provision infrastructure (Terraform/CloudFormation)
# 2. Deploy application
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# 3. Restore database from offsite backup
# 4. Update DNS
# 5. Verify all services
```

### 8.2 Data Corruption Recovery

```bash
# See DATABASE_RESTORE_GUIDE.md Section 6.1

# 1. Stop application
docker compose stop backend

# 2. Assess corruption scope
docker exec sana-db pg_dump --schema-only sana_hrms > schema.sql

# 3. Restore from latest clean backup
# 6. Verify and restart
```

---

## 9. Maintenance Windows

### 9.1 Scheduled Maintenance

| Activity | Frequency | Window | Duration |
|----------|-----------|--------|----------|
| **OS Updates** | Monthly | Sunday 02:00-04:00 | 30 min |
| **PostgreSQL Minor** | Quarterly | Sunday 01:00-03:00 | 1 hour |
| **Certificate Renewal** | 60 days | Automated | 5 min |
| **Backup Cleanup** | Daily | 03:00 | 10 min |
| **Log Rotation** | Daily | Continuous | N/A |
| **Index Rebuild** | Monthly | Sunday 03:00-04:00 | 30 min |

### 9.2 Maintenance Checklist

```markdown
## Pre-Maintenance
- [ ] Stakeholders notified (48h advance)
- [ ] Maintenance window in calendar
- [ ] Backup completed (< 1h ago)
- [ ] Rollback plan ready
- [ ] Monitoring alerts silenced (if needed)

## During Maintenance
- [ ] Enable maintenance mode (if applicable)
- [ ] Execute maintenance tasks
- [ ] Verify each step
- [ ] Document any issues

## Post-Maintenance
- [ ] Full health check
- [ ] Smoke test critical paths
- [ ] Re-enable alerts
- [ ] Update maintenance log
- [ ] Notify stakeholders
```

---

## 10. Troubleshooting Quick Reference

| Symptom | Likely Cause | Quick Fix |
|---------|--------------|-----------|
| 502 Bad Gateway | Backend down | `docker compose restart backend` |
| 504 Gateway Timeout | Slow query/DB | Check DB, kill long queries |
| High CPU | Infinite loop/bad query | Restart backend, check logs |
| High Memory | Memory leak | Restart backend, analyze heap |
| DB Connections Exhausted | Pool leak | Restart backend, check pool config |
| Disk Full | Logs/backups | Cleanup old files, expand volume |
| Certificate Expired | Cert not renewed | `certbot renew`, reload nginx |
| Migration Stuck | Lock/long operation | Check `pg_locks`, wait or cancel |
| Backup Failed | Disk space/perms | Check volume, fix permissions |

---

## 11. Useful Scripts Collection

### 11.1 Health Check Script

```bash
#!/bin/bash
# scripts/health-check.sh

SERVICES=("db" "backend" "frontend" "proxy")
FAILED=0

for svc in "${SERVICES[@]}"; do
  if docker compose ps $svc | grep -q "Up"; then
    echo "✅ $svc: Running"
  else
    echo "❌ $svc: DOWN"
    FAILED=1
  fi
done

# Health endpoints
curl -sf http://localhost:8080/health > /dev/null && echo "✅ Frontend health" || { echo "❌ Frontend health"; FAILED=1; }
curl -sf http://localhost:8080/api/v1/health/ready > /dev/null && echo "✅ Backend health" || { echo "❌ Backend health"; FAILED=1; }

exit $FAILED
```

### 11.2 Backup Verification Script

```bash
#!/bin/bash
# scripts/verify-backup.sh

BACKUP_ID=$1
if [ -z "$BACKUP_ID" ]; then
  echo "Usage: $0 <backup-id>"
  exit 1
fi

# Download and verify
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:8080/api/v1/backup/$BACKUP_ID/download" \
  -o /tmp/verify-backup.pgdump.enc

# Decrypt and test
node -e "
const crypto = require('crypto');
const fs = require('fs');
const key = crypto.createHash('sha256').update('$BACKUP_ENCRYPTION_KEY').digest();
const data = fs.readFileSync('/tmp/verify-backup.pgdump.enc');
const iv = data.subarray(0, 12);
const tag = data.subarray(12, 28);
const ct = data.subarray(28);
const dec = crypto.createDecipheriv('aes-256-gcm', key, iv);
dec.setAuthTag(tag);
const decrypted = Buffer.concat([dec.update(ct), dec.final()]);
console.log('Decryption: OK, size:', decrypted.length);
" && echo "✅ Backup verification passed" || echo "❌ Backup verification failed"
```

---

**Document Version:** 1.0  
**Last Updated:** 2026-11-18  
**Next Review:** Monthly  
**Owner:** DevOps Team