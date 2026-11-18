# Sana HRMS - Docker Production Deployment Guide

**Version:** 1.0  
**Date:** 2026-11-18  
**Audience:** DevOps Engineers, System Administrators  
**Classification:** INTERNAL - Deployment Reference  

---

## 1. Architecture Overview

### 1.1 Production Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                    Sana HRMS Production Stack                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐                                               │
│  │   Clients    │                                               │
│  └──────┬───────┘                                               │
│         │ HTTPS (443)                                           │
│         ▼                                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Reverse Proxy (Nginx/Traefik)                │  │
│  │  • TLS Termination    • Rate Limiting    • WAF Rules      │  │
│  └──────────────────────────┬────────────────────────────────┘  │
│                             │                                    │
│              ┌──────────────┼──────────────┐                    │
│              ▼              ▼              ▼                    │
│        ┌────────────┐ ┌───────────┐ ┌──────────┐               │
│        │  Frontend  │ │  Backend  │ │ Database │               │
│        │  (Nginx)   │ │  (NestJS) │ │PostgreSQL│               │
│        │  Port 8080 │ │  Port 4114│ │ Port 5432│               │
│        └────────────┘ └───────────┘ └──────────┘               │
│              │              │              │                    │
│              └──────────────┼──────────────┘                    │
│                             ▼                                    │
│                    ┌─────────────────┐                          │
│                    │  Shared Volumes │                          │
│                    │ • sana-pgdata   │                          │
│                    │ • sana-backups  │                          │
│                    │ • sana-uploads  │                          │
│                    └─────────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Prerequisites

### 2.1 System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **CPU** | 4 vCPU | 8 vCPU |
| **RAM** | 8 GB | 16 GB |
| **Storage** | 100 GB SSD | 500 GB NVMe |
| **OS** | Ubuntu 22.04+ / RHEL 9+ | Ubuntu 24.04 LTS |
| **Docker** | 24.0+ | 26.0+ |
| **Docker Compose** | 2.20+ | 2.25+ |

### 2.2 Network Requirements

| Port | Protocol | Purpose |
|------|----------|---------|
| 80 | TCP | HTTP → HTTPS redirect |
| 443 | TCP | HTTPS (TLS termination) |
| 5432 | TCP | PostgreSQL (internal only) |

### 2.3 DNS & Certificates

```bash
# Required DNS records
hr.company.com        A    <server-ip>
hr-staging.company.com A   <staging-ip>

# TLS Certificates (Let's Encrypt or CA)
/data/sana/proxy/certs/
├── fullchain.pem     # Certificate chain
├── privkey.pem       # Private key
└── chain.pem         # CA chain
```

---

## 3. Directory Structure

```
/data/sana/
├── proxy/
│   ├── nginx.conf          # Main nginx config
│   ├── conf.d/             # Additional site configs
│   └── certs/              # TLS certificates
│       ├── fullchain.pem
│       ├── privkey.pem
│       └── chain.pem
├── pgdata/                 # PostgreSQL data (bind mount)
├── backups/                # Encrypted backups (bind mount)
└── uploads/                # User uploads (bind mount)
    └── documents/
```

### 3.1 Permissions Setup

```bash
# Create directory structure
sudo mkdir -p /data/sana/{proxy/{conf.d,certs},pgdata,backups,uploads/documents}

# Set ownership for Docker containers (UID 1000 = sana user)
sudo chown -R 1000:1000 /data/sana/pgdata /data/sana/backups /data/sana/uploads
sudo chmod 700 /data/sana/backups /data/sana/pgdata
sudo chmod 755 /data/sana/uploads

# Certificates (root readable for nginx)
sudo chown -R root:root /data/sana/proxy/certs
sudo chmod 600 /data/sana/proxy/certs/privkey.pem
sudo chmod 644 /data/sana/proxy/certs/fullchain.pem /data/sana/proxy/certs/chain.pem
```

---

## 4. Docker Images

### 4.1 Image Repository

```bash
# GitHub Container Registry (default)
ghcr.io/your-org/sana-hrms-backend:v1.2.0
ghcr.io/your-org/sana-hrms-frontend:v1.2.0
ghcr.io/your-org/sana-hrms-proxy:v1.2.0

# Or private registry
registry.company.com/sana-hrms/backend:v1.2.0
registry.company.com/sana-hrms/frontend:v1.2.0
```

### 4.2 Image Security

```bash
# Scan images before deployment
trivy image ghcr.io/your-org/sana-hrms-backend:v1.2.0
trivy image ghcr.io/your-org/sana-hrms-frontend:v1.2.0

# Verify image signatures (if signed)
cosign verify ghcr.io/your-org/sana-hrms-backend:v1.2.0
```

---

## 5. Deployment Files

### 5.1 Production Docker Compose

**File:** `docker-compose.prod.yml` (extends `docker-compose.yml`)

```yaml
# See docker-compose.prod.yml in repository root
# Key production overrides:
# - Resource limits
# - Logging configuration
# - Non-root containers
# - Health check tuning
# - Volume bind mounts to /data/sana
# - Reverse proxy service
```

### 5.2 Environment File

```bash
# /data/sana/.env (or /opt/sana/.env)
# See ENVIRONMENT_CONFIGURATION.md for all variables
POSTGRES_PASSWORD=...
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
BACKUP_ENCRYPTION_KEY=...
ADMIN_PASSWORD=...
CORS_ORIGINS=https://hr.company.com
TRUSTED_PROXIES=10.0.1.10,10.0.1.11
```

---

## 6. Deployment Procedures

### 6.1 Initial Deployment

```bash
#!/bin/bash
# scripts/deploy-initial.sh

set -e

echo "=== Sana HRMS Initial Deployment ==="

# 1. Verify prerequisites
docker --version
docker compose version

# 2. Create directories
sudo mkdir -p /data/sana/{proxy/{conf.d,certs},pgdata,backups,uploads/documents}
sudo chown -R 1000:1000 /data/sana/pgdata /data/sana/backups /data/sana/uploads

# 3. Place certificates
# sudo cp certs/* /data/sana/proxy/certs/

# 4. Create environment file
# cp .env.example /data/sana/.env
# Edit /data/sana/.env with production values

# 5. Pull images
docker compose -f docker-compose.yml -f docker-compose.prod.yml pull

# 6. Deploy
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# 6. Wait for health checks
echo "Waiting for services to be healthy..."
sleep 30

# 7. Verify
curl -f http://localhost/health
curl -f https://hr.company.com/health
curl -f https://hr.company.com/api/v1/health/ready

echo "=== Deployment Complete ==="
```

### 6.2 Rolling Update

```bash
#!/bin/bash
# scripts/deploy-update.sh

set -e

VERSION=${1:-latest}

echo "=== Deploying version $VERSION ==="

# 1. Pull new images
docker compose -f docker-compose.yml -f docker-compose.prod.yml pull

# 2. Backup database before update
curl -X POST https://hr.company.com/api/v1/backup/run \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 3. Deploy with rolling restart
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d \
  --force-recreate --no-deps backend frontend

# 4. Wait and verify
sleep 30
curl -f https://hr.company.com/api/v1/health/ready

# 5. Verify frontend
curl -f https://hr.company.com/health

echo "=== Update Complete ==="
```

### 6.3 Rollback

```bash
#!/bin/bash
# scripts/rollback.sh

set -e

PREVIOUS_VERSION=${1:-previous}

echo "=== Rolling back to $PREVIOUS_VERSION ==="

# 1. Stop current services
docker compose -f docker-compose.yml -f docker-compose.prod.yml stop backend frontend

# 2. Restore database if migration was applied
# ./scripts/restore-backup.sh <backup-id>

# 3. Update image tags in docker-compose.prod.yml to previous version
# sed -i "s/image:.*:latest/image: ghcr.io\/org\/sana-hrms-backend:$PREVIOUS_VERSION/" docker-compose.prod.yml

# 4. Start previous version
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d backend frontend

# 5. Verify
curl -f https://hr.company.com/api/v1/health/ready

echo "=== Rollback Complete ==="
```

---

## 7. Health Checks & Monitoring

### 7.1 Built-in Health Endpoints

| Service | Endpoint | Checks |
|---------|----------|--------|
| Frontend | `GET /health` | Static file serving |
| Backend | `GET /api/v1/health/live` | DB connectivity |
| Backend | `GET /api/v1/health/ready` | DB + Migrations + Disk |
| Backend | `GET /api/v1/health` | Full + Frontend |
| Proxy | `GET /health` | Proxy status |

### 7.2 Docker Health Checks

```yaml
# Backend (in docker-compose.yml)
healthcheck:
  test: ["CMD", "node", "/app/docker-healthcheck.js"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 60s

# Frontend
healthcheck:
  test: ["CMD", "wget", "-q", "--spider", "http://127.0.0.1:8080/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 10s

# Database
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U sana -d sana_hrms"]
  interval: 5s
  timeout: 5s
  retries: 10
```

### 7.3 Monitoring Integration

```bash
# Prometheus metrics endpoint (if enabled)
curl http://localhost:4114/metrics

# Key metrics to alert on:
# - sana_http_requests_total (error rate)
# - sana_http_request_duration_seconds (latency)
# - sana_db_connections_active (connection pool)
# - sana_backup_age_hours (backup freshness)
```

---

## 8. Logging

### 8.1 Log Configuration

```yaml
# In docker-compose.prod.yml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "5"
    labels: "service,container"
```

### 8.2 Log Access

```bash
# View logs
docker compose logs -f backend --tail 200
docker compose logs -f frontend --tail 100
docker compose logs -f db --tail 50

# Search for errors
docker compose logs backend | grep -i error
docker compose logs backend | grep -i "exception\|fatal\|panic"

# Export logs for analysis
docker compose logs --since 24h backend > backend-24h.log
```

### 8.3 Log Rotation

```bash
# Automatic via Docker json-file driver (10MB x 5 files)
# For production, forward to Loki/ELK:
# logging:
#   driver: "fluentd"
#   options:
#     fluentd-address: "fluentd:24224"
#     tag: "sana.{{.Name}}"
```

---

## 9. Backup & Restore Operations

### 9.1 Automated Backup (Cron)

```bash
# /etc/cron.d/sana-backup
# Daily at 02:00
0 2 * * * root /usr/local/bin/sana-backup.sh >> /var/log/sana-backup.log 2>&1
```

```bash
#!/bin/bash
# /usr/local/bin/sana-backup.sh

ADMIN_TOKEN=$(cat /run/secrets/admin_token)
curl -X POST https://hr.company.com/api/v1/backup/run \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -f -s -o /dev/null

if [ $? -eq 0 ]; then
  echo "$(date): Backup successful"
else
  echo "$(date): Backup FAILED"
  # Alert via monitoring
fi
```

### 9.2 Offsite Backup Replication

```bash
# Sync to S3/GCS after backup
aws s3 sync /data/sana/backups s3://sana-hrms-backups/prod/ \
  --storage-class GLACIER_IR --sse AES256

# Or GCS
gsutil -m rsync -r /data/sana/backups gs://sana-hrms-backups/prod/
```

### 9.3 Restore Testing

```bash
# Monthly restore test (automated in CI)
# See DATABASE_RESTORE_GUIDE.md for full procedure
```

---

## 10. Security Hardening

### 10.1 Container Security

```yaml
# Already implemented in Dockerfiles:
# - Non-root user (UID 1000)
# - Read-only root filesystem (where possible)
# - Dropped capabilities
# - No privileged mode
# - Minimal base images (Alpine)
```

### 10.2 Network Security

```yaml
# In docker-compose.prod.yml:
# - No exposed database port (internal only)
# - Backend only exposed to proxy
# - Proxy handles TLS termination
# - Rate limiting at proxy level
```

### 10.3 Secrets Management

```bash
# Use Docker secrets for production
# /run/secrets/
# ├── postgres_password
# ├── jwt_access_secret
# ├── jwt_refresh_secret
# ├── backup_encryption_key
# └── admin_token

# In docker-compose.prod.yml:
secrets:
  postgres_password:
    file: /run/secrets/postgres_password
  jwt_access_secret:
    file: /run/secrets/jwt_access_secret
```

---

## 11. Performance Tuning

### 11.1 Database Tuning

```bash
# postgresql.conf optimizations (in custom config)
# mount as /etc/postgresql/postgresql.conf

# Key settings:
max_connections = 200
shared_buffers = 2GB
effective_cache_size = 6GB
work_mem = 64MB
maintenance_work_mem = 512MB
wal_buffers = 16MB
checkpoint_completion_target = 0.9
random_page_cost = 1.1
```

### 11.2 Container Resources

```yaml
# docker-compose.prod.yml
deploy:
  resources:
    limits:
      cpus: '4'
      memory: 4G
    reservations:
      cpus: '1'
      memory: 1G
```

### 11.3 Nginx Tuning

```nginx
# In proxy/nginx.conf
worker_processes auto;
worker_connections 2048;

# Buffer sizes
client_body_buffer_size 16k;
client_header_buffer_size 1k;
large_client_header_buffers 4 8k;

# Timeouts
client_body_timeout 60s;
client_header_timeout 60s;
send_timeout 60s;

# Keepalive
keepalive_timeout 65;
keepalive_requests 1000;
```

---

## 12. Disaster Recovery

### 12.1 Recovery Procedures

```bash
# 1. Database corruption
# See DATABASE_RESTORE_GUIDE.md

# 2. Server failure
# - Provision new server
# - Deploy from docker-compose
# - Restore from offsite backup

# 3. Complete site loss
# - Provision DR infrastructure
# - Deploy application
# - Restore database
# - Update DNS
```

### 12.2 Backup Verification

```bash
# Daily automated verification in CI
# Monthly manual restore test
```

---

## 13. Maintenance

### 13.1 Routine Maintenance

| Task | Frequency | Command |
|------|-----------|---------|
| OS Updates | Monthly | `apt update && apt upgrade -y` |
| Docker Images | Weekly | `docker compose pull && docker compose up -d` |
| Certificate Renewal | 60 days | `certbot renew --nginx` |
| Backup Cleanup | Daily | `find /data/sana/backups -mtime +30 -delete` |
| Log Rotation | Continuous | Docker json-file driver |
| Index Maintenance | Monthly | `REINDEX DATABASE sana_hrms` |

### 13.2 Database Maintenance

```bash
# Vacuum & Analyze (monthly)
docker exec sana-db psql -U sana -d sana_hrms -c "VACUUM ANALYZE;"

# Reindex (quarterly)
docker exec sana-db psql -U sana -d sana_hrms -c "REINDEX DATABASE sana_hrms;"

# Check bloat
docker exec sana-db psql -U sana -d sana_hrms -c "
SELECT schemaname, tablename, 
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as bloat
FROM pg_stat_user_tables
WHERE n_dead_tup > 1000
ORDER BY bloat DESC;
"
```

---

## 14. Troubleshooting

### 14.1 Common Issues

| Issue | Diagnosis | Resolution |
|-------|-----------|------------|
| 502 Bad Gateway | Backend container down | `docker compose restart backend` |
| 504 Timeout | Slow query | Check `pg_stat_activity`, kill long queries |
| DB Connection Refused | DB not ready | Check `docker compose logs db` |
| Certificate Error | Expired cert | `certbot renew --nginx` |
| High Memory | Memory leak | Restart backend, check heap |
| Disk Full | Logs/backups | Cleanup, expand volume |

### 14.2 Debug Commands

```bash
# Container inspection
docker inspect sana-backend
docker exec sana-backend ps aux
docker exec sana-backend netstat -tlnp

# Database debug
docker exec sana-db psql -U sana -c "SELECT * FROM pg_stat_activity;"
docker exec sana-db psql -U sana -c "SELECT * FROM pg_locks;"

# Network debug
docker exec sana-backend curl -v http://db:5432
docker exec sana-frontend curl -v http://backend:4114/api/v1/health/live
```

---

## 15. Upgrade Procedures

### 15.1 Minor Version Upgrade

```bash
# 1. Review changelog
# 2. Test in staging
# 3. Backup production
# 4. Deploy during maintenance window
# 5. Verify health checks
# 6. Monitor 1 hour
```

### 15.2 Major Version Upgrade

```bash
# 1. Review breaking changes
# 2. Test migrations in staging
# 3. Schedule extended maintenance
# 4. Full backup + verify
# 5. Run migrations
# 6. Deploy new version
# 7. Extended verification
```

---

## 16. Quick Reference Card

```bash
# === Sana HRMS Quick Commands ===

# Status
docker compose ps
docker compose ps -a

# Logs
docker compose logs -f backend
docker compose logs -f --tail 100 frontend

# Restart
docker compose restart backend
docker compose restart frontend

# Update
docker compose pull
docker compose up -d --force-recreate

# Backup
curl -X POST https://hr.company.com/api/v1/backup/run -H "Authorization: Bearer $TOKEN"

# Health
curl -f https://hr.company.com/health
curl -f https://hr.company.com/api/v1/health/ready

# Database
docker exec sana-db psql -U sana -d sana_hrms -c "SELECT version();"

# Restart all
docker compose down && docker compose up -d

# Cleanup
docker system prune -f
docker volume prune -f
```

---

**Document Version:** 1.0  
**Last Updated:** 2026-11-18  
**Next Review:** Sprint Planning  
**Owner:** DevOps Team