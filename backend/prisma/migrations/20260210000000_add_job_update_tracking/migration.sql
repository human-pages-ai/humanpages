-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "lastUpdatedByAgent" TIMESTAMP(3),
ADD COLUMN     "updateCount" INTEGER NOT NULL DEFAULT 0;
