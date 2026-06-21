import { describe, expect, it, vi } from "vitest";
import { AuthService, type CreateAuthUserInput, type UserAuthRepository } from "./auth.service.js";
import { PasswordHasher } from "./password-hasher.js";
import { AuthController, type CookieReply } from "./auth.controller.js";

function createController(): AuthController {
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
  return new AuthController(new AuthService(repository, new PasswordHasher()), false);
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
});
