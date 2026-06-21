import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@courtlink/database";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { NotificationService } from "../src/notifications/notification.service.js";
import { PrismaNotificationRepository } from "../src/notifications/prisma-notification.repository.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString)
  throw new Error("DATABASE_URL is required for notification integration tests");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const service = new NotificationService(new PrismaNotificationRepository(prisma));

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
  await prisma.notification.deleteMany({
    where: { user: { email: { endsWith: "@notif.integration.test" } } },
  });
  await prisma.user.deleteMany({ where: { email: { endsWith: "@notif.integration.test" } } });
}

async function makeUser() {
  return prisma.user.create({
    data: {
      email: `u-${crypto.randomUUID()}@notif.integration.test`,
      displayName: "Notif User",
      credentials: { create: { passwordHash: "$argon2id$placeholder" } },
    },
  });
}

describe("Notification persistence", () => {
  it("stores notifications, counts unread, and marks read", async () => {
    const user = await makeUser();
    await service.notifyMany([
      {
        userId: user.id,
        type: "COURT_PROOF_SUBMITTED",
        title: "Review",
        body: "x",
        data: { a: 1 },
      },
      { userId: user.id, type: "COURT_BOOKING_CONFIRMED", title: "Confirmed", body: "y" },
    ]);

    expect(await service.countUnread(user.id)).toBe(2);
    const list = await service.listForUser(user.id);
    expect(list[0]?.createdAt.getTime()).toBeGreaterThanOrEqual(list[1]?.createdAt.getTime() ?? 0);
    const stored = list.find((n) => n.type === "COURT_PROOF_SUBMITTED");
    expect(stored?.data).toEqual({ a: 1 });

    const target = list[0];
    if (!target) throw new Error("expected notification");
    expect(await service.markRead(user.id, target.id)).toBe(true);
    expect(await service.countUnread(user.id)).toBe(1);
    expect(await service.markAllRead(user.id)).toBe(1);
    expect(await service.countUnread(user.id)).toBe(0);
  });

  it("never marks another user's notification read", async () => {
    const a = await makeUser();
    const b = await makeUser();
    await service.notify({ userId: a.id, type: "T", title: "t", body: "b" });
    const [aNote] = await service.listForUser(a.id);
    if (!aNote) throw new Error("expected notification");
    expect(await service.markRead(b.id, aNote.id)).toBe(false);
    expect(await service.countUnread(a.id)).toBe(1);
  });
});
