# Sana HRMS Engineering Audit

Status: IN PROGRESS. This document is not a production-readiness certificate.
Started: 2026-11-15 (Asia/Tehran).

## Current Audit Snapshot (2026-11-17)

This section supersedes the historical baseline and its original open statuses.
The complete mission is not yet certified. No unexecuted check is counted as passed.

### Safety And Database

- The authoritative database remains Docker container `sana-db`, existing volume
  `sana-hrms_sana-pgdata`, database `sana_hrms`, localhost port 5433. No reset,
  production restore, account reseed, task purge or employee deletion was run.
- Before this implementation, source and environment files were archived in
  `backups/pre-comprehensive-audit-20261116-175720.source.zip.dpapi`.
  Read-back verified: 276 entries, 809238 encrypted bytes. DPAPI CurrentUser
  recovery requires the same Windows user profile. A failed sandbox attempt
  produced no usable backup and is not counted as successful.
- Latest verified full database archive, before the payment-history migration:
  `backups/sana-2026-11-17T03-13-19-679Z-f4265c5a-e473-4574-b1ec-f19b8a7814af.pgdump.enc`.
  Size: 469657 bytes. Encrypted SHA-256:
  `a070eff2378a9d224c4e62c38714f7c2fe0a855de1dde5c63ef9ac531632c0dc`.
  Created by the real backup service, decrypted and checked by `pg_restore --list`
  through its download/read-back path. Credentials and employee data were not printed.
- Earlier verified full archive:
  `backups/sana-2026-11-16T17-30-02-781Z-1973df1b-61e2-4cdc-9d12-4fce13e09472.pgdump.enc`,
  468998 bytes, SHA-256
  `24209f5be961e1c56fcb02a519f7035e8fa2265d58e08ad4a300c66f4c8aaf95`.
- Additive migrations applied to the existing live database without data reset:
  `20261116173500_security_permissions` and
  `20261116210000_installment_payments`. The first adds permission metadata and
  updates system task labels, not role grants or user-authored task content.
  The second adds a payment ledger with foreign keys, indexes, a positive-amount
  constraint and unique idempotency keys. It does not rewrite existing installments.
- Payment rollback SQL is in `backend/prisma/rollback/`. It refuses rollback
  when payment history exists; financial history must not be discarded.

### Findings And Remediation Register

Paths below are relative to the repository. A module name denotes its service,
controller and DTO where applicable; exact changes remain visible in the worktree.

| ID | Priority | Root Cause And Files | Implemented Correction | Evidence / Remaining Risk |
| --- | --- | --- | --- | --- |
| SEC-01 | P0 | `backend/src/users`, `roles`: generic user management could modify protected administrators or delegate broader roles | Protected-account policy, dedicated permission and reauthentication, session revocation, protected role rules | Authentication/user security suites; employee/lifecycle alternate paths also hardened |
| SEC-02 | P0 | `backend/src/employees/employee-privacy.ts`, `contracts`: broad row serialization exposed personal, bank and salary fields | Independent personal/bank/salary visibility and dedicated permissions, scoped serializers and sensitive-view audit | Privacy unit tests and real API output/export checks |
| SEC-03 | P0 | `common/access/access.service.ts`: scope anchors and validity dates were misinterpreted | Narrow scopes remain narrow; effective role/scope dates checked; deny-empty filter; company/member/reference assertions | Access policy tests and real company-A/company-B API tests |
| SEC-04 | P0 | `auth`: access JWT outlived logout or account changes | Live session/family validation, disabled/deleted account checks, refresh rotation and revocation | Authentication security suite; previous local proxy login/logout smoke check recorded below |
| SEC-05 | P0 | `common/filters`, `common/prisma`, `common/audit`: raw errors/query payloads could disclose HR data | Generic production errors, suppressed query/error details and recursive audit redaction | Error/redaction suites; some nonsensitive audit writes remain best-effort |
| TEN-01 | P0 | `org`, `training`, `admin`: actor missing from reads/writes and linked IDs unchecked | Actor forwarded by controllers; tenant predicates intersect filters; related company/user/employee IDs verified | Real PostgreSQL API tests, including options and writes, not only mocks |
| TEN-02 | P0 | `leaves`, `shifts`, `lifecycle`, `settings`: tenantless definitions, policy and lifecycle decisions | Scoped definitions and mutations; cross-company links rejected; protected employee termination blocked; global settings restricted to superadmin | Real API tests for foreign IDs, query overrides and unchanged rejected records |
| TEN-03 | P0 | `recruitment`, `loans`, `evaluations`: related-resource ownership was not enforced | Tenant filters follow requisition/opening/applicant and form/cycle relations; benefit references and decision access checked | Real API tests across lists, detail, mutations and linkage |
| TEN-04 | P0 | `missions`: entity helper did not enforce employee access for mutations | All mission mutations and expense decisions now assert employee scope; organization references checked | Foreign mission write tests and concurrency tests |
| TEN-05 | P0 | `approvals`: payload employee ID and role assignment could override record ownership | Subject owner resolved from the actual record; flow company/subject checked; inbox and decisions scoped; recipient access checked; final steps dispatch the real domain operation in the same transaction | Positive multi-step and concurrent decision tests, six-domain outcome matrix, and forced audit-failure rollback passed |
| TEN-06 | P0 | `payroll`: an employee/branch anchor could expose whole-company totals or generation | Company-level payroll operations require explicit company-wide scope; own payslip access remains record-scoped | Additional narrow-scope PostgreSQL test added |
| FIN-01 | P1 | `payroll`: multi-step writes and publication were not serialized | Period locks, transactional generation/review/lock/publication and amendments; mandatory redacted audit; notification deduplication; company lock for canonical components | Real concurrent generation/review/publication and audit-failure rollback tests; formulas unchanged |
| FIN-02 | P1 | `loans`: payment read/modify/write race, no retry identity, insufficient payment privilege | Loan/installment/period locks, BigInt addition, payment ledger and UUID idempotency key; changed payload with same key rejected; payment requires approval permission | Concurrent duplicate partial payments, settlement, locked-period replay and unauthorized payment API tests |
| OPS-01 | P1 | `leaves`: overlap/reservation race and Gregorian default year | Employee locks serialize requests, balances and decisions; reservation/consumption/audit/notification commit together; default Jalali year and complete year end | Real overlapping-request and double-approval tests; detailed accrual and working-day policy still needs business validation |
| OPS-02 | P1 | `attendance`: malformed correction values, unscoped devices and non-atomic approval | Typed corrections, record locks and atomic audit; time corrections recompute work/late/early/overtime using company timezone; compute does not overwrite locked or approved-corrected rows | Real API correction/metric and locked-record protection tests passed; full night-shift event grouping and reprocessing policy remain unvalidated |
| OPS-03 | P1 | `contracts`: new version omitted `contractId`; version counter raced | Correct typed version data and contract ID, locked transaction, date interval validation, atomic audit/notification | Real concurrent versions 2/3 and persisted counter checks; status/approval contract tightened separately |
| OPS-04 | P1 | `documents`: upload/download path mismatch, path traversal, weak file checks and private-list leaks | Canonical storage with safe legacy fallback, confined real paths, MIME/signature/size limits, HTTP multipart cap, private document type/classification filtering, serialized version writes | Actual upload/download and traversal/private-output API tests; no malware/CDR scan implemented |
| BAK-01 | P1 | `backup`: incomplete JSON and fake/incomplete restore workflow | Full custom-format pg_dump, AES-256-GCM, checksum and archive validation, actual binary download, superadmin reauthentication and empty staging restore only | Actual API backup/download/restore, tamper and nonempty-target rejection tests using synthetic databases |
| API-01 | P2 | Frontend attendance/mission/asset/leave forms used missing or wrong fields | Shared typed payload builders, Tehran-time conversion, Jalali fields, safe integer validation, preserved failed input and loading guards | Frontend payload tests; form event/browser coverage is not comprehensive |
| API-02 | P2 | `reports`, `notifications`: date/filter/response contract mismatch | Required validated Jalali month/year, underlying module permissions, scoped export columns, CSV formula escaping; persistent first-read timestamp and read filters | Real report export and notification refresh/filter/ownership tests |
| UI-01 | P3 | Missing employee routes and unknown-route fallback | Protected employee list/detail routing and a real 404 page; employee task UI and manual manager attendance preserved | Route/SSR/contrast tests; full desktop/mobile visual verification not executed |
| DEP-01 | P4 | Vulnerable transitive runtime packages and unused vulnerable dependency | Scoped overrides for deepmerge-ts/ExcelJS uuid; React Router 7.18.5; unused Zod removed after checking all source imports | Runtime audit is zero for both packages; 8 moderate backend development-tool advisories remain |
| DEP-02 | P4 | Docker startup reseeded roles; uploads/backups were not persisted/writable; unpinned PostgreSQL client selected major 18 | No automatic seed on restart; persistent writable volumes, readiness endpoint, PostgreSQL 16 client | Isolated Compose build/run, migrations, explicit bootstrap, login, backup/download, real empty-target restore, nonempty rejection and Bearer logout passed |
| SEC-06 | P0 | `auth`: logout without a refresh cookie did not invalidate a valid Bearer session | Validate access JWT signature, issuer, type and session ID; revoke only the credentialed families | Bearer-only logout, other-device survival and forged/wrong-type/wrong-issuer rejection tests passed; updated live proxy smoke passed |
| SEC-07 | P0 | `recruitment`: generic viewing returned applicant national ID, contact details, internal notes and offer salary | Independent personal/salary serialization, protected search fields, mandatory sensitive-view audit, no physical storage paths in output | Real API masked and independently authorized output tests passed; a protected candidate-file download feature is not implemented |
| OPS-05 | P1 | `evaluations`: startup lacked employee/company intersection; scoring and item editing raced finalization | Scoped explicit employee validation; form/cycle/evaluation locks; atomic scores, audit and notifications; no duplicate startup announcements; no own-score finalization | Foreign employee startup rejection, narrow-scope concurrent startup, score preservation and concurrent finalization tests passed |
| OPS-06 | P1 | `shifts`: bulk assignment did not enforce stored capacity/rest/certificate rules | Employee/shift locks, certificate validity, capacity, daily duration and rest/overlap checks; swap eligibility rechecked before transfer | Concurrent capacity, idempotent retry, missing/valid certificate and overnight rest tests passed; legal/business shift policy is not independently certified |
| OPS-07 | P1 | `lifecycle`, `loans`: duplicate onboarding or benefit grants and non-atomic checklist status | Serialized parent/employee locks; transactional checklist/employee/audit updates and active-benefit deduplication | Concurrent onboarding/item completion and benefit grant tests passed; automatic offboarding account closure remains a business-policy gap |
| API-03 | P2 | `Assets.tsx`, `Leaves.tsx`: silent first-company selection and mismatched leave types | Explicit asset company selector; leave types derived from the selected employee with scoped backend checks | Real React event tests for asset submission/error/retry/loading and real leave-type API scope tests passed |
| OPS-08 | P1 | `attendance`: single-event fields dropped; key collisions between employees; every database error mislabeled duplicate | Typed event payloads, employee/device-scoped stable identity and payload fingerprint, serialized ingestion, explicit conflict/failure states | Real device API tests for simultaneous employees, metadata, tenant rejection, clock-adjusted retry and changed-payload conflict passed |
| SETUP-01 | P4 | `scripts`: automatic development seed, mismatched partial settings and misleading printed password | Deploy-only migrations; opt-in empty-user bootstrap guard; fail-closed partial environment; no printed secrets; cryptographic password generation | Three real initializer cases passed in disposable fixtures; no live settings or accounts changed |
| CAL-01 | P1 | `attendance/jalali.util.ts`: Esfand-to-Farvardin interval was compared to 366, so leap Esfand always had 29 days; impossible dates rolled into the next month | Use the existing calendar algorithm's leap result and validate actual month length before conversion | 14 boundary tests passed, including 1399/1403 leap years, 1400/1404 common years, invalid months/days and Gregorian transition |

### Executed Checks

- Latest completed PostgreSQL run including the Bearer logout correction:
  **251 passed, 16 suites, zero skipped**, 51.106 seconds (final repeated run).
  All seven migrations executed in a fresh synthetic database. The test runner
  also created a separate empty restore database and removed both afterward.
  The live database was not used as test data or reset.
- The API tests use a real Nest application, permission guard, validation pipe,
  error filter and real Prisma/PostgreSQL services. Actor injection in this
  fixture is not a substitute for JWT tests; JWT/session behavior is covered by
  the separate authentication security suite.
- Frontend: **36 passed**, zero skipped, after the routing and asset form changes.
  Includes real payload execution, timezone/date tests, component SSR, task
  interactions represented by rendering, route inventory and theme contrast.
  Three tests mount the real asset page with React in jsdom, trigger change/click
  events, and verify company/payload, failed-input retention and pending-submit
  protection. API, auth and visual primitives are test doubles. This is not
  browser end-to-end or all-form event coverage. jsdom is development-only.
- The same **36/36 frontend tests passed on Docker Node 22.23.5**, with source
  and the Prisma schema mounted read-only. The first additional container test
  had 35 passes and one missing-schema fixture failure; adding the schema mount
  corrected that test-environment problem. No application data was mounted.
- Frontend TypeScript and Vite production build succeeded after React Router
  update. A sandbox filesystem denial on the initial build was rerun outside
  that restriction and is not counted as a successful initial attempt.
- Backend build succeeded after the workflow, attendance and Bearer logout edits.
- `scripts/test-setup-safety.ps1`: fresh consistent settings, unchanged existing
  settings and rejected partial settings passed. An initial unsigned-fixture
  execution was refused by PowerShell policy; the test was rerun with a per-child
  execution setting. No machine-wide execution policy was changed.
- Isolated Docker projects `sana-audit-768d496e` and final `sana-audit-58c116d4`: complete build/migration/health,
  synthetic administrator bootstrap, login, encrypted archive/download, real
  PostgreSQL 16 staging restore, copied-session revocation, nonempty-target
  rejection and Bearer-only logout passed. Only its synthetic containers and
  volumes were removed. Earlier registry 403 failures were not counted as passes.
- Prisma schema validation, client generation and live additive migration
  deployment succeeded. The new payment table was tested in isolated PostgreSQL.
- Initial failed tests exposed a real nested-holiday DTO validation bug, a real
  implicit-body-coercion issue, and a void-result advisory-lock query mismatch;
  each was corrected and retested. Other failures were synthetic fixture code
  length, test permission spelling, HTTP status expectations and a changed
  fixture salary expectation, not production data failures.
- `npm audit --omit=dev --json`: backend zero vulnerabilities; frontend install
  audit zero vulnerabilities. Full backend audit: 8 moderate development-tool
  advisories in Nest CLI/glob/minimatch/typescript-eslint. No blind major CLI or
  Prisma upgrade was applied.

### Known Remaining Work / Acceptance Gaps

- Full acceptance is **not complete**. Core corrections below are tested, but
  the remaining business, frontend and operational gaps prevent certification.
- Payroll formulas, tax/insurance law, leave entitlement accrual/carryover,
  cross-year leave and full night-shift event grouping are not fully business-
  validated. Stored shift constraints and correction-derived minutes are now
  tested, not independently certified as legal policy. Existing financial
  formulas were not changed on assumption. Some old financial aggregation uses
  JavaScript numbers and is not certified for arbitrary 64-bit monetary values.
- Onboarding creation/item completion, evaluation scoring/finalization and
  active-benefit grant races are covered. Full offboarding access shutdown,
  anonymous survey duplicate prevention and all training prerequisites/cycles
  have not been certified. Used evaluation questions are protected from ordinary
  replacement so existing scores are not deliberately deleted.
  Offboarding retains the existing immediate `TERMINATED` employee-status update
  at checklist start, even for a future termination date. Automatic account
  disabling or rescheduling this business event was not invented without policy.
- Full visual/mobile/touch/keyboard and all-form browser QA is not executed.
  A prior browser URL-policy denial prevents using an alternate host/browser
  as a workaround. SSR, contrast and payload tests do not replace screenshots
  or real end-to-end browser interaction.
- All-page redesign is not claimed. Existing Persian RTL dark/light system,
  local font, compact task states, colors, retry requests and manager-only
  attendance are preserved. Deep notification routes and several module detail
  screens still need end-to-end routing/interaction coverage.
- Backups currently contain the database, **not uploaded document files**.
  Uploads require a separate encrypted backup plan. Restore is deliberately
  staging-only, never automatic promotion or replacement of the live database.
  The current archive pipeline has a 256 MiB limit and subprocess timeout;
  large-database streaming/off-host recovery is not verified. Legacy JSON
  backups are retained but are not PostgreSQL-restorable archives.
- Restore source data stays intact on failure. Failure after the restore CLI
  commits but before staging session revocation may leave a populated staging
  database needing investigation; it is not auto-deleted.
- Dedicated permissions were added without granting them to existing tenant
  roles. Assign personal/bank/salary/confidential-report permissions explicitly
  through authorized role management. Do not reseed an existing installation
  merely to refresh labels or permissions.
- Encryption at rest of live identity/bank fields, OS disk protections, external
  secret management, TLS termination, proxy topology, off-host recovery,
  antivirus/CDR, public-domain TLS and off-host deployment still require
  operational review. The isolated Compose stack passed; it is not a public
  Production cutover or disaster-recovery certificate.
- The development `.env` remains local and excluded from output. Do not publish
  the development Vite server or these credentials to the Internet.
- The installment-payment API requires a UUID `idempotencyKey`; a complete
  installment-payment frontend workflow has not been added or certified.

### Current Local Runtime

The final local smoke check returned HTTP 200 for the frontend login page,
direct database readiness and readiness through the Vite proxy. The existing
administrator environment credential worked; authenticated `/auth/me` returned
200, Bearer-only logout returned 200, and the same JWT then returned 401.
No credentials, tokens or employee payloads were printed. The first Bearer-only
smoke attempt exposed the logout gap, which was fixed and retested.

- API: loopback `127.0.0.1:4114`, PID 26836.
- Frontend: `0.0.0.0:5183`, PID 25504.
- Local login: `http://127.0.0.1:5183/login`.
- Current Wi-Fi address: `192.168.1.72`; same-Wi-Fi phone URL:
  `http://192.168.1.72:5183/login`. A physical phone connection was not tested.
- Existing `sana-db` and its original volume were preserved. Two databases left
  by the interrupted test run were removed only after verifying exact temporary
  names and no business data (only four permission-migration metadata rows).
- `git diff --check` passed with Windows CR-at-EOL handling. No user changes
  were reverted and no commit, reset or production restore was performed.

### Changed-File Inventory

This is the final worktree inventory, not an assertion of exclusive authorship.
Some earlier fixes are already in the historical baseline; unrelated existing
work was preserved. Environment files and encrypted archives are not listed.

```text
AUDIT_REPORT.md
FINAL_AUDIT_REPORT.md
README.md
backend/.dockerignore
backend/Dockerfile
backend/package-lock.json
backend/package.json
backend/prisma/migrations/20261116173500_security_permissions/migration.sql
backend/prisma/migrations/20261116210000_installment_payments/migration.sql
backend/prisma/rollback/20261116210000_installment_payments.sql
backend/prisma/schema.prisma
backend/scripts/test-integration.cjs
backend/src/app.module.ts
backend/src/approvals/approvals.controller.ts
backend/src/approvals/approvals.module.ts
backend/src/approvals/approvals.service.ts
backend/src/attendance/attendance.controller.ts
backend/src/attendance/attendance.service.ts
backend/src/attendance/daily-attendance.service.ts
backend/src/attendance/dto/attendance.dto.ts
backend/src/attendance/jalali.util.spec.ts
backend/src/attendance/jalali.util.ts
backend/src/auth/auth.controller.ts
backend/src/auth/auth.security.spec.ts
backend/src/auth/auth.service.ts
backend/src/common/access/access.service.ts
backend/src/common/access/tenant-isolation.integration.spec.ts
backend/src/common/audit/audit.service.ts
backend/src/common/constants/permissions.ts
backend/src/common/notifications/notification.service.ts
backend/src/common/pipes/app-validation.pipe.ts
backend/src/contracts/contracts.controller.ts
backend/src/contracts/contracts.service.ts
backend/src/documents/documents.controller.ts
backend/src/documents/documents.service.ts
backend/src/employees/employees.service.ts
backend/src/evaluations/dto/evaluations.dto.ts
backend/src/evaluations/evaluations.controller.ts
backend/src/evaluations/evaluations.service.ts
backend/src/health/health.controller.spec.ts
backend/src/health/health.controller.ts
backend/src/leaves/dto/leaves.dto.ts
backend/src/leaves/leaves.controller.ts
backend/src/leaves/leaves.service.ts
backend/src/lifecycle/lifecycle.controller.ts
backend/src/lifecycle/lifecycle.service.ts
backend/src/loans/dto/loans.dto.ts
backend/src/loans/loans.controller.ts
backend/src/loans/loans.service.ts
backend/src/main.ts
backend/src/missions/missions.controller.ts
backend/src/missions/missions.service.ts
backend/src/payroll/payroll.integration.spec.ts
backend/src/payroll/payroll.service.ts
backend/src/recruitment/recruitment.controller.ts
backend/src/recruitment/recruitment.service.ts
backend/src/settings/settings.controller.ts
backend/src/settings/settings.service.ts
backend/src/shifts/dto/shifts.dto.ts
backend/src/shifts/shifts.controller.ts
backend/src/shifts/shifts.service.ts
docker-compose.audit.yml
docker-compose.yml
docs/backup-restore.md
docs/getting-started.md
frontend/package-lock.json
frontend/package.json
frontend/scripts/forms.test.mjs
frontend/scripts/ui.test.mjs
frontend/src/App.tsx
frontend/src/lib/api.ts
frontend/src/lib/workflowPayloads.ts
frontend/src/main.tsx
frontend/src/pages/Assets.tsx
frontend/src/pages/Attendance.tsx
frontend/src/pages/Employees.tsx
frontend/src/pages/Leaves.tsx
frontend/src/pages/Missions.tsx
frontend/src/pages/NotFound.tsx
frontend/src/pages/Reports.tsx
scripts/generate-secrets.ps1
scripts/setup-dev.ps1
scripts/test-compose.ps1
scripts/test-setup-safety.ps1
```

### Source References For Dependency Decisions

- [Deepmerge security advisory](https://github.com/advisories/GHSA-ggr8-5vv4-36mx)
  and [v8 release notes](https://github.com/RebeccaStevens/deepmerge-ts/releases/tag/v8.0.0).
  Prisma's local usage imports `deepmerge` for trusted configuration; the override
  is scoped to `@prisma/config`, not a Prisma major migration.
- [UUID security advisory](https://github.com/advisories/GHSA-w5hq-g745-h8pq).
  Local ExcelJS usage was inspected: it imports `v4`; the override remains scoped
  to ExcelJS and export execution is exercised by the real report tests.
- [React Router release](https://github.com/remix-run/react-router/releases/tag/react-router@7.18.5).
  The application already enabled its v7 future behaviors; those obsolete flags
  were removed while keeping the existing declarative router architecture.

### Run And Recovery Notes

See `docs/backup-restore.md` for archive/restore details and
`docs/getting-started.md` for startup. Current server/health and final-test results
must be confirmed in the completion entry below; historical running-process
claims later in this file describe earlier checks, not current process state.

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
