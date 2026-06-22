import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@courtlink/database";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AccountSecurityService } from "../src/auth/account-security.service.js";
import { PrismaAccountSecurityRepository } from "../src/auth/prisma-account-security.repository.js";
import { PasswordHasher } from "../src/auth/password-hasher.js";
import type { EmailMessage, EmailSender } from "../src/notifications/notification.service.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required for account security tests");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

class CaptureEmail implements EmailSender {
  sent: EmailMessage[] = [];
  async send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
  }
}

function buildService(email: EmailSender) {
  return new AccountSecurityService(
    new PrismaAccountSecurityRepository(prisma),
    email,
    new PasswordHasher(),
    "https://app.test",
  );
}

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await cleanup();
});

async function cleanup() {
  await prisma.verificationToken.deleteMany({ where: { email: { endsWith: "@security.test" } } });
  await prisma.session.deleteMany({
    where: { user: { email: { endsWith: "@security.test" } } },
  });
  await prisma.passwordCredential.deleteMany({
    where: { user: { email: { endsWith: "@security.test" } } },
  });
  await prisma.user.deleteMany({ where: { email: { endsWith: "@security.test" } } });
}

async function createUser(password: string) {
  const hasher = new PasswordHasher();
  const passwordHash = await hasher.hash(password);
  return prisma.user.create({
    data: {
      email: `user-${crypto.randomUUID()}@security.test`,
      displayName: "Security Tester",
      credentials: { create: { passwordHash } },
    },
  });
}

describe("Email verification flow", () => {
  it("verifies a user from an issued token and is idempotent against reuse", async () => {
    const email = new CaptureEmail();
    const service = buildService(email);
    const user = await createUser("a-long-player-password");

    const token = await service.requestEmailVerification(user.id);
    await service.verifyEmail(token);

    const verified = await prisma.user.findUnique({ where: { id: user.id } });
    expect(verified?.emailVerifiedAt).not.toBeNull();

    await expect(service.verifyEmail(token)).rejects.toMatchObject({
      code: "VERIFICATION_TOKEN_INVALID",
    });
  });
});

describe("Password reset flow", () => {
  it("resets the password, invalidates sessions, and consumes the token", async () => {
    const email = new CaptureEmail();
    const service = buildService(email);
    const user = await createUser("the-original-password");
    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: `sec-${crypto.randomUUID()}`,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    const token = await service.requestPasswordReset(user.email);
    if (!token) throw new Error("expected a reset token");

    await service.resetPassword(token, "a-fresh-strong-password");

    const credential = await prisma.passwordCredential.findUnique({ where: { userId: user.id } });
    const hasher = new PasswordHasher();
    expect(await hasher.verify(credential?.passwordHash ?? "", "a-fresh-strong-password")).toBe(
      true,
    );
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
    await expect(service.resetPassword(token, "another-strong-password")).rejects.toMatchObject({
      code: "RESET_TOKEN_INVALID",
    });
  });

  it("does not issue a token for an unknown email", async () => {
    const email = new CaptureEmail();
    const service = buildService(email);
    const token = await service.requestPasswordReset("nobody@security.test");
    expect(token).toBeNull();
    expect(email.sent).toHaveLength(0);
  });
});
