-- CreateEnum
CREATE TYPE "EscrowStatus" AS ENUM ('PENDING_DEPOSIT', 'FUNDED', 'COMPLETED_ONCHAIN', 'RELEASED', 'CANCELLED', 'DISPUTED', 'RESOLVED');

-- AlterEnum
ALTER TYPE "PaymentMode" ADD VALUE 'ESCROW';

-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "arbitratorAvgResponseH" DOUBLE PRECISION,
ADD COLUMN     "arbitratorDisputeCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "arbitratorFeeBps" INTEGER,
ADD COLUMN     "arbitratorHealthy" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "arbitratorLastHealthAt" TIMESTAMP(3),
ADD COLUMN     "arbitratorSla" TEXT,
ADD COLUMN     "arbitratorSpecialties" TEXT[],
ADD COLUMN     "arbitratorTotalEarned" DECIMAL(18,6) NOT NULL DEFAULT 0,
ADD COLUMN     "arbitratorWalletSig" TEXT,
ADD COLUMN     "arbitratorWebhookUrl" TEXT,
ADD COLUMN     "arbitratorWinCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "escrowDisputeCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "escrowReleaseCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isArbitrator" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "escrowAmount" DECIMAL(18,6),
ADD COLUMN     "escrowArbitratorAddress" TEXT,
ADD COLUMN     "escrowArbitratorFeeBps" INTEGER,
ADD COLUMN     "escrowCancelAmountDepositor" DECIMAL(18,6),
ADD COLUMN     "escrowCancelAmountPayee" DECIMAL(18,6),
ADD COLUMN     "escrowCancelTxHash" TEXT,
ADD COLUMN     "escrowCancelledAt" TIMESTAMP(3),
ADD COLUMN     "escrowCompletedAt" TIMESTAMP(3),
ADD COLUMN     "escrowContractAddress" TEXT,
ADD COLUMN     "escrowDepositTxHash" TEXT,
ADD COLUMN     "escrowDepositedAt" TIMESTAMP(3),
ADD COLUMN     "escrowDepositorAddress" TEXT,
ADD COLUMN     "escrowDisputeDeadline" TIMESTAMP(3),
ADD COLUMN     "escrowDisputeReason" VARCHAR(1000),
ADD COLUMN     "escrowDisputeTxHash" TEXT,
ADD COLUMN     "escrowDisputeWindow" INTEGER,
ADD COLUMN     "escrowDisputedAt" TIMESTAMP(3),
ADD COLUMN     "escrowJobIdHash" TEXT,
ADD COLUMN     "escrowPayeeAddress" TEXT,
ADD COLUMN     "escrowReleaseTxHash" TEXT,
ADD COLUMN     "escrowReleasedAt" TIMESTAMP(3),
ADD COLUMN     "escrowResolveTxHash" TEXT,
ADD COLUMN     "escrowResolvedAt" TIMESTAMP(3),
ADD COLUMN     "escrowStatus" "EscrowStatus",
ADD COLUMN     "escrowVerdictAmountDepositor" DECIMAL(18,6),
ADD COLUMN     "escrowVerdictAmountPayee" DECIMAL(18,6),
ADD COLUMN     "escrowVerdictArbitratorFee" DECIMAL(18,6),
ADD COLUMN     "escrowVerdictNonce" TEXT,
ADD COLUMN     "escrowVerdictSignature" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Job_escrowDepositTxHash_key" ON "Job"("escrowDepositTxHash");

-- CreateIndex
CREATE INDEX "Job_escrowStatus_idx" ON "Job"("escrowStatus");

-- CreateIndex
CREATE INDEX "Job_escrowDisputeDeadline_idx" ON "Job"("escrowDisputeDeadline");
