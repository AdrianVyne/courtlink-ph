-- AlterTable
ALTER TABLE "coach_bookings" ADD COLUMN     "reviewEscalatedAt" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "court_bookings" ADD COLUMN     "reviewEscalatedAt" TIMESTAMPTZ(3);
