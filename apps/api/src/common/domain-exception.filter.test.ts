import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { DomainExceptionFilter } from "./domain-exception.filter.js";

function makeHost() {
  const send = vi.fn();
  const status = vi.fn(() => ({ send }));
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as never;
  return { host, status, send };
}

describe("DomainExceptionFilter", () => {
  it("maps coded domain errors to their HTTP status", () => {
    const filter = new DomainExceptionFilter();
    const { host, status, send } = makeHost();

    filter.catch({ code: "AUTH_INVALID_CREDENTIALS", message: "bad" }, host);

    expect(status).toHaveBeenCalledWith(401);
    expect(send).toHaveBeenCalledWith({ code: "AUTH_INVALID_CREDENTIALS", message: "bad" });
  });

  it("defaults unknown coded errors to 400", () => {
    const filter = new DomainExceptionFilter();
    const { host, status } = makeHost();

    filter.catch({ code: "QUOTE_NO_PRICING_RULE", message: "no rule" }, host);

    expect(status).toHaveBeenCalledWith(400);
  });

  it("passes through Nest HttpExceptions", () => {
    const filter = new DomainExceptionFilter();
    const { host, status } = makeHost();

    filter.catch(new ForbiddenException({ code: "SUPER_ADMIN_REQUIRED" }), host);

    expect(status).toHaveBeenCalledWith(403);
  });

  it("maps Zod validation errors to 400", () => {
    const filter = new DomainExceptionFilter();
    const { host, status, send } = makeHost();
    let zodError: unknown;
    try {
      z.object({ email: z.string().email() }).parse({ email: "nope" });
    } catch (error) {
      zodError = error;
    }

    filter.catch(zodError, host);

    expect(status).toHaveBeenCalledWith(400);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ code: "VALIDATION_ERROR" }));
  });

  it("falls back to a stable 500 for unexpected errors", () => {
    const filter = new DomainExceptionFilter();
    const { host, status, send } = makeHost();

    filter.catch(new Error("boom"), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(send).toHaveBeenCalledWith({ code: "INTERNAL", message: "Internal server error" });
  });
});
