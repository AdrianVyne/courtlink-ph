import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { registerRequestObservability } from "./request-observability.js";

describe("registerRequestObservability", () => {
  it("returns a correlation ID and logs a query-free completion event", async () => {
    const events: Record<string, unknown>[] = [];
    const app = Fastify();
    registerRequestObservability(app, (event) => events.push(event));
    app.get("/courts", async () => ({ ok: true }));

    const response = await app.inject({
      method: "GET",
      url: "/courts?email=private@example.com",
      headers: { "x-correlation-id": "e652a326-5f5a-46df-bbad-c771b18c3f9f" },
    });

    expect(response.headers["x-correlation-id"]).toBe("e652a326-5f5a-46df-bbad-c771b18c3f9f");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      event: "request.completed",
      method: "GET",
      path: "/courts",
      statusCode: 200,
      correlationId: "e652a326-5f5a-46df-bbad-c771b18c3f9f",
    });
    expect(JSON.stringify(events[0])).not.toContain("private@example.com");
    expect(events[0]?.durationMs).toEqual(expect.any(Number));
    await app.close();
  });

  it("never logs request bodies", async () => {
    const log = vi.fn();
    const app = Fastify();
    registerRequestObservability(app, log);
    app.post("/proof", async () => ({ ok: true }));

    await app.inject({ method: "POST", url: "/proof", payload: { transactionRef: "private" } });

    expect(JSON.stringify(log.mock.calls)).not.toContain("private");
    await app.close();
  });
});
