import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from "@nestjs/common";
import { ZodError } from "zod";

interface CodedError {
  code: string;
  message: string;
}

// Domain error codes mapped to HTTP statuses. Anything not listed and not an
// HttpException becomes a 500 with a stable INTERNAL code.
const STATUS_BY_CODE: Record<string, number> = {
  AUTH_INVALID_CREDENTIALS: 401,
  AUTH_REQUIRED: 401,
  SUPER_ADMIN_REQUIRED: 403,
  TENANT_FORBIDDEN: 403,
  BOOKING_FORBIDDEN: 403,
  COACH_BOOKING_FORBIDDEN: 403,
  REFUND_FORBIDDEN: 403,
  BOOKING_NOT_FOUND: 404,
  COURT_NOT_FOUND: 404,
  VENUE_NOT_FOUND: 404,
  COACH_NOT_FOUND: 404,
  COACH_PROFILE_REQUIRED: 404,
  COACH_BOOKING_NOT_FOUND: 404,
  REFUND_NOT_FOUND: 404,
  REQUEST_NOT_FOUND: 404,
  OFFER_NOT_FOUND: 404,
};

function isCodedError(value: unknown): value is CodedError {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    typeof (value as { code: unknown }).code === "string" &&
    "message" in value &&
    typeof (value as { message: unknown }).message === "string"
  );
}

@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("Exception");

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<{
      status(code: number): { send(body: unknown): unknown };
    }>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      response.status(status).send(exception.getResponse());
      return;
    }

    if (exception instanceof ZodError) {
      response.status(400).send({
        code: "VALIDATION_ERROR",
        message: exception.issues.map((issue) => issue.path.join(".") || "body").join(", "),
      });
      return;
    }

    if (isCodedError(exception)) {
      const status = STATUS_BY_CODE[exception.code] ?? 400;
      response.status(status).send({ code: exception.code, message: exception.message });
      return;
    }

    this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    response.status(500).send({ code: "INTERNAL", message: "Internal server error" });
  }
}
