import { describe, expect, it } from "vitest";
import {
  type CreateNotificationInput,
  type NotificationRecord,
  type NotificationRepository,
  NotificationService,
  dedupeByUser,
} from "./notification.service.js";

class InMemoryNotificationRepo implements NotificationRepository {
  rows: NotificationRecord[] = [];

  async createMany(inputs: CreateNotificationInput[]): Promise<number> {
    for (const input of inputs) {
      this.rows.push({
        id: `n-${this.rows.length + 1}`,
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        data: input.data ?? null,
        readAt: null,
        createdAt: new Date(),
      });
    }
    return inputs.length;
  }
  async listForUser(userId: string, limit: number): Promise<NotificationRecord[]> {
    return this.rows.filter((r) => r.userId === userId).slice(0, limit);
  }
  async countUnread(userId: string): Promise<number> {
    return this.rows.filter((r) => r.userId === userId && r.readAt === null).length;
  }
  async markRead(userId: string, id: string, readAt: Date): Promise<boolean> {
    const row = this.rows.find((r) => r.id === id && r.userId === userId);
    if (!row || row.readAt) return false;
    row.readAt = readAt;
    return true;
  }
  async markAllRead(userId: string, readAt: Date): Promise<number> {
    let count = 0;
    for (const row of this.rows) {
      if (row.userId === userId && row.readAt === null) {
        row.readAt = readAt;
        count++;
      }
    }
    return count;
  }
}

describe("NotificationService", () => {
  it("creates and lists notifications and tracks unread counts", async () => {
    const repo = new InMemoryNotificationRepo();
    const service = new NotificationService(repo);
    await service.notify({
      userId: "u1",
      type: "BOOKING_CONFIRMED",
      title: "Confirmed",
      body: "x",
    });
    await service.notify({ userId: "u1", type: "PROOF_REJECTED", title: "Rejected", body: "y" });

    expect(await service.countUnread("u1")).toBe(2);
    const list = await service.listForUser("u1");
    expect(list).toHaveLength(2);
  });

  it("marks a single notification and all notifications read", async () => {
    const repo = new InMemoryNotificationRepo();
    const service = new NotificationService(repo);
    await service.notify({ userId: "u1", type: "A", title: "a", body: "a" });
    await service.notify({ userId: "u1", type: "B", title: "b", body: "b" });
    const [first] = await service.listForUser("u1");
    if (!first) throw new Error("expected a notification");

    expect(await service.markRead("u1", first.id)).toBe(true);
    expect(await service.countUnread("u1")).toBe(1);
    expect(await service.markAllRead("u1")).toBe(1);
    expect(await service.countUnread("u1")).toBe(0);
  });

  it("does not notify the same user twice for one event", async () => {
    const repo = new InMemoryNotificationRepo();
    const service = new NotificationService(repo);
    await service.notifyMany([
      { userId: "owner", type: "PROOF_SUBMITTED", title: "t", body: "b" },
      { userId: "owner", type: "PROOF_SUBMITTED", title: "t", body: "b" },
      { userId: "manager", type: "PROOF_SUBMITTED", title: "t", body: "b" },
      { userId: "", type: "PROOF_SUBMITTED", title: "t", body: "b" },
    ]);
    expect(repo.rows.map((r) => r.userId).sort()).toEqual(["manager", "owner"]);
  });

  it("dedupes recipients by user and type", () => {
    const out = dedupeByUser([
      { userId: "a", type: "T", title: "", body: "" },
      { userId: "a", type: "T", title: "", body: "" },
      { userId: "b", type: "T", title: "", body: "" },
    ]);
    expect(out).toHaveLength(2);
  });
});
