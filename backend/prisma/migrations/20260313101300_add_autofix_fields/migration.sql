-- Add auto-fix (self-healing) fields to MonitoredError
ALTER TABLE "MonitoredError" ADD COLUMN IF NOT EXISTS "autoFixStatus" TEXT;
ALTER TABLE "MonitoredError" ADD COLUMN IF NOT EXISTS "autoFixProposal" TEXT;
ALTER TABLE "MonitoredError" ADD COLUMN IF NOT EXISTS "autoFixBranch" TEXT;
ALTER TABLE "MonitoredError" ADD COLUMN IF NOT EXISTS "autoFixTestOutput" TEXT;
ALTER TABLE "MonitoredError" ADD COLUMN IF NOT EXISTS "autoFixAttemptedAt" TIMESTAMP(3);
ALTER TABLE "MonitoredError" ADD COLUMN IF NOT EXISTS "autoFixMergedAt" TIMESTAMP(3);
