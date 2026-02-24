-- AlterTable
ALTER TABLE "VideoJob" ADD COLUMN     "stepNumber" INTEGER,
ADD COLUMN     "stepName" TEXT,
ADD COLUMN     "parentJobId" TEXT,
ADD COLUMN     "stepOutput" TEXT;

-- CreateIndex
CREATE INDEX "VideoJob_parentJobId_idx" ON "VideoJob"("parentJobId");

-- AddForeignKey
ALTER TABLE "VideoJob" ADD CONSTRAINT "VideoJob_parentJobId_fkey" FOREIGN KEY ("parentJobId") REFERENCES "VideoJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
