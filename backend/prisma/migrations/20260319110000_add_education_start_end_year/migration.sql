-- AlterTable: Add startYear and endYear to Education
ALTER TABLE "Education" ADD COLUMN "startYear" INTEGER;
ALTER TABLE "Education" ADD COLUMN "endYear" INTEGER;

-- Backfill: copy existing year into endYear for existing records
UPDATE "Education" SET "endYear" = "year" WHERE "year" IS NOT NULL;
