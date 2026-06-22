import {
  type CallHandler,
  type ExecutionContext,
  Inject,
  Injectable,
  type NestInterceptor,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Observable, from, of } from "rxjs";
import { switchMap } from "rxjs/operators";
import { type AuthenticatedRequest, getSessionUser } from "../auth/session.guard.js";
import { IDEMPOTENT_ROUTE_KEY } from "./idempotent.decorator.js";
import {
  canonicalRequestHash,
  type IdempotencyLookup,
  requireIdempotencyKey,
  resolveIdempotency,
} from "./idempotency.service.js";
import type { PrismaIdempotencyRepository } from "./prisma-idempotency.repository.js";

interface ReplyLike {
  statusCode?: number;
  status(code: number): unknown;
}

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject("IDEMPOTENCY_REPOSITORY") private readonly repository: PrismaIdempotencyRepository,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const isIdempotent = this.reflector.getAllAndOverride<boolean>(IDEMPOTENT_ROUTE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!isIdempotent) return next.handle();

    const http = context.switchToHttp();
    const request = http.getRequest<
      AuthenticatedRequest & {
        method: string;
        url: string;
        body?: unknown;
        params?: Record<string, unknown>;
      }
    >();
    const reply = http.getResponse<ReplyLike>();
    const user = getSessionUser(request);

    const headerValue = request.headers["idempotency-key"];
    const idempotencyKey = requireIdempotencyKey(
      Array.isArray(headerValue) ? headerValue[0] : headerValue,
    );

    const routePath = normalizePath(request.url);
    const hashSource =
      request.body !== undefined && request.body !== null
        ? request.body
        : { params: request.params ?? {} };
    const lookup: IdempotencyLookup = {
      actorId: user.id,
      method: request.method.toUpperCase(),
      path: routePath,
      idempotencyKey,
      requestHash: canonicalRequestHash(hashSource),
    };

    return from(this.repository.reserve(lookup)).pipe(
      switchMap((outcome) => {
        if (!outcome.reserved) {
          const resolution = resolveIdempotency(lookup, outcome.existing);
          if (resolution.kind === "replay") {
            reply.status(resolution.statusCode);
            return of(resolution.responseBody);
          }
        }
        return next.handle().pipe(
          switchMap((responseBody) =>
            from(
              this.repository
                .complete(lookup, statusCodeOf(reply), responseBody)
                .then(() => responseBody),
            ),
          ),
          catchAndRelease(() => this.repository.release(lookup)),
        );
      }),
    );
  }
}

function statusCodeOf(reply: ReplyLike): number {
  return typeof reply.statusCode === "number" ? reply.statusCode : 200;
}

function normalizePath(url: string): string {
  const path = url.split("?")[0] ?? url;
  return path.replace(/\/+$/, "") || "/";
}

function catchAndRelease(release: () => Promise<unknown>) {
  return (source: Observable<unknown>): Observable<unknown> =>
    new Observable((subscriber) => {
      const subscription = source.subscribe({
        next: (value) => subscriber.next(value),
        error: (error) => {
          void release().finally(() => subscriber.error(error));
        },
        complete: () => subscriber.complete(),
      });
      return () => subscription.unsubscribe();
    });
}
