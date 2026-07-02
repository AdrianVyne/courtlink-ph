-- CreateTable
CREATE TABLE "venue_photos" (
    "id" UUID NOT NULL,
    "venueId" UUID NOT NULL,
    "objectKey" TEXT NOT NULL,
    "altText" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "venue_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "venue_photos_venueId_idx" ON "venue_photos"("venueId");

-- CreateIndex
CREATE UNIQUE INDEX "venue_photos_venueId_position_key" ON "venue_photos"("venueId", "position");

-- AddForeignKey
ALTER TABLE "venue_photos" ADD CONSTRAINT "venue_photos_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
