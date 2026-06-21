import { PlatformRole, type PrismaClient } from "@courtlink/database";
import type {
  AuthUser,
  CreateAuthUserInput,
  SessionRecord,
  SessionUser,
  UserAuthRepository,
} from "./auth.service.js";

export class PrismaAuthRepository implements UserAuthRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByEmail(email: string): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { credentials: true },
    });

    if (!user?.credentials) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      passwordHash: user.credentials.passwordHash,
      status: user.status,
    };
  }

  async createPlayer(input: CreateAuthUserInput): Promise<AuthUser> {
    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        displayName: input.displayName,
        credentials: { create: { passwordHash: input.passwordHash } },
        roles: { create: { role: PlatformRole.PLAYER } },
      },
      include: { credentials: true },
    });

    if (!user.credentials) {
      throw new Error("AUTH_CREDENTIAL_PERSISTENCE_FAILED");
    }

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      passwordHash: user.credentials.passwordHash,
      status: user.status,
    };
  }

  async createSession(session: SessionRecord): Promise<void> {
    await this.prisma.session.create({ data: session });
  }

  async findSessionUser(tokenHash: string, now: Date): Promise<SessionUser | null> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: { user: { include: { roles: true } } },
    });

    if (!session || session.expiresAt <= now) return null;
    const { user } = session;
    if (user.status !== "ACTIVE") return null;

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      roles: user.roles.map((entry) => entry.role) as SessionUser["roles"],
    };
  }

  async deleteSession(tokenHash: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { tokenHash } });
  }
}
