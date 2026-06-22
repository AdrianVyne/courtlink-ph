import { describe, expect, it } from "vitest";
import { backupObjectKey } from "./s3.js";

describe("backupObjectKey", () => {
  it("builds a daily-prefixed, sortable key", () => {
    const key = backupObjectKey(new Date("2026-06-22T03:04:05.678Z"));
    expect(key).toBe("backups/2026/06/courtlink-2026-06-22T03-04-05-678Z.sql.gz.enc");
  });
});
