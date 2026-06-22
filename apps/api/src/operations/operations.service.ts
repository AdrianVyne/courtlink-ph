import { ServiceUnavailableException } from "@nestjs/common";
import { buildCapacityAssessment, type CapacityAssessment } from "./capacity-policy.js";

export interface QueueSnapshot {
  name: string;
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
}

export interface FailedJobSummary {
  queue: string;
  id: string;
  name: string;
  attemptsMade: number;
  failedAt: string | null;
  error: string;
}

export interface RawOperationsSnapshot {
  dependencies: { database: boolean; redis: boolean };
  process: {
    heapUsedBytes: number;
    heapLimitBytes: number;
    eventLoopDelayMs: number;
    uptimeSeconds: number;
  };
  database: { usedBytes: number; budgetBytes: number };
  redis: { usedBytes: number; maxBytes: number };
  queues: QueueSnapshot[];
  failedJobs: FailedJobSummary[];
  capturedAt: string;
}

export type OperationsStatus = RawOperationsSnapshot & CapacityAssessment;

export interface OperationsProbe {
  checkDatabase(): Promise<boolean>;
  checkRedis(): Promise<boolean>;
  snapshot(): Promise<RawOperationsSnapshot>;
  close(): Promise<void>;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("operation timed out")), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export class OperationsService {
  constructor(
    private readonly probe: OperationsProbe,
    private readonly readinessTimeoutMs = 2_000,
  ) {}

  async readiness(): Promise<{ status: "ready"; service: "courtlink-api" }> {
    try {
      const [database, redis] = await withTimeout(
        Promise.all([this.probe.checkDatabase(), this.probe.checkRedis()]),
        this.readinessTimeoutMs,
      );
      if (!database || !redis) throw new Error("dependency unavailable");
      return { status: "ready", service: "courtlink-api" };
    } catch {
      throw new ServiceUnavailableException({
        code: "SERVICE_NOT_READY",
        message: "Service temporarily unavailable",
      });
    }
  }

  async status(): Promise<OperationsStatus> {
    const snapshot = await this.probe.snapshot();
    const assessment = buildCapacityAssessment({
      heapUsedBytes: snapshot.process.heapUsedBytes,
      heapLimitBytes: snapshot.process.heapLimitBytes,
      eventLoopDelayMs: snapshot.process.eventLoopDelayMs,
      databaseBytes: snapshot.database.usedBytes,
      databaseBudgetBytes: snapshot.database.budgetBytes,
      redisUsedBytes: snapshot.redis.usedBytes,
      redisMaxBytes: snapshot.redis.maxBytes,
      failedJobs: snapshot.queues.reduce((total, queue) => total + queue.failed, 0),
    });
    return { ...snapshot, ...assessment };
  }
}
