-- AlterTable
ALTER TABLE "Agent" ADD COLUMN "isVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Agent" ADD COLUMN "verifiedByAdminAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN "isVerified" BOOLEAN NOT NULL DEFAULT false;

-- DropIndex (replace with new composite index)
DROP INDEX IF EXISTS "Listing_status_isPro_createdAt_idx";

-- CreateIndex
CREATE INDEX "Listing_status_isVerified_isPro_createdAt_idx" ON "Listing"("status", "isVerified", "isPro", "createdAt");
