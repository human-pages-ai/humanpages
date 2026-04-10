-- Add arbitrator approval gate
ALTER TABLE "Agent" ADD COLUMN "arbitratorApproved" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Agent" ADD COLUMN "arbitratorApprovedAt" TIMESTAMP(3);

-- Backfill: approve all existing arbitrators so they aren't locked out on deploy
UPDATE "Agent"
SET "arbitratorApproved" = true,
    "arbitratorApprovedAt" = NOW()
WHERE "isArbitrator" = true;
