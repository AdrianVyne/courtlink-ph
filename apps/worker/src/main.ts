import {
  buildHoldExpiryQueue,
  buildHoldExpiryWorker,
  buildPrismaClient,
  buildRedisConnection,
  scheduleHoldExpiry,
} from "./hold-expiry.js";
import {
  buildReviewEscalationQueue,
  buildReviewEscalationWorker,
  scheduleReviewEscalation,
} from "./review-escalation.js";
import {
  buildBookingCompletionQueue,
  buildBookingCompletionWorker,
  scheduleBookingCompletion,
} from "./booking-completion.js";
import {
  buildIdempotencyPruneQueue,
  buildIdempotencyPruneWorker,
  scheduleIdempotencyPrune,
} from "./idempotency-prune.js";
import { buildFailedJobEvent } from "./queue-policy.js";

function log(message: string, fields: Record<string, unknown> = {}): void {
  process.stdout.write(`${JSON.stringify({ ts: new Date().toISOString(), message, ...fields })}\n`);
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  const redisUrl = process.env.REDIS_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  if (!redisUrl) throw new Error("REDIS_URL is required");

  const connection = buildRedisConnection(redisUrl);
  const prisma = buildPrismaClient(databaseUrl);

  const holdQueue = buildHoldExpiryQueue(connection);
  await scheduleHoldExpiry(holdQueue);
  const holdWorker = buildHoldExpiryWorker(connection, prisma);
  holdWorker.on("completed", (job, result) => {
    log("hold-expiry.completed", { jobId: job.id, expired: result.count });
  });
  holdWorker.on("failed", (job, error) => {
    if (!job) return log("hold-expiry.failed", { errorType: error.name });
    const { event, ...fields } = buildFailedJobEvent(holdQueue.name, job);
    log(String(event), fields);
  });

  const escalationQueue = buildReviewEscalationQueue(connection);
  await scheduleReviewEscalation(escalationQueue);
  const escalationWorker = buildReviewEscalationWorker(connection, prisma);
  escalationWorker.on("completed", (job, result) => {
    log("review-escalation.completed", { jobId: job.id, ...result });
  });
  escalationWorker.on("failed", (job, error) => {
    if (!job) return log("review-escalation.failed", { errorType: error.name });
    const { event, ...fields } = buildFailedJobEvent(escalationQueue.name, job);
    log(String(event), fields);
  });

  const completionQueue = buildBookingCompletionQueue(connection);
  await scheduleBookingCompletion(completionQueue);
  const completionWorker = buildBookingCompletionWorker(connection, prisma);
  completionWorker.on("completed", (job, result) => {
    log("booking-completion.completed", { jobId: job.id, ...result });
  });
  completionWorker.on("failed", (job, error) => {
    if (!job) return log("booking-completion.failed", { errorType: error.name });
    const { event, ...fields } = buildFailedJobEvent(completionQueue.name, job);
    log(String(event), fields);
  });

  const pruneQueue = buildIdempotencyPruneQueue(connection);
  await scheduleIdempotencyPrune(pruneQueue);
  const pruneWorker = buildIdempotencyPruneWorker(connection, prisma);
  pruneWorker.on("completed", (job, result) => {
    log("idempotency-prune.completed", { jobId: job.id, pruned: result.count });
  });
  pruneWorker.on("failed", (job, error) => {
    if (!job) return log("idempotency-prune.failed", { errorType: error.name });
    const { event, ...fields } = buildFailedJobEvent(pruneQueue.name, job);
    log(String(event), fields);
  });

  log("worker.ready", {
    queues: [holdQueue.name, escalationQueue.name, completionQueue.name, pruneQueue.name],
  });

  const shutdown = async (signal: string): Promise<void> => {
    log("worker.shutdown", { signal });
    await holdWorker.close();
    await escalationWorker.close();
    await completionWorker.close();
    await pruneWorker.close();
    await holdQueue.close();
    await escalationQueue.close();
    await completionQueue.close();
    await pruneQueue.close();
    await connection.quit();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${JSON.stringify({ ts: new Date().toISOString(), fatal: message })}\n`);
  process.exit(1);
});
