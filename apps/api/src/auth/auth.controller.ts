import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import { z } from "zod";
// biome-ignore lint/style/useImportType: AuthService is required as a runtime value for Nest DI.
import { AuthService } from "./auth.service.js";

const SESSION_COOKIE = "courtlink_session";

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
    private readonly secureCookies: boolean,
  ) {}

  @Post("register")
  @HttpCode(201)
  async register(@Body() body: unknown) {
    const input = registerSchema.parse(body);
    return this.authService.register(input);
  }

  @Post("login")
  @HttpCode(200)
  async login(@Body() body: unknown, reply: CookieReply, now: Date = new Date()) {
    const input = loginSchema.parse(body);
    const session = await this.authService.login({ ...input, now });
    reply.header("Set-Cookie", this.formatSessionCookie(session.token, session.expiresAt));
    return { expiresAt: session.expiresAt.toISOString() };
  }

  private formatSessionCookie(token: string, expiresAt: Date): string {
    const parts = [
      `${SESSION_COOKIE}=${token}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      `Expires=${expiresAt.toUTCString()}`,
    ];
    if (this.secureCookies) parts.push("Secure");
    return parts.join("; ");
  }
}
