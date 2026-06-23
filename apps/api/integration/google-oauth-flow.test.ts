import { PrismaPg } from "@prisma/adapter-pg";
import { PlatformRole, PrismaClient } from "@courtlink/database";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaAccountSecurityRepository } from "../src/auth/prisma-account-security.repository.js";
import { PrismaGoogleOAuthRepository } from "../src/auth/prisma-google-oauth.repository.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString)
  throw new Error("DATABASE_URL is required for Google OAuth integration tests");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const repository = new PrismaGoogleOAuthRepository(prisma);
const TEST_EMAIL = { endsWith: "@google-oauth.integration.test" } as const;

beforeAll(async () => prisma.$connect());
beforeEach(cleanup);
afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

async function cleanup() {
  await prisma.googleOAuthAttempt.deleteMany();
  await prisma.oAuthAccount.deleteMany({ where: { user: { email: TEST_EMAIL } } });
  await prisma.session.deleteMany({ where: { user: { email: TEST_EMAIL } } });
  await prisma.userPlatformRole.deleteMany({ where: { user: { email: TEST_EMAIL } } });
  await prisma.passwordCredential.deleteMany({ where: { user: { email: TEST_EMAIL } } });
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
}

describe("PrismaGoogleOAuthRepository", () => {
  it("consumes an unexpired attempt exactly once", async () => {
    const attempt = {
      stateHash: crypto.randomUUID().replaceAll("-", ""),
      codeVerifier: "short-lived-verifier",
      nonce: "short-lived-nonce",
      returnTo: "/dashboard",
      expiresAt: new Date("2026-06-23T00:10:00.000Z"),
    };
    await repository.createAttempt(attempt);

    await expect(
      repository.consumeAttempt(attempt.stateHash, new Date("2026-06-23T00:01:00.000Z")),
    ).resolves.toEqual(attempt);
    await expect(
      repository.consumeAttempt(attempt.stateHash, new Date("2026-06-23T00:02:00.000Z")),
    ).resolves.toBeNull();
  });

  it("reuses a provider subject before email and links a new subject to verified email", async () => {
    const suffix = crypto.randomUUID();
    const original = await prisma.user.create({
      data: {
        email: `original-${suffix}@google-oauth.integration.test`,
        displayName: "Original Account",
        status: "ACTIVE",
        roles: { create: { role: PlatformRole.COACH } },
        oauthAccounts: {
          create: { provider: "google", providerAccountId: `subject-${suffix}` },
        },
      },
    });
    const emailOwner = await prisma.user.create({
      data: {
        email: `email-owner-${suffix}@google-oauth.integration.test`,
        displayName: "Email Owner",
        status: "ACTIVE",
        roles: { create: { role: PlatformRole.PLAYER } },
      },
    });

    const subjectResult = await repository.findOrCreateUser(
      {
        subject: `subject-${suffix}`,
        email: emailOwner.email,
        emailVerified: true,
        displayName: "Changed Google Name",
      },
      new Date("2026-06-23T00:00:00.000Z"),
    );
    const emailResult = await repository.findOrCreateUser(
      {
        subject: `new-subject-${suffix}`,
        email: emailOwner.email,
        emailVerified: true,
        displayName: "Changed Google Name",
      },
      new Date("2026-06-23T00:00:00.000Z"),
    );

    expect(subjectResult.id).toBe(original.id);
    expect(emailResult.id).toBe(emailOwner.id);
    const persistedOwner = await prisma.user.findUniqueOrThrow({ where: { id: emailOwner.id } });
    expect(persistedOwner.displayName).toBe("Email Owner");
    expect(persistedOwner.emailVerifiedAt).toEqual(new Date("2026-06-23T00:00:00.000Z"));
  });

  it("creates one player and one provider link across concurrent callbacks", async () => {
    const suffix = crypto.randomUUID();
    const identity = {
      subject: `concurrent-subject-${suffix}`,
      email: `concurrent-${suffix}@google-oauth.integration.test`,
      emailVerified: true,
      displayName: "Concurrent Player",
    };

    const results = await Promise.all([
      repository.findOrCreateUser(identity, new Date("2026-06-23T00:00:00.000Z")),
      repository.findOrCreateUser(identity, new Date("2026-06-23T00:00:00.000Z")),
    ]);

    expect(new Set(results.map(({ id }) => id)).size).toBe(1);
    const users = await prisma.user.findMany({
      where: { email: identity.email },
      include: { roles: true, oauthAccounts: true },
    });
    expect(users).toHaveLength(1);
    expect(users[0]?.roles.map(({ role }) => role)).toEqual([PlatformRole.PLAYER]);
    expect(users[0]?.oauthAccounts).toHaveLength(1);
  });

  it("lets an OAuth-only user establish a password credential", async () => {
    const user = await prisma.user.create({
      data: {
        email: `${crypto.randomUUID()}@google-oauth.integration.test`,
        displayName: "OAuth Only Player",
        roles: { create: { role: PlatformRole.PLAYER } },
      },
    });
    const security = new PrismaAccountSecurityRepository(prisma);

    await security.updatePassword(user.id, "new-password-hash");

    await expect(
      prisma.passwordCredential.findUnique({ where: { userId: user.id } }),
    ).resolves.toMatchObject({ passwordHash: "new-password-hash" });
  });
});
