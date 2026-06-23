import { PlatformRole, type PrismaClient } from "@courtlink/database";
import type {
  GoogleOAuthAttempt,
  GoogleOAuthIdentity,
  GoogleOAuthRepository,
} from "./google-oauth.service.js";

function isUniqueConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2002"
  );
}

export class PrismaGoogleOAuthRepository implements GoogleOAuthRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createAttempt(attempt: GoogleOAuthAttempt): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.googleOAuthAttempt.deleteMany({ where: { expiresAt: { lte: new Date() } } }),
      this.prisma.googleOAuthAttempt.create({ data: attempt }),
    ]);
  }

  async consumeAttempt(stateHash: string, now: Date): Promise<GoogleOAuthAttempt | null> {
    return this.prisma.$transaction(async (transaction) => {
      const attempt = await transaction.googleOAuthAttempt.findUnique({ where: { stateHash } });
      if (!attempt || attempt.expiresAt <= now) {
        await transaction.googleOAuthAttempt.deleteMany({ where: { stateHash } });
        return null;
      }
      const deleted = await transaction.googleOAuthAttempt.deleteMany({
        where: { stateHash, expiresAt: { gt: now } },
      });
      if (deleted.count !== 1) return null;
      return {
        stateHash: attempt.stateHash,
        codeVerifier: attempt.codeVerifier,
        nonce: attempt.nonce,
        returnTo: attempt.returnTo,
        expiresAt: attempt.expiresAt,
      };
    });
  }

  async findOrCreateUser(identity: GoogleOAuthIdentity, now: Date) {
    try {
      return await this.linkIdentity(identity, now);
    } catch (error) {
      if (!isUniqueConflict(error)) throw error;
      return this.linkIdentity(identity, now);
    }
  }

  private async linkIdentity(identity: GoogleOAuthIdentity, now: Date) {
    return this.prisma.$transaction(async (transaction) => {
      const linked = await transaction.oAuthAccount.findUnique({
        where: {
          provider_providerAccountId: {
            provider: "google",
            providerAccountId: identity.subject,
          },
        },
        include: { user: true },
      });
      if (linked) return { id: linked.user.id, status: linked.user.status };

      let user = await transaction.user.findUnique({ where: { email: identity.email } });
      if (user) {
        if (!user.emailVerifiedAt) {
          user = await transaction.user.update({
            where: { id: user.id },
            data: { emailVerifiedAt: now },
          });
        }
      } else {
        user = await transaction.user.create({
          data: {
            email: identity.email,
            displayName: identity.displayName,
            emailVerifiedAt: now,
            roles: { create: { role: PlatformRole.PLAYER } },
          },
        });
      }

      await transaction.oAuthAccount.create({
        data: {
          userId: user.id,
          provider: "google",
          providerAccountId: identity.subject,
        },
      });
      return { id: user.id, status: user.status };
    });
  }
}
