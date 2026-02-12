-- ERC-8004 Reputation Registry compatibility
-- Adds pre-computed fields to Review and a sequential agent ID to Agent.
-- See docs/ERC-8004-MAPPING.md for the full specification.

-- 1. Add ERC-8004 columns to Review
ALTER TABLE "Review" ADD COLUMN "erc8004Value" INTEGER;
ALTER TABLE "Review" ADD COLUMN "erc8004ValueDecimals" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Review" ADD COLUMN "erc8004Tag1" TEXT NOT NULL DEFAULT 'starred';
ALTER TABLE "Review" ADD COLUMN "erc8004Tag2" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Review" ADD COLUMN "erc8004FeedbackHash" TEXT;

-- 2. Backfill erc8004Value from existing ratings (rating * 20)
UPDATE "Review" SET "erc8004Value" = ROUND(("rating" / 5.0) * 100);

-- 3. Backfill erc8004Tag2 from Job.category
UPDATE "Review" r
SET "erc8004Tag2" = COALESCE(j."category", '')
FROM "Job" j
WHERE r."jobId" = j."id"
  AND j."category" IS NOT NULL;

-- 4. Add erc8004AgentId to Agent
ALTER TABLE "Agent" ADD COLUMN "erc8004AgentId" INTEGER;
CREATE UNIQUE INDEX "Agent_erc8004AgentId_key" ON "Agent"("erc8004AgentId");

-- 5. Backfill sequential IDs ordered by createdAt
WITH numbered AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt") AS rn
  FROM "Agent"
)
UPDATE "Agent" a
SET "erc8004AgentId" = n.rn
FROM numbered n
WHERE a."id" = n."id";
