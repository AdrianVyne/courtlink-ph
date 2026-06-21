import { randomUUID } from "node:crypto";

export const ALLOWED_PROOF_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type ProofContentType = (typeof ALLOWED_PROOF_TYPES)[number];
export const MAX_PROOF_BYTES = 5 * 1024 * 1024;

const EXTENSION_BY_TYPE: Record<ProofContentType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export class StorageValidationError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "StorageValidationError";
  }
}

export function assertProofContentType(value: string): ProofContentType {
  if (!ALLOWED_PROOF_TYPES.includes(value as ProofContentType)) {
    throw new StorageValidationError("PROOF_TYPE_UNSUPPORTED", "Upload a JPEG, PNG, or WebP image");
  }
  return value as ProofContentType;
}

export function assertProofSize(bytes: number): void {
  if (bytes <= 0) {
    throw new StorageValidationError("PROOF_EMPTY", "The uploaded file is empty");
  }
  if (bytes > MAX_PROOF_BYTES) {
    throw new StorageValidationError("PROOF_TOO_LARGE", "Proof images must be 5 MB or smaller");
  }
}

// Keys are namespaced by domain + booking so retention and auditing stay simple.
export function buildProofObjectKey(
  scope: "court" | "coach",
  bookingId: string,
  contentType: ProofContentType,
): string {
  return `proofs/${scope}/${bookingId}/${randomUUID()}.${EXTENSION_BY_TYPE[contentType]}`;
}

export interface ObjectStorage {
  putObject(input: { key: string; body: Buffer; contentType: string }): Promise<void>;
  getSignedDownloadUrl(key: string, expiresInSeconds: number): Promise<string>;
}
