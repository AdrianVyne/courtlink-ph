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
    log("hold-expiry.failed", { jobId: job?.id, error: error.message });
  });

  const escalationQueue = buildReviewEscalationQueue(connection);
  await scheduleReviewEscalation(escalationQueue);
  const escalationWorker = buildReviewEscalationWorker(connection, prisma);
  escalationWorker.on("completed", (job, result) => {
    log("review-escalation.completed", { jobId: job.id, ...result });
  });
  escalationWorker.on("failed", (job, error) => {
    log("review-escalation.failed", { jobId: job?.id, error: error.message });
  });

  const completionQueue = buildBookingCompletionQueue(connection);
  await scheduleBookingCompletion(completionQueue);
  const completionWorker = buildBookingCompletionWorker(connection, prisma);
  completionWorker.on("completed", (job, result) => {
    log("booking-completion.completed", { jobId: job.id, ...result });
  });
  completionWorker.on("failed", (job, error) => {
    log("booking-completion.failed", { jobId: job?.id, error: error.message });
  });

  log("worker.ready", { queues: [holdQueue.name, escalationQueue.name, completionQueue.name] });

  const shutdown = async (signal: string): Promise<void> => {
    log("worker.shutdown", { signal });
    await holdWorker.close();
    await escalationWorker.close();
    await completionWorker.close();
    await holdQueue.close();
    await escalationQueue.close();
    await completionQueue.close();
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
