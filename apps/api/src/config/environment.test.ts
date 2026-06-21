import { describe, expect, it } from "vitest";
import { parseEnvironment } from "./environment.js";

describe("parseEnvironment", () => {
  it("parses required service configuration", () => {
    const environment = parseEnvironment({
      DATABASE_URL: "postgresql://courtlink:courtlink@localhost:5433/courtlink",
      REDIS_URL: "redis://localhost:6379",
      SESSION_SECRET: "12345678901234567890123456789012",
      ENCRYPTION_KEY: "12345678901234567890123456789012",
      API_PORT: "3001",
    });

    expect(environment.API_PORT).toBe(3001);
    expect(environment.NODE_ENV).toBe("development");
  });

  it("rejects secrets shorter than 32 characters", () => {
    expect(() =>
      parseEnvironment({
        DATABASE_URL: "postgresql://courtlink:courtlink@localhost:5433/courtlink",
        REDIS_URL: "redis://localhost:6379",
        SESSION_SECRET: "short",
        ENCRYPTION_KEY: "also-short",
      }),
    ).toThrow("Invalid environment configuration");
  });
});
