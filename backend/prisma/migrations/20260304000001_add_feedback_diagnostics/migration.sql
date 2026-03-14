-- AlterTable
ALTER TABLE "Feedback" ADD COLUMN IF NOT EXISTS "diagnostics" JSONB;
