import { Logger } from "@nestjs/common";
import type { EmailMessage, EmailSender } from "./notification.service.js";

// Default transactional-email adapter: logs instead of sending so local and
// CI never need SMTP. Swap for a Brevo/SMTP sender in production by binding a
// different EmailSender implementation to the EMAIL_SENDER token.
export class LoggingEmailSender implements EmailSender {
  private readonly logger = new Logger("Email");

  async send(message: EmailMessage): Promise<void> {
    this.logger.log(`email to=${message.to} subject=${JSON.stringify(message.subject)}`);
  }
}
