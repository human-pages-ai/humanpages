-- CreateEnum
CREATE TYPE "AffiliateStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateTable
CREATE TABLE "Vouch" (
    "id" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "voucheeId" TEXT NOT NULL,
    "comment" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vouch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Affiliate" (
    "id" TEXT NOT NULL,
    "humanId" TEXT NOT NULL,
    "status" "AffiliateStatus" NOT NULL DEFAULT 'PENDING',
    "code" TEXT NOT NULL,
    "promotionMethod" VARCHAR(500),
    "website" TEXT,
    "audience" VARCHAR(200),
    "creditsPerReferral" INTEGER NOT NULL DEFAULT 10,
    "bonusTier1" INTEGER NOT NULL DEFAULT 50,
    "bonusTier2" INTEGER NOT NULL DEFAULT 200,
    "bonusTier3" INTEGER NOT NULL DEFAULT 500,
    "totalClicks" INTEGER NOT NULL DEFAULT 0,
    "totalSignups" INTEGER NOT NULL DEFAULT 0,
    "qualifiedSignups" INTEGER NOT NULL DEFAULT 0,
    "totalCredits" INTEGER NOT NULL DEFAULT 0,
    "creditsRedeemed" INTEGER NOT NULL DEFAULT 0,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "rejectedReason" TEXT,
    "suspendedAt" TIMESTAMP(3),
    "suspendedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Affiliate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateReferral" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "referredHumanId" TEXT NOT NULL,
    "qualified" BOOLEAN NOT NULL DEFAULT false,
    "qualifiedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "creditsAwarded" INTEGER NOT NULL DEFAULT 0,
    "creditsClaimed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffiliateReferral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateCredit" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'referral',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffiliateCredit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Vouch_voucheeId_idx" ON "Vouch"("voucheeId");

-- CreateIndex
CREATE UNIQUE INDEX "Vouch_voucherId_voucheeId_key" ON "Vouch"("voucherId", "voucheeId");

-- CreateIndex
CREATE UNIQUE INDEX "Affiliate_humanId_key" ON "Affiliate"("humanId");

-- CreateIndex
CREATE UNIQUE INDEX "Affiliate_code_key" ON "Affiliate"("code");

-- CreateIndex
CREATE INDEX "Affiliate_status_idx" ON "Affiliate"("status");

-- CreateIndex
CREATE INDEX "Affiliate_code_idx" ON "Affiliate"("code");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateReferral_referredHumanId_key" ON "AffiliateReferral"("referredHumanId");

-- CreateIndex
CREATE INDEX "AffiliateReferral_affiliateId_qualified_idx" ON "AffiliateReferral"("affiliateId", "qualified");

-- CreateIndex
CREATE INDEX "AffiliateReferral_affiliateId_createdAt_idx" ON "AffiliateReferral"("affiliateId", "createdAt");

-- CreateIndex
CREATE INDEX "AffiliateCredit_affiliateId_idx" ON "AffiliateCredit"("affiliateId");

-- CreateIndex
CREATE INDEX "AffiliateCredit_affiliateId_type_idx" ON "AffiliateCredit"("affiliateId", "type");

-- AddForeignKey
ALTER TABLE "Vouch" ADD CONSTRAINT "Vouch_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Human"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vouch" ADD CONSTRAINT "Vouch_voucheeId_fkey" FOREIGN KEY ("voucheeId") REFERENCES "Human"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Affiliate" ADD CONSTRAINT "Affiliate_humanId_fkey" FOREIGN KEY ("humanId") REFERENCES "Human"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateReferral" ADD CONSTRAINT "AffiliateReferral_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateReferral" ADD CONSTRAINT "AffiliateReferral_referredHumanId_fkey" FOREIGN KEY ("referredHumanId") REFERENCES "Human"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateCredit" ADD CONSTRAINT "AffiliateCredit_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
