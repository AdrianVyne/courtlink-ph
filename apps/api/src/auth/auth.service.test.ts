import { describe, expect, it } from "vitest";
import {
  AuthenticationError,
  AuthService,
  type AuthUser,
  type CreateAuthUserInput,
  type SessionRecord,
  type UserAuthRepository,
} from "./auth.service.js";
import { PasswordHasher } from "./password-hasher.js";

class InMemoryAuthRepository implements UserAuthRepository {
  readonly users: AuthUser[] = [];
  readonly sessions: SessionRecord[] = [];

  async findByEmail(email: string): Promise<AuthUser | null> {
    return this.users.find((user) => user.email === email) ?? null;
  }

  async createPlayer(input: CreateAuthUserInput): Promise<AuthUser> {
    const user = { id: `user-${this.users.length + 1}`, status: "ACTIVE" as const, ...input };
    this.users.push(user);
    return user;
  }

  async createSession(session: SessionRecord): Promise<void> {
    this.sessions.push(session);
  }
}

describe("AuthService", () => {
  it("normalizes email and creates a player with a hashed password", async () => {
    const repository = new InMemoryAuthRepository();
    const service = new AuthService(repository, new PasswordHasher());

    const user = await service.register({
      email: "  PLAYER@Example.COM ",
      displayName: "Alex Player",
      password: "a-long-player-password",
    });

    expect(user).toEqual({ id: "user-1", email: "player@example.com", displayName: "Alex Player" });
    expect(repository.users[0]?.passwordHash).not.toBe("a-long-player-password");
  });

  it("issues an opaque session for valid credentials", async () => {
    const repository = new InMemoryAuthRepository();
    const service = new AuthService(repository, new PasswordHasher());
    await service.register({
      email: "player@example.com",
      displayName: "Alex Player",
      password: "a-long-player-password",
    });

    const session = await service.login({
      email: "PLAYER@example.com",
      password: "a-long-player-password",
      now: new Date("2026-06-21T00:00:00.000Z"),
    });

    expect(session.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(session.expiresAt).toEqual(new Date("2026-07-21T00:00:00.000Z"));
    expect(repository.sessions).toHaveLength(1);
    expect(repository.sessions[0]?.tokenHash).not.toBe(session.token);
  });

  it("uses the same error for an unknown email and a wrong password", async () => {
    const repository = new InMemoryAuthRepository();
    const service = new AuthService(repository, new PasswordHasher());
    await service.register({
      email: "player@example.com",
      displayName: "Alex Player",
      password: "a-long-player-password",
    });

    const unknown = service.login({
      email: "unknown@example.com",
      password: "a-long-player-password",
      now: new Date(),
    });
    const incorrect = service.login({
      email: "player@example.com",
      password: "incorrect-password",
      now: new Date(),
    });

    await Promise.all([
      expect(unknown).rejects.toEqual(new AuthenticationError()),
      expect(incorrect).rejects.toEqual(new AuthenticationError()),
    ]);
  });
});
