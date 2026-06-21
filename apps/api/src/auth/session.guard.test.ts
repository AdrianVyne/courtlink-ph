import "reflect-metadata";
import { Reflector } from "@nestjs/core";
import { describe, expect, it, vi } from "vitest";
import { AuthService } from "./auth.service.js";
import { PasswordHasher } from "./password-hasher.js";
import {
  PUBLIC_ROUTE_KEY,
  Public,
  SESSION_USER_KEY,
  SessionGuard,
  extractSessionCookie,
} from "./session.guard.js";

class PublicHandler {
  @Public()
  run() {}
}

function makeContext(cookieHeader: string | undefined, handler: object = () => {}) {
  const request = { headers: { cookie: cookieHeader } } as Record<string, unknown> & {
    [SESSION_USER_KEY]?: unknown;
  };
  return {
    request,
    context: {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => handler,
      getClass: () => PublicHandler,
    } as unknown as Parameters<SessionGuard["canActivate"]>[0],
  };
}

describe("SessionGuard", () => {
  it("extracts the session cookie value from a multi-cookie header", () => {
    expect(extractSessionCookie("a=1; courtlink_session=abc; b=2")).toBe("abc");
    expect(extractSessionCookie("a=1; b=2")).toBeNull();
  });

  it("skips authentication for public routes", async () => {
    const reflector = new Reflector();
    const guard = new SessionGuard({} as AuthService, reflector);
    const handler = Reflect.getMetadata(PUBLIC_ROUTE_KEY, new PublicHandler().run.bind({}))
      ? new PublicHandler().run
      : (() => {
          const fn = function publicFn() {};
          Reflect.defineMetadata(PUBLIC_ROUTE_KEY, true, fn);
          return fn;
        })();
    const ctx = makeContext(undefined, handler);

    await expect(guard.canActivate(ctx.context)).resolves.toBe(true);
  });

  it("rejects requests without a session cookie", async () => {
    const reflector = new Reflector();
    const auth = new AuthService(
      {
        findByEmail: async () => null,
        createPlayer: async () => {
          throw new Error("not used");
        },
        createSession: async () => {},
        findSessionUser: async () => null,
        deleteSession: async () => {},
      },
      new PasswordHasher(),
    );
    const guard = new SessionGuard(auth, reflector);

    await expect(guard.canActivate(makeContext(undefined).context)).rejects.toMatchObject({
      response: { code: "AUTH_REQUIRED" },
    });
  });

  it("attaches the resolved session user to the request", async () => {
    const reflector = new Reflector();
    const auth = {
      resolveSession: vi.fn().mockResolvedValue({
        id: "user-1",
        email: "player@example.com",
        displayName: "Alex",
        roles: ["PLAYER"],
      }),
    } as unknown as AuthService;
    const guard = new SessionGuard(auth, reflector);
    const { context, request } = makeContext("courtlink_session=opaque");

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(auth.resolveSession).toHaveBeenCalledWith("opaque");
    expect(request[SESSION_USER_KEY]).toEqual({
      id: "user-1",
      email: "player@example.com",
      displayName: "Alex",
      roles: ["PLAYER"],
    });
  });
});
