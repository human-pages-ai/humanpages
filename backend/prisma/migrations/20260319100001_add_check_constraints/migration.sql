-- Ensure profileCompleteness stays within 0-100 range
ALTER TABLE "Human" ADD CONSTRAINT "human_profile_completeness_range"
  CHECK ("profileCompleteness" >= 0 AND "profileCompleteness" <= 100);

-- Ensure username is not empty string (null is OK, empty string is not)
ALTER TABLE "Human" ADD CONSTRAINT "human_username_not_empty"
  CHECK ("username" IS NULL OR length("username") >= 3);

-- Add missing indexes for new queryable fields
CREATE INDEX IF NOT EXISTS "Human_freelancerJobsRange_idx" ON "Human"("freelancerJobsRange");
CREATE INDEX IF NOT EXISTS "Human_externalProfiles_idx" ON "Human" USING GIN ("externalProfiles");
