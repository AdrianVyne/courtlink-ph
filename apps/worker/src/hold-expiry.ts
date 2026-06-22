import { PrismaClient } from "@courtlink/database";
import { PrismaPg } from "@prisma/adapter-pg";
import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { SCHEDULED_JOB_OPTIONS } from "./queue-policy.js";

export const HOLD_EXPIRY_QUEUE = "court.holds.expiry";

export interface ExpiryJobData {
  triggeredAt: string;
}

export function expireStaleHolds(prisma: PrismaClient, now: Date): Promise<{ count: number }> {
  return prisma.courtBooking
    .updateMany({
      where: { status: "HELD", proofDeadline: { lt: now } },
      data: { status: "EXPIRED" },
    })
    .then((result) => ({ count: result.count }));
}

export function buildRedisConnection(url: string): Redis {
  return new Redis(url, { maxRetriesPerRequest: null });
}

export function buildPrismaClient(databaseUrl: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
}

export function buildHoldExpiryQueue(connection: Redis): Queue<ExpiryJobData> {
  return new Queue<ExpiryJobData>(HOLD_EXPIRY_QUEUE, { connection });
}

export async function scheduleHoldExpiry(queue: Queue<ExpiryJobData>): Promise<void> {
  await queue.upsertJobScheduler(
    `${HOLD_EXPIRY_QUEUE}.every-30s`,
    { every: 30_000 },
    {
      name: "hold-expiry",
      data: { triggeredAt: new Date().toISOString() },
      opts: SCHEDULED_JOB_OPTIONS,
    },
  );
}

export function buildHoldExpiryWorker(
  connection: Redis,
  prisma: PrismaClient,
): Worker<ExpiryJobData, { count: number }> {
  return new Worker<ExpiryJobData, { count: number }>(
    HOLD_EXPIRY_QUEUE,
    async () => expireStaleHolds(prisma, new Date()),
    { connection },
  );
}
