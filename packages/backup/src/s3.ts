import { Upload } from "@aws-sdk/lib-storage";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { Readable } from "node:stream";

export interface S3BackupConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
}

export function s3ConfigFromEnv(): S3BackupConfig {
  const endpoint = process.env.OBJECT_STORAGE_ENDPOINT;
  const bucket = process.env.BACKUP_BUCKET ?? process.env.OBJECT_STORAGE_BUCKET;
  const accessKeyId = process.env.OBJECT_STORAGE_ACCESS_KEY;
  const secretAccessKey = process.env.OBJECT_STORAGE_SECRET_KEY;
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error("OBJECT_STORAGE_* (and optional BACKUP_BUCKET) are required for S3 backups");
  }
  return {
    endpoint,
    region: process.env.OBJECT_STORAGE_REGION ?? "us-east-1",
    bucket,
    accessKeyId,
    secretAccessKey,
    forcePathStyle: process.env.OBJECT_STORAGE_FORCE_PATH_STYLE !== "false",
  };
}

function client(config: S3BackupConfig): S3Client {
  return new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: config.forcePathStyle,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
}

export async function uploadBackup(
  config: S3BackupConfig,
  key: string,
  body: Readable,
): Promise<void> {
  const upload = new Upload({
    client: client(config),
    params: { Bucket: config.bucket, Key: key, Body: body },
  });
  await upload.done();
}

export async function downloadBackup(config: S3BackupConfig, key: string): Promise<Readable> {
  const result = await client(config).send(
    new GetObjectCommand({ Bucket: config.bucket, Key: key }),
  );
  if (!result.Body) throw new Error(`Backup object ${key} has no body`);
  return result.Body as Readable;
}

// Timestamped key with a daily prefix so retention/lifecycle rules can target
// whole days (e.g. expire everything under backups/2026/06/).
export function backupObjectKey(now = new Date()): string {
  const iso = now.toISOString().replace(/[:.]/g, "-");
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `backups/${yyyy}/${mm}/courtlink-${iso}.sql.gz.enc`;
}
