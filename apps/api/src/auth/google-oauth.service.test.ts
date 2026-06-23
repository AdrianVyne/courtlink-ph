import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { IssuedSession } from "./auth.service.js";
import {
  GoogleOAuthError,
  GoogleOAuthService,
  type GoogleOAuthAttempt,
  type GoogleOAuthIdentity,
  type GoogleOAuthProvider,
  type GoogleOAuthRepository,
  normalizeReturnTo,
} from "./google-oauth.service.js";

class FakeRepository implements GoogleOAuthRepository {
  attempt: GoogleOAuthAttempt | null = null;
  linkedIdentity: GoogleOAuthIdentity | null = null;
  linkedUser: { id: string; status: "ACTIVE" | "SUSPENDED" | "DELETED" } = {
    id: "user-1",
    status: "ACTIVE",
  };

  async createAttempt(attempt: GoogleOAuthAttempt): Promise<void> {
    this.attempt = attempt;
  }

  async consumeAttempt(stateHash: string, now: Date): Promise<GoogleOAuthAttempt | null> {
    if (!this.attempt || this.attempt.stateHash !== stateHash || this.attempt.expiresAt <= now) {
      return null;
    }
    const attempt = this.attempt;
    this.attempt = null;
    return attempt;
  }

  async findOrCreateUser(identity: GoogleOAuthIdentity, _now: Date) {
    this.linkedIdentity = identity;
    return this.linkedUser;
  }
}

class FakeProvider implements GoogleOAuthProvider {
  authorizationInput: Parameters<GoogleOAuthProvider["authorizationUrl"]>[0] | null = null;
  exchangeInput: Parameters<GoogleOAuthProvider["exchangeCode"]>[0] | null = null;
  identity: GoogleOAuthIdentity = {
    subject: "google-subject-1",
    email: "player@example.com",
    emailVerified: true,
    displayName: "Alex Player",
  };

  authorizationUrl(input: Parameters<GoogleOAuthProvider["authorizationUrl"]>[0]): string {
    this.authorizationInput = input;
    return "https://accounts.google.com/o/oauth2/v2/auth?state=opaque";
  }

  async exchangeCode(input: Parameters<GoogleOAuthProvider["exchangeCode"]>[0]) {
    this.exchangeInput = input;
    return this.identity;
  }
}

function createService(enabled = true) {
  const repository = new FakeRepository();
  const provider = new FakeProvider();
  const issued: Array<{ userId: string; now: Date }> = [];
  const session = {
    issueSession: async (userId: string, now: Date): Promise<IssuedSession> => {
      issued.push({ userId, now });
      return { token: "courtlink-session", expiresAt: new Date("2026-07-23T00:00:00.000Z") };
    },
  };
  const randomValues = ["state-token", "nonce-token", "pkce-verifier"];
  const service = new GoogleOAuthService(
    repository,
    provider,
    session,
    { enabled, redirectUri: "https://courtlink.example/api/v1/auth/google/callback" },
    () => randomValues.shift() ?? "unexpected-random-value",
  );
  return { service, repository, provider, issued };
}

describe("normalizeReturnTo", () => {
  it("keeps local paths and rejects absolute or protocol-relative redirects", () => {
    expect(normalizeReturnTo("/coach?tab=offers")).toBe("/coach?tab=offers");
    expect(normalizeReturnTo("https://evil.example/phish")).toBe("/dashboard");
    expect(normalizeReturnTo("//evil.example/phish")).toBe("/dashboard");
    expect(normalizeReturnTo("/\\evil.example/phish")).toBe("/dashboard");
    expect(normalizeReturnTo("dashboard")).toBe("/dashboard");
  });
});

describe("GoogleOAuthService", () => {
  it("rejects start while Google OAuth is disabled", async () => {
    const { service } = createService(false);

    await expect(service.start("/dashboard", new Date())).rejects.toEqual(
      new GoogleOAuthError("GOOGLE_OAUTH_DISABLED", "Google sign-in is not configured"),
    );
  });

  it("stores a hashed one-time state and sends PKCE plus nonce to Google", async () => {
    const { service, repository, provider } = createService();
    const now = new Date("2026-06-23T00:00:00.000Z");

    const result = await service.start("/coach?tab=offers", now);

    expect(result.url).toContain("accounts.google.com");
    expect(repository.attempt).toEqual({
      stateHash: createHash("sha256").update("state-token").digest("hex"),
      codeVerifier: "pkce-verifier",
      nonce: "nonce-token",
      returnTo: "/coach?tab=offers",
      expiresAt: new Date("2026-06-23T00:10:00.000Z"),
    });
    expect(provider.authorizationInput).toEqual({
      state: "state-token",
      nonce: "nonce-token",
      codeChallenge: createHash("sha256").update("pkce-verifier").digest("base64url"),
    });
  });

  it("consumes the attempt, verifies identity, links the user, and issues a CourtLink session", async () => {
    const { service, provider, repository, issued } = createService();
    const now = new Date("2026-06-23T00:00:00.000Z");
    await service.start("/dashboard", now);

    const completed = await service.complete(
      "authorization-code",
      "state-token",
      new Date("2026-06-23T00:01:00.000Z"),
    );

    expect(provider.exchangeInput).toEqual({
      code: "authorization-code",
      codeVerifier: "pkce-verifier",
      expectedNonce: "nonce-token",
    });
    expect(repository.linkedIdentity).toEqual(provider.identity);
    expect(issued).toEqual([{ userId: "user-1", now: new Date("2026-06-23T00:01:00.000Z") }]);
    expect(completed).toEqual({
      session: {
        token: "courtlink-session",
        expiresAt: new Date("2026-07-23T00:00:00.000Z"),
      },
      returnTo: "/dashboard",
    });
    await expect(
      service.complete("another-code", "state-token", new Date("2026-06-23T00:02:00.000Z")),
    ).rejects.toMatchObject({ code: "GOOGLE_OAUTH_STATE_INVALID" });
  });

  it("rejects unverified or incomplete Google identities before linking", async () => {
    const { service, provider, repository } = createService();
    await service.start("/dashboard", new Date("2026-06-23T00:00:00.000Z"));
    provider.identity = { ...provider.identity, emailVerified: false };

    await expect(
      service.complete("authorization-code", "state-token", new Date("2026-06-23T00:01:00.000Z")),
    ).rejects.toMatchObject({ code: "GOOGLE_OAUTH_IDENTITY_INVALID" });
    expect(repository.linkedIdentity).toBeNull();
  });

  it("rejects suspended linked users", async () => {
    const { service, repository } = createService();
    await service.start("/dashboard", new Date("2026-06-23T00:00:00.000Z"));
    repository.linkedUser = { id: "user-1", status: "SUSPENDED" };

    await expect(
      service.complete("authorization-code", "state-token", new Date("2026-06-23T00:01:00.000Z")),
    ).rejects.toMatchObject({ code: "GOOGLE_ACCOUNT_UNAVAILABLE" });
  });
});
