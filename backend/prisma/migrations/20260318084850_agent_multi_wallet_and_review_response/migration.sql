-- AlterTable: Add review response and wallet snapshot fields
ALTER TABLE "Review" ADD COLUMN     "respondedAt" TIMESTAMP(3),
ADD COLUMN     "responseText" VARCHAR(2000),
ADD COLUMN     "walletVerifiedAtReview" BOOLEAN;

-- CreateTable: AgentWallet (multi-wallet support)
CREATE TABLE "AgentWallet" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "network" TEXT NOT NULL DEFAULT 'base',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "nonce" TEXT,
    "nonceExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentWallet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentWallet_agentId_idx" ON "AgentWallet"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentWallet_agentId_address_key" ON "AgentWallet"("agentId", "address");

-- AddForeignKey
ALTER TABLE "AgentWallet" ADD CONSTRAINT "AgentWallet_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing wallet data from Agent to AgentWallet
INSERT INTO "AgentWallet" ("id", "agentId", "address", "network", "verified", "createdAt")
SELECT
    gen_random_uuid()::text,
    "id",
    LOWER("walletAddress"),
    COALESCE("walletNetwork", 'base'),
    COALESCE("walletVerified", false),
    CURRENT_TIMESTAMP
FROM "Agent"
WHERE "walletAddress" IS NOT NULL;

-- Drop old single-wallet columns from Agent
ALTER TABLE "Agent" DROP COLUMN IF EXISTS "walletAddress",
DROP COLUMN IF EXISTS "walletNetwork",
DROP COLUMN IF EXISTS "walletNonce",
DROP COLUMN IF EXISTS "walletNonceExpiresAt",
DROP COLUMN IF EXISTS "walletVerified";
