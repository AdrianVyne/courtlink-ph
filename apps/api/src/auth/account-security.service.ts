import { createHash, randomBytes } from "node:crypto";
import type { EmailSender } from "../notifications/notification.service.js";
import type { PasswordHasher } from "./password-hasher.js";

export const EMAIL_VERIFICATION_PURPOSE = "EMAIL_VERIFICATION";
export const PASSWORD_RESET_PURPOSE = "PASSWORD_RESET";

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
const MIN_PASSWORD_LENGTH = 12;

export type AccountSecurityErrorCode =
  | "VERIFICATION_TOKEN_INVALID"
  | "RESET_TOKEN_INVALID"
  | "PASSWORD_TOO_SHORT"
  | "USER_NOT_FOUND";

export class AccountSecurityError extends Error {
  constructor(
    readonly code: AccountSecurityErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AccountSecurityError";
  }
}

export interface SecurityUser {
  id: string;
  email: string;
  emailVerifiedAt: Date | null;
  passwordHash: string;
  status: "ACTIVE" | "SUSPENDED" | "DELETED";
}

export interface VerificationTokenRecord {
  email: string;
  purpose: string;
  expiresAt: Date;
}

export interface AccountSecurityRepository {
  findUserByEmail(email: string): Promise<SecurityUser | null>;
  findUserById(id: string): Promise<SecurityUser | null>;
  createToken(input: {
    email: string;
    tokenHash: string;
    purpose: string;
    expiresAt: Date;
  }): Promise<void>;
  findToken(tokenHash: string, purpose: string, now: Date): Promise<VerificationTokenRecord | null>;
  deleteTokensFor(email: string, purpose: string): Promise<void>;
  markEmailVerified(email: string, when: Date): Promise<void>;
  updatePassword(userId: string, passwordHash: string): Promise<void>;
  revokeAllSessions(userId: string): Promise<void>;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export class AccountSecurityService {
  constructor(
    private readonly repository: AccountSecurityRepository,
    private readonly email: EmailSender,
    private readonly passwordHasher: PasswordHasher,
    private readonly appBaseUrl: string,
  ) {}

  async requestEmailVerification(userId: string, now: Date = new Date()): Promise<string> {
    const user = await this.repository.findUserById(userId);
    if (!user) throw new AccountSecurityError("USER_NOT_FOUND", "Account not found");
    return this.issueEmailVerification(user.email, now);
  }

  async requestEmailVerificationByEmail(email: string, now: Date = new Date()): Promise<void> {
    const normalized = normalizeEmail(email);
    const user = await this.repository.findUserByEmail(normalized);
    if (!user || user.emailVerifiedAt) return;
    await this.issueEmailVerification(normalized, now);
  }

  private async issueEmailVerification(email: string, now: Date): Promise<string> {
    await this.repository.deleteTokensFor(email, EMAIL_VERIFICATION_PURPOSE);
    const token = randomBytes(32).toString("base64url");
    await this.repository.createToken({
      email,
      tokenHash: hashToken(token),
      purpose: EMAIL_VERIFICATION_PURPOSE,
      expiresAt: new Date(now.getTime() + EMAIL_VERIFICATION_TTL_MS),
    });
    const link = `${this.appBaseUrl}/verify-email?token=${token}`;
    await this.email.send({
      to: email,
      subject: "Verify your CourtLink PH email",
      text: `Confirm your email to finish setting up your account: ${link}`,
    });
    return token;
  }

  async verifyEmail(token: string, now: Date = new Date()): Promise<void> {
    const record = await this.repository.findToken(
      hashToken(token),
      EMAIL_VERIFICATION_PURPOSE,
      now,
    );
    if (!record) {
      throw new AccountSecurityError(
        "VERIFICATION_TOKEN_INVALID",
        "Verification link is invalid or has expired",
      );
    }
    await this.repository.markEmailVerified(record.email, now);
    await this.repository.deleteTokensFor(record.email, EMAIL_VERIFICATION_PURPOSE);
  }

  async requestPasswordReset(email: string, now: Date = new Date()): Promise<string | null> {
    const normalized = normalizeEmail(email);
    const user = await this.repository.findUserByEmail(normalized);
    if (!user || user.status !== "ACTIVE") return null;

    await this.repository.deleteTokensFor(normalized, PASSWORD_RESET_PURPOSE);
    const token = randomBytes(32).toString("base64url");
    await this.repository.createToken({
      email: normalized,
      tokenHash: hashToken(token),
      purpose: PASSWORD_RESET_PURPOSE,
      expiresAt: new Date(now.getTime() + PASSWORD_RESET_TTL_MS),
    });
    const link = `${this.appBaseUrl}/reset-password?token=${token}`;
    await this.email.send({
      to: normalized,
      subject: "Reset your CourtLink PH password",
      text: `Reset your password using this link: ${link}`,
    });
    return token;
  }

  async resetPassword(token: string, newPassword: string, now: Date = new Date()): Promise<void> {
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      throw new AccountSecurityError(
        "PASSWORD_TOO_SHORT",
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      );
    }
    const record = await this.repository.findToken(hashToken(token), PASSWORD_RESET_PURPOSE, now);
    if (!record) {
      throw new AccountSecurityError(
        "RESET_TOKEN_INVALID",
        "Password reset link is invalid or has expired",
      );
    }
    const user = await this.repository.findUserByEmail(record.email);
    if (!user) {
      throw new AccountSecurityError("RESET_TOKEN_INVALID", "Account not found");
    }
    const passwordHash = await this.passwordHasher.hash(newPassword);
    await this.repository.updatePassword(user.id, passwordHash);
    await this.repository.deleteTokensFor(record.email, PASSWORD_RESET_PURPOSE);
    await this.repository.revokeAllSessions(user.id);
  }
}
