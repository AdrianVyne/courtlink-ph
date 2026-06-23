import { describe, expect, it, vi } from "vitest";
import { SmtpEmailSender, type SmtpConfig } from "./smtp-email-sender.js";

const baseConfig: SmtpConfig = {
  host: "smtp.example.com",
  port: 587,
  user: "test-user",
  password: "test-pass",
  from: "noreply@courtlink.example",
};

vi.mock("nodemailer", () => {
  const sent: Array<{ from: string; to: string; subject: string; text: string }> = [];
  let shouldFail = false;
  return {
    createTransport: () => ({
      sendMail: async (mail: { from: string; to: string; subject: string; text: string }) => {
        if (shouldFail) throw new Error("SMTP connection refused");
        sent.push(mail);
      },
      verify: async () => {
        if (shouldFail) throw new Error("SMTP connection refused");
        return true;
      },
    }),
    __sent: sent,
    __setFail: (fail: boolean) => {
      shouldFail = fail;
    },
  };
});

describe("SmtpEmailSender", () => {
  it("delivers a message through the transport", async () => {
    const sender = new SmtpEmailSender(baseConfig);
    const nodemailer = await import("nodemailer");
    const sent = (nodemailer as unknown as { __sent: unknown[] }).__sent;
    sent.length = 0;

    await sender.send({
      to: "player@example.com",
      subject: "Booking confirmed",
      text: "Your court is booked.",
    });

    expect(sent).toEqual([
      {
        from: "noreply@courtlink.example",
        to: "player@example.com",
        subject: "Booking confirmed",
        text: "Your court is booked.",
      },
    ]);
  });

  it("throws on SMTP failure without suppressing the error", async () => {
    const nodemailer = await import("nodemailer");
    (nodemailer as unknown as { __setFail: (v: boolean) => void }).__setFail(true);
    const sender = new SmtpEmailSender(baseConfig);

    await expect(
      sender.send({ to: "player@example.com", subject: "Test", text: "fail" }),
    ).rejects.toThrow("SMTP connection refused");

    (nodemailer as unknown as { __setFail: (v: boolean) => void }).__setFail(false);
  });
});
