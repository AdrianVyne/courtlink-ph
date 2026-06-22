import type { PrismaClient } from "@courtlink/database";
import { Queue, Worker } from "bullmq";
import type { Redis } from "ioredis";
import { SCHEDULED_JOB_OPTIONS } from "./queue-policy.js";

export const IDEMPOTENCY_PRUNE_QUEUE = "idempotency.records.prune";
export const IDEMPOTENCY_RETENTION_MS = 24 * 60 * 60 * 1000;

export interface PruneJobData {
  triggeredAt: string;
}

export function retentionCutoff(now: Date): Date {
  return new Date(now.getTime() - IDEMPOTENCY_RETENTION_MS);
}

export function pruneIdempotencyRecords(
  prisma: PrismaClient,
  now: Date,
): Promise<{ count: number }> {
  return prisma.idempotencyRecord
    .deleteMany({ where: { createdAt: { lt: retentionCutoff(now) } } })
    .then((result) => ({ count: result.count }));
}

export function buildIdempotencyPruneQueue(connection: Redis): Queue<PruneJobData> {
  return new Queue<PruneJobData>(IDEMPOTENCY_PRUNE_QUEUE, { connection });
}

export async function scheduleIdempotencyPrune(queue: Queue<PruneJobData>): Promise<void> {
  await queue.upsertJobScheduler(
    `${IDEMPOTENCY_PRUNE_QUEUE}.hourly`,
    { every: 60 * 60 * 1000 },
    {
      name: "idempotency-prune",
      data: { triggeredAt: new Date().toISOString() },
      opts: SCHEDULED_JOB_OPTIONS,
    },
  );
}

export function buildIdempotencyPruneWorker(
  connection: Redis,
  prisma: PrismaClient,
): Worker<PruneJobData, { count: number }> {
  return new Worker<PruneJobData, { count: number }>(
    IDEMPOTENCY_PRUNE_QUEUE,
    async () => pruneIdempotencyRecords(prisma, new Date()),
    { connection },
  );
}
