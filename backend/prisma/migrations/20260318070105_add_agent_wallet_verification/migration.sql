-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "walletNonce" TEXT,
ADD COLUMN     "walletNonceExpiresAt" TIMESTAMP(3),
ADD COLUMN     "walletVerified" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "paymentFromAddress" TEXT,
ADD COLUMN     "senderMatch" BOOLEAN;
