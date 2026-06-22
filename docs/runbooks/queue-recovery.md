# Queue Recovery

## Safety rules

BullMQ retries scheduled work three times with exponential backoff. Exhausted jobs remain in the queue's failed set as the initial dead-letter store. The admin operations page shows only sanitized metadata; job payloads may contain operational timestamps and must not be copied into tickets or chat.

Repair the dependency or code fault before retrying a job. Scheduled jobs are idempotent, but repeated retries during an outage create noise and can delay healthy work.

## Inspect

Review `/admin/operations`, then list sanitized failed-job metadata from inside the worker container:

```bash
docker compose -f compose.prod.yaml exec worker node --input-type=module -e '
  import { Queue } from "bullmq";
  import { Redis } from "ioredis";
  const connection = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
  const queue = new Queue(process.argv[1], { connection });
  const jobs = await queue.getFailed(0, 19);
  console.log(JSON.stringify(jobs.map(({ id, name, attemptsMade, finishedOn }) => ({ id, name, attemptsMade, finishedOn }))));
  await queue.close(); await connection.quit();
' court.holds.expiry
```

Allowed queue names are `court.holds.expiry`, `court.reviews.escalation`, and `bookings.completion`.

## Retry one job

After resolving the cause, retry an explicitly identified failed job:

```bash
docker compose -f compose.prod.yaml exec worker node --input-type=module -e '
  import { Queue } from "bullmq";
  import { Redis } from "ioredis";
  const connection = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
  const queue = new Queue(process.argv[1], { connection });
  const job = await queue.getJob(process.argv[2]);
  if (!job || !(await job.isFailed())) throw new Error("Specified failed job was not found");
  await job.retry("failed");
  console.log(JSON.stringify({ retried: true, queue: queue.name, jobId: job.id }));
  await queue.close(); await connection.quit();
' court.holds.expiry JOB_ID
```

Confirm the failed count decreases and the corresponding completion event appears. If the job fails again, stop retrying and reopen root-cause investigation.

## Remove one retained failure

Removal is appropriate only after the job's effect is confirmed complete by another idempotent run or the job is documented as obsolete. Obtain a second operator's review when available.

```bash
docker compose -f compose.prod.yaml exec worker node --input-type=module -e '
  import { Queue } from "bullmq";
  import { Redis } from "ioredis";
  const connection = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
  const queue = new Queue(process.argv[1], { connection });
  const job = await queue.getJob(process.argv[2]);
  if (!job || !(await job.isFailed())) throw new Error("Specified failed job was not found");
  await job.remove();
  console.log(JSON.stringify({ removed: true, queue: queue.name, jobId: process.argv[2] }));
  await queue.close(); await connection.quit();
' court.holds.expiry JOB_ID
```

Never bulk-delete failed jobs during an active incident.
