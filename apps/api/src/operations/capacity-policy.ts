export type OperationalLevel = "ok" | "warning" | "critical";

export interface CapacityInput {
  heapUsedBytes: number;
  heapLimitBytes: number;
  eventLoopDelayMs: number;
  databaseBytes: number;
  databaseBudgetBytes: number;
  redisUsedBytes: number;
  redisMaxBytes: number;
  failedJobs: number;
}

export interface CapacityAlert {
  code: string;
  level: Exclude<OperationalLevel, "ok">;
  message: string;
}

export interface CapacityAssessment {
  overall: OperationalLevel;
  alerts: CapacityAlert[];
  metrics: {
    processHeapRatio: number;
    eventLoopDelayMs: number;
    databaseRatio: number;
    redisRatio: number | null;
    failedJobs: number;
  };
}

const LEVEL_WEIGHT: Record<OperationalLevel, number> = { ok: 0, warning: 1, critical: 2 };

export function classifyRatio(value: number, warning = 0.7, critical = 0.85): OperationalLevel {
  if (value >= critical) return "critical";
  if (value >= warning) return "warning";
  return "ok";
}

export function classifyCount(value: number, warning = 1, critical = 10): OperationalLevel {
  if (value >= critical) return "critical";
  if (value >= warning) return "warning";
  return "ok";
}

function ratio(used: number, limit: number): number {
  return limit > 0 ? Math.max(0, used / limit) : 0;
}

function addAlert(
  alerts: CapacityAlert[],
  resource: string,
  level: OperationalLevel,
  message: string,
): void {
  if (level === "ok") return;
  alerts.push({ code: `${resource}_${level.toUpperCase()}`, level, message });
}

export function buildCapacityAssessment(input: CapacityInput): CapacityAssessment {
  const processHeapRatio = ratio(input.heapUsedBytes, input.heapLimitBytes);
  const databaseRatio = ratio(input.databaseBytes, input.databaseBudgetBytes);
  const redisRatio =
    input.redisMaxBytes > 0 ? ratio(input.redisUsedBytes, input.redisMaxBytes) : null;
  const heapLevel = classifyRatio(processHeapRatio);
  const eventLoopLevel = classifyCount(input.eventLoopDelayMs, 100, 500);
  const databaseLevel = classifyRatio(databaseRatio);
  const redisLevel = redisRatio === null ? "ok" : classifyRatio(redisRatio);
  const queueLevel = classifyCount(input.failedJobs);
  const alerts: CapacityAlert[] = [];

  addAlert(alerts, "PROCESS_HEAP", heapLevel, "API process heap usage is elevated.");
  addAlert(alerts, "EVENT_LOOP", eventLoopLevel, "API event-loop delay is elevated.");
  addAlert(alerts, "DATABASE_CAPACITY", databaseLevel, "PostgreSQL database usage is elevated.");
  addAlert(alerts, "REDIS_MEMORY", redisLevel, "Redis memory usage is elevated.");
  addAlert(alerts, "QUEUE_FAILURES", queueLevel, "Background jobs require operator review.");

  const levels = [heapLevel, eventLoopLevel, databaseLevel, redisLevel, queueLevel];
  const overall = levels.reduce<OperationalLevel>(
    (highest, level) => (LEVEL_WEIGHT[level] > LEVEL_WEIGHT[highest] ? level : highest),
    "ok",
  );

  return {
    overall,
    alerts,
    metrics: {
      processHeapRatio,
      eventLoopDelayMs: input.eventLoopDelayMs,
      databaseRatio,
      redisRatio,
      failedJobs: input.failedJobs,
    },
  };
}
