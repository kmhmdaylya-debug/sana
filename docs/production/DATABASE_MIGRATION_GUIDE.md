# Sana HRMS - Database Migration Guide

**Version:** 1.0  
**Date:** 2026-11-18  
**Audience:** DevOps Engineers, DBAs, Backend Developers  
**Classification:** INTERNAL - Operational Procedures  

---

## 1. Migration Architecture

### 1.1 Prisma Migration System

Sana HRMS uses **Prisma Migrate** for database schema management:

- **Declarative**: Schema defined in `prisma/schema.prisma`
- **Versioned**: Each migration is a numbered SQL file
- **Deterministic**: Same schema always produces same migration
- **Transactional**: Migrations run in transactions (where supported)
- **Tracked**: Applied migrations stored in `_prisma_migrations` table

### 1.2 Migration Files Structure

```
backend/prisma/
├── schema.prisma              # Source of truth
├── migrations/
│   ├── migration_lock.toml    # Provider lock file
│   ├── 20240115000000_init/   # Migration directory
│   │   ├── migration.sql      # Up migration
│   │   └── rollback.sql       # Down migration (manual)
│   ├── 20240120000000_add_employee_table/
│   │   └── migration.sql
│   └── ...
└── seed.ts                    # Seed data (optional)
```

---

## 2. Development Workflow

### 2.1 Creating a Migration

```bash
# 1. Modify schema.prisma
# 2. Generate migration
npx prisma migrate dev --name descriptive_name

# Example:
npx prisma migrate dev --name add_employee_national_id

# This:
# - Creates migration SQL
# - Applies to development database
# - Updates schema.prisma (if needed)
# - Generates Prisma Client
```

### 2.2 Migration Naming Convention

```
YYYYMMDDHHMMSS_description_in_snake_case

Examples:
  20240115143000_add_employee_national_id
  20240116090000_create_payroll_periods
  20240117110000_add_index_on_audit_log
  20240118160000_fix_employee_status_enum
```

### 2.3 Applying Migrations in Development

```bash
# Apply pending migrations
npx prisma migrate deploy

# Reset database (DANGEROUS - destroys data)
npx prisma migrate reset --force

# Check status
npx prisma migrate status
```

---

## 3. Production Deployment

### 3.1 Pre-Deployment Checklist

```markdown
## Migration Pre-Deployment Checklist

### Code Review
- [ ] Migration SQL reviewed by 2+ engineers
- [ ] No destructive operations (DROP TABLE, TRUNCATE, DROP COLUMN)
- [ ] No data loss risk (or explicit data migration included)
- [ ] Indexes created CONCURRENTLY (PostgreSQL)
- [ ] Foreign keys validated
- [ ] Enum changes use safe pattern (add value, deploy, remove old)

### Testing
- [ ] Tested on production-like data volume
- [ ] Verified rollback procedure works
- [ ] Performance impact assessed (EXPLAIN ANALYZE)
- [ ] Lock timeout configured appropriately

### Operations
- [ ] Pre-migration backup completed (< 1 hour ago)
- [ ] Maintenance window scheduled (if breaking)
- [ ] Stakeholders notified
- [ ] Rollback plan documented
- [ ] Monitoring alerts configured
```

### 3.2 Applying Migrations in Production

```bash
# Via Docker Compose (automatic on startup)
# command: sh -c "npx prisma migrate deploy && node dist/main.js"

# Or manually:
docker exec sana-backend npx prisma migrate deploy

# Check status
docker exec sana-backend npx prisma migrate status
```

### 3.3 Migration Deployment Script

```bash
#!/bin/bash
# scripts/deploy-migrations.sh

set -e

echo "=== Sana HRMS Migration Deployment ==="
echo "Timestamp: $(date)"
echo ""

# 1. Verify backup exists
LATEST_BACKUP=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8080/api/v1/backup/history?limit=1 | jq -r '.data[0].id')

if [ -z "$LATEST_BACKUP" ] || [ "$LATEST_BACKUP" = "null" ]; then
  echo "❌ No recent backup found. Aborting."
  exit 1
fi

echo "✅ Latest backup: $LATEST_BACKUP"

# 2. Check pending migrations
PENDING=$(docker exec sana-backend npx prisma migrate status --schema=./prisma/schema.prisma 2>&1 | grep -c "not applied")

if [ "$PENDING" -eq 0 ]; then
  echo "✅ No pending migrations. Exiting."
  exit 0
fi

echo "⚠️  $PENDING pending migration(s) found"

# 3. Confirm deployment
if [ "$FORCE" != "true" ]; then
  read -p "Deploy $PENDING migration(s)? (yes/no): " CONFIRM
  if [ "$CONFIRM" != "yes" ]; then
    echo "Aborted."
    exit 1
  fi
fi

# 4. Deploy migrations
echo "🚀 Deploying migrations..."
docker exec sana-backend npx prisma migrate deploy

if [ $? -eq 0 ]; then
  echo "✅ Migrations deployed successfully"
else
  echo "❌ Migration failed! Check logs."
  exit 1
fi

# 5. Verify
echo "🔍 Verifying..."
docker exec sana-backend npx prisma migrate status

echo "✅ Migration deployment complete"
```

---

## 4. Migration Patterns & Safety

### 4.1 Safe Enum Changes

**❌ Unsafe - Breaking:**
```prisma
// Before
enum UserStatus {
  ACTIVE
  INACTIVE
}

// After - REMOVES value, breaks existing data
enum UserStatus {
  ACTIVE
  SUSPENDED
  TERMINATED
}
```

**✅ Safe - Additive:**
```prisma
// Step 1: Add new values (deploy)
enum UserStatus {
  ACTIVE
  INACTIVE
  SUSPENDED    // NEW
  TERMINATED   // NEW
}

// Step 2: Update application code to use new values (deploy)

// Step 3: Remove old values (deploy later)
enum UserStatus {
  ACTIVE
  SUSPENDED
  TERMINATED
}
```

### 4.2 Safe Column Removal

**❌ Unsafe:**
```sql
ALTER TABLE "Employee" DROP COLUMN "old_field";
```

**✅ Safe (Multi-step):**
```sql
-- Step 1: Make column nullable, stop writing to it (deploy)
ALTER TABLE "Employee" ALTER COLUMN "old_field" DROP NOT NULL;

-- Step 2: Stop reading from column in application (deploy)

-- Step 3: Drop column (deploy later)
ALTER TABLE "Employee" DROP COLUMN "old_field";
```

### 4.3 Adding Indexes Safely

**✅ Always use CONCURRENTLY:**
```sql
-- Good: Non-blocking
CREATE INDEX CONCURRENTLY "idx_employee_company_status" 
ON "Employee" ("companyId", "status");

-- Good: Partial index for common queries
CREATE INDEX CONCURRENTLY "idx_audit_log_user_action" 
ON "AuditLog" ("userId", "action") 
WHERE "action" IN ('VIEW_SENSITIVE', 'EXPORT', 'DOWNLOAD');
```

### 4.4 Adding NOT NULL Columns

**✅ With default:**
```sql
-- Safe: Provide default for existing rows
ALTER TABLE "Employee" 
ADD COLUMN "hireDate" DATE NOT NULL DEFAULT CURRENT_DATE;

-- Then remove default if needed (separate migration)
ALTER TABLE "Employee" ALTER COLUMN "hireDate" DROP DEFAULT;
```

### 4.5 Data Migrations

**✅ Separate schema and data migrations:**
```bash
# 1. Schema migration (add column)
npx prisma migrate dev --name add_employee_department_id

# 2. Data migration (separate file)
# backend/prisma/migrations/20240115150000_backfill_department/migration.sql
UPDATE "Employee" e
SET "departmentId" = d.id
FROM "Department" d
WHERE d."companyId" = e."companyId" 
  AND d."name" = 'General'
  AND e."departmentId" IS NULL;

# 3. Apply data migration
npx prisma migrate dev --name backfill_employee_department
```

---

## 5. Rollback Procedures

### 5.1 Prisma Rollback Limitations

> **Prisma does not support automatic rollback.** Rollback strategies:
> 1. **Forward-fix**: Create new migration fixing the issue (preferred)
> 2. **Backup Restore**: Restore from pre-migration backup
> 3. **Manual SQL**: Write and execute rollback SQL

### 5.2 Forward-Fix (Preferred)

```bash
# 1. Identify issue
# 2. Create fix migration
npx prisma migrate dev --name fix_employee_index_issue

# 2. Deploy fix
npx prisma migrate deploy
```

### 5.3 Backup Restore

```bash
# 1. Stop application
docker compose stop backend

# 2. Restore from pre-migration backup
./scripts/restore-backup.sh <pre-migration-backup-id>

# 3. Restart application
docker compose up -d backend
```

### 5.4 Manual Rollback SQL

```sql
-- backend/prisma/migrations/20240115143000_add_employee_table/rollback.sql
-- Manual rollback for: add_employee_table

DROP INDEX IF EXISTS "idx_employee_company_status";
DROP INDEX IF EXISTS "idx_employee_email";

DROP TABLE IF EXISTS "Employee";

-- Note: Prisma migration table entry must also be removed manually
DELETE FROM "_prisma_migrations" 
WHERE "name" = '20240115143000_add_employee_table';
```

---

## 6. Migration Testing

### 6.1 Local Testing

```bash
# 1. Create test database
createdb sana_test

# 2. Apply migrations
DATABASE_URL=postgresql://sana:test@localhost:5432/sana_test \
  npx prisma migrate deploy

# 3. Run application tests
npm run test:integration

# 4. Test rollback scenario (manual)
# - Apply migration
# - Verify data integrity
# - Restore from backup
# - Verify restoration
```

### 6.2 CI/CD Testing

```yaml
# .github/workflows/ci-cd.yml
integration-tests:
  steps:
    - name: Run migrations on test DB
      run: |
        cd backend
        npx prisma migrate deploy
      env:
        DATABASE_URL: postgresql://sana:test@localhost:5432/sana_test

    - name: Run integration tests
      run: npm run test:integration

    - name: Test migration rollback (simulated)
      run: |
        # Apply migrations
        # Create backup
        # Corrupt data (simulate bad migration)
        # Restore from backup
        # Verify data integrity
```

### 6.3 Performance Testing

```bash
# For large tables, test migration performance
# 1. Create test DB with production-like data volume
# 2. Run migration with timing
time npx prisma migrate deploy

# 3. Check lock duration
# 4. Verify no long-running locks block application

# For large tables, use:
# - CONCURRENTLY for indexes
# - Batching for data updates
# - pg_sleep to throttle
```

---

## 7. Special Migration Scenarios

### 7.1 Large Table Migrations

```sql
-- For tables > 1M rows, avoid long locks

-- 1. Add nullable column
ALTER TABLE "LargeTable" ADD COLUMN "newField" VARCHAR(255);

-- 2. Backfill in batches (application-side or pg_cron)
UPDATE "LargeTable" 
SET "newField" = 'default' 
WHERE "newField" IS NULL 
  AND "id" BETWEEN 1 AND 10000;

-- 3. Add NOT NULL constraint (separate migration)
ALTER TABLE "LargeTable" ALTER COLUMN "newField" SET NOT NULL;

-- 4. Add index CONCURRENTLY
CREATE INDEX CONCURRENTLY "idx_largetable_newfield" ON "LargeTable" ("newField");
```

### 7.2 Renaming Tables/Columns

```prisma
// Use @@map for table renaming
model Employee {
  // ...
  @@map("Employee")  // Keeps table name stable
}

// For column renaming - multi-step:
/*
Step 1: Add new column
Step 2: Backfill new = old
Step 3: Switch application to new
Step 4: Drop old column
Step 5: Rename new to old (if needed)
*/
```

### 7.3 Changing Column Types

```sql
-- Safe type changes (compatible)
-- VARCHAR(100) -> VARCHAR(200) ✅
-- INT -> BIGINT ✅
-- DATE -> TIMESTAMP ✅

-- Unsafe (requires data migration)
-- VARCHAR -> INT ❌
-- JSON -> VARCHAR ❌
-- TIMESTAMP -> DATE ❌ (data loss)

// Safe pattern:
-- 1. Add new column with correct type
-- 2. Backfill with conversion
-- 3. Switch application
-- 4. Drop old column
-- 5. Rename new to old name
```

---

## 8. Migration Monitoring

### 8.1 Health Check Integration

```typescript
// backend/src/health/database.health.ts
async migrationStatus(key: string): Promise<HealthIndicatorResult> {
  const migrations = await this.prisma.$queryRaw<Array<{ name: string; applied: boolean }>>`
    SELECT name, applied_at IS NOT NULL as applied
    FROM "_prisma_migrations"
    ORDER BY finished_at DESC
  `;

  const pending = migrations.filter(m => !m.applied).length;
  
  return {
    [key]: {
      status: pending === 0 ? 'up' : 'degraded',
      pendingMigrations: pending,
      totalMigrations: migrations.length,
    },
  };
}
```

### 8.2 Prometheus Metrics

```typescript
// Alert on pending migrations
- alert: PendingMigrations
  expr: sana_migration_pending > 0
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Pending database migrations detected"
```

---

## 9. Documentation Requirements

### 9.1 Migration Documentation Template

Each migration should document:

```markdown
# Migration: 20240115143000_add_employee_national_id

## Description
Add nationalId field to Employee for Iranian national ID tracking.

## Schema Changes
- `Employee.nationalId` VARCHAR(10) NULL UNIQUE

## Data Migration
None required (nullable field).

## Rollback
```sql
ALTER TABLE "Employee" DROP COLUMN "nationalId";
```

## Testing
- [ ] Applied to development DB
- [ ] Tested with 10k employee records
- [ ] Unique constraint verified
- [ ] Rollback tested

## Deployment Notes
- No downtime required
- Concurrency safe
- Index created CONCURRENTLY
```

---

## 10. Emergency Migration Procedures

### 10.1 Hotfix Migration

```bash
# For critical production issues only
# Requires: DBA + Tech Lead approval

# 1. Create hotfix branch
git checkout main && git pull
git checkout -b hotfix/migration-fix

# 2. Create migration
npx prisma migrate dev --name emergency_fix_issue

# 3. Test thoroughly
# 4. Deploy via emergency process (see CI_CD_RELEASE_GUIDE.md)
```

### 10.2 Failed Migration Recovery

```bash
# If migration fails mid-deployment:

# 1. Check error
docker logs sana-backend --tail 100

# 2. Check migration status
docker exec sana-backend npx prisma migrate status

# 3. If partially applied, resolve manually:
#    - Complete the migration SQL manually
#    - Or restore from backup and investigate

# 4. Mark migration as applied/failed in _prisma_migrations
docker exec sana-db psql -U sana -d sana_hrms -c "
  UPDATE _prisma_migrations 
  SET applied_at = NOW(), 
      finished_at = NOW(),
      logs = 'Manually resolved: <reason>'
  WHERE name = '20240115143000_problematic_migration';
"

# 5. Continue remaining migrations
docker exec sana-backend npx prisma migrate deploy
```

---

## 11. Migration Checklist Summary

### Pre-Migration
- [ ] Schema changes reviewed
- [ ] Migration SQL reviewed
- [ ] No destructive operations
- [ ] Indexes use CONCURRENTLY
- [ ] Tested on production-scale data
- [ ] Rollback plan documented
- [ ] Pre-migration backup verified

### During Migration
- [ ] Maintenance window active (if needed)
- [ ] Monitoring alerts active
- [ ] Application in read-only (if breaking)
- [ ] Migration deploy command executed
- [ ] Status verified: `npx prisma migrate status`

### Post-Migration
- [ ] Health checks passing
- [ ] Application smoke tests pass
- [ ] No error rate spike
- [ ] Performance metrics normal
- [ ] Audit log records migration
- [ ] Team notified of completion

---

**Document Version:** 1.0  
**Last Updated:** 2026-11-18  
**Next Review:** Sprint Planning  
**Owner:** DBA / Backend Lead / DevOps