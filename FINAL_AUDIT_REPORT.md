# Sana HRMS Engineering Audit

Status: IN PROGRESS. This document is not a production-readiness certificate.
Started: 2026-11-15 (Asia/Tehran).

## Baseline

- NestJS 11, Prisma 6.19, PostgreSQL; React 18, Vite 6, TypeScript.
- 29 domain modules, 28 authenticated UI destinations, four existing backend test suites.
- Existing UI redesign, manual manager attendance and employee task behavior must remain.
- Working tree was clean at audit start. No real employee data is used in tests.
- Database connectivity verified with `SELECT 1`; no source data printed.
- Source and environment snapshot: `backups/pre-audit-20261115-150401.source.zip.dpapi`.
  258 archive entries; encryption and archive read-back verified. Windows DPAPI
  CurrentUser protects it; recovery requires this Windows user profile. No secrets
  were printed. A failed sandbox DPAPI attempt produced no archive before retry.
- Database backup and isolated restore test: NOT YET EXECUTED.

## Confirmed Findings

| ID | Priority | Files | Root Cause / Required Correction | Status |
| --- | --- | --- | --- | --- |
| SEC-01 | P0 | users/users.service.ts | Reset/update/revoke lack protected-admin policy and reauthentication | Open |
| SEC-02 | P0 | users/users.service.ts, roles/roles.service.ts | User lists and writes are global; role/scope assignments can escalate access | Open |
| SEC-03 | P0 | employees/employees.service.ts | List spreads full employee row; detail and bank endpoints leak identifiers/IBAN | Open |
| SEC-04 | P0 | common/access/access.service.ts | Narrow scope with companyId expands to the whole company; validFrom ignored | Open |
| SEC-05 | P0 | auth/auth.service.ts, auth/jwt.strategy.ts | Access JWT not bound to revocable session; refresh grace checks inactive state too late | Open |
| SEC-06 | P0 | common/filters/all-exceptions.filter.ts, common/prisma/prisma.service.ts | Raw exception/query data can enter logs; development responses contain stack | Open |
| TEN-01 | P0 | assets, admin, training, org, payroll services | Multiple list/detail/write methods lack tenant/record checks; query filters can replace restrictions | Open |
| BAK-01 | P1 | backup/backup.service.ts | Backup is incomplete JSON, not a restorable database archive; no restore implementation | Open |
| FIN-01 | P1 | payroll/payroll.service.ts | Large multi-step generation/locking requires concurrency and idempotency verification | Not fully reviewed |
| OPS-01 | P1 | HR domain services | Leave/mission/correction relations and concurrent decisions require tests | Not fully reviewed |
| UI-01 | P2 | frontend pages and App.tsx | Remaining DTO/date/report/notification/backup/routing mismatches need contract tests | Not fully reviewed |
| DEP-01 | P4 | Docker, configuration, docs | Production TLS/cookies, health, dependency audit, deployment and restore rehearsal need verification | Not verified |

## Execution Order

1. Protected account and delegation policy, confidential output, tenant boundaries, sessions.
2. Payroll and core HR integrity, real database backup/restore.
3. API/form contracts, reports, notifications, routing, query performance.
4. Preserve and verify the shared RTL dark/light UI; accessible error pages.
5. Security/API/database/browser tests, migrations and operational documentation.

No payroll formula changes or restore over the live database are authorized by
assumption. Destructive operations require explicit approval. Test databases must
be separately named and verified before any reset or restore.

## Test Results

Audit-specific tests: not yet written/run. Previous-turn results are not counted
as verification of the security fixes in this audit.

## References

- [OWASP Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [PostgreSQL 16 pg_dump](https://www.postgresql.org/docs/16/app-pgdump.html)

## Production Decision

NOT READY. Confirmed P0 findings and untested operational workflows remain.

## Local Login Recovery (2026-11-16)

- The authoritative database is the existing Docker container `sana-db`, using
  volume `sana-hrms_sana-pgdata`. Other local PostgreSQL/PGlite directories are
  unrelated and must not be used as evidence of Sana database health.
- Container port configuration existed, but the live host binding was absent.
  Restarting the existing container after freeing port 5433 restored
  `127.0.0.1:5433 -> 5432`. No container, volume, user or business record was reset.
- Before restart, a full custom-format `pg_dump` was encrypted with the configured
  backup key. Artifact:
  `backups/before-login-fix-2026-11-16T11-32-36-227Z.pgdump.enc` (454429 bytes).
  AES-256-GCM envelope: ASCII `SANA-PGDUMP-v1\n`, 12-byte IV, 16-byte tag, ciphertext;
  key is SHA-256 of the configured backup key material. Decryption read-back
  matched the original dump. SHA-256 of encrypted artifact:
  `2a3fb48041ff675488980d8c0c349c5d624f59c43858502c923db1555d2719d2`.
  Isolated database restore is still NOT tested.
- Verified through the Vite proxy: login HTTP 200, authenticated profile HTTP 200,
  logout HTTP 200, reuse of the same access token after logout HTTP 401;
  login page HTTP 200. Backend startup error log is empty after recovery.
- Existing configured passwords matched four active account hashes. Other five
  passwords were not recovered or reset. No credentials or password hashes are
  stored in this report.
- Backend and frontend are running locally on ports 4114 and 5183 respectively.
  These checks establish local login recovery, not completion of the full audit.

## Task Workflow And Categories (2026-11-16)

- Task surfaces now distinguish done (green), unable (red), and in-progress
  (soft blue), independently of their shared category color.
- Added persisted retry requests, manager approval/rejection, required rejection
  reasons, notifications, and history. Employee-only requests require assignment;
  reviews require `tasks.update` and task access. Compare-and-set updates reject
  concurrent duplicate requests/reviews. Changing a category with unchanged
  assignees preserves the pending request and inability reason.
- Added six validated shared categories to tasks, projects and project stages.
  Null stage categories inherit the current parent category in the UI.
- Applied migration `20261116132200_task_categories_retry` without data reset.
  Prisma validation and database/schema diff passed (no difference).
- Pre-migration full encrypted database backup:
  `backups/before-task-workflow-2026-11-16T13-21-54-671Z.pgdump.enc` (463762 bytes).
  Same AES-256-GCM envelope as the login recovery backup; decryption read-back
  matched the original custom-format dump. Encrypted artifact SHA-256:
  `09c1af9802b5510df3c6dd45085a86dc2375e62654ba57aded4ed47f260702a4`.
  Isolated restore has not been tested.
- Verification: 127 backend tests, 27 frontend tests, both production builds,
  and a live HTTP workflow through port 5183 passed. Live checks included scoped
  assignment, duplicate/concurrent requests and reviews, rejection, approval,
  restart/completion/dismissal, category edits, and project category inheritance.
  Temporary test users, employees, tasks, projects and their task notifications
  were removed. Browser screenshots were not verified.
- Backend remains on port 4114; frontend remains on 5183. This feature work does
  not change the overall NOT READY production decision above.
