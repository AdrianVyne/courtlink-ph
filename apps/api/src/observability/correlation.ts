import { randomUUID } from "node:crypto";

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const CORRELATION_ID = Symbol("courtlink.correlation.id");

export interface CorrelatedRequest {
  [CORRELATION_ID]?: string;
}

export function resolveCorrelationId(value: unknown): string {
  return typeof value === "string" && UUID_PATTERN.test(value) ? value : randomUUID();
}

export function safeRequestPath(url: string): string {
  return url.split("?", 1)[0] || "/";
}

export function requestCorrelationId(request: unknown): string | undefined {
  return (request as CorrelatedRequest | null)?.[CORRELATION_ID];
}
