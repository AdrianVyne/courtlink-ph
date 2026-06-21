import type { Prisma, PrismaClient } from "@courtlink/database";
import type {
  CreateNotificationInput,
  NotificationRecord,
  NotificationRepository,
} from "./notification.service.js";

type NotificationRow = {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  data: unknown;
  readAt: Date | null;
  createdAt: Date;
};

function toRecord(row: NotificationRow): NotificationRecord {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type,
    title: row.title,
    body: row.body,
    data: (row.data as Record<string, unknown> | null) ?? null,
    readAt: row.readAt,
    createdAt: row.createdAt,
  };
}

export class PrismaNotificationRepository implements NotificationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createMany(inputs: CreateNotificationInput[]): Promise<number> {
    if (inputs.length === 0) return 0;
    const result = await this.prisma.notification.createMany({
      data: inputs.map((input) => {
        const row: Prisma.NotificationCreateManyInput = {
          userId: input.userId,
          type: input.type,
          title: input.title,
          body: input.body,
        };
        if (input.data != null) row.data = input.data as Prisma.InputJsonValue;
        return row;
      }),
    });
    return result.count;
  }

  async listForUser(userId: string, limit: number): Promise<NotificationRecord[]> {
    const rows = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.map(toRecord);
  }

  async countUnread(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async markRead(userId: string, id: string, readAt: Date): Promise<boolean> {
    const result = await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt },
    });
    return result.count > 0;
  }

  async markAllRead(userId: string, readAt: Date): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt },
    });
    return result.count;
  }
}
