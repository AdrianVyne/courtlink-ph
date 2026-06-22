import type { Prisma, PrismaClient } from "@courtlink/database";
import type { Redis } from "ioredis";
import { Queue, Worker } from "bullmq";
import { SCHEDULED_JOB_OPTIONS } from "./queue-policy.js";

export const REVIEW_ESCALATION_QUEUE = "court.reviews.escalation";

export interface EscalationJobData {
  triggeredAt: string;
}

export interface NotificationDraft {
  userId: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
}

// Pure helper: given an overdue booking and its recipients, produce the
// per-recipient notification drafts. Recipients are deduped so an owner who is
// also a super admin is notified once.
export function buildEscalationNotifications(input: {
  scope: "court" | "coach";
  bookingId: string;
  recipientUserIds: string[];
}): NotificationDraft[] {
  const unique = [...new Set(input.recipientUserIds.filter(Boolean))];
  const type = input.scope === "court" ? "COURT_REVIEW_OVERDUE" : "COACH_REVIEW_OVERDUE";
  const label = input.scope === "court" ? "court booking" : "coaching session";
  return unique.map((userId) => ({
    userId,
    type,
    title: "Payment proof review overdue",
    body: `A ${label} payment proof has been awaiting review for over two hours.`,
    data: { bookingId: input.bookingId, scope: input.scope },
  }));
}

async function superAdminIds(prisma: PrismaClient): Promise<string[]> {
  const rows = await prisma.userPlatformRole.findMany({
    where: { role: "SUPER_ADMIN" },
    select: { userId: true },
  });
  return rows.map((row) => row.userId);
}

async function courtVenueStaffIds(prisma: PrismaClient, courtId: string): Promise<string[]> {
  const court = await prisma.court.findUnique({
    where: { id: courtId },
    select: { venue: { select: { businessId: true } } },
  });
  if (!court) return [];
  const members = await prisma.businessMembership.findMany({
    where: { businessId: court.venue.businessId },
    select: { userId: true },
  });
  return members.map((m) => m.userId);
}

async function coachUserId(prisma: PrismaClient, coachId: string): Promise<string[]> {
  const profile = await prisma.coachProfile.findUnique({
    where: { id: coachId },
    select: { userId: true },
  });
  return profile ? [profile.userId] : [];
}

// Finds proof submissions whose 2-hour review window has lapsed and notifies the
// responsible parties exactly once (reviewEscalatedAt guards re-runs).
export async function escalateOverdueReviews(
  prisma: PrismaClient,
  now: Date,
): Promise<{ courts: number; coaches: number }> {
  const admins = await superAdminIds(prisma);

  const courtBookings = await prisma.courtBooking.findMany({
    where: { status: "PROOF_SUBMITTED", reviewDueAt: { lt: now }, reviewEscalatedAt: null },
    select: { id: true, courtId: true },
    take: 100,
  });
  let courts = 0;
  for (const booking of courtBookings) {
    const staff = await courtVenueStaffIds(prisma, booking.courtId);
    const drafts = buildEscalationNotifications({
      scope: "court",
      bookingId: booking.id,
      recipientUserIds: [...staff, ...admins],
    });
    await prisma.$transaction([
      prisma.notification.createMany({ data: drafts as Prisma.NotificationCreateManyInput[] }),
      prisma.courtBooking.update({ where: { id: booking.id }, data: { reviewEscalatedAt: now } }),
    ]);
    courts += 1;
  }

  const coachBookings = await prisma.coachBooking.findMany({
    where: { status: "PROOF_SUBMITTED", reviewDueAt: { lt: now }, reviewEscalatedAt: null },
    select: { id: true, coachId: true },
    take: 100,
  });
  let coaches = 0;
  for (const booking of coachBookings) {
    const coach = await coachUserId(prisma, booking.coachId);
    const drafts = buildEscalationNotifications({
      scope: "coach",
      bookingId: booking.id,
      recipientUserIds: [...coach, ...admins],
    });
    await prisma.$transaction([
      prisma.notification.createMany({ data: drafts as Prisma.NotificationCreateManyInput[] }),
      prisma.coachBooking.update({ where: { id: booking.id }, data: { reviewEscalatedAt: now } }),
    ]);
    coaches += 1;
  }

  return { courts, coaches };
}

export function buildReviewEscalationQueue(connection: Redis): Queue<EscalationJobData> {
  return new Queue<EscalationJobData>(REVIEW_ESCALATION_QUEUE, { connection });
}

export async function scheduleReviewEscalation(queue: Queue<EscalationJobData>): Promise<void> {
  await queue.upsertJobScheduler(
    `${REVIEW_ESCALATION_QUEUE}.every-60s`,
    { every: 60_000 },
    {
      name: "review-escalation",
      data: { triggeredAt: new Date().toISOString() },
      opts: SCHEDULED_JOB_OPTIONS,
    },
  );
}

export function buildReviewEscalationWorker(
  connection: Redis,
  prisma: PrismaClient,
): Worker<EscalationJobData, { courts: number; coaches: number }> {
  return new Worker<EscalationJobData, { courts: number; coaches: number }>(
    REVIEW_ESCALATION_QUEUE,
    async () => escalateOverdueReviews(prisma, new Date()),
    { connection },
  );
}
