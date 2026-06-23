import { describe, expect, it } from "vitest";
import { GoogleOAuthClient } from "./google-oauth.client.js";

class FakeOAuth2Client {
  authorizationOptions: Record<string, unknown> | null = null;
  tokenOptions: Record<string, unknown> | null = null;
  verificationOptions: Record<string, unknown> | null = null;
  payload: Record<string, unknown> = {
    sub: "google-subject-1",
    email: "player@example.com",
    email_verified: true,
    name: "Alex Player",
    nonce: "expected-nonce",
  };

  generateAuthUrl(options: Record<string, unknown>): string {
    this.authorizationOptions = options;
    return "https://accounts.google.com/o/oauth2/v2/auth?client_id=client-id";
  }

  async getToken(options: Record<string, unknown>) {
    this.tokenOptions = options;
    return { tokens: { id_token: "verified-id-token" } };
  }

  async verifyIdToken(options: Record<string, unknown>) {
    this.verificationOptions = options;
    return { getPayload: () => this.payload };
  }
}

describe("GoogleOAuthClient", () => {
  it("builds an OpenID authorization URL with state, nonce, and PKCE", () => {
    const client = new FakeOAuth2Client();
    const provider = new GoogleOAuthClient(
      "client-id",
      "client-secret",
      "https://courtlink.example/api/v1/auth/google/callback",
      client as never,
    );

    const url = new URL(
      provider.authorizationUrl({
        state: "state-token",
        nonce: "nonce-token",
        codeChallenge: "pkce-challenge",
      }),
    );

    expect(client.authorizationOptions).toMatchObject({
      access_type: "online",
      scope: ["openid", "email", "profile"],
      state: "state-token",
      code_challenge: "pkce-challenge",
      code_challenge_method: "S256",
    });
    expect(url.searchParams.get("nonce")).toBe("nonce-token");
  });

  it("exchanges the code and returns only a verified identity", async () => {
    const client = new FakeOAuth2Client();
    const provider = new GoogleOAuthClient(
      "client-id",
      "client-secret",
      "https://courtlink.example/api/v1/auth/google/callback",
      client as never,
    );

    await expect(
      provider.exchangeCode({
        code: "authorization-code",
        codeVerifier: "pkce-verifier",
        expectedNonce: "expected-nonce",
      }),
    ).resolves.toEqual({
      subject: "google-subject-1",
      email: "player@example.com",
      emailVerified: true,
      displayName: "Alex Player",
    });
    expect(client.tokenOptions).toMatchObject({
      code: "authorization-code",
      codeVerifier: "pkce-verifier",
      redirect_uri: "https://courtlink.example/api/v1/auth/google/callback",
    });
    expect(client.verificationOptions).toEqual({
      idToken: "verified-id-token",
      audience: "client-id",
    });
  });

  it("rejects a mismatched nonce", async () => {
    const client = new FakeOAuth2Client();
    client.payload.nonce = "different-nonce";
    const provider = new GoogleOAuthClient(
      "client-id",
      "client-secret",
      "https://courtlink.example/api/v1/auth/google/callback",
      client as never,
    );

    await expect(
      provider.exchangeCode({
        code: "authorization-code",
        codeVerifier: "pkce-verifier",
        expectedNonce: "expected-nonce",
      }),
    ).rejects.toMatchObject({ code: "GOOGLE_OAUTH_IDENTITY_INVALID" });
  });
});
