import sharp from "sharp";
import {
  type ProofContentType,
  MAX_PROOF_BYTES,
  StorageValidationError,
} from "./object-storage.js";

const FORMAT_BY_TYPE: Record<ProofContentType, "jpeg" | "png" | "webp"> = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
};

const MAX_DIMENSION = 4096;
const JPEG_QUALITY = 85;
const WEBP_QUALITY = 85;

export async function reencodeProofImage(
  buffer: Buffer,
  contentType: ProofContentType,
): Promise<{ data: Buffer; contentType: ProofContentType }> {
  const format = FORMAT_BY_TYPE[contentType];
  if (!format) {
    throw new StorageValidationError("PROOF_TYPE_UNSUPPORTED", "Upload a JPEG, PNG, or WebP image");
  }

  let pipeline = sharp(buffer, { failOn: "error", limitInputPixels: MAX_DIMENSION * MAX_DIMENSION })
    .rotate()
    .resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    });

  switch (format) {
    case "jpeg":
      pipeline = pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true });
      break;
    case "png":
      pipeline = pipeline.png({ compressionLevel: 6 });
      break;
    case "webp":
      pipeline = pipeline.webp({ quality: WEBP_QUALITY });
      break;
  }

  const data = await pipeline.toBuffer();

  if (data.length > MAX_PROOF_BYTES) {
    throw new StorageValidationError("PROOF_TOO_LARGE", "Re-encoded image exceeds 5 MB limit");
  }

  return { data, contentType };
}
