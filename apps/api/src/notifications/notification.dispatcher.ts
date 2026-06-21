import type { EmailSender } from "./notification.service.js";
// biome-ignore lint/style/useImportType: NotificationService is injected at runtime by Nest.
import { NotificationService } from "./notification.service.js";

export interface UserDirectory {
  emailsForUsers(userIds: string[]): Promise<string[]>;
}

export interface DispatchInput {
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown> | null;
}

// Orchestrates the two delivery channels for a single event: in-app first
// (authoritative), then best-effort email. Email failures are swallowed so a
// payment decision is never blocked by SMTP.
export class NotificationDispatcher {
  constructor(
    private readonly notifications: NotificationService,
    private readonly email: EmailSender,
    private readonly directory: UserDirectory,
  ) {}

  async dispatch(recipientUserIds: string[], input: DispatchInput): Promise<void> {
    const recipients = [...new Set(recipientUserIds.filter(Boolean))];
    if (recipients.length === 0) return;

    await this.notifications.notifyMany(recipients.map((userId) => ({ userId, ...input })));

    try {
      const emails = await this.directory.emailsForUsers(recipients);
      await Promise.allSettled(
        emails.map((to) => this.email.send({ to, subject: input.title, text: input.body })),
      );
    } catch {
      // Email is best-effort; the in-app notification already landed.
    }
  }
}
