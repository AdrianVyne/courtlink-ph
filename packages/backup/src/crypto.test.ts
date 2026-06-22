import { gunzipSync, gzipSync } from "node:zlib";
import { Readable } from "node:stream";
import { buffer } from "node:stream/consumers";
import { describe, expect, it } from "vitest";
import { BackupCryptoError, MAGIC, createDecryptStream, createEncryptStream } from "./crypto.js";

async function pipeThrough(
  input: Buffer,
  ...transforms: NodeJS.ReadWriteStream[]
): Promise<Buffer> {
  let stream: NodeJS.ReadableStream = Readable.from([input]);
  for (const t of transforms) stream = stream.pipe(t);
  return buffer(stream);
}

const SECRET = "a-very-strong-backup-secret-key";

describe("backup crypto", () => {
  it("round-trips arbitrary payloads through encrypt then decrypt", async () => {
    const payload = Buffer.from(
      "CREATE TABLE x (id int);\nINSERT INTO x VALUES (1);\n".repeat(1000),
    );
    const encrypted = await pipeThrough(payload, createEncryptStream(SECRET));
    expect(encrypted.subarray(0, MAGIC.length).equals(MAGIC)).toBe(true);
    expect(encrypted.equals(payload)).toBe(false);

    const decrypted = await pipeThrough(encrypted, createDecryptStream(SECRET));
    expect(decrypted.equals(payload)).toBe(true);
  });

  it("round-trips gzip + encrypt the way a real dump pipeline does", async () => {
    const dump = Buffer.from("pg_dump output ".repeat(5000));
    const packed = await pipeThrough(gzipSync(dump), createEncryptStream(SECRET));
    const unpacked = await pipeThrough(packed, createDecryptStream(SECRET));
    expect(gunzipSync(unpacked).equals(dump)).toBe(true);
  });

  it("rejects decryption with the wrong secret", async () => {
    const encrypted = await pipeThrough(Buffer.from("secret data"), createEncryptStream(SECRET));
    await expect(
      pipeThrough(encrypted, createDecryptStream("the-wrong-secret-value")),
    ).rejects.toMatchObject({
      code: "BACKUP_TAG_INVALID",
    });
  });

  it("detects tampering with the ciphertext body", async () => {
    const encrypted = await pipeThrough(
      Buffer.from("important rows".repeat(50)),
      createEncryptStream(SECRET),
    );
    const tampered = Buffer.from(encrypted);
    const mid = Math.floor(tampered.length / 2);
    tampered[mid] = (tampered[mid] ?? 0) ^ 0xff;
    await expect(pipeThrough(tampered, createDecryptStream(SECRET))).rejects.toMatchObject({
      code: "BACKUP_TAG_INVALID",
    });
  });

  it("rejects files without the CourtLink magic header", async () => {
    const notABackup = Buffer.from("XXXX this is not a backup file at all and is long enough");
    await expect(pipeThrough(notABackup, createDecryptStream(SECRET))).rejects.toMatchObject({
      code: "BACKUP_BAD_MAGIC",
    });
  });

  it("rejects a truncated backup missing its auth tag", async () => {
    const encrypted = await pipeThrough(Buffer.from("data"), createEncryptStream(SECRET));
    const truncated = encrypted.subarray(0, encrypted.length - 4);
    await expect(pipeThrough(truncated, createDecryptStream(SECRET))).rejects.toBeInstanceOf(
      BackupCryptoError,
    );
  });
});
