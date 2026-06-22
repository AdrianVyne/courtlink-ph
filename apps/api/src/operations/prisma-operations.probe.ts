import { monitorEventLoopDelay } from "node:perf_hooks";
import { getHeapStatistics } from "node:v8";
import type { PrismaClient } from "@courtlink/database";
import { Queue } from "bullmq";
import type { Redis } from "ioredis";
import type {
  OperationsProbe,
  QueueSnapshot,
  RawOperationsSnapshot,
} from "./operations.service.js";

const QUEUE_NAMES = [
  "court.holds.expiry",
  "court.reviews.escalation",
  "bookings.completion",
] as const;

export function sanitizeFailureReason(reason: string): string {
  const redacted = reason
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[REDACTED]")
    .replace(/https?:\/\/\S+/gi, "[REDACTED]")
    .replace(
      /\b(password|secret|token|cookie|authorization|transaction|proof)\b\s*[:=]\s*\S+/gi,
      "$1=[REDACTED]",
    );
  return redacted.length > 200 ? `${redacted.slice(0, 200)}...` : redacted;
}

export function parseRedisMemoryInfo(info: string): { usedBytes: number; maxBytes: number } {
  const values = new Map(
    info
      .split(/\r?\n/)
      .filter((line) => line.includes(":"))
      .map((line) => {
        const [key = "", value = "0"] = line.split(":", 2);
        return [key, Number(value)] as const;
      }),
  );
  return {
    usedBytes: values.get("used_memory") ?? 0,
    maxBytes: values.get("maxmemory") ?? 0,
  };
}

export class PrismaOperationsProbe implements OperationsProbe {
  private readonly queues: Queue[];
  private readonly eventLoop = monitorEventLoopDelay({ resolution: 20 });

  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
    private readonly databaseBudgetBytes: number,
  ) {
    this.queues = QUEUE_NAMES.map((name) => new Queue(name, { connection: redis }));
    this.eventLoop.enable();
  }

  async checkDatabase(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  async checkRedis(): Promise<boolean> {
    try {
      return (await this.redis.ping()) === "PONG";
    } catch {
      return false;
    }
  }

  async snapshot(): Promise<RawOperationsSnapshot> {
    const [databaseReady, redisReady, databaseRows, redisInfo, queueResults] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.prisma.$queryRaw<Array<{ usedBytes: bigint }>>`
        SELECT pg_database_size(current_database()) AS "usedBytes"
      `,
      this.redis.info("memory"),
      Promise.all(
        this.queues.map(async (queue) => ({
          snapshot: await this.queueSnapshot(queue),
          failedJobs: await this.failedJobSummaries(queue),
        })),
      ),
    ]);
    const memory = process.memoryUsage();
    const redis = parseRedisMemoryInfo(redisInfo);
    const eventLoopDelayMs = Number.isFinite(this.eventLoop.mean)
      ? this.eventLoop.mean / 1_000_000
      : 0;
    this.eventLoop.reset();

    return {
      dependencies: { database: databaseReady, redis: redisReady },
      process: {
        heapUsedBytes: memory.heapUsed,
        heapLimitBytes: getHeapStatistics().heap_size_limit,
        eventLoopDelayMs: Math.round(eventLoopDelayMs * 100) / 100,
        uptimeSeconds: Math.round(process.uptime()),
      },
      database: {
        usedBytes: Number(databaseRows[0]?.usedBytes ?? 0n),
        budgetBytes: this.databaseBudgetBytes,
      },
      redis,
      queues: queueResults.map((result) => result.snapshot),
      failedJobs: queueResults.flatMap((result) => result.failedJobs),
      capturedAt: new Date().toISOString(),
    };
  }

  async close(): Promise<void> {
    this.eventLoop.disable();
    await Promise.all(this.queues.map((queue) => queue.close()));
    await this.redis.quit();
  }

  private async queueSnapshot(queue: Queue): Promise<QueueSnapshot> {
    const counts = await queue.getJobCounts("waiting", "active", "delayed", "failed");
    return {
      name: queue.name,
      waiting: counts.waiting ?? 0,
      active: counts.active ?? 0,
      delayed: counts.delayed ?? 0,
      failed: counts.failed ?? 0,
    };
  }

  private async failedJobSummaries(queue: Queue) {
    const jobs = await queue.getFailed(0, 4);
    return jobs.map((job) => ({
      queue: queue.name,
      id: job.id ?? "unknown",
      name: job.name,
      attemptsMade: job.attemptsMade,
      failedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
      error: sanitizeFailureReason(job.failedReason || "Background job failed"),
    }));
  }
}
