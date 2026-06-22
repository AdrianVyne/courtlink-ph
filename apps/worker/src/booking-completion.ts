import type { PrismaClient } from "@courtlink/database";
import { Queue, Worker } from "bullmq";
import type { Redis } from "ioredis";

export const BOOKING_COMPLETION_QUEUE = "bookings.completion";

export interface CompletionJobData {
  triggeredAt: string;
}

// Confirmed bookings become COMPLETED once their end time has passed. This is
// what makes a booking eligible for a review. The status filter keeps the
// transition idempotent across runs.
export async function completePastBookings(
  prisma: PrismaClient,
  now: Date,
): Promise<{ courts: number; coaches: number }> {
  const courts = await prisma.courtBooking.updateMany({
    where: { status: "CONFIRMED", endsAt: { lt: now } },
    data: { status: "COMPLETED" },
  });
  const coaches = await prisma.coachBooking.updateMany({
    where: { status: "CONFIRMED", endsAt: { lt: now } },
    data: { status: "COMPLETED" },
  });
  return { courts: courts.count, coaches: coaches.count };
}

export function buildBookingCompletionQueue(connection: Redis): Queue<CompletionJobData> {
  return new Queue<CompletionJobData>(BOOKING_COMPLETION_QUEUE, { connection });
}

export async function scheduleBookingCompletion(queue: Queue<CompletionJobData>): Promise<void> {
  await queue.upsertJobScheduler(
    `${BOOKING_COMPLETION_QUEUE}.every-5m`,
    { every: 5 * 60_000 },
    {
      name: "booking-completion",
      data: { triggeredAt: new Date().toISOString() },
      opts: { removeOnComplete: 50, removeOnFail: 50 },
    },
  );
}

export function buildBookingCompletionWorker(
  connection: Redis,
  prisma: PrismaClient,
): Worker<CompletionJobData, { courts: number; coaches: number }> {
  return new Worker<CompletionJobData, { courts: number; coaches: number }>(
    BOOKING_COMPLETION_QUEUE,
    async () => completePastBookings(prisma, new Date()),
    { connection },
  );
}
