-- CreateEnum
CREATE TYPE "ConciergePostingStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ExternalApplicationStatus" AS ENUM ('NEW', 'REVIEWED', 'SHORTLISTED', 'REJECTED', 'HIRED');

-- AlterTable: Add parentJobId to Job for sub-job chain tracking
ALTER TABLE "Job" ADD COLUMN "parentJobId" TEXT;

-- CreateTable: ConciergePosting
CREATE TABLE "ConciergePosting" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "conciergeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" VARCHAR(3000) NOT NULL,
    "externalNote" VARCHAR(1000),
    "suggestedSkills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "suggestedLocation" TEXT,
    "suggestedEquipment" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "magicToken" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3),
    "status" "ConciergePostingStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "ConciergePosting_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ExternalApplication
CREATE TABLE "ExternalApplication" (
    "id" TEXT NOT NULL,
    "postingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "pitch" VARCHAR(1000) NOT NULL,
    "portfolioUrl" VARCHAR(500),
    "linkedHumanId" TEXT,
    "subJobId" TEXT,
    "status" "ExternalApplicationStatus" NOT NULL DEFAULT 'NEW',
    "reviewNote" VARCHAR(500),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "ExternalApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConciergePosting_magicToken_key" ON "ConciergePosting"("magicToken");
CREATE INDEX "ConciergePosting_conciergeId_status_idx" ON "ConciergePosting"("conciergeId", "status");
CREATE INDEX "ConciergePosting_magicToken_idx" ON "ConciergePosting"("magicToken");
CREATE INDEX "ConciergePosting_jobId_idx" ON "ConciergePosting"("jobId");
CREATE INDEX "ConciergePosting_status_createdAt_idx" ON "ConciergePosting"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalApplication_subJobId_key" ON "ExternalApplication"("subJobId");
CREATE UNIQUE INDEX "ExternalApplication_postingId_email_key" ON "ExternalApplication"("postingId", "email");
CREATE INDEX "ExternalApplication_postingId_status_idx" ON "ExternalApplication"("postingId", "status");
CREATE INDEX "ExternalApplication_email_idx" ON "ExternalApplication"("email");
CREATE INDEX "ExternalApplication_linkedHumanId_idx" ON "ExternalApplication"("linkedHumanId");

-- CreateIndex for Job parentJobId
CREATE INDEX "Job_parentJobId_idx" ON "Job"("parentJobId");

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_parentJobId_fkey" FOREIGN KEY ("parentJobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ConciergePosting" ADD CONSTRAINT "ConciergePosting_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConciergePosting" ADD CONSTRAINT "ConciergePosting_conciergeId_fkey" FOREIGN KEY ("conciergeId") REFERENCES "Human"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExternalApplication" ADD CONSTRAINT "ExternalApplication_postingId_fkey" FOREIGN KEY ("postingId") REFERENCES "ConciergePosting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExternalApplication" ADD CONSTRAINT "ExternalApplication_linkedHumanId_fkey" FOREIGN KEY ("linkedHumanId") REFERENCES "Human"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExternalApplication" ADD CONSTRAINT "ExternalApplication_subJobId_fkey" FOREIGN KEY ("subJobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;
