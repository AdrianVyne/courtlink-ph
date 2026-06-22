import { performance } from "node:perf_hooks";
import type { FastifyInstance } from "fastify";
import {
  CORRELATION_ID,
  type CorrelatedRequest,
  resolveCorrelationId,
  safeRequestPath,
} from "./correlation.js";

export type RequestLogWriter = (event: Record<string, unknown>) => void;

export function registerRequestObservability(app: FastifyInstance, log: RequestLogWriter): void {
  const startedAt = new WeakMap<object, number>();

  app.addHook("onRequest", async (request, reply) => {
    const correlationId = resolveCorrelationId(request.headers["x-correlation-id"]);
    (request as CorrelatedRequest)[CORRELATION_ID] = correlationId;
    startedAt.set(request, performance.now());
    void reply.header("x-correlation-id", correlationId);
  });

  app.addHook("onResponse", async (request, reply) => {
    const start = startedAt.get(request) ?? performance.now();
    log({
      event: "request.completed",
      correlationId: (request as CorrelatedRequest)[CORRELATION_ID],
      method: request.method,
      path: safeRequestPath(request.url),
      statusCode: reply.statusCode,
      durationMs: Math.max(0, Math.round((performance.now() - start) * 100) / 100),
    });
  });
}
