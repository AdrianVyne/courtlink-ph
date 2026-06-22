import { describe, expect, it } from "vitest";
import {
  AccountSecurityError,
  AccountSecurityService,
  type AccountSecurityRepository,
  type VerificationTokenRecord,
} from "./account-security.service.js";
import type { EmailMessage, EmailSender } from "../notifications/notification.service.js";
import type { PasswordHasher } from "./password-hasher.js";

interface UserRow {
  id: string;
  email: string;
  emailVerifiedAt: Date | null;
  passwordHash: string;
  status: "ACTIVE" | "SUSPENDED" | "DELETED";
}

class InMemoryRepo implements AccountSecurityRepository {
  users: UserRow[] = [];
  tokens: (VerificationTokenRecord & { tokenHash: string })[] = [];
  revokedSessionsFor: string[] = [];

  async findUserByEmail(email: string): Promise<UserRow | null> {
    return this.users.find((u) => u.email === email) ?? null;
  }
  async findUserById(id: string): Promise<UserRow | null> {
    return this.users.find((u) => u.id === id) ?? null;
  }
  async createToken(input: {
    email: string;
    tokenHash: string;
    purpose: string;
    expiresAt: Date;
  }): Promise<void> {
    this.tokens.push({
      email: input.email,
      tokenHash: input.tokenHash,
      purpose: input.purpose,
      expiresAt: input.expiresAt,
    });
  }
  async findToken(
    tokenHash: string,
    purpose: string,
    now: Date,
  ): Promise<VerificationTokenRecord | null> {
    const row = this.tokens.find(
      (t) => t.tokenHash === tokenHash && t.purpose === purpose && t.expiresAt > now,
    );
    return row ?? null;
  }
  async deleteTokensFor(email: string, purpose: string): Promise<void> {
    this.tokens = this.tokens.filter((t) => !(t.email === email && t.purpose === purpose));
  }
  async markEmailVerified(email: string, when: Date): Promise<void> {
    const user = this.users.find((u) => u.email === email);
    if (user) user.emailVerifiedAt = when;
  }
  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    const user = this.users.find((u) => u.id === userId);
    if (user) user.passwordHash = passwordHash;
  }
  async revokeAllSessions(userId: string): Promise<void> {
    this.revokedSessionsFor.push(userId);
  }
}

class FakeEmail implements EmailSender {
  sent: EmailMessage[] = [];
  async send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
  }
}

const hasher: PasswordHasher = {
  hash: async (password: string) => `hashed:${password}`,
  verify: async (stored: string, password: string) => stored === `hashed:${password}`,
} as unknown as PasswordHasher;

function build() {
  const repo = new InMemoryRepo();
  const email = new FakeEmail();
  const service = new AccountSecurityService(repo, email, hasher, "https://app.test");
  return { repo, email, service };
}

const now = new Date("2026-06-22T00:00:00.000Z");

describe("email verification", () => {
  it("issues a token and emails a verification link", async () => {
    const { repo, email, service } = build();
    repo.users.push({
      id: "u1",
      email: "p@test",
      emailVerifiedAt: null,
      passwordHash: "hashed:x",
      status: "ACTIVE",
    });

    await service.requestEmailVerification("u1", now);

    expect(repo.tokens).toHaveLength(1);
    expect(repo.tokens[0]?.purpose).toBe("EMAIL_VERIFICATION");
    expect(email.sent[0]?.to).toBe("p@test");
    expect(email.sent[0]?.text).toContain("https://app.test/verify-email?token=");
  });

  it("verifies a valid token and marks the user verified", async () => {
    const { repo, service } = build();
    repo.users.push({
      id: "u1",
      email: "p@test",
      emailVerifiedAt: null,
      passwordHash: "hashed:x",
      status: "ACTIVE",
    });
    const token = await service.requestEmailVerification("u1", now);

    await service.verifyEmail(token, now);

    expect(repo.users[0]?.emailVerifiedAt).toEqual(now);
    expect(repo.tokens).toHaveLength(0);
  });

  it("rejects an invalid verification token", async () => {
    const { service } = build();
    await expect(service.verifyEmail("bogus", now)).rejects.toBeInstanceOf(AccountSecurityError);
  });

  it("rejects an expired verification token", async () => {
    const { repo, service } = build();
    repo.users.push({
      id: "u1",
      email: "p@test",
      emailVerifiedAt: null,
      passwordHash: "hashed:x",
      status: "ACTIVE",
    });
    const token = await service.requestEmailVerification("u1", now);
    const later = new Date(now.getTime() + 25 * 60 * 60 * 1000);
    await expect(service.verifyEmail(token, later)).rejects.toBeInstanceOf(AccountSecurityError);
  });
});

describe("password reset", () => {
  it("issues a reset token and emails a link without revealing existence", async () => {
    const { repo, email, service } = build();
    repo.users.push({
      id: "u1",
      email: "p@test",
      emailVerifiedAt: now,
      passwordHash: "hashed:old",
      status: "ACTIVE",
    });

    await service.requestPasswordReset("p@test", now);
    expect(repo.tokens[0]?.purpose).toBe("PASSWORD_RESET");
    expect(email.sent[0]?.text).toContain("https://app.test/reset-password?token=");
  });

  it("does not throw or email for an unknown address", async () => {
    const { email, service } = build();
    await service.requestPasswordReset("missing@test", now);
    expect(email.sent).toHaveLength(0);
  });

  it("resets the password, clears the token, and revokes sessions", async () => {
    const { repo, service } = build();
    repo.users.push({
      id: "u1",
      email: "p@test",
      emailVerifiedAt: now,
      passwordHash: "hashed:old",
      status: "ACTIVE",
    });
    const token = await service.requestPasswordReset("p@test", now);
    if (!token) throw new Error("expected a reset token");

    await service.resetPassword(token, "a-brand-new-password", now);

    expect(repo.users[0]?.passwordHash).toBe("hashed:a-brand-new-password");
    expect(repo.tokens).toHaveLength(0);
    expect(repo.revokedSessionsFor).toContain("u1");
  });

  it("rejects an invalid reset token", async () => {
    const { service } = build();
    await expect(
      service.resetPassword("bogus", "a-brand-new-password", now),
    ).rejects.toBeInstanceOf(AccountSecurityError);
  });
});
