-- AlterEnum: Add PAYMENT_CLAIMED to JobStatus
ALTER TYPE "JobStatus" ADD VALUE 'PAYMENT_CLAIMED';

-- AlterTable: Add off-chain payment claim fields
ALTER TABLE "Job" ADD COLUMN "paymentClaimMethod" TEXT;
ALTER TABLE "Job" ADD COLUMN "paymentClaimNote" TEXT;
ALTER TABLE "Job" ADD COLUMN "paymentClaimedAt" TIMESTAMP(3);

-- AlterTable: Add cancellation tracking fields
ALTER TABLE "Job" ADD COLUMN "cancelledAt" TIMESTAMP(3);
ALTER TABLE "Job" ADD COLUMN "cancelReason" TEXT;
ALTER TABLE "Job" ADD COLUMN "cancelledBy" TEXT;

-- AlterTable: Add dispute tracking fields
ALTER TABLE "Job" ADD COLUMN "disputedAt" TIMESTAMP(3);
ALTER TABLE "Job" ADD COLUMN "disputeReason" TEXT;
ALTER TABLE "Job" ADD COLUMN "disputedBy" TEXT;

-- AlterTable: Add audit field
ALTER TABLE "Job" ADD COLUMN "lastActionBy" TEXT;
