import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required for database integration tests");
}

const pool = new Pool({ connectionString });
let client: PoolClient;

beforeAll(async () => {
  client = await pool.connect();
  await client.query("BEGIN");
});

afterAll(async () => {
  await client.query("ROLLBACK");
  client.release();
  await pool.end();
});

describe("court booking overlap constraint", () => {
  it("rejects two active bookings for the same court and intersecting time", async () => {
    const userId = randomUUID();
    const businessId = randomUUID();
    const venueId = randomUUID();
    const courtId = randomUUID();

    await client.query(
      `INSERT INTO users (id, email, "displayName", status, "createdAt", "updatedAt")
       VALUES ($1, $2, 'Test Player', 'ACTIVE', NOW(), NOW())`,
      [userId, `player-${userId}@example.test`],
    );
    await client.query(
      `INSERT INTO businesses (id, name, "createdAt", "updatedAt")
       VALUES ($1, 'Test Business', NOW(), NOW())`,
      [businessId],
    );
    await client.query(
      `INSERT INTO venues (
        id, "businessId", name, slug, status, "regionCode", "cityMunicipality",
        "streetAddress", timezone, "createdAt", "updatedAt"
      ) VALUES ($1, $2, 'Test Venue', $3, 'APPROVED', 'NCR', 'Manila', 'Test Street',
        'Asia/Manila', NOW(), NOW())`,
      [venueId, businessId, `test-venue-${venueId}`],
    );
    await client.query(
      `INSERT INTO courts (
        id, "venueId", name, indoor, active, "slotIncrementMin", "minimumDurationMin",
        "maximumDurationMin", "createdAt", "updatedAt"
      ) VALUES ($1, $2, 'Court 1', false, true, 30, 60, 240, NOW(), NOW())`,
      [courtId, venueId],
    );

    const insertBooking = (id: string, startsAt: string, endsAt: string) =>
      client.query(
        `INSERT INTO court_bookings (
          id, "courtId", "playerId", status, "startsAt", "endsAt", timezone,
          "quotedAmount", currency, "proofDeadline", "createdAt", "updatedAt"
        ) VALUES ($1, $2, $3, 'HELD', $4, $5, 'Asia/Manila', 500, 'PHP', $6, NOW(), NOW())`,
        [id, courtId, userId, startsAt, endsAt, "2026-06-21T02:05:00.000Z"],
      );

    await insertBooking(randomUUID(), "2026-06-21T02:00:00.000Z", "2026-06-21T03:00:00.000Z");

    await expect(
      insertBooking(randomUUID(), "2026-06-21T02:30:00.000Z", "2026-06-21T03:30:00.000Z"),
    ).rejects.toMatchObject({ code: "23P01" });
  });
});
