import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res } from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { z } from "zod";
// biome-ignore lint/style/useImportType: AuthService is required as a runtime value for Nest DI.
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

export type RegisterRequest = z.infer<typeof registerSchema>;
export type LoginRequest = z.infer<typeof loginSchema>;

export interface CookieReply {
  header(name: string, value: string): void;
}

@Controller({ path: "auth", version: "1" })
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    @Inject(SECURE_COOKIES) private readonly secureCookies: boolean,
  ) {}

  @Public()
  @Post("register")
  @HttpCode(201)
  async register(@Body() body: unknown) {
    const input = registerSchema.parse(body);
    return this.authService.register(input);
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
