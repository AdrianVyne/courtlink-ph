# ADR 0003: Built-in Free-Tier Observability

## Status

Accepted

## Context

CourtLink PH launches on an Oracle Cloud Always Free VM and cannot depend on a paid monitoring subscription. The platform still requires correlated redacted logs, dependency health, capacity alerts, queue visibility, dead-letter recovery, and admin operational status.

## Decision

The API and worker emit newline-delimited JSON to standard output and Docker rotates local log files. API requests receive validated UUID correlation IDs. Public liveness and readiness endpoints reveal no dependency details. A super-admin-only operations module gathers PostgreSQL, Redis, process, event-loop, and BullMQ metrics and applies stable local thresholds.

BullMQ retries scheduled jobs three times with exponential backoff. Exhausted jobs remain in BullMQ's retained failed set, which serves as the initial dead-letter store. The application exposes only sanitized failed-job metadata and leaves retry/removal as explicit runbook operations.

A host cron probe supplies basic alerting and can call an operator-selected webhook using a secret stored outside Git. No vendor-specific observability SDK is required.

## Consequences

The launch stack has no observability subscription cost and remains portable. Operators must manage host log retention, webhook delivery, threshold tuning, and incident response. Local telemetry does not provide long-term dashboards or distributed tracing; a future hosted monitoring system may consume the same JSON logs and aggregate metrics without changing domain behavior.
