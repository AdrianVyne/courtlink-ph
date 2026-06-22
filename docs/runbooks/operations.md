# Operations and Alert Response

## Scope

Use this runbook for dependency outages, capacity alerts, elevated event-loop delay, and API errors. Run commands from the production repository directory. Never paste `.env`, cookies, request bodies, payment references, proof locations, or user data into incident notes.

## Routine checks

Confirm container and public health:

```bash
docker compose -f compose.prod.yaml ps
curl -fsS http://127.0.0.1/api/v1/health/live
curl -fsS http://127.0.0.1/api/v1/health/ready
```

`live` proves that the API process responds. `ready` also checks PostgreSQL and Redis and returns HTTP 503 if either is unavailable. Dependency details are intentionally absent from public responses.

Sign in through the website as a super admin and open `/admin/operations`. Review active alerts, dependency state, capacity ratios, queue counts, and retained failures. The page is read-only.

## Host alert

`deploy/check-health.sh` exits nonzero when readiness fails. Schedule it every five minutes:

```cron
*/5 * * * * cd /opt/courtlink && ./deploy/check-health.sh >> /var/log/courtlink-health.log 2>&1
```

For a free webhook notification, set `ALERT_WEBHOOK_URL` only in the host cron environment or a root-readable environment file. The script posts a fixed message and never includes the URL, response content, environment, or application data. Verify the alert once after setup by temporarily supplying an unreachable `COURTLINK_HEALTH_URL`.

## Correlation tracing

Copy the `x-correlation-id` response header reported by the affected client. Search API logs without printing unrelated requests:

```bash
docker compose -f compose.prod.yaml logs --since 30m api | grep -F 'CORRELATION_UUID'
```

Request-completion events contain method, path without query parameters, status, duration, and correlation ID. Exception events contain a bounded error message. Logs must not contain headers, cookies, authorization values, bodies, proof locations, transaction references, email addresses, or phone numbers. If any appears, treat it as a privacy incident: restrict log access, preserve minimal evidence, rotate affected credentials, and patch redaction before normal operation resumes.

## Dependency response

PostgreSQL unavailable:

```bash
docker compose -f compose.prod.yaml ps postgres
docker compose -f compose.prod.yaml logs --since 15m postgres
docker compose -f compose.prod.yaml exec postgres pg_isready -U courtlink -d courtlink
```

Redis unavailable:

```bash
docker compose -f compose.prod.yaml ps redis
docker compose -f compose.prod.yaml logs --since 15m redis
docker compose -f compose.prod.yaml exec redis redis-cli ping
```

Restart only the failed dependency after preserving relevant logs:

```bash
docker compose -f compose.prod.yaml restart postgres
docker compose -f compose.prod.yaml restart redis
```

Confirm readiness and inspect queues after recovery. Do not restart both datastores together unless both are independently unhealthy.

## Capacity response

- `PROCESS_HEAP_WARNING` or `PROCESS_HEAP_CRITICAL`: inspect request volume and repeated errors, then restart only `api` if pressure remains after traffic subsides. Increase the Compose memory limit only after confirming host headroom.
- `EVENT_LOOP_WARNING` or `EVENT_LOOP_CRITICAL`: inspect slow request events and database latency. Avoid repeated restarts that hide the cause.
- `DATABASE_CAPACITY_WARNING` or `DATABASE_CAPACITY_CRITICAL`: inspect database size and host volume usage, verify backup completion, remove only approved obsolete data, or expand/migrate the volume.
- `REDIS_MEMORY_WARNING` or `REDIS_MEMORY_CRITICAL`: inspect queue counts and retained failures. Resolve queue buildup before increasing memory. The `noeviction` policy intentionally fails writes instead of silently losing jobs.
- `QUEUE_FAILURES_WARNING` or `QUEUE_FAILURES_CRITICAL`: follow `docs/runbooks/queue-recovery.md`.

Check host and Docker disk usage without enumerating application data:

```bash
df -h
docker system df
```

Do not run image, volume, or database cleanup commands without separately confirming the exact targets and current backup state.

## Incident record

Record start/end times in UTC, alert codes, affected services, correlation IDs, impact, actions, verification evidence, and follow-up changes. Exclude all personal and payment data. Create an ADR when remediation changes architecture or operational policy.
