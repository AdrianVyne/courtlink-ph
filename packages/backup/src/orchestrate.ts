import { spawn } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { PassThrough, type Readable, pipeline } from "node:stream";
import { promisify } from "node:util";
import { createGunzip, createGzip } from "node:zlib";
import { createDecryptStream, createEncryptStream } from "./crypto.js";

const pipe = promisify(pipeline);

export interface BackupConfig {
  databaseUrl: string;
  secret: string;
  // Command that writes a SQL dump to stdout. Defaults to plain `pg_dump`, but
  // can be overridden (e.g. to run inside the postgres container).
  pgDumpCommand?: string;
  pgDumpArgs?: string[];
  // Command that reads SQL from stdin and applies it. Defaults to `psql`.
  psqlCommand?: string;
  psqlArgs?: string[];
}

function dumpArgs(config: BackupConfig): { command: string; args: string[] } {
  const command = config.pgDumpCommand ?? "pg_dump";
  const args = config.pgDumpArgs ?? ["--no-owner", "--no-privileges", config.databaseUrl];
  return { command, args };
}

function restoreArgs(config: BackupConfig): { command: string; args: string[] } {
  const command = config.psqlCommand ?? "psql";
  const args = config.psqlArgs ?? ["--quiet", config.databaseUrl];
  return { command, args };
}

function spawnChecked(
  command: string,
  args: string[],
): {
  child: ReturnType<typeof spawn>;
  done: Promise<void>;
} {
  const child = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"] });
  let stderr = "";
  child.stderr?.on("data", (chunk: Buffer) => {
    stderr += chunk.toString();
  });
  const done = new Promise<void>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}: ${stderr.trim()}`));
    });
  });
  return { child, done };
}

// Streams: pg_dump -> gzip -> AES-256-GCM encrypt -> destination writable.
export async function backupToStream(
  config: BackupConfig,
  destination: NodeJS.WritableStream,
): Promise<void> {
  const { command, args } = dumpArgs(config);
  const { child, done } = spawnChecked(command, args);
  if (!child.stdout) throw new Error("pg_dump produced no stdout stream");

  await Promise.all([
    pipe(child.stdout, createGzip(), createEncryptStream(config.secret), destination),
    done,
  ]);
}

export async function backupToFile(config: BackupConfig, filePath: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await backupToStream(config, createWriteStream(filePath));
}

// Streams: source readable -> AES-256-GCM decrypt -> gunzip -> psql stdin.
export async function restoreFromStream(config: BackupConfig, source: Readable): Promise<void> {
  const { command, args } = restoreArgs(config);
  const { child, done } = spawnChecked(command, args);
  if (!child.stdin) throw new Error("psql has no stdin stream");

  await Promise.all([
    pipe(source, createDecryptStream(config.secret), createGunzip(), child.stdin),
    done,
  ]);
}

export async function restoreFromFile(config: BackupConfig, filePath: string): Promise<void> {
  await restoreFromStream(config, createReadStream(filePath));
}

// Helper so callers can tee a backup to both a local file and an upload sink.
export function tee(): { input: PassThrough; a: PassThrough; b: PassThrough } {
  const input = new PassThrough();
  const a = new PassThrough();
  const b = new PassThrough();
  input.on("data", (chunk) => {
    a.write(chunk);
    b.write(chunk);
  });
  input.on("end", () => {
    a.end();
    b.end();
  });
  return { input, a, b };
}
