import type { PrismaClient } from "@courtlink/database";
import type {
  AccountSecurityRepository,
  SecurityUser,
  VerificationTokenRecord,
} from "./account-security.service.js";

export class PrismaAccountSecurityRepository implements AccountSecurityRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findUserByEmail(email: string): Promise<SecurityUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { credentials: true },
    });
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      emailVerifiedAt: user.emailVerifiedAt,
      passwordHash: user.credentials?.passwordHash ?? "",
      status: user.status,
    };
  }

  async findUserById(id: string): Promise<SecurityUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { credentials: true },
    });
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      emailVerifiedAt: user.emailVerifiedAt,
      passwordHash: user.credentials?.passwordHash ?? "",
      status: user.status,
    };
  }

  async createToken(input: {
    email: string;
    tokenHash: string;
    purpose: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.prisma.verificationToken.create({
      data: {
        email: input.email,
        tokenHash: input.tokenHash,
        purpose: input.purpose,
        expiresAt: input.expiresAt,
      },
    });
  }

  async findToken(
    tokenHash: string,
    purpose: string,
    now: Date,
  ): Promise<VerificationTokenRecord | null> {
    const row = await this.prisma.verificationToken.findUnique({ where: { tokenHash } });
    if (!row || row.purpose !== purpose || row.expiresAt <= now) return null;
    return { email: row.email, purpose: row.purpose, expiresAt: row.expiresAt };
  }

  async deleteTokensFor(email: string, purpose: string): Promise<void> {
    await this.prisma.verificationToken.deleteMany({ where: { email, purpose } });
  }

  async markEmailVerified(email: string, when: Date): Promise<void> {
    await this.prisma.user.update({
      where: { email },
      data: { emailVerifiedAt: when },
    });
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await this.prisma.passwordCredential.update({
      where: { userId },
      data: { passwordHash },
    });
  }

  async revokeAllSessions(userId: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { userId } });
  }
}
