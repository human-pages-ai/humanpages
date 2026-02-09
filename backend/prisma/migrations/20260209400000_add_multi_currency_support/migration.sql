-- AlterTable: Add currency fields to Human
ALTER TABLE "Human" ADD COLUMN "rateCurrency" TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE "Human" ADD COLUMN "minRateUsdEstimate" DECIMAL(18,6);

-- AlterTable: Add currency field to Service
ALTER TABLE "Service" ADD COLUMN "priceCurrency" TEXT NOT NULL DEFAULT 'USD';

-- Backfill: For existing rows with USD, minRateUsdEstimate = minRateUsdc
UPDATE "Human" SET "minRateUsdEstimate" = "minRateUsdc" WHERE "minRateUsdc" IS NOT NULL;
