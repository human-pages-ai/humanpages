/*
  Warnings:

  - The values [PENDING,REJECTED] on the enum `AffiliateStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `approvedAt` on the `Affiliate` table. All the data in the column will be lost.
  - You are about to drop the column `approvedBy` on the `Affiliate` table. All the data in the column will be lost.
  - You are about to drop the column `audience` on the `Affiliate` table. All the data in the column will be lost.
  - You are about to drop the column `code` on the `Affiliate` table. All the data in the column will be lost.
  - You are about to drop the column `promotionMethod` on the `Affiliate` table. All the data in the column will be lost.
  - You are about to drop the column `rejectedReason` on the `Affiliate` table. All the data in the column will be lost.
  - You are about to drop the column `totalClicks` on the `Affiliate` table. All the data in the column will be lost.
  - You are about to drop the column `website` on the `Affiliate` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "ActivationMethod" ADD VALUE 'ADMIN';

-- AlterEnum
BEGIN;
CREATE TYPE "AffiliateStatus_new" AS ENUM ('APPROVED', 'SUSPENDED');
ALTER TABLE "Affiliate" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Affiliate" ALTER COLUMN "status" TYPE "AffiliateStatus_new" USING ("status"::text::"AffiliateStatus_new");
ALTER TYPE "AffiliateStatus" RENAME TO "AffiliateStatus_old";
ALTER TYPE "AffiliateStatus_new" RENAME TO "AffiliateStatus";
DROP TYPE "AffiliateStatus_old";
ALTER TABLE "Affiliate" ALTER COLUMN "status" SET DEFAULT 'APPROVED';
COMMIT;

-- DropIndex
DROP INDEX IF EXISTS "Affiliate_code_idx";

-- DropIndex
DROP INDEX IF EXISTS "Affiliate_code_key";

-- AlterTable
ALTER TABLE "Affiliate" DROP COLUMN IF EXISTS "approvedAt",
DROP COLUMN IF EXISTS "approvedBy",
DROP COLUMN IF EXISTS "audience",
DROP COLUMN IF EXISTS "code",
DROP COLUMN IF EXISTS "promotionMethod",
DROP COLUMN IF EXISTS "rejectedReason",
DROP COLUMN IF EXISTS "totalClicks",
DROP COLUMN IF EXISTS "website",
ALTER COLUMN "status" SET DEFAULT 'APPROVED';

-- AlterTable
ALTER TABLE "Human" ALTER COLUMN "referralCode" DROP DEFAULT;

-- CreateTable
CREATE TABLE "X402Payment" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "amountUsd" DECIMAL(18,6) NOT NULL,
    "network" TEXT NOT NULL,
    "paymentPayload" JSONB NOT NULL,
    "settled" BOOLEAN NOT NULL DEFAULT false,
    "agentIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "X402Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "X402Payment_agentId_createdAt_idx" ON "X402Payment"("agentId", "createdAt");

-- CreateIndex
CREATE INDEX "X402Payment_resourceType_createdAt_idx" ON "X402Payment"("resourceType", "createdAt");

-- AddForeignKey
ALTER TABLE "X402Payment" ADD CONSTRAINT "X402Payment_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
