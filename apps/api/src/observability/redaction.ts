const SENSITIVE_KEY =
  /(password|secret|token|authorization|cookie|email|phone|proof|transaction|reference|object.?key|access.?key|address|body|payload|headers|query)/i;
const MAX_LOG_STRING = 500;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function redactLogValue(value: unknown, key = ""): unknown {
  if (SENSITIVE_KEY.test(key)) return "[REDACTED]";
  if (typeof value === "string") {
    return value.length > MAX_LOG_STRING ? `${value.slice(0, MAX_LOG_STRING)}...` : value;
  }
  if (Array.isArray(value)) return value.map((item) => redactLogValue(item));
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        redactLogValue(entryValue, entryKey),
      ]),
    );
  }
  return value;
}
