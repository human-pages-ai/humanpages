-- CreateEnum
CREATE TYPE "DisputeType" AS ENUM ('PRE_PAYMENT', 'POST_PAYMENT');

-- AlterEnum
ALTER TYPE "JobStatus" ADD VALUE 'SUBMITTED';

-- AlterTable
ALTER TABLE "Job" ADD COLUMN "disputeType" "DisputeType",
ADD COLUMN "submittedAt" TIMESTAMP(3);
