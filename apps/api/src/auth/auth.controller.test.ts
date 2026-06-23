import { describe, expect, it, vi } from "vitest";
import { AuthService, type CreateAuthUserInput, type UserAuthRepository } from "./auth.service.js";
import { PasswordHasher } from "./password-hasher.js";
import type { AccountSecurityService } from "./account-security.service.js";
import { AuthController, type CookieReply } from "./auth.controller.js";
import { GoogleOAuthError, type GoogleOAuthService } from "./google-oauth.service.js";

function createController(googleOAuth?: GoogleOAuthService): AuthController {
  const users = new Map<string, Awaited<ReturnType<UserAuthRepository["createPlayer"]>>>();
  const repository: UserAuthRepository = {
    findByEmail: async (email) => users.get(email) ?? null,
    createPlayer: async (input: CreateAuthUserInput) => {
      const user = { id: "user-1", status: "ACTIVE" as const, ...input };
      users.set(user.email, user);
      return user;
    },
    createSession: async () => undefined,
    findSessionUser: async () => null,
    deleteSession: async () => undefined,
  };
  const accountSecurity = {
    requestEmailVerification: async () => "verification-token",
    requestEmailVerificationByEmail: async () => undefined,
    verifyEmail: async () => undefined,
    requestPasswordReset: async () => null,
    resetPassword: async () => undefined,
  } as unknown as AccountSecurityService;
  return new AuthController(
    new AuthService(repository, new PasswordHasher()),
    accountSecurity,
    googleOAuth ??
      ({
        start: async () => ({ url: "https://accounts.google.com/o/oauth2/v2/auth" }),
        complete: async () => ({
          session: {
            token: "google-courtlink-session",
            expiresAt: new Date("2026-07-23T00:00:00.000Z"),
          },
          returnTo: "/dashboard",
        }),
        abandon: async () => undefined,
      } as unknown as GoogleOAuthService),
    false,
    "http://localhost:3000",
  );
}

function redirectReply() {
  const headers = new Map<string, string>();
  const redirects: Array<{ url: string; statusCode: number | undefined }> = [];
  return {
    headers,
    redirects,
    reply: {
      header: (name: string, value: string) => headers.set(name, value),
      redirect: (url: string, statusCode?: number) => {
        redirects.push({ url, statusCode });
        return url;
      },
    },
  };
}

describe("AuthController", () => {
  it("returns only public fields after registration", async () => {
    const controller = createController();

    await expect(
      controller.register({
        email: "player@example.com",
        displayName: "Alex Player",
        password: "a-long-player-password",
      }),
    ).resolves.toEqual({ id: "user-1", email: "player@example.com", displayName: "Alex Player" });
  });

  it("sets an HTTP-only same-site session cookie without returning its token", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-21T00:00:00.000Z"));

    const controller = createController();
    await controller.register({
      email: "player@example.com",
      displayName: "Alex Player",
      password: "a-long-player-password",
    });
    const headers = new Map<string, string>();
    const reply: CookieReply = {
      header: (name, value) => {
        headers.set(name, value);
      },
    };

    const response = await controller.login(
      { email: "player@example.com", password: "a-long-player-password" },
      reply,
    );

    expect(response).toEqual({ expiresAt: "2026-07-21T00:00:00.000Z" });
    expect(JSON.stringify(response)).not.toContain("token");
    expect(headers.get("Set-Cookie")).toMatch(
      /^courtlink_session=[A-Za-z0-9_-]{43}; Path=\/; HttpOnly; SameSite=Lax; Expires=/,
    );
    vi.useRealTimers();
  });

  it("redirects Google start and successful callback without exposing tokens", async () => {
    const start = vi.fn(async () => ({
      url: "https://accounts.google.com/o/oauth2/v2/auth?state=opaque",
    }));
    const complete = vi.fn(async () => ({
      session: {
        token: "google-courtlink-session",
        expiresAt: new Date("2026-07-23T00:00:00.000Z"),
      },
      returnTo: "/coach",
    }));
    const google = { start, complete, abandon: vi.fn() } as unknown as GoogleOAuthService;
    const controller = createController(google);
    const started = redirectReply();
    const completed = redirectReply();

    await controller.googleStart({ returnTo: "/coach" }, started.reply);
    await controller.googleCallback(
      { code: "authorization-code", state: "state-token" },
      completed.reply,
    );

    expect(start).toHaveBeenCalledWith("/coach");
    expect(started.redirects).toEqual([
      {
        url: "https://accounts.google.com/o/oauth2/v2/auth?state=opaque",
        statusCode: 302,
      },
    ]);
    expect(complete).toHaveBeenCalledWith("authorization-code", "state-token");
    expect(completed.redirects).toEqual([{ url: "http://localhost:3000/coach", statusCode: 302 }]);
    expect(completed.headers.get("Set-Cookie")).toContain("HttpOnly");
    expect(JSON.stringify(completed.redirects)).not.toContain("google-courtlink-session");
  });

  it("consumes cancellation state and redirects known failures to safe login errors", async () => {
    const abandon = vi.fn(async () => undefined);
    const complete = vi.fn(async () => {
      throw new GoogleOAuthError(
        "GOOGLE_OAUTH_STATE_INVALID",
        "Google sign-in request is invalid or expired",
      );
    });
    const google = { start: vi.fn(), complete, abandon } as unknown as GoogleOAuthService;
    const controller = createController(google);
    const cancelled = redirectReply();
    const invalid = redirectReply();

    await controller.googleCallback(
      { error: "access_denied", state: "cancelled-state" },
      cancelled.reply,
    );
    await controller.googleCallback(
      { code: "authorization-code", state: "invalid-state" },
      invalid.reply,
    );

    expect(abandon).toHaveBeenCalledWith("cancelled-state");
    expect(cancelled.redirects).toEqual([
      {
        url: "http://localhost:3000/login?oauthError=access_denied",
        statusCode: 302,
      },
    ]);
    expect(invalid.redirects).toEqual([
      {
        url: "http://localhost:3000/login?oauthError=GOOGLE_OAUTH_STATE_INVALID",
        statusCode: 302,
      },
    ]);
  });
});
