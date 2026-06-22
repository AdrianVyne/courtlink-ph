-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED');

-- AlterTable
ALTER TABLE "business_memberships"
  ADD COLUMN "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "updatedAt" TIMESTAMPTZ(3);

UPDATE "business_memberships" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;

ALTER TABLE "business_memberships" ALTER COLUMN "updatedAt" SET NOT NULL;

-- CreateTable
CREATE TABLE "staff_invitations" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role" "OrganizationRole" NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "tokenHash" TEXT NOT NULL,
    "invitedById" UUID NOT NULL,
    "acceptedById" UUID,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "staff_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_invitations_tokenHash_key" ON "staff_invitations"("tokenHash");

-- CreateIndex
CREATE INDEX "staff_invitations_businessId_status_idx" ON "staff_invitations"("businessId", "status");

-- CreateIndex
CREATE INDEX "staff_invitations_email_idx" ON "staff_invitations"("email");

-- AddForeignKey
ALTER TABLE "staff_invitations" ADD CONSTRAINT "staff_invitations_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
