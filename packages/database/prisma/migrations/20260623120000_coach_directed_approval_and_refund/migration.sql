-- Extend coach request lifecycle with explicit directed-approval states.
ALTER TYPE "CoachRequestStatus" ADD VALUE IF NOT EXISTS 'PENDING_COACH' BEFORE 'OPEN';
ALTER TYPE "CoachRequestStatus" ADD VALUE IF NOT EXISTS 'DECLINED' BEFORE 'EXPIRED';

-- Record when a coach refund is approved or rejected.
ALTER TABLE "coach_refunds" ADD COLUMN "decidedAt" TIMESTAMPTZ(3);
