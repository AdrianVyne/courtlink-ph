import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@courtlink/database";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  canonicalRequestHash,
  type IdempotencyLookup,
  resolveIdempotency,
} from "../src/idempotency/idempotency.service.js";
import { PrismaIdempotencyRepository } from "../src/idempotency/prisma-idempotency.repository.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString)
  throw new Error("DATABASE_URL is required for idempotency integration tests");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const repo = new PrismaIdempotencyRepository(prisma);

const actorId = "11111111-1111-1111-1111-111111111111";

function lookup(overrides: Partial<IdempotencyLookup> = {}): IdempotencyLookup {
  return {
    actorId,
    method: "POST",
    path: "/courts/c1/hold",
    idempotencyKey: "itest-key",
    requestHash: canonicalRequestHash({ startsAt: "a", endsAt: "b" }),
    ...overrides,
  };
}

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await cleanup();
});

async function cleanup() {
  await prisma.idempotencyRecord.deleteMany({ where: { actorId } });
}

describe("Idempotency repository", () => {
  it("reserves a key once and rejects the concurrent duplicate as in-progress", async () => {
    const key = lookup();
    const first = await repo.reserve(key);
    expect(first.reserved).toBe(true);

    const second = await repo.reserve(key);
    expect(second.reserved).toBe(false);
    expect(second.existing?.status).toBe("IN_PROGRESS");
    expect(() => resolveIdempotency(key, second.existing)).toThrowError(/still being processed/i);
  });

  it("replays the stored response after completion", async () => {
    const key = lookup();
    await repo.reserve(key);
    await repo.complete(key, 201, { id: "booking-123" });

    const repeat = await repo.reserve(key);
    expect(repeat.reserved).toBe(false);
    const resolution = resolveIdempotency(key, repeat.existing);
    expect(resolution).toEqual({
      kind: "replay",
      statusCode: 201,
      responseBody: { id: "booking-123" },
    });
  });

  it("rejects the same key with a different request hash", async () => {
    const key = lookup();
    await repo.reserve(key);
    await repo.complete(key, 201, { id: "booking-123" });

    const conflicting = lookup({ requestHash: canonicalRequestHash({ startsAt: "x" }) });
    const repeat = await repo.reserve(conflicting);
    expect(repeat.reserved).toBe(false);
    expect(() => resolveIdempotency(conflicting, repeat.existing)).toThrowError(
      /different request/i,
    );
  });

  it("allows a fresh reservation after releasing an in-progress record", async () => {
    const key = lookup();
    await repo.reserve(key);
    await repo.release(key);

    const retry = await repo.reserve(key);
    expect(retry.reserved).toBe(true);
  });

  it("prunes records older than the cutoff", async () => {
    const key = lookup();
    await repo.reserve(key);
    await repo.complete(key, 201, { id: "booking-123" });

    const future = new Date(Date.now() + 60_000);
    const pruned = await repo.pruneOlderThan(future);
    expect(pruned).toBeGreaterThanOrEqual(1);
    expect(await repo.find(key)).toBeNull();
  });
});
