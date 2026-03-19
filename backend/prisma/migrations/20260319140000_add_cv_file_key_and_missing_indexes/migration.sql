-- AlterTable: Add cvFileKey column for persisted CV file references
ALTER TABLE "Human" ADD COLUMN IF NOT EXISTS "cvFileKey" TEXT;

-- CreateIndex: Prisma-managed indexes for freelancerJobsRange and externalProfiles
-- These were previously created via raw SQL in check_constraints migration;
-- now declared in schema.prisma so Prisma tracks them and drift is resolved.
-- Using IF NOT EXISTS to avoid errors if they already exist from the earlier migration.
CREATE INDEX IF NOT EXISTS "Human_freelancerJobsRange_idx" ON "Human"("freelancerJobsRange");
CREATE INDEX IF NOT EXISTS "Human_externalProfiles_idx" ON "Human" USING GIN ("externalProfiles");
