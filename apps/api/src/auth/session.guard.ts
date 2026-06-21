import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { FastifyRequest } from "fastify";
import { AuthService, type SessionUser } from "./auth.service.js";

export const SESSION_COOKIE_NAME = "courtlink_session";
export const SESSION_USER_KEY = Symbol("courtlink.session.user");
export const PUBLIC_ROUTE_KEY = "courtlink.public";

export interface AuthenticatedRequest extends FastifyRequest {
  [SESSION_USER_KEY]?: SessionUser;
}

export const Public = (): MethodDecorator & ClassDecorator => {
  return (target: object, propertyKey?: string | symbol, descriptor?: PropertyDescriptor) => {
    if (descriptor && typeof propertyKey !== "undefined") {
      Reflect.defineMetadata(PUBLIC_ROUTE_KEY, true, descriptor.value);
    } else {
      Reflect.defineMetadata(PUBLIC_ROUTE_KEY, true, target);
    }
  };
};

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const cookieHeader = request.headers.cookie ?? "";
    const token = extractSessionCookie(cookieHeader);
    if (!token) throw new UnauthorizedException({ code: "AUTH_REQUIRED" });

    const user = await this.authService.resolveSession(token);
    if (!user) throw new UnauthorizedException({ code: "AUTH_REQUIRED" });

    request[SESSION_USER_KEY] = user;
    return true;
  }
}

export function extractSessionCookie(header: string): string | null {
  for (const part of header.split(/;\s*/)) {
    const [name, ...valueParts] = part.split("=");
    if (name === SESSION_COOKIE_NAME && valueParts.length > 0) {
      return valueParts.join("=");
    }
  }
  return null;
}

export function getSessionUser(request: AuthenticatedRequest): SessionUser {
  const user = request[SESSION_USER_KEY];
  if (!user) throw new UnauthorizedException({ code: "AUTH_REQUIRED" });
  return user;
}
