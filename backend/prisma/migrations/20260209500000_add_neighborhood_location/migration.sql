-- AlterTable: Add neighborhood and location granularity fields to Human
ALTER TABLE "Human" ADD COLUMN "neighborhood" TEXT;
ALTER TABLE "Human" ADD COLUMN "locationGranularity" TEXT NOT NULL DEFAULT 'city';

-- CreateIndex
CREATE INDEX "Human_neighborhood_idx" ON "Human"("neighborhood");
