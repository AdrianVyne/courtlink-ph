import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@courtlink/database";
import { Redis } from "ioredis";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OperationsService } from "../src/operations/operations.service.js";
import { PrismaOperationsProbe } from "../src/operations/prisma-operations.probe.js";

const databaseUrl = process.env.DATABASE_URL;
const redisUrl = process.env.REDIS_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for operations integration tests");
if (!redisUrl) throw new Error("REDIS_URL is required for operations integration tests");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
const redis = new Redis(redisUrl, { maxRetriesPerRequest: null });
const probe = new PrismaOperationsProbe(prisma, redis, 10 * 1024 ** 3);
const operations = new OperationsService(probe, 2_000);

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await probe.close();
  await prisma.$disconnect();
});

describe("production operations probe", () => {
  it("reports live PostgreSQL, Redis, capacity, and BullMQ state", async () => {
    await expect(operations.readiness()).resolves.toEqual({
      status: "ready",
      service: "courtlink-api",
    });

    const status = await operations.status();
    expect(status.dependencies).toEqual({ database: true, redis: true });
    expect(status.database.usedBytes).toBeGreaterThan(0);
    expect(status.redis.usedBytes).toBeGreaterThan(0);
    expect(status.queues.map((queue) => queue.name)).toEqual([
      "court.holds.expiry",
      "court.reviews.escalation",
      "bookings.completion",
    ]);
    expect(status.queues.every((queue) => queue.failed >= 0)).toBe(true);
    expect(status.capturedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
