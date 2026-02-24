-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'VERIFIED', 'OUTREACH_READY', 'CONTACTED', 'REPLIED', 'ENGAGED', 'CONVERTED', 'REJECTED', 'STALE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('MANUAL', 'CSV_IMPORT', 'PODCAST_MINE', 'CONFERENCE', 'PUBLICATION', 'CATEGORY_SCAN', 'REFERRAL');

-- CreateTable
CREATE TABLE "InfluencerLead" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "platforms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "handle" TEXT,
    "followers" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "contactUrl" TEXT,
    "focusAreas" TEXT,
    "whyRelevant" TEXT,
    "notes" TEXT,
    "list" TEXT NOT NULL,
    "country" TEXT,
    "language" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "source" "LeadSource" NOT NULL DEFAULT 'CSV_IMPORT',
    "sourceDetail" TEXT,
    "sourceUrl" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "outreachMessage" TEXT,
    "outreachSentAt" TIMESTAMP(3),
    "outreachChannel" TEXT,
    "lastContactAt" TIMESTAMP(3),
    "responseNotes" TEXT,
    "lastActivityAt" TIMESTAMP(3),
    "lastActivityUrl" TEXT,
    "activityCheckedAt" TIMESTAMP(3),
    "pipelinePhase" TEXT,
    "pipelineRunId" TEXT,
    "competitorCleared" BOOLEAN NOT NULL DEFAULT false,
    "assignedToId" TEXT,
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InfluencerLead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InfluencerLead_dedupeKey_key" ON "InfluencerLead"("dedupeKey");

-- CreateIndex
CREATE INDEX "InfluencerLead_status_idx" ON "InfluencerLead"("status");

-- CreateIndex
CREATE INDEX "InfluencerLead_list_idx" ON "InfluencerLead"("list");

-- CreateIndex
CREATE INDEX "InfluencerLead_source_idx" ON "InfluencerLead"("source");

-- CreateIndex
CREATE INDEX "InfluencerLead_assignedToId_idx" ON "InfluencerLead"("assignedToId");

-- CreateIndex
CREATE INDEX "InfluencerLead_createdAt_idx" ON "InfluencerLead"("createdAt");

-- CreateIndex
CREATE INDEX "InfluencerLead_list_status_idx" ON "InfluencerLead"("list", "status");

-- AddForeignKey
ALTER TABLE "InfluencerLead" ADD CONSTRAINT "InfluencerLead_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "Human"("id") ON DELETE SET NULL ON UPDATE CASCADE;
