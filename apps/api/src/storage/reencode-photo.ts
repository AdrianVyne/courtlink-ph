import sharp from "sharp";
import {
  type ProofContentType,
  MAX_PROOF_BYTES,
  StorageValidationError,
} from "./object-storage.js";

const MAX_DIMENSION = 4096;
const WEBP_QUALITY = 82;

/**
 * Venue photos accept the same input types as payment proofs but always
 * publish webp: strips metadata, normalizes orientation, caps dimensions.
 */
export async function reencodePhotoImage(
  buffer: Buffer,
  _contentType: ProofContentType,
): Promise<{ data: Buffer; contentType: "image/webp" }> {
  const data = await sharp(buffer, {
    failOn: "error",
    limitInputPixels: MAX_DIMENSION * MAX_DIMENSION,
  })
    .rotate()
    .resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();

  if (data.length > MAX_PROOF_BYTES) {
    throw new StorageValidationError("PROOF_TOO_LARGE", "Re-encoded image exceeds 5 MB limit");
  }

  return { data, contentType: "image/webp" };
}
