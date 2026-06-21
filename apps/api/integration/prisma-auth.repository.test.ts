import { PrismaPg } from "@prisma/adapter-pg";
import { PlatformRole, PrismaClient } from "@courtlink/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AuthService } from "../src/auth/auth.service.js";
import { PasswordHasher } from "../src/auth/password-hasher.js";
import { PrismaAuthRepository } from "../src/auth/prisma-auth.repository.js";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required for API integration tests");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.session.deleteMany();
  await prisma.userPlatformRole.deleteMany();
  await prisma.passwordCredential.deleteMany();
  await prisma.user.deleteMany({ where: { email: { endsWith: "@auth.integration.test" } } });
  await prisma.$disconnect();
});

describe("PrismaAuthRepository", () => {
  it("atomically persists a registered player and session", async () => {
    const repository = new PrismaAuthRepository(prisma);
    const service = new AuthService(repository, new PasswordHasher());
    const email = `player-${crypto.randomUUID()}@auth.integration.test`;

    const user = await service.register({
      email,
      displayName: "Database Player",
      password: "a-long-player-password",
    });
    await service.login({
      email,
      password: "a-long-player-password",
      now: new Date("2026-06-21T00:00:00.000Z"),
    });

    const persisted = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { credentials: true, roles: true, sessions: true },
    });
    expect(persisted.credentials?.passwordHash.startsWith("$argon2id$")).toBe(true);
    expect(persisted.roles.map(({ role }) => role)).toEqual([PlatformRole.PLAYER]);
    expect(persisted.sessions).toHaveLength(1);
  });
});
