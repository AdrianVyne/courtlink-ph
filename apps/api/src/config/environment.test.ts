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

  it("allows Google OAuth to remain disabled without provider credentials", () => {
    const environment = parseEnvironment({
      DATABASE_URL: "postgresql://courtlink:courtlink@localhost:5433/courtlink",
      REDIS_URL: "redis://localhost:6379",
      SESSION_SECRET: "12345678901234567890123456789012",
      ENCRYPTION_KEY: "12345678901234567890123456789012",
    });

    expect(environment.GOOGLE_OAUTH_ENABLED).toBe(false);
  });

  it("requires complete Google configuration when OAuth is enabled", () => {
    const base = {
      DATABASE_URL: "postgresql://courtlink:courtlink@localhost:5433/courtlink",
      REDIS_URL: "redis://localhost:6379",
      SESSION_SECRET: "12345678901234567890123456789012",
      ENCRYPTION_KEY: "12345678901234567890123456789012",
      GOOGLE_OAUTH_ENABLED: "true",
    };

    expect(() => parseEnvironment(base)).toThrow(
      "Invalid environment configuration: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI",
    );
    const environment = parseEnvironment({
      ...base,
      GOOGLE_CLIENT_ID: "google-client-id.apps.googleusercontent.com",
      GOOGLE_CLIENT_SECRET: "google-client-secret",
      GOOGLE_REDIRECT_URI: "https://courtlink.example/api/v1/auth/google/callback",
    });
    expect(environment.GOOGLE_OAUTH_ENABLED).toBe(true);
    expect(environment.GOOGLE_REDIRECT_URI).toContain("/auth/google/callback");
  });
});
