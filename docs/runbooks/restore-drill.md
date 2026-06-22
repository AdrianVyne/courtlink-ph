# Monthly Restore Drill

## Purpose

Complete this drill monthly and after changes to backup, encryption, object storage, PostgreSQL, or migrations. A successful upload is not proof that a backup can be restored.

## Preconditions

- Confirm the latest backup object exists and its timestamp matches the daily schedule.
- Confirm `BACKUP_ENCRYPTION_KEY` is available through the approved secret store without printing it.
- Record the production migration version and representative aggregate row counts. Use aggregates only; do not export user or payment rows.
- Ensure enough free disk space for a second temporary PostgreSQL database.

## Create a scratch database

```bash
docker compose -f compose.prod.yaml exec postgres createdb -U courtlink courtlink_restore_drill
```

Construct a temporary `DATABASE_URL` targeting `courtlink_restore_drill` inside the Compose network and load it into `RESTORE_DATABASE_URL` through a protected shell mechanism. Run restore with the latest exact object key:

```bash
docker compose -f compose.prod.yaml --profile backup run --rm \
  -e DATABASE_URL="$RESTORE_DATABASE_URL" \
  backup node packages/backup/bin/restore.mjs --s3-key backups/YYYY/MM/courtlink-TIMESTAMP.sql.gz.enc
```

Do not place the URL or password in shell history. On Oracle Linux, prefer a temporary root-readable environment file and delete it after the drill.

## Validate

Check migrations, schema access, and aggregate counts:

```bash
docker compose -f compose.prod.yaml exec postgres psql -U courtlink -d courtlink_restore_drill -c 'SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 5;'
docker compose -f compose.prod.yaml exec postgres psql -U courtlink -d courtlink_restore_drill -c 'SELECT COUNT(*) AS users FROM users; SELECT COUNT(*) AS venues FROM venues; SELECT COUNT(*) AS court_bookings FROM court_bookings;'
```

Compare aggregate counts with the recorded production values and explain expected differences caused by activity after the backup timestamp. Run `prisma migrate status` against the scratch URL to prove migration consistency.

## Teardown and evidence

```bash
docker compose -f compose.prod.yaml exec postgres dropdb -U courtlink courtlink_restore_drill
```

Record drill date, backup object key, backup timestamp, restore duration, migration result, aggregate comparison, operator, and any follow-up issue. Do not record keys, URLs containing credentials, personal data, or payment data.

If decryption, download, restore, migration, or validation fails, preserve sanitized error evidence, keep the scratch database until diagnosis is complete, alert the platform owner, and treat backup health as critical. Do not attempt a production restore without explicit authorization and a separate recovery plan.
