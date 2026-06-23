import { describe, expect, it } from "vitest";
import { reencodeProofImage } from "./reencode-proof.js";

function createMinimalPng(): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(2, 0);
  ihdrData.writeUInt32BE(2, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 2;
  const ihdrType = Buffer.from("IHDR");
  const ihdrLen = Buffer.alloc(4);
  ihdrLen.writeUInt32BE(13, 0);
  const ihdrPayload = Buffer.concat([ihdrType, ihdrData]);
  const { crc32 } = require("node:zlib") as { crc32: (buf: Buffer) => number };
  const ihdrCrc = Buffer.alloc(4);
  ihdrCrc.writeUInt32BE(crc32(ihdrPayload), 0);
  const ihdrChunk = Buffer.concat([ihdrLen, ihdrPayload, ihdrCrc]);

  const raw = Buffer.alloc(2 * (1 + 2 * 3));
  const { deflateSync } = require("node:zlib") as typeof import("node:zlib");
  const compressed = deflateSync(raw);
  const idatType = Buffer.from("IDAT");
  const idatLen = Buffer.alloc(4);
  idatLen.writeUInt32BE(compressed.length, 0);
  const idatPayload = Buffer.concat([idatType, compressed]);
  const idatCrc = Buffer.alloc(4);
  idatCrc.writeUInt32BE(crc32(idatPayload), 0);
  const idatChunk = Buffer.concat([idatLen, idatPayload, idatCrc]);

  const iendType = Buffer.from("IEND");
  const iendLen = Buffer.alloc(4);
  const iendCrc = Buffer.alloc(4);
  iendCrc.writeUInt32BE(crc32(iendType), 0);
  const iendChunk = Buffer.concat([iendLen, iendType, iendCrc]);

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

describe("reencodeProofImage", () => {
  it("re-encodes a valid PNG and returns a buffer", async () => {
    const png = createMinimalPng();
    const result = await reencodeProofImage(png, "image/png");
    expect(result.contentType).toBe("image/png");
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0]).toBe(0x89);
  });

  it("rejects corrupted image data", async () => {
    const garbage = Buffer.from("not an image at all");
    await expect(reencodeProofImage(garbage, "image/jpeg")).rejects.toThrow();
  });
});
