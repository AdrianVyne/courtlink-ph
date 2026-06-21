export interface NotificationRecord {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  readAt: Date | null;
  createdAt: Date;
}

export interface CreateNotificationInput {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown> | null;
}

export interface NotificationRepository {
  createMany(inputs: CreateNotificationInput[]): Promise<number>;
  listForUser(userId: string, limit: number): Promise<NotificationRecord[]>;
  countUnread(userId: string): Promise<number>;
  markRead(userId: string, id: string, readAt: Date): Promise<boolean>;
  markAllRead(userId: string, readAt: Date): Promise<number>;
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

// Replaceable transactional-email port. In-app notifications are authoritative;
// email is best-effort so a delivery failure never blocks a booking decision.
export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

export class NotificationService {
  constructor(private readonly repository: NotificationRepository) {}

  async notify(input: CreateNotificationInput): Promise<void> {
    await this.repository.createMany([input]);
  }

  async notifyMany(inputs: CreateNotificationInput[]): Promise<void> {
    const filtered = dedupeByUser(inputs);
    if (filtered.length === 0) return;
    await this.repository.createMany(filtered);
  }

  listForUser(userId: string, limit = 50): Promise<NotificationRecord[]> {
    return this.repository.listForUser(userId, limit);
  }

  countUnread(userId: string): Promise<number> {
    return this.repository.countUnread(userId);
  }

  markRead(userId: string, id: string): Promise<boolean> {
    return this.repository.markRead(userId, id, new Date());
  }

  markAllRead(userId: string): Promise<number> {
    return this.repository.markAllRead(userId, new Date());
  }
}

// A single event may target several recipients; never notify the same user twice
// for one event, and drop empty user ids defensively.
export function dedupeByUser(inputs: CreateNotificationInput[]): CreateNotificationInput[] {
  const seen = new Set<string>();
  const result: CreateNotificationInput[] = [];
  for (const input of inputs) {
    if (!input.userId) continue;
    const key = `${input.userId}:${input.type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(input);
  }
  return result;
}
