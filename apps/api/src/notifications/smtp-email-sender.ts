import { Logger } from "@nestjs/common";
import { createTransport, type Transporter, type SentMessageInfo } from "nodemailer";
import type { EmailMessage, EmailSender } from "./notification.service.js";

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
  secure?: boolean;
}

export class SmtpEmailSender implements EmailSender {
  private readonly transport: Transporter<SentMessageInfo>;
  private readonly from: string;
  private readonly logger = new Logger("SmtpEmail");

  constructor(config: SmtpConfig) {
    this.from = config.from;
    this.transport = createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure ?? config.port === 465,
      auth: { user: config.user, pass: config.password },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
  }

  async send(message: EmailMessage): Promise<void> {
    try {
      await this.transport.sendMail({
        from: this.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
      });
    } catch (error) {
      this.logger.warn(
        `SMTP delivery failed to=${message.to} subject=${JSON.stringify(message.subject)} error=${String(error)}`,
      );
      throw error;
    }
  }

  async verify(): Promise<boolean> {
    try {
      await this.transport.verify();
      return true;
    } catch {
      this.logger.warn("SMTP connection verification failed");
      return false;
    }
  }
}
