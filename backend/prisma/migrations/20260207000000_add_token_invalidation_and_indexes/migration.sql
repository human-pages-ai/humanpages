-- AlterTable: Add tokenInvalidatedAt field to Human
ALTER TABLE "Human" ADD COLUMN "tokenInvalidatedAt" TIMESTAMP(3);

-- AlterTable: Fix decimal precision from (18,2) to (18,6) if not already done
DO $$
BEGIN
    -- Check and alter minRateUsdc if needed
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Human'
        AND column_name = 'minRateUsdc'
        AND numeric_precision != 18 OR numeric_scale != 6
    ) THEN
        ALTER TABLE "Human" ALTER COLUMN "minRateUsdc" TYPE DECIMAL(18,6);
    END IF;

    -- Check and alter minOfferPrice if needed
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Human'
        AND column_name = 'minOfferPrice'
        AND numeric_precision != 18 OR numeric_scale != 6
    ) THEN
        ALTER TABLE "Human" ALTER COLUMN "minOfferPrice" TYPE DECIMAL(18,6);
    END IF;
END $$;

-- CreateIndex: Composite index on Human for availability and last active
CREATE INDEX IF NOT EXISTS "Human_isAvailable_lastActiveAt_idx" ON "Human"("isAvailable", "lastActiveAt");

-- CreateIndex: Composite index on Job for humanId, status, and createdAt
CREATE INDEX IF NOT EXISTS "Job_humanId_status_createdAt_idx" ON "Job"("humanId", "status", "createdAt");

-- CreateIndex: Add missing indexes from previous migration if they don't exist
CREATE INDEX IF NOT EXISTS "Job_status_idx" ON "Job"("status");
CREATE INDEX IF NOT EXISTS "Job_createdAt_idx" ON "Job"("createdAt");
CREATE INDEX IF NOT EXISTS "Review_createdAt_idx" ON "Review"("createdAt");
CREATE INDEX IF NOT EXISTS "Wallet_address_idx" ON "Wallet"("address");
