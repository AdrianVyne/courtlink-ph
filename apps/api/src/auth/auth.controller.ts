import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res } from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { z } from "zod";
// biome-ignore lint/style/useImportType: AuthService is required as a runtime value for Nest DI.
import { AccountSecurityService } from "./account-security.service.js";
import { AuthService, type SessionUser } from "./auth.service.js";
import {
  type AuthenticatedRequest,
  Public,
  SESSION_COOKIE_NAME,
  extractSessionCookie,
  getSessionUser,
} from "./session.guard.js";
import { SECURE_COOKIES } from "./tokens.js";

const registerSchema = z.object({
  email: z.string().email().max(254),
  displayName: z.string().trim().min(1).max(120),
  password: z.string().min(12).max(256),
});

const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(256),
});

const requestVerificationSchema = z.object({ email: z.string().email().max(254) });
const verifyEmailSchema = z.object({ token: z.string().min(10).max(256) });
const requestResetSchema = z.object({ email: z.string().email().max(254) });
const resetPasswordSchema = z.object({
  token: z.string().min(10).max(256),
  password: z.string().min(12).max(256),
});

export type RegisterRequest = z.infer<typeof registerSchema>;
export type LoginRequest = z.infer<typeof loginSchema>;

export interface CookieReply {
  header(name: string, value: string): void;
}

@Controller({ path: "auth", version: "1" })
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly accountSecurity: AccountSecurityService,
    @Inject(SECURE_COOKIES) private readonly secureCookies: boolean,
  ) {}

  @Public()
  @Post("register")
  @HttpCode(201)
  async register(@Body() body: unknown) {
    const input = registerSchema.parse(body);
    const user = await this.authService.register(input);
    await this.accountSecurity.requestEmailVerification(user.id);
    return user;
  }

  @Public()
  @Post("email/verification/request")
  @HttpCode(202)
  async requestEmailVerification(@Body() body: unknown) {
    const input = requestVerificationSchema.parse(body);
    await this.accountSecurity.requestEmailVerificationByEmail(input.email);
    return { status: "accepted" };
  }

  @Public()
  @Post("email/verify")
  @HttpCode(200)
  async verifyEmail(@Body() body: unknown) {
    const input = verifyEmailSchema.parse(body);
    await this.accountSecurity.verifyEmail(input.token);
    return { status: "verified" };
  }

  @Public()
  @Post("password/reset/request")
  @HttpCode(202)
  async requestPasswordReset(@Body() body: unknown) {
    const input = requestResetSchema.parse(body);
    await this.accountSecurity.requestPasswordReset(input.email);
    return { status: "accepted" };
  }

  @Public()
  @Post("password/reset")
  @HttpCode(200)
  async resetPassword(@Body() body: unknown) {
    const input = resetPasswordSchema.parse(body);
    await this.accountSecurity.resetPassword(input.token, input.password);
    return { status: "reset" };
  }

  @Public()
  @Post("login")
  @HttpCode(200)
  async login(
    @Body() body: unknown,
    @Res({ passthrough: true }) reply: FastifyReply | CookieReply,
  ) {
    const input = loginSchema.parse(body);
    const session = await this.authService.login({ ...input, now: new Date() });
    reply.header("Set-Cookie", this.formatSessionCookie(session.token, session.expiresAt));
    return { expiresAt: session.expiresAt.toISOString() };
  }

  @Post("logout")
  @HttpCode(204)
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) reply: FastifyReply | CookieReply,
  ): Promise<void> {
    const token = extractSessionCookie(request.headers.cookie ?? "");
    if (token) await this.authService.revokeSession(token);
    reply.header("Set-Cookie", this.formatLogoutCookie());
  }

  @Get("me")
  async me(@Req() request: AuthenticatedRequest): Promise<SessionUser> {
    return getSessionUser(request);
  }

  private formatSessionCookie(token: string, expiresAt: Date): string {
    const parts = [
      `${SESSION_COOKIE_NAME}=${token}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      `Expires=${expiresAt.toUTCString()}`,
    ];
    if (this.secureCookies) parts.push("Secure");
    return parts.join("; ");
  }

  private formatLogoutCookie(): string {
    const parts = [`${SESSION_COOKIE_NAME}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
    if (this.secureCookies) parts.push("Secure");
    return parts.join("; ");
  }
}
