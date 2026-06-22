# Migration Forward-Fix and Rollback Runbook

## Purpose

Define how CourtLink PH applies schema migrations safely and recovers from a failed or
harmful migration. Prisma migrations are forward-only: there is no automatic down
migration. Recovery is therefore either a forward-fix migration or a restore from the
most recent verified backup. Complete a rehearsal of this runbook after any change to the
migration toolchain and before a release that alters the schema.

## Principles

- Use the expand/contract pattern so each deploy is backward compatible with the running
  application version.
  - Expand: add nullable columns, new tables, or new enum values. Backfill in a separate
    step. Never rename or drop in the same release that introduces the replacement.
  - Migrate reads/writes: ship application code that writes both old and new shapes, then
    reads the new shape.
  - Contract: drop the old column or constraint only in a later release after the new
    shape is fully adopted.
- Treat additive migrations as low risk and destructive migrations (DROP, NOT NULL on a
  populated column, type narrowing) as high risk requiring a verified backup first.
- Always capture `prisma migrate status` before and after a deploy.

## Pre-deploy checklist

1. Confirm a verified recent backup exists (see `docs/runbooks/restore-drill.md`).
2. Record the current migration version:
   ```bash
   pnpm --filter @courtlink/database db:status
   ```
3. Review the migration SQL for destructive statements. If any are present, treat the
   deploy as high risk and require an explicit go/no-go from the platform owner.

## Apply a migration

```bash
pnpm --filter @courtlink/database db:migrate
pnpm --filter @courtlink/database db:status
```

A healthy result reports that the database schema is up to date and lists the new
migration as applied.

## Forward-fix (default recovery)

Use a forward-fix when a migration applied but produced an incorrect schema or data, or
when application code is incompatible with the new schema.

1. Do not edit or delete an already-applied migration directory.
2. Author a new migration that corrects the problem (add the missing index, relax the
   constraint, backfill the column, restore a default).
3. Apply and verify:
   ```bash
   pnpm --filter @courtlink/database db:migrate
   pnpm --filter @courtlink/database db:status
   ```
4. Redeploy application code if the fix changes the expected shape.

## Failed migration (P3009)

If `migrate deploy` records a failed migration, the database is left partially changed and
Prisma refuses further deploys until resolved.

1. Inspect the failure and the partial state:
   ```bash
   pnpm --filter @courtlink/database db:status
   ```
2. If the partial change is safe to keep, finish it manually inside a transaction, then
   mark the migration applied:
   ```bash
   pnpm --filter @courtlink/database exec prisma migrate resolve --applied <migration_name>
   ```
3. If the partial change must be undone, reverse it manually inside a transaction, then
   mark the migration rolled back so it can be re-authored:
   ```bash
   pnpm --filter @courtlink/database exec prisma migrate resolve --rolled-back <migration_name>
   ```
4. Author a corrected migration and apply it via the forward-fix steps.

## Rollback by restore (high-risk destructive failure)

Use this only when a destructive migration has lost or corrupted data and a forward-fix
cannot recover it.

1. Stop the API and worker so no new writes occur.
2. Follow `docs/runbooks/restore-drill.md` against the production database using the last
   verified backup taken before the migration.
3. Run `db:status` to confirm the restored migration version matches the pre-migration
   version.
4. Re-author the migration to be non-destructive (expand/contract) before redeploying.
5. Record the data loss window (time between backup and incident) and notify the owner.

## Evidence to record

Date, migration name, risk classification, pre/post `migrate status` results, recovery
path taken (forward-fix, resolve, or restore), operator, and any follow-up issue. Do not
record credentials, connection strings with passwords, personal data, or payment data.
