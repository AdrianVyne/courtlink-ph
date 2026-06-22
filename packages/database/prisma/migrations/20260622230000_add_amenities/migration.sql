-- CreateEnum
CREATE TYPE "AmenityScope" AS ENUM ('VENUE', 'COURT', 'BOTH');

-- CreateTable
CREATE TABLE "amenities" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scope" "AmenityScope" NOT NULL DEFAULT 'BOTH',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "amenities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "amenities_key_key" ON "amenities"("key");

-- CreateTable
CREATE TABLE "venue_amenities" (
    "venueId" UUID NOT NULL,
    "amenityId" UUID NOT NULL,

    CONSTRAINT "venue_amenities_pkey" PRIMARY KEY ("venueId", "amenityId")
);

-- CreateIndex
CREATE INDEX "venue_amenities_amenityId_idx" ON "venue_amenities"("amenityId");

-- CreateTable
CREATE TABLE "court_amenities" (
    "courtId" UUID NOT NULL,
    "amenityId" UUID NOT NULL,

    CONSTRAINT "court_amenities_pkey" PRIMARY KEY ("courtId", "amenityId")
);

-- CreateIndex
CREATE INDEX "court_amenities_amenityId_idx" ON "court_amenities"("amenityId");

-- AddForeignKey
ALTER TABLE "venue_amenities" ADD CONSTRAINT "venue_amenities_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_amenities" ADD CONSTRAINT "venue_amenities_amenityId_fkey" FOREIGN KEY ("amenityId") REFERENCES "amenities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "court_amenities" ADD CONSTRAINT "court_amenities_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "courts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "court_amenities" ADD CONSTRAINT "court_amenities_amenityId_fkey" FOREIGN KEY ("amenityId") REFERENCES "amenities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed the standard amenity catalog
INSERT INTO "amenities" ("id", "key", "name", "scope") VALUES
  (gen_random_uuid(), 'PARKING', 'Parking', 'VENUE'),
  (gen_random_uuid(), 'SHOWERS', 'Showers', 'VENUE'),
  (gen_random_uuid(), 'LOCKER_ROOM', 'Locker room', 'VENUE'),
  (gen_random_uuid(), 'PRO_SHOP', 'Pro shop', 'VENUE'),
  (gen_random_uuid(), 'CAFE', 'Cafe', 'VENUE'),
  (gen_random_uuid(), 'RESTROOMS', 'Restrooms', 'VENUE'),
  (gen_random_uuid(), 'WATER_STATION', 'Water station', 'VENUE'),
  (gen_random_uuid(), 'EQUIPMENT_RENTAL', 'Equipment rental', 'VENUE'),
  (gen_random_uuid(), 'WHEELCHAIR_ACCESS', 'Wheelchair access', 'VENUE'),
  (gen_random_uuid(), 'INDOOR', 'Indoor court', 'COURT'),
  (gen_random_uuid(), 'COURT_LIGHTS', 'Court lighting', 'COURT'),
  (gen_random_uuid(), 'COVERED', 'Covered court', 'COURT'),
  (gen_random_uuid(), 'PREMIUM_SURFACE', 'Premium surface', 'COURT'),
  (gen_random_uuid(), 'AIR_CONDITIONED', 'Air conditioned', 'COURT');
