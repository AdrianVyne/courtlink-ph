# Migration Forward-Fix and Rollback Rehearsal - 2026-06-22

## Procedure under test

`docs/runbooks/migrations.md` and the `@courtlink/database` `db:status` / `db:migrate`
scripts.

## Rehearsal on an isolated scratch database

Performed against a throwaway PostgreSQL database `courtlink_migration_drill` so the
development database was never altered. The scratch database was dropped after the drill,
and the temporary drill migrations were removed; only the four production migrations
remain.

- Baseline: created the scratch database and applied all four migrations.
  `db:status` reported "Database schema is up to date!".
- Induced failure: applied a deliberately invalid migration
  (`ALTER TABLE "this_table_does_not_exist" ...`). `migrate deploy` failed with P3018 and
  PostgreSQL error 42P01, leaving the migration in a failed state.
- Detection: `db:status` reported "Following migration have failed:
  20260622210000_drill_broken" and printed the resolve guidance.
- Recovery via resolve: ran
  `prisma migrate resolve --rolled-back 20260622210000_drill_broken`, which reported the
  migration marked as rolled back.
- Forward-fix: removed the broken migration directory, authored a valid corrective
  migration (additive index), and applied it with `db:migrate`. `db:status` then reported
  five migrations found and "Database schema is up to date!".
- Cleanup: removed the drill migration directories and dropped the scratch database.

## Result

The forward-fix path, the failed-migration detection path, and the
`migrate resolve --rolled-back` recovery path all behaved as documented. The restore-based
rollback path for destructive failures is documented in the runbook and references the
verified monthly restore drill (`docs/runbooks/restore-drill.md`); it was not executed
against production data in this rehearsal.

## Development database integrity

After the drill, `db:status` against the development database reported the original four
migrations and "Database schema is up to date!".
