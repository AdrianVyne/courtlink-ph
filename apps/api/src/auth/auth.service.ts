import { createHash, randomBytes } from "node:crypto";
import type { PasswordHasher } from "./password-hasher.js";

const sessionLifetimeMilliseconds = 30 * 24 * 60 * 60 * 1000;

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  status: "ACTIVE" | "SUSPENDED" | "DELETED";
}

export interface CreateAuthUserInput {
  email: string;
  displayName: string;
  passwordHash: string;
}

export interface SessionRecord {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface UserAuthRepository {
  findByEmail(email: string): Promise<AuthUser | null>;
  createPlayer(input: CreateAuthUserInput): Promise<AuthUser>;
  createSession(session: SessionRecord): Promise<void>;
}

export interface RegisterInput {
  email: string;
  displayName: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
  now: Date;
}

export interface PublicAuthUser {
  id: string;
  email: string;
  displayName: string;
}

export interface IssuedSession {
  token: string;
  expiresAt: Date;
}

export class AuthenticationError extends Error {
  readonly code = "AUTH_INVALID_CREDENTIALS";

  constructor() {
    super("Invalid email or password");
    this.name = "AuthenticationError";
  }
}

export class AuthService {
  constructor(
    private readonly repository: UserAuthRepository,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async register(input: RegisterInput): Promise<PublicAuthUser> {
    const email = normalizeEmail(input.email);
    const passwordHash = await this.passwordHasher.hash(input.password);
    const user = await this.repository.createPlayer({
      email,
      displayName: input.displayName.trim(),
      passwordHash,
    });

    return { id: user.id, email: user.email, displayName: user.displayName };
  }

  async login(input: LoginInput): Promise<IssuedSession> {
    const user = await this.repository.findByEmail(normalizeEmail(input.email));

    if (!user) {
      await this.passwordHasher.hash(input.password);
      throw new AuthenticationError();
    }

    const valid = await this.passwordHasher.verify(user.passwordHash, input.password);
    if (!valid || user.status !== "ACTIVE") {
      throw new AuthenticationError();
    }

    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(input.now.getTime() + sessionLifetimeMilliseconds);
    await this.repository.createSession({
      userId: user.id,
      tokenHash: createHash("sha256").update(token).digest("hex"),
      expiresAt,
    });

    return { token, expiresAt };
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
