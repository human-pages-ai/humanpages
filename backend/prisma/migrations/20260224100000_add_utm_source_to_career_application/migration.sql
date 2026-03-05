-- AlterTable: add utmSource column to CareerApplication
ALTER TABLE "CareerApplication" ADD COLUMN IF NOT EXISTS "utmSource" TEXT;
