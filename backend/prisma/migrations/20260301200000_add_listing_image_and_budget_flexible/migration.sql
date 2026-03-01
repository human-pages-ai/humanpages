-- AlterTable: add missing columns to Listing
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "budgetFlexible" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "imageKey" TEXT;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "imageStatus" TEXT NOT NULL DEFAULT 'none';
