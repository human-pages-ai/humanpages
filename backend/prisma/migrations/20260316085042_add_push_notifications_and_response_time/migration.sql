-- AlterTable
ALTER TABLE "Human" ADD COLUMN     "pushNotifications" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "responseTimeMinutes" DOUBLE PRECISION;
