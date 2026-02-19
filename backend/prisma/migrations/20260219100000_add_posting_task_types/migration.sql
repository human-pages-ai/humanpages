-- AlterTable
ALTER TABLE "PostingGroup" ADD COLUMN "taskType" TEXT NOT NULL DEFAULT 'fb_post';
ALTER TABLE "PostingGroup" ADD COLUMN "campaign" TEXT;
ALTER TABLE "PostingGroup" ADD COLUMN "completedById" TEXT;

-- AddForeignKey
ALTER TABLE "PostingGroup" ADD CONSTRAINT "PostingGroup_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "Human"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "PostingGroup_taskType_idx" ON "PostingGroup"("taskType");
CREATE INDEX "PostingGroup_campaign_idx" ON "PostingGroup"("campaign");
CREATE INDEX "PostingGroup_completedById_datePosted_idx" ON "PostingGroup"("completedById", "datePosted");
