import { describe, expect, it } from "vitest";
import {
  AuthenticationError,
  AuthService,
  type AuthUser,
  type CreateAuthUserInput,
  type SessionRecord,
  type SessionUser,
  type UserAuthRepository,
  hashSessionToken,
} from "./auth.service.js";
import { PasswordHasher } from "./password-hasher.js";

class InMemoryAuthRepository implements UserAuthRepository {
  readonly users: AuthUser[] = [];
  readonly sessions: SessionRecord[] = [];
  readonly roles = new Map<string, SessionUser["roles"]>();

  async findByEmail(email: string): Promise<AuthUser | null> {
    return this.users.find((user) => user.email === email) ?? null;
  }

  async createPlayer(input: CreateAuthUserInput): Promise<AuthUser> {
    const user = { id: `user-${this.users.length + 1}`, status: "ACTIVE" as const, ...input };
    this.users.push(user);
    this.roles.set(user.id, ["PLAYER"]);
    return user;
  }

  async createSession(session: SessionRecord): Promise<void> {
    this.sessions.push(session);
  }

  async findSessionUser(tokenHash: string, now: Date): Promise<SessionUser | null> {
    const session = this.sessions.find(
      (record) => record.tokenHash === tokenHash && record.expiresAt > now,
    );
    if (!session) return null;
    const user = this.users.find((entry) => entry.id === session.userId);
    if (user?.status !== "ACTIVE") return null;
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      roles: this.roles.get(user.id) ?? [],
    };
  }

  async deleteSession(tokenHash: string): Promise<void> {
    const index = this.sessions.findIndex((session) => session.tokenHash === tokenHash);
    if (index >= 0) this.sessions.splice(index, 1);
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

  it("issues the same opaque session type for a previously authenticated user id", async () => {
    const repository = new InMemoryAuthRepository();
    const service = new AuthService(repository, new PasswordHasher());
    const user = await service.register({
      email: "player@example.com",
      displayName: "Alex Player",
      password: "a-long-player-password",
    });

    const session = await service.issueSession(user.id, new Date("2026-06-23T00:00:00.000Z"));

    expect(session.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(session.expiresAt).toEqual(new Date("2026-07-23T00:00:00.000Z"));
    expect(repository.sessions[0]?.userId).toBe(user.id);
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

  it("resolves an unexpired session into the user with platform roles", async () => {
    const repository = new InMemoryAuthRepository();
    const service = new AuthService(repository, new PasswordHasher());
    await service.register({
      email: "player@example.com",
      displayName: "Alex Player",
      password: "a-long-player-password",
    });
    const session = await service.login({
      email: "player@example.com",
      password: "a-long-player-password",
      now: new Date("2026-06-21T00:00:00.000Z"),
    });

    const user = await service.resolveSession(session.token, new Date("2026-07-01T00:00:00.000Z"));

    expect(user).toEqual({
      id: "user-1",
      email: "player@example.com",
      displayName: "Alex Player",
      roles: ["PLAYER"],
    });
  });

  it("rejects expired or revoked sessions", async () => {
    const repository = new InMemoryAuthRepository();
    const service = new AuthService(repository, new PasswordHasher());
    await service.register({
      email: "player@example.com",
      displayName: "Alex Player",
      password: "a-long-player-password",
    });
    const session = await service.login({
      email: "player@example.com",
      password: "a-long-player-password",
      now: new Date("2026-06-21T00:00:00.000Z"),
    });

    const expired = await service.resolveSession(
      session.token,
      new Date("2026-08-01T00:00:00.000Z"),
    );
    expect(expired).toBeNull();

    await service.revokeSession(session.token);
    const revoked = await service.resolveSession(
      session.token,
      new Date("2026-06-22T00:00:00.000Z"),
    );
    expect(revoked).toBeNull();
  });

  it("derives a deterministic session token hash", () => {
    expect(hashSessionToken("token-1")).toBe(hashSessionToken("token-1"));
    expect(hashSessionToken("token-1")).not.toBe(hashSessionToken("token-2"));
  });
});
