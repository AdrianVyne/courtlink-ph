import {
  buildHoldExpiryQueue,
  buildHoldExpiryWorker,
  buildPrismaClient,
  buildRedisConnection,
  scheduleHoldExpiry,
} from "./hold-expiry.js";

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
  const queue = buildHoldExpiryQueue(connection);
  await scheduleHoldExpiry(queue);

  const worker = buildHoldExpiryWorker(connection, prisma);
  worker.on("completed", (job, result) => {
    log("hold-expiry.completed", { jobId: job.id, expired: result.count });
  });
  worker.on("failed", (job, error) => {
    log("hold-expiry.failed", { jobId: job?.id, error: error.message });
  });

  log("worker.ready", { queue: queue.name });

  const shutdown = async (signal: string): Promise<void> => {
    log("worker.shutdown", { signal });
    await worker.close();
    await queue.close();
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
