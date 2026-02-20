-- AlterTable
ALTER TABLE "Human" ADD COLUMN     "oauthPhotoUrl" TEXT,
ADD COLUMN     "profilePhotoKey" TEXT,
ADD COLUMN     "profilePhotoStatus" TEXT NOT NULL DEFAULT 'none';

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "moderationStatus" TEXT NOT NULL DEFAULT 'approved';

-- CreateTable
CREATE TABLE "ModerationQueue" (
    "id" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "result" JSONB,
    "errorMessage" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationQueue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ModerationQueue_status_createdAt_idx" ON "ModerationQueue"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ModerationQueue_contentType_contentId_idx" ON "ModerationQueue"("contentType", "contentId");
