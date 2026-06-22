#!/usr/bin/env node
// CourtLink encrypted backup CLI.
//
// Usage:
//   node bin/backup.mjs --file ./backups/dump.sql.gz.enc   # local file
//   node bin/backup.mjs --s3                                # upload to object storage
//   node bin/backup.mjs --file ./out.enc --s3              # both
//
// Required env: DATABASE_URL, BACKUP_ENCRYPTION_KEY
// For --s3: OBJECT_STORAGE_* (+ optional BACKUP_BUCKET)
// Optional: PG_DUMP_COMMAND, PG_DUMP_ARGS (space-separated)
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { PassThrough } from "node:stream";
import { backupObjectKey, backupToStream, s3ConfigFromEnv, uploadBackup } from "../dist/index.js";

function fail(message) {
  process.stderr.write(`backup: ${message}\n`);
  process.exit(1);
}

const args = process.argv.slice(2);
const wantS3 = args.includes("--s3");
const fileIndex = args.indexOf("--file");
const filePath = fileIndex >= 0 ? args[fileIndex + 1] : undefined;
if (!wantS3 && !filePath) fail("specify --file <path> and/or --s3");

const databaseUrl = process.env.DATABASE_URL;
const secret = process.env.BACKUP_ENCRYPTION_KEY;
if (!databaseUrl) fail("DATABASE_URL is required");
if (!secret) fail("BACKUP_ENCRYPTION_KEY is required");

const config = { databaseUrl, secret };
if (process.env.PG_DUMP_COMMAND) config.pgDumpCommand = process.env.PG_DUMP_COMMAND;
if (process.env.PG_DUMP_ARGS)
  config.pgDumpArgs = process.env.PG_DUMP_ARGS.split(" ").filter(Boolean);

const sinks = [];
let fileWritable;
if (filePath) {
  await mkdir(dirname(filePath), { recursive: true });
  fileWritable = createWriteStream(filePath);
  sinks.push(fileWritable);
}

let s3Promise;
let s3Key;
if (wantS3) {
  const s3 = s3ConfigFromEnv();
  s3Key = backupObjectKey();
  const s3Stream = new PassThrough();
  sinks.push(s3Stream);
  s3Promise = uploadBackup(s3, s3Key, s3Stream);
}

// Fan the encrypted stream out to every sink.
const fanout = new PassThrough();
fanout.on("data", (chunk) => {
  for (const sink of sinks) sink.write(chunk);
});
fanout.on("end", () => {
  for (const sink of sinks) sink.end();
});

try {
  await backupToStream(config, fanout);
  if (s3Promise) await s3Promise;
  if (fileWritable) await new Promise((resolve) => fileWritable.on("finish", resolve));
  if (filePath) process.stdout.write(`backup written to ${filePath}\n`);
  if (s3Key) process.stdout.write(`backup uploaded to ${s3Key}\n`);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
