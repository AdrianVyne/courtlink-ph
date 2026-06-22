import { describe, expect, it, vi } from "vitest";
import { StructuredLogger } from "./structured-logger.js";

describe("StructuredLogger", () => {
  it("writes redacted newline-delimited JSON", () => {
    const write = vi.fn();
    const logger = new StructuredLogger({ write });

    logger.log({ event: "request.completed", cookie: "secret", count: 2 }, "HTTP");

    const line = String(write.mock.calls[0]?.[0]);
    const parsed = JSON.parse(line) as Record<string, unknown>;
    expect(parsed).toMatchObject({
      level: "info",
      context: "HTTP",
      event: "request.completed",
      cookie: "[REDACTED]",
      count: 2,
    });
    expect(line.endsWith("\n")).toBe(true);
  });
});
