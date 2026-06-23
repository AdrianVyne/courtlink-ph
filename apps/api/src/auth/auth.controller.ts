import { Body, Controller, Get, HttpCode, Inject, Post, Query, Req, Res } from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { z } from "zod";
// biome-ignore lint/style/useImportType: AccountSecurityService is injected by Nest at runtime.
import { AccountSecurityService } from "./account-security.service.js";
// biome-ignore lint/style/useImportType: AuthService is injected by Nest at runtime.
import { AuthService, type SessionUser } from "./auth.service.js";
// biome-ignore lint/style/useImportType: GoogleOAuthService is injected by Nest at runtime.
import { GoogleOAuthError, GoogleOAuthService } from "./google-oauth.service.js";
import {
  type AuthenticatedRequest,
  Public,
  SESSION_COOKIE_NAME,
  extractSessionCookie,
  getSessionUser,
} from "./session.guard.js";
import { APP_BASE_URL, SECURE_COOKIES } from "./tokens.js";

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
const googleStartSchema = z.object({ returnTo: z.string().max(500).optional() });
const googleCallbackSchema = z
  .object({
    code: z.string().min(1).max(4_096).optional(),
    state: z.string().min(1).max(512),
    error: z.string().min(1).max(200).optional(),
  })
  .refine((input) => Boolean(input.code || input.error), { message: "code or error is required" });

export type RegisterRequest = z.infer<typeof registerSchema>;
export type LoginRequest = z.infer<typeof loginSchema>;

export interface CookieReply {
  header(name: string, value: string): void;
}

export interface RedirectReply extends CookieReply {
  redirect(url: string, statusCode?: number): unknown;
}

@Controller({ path: "auth", version: "1" })
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly accountSecurity: AccountSecurityService,
    private readonly googleOAuth: GoogleOAuthService,
    @Inject(SECURE_COOKIES) private readonly secureCookies: boolean,
    @Inject(APP_BASE_URL) private readonly appBaseUrl: string,
  ) {}

  @Public()
  @Get("google/start")
  async googleStart(@Query() query: unknown, @Res() reply: FastifyReply | RedirectReply) {
    const input = googleStartSchema.parse(query);
    const { url } = await this.googleOAuth.start(input.returnTo);
    return reply.redirect(url, 302);
  }

  @Public()
  @Get("google/callback")
  async googleCallback(@Query() query: unknown, @Res() reply: FastifyReply | RedirectReply) {
    const input = googleCallbackSchema.parse(query);
    if (input.error) {
      await this.googleOAuth.abandon(input.state);
      return reply.redirect(
        this.webUrl(`/login?oauthError=${encodeURIComponent(input.error)}`),
        302,
      );
    }
    try {
      const result = await this.googleOAuth.complete(input.code ?? "", input.state);
      reply.header(
        "Set-Cookie",
        this.formatSessionCookie(result.session.token, result.session.expiresAt),
      );
      return reply.redirect(this.webUrl(result.returnTo), 302);
    } catch (error) {
      if (error instanceof GoogleOAuthError) {
        return reply.redirect(
          this.webUrl(`/login?oauthError=${encodeURIComponent(error.code)}`),
          302,
        );
      }
      throw error;
    }
  }

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

  private webUrl(path: string): string {
    return `${this.appBaseUrl.replace(/\/$/, "")}${path}`;
  }
}
