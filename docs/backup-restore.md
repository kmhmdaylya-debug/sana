# Backup And Restore Operations

## Scope And Permissions

The archive API requires an active superadministrator and `backup.manage`.
Tenant administrators cannot download a database containing other companies.
The database archive includes password hashes and HR information. Treat it as
confidential even though it is encrypted. Do not attach it to support logs.

Uploaded documents are NOT included in the database archive. Back up the
`uploads` directory or Docker `sana-uploads` volume separately, with encryption,
restricted access and a matching retention/recovery plan.

## Configuration

Set these values outside source code, in the deployment secret/environment:

- `DATABASE_URL`: authoritative source PostgreSQL database.
- `BACKUP_ENCRYPTION_KEY`: strong secret of at least 32 characters. Keep an
  offline recovery copy. Changing it makes archives encrypted with the old key
  unreadable unless the old key is retained separately.
- `BACKUP_DIR`: writable private directory, or the persistent Docker backup volume.
- `PG_DUMP_PATH`, `PG_RESTORE_PATH`: compatible PostgreSQL client executables.
  On this Windows development host they are under `C:/pgroot/pgsql/bin/`.
  The Docker image installs `postgresql16-client` to match PostgreSQL 16;
  do not substitute a newer major client and assume downgrade restore works.
  PostgreSQL explicitly does not guarantee loading a dump into an older server
  major version, even when that server produced the original data.
  [PostgreSQL pg_dump compatibility](https://www.postgresql.org/docs/current/app-pgdump.html).
- `BACKUP_RESTORE_DATABASE_URL`: optional, separately provisioned empty database
  with a name beginning `sana_restore_`. Empty configuration disables restore.

Do not put passwords in command arguments or commit real environment files.
The service passes PostgreSQL credentials through the child environment.

## Create And Download

1. Sign in as the authorized administrator and open the Backup page.
2. Run backup and wait for a successful history entry with a checksum and size.
3. Download that entry. The response contains the real encrypted archive bytes.

API: `POST /api/v1/backup/run`, `GET /api/v1/backup/history`, and
`GET /api/v1/backup/:id/download` (check Swagger for the current controller paths).
The archive is a full `pg_dump --format=custom --no-owner --no-privileges` dump.
Envelope: ASCII `SANA-PGDUMP-v1\n`, 12-byte IV, 16-byte GCM authentication tag,
then ciphertext. AES-256-GCM uses SHA-256 of the configured key material.
The encrypted file also has a stored SHA-256 checksum. Download verifies the
checksum, authenticated decryption, PostgreSQL magic and `pg_restore --list`.

Do not rely on old JSON history entries as complete PostgreSQL backups.
The new UI only offers restorable `.pgdump.enc` archives for this workflow.

## Restore Rehearsal

1. Provision a new, empty `sana_restore_*` database. Never use `sana_hrms`.
2. Configure its URL on the server, not in the request or frontend source.
3. Select the archive, enter your CURRENT administrator password and type the
   exact destination database name in the restore confirmation form.
4. The service validates the archive, destination name, emptiness and a database
   advisory lock, then creates a fresh safety backup of the source.
5. Restore runs with `--exit-on-error --single-transaction`; restored refresh
   tokens and sessions are revoked before a successful response.
6. Check row counts and business invariants in staging, attach the corresponding
   protected document backup, and conduct an authorized application smoke test.

API: `POST /api/v1/backup/restore`, body:

```json
{
  "backupId": "<archive-uuid>",
  "currentPassword": "<administrator-current-password>",
  "confirmationDatabase": "sana_restore_rehearsal"
}
```

The application NEVER promotes staging or overwrites the live database.
Production cutover requires a separately planned maintenance window, new source
backup, verified files, write freeze, connection changes and rollback procedure.
If restore fails after PostgreSQL has populated staging, investigate that staging
database. No automated deletion or replacement is performed.

## Verification

From `backend`, run `npm run test:integration`. The runner creates independently
named synthetic test and restore databases, applies all migrations, exercises
real archive creation/download/restore/tamper/nonempty-target rejection and drops
only the verified temporary databases afterward. It does not restore real staff
data into test fixtures or reset the authoritative database.

Current limits: 256 MiB subprocess/archive buffer cap and bounded subprocess/
transaction timeouts. Streaming large archives, remote storage, automated
retention, file-volume backup and production promotion are not yet certified.

## Payment Migration Rollback

`backend/prisma/rollback/20261116210000_installment_payments.sql` refuses to remove
a nonempty payment ledger. Do not bypass that guard. Once payments exist, use a
forward corrective migration; preserve payment and audit history. Manual rollback
also requires coordinated Prisma migration bookkeeping by an operator.
