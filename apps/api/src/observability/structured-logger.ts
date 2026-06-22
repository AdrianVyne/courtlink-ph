import type { LoggerService } from "@nestjs/common";
import { redactLogValue } from "./redaction.js";

interface LogOutput {
  write(value: string): unknown;
}

type LogLevel = "debug" | "error" | "fatal" | "info" | "verbose" | "warn";

export class StructuredLogger implements LoggerService {
  constructor(private readonly output: LogOutput = process.stdout) {}

  log(message: unknown, context?: string): void {
    this.write("info", message, context);
  }

  error(message: unknown, trace?: string, context?: string): void {
    this.write("error", message, context, trace);
  }

  warn(message: unknown, context?: string): void {
    this.write("warn", message, context);
  }

  debug(message: unknown, context?: string): void {
    this.write("debug", message, context);
  }

  verbose(message: unknown, context?: string): void {
    this.write("verbose", message, context);
  }

  fatal(message: unknown, context?: string): void {
    this.write("fatal", message, context);
  }

  private write(level: LogLevel, message: unknown, context?: string, trace?: string): void {
    const details =
      typeof message === "object" && message !== null
        ? (redactLogValue(message) as Record<string, unknown>)
        : { message: redactLogValue(String(message)) };
    const event = {
      ...details,
      ...(trace ? { trace: redactLogValue(trace) } : {}),
      ts: new Date().toISOString(),
      level,
      ...(context ? { context } : {}),
    };
    this.output.write(`${JSON.stringify(event)}\n`);
  }
}
