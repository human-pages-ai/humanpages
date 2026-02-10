-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'BANNED');

-- CreateEnum
CREATE TYPE "ActivationMethod" AS ENUM ('SOCIAL', 'PAYMENT');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('SPAM', 'FRAUD', 'HARASSMENT', 'IRRELEVANT', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'REVIEWED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "EmailDigestMode" AS ENUM ('REALTIME', 'HOURLY', 'DAILY');

-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "abuseScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "abuseStrikes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "activatedAt" TIMESTAMP(3),
ADD COLUMN     "activationExpiresAt" TIMESTAMP(3),
ADD COLUMN     "activationMethod" "ActivationMethod",
ADD COLUMN     "activationPlatform" TEXT,
ADD COLUMN     "activationTier" TEXT NOT NULL DEFAULT 'BASIC',
ADD COLUMN     "paymentAmount" DECIMAL(18,6),
ADD COLUMN     "paymentNetwork" TEXT,
ADD COLUMN     "paymentTxHash" TEXT,
ADD COLUMN     "socialAccountSize" INTEGER,
ADD COLUMN     "socialCodeExpiresAt" TIMESTAMP(3),
ADD COLUMN     "socialPostUrl" TEXT,
ADD COLUMN     "socialVerificationCode" TEXT,
ADD COLUMN     "status" "AgentStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "Human" ADD COLUMN     "emailDigestMode" "EmailDigestMode" NOT NULL DEFAULT 'REALTIME';

-- CreateTable
CREATE TABLE "AgentReport" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "reporterHumanId" TEXT NOT NULL,
    "jobId" TEXT,
    "reason" "ReportReason" NOT NULL,
    "description" VARCHAR(1000),
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PendingNotification" (
    "id" TEXT NOT NULL,
    "humanId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "PendingNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentReport_agentId_idx" ON "AgentReport"("agentId");

-- CreateIndex
CREATE INDEX "AgentReport_reporterHumanId_idx" ON "AgentReport"("reporterHumanId");

-- CreateIndex
CREATE INDEX "AgentReport_agentId_status_idx" ON "AgentReport"("agentId", "status");

-- CreateIndex
CREATE INDEX "PendingNotification_humanId_sentAt_idx" ON "PendingNotification"("humanId", "sentAt");

-- CreateIndex
CREATE INDEX "PendingNotification_sentAt_createdAt_idx" ON "PendingNotification"("sentAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_paymentTxHash_key" ON "Agent"("paymentTxHash");

-- CreateIndex
CREATE INDEX "Agent_status_idx" ON "Agent"("status");

-- AddForeignKey
ALTER TABLE "AgentReport" ADD CONSTRAINT "AgentReport_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentReport" ADD CONSTRAINT "AgentReport_reporterHumanId_fkey" FOREIGN KEY ("reporterHumanId") REFERENCES "Human"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingNotification" ADD CONSTRAINT "PendingNotification_humanId_fkey" FOREIGN KEY ("humanId") REFERENCES "Human"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data migration: grandfather existing domain-verified agents as ACTIVE
UPDATE "Agent" SET
  "status" = CASE WHEN "domainVerified" = true THEN 'ACTIVE'::"AgentStatus" ELSE 'PENDING'::"AgentStatus" END,
  "activatedAt" = CASE WHEN "domainVerified" = true THEN "verifiedAt" ELSE NULL END;
