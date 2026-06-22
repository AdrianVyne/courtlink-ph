# CourtLink PH Operations Design

## Purpose

CourtLink PH must remain operable on a single free-tier Oracle VM without depending on paid observability services. The production stack needs enough local telemetry to diagnose requests, inspect background work, detect capacity pressure, and recover failed jobs without exposing personal or payment data.

## Architecture

The API and worker emit newline-delimited JSON to standard output. Docker remains responsible for collecting and rotating container logs. A shared logging policy permits operational identifiers and aggregate counts while redacting secrets, cookies, authorization headers, proof locations, payment references, request bodies, and personal data.

Every API request receives a UUID correlation ID. A valid caller-supplied `x-correlation-id` is preserved; otherwise the API creates one. The ID is returned in the response header and attached to request-completion and exception events. Logs contain method, route, status, duration, and correlation ID, but never query strings or request bodies.

An operations module owns dependency checks and queue inspection. Public liveness reports only that the process is running. Public readiness verifies PostgreSQL and Redis with short timeouts and returns HTTP 503 when either dependency is unavailable. Super admins can retrieve detailed operational status containing process memory, event-loop delay, database size, Redis memory, and BullMQ queue counts.

## Queue Reliability

Scheduled jobs use three attempts with bounded exponential backoff. Successfully completed jobs retain a small history. Jobs that exhaust retries remain in BullMQ's failed set, which is the dead-letter store for the initial deployment. The operational endpoint exposes failed counts and a small sanitized list containing queue name, job ID, job name, attempt count, failure timestamp, and truncated error message. Payloads are never returned or logged.

Runbooks define how to inspect, retry, and remove dead-letter jobs. Operators retry only after fixing the underlying fault. Queue status is read-only through the application; destructive recovery remains an explicit command-line operation on the host.

## Capacity and Alerts

The operations snapshot assigns `ok`, `warning`, or `critical` status using documented defaults:

- process heap: warning at 70%, critical at 85%;
- Redis memory: warning at 70%, critical at 85% of configured max memory;
- PostgreSQL database size: warning at 70%, critical at 85% of a configurable byte budget;
- failed jobs: warning above zero, critical at ten or more;
- event-loop delay: warning at 100 ms, critical at 500 ms.

Thresholds are configurable through environment variables. The status endpoint reports active alerts as stable codes with human-readable messages. A host cron probe calls readiness and the authenticated operations check; non-OK results trigger the operator's chosen free notification channel. The repository supplies a shell-compatible runbook rather than embedding credentials or a vendor-specific alert service.

## Security

Detailed status and queue information require a live super-admin session. Public health responses do not reveal dependency names, versions, memory totals, queue names, or errors. Correlation IDs are syntactically validated and bounded before use. Error messages are sanitized and truncated. Logging utilities recursively redact sensitive key names and never serialize arbitrary request or job payloads.

## Testing

Unit tests cover correlation-ID acceptance and generation, recursive redaction, capacity thresholds, queue retry defaults, and sanitized failed-job summaries. Controller tests prove liveness remains public, readiness returns 503 on dependency failure, and operations status rejects non-super-admin users. Integration verification exercises PostgreSQL and Redis readiness plus live queue counts. Production verification checks JSON log output, response correlation headers, Docker health checks, and runbook commands.
