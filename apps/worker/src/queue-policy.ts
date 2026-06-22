import type { JobsOptions } from "bullmq";

export const SCHEDULED_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: "exponential", delay: 5_000 },
  removeOnComplete: 50,
  removeOnFail: false,
} satisfies JobsOptions;

export interface FailedJobLike {
  id?: string;
  name: string;
  attemptsMade: number;
  opts: { attempts?: number };
}

export function isExhausted(job: FailedJobLike): boolean {
  return job.attemptsMade >= (job.opts.attempts ?? 1);
}

export function buildFailedJobEvent(queue: string, job: FailedJobLike): Record<string, unknown> {
  return {
    event: isExhausted(job) ? "dead-letter.retained" : "job.retrying",
    queue,
    jobId: job.id,
    jobName: job.name,
    attemptsMade: job.attemptsMade,
  };
}
