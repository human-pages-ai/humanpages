-- AlterEnum: add PENDING_RECONFIRM to ApplicationStatus
ALTER TYPE "ApplicationStatus" ADD VALUE 'PENDING_RECONFIRM';

-- AlterTable: add listingSnapshot to ListingApplication
ALTER TABLE "ListingApplication" ADD COLUMN "listingSnapshot" JSONB;
