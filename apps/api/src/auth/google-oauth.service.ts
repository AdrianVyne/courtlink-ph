import { createHash, randomBytes } from "node:crypto";
import type { IssuedSession } from "./auth.service.js";

const ATTEMPT_TTL_MS = 10 * 60 * 1000;

export type GoogleOAuthErrorCode =
  | "GOOGLE_OAUTH_DISABLED"
  | "GOOGLE_OAUTH_STATE_INVALID"
  | "GOOGLE_OAUTH_IDENTITY_INVALID"
  | "GOOGLE_ACCOUNT_UNAVAILABLE";

export class GoogleOAuthError extends Error {
  constructor(
    readonly code: GoogleOAuthErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "GoogleOAuthError";
  }
}

export interface GoogleOAuthAttempt {
  stateHash: string;
  codeVerifier: string;
  nonce: string;
  returnTo: string;
  expiresAt: Date;
}

export interface GoogleOAuthIdentity {
  subject: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
}

export interface GoogleOAuthProvider {
  authorizationUrl(input: { state: string; nonce: string; codeChallenge: string }): string;
  exchangeCode(input: {
    code: string;
    codeVerifier: string;
    expectedNonce: string;
  }): Promise<GoogleOAuthIdentity>;
}

export interface GoogleOAuthRepository {
  createAttempt(attempt: GoogleOAuthAttempt): Promise<void>;
  consumeAttempt(stateHash: string, now: Date): Promise<GoogleOAuthAttempt | null>;
  findOrCreateUser(
    identity: GoogleOAuthIdentity,
    now: Date,
  ): Promise<{ id: string; status: "ACTIVE" | "SUSPENDED" | "DELETED" }>;
}

export interface GoogleOAuthSessionIssuer {
  issueSession(userId: string, now: Date): Promise<IssuedSession>;
}

export interface GoogleOAuthConfiguration {
  enabled: boolean;
  redirectUri: string;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function secureRandomToken(): string {
  return randomBytes(32).toString("base64url");
}

function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function normalizeReturnTo(value: string | undefined): string {
  if (!value?.startsWith("/") || value.startsWith("//")) return "/dashboard";
  const base = new URL("https://courtlink.invalid");
  try {
    const parsed = new URL(value, base);
    if (parsed.origin !== base.origin) return "/dashboard";
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/dashboard";
  }
}

export class GoogleOAuthService {
  constructor(
    private readonly repository: GoogleOAuthRepository,
    private readonly provider: GoogleOAuthProvider,
    private readonly sessions: GoogleOAuthSessionIssuer,
    private readonly configuration: GoogleOAuthConfiguration,
    private readonly randomToken: () => string = secureRandomToken,
  ) {}

  async start(returnTo: string | undefined, now: Date = new Date()): Promise<{ url: string }> {
    this.assertEnabled();
    const state = this.randomToken();
    const nonce = this.randomToken();
    const codeVerifier = this.randomToken();
    await this.repository.createAttempt({
      stateHash: sha256(state),
      codeVerifier,
      nonce,
      returnTo: normalizeReturnTo(returnTo),
      expiresAt: new Date(now.getTime() + ATTEMPT_TTL_MS),
    });
    return {
      url: this.provider.authorizationUrl({
        state,
        nonce,
        codeChallenge: pkceChallenge(codeVerifier),
      }),
    };
  }

  async complete(
    code: string,
    state: string,
    now: Date = new Date(),
  ): Promise<{ session: IssuedSession; returnTo: string }> {
    this.assertEnabled();
    const attempt = await this.repository.consumeAttempt(sha256(state), now);
    if (!attempt) {
      throw new GoogleOAuthError(
        "GOOGLE_OAUTH_STATE_INVALID",
        "Google sign-in request is invalid or expired",
      );
    }
    const identity = await this.provider.exchangeCode({
      code,
      codeVerifier: attempt.codeVerifier,
      expectedNonce: attempt.nonce,
    });
    const normalizedIdentity = this.validateIdentity(identity);
    const user = await this.repository.findOrCreateUser(normalizedIdentity, now);
    if (user.status !== "ACTIVE") {
      throw new GoogleOAuthError(
        "GOOGLE_ACCOUNT_UNAVAILABLE",
        "This CourtLink account is unavailable",
      );
    }
    return {
      session: await this.sessions.issueSession(user.id, now),
      returnTo: attempt.returnTo,
    };
  }

  async abandon(state: string, now: Date = new Date()): Promise<void> {
    if (!this.configuration.enabled) return;
    await this.repository.consumeAttempt(sha256(state), now);
  }

  private assertEnabled(): void {
    if (!this.configuration.enabled) {
      throw new GoogleOAuthError("GOOGLE_OAUTH_DISABLED", "Google sign-in is not configured");
    }
  }

  private validateIdentity(identity: GoogleOAuthIdentity): GoogleOAuthIdentity {
    const subject = identity.subject.trim();
    const email = identity.email.trim().toLowerCase();
    if (!subject || !identity.emailVerified || !email.includes("@")) {
      throw new GoogleOAuthError(
        "GOOGLE_OAUTH_IDENTITY_INVALID",
        "Google did not provide a verified identity",
      );
    }
    return {
      subject,
      email,
      emailVerified: true,
      displayName: identity.displayName.trim() || "CourtLink Player",
    };
  }
}
