#!/usr/bin/env node
// CourtLink encrypted restore CLI.
//
// Usage:
//   node bin/restore.mjs --file ./backups/dump.sql.gz.enc
//   node bin/restore.mjs --s3-key backups/2026/06/courtlink-....sql.gz.enc
//
// Required env: DATABASE_URL (target), BACKUP_ENCRYPTION_KEY
// For --s3-key: OBJECT_STORAGE_* (+ optional BACKUP_BUCKET)
// Optional: PSQL_COMMAND, PSQL_ARGS (space-separated)
import { createReadStream } from "node:fs";
import { downloadBackup, restoreFromStream, s3ConfigFromEnv } from "../dist/index.js";

function fail(message) {
  process.stderr.write(`restore: ${message}\n`);
  process.exit(1);
}

const args = process.argv.slice(2);
const fileIndex = args.indexOf("--file");
const filePath = fileIndex >= 0 ? args[fileIndex + 1] : undefined;
const s3Index = args.indexOf("--s3-key");
const s3Key = s3Index >= 0 ? args[s3Index + 1] : undefined;
if (!filePath && !s3Key) fail("specify --file <path> or --s3-key <key>");

const databaseUrl = process.env.DATABASE_URL;
const secret = process.env.BACKUP_ENCRYPTION_KEY;
if (!databaseUrl) fail("DATABASE_URL is required");
if (!secret) fail("BACKUP_ENCRYPTION_KEY is required");

const config = { databaseUrl, secret };
if (process.env.PSQL_COMMAND) config.psqlCommand = process.env.PSQL_COMMAND;
if (process.env.PSQL_ARGS) config.psqlArgs = process.env.PSQL_ARGS.split(" ").filter(Boolean);

try {
  const source = filePath
    ? createReadStream(filePath)
    : await downloadBackup(s3ConfigFromEnv(), s3Key);
  await restoreFromStream(config, source);
  process.stdout.write("restore complete\n");
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
