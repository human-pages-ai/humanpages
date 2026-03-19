-- Add missing onboarding fields to Human
ALTER TABLE "Human" ADD COLUMN "freelancerJobsRange" TEXT;
ALTER TABLE "Human" ADD COLUMN "platformPresence" JSONB;
ALTER TABLE "Human" ADD COLUMN "externalProfiles" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Add subcategory to Service
ALTER TABLE "Service" ADD COLUMN "subcategory" TEXT;
