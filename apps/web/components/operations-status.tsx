import type { OperationsStatusSnapshot } from "../lib/api";

function percent(value: number | null): string {
  return value === null ? "Not configured" : `${(value * 100).toFixed(1)}%`;
}

function bytes(value: number): string {
  if (value < 1024) return `${value} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let amount = value;
  let unit = -1;
  do {
    amount /= 1024;
    unit += 1;
  } while (amount >= 1024 && unit < units.length - 1);
  return `${amount.toFixed(1)} ${units[unit]}`;
}

const pillBase =
  "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide";

const overallTones = {
  ok: "bg-success-bg text-success-fg",
  warning: "bg-pending-bg text-pending-fg",
  critical: "bg-danger-bg text-danger-fg",
} as const;

const alertTones = {
  warning: "border-[#e7c76f] bg-[#fff4d6] text-[#7b5000]",
  critical: "border-[#f1b5b0] bg-danger-bg text-danger-fg",
} as const;

const sectionTitle = "mb-4 mt-8 text-[1.15rem] font-bold text-ink-900";
const cardClasses =
  "flex flex-col gap-[0.35rem] rounded-[12px] border border-sand-200 bg-white p-4 [&_small]:text-ink-500 [&_span]:text-ink-500";
const gridClasses = "grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(230px,1fr))]";

export function OperationsStatus({ snapshot }: { snapshot: OperationsStatusSnapshot }) {
  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-wrap items-center gap-3 text-ink-500">
        <span className={`${pillBase} ${overallTones[snapshot.overall]}`}>
          Operational {snapshot.overall}
        </span>
        <span>Captured {new Date(snapshot.capturedAt).toLocaleString("en-PH")}</span>
      </section>

      {snapshot.alerts.length > 0 ? (
        <section aria-labelledby="active-alerts">
          <h2 className={sectionTitle} id="active-alerts">
            Active alerts
          </h2>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {snapshot.alerts.map((alert) => (
              <li
                className={`flex flex-col gap-[0.2rem] rounded-[10px] border px-4 py-3 ${alertTones[alert.level]}`}
                key={alert.code}
              >
                <strong>{alert.code}</strong>
                <span>{alert.message}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="dependencies">
        <h2 className={sectionTitle} id="dependencies">
          Dependencies and capacity
        </h2>
        <div className={gridClasses}>
          <article className={cardClasses}>
            <strong>PostgreSQL</strong>
            <span>{snapshot.dependencies.database ? "Ready" : "Unavailable"}</span>
            <span>{percent(snapshot.metrics.databaseRatio)} of budget</span>
            <small>{bytes(snapshot.database.usedBytes)} used</small>
          </article>
          <article className={cardClasses}>
            <strong>Redis</strong>
            <span>{snapshot.dependencies.redis ? "Ready" : "Unavailable"}</span>
            <span>{percent(snapshot.metrics.redisRatio)} of configured limit</span>
            <small>{bytes(snapshot.redis.usedBytes)} used</small>
          </article>
          <article className={cardClasses}>
            <strong>API process</strong>
            <span>{percent(snapshot.metrics.processHeapRatio)} heap</span>
            <span>{snapshot.metrics.eventLoopDelayMs.toFixed(1)} ms event-loop delay</span>
            <small>{snapshot.process.uptimeSeconds}s uptime</small>
          </article>
        </div>
      </section>

      <section aria-labelledby="background-queues">
        <h2 className={sectionTitle} id="background-queues">
          Background queues
        </h2>
        <div className={gridClasses}>
          {snapshot.queues.map((queue) => (
            <article className={cardClasses} key={queue.name}>
              <strong>{queue.name}</strong>
              <span>
                {queue.waiting} waiting / {queue.active} active
              </span>
              <span>
                {queue.delayed} delayed / {queue.failed} failed
              </span>
            </article>
          ))}
        </div>
      </section>

      {snapshot.failedJobs.length > 0 ? (
        <section aria-labelledby="retained-failures">
          <h2 className={sectionTitle} id="retained-failures">
            Retained failures
          </h2>
          <ul className="m-0 flex list-none flex-col gap-[0.6rem] p-0">
            {snapshot.failedJobs.map((job) => (
              <li
                className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-sand-200 bg-white px-4 py-[0.85rem]"
                key={`${job.queue}-${job.id}`}
              >
                <div className="flex flex-col gap-[0.15rem]">
                  <strong>{job.name}</strong>
                  <span className="text-[0.85rem] text-ink-500">
                    {job.queue} / job {job.id}
                  </span>
                  <span className="text-[0.85rem]">{job.error}</span>
                </div>
                <span className={`${pillBase} ${overallTones.critical}`}>
                  {job.attemptsMade} attempts
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
