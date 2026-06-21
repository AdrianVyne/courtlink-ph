-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('PLAYER', 'COACH', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "OrganizationRole" AS ENUM ('OWNER', 'MANAGER', 'STAFF');

-- CreateEnum
CREATE TYPE "VenueStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "CoachVerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('HELD', 'PROOF_SUBMITTED', 'CONFIRMED', 'REJECTED', 'EXPIRED', 'CANCELLED', 'COMPLETED', 'REFUND_REQUESTED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentChannel" AS ENUM ('GCASH', 'MAYA', 'QR_PH', 'BANK_TRANSFER', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentProofStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "CoachRequestStatus" AS ENUM ('OPEN', 'MATCHED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "CoachOfferStatus" AS ENUM ('ACTIVE', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarObjectKey" TEXT,
    "emailVerifiedAt" TIMESTAMPTZ(3),
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_platform_roles" (
    "userId" UUID NOT NULL,
    "role" "PlatformRole" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_platform_roles_pkey" PRIMARY KEY ("userId","role")
);

-- CreateTable
CREATE TABLE "password_credentials" (
    "userId" UUID NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "password_credentials_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "oauth_accounts" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "businesses" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "businesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_memberships" (
    "businessId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "OrganizationRole" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_memberships_pkey" PRIMARY KEY ("businessId","userId")
);

-- CreateTable
CREATE TABLE "venues" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "status" "VenueStatus" NOT NULL DEFAULT 'DRAFT',
    "regionCode" TEXT NOT NULL,
    "provinceCode" TEXT,
    "cityMunicipality" TEXT NOT NULL,
    "barangay" TEXT,
    "streetAddress" TEXT NOT NULL,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Manila',
    "approvedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "venues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venue_payment_methods" (
    "id" UUID NOT NULL,
    "venueId" UUID NOT NULL,
    "channel" "PaymentChannel" NOT NULL,
    "label" TEXT NOT NULL,
    "encryptedDetails" TEXT NOT NULL,
    "qrObjectKey" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "venue_payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courts" (
    "id" UUID NOT NULL,
    "venueId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "indoor" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "slotIncrementMin" INTEGER NOT NULL DEFAULT 30,
    "minimumDurationMin" INTEGER NOT NULL DEFAULT 60,
    "maximumDurationMin" INTEGER NOT NULL DEFAULT 240,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "courts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "court_operating_hours" (
    "id" UUID NOT NULL,
    "courtId" UUID NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "opensMinute" INTEGER NOT NULL,
    "closesMinute" INTEGER NOT NULL,

    CONSTRAINT "court_operating_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "court_closures" (
    "id" UUID NOT NULL,
    "courtId" UUID NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "reason" TEXT,

    CONSTRAINT "court_closures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "court_pricing_rules" (
    "id" UUID NOT NULL,
    "courtId" UUID NOT NULL,
    "dayOfWeek" INTEGER,
    "startsMinute" INTEGER NOT NULL,
    "endsMinute" INTEGER NOT NULL,
    "pricePerHour" DECIMAL(12,2) NOT NULL,
    "effectiveFrom" TIMESTAMPTZ(3),
    "effectiveUntil" TIMESTAMPTZ(3),
    "priority" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "court_pricing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "court_bookings" (
    "id" UUID NOT NULL,
    "courtId" UUID NOT NULL,
    "playerId" UUID NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'HELD',
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Manila',
    "quotedAmount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PHP',
    "proofDeadline" TIMESTAMPTZ(3) NOT NULL,
    "reviewDueAt" TIMESTAMPTZ(3),
    "cancellationCause" TEXT,
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "court_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "court_payment_submissions" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "channel" "PaymentChannel" NOT NULL,
    "transactionRef" TEXT NOT NULL,
    "proofObjectKey" TEXT NOT NULL,
    "status" "PaymentProofStatus" NOT NULL DEFAULT 'PENDING',
    "submittedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMPTZ(3),
    "reviewedById" UUID,
    "reviewReason" TEXT,

    CONSTRAINT "court_payment_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "court_refunds" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'REQUESTED',
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "channel" "PaymentChannel",
    "transactionRef" TEXT,
    "requestedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),

    CONSTRAINT "court_refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coach_profiles" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "bio" TEXT,
    "experience" TEXT,
    "hourlyRate" DECIMAL(12,2) NOT NULL,
    "verificationStatus" "CoachVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "coach_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coach_availability" (
    "id" UUID NOT NULL,
    "coachId" UUID NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "location" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "coach_availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coach_payment_methods" (
    "id" UUID NOT NULL,
    "coachId" UUID NOT NULL,
    "channel" "PaymentChannel" NOT NULL,
    "label" TEXT NOT NULL,
    "encryptedDetails" TEXT NOT NULL,
    "qrObjectKey" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "coach_payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coach_requests" (
    "id" UUID NOT NULL,
    "playerId" UUID NOT NULL,
    "targetCoachId" UUID,
    "status" "CoachRequestStatus" NOT NULL DEFAULT 'OPEN',
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "location" TEXT NOT NULL,
    "groupSize" INTEGER NOT NULL,
    "skillLevel" TEXT NOT NULL,
    "goals" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "coach_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coach_offers" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "coachId" UUID NOT NULL,
    "status" "CoachOfferStatus" NOT NULL DEFAULT 'ACTIVE',
    "amount" DECIMAL(12,2) NOT NULL,
    "message" TEXT,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "coach_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coach_bookings" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "offerId" UUID NOT NULL,
    "coachId" UUID NOT NULL,
    "playerId" UUID NOT NULL,
    "status" "BookingStatus" NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "location" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PHP',
    "proofDeadline" TIMESTAMPTZ(3),
    "reviewDueAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "coach_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coach_payment_submissions" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "channel" "PaymentChannel" NOT NULL,
    "transactionRef" TEXT NOT NULL,
    "proofObjectKey" TEXT NOT NULL,
    "status" "PaymentProofStatus" NOT NULL DEFAULT 'PENDING',
    "submittedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMPTZ(3),
    "reviewReason" TEXT,

    CONSTRAINT "coach_payment_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coach_refunds" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'REQUESTED',
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "channel" "PaymentChannel",
    "transactionRef" TEXT,
    "requestedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(3),

    CONSTRAINT "coach_refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "readAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "venueId" UUID,
    "coachId" UUID,
    "courtBookingId" UUID,
    "coachBookingId" UUID,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorite_venues" (
    "userId" UUID NOT NULL,
    "venueId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorite_venues_pkey" PRIMARY KEY ("userId","venueId")
);

-- CreateTable
CREATE TABLE "promotions" (
    "id" UUID NOT NULL,
    "venueId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "discountType" TEXT NOT NULL,
    "discountValue" DECIMAL(12,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moderation_cases" (
    "id" UUID NOT NULL,
    "reporterId" UUID NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ModerationStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "moderation_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "action" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "businessId" UUID,
    "correlationId" TEXT,
    "metadata" JSONB,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "oauth_accounts_userId_idx" ON "oauth_accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_accounts_provider_providerAccountId_key" ON "oauth_accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_tokenHash_key" ON "sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "sessions_userId_expiresAt_idx" ON "sessions"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_tokenHash_key" ON "verification_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "verification_tokens_email_purpose_idx" ON "verification_tokens"("email", "purpose");

-- CreateIndex
CREATE INDEX "business_memberships_userId_idx" ON "business_memberships"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "venues_slug_key" ON "venues"("slug");

-- CreateIndex
CREATE INDEX "venues_businessId_idx" ON "venues"("businessId");

-- CreateIndex
CREATE INDEX "venues_status_regionCode_cityMunicipality_idx" ON "venues"("status", "regionCode", "cityMunicipality");

-- CreateIndex
CREATE INDEX "venue_payment_methods_venueId_active_idx" ON "venue_payment_methods"("venueId", "active");

-- CreateIndex
CREATE INDEX "courts_venueId_active_idx" ON "courts"("venueId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "courts_venueId_name_key" ON "courts"("venueId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "court_operating_hours_courtId_dayOfWeek_opensMinute_key" ON "court_operating_hours"("courtId", "dayOfWeek", "opensMinute");

-- CreateIndex
CREATE INDEX "court_closures_courtId_startsAt_endsAt_idx" ON "court_closures"("courtId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "court_pricing_rules_courtId_dayOfWeek_priority_idx" ON "court_pricing_rules"("courtId", "dayOfWeek", "priority");

-- CreateIndex
CREATE INDEX "court_bookings_courtId_startsAt_endsAt_idx" ON "court_bookings"("courtId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "court_bookings_playerId_createdAt_idx" ON "court_bookings"("playerId", "createdAt");

-- CreateIndex
CREATE INDEX "court_bookings_status_proofDeadline_idx" ON "court_bookings"("status", "proofDeadline");

-- CreateIndex
CREATE INDEX "court_bookings_status_reviewDueAt_idx" ON "court_bookings"("status", "reviewDueAt");

-- CreateIndex
CREATE INDEX "court_payment_submissions_bookingId_status_idx" ON "court_payment_submissions"("bookingId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "court_payment_submissions_channel_transactionRef_key" ON "court_payment_submissions"("channel", "transactionRef");

-- CreateIndex
CREATE INDEX "court_refunds_bookingId_status_idx" ON "court_refunds"("bookingId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "coach_profiles_userId_key" ON "coach_profiles"("userId");

-- CreateIndex
CREATE INDEX "coach_profiles_active_verificationStatus_idx" ON "coach_profiles"("active", "verificationStatus");

-- CreateIndex
CREATE INDEX "coach_availability_coachId_startsAt_endsAt_idx" ON "coach_availability"("coachId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "coach_payment_methods_coachId_active_idx" ON "coach_payment_methods"("coachId", "active");

-- CreateIndex
CREATE INDEX "coach_requests_status_startsAt_idx" ON "coach_requests"("status", "startsAt");

-- CreateIndex
CREATE INDEX "coach_requests_playerId_createdAt_idx" ON "coach_requests"("playerId", "createdAt");

-- CreateIndex
CREATE INDEX "coach_offers_requestId_status_expiresAt_idx" ON "coach_offers"("requestId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "coach_offers_coachId_status_idx" ON "coach_offers"("coachId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "coach_offers_requestId_coachId_key" ON "coach_offers"("requestId", "coachId");

-- CreateIndex
CREATE UNIQUE INDEX "coach_bookings_requestId_key" ON "coach_bookings"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "coach_bookings_offerId_key" ON "coach_bookings"("offerId");

-- CreateIndex
CREATE INDEX "coach_bookings_coachId_startsAt_endsAt_idx" ON "coach_bookings"("coachId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "coach_bookings_playerId_createdAt_idx" ON "coach_bookings"("playerId", "createdAt");

-- CreateIndex
CREATE INDEX "coach_bookings_status_reviewDueAt_idx" ON "coach_bookings"("status", "reviewDueAt");

-- CreateIndex
CREATE INDEX "coach_payment_submissions_bookingId_status_idx" ON "coach_payment_submissions"("bookingId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "coach_payment_submissions_channel_transactionRef_key" ON "coach_payment_submissions"("channel", "transactionRef");

-- CreateIndex
CREATE INDEX "coach_refunds_bookingId_status_idx" ON "coach_refunds"("bookingId", "status");

-- CreateIndex
CREATE INDEX "notifications_userId_readAt_createdAt_idx" ON "notifications"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_courtBookingId_key" ON "reviews"("courtBookingId");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_coachBookingId_key" ON "reviews"("coachBookingId");

-- CreateIndex
CREATE INDEX "reviews_venueId_createdAt_idx" ON "reviews"("venueId", "createdAt");

-- CreateIndex
CREATE INDEX "reviews_coachId_createdAt_idx" ON "reviews"("coachId", "createdAt");

-- CreateIndex
CREATE INDEX "promotions_venueId_active_startsAt_endsAt_idx" ON "promotions"("venueId", "active", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "moderation_cases_status_createdAt_idx" ON "moderation_cases"("status", "createdAt");

-- CreateIndex
CREATE INDEX "moderation_cases_subjectType_subjectId_idx" ON "moderation_cases"("subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "audit_events_subjectType_subjectId_occurredAt_idx" ON "audit_events"("subjectType", "subjectId", "occurredAt");

-- CreateIndex
CREATE INDEX "audit_events_businessId_occurredAt_idx" ON "audit_events"("businessId", "occurredAt");

-- CreateIndex
CREATE INDEX "audit_events_actorId_occurredAt_idx" ON "audit_events"("actorId", "occurredAt");

-- AddForeignKey
ALTER TABLE "user_platform_roles" ADD CONSTRAINT "user_platform_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_credentials" ADD CONSTRAINT "password_credentials_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_memberships" ADD CONSTRAINT "business_memberships_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_memberships" ADD CONSTRAINT "business_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venues" ADD CONSTRAINT "venues_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_payment_methods" ADD CONSTRAINT "venue_payment_methods_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courts" ADD CONSTRAINT "courts_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "court_operating_hours" ADD CONSTRAINT "court_operating_hours_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "courts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "court_closures" ADD CONSTRAINT "court_closures_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "courts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "court_pricing_rules" ADD CONSTRAINT "court_pricing_rules_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "courts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "court_bookings" ADD CONSTRAINT "court_bookings_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "courts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "court_bookings" ADD CONSTRAINT "court_bookings_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "court_payment_submissions" ADD CONSTRAINT "court_payment_submissions_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "court_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "court_refunds" ADD CONSTRAINT "court_refunds_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "court_bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_profiles" ADD CONSTRAINT "coach_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_availability" ADD CONSTRAINT "coach_availability_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "coach_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_payment_methods" ADD CONSTRAINT "coach_payment_methods_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "coach_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_requests" ADD CONSTRAINT "coach_requests_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_offers" ADD CONSTRAINT "coach_offers_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "coach_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_offers" ADD CONSTRAINT "coach_offers_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "coach_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_bookings" ADD CONSTRAINT "coach_bookings_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "coach_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_bookings" ADD CONSTRAINT "coach_bookings_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "coach_offers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_bookings" ADD CONSTRAINT "coach_bookings_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "coach_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_bookings" ADD CONSTRAINT "coach_bookings_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_payment_submissions" ADD CONSTRAINT "coach_payment_submissions_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "coach_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_refunds" ADD CONSTRAINT "coach_refunds_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "coach_bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "coach_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_courtBookingId_fkey" FOREIGN KEY ("courtBookingId") REFERENCES "court_bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_coachBookingId_fkey" FOREIGN KEY ("coachBookingId") REFERENCES "coach_bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorite_venues" ADD CONSTRAINT "favorite_venues_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorite_venues" ADD CONSTRAINT "favorite_venues_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_cases" ADD CONSTRAINT "moderation_cases_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CourtLink invariants that Prisma cannot express declaratively.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "courts"
  ADD CONSTRAINT "courts_duration_bounds_check"
  CHECK (
    "slotIncrementMin" > 0
    AND "minimumDurationMin" > 0
    AND "maximumDurationMin" >= "minimumDurationMin"
  );

ALTER TABLE "court_operating_hours"
  ADD CONSTRAINT "court_operating_hours_minute_range_check"
  CHECK (
    "dayOfWeek" BETWEEN 0 AND 6
    AND "opensMinute" BETWEEN 0 AND 1439
    AND "closesMinute" BETWEEN 1 AND 1440
    AND "closesMinute" > "opensMinute"
  );

ALTER TABLE "court_closures"
  ADD CONSTRAINT "court_closures_positive_range_check"
  CHECK ("endsAt" > "startsAt");

ALTER TABLE "court_bookings"
  ADD CONSTRAINT "court_bookings_positive_range_check"
  CHECK ("endsAt" > "startsAt");

ALTER TABLE "court_bookings"
  ADD CONSTRAINT "court_bookings_no_active_overlap"
  EXCLUDE USING gist (
    "courtId" WITH =,
    tstzrange("startsAt", "endsAt", '[)') WITH &&
  )
  WHERE ("status" IN ('HELD', 'PROOF_SUBMITTED', 'CONFIRMED'));

ALTER TABLE "coach_availability"
  ADD CONSTRAINT "coach_availability_positive_range_check"
  CHECK ("endsAt" > "startsAt");

ALTER TABLE "coach_requests"
  ADD CONSTRAINT "coach_requests_positive_range_check"
  CHECK ("endsAt" > "startsAt" AND "groupSize" > 0);

ALTER TABLE "coach_offers"
  ADD CONSTRAINT "coach_offers_positive_amount_check"
  CHECK ("amount" >= 0);

ALTER TABLE "coach_bookings"
  ADD CONSTRAINT "coach_bookings_positive_range_check"
  CHECK ("endsAt" > "startsAt");

ALTER TABLE "coach_bookings"
  ADD CONSTRAINT "coach_bookings_no_active_overlap"
  EXCLUDE USING gist (
    "coachId" WITH =,
    tstzrange("startsAt", "endsAt", '[)') WITH &&
  )
  WHERE ("status" IN ('HELD', 'PROOF_SUBMITTED', 'CONFIRMED'));

ALTER TABLE "reviews"
  ADD CONSTRAINT "reviews_rating_check"
  CHECK ("rating" BETWEEN 1 AND 5);
