-- CreateEnum
CREATE TYPE "VideoJobType" AS ENUM ('PREVIEW', 'PRODUCE');

-- CreateEnum
CREATE TYPE "VideoJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "VideoJob" (
    "id" TEXT NOT NULL,
    "conceptSlug" TEXT NOT NULL,
    "jobType" "VideoJobType" NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'nano',
    "status" "VideoJobStatus" NOT NULL DEFAULT 'PENDING',
    "claimedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "logTail" TEXT,
    "pipelineStep" TEXT,
    "progressPct" INTEGER,
    "outputDir" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VideoJob_status_createdAt_idx" ON "VideoJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "VideoJob_conceptSlug_status_idx" ON "VideoJob"("conceptSlug", "status");
