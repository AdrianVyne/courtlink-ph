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

export function OperationsStatus({ snapshot }: { snapshot: OperationsStatusSnapshot }) {
  return (
    <div className="operations-stack">
      <section className="operations-summary">
        <span className={`status-pill status-${snapshot.overall}`}>
          Operational {snapshot.overall}
        </span>
        <span>Captured {new Date(snapshot.capturedAt).toLocaleString("en-PH")}</span>
      </section>

      {snapshot.alerts.length > 0 ? (
        <section aria-labelledby="active-alerts">
          <h2 className="section-title" id="active-alerts">
            Active alerts
          </h2>
          <ul className="operations-alerts">
            {snapshot.alerts.map((alert) => (
              <li className={`operations-alert alert-${alert.level}`} key={alert.code}>
                <strong>{alert.code}</strong>
                <span>{alert.message}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="dependencies">
        <h2 className="section-title" id="dependencies">
          Dependencies and capacity
        </h2>
        <div className="operations-grid">
          <article className="operations-card">
            <strong>PostgreSQL</strong>
            <span>{snapshot.dependencies.database ? "Ready" : "Unavailable"}</span>
            <span>{percent(snapshot.metrics.databaseRatio)} of budget</span>
            <small>{bytes(snapshot.database.usedBytes)} used</small>
          </article>
          <article className="operations-card">
            <strong>Redis</strong>
            <span>{snapshot.dependencies.redis ? "Ready" : "Unavailable"}</span>
            <span>{percent(snapshot.metrics.redisRatio)} of configured limit</span>
            <small>{bytes(snapshot.redis.usedBytes)} used</small>
          </article>
          <article className="operations-card">
            <strong>API process</strong>
            <span>{percent(snapshot.metrics.processHeapRatio)} heap</span>
            <span>{snapshot.metrics.eventLoopDelayMs.toFixed(1)} ms event-loop delay</span>
            <small>{snapshot.process.uptimeSeconds}s uptime</small>
          </article>
        </div>
      </section>

      <section aria-labelledby="background-queues">
        <h2 className="section-title" id="background-queues">
          Background queues
        </h2>
        <div className="operations-grid">
          {snapshot.queues.map((queue) => (
            <article className="operations-card" key={queue.name}>
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
          <h2 className="section-title" id="retained-failures">
            Retained failures
          </h2>
          <ul className="booking-list">
            {snapshot.failedJobs.map((job) => (
              <li className="booking-row" key={`${job.queue}-${job.id}`}>
                <div className="booking-main">
                  <strong>{job.name}</strong>
                  <span className="booking-venue">
                    {job.queue} / job {job.id}
                  </span>
                  <span className="booking-when">{job.error}</span>
                </div>
                <span className="status-pill status-critical">{job.attemptsMade} attempts</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
