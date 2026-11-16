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
