import {
  createCipheriv,
  createDecipheriv,
  type DecipherGCM,
  randomBytes,
  scryptSync,
} from "node:crypto";
import { Transform } from "node:stream";

// Encrypted backup container format (all big-endian / raw bytes):
//   magic  : "CLB1"            (4 bytes)
//   salt   : 16 bytes          (scrypt salt for key derivation)
//   iv     : 12 bytes          (AES-GCM nonce)
//   body   : ciphertext        (streamed)
//   tag    : 16 bytes          (GCM auth tag, written last)
//
// AES-256-GCM gives confidentiality and integrity; the tag is verified on
// decrypt, so a truncated or tampered backup fails loudly instead of restoring
// corrupt data.
export const MAGIC = Buffer.from("CLB1", "ascii");
const SALT_BYTES = 16;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;

export class BackupCryptoError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "BackupCryptoError";
  }
}

export function deriveKey(secret: string, salt: Buffer): Buffer {
  if (secret.length < 16) {
    throw new BackupCryptoError("BACKUP_KEY_TOO_SHORT", "Backup secret must be at least 16 chars");
  }
  return scryptSync(secret, salt, KEY_BYTES);
}

// Returns a Transform that prepends the header, encrypts the stream, and appends
// the GCM tag once the source ends.
export function createEncryptStream(secret: string): Transform {
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const key = deriveKey(secret, salt);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  let headerWritten = false;

  return new Transform({
    transform(chunk, _enc, callback) {
      if (!headerWritten) {
        this.push(Buffer.concat([MAGIC, salt, iv]));
        headerWritten = true;
      }
      callback(null, cipher.update(chunk as Buffer));
    },
    flush(callback) {
      if (!headerWritten) {
        this.push(Buffer.concat([MAGIC, salt, iv]));
        headerWritten = true;
      }
      const finalChunk = cipher.final();
      const tag = cipher.getAuthTag();
      callback(null, Buffer.concat([finalChunk, tag]));
    },
  });
}

// Returns a Transform that parses the header, then decrypts and verifies the
// trailing GCM tag. The last TAG_BYTES of the stream are held back as the tag.
export function createDecryptStream(secret: string): Transform {
  let header: Buffer | null = null;
  let buffered = Buffer.alloc(0);
  let decipher: DecipherGCM | null = null;
  const headerLength = MAGIC.length + SALT_BYTES + IV_BYTES;

  return new Transform({
    transform(chunk, _enc, callback) {
      buffered = Buffer.concat([buffered, chunk as Buffer]);

      if (!header) {
        if (buffered.length < headerLength) {
          callback();
          return;
        }
        header = buffered.subarray(0, headerLength);
        buffered = buffered.subarray(headerLength);
        if (!header.subarray(0, MAGIC.length).equals(MAGIC)) {
          callback(new BackupCryptoError("BACKUP_BAD_MAGIC", "Not a CourtLink backup file"));
          return;
        }
        const salt = header.subarray(MAGIC.length, MAGIC.length + SALT_BYTES);
        const iv = header.subarray(MAGIC.length + SALT_BYTES, headerLength);
        const key = deriveKey(secret, salt);
        decipher = createDecipheriv("aes-256-gcm", key, iv) as DecipherGCM;
      }

      // Hold back the last TAG_BYTES; they are the auth tag, not ciphertext.
      if (buffered.length > TAG_BYTES) {
        const body = buffered.subarray(0, buffered.length - TAG_BYTES);
        buffered = buffered.subarray(buffered.length - TAG_BYTES);
        callback(null, decipher?.update(body));
        return;
      }
      callback();
    },
    flush(callback) {
      if (!decipher || !header) {
        callback(new BackupCryptoError("BACKUP_TRUNCATED", "Backup stream ended before header"));
        return;
      }
      if (buffered.length !== TAG_BYTES) {
        callback(new BackupCryptoError("BACKUP_TRUNCATED", "Backup stream missing auth tag"));
        return;
      }
      try {
        decipher.setAuthTag(buffered);
        callback(null, decipher.final());
      } catch {
        callback(new BackupCryptoError("BACKUP_TAG_INVALID", "Backup failed integrity check"));
      }
    },
  });
}
