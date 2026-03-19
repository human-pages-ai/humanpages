-- Add agent-facing structured fields for search/filtering
-- These fields help AI agents find the right human faster

-- Availability & capacity fields
ALTER TABLE "Human" ADD COLUMN "timezone" TEXT;
ALTER TABLE "Human" ADD COLUMN "weeklyCapacityHours" INTEGER;
ALTER TABLE "Human" ADD COLUMN "responseTimeCommitment" TEXT;
ALTER TABLE "Human" ADD COLUMN "workType" TEXT;

-- Industries / domain experience (array)
ALTER TABLE "Human" ADD COLUMN "industries" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Schedule pattern: when the human is typically available
ALTER TABLE "Human" ADD COLUMN "schedulePattern" TEXT;

-- Preferred task duration
ALTER TABLE "Human" ADD COLUMN "preferredTaskDuration" TEXT;

-- Earliest start date for new work
ALTER TABLE "Human" ADD COLUMN "earliestStartDate" TIMESTAMP(3);

-- Profile completeness score for search ranking
ALTER TABLE "Human" ADD COLUMN "profileCompleteness" INTEGER NOT NULL DEFAULT 0;

-- Indexes for agent search performance
CREATE INDEX "Human_timezone_idx" ON "Human"("timezone");
CREATE INDEX "Human_weeklyCapacityHours_idx" ON "Human"("weeklyCapacityHours");
CREATE INDEX "Human_responseTimeCommitment_idx" ON "Human"("responseTimeCommitment");
CREATE INDEX "Human_workType_idx" ON "Human"("workType");
CREATE INDEX "Human_industries_idx" ON "Human" USING GIN ("industries");
CREATE INDEX "Human_schedulePattern_idx" ON "Human"("schedulePattern");
CREATE INDEX "Human_preferredTaskDuration_idx" ON "Human"("preferredTaskDuration");
CREATE INDEX "Human_earliestStartDate_idx" ON "Human"("earliestStartDate");
CREATE INDEX "Human_profileCompleteness_idx" ON "Human"("profileCompleteness");
