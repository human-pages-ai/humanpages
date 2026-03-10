-- CreateEnum
CREATE TYPE "FeedbackType" AS ENUM ('BUG', 'FEATURE', 'FEEDBACK');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "humanId" TEXT,
    "type" "FeedbackType" NOT NULL DEFAULT 'FEEDBACK',
    "category" TEXT,
    "title" VARCHAR(200),
    "description" VARCHAR(5000) NOT NULL,
    "sentiment" INTEGER,
    "stepsToReproduce" VARCHAR(2000),
    "expectedBehavior" VARCHAR(1000),
    "actualBehavior" VARCHAR(1000),
    "severity" TEXT,
    "pageUrl" TEXT,
    "browser" TEXT,
    "os" TEXT,
    "viewport" TEXT,
    "userAgent" TEXT,
    "appVersion" TEXT,
    "screenshotData" TEXT,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'NEW',
    "adminNotes" VARCHAR(2000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Feedback_status_idx" ON "Feedback"("status");

-- CreateIndex
CREATE INDEX "Feedback_type_idx" ON "Feedback"("type");

-- CreateIndex
CREATE INDEX "Feedback_createdAt_idx" ON "Feedback"("createdAt");

-- CreateIndex
CREATE INDEX "Feedback_humanId_idx" ON "Feedback"("humanId");

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_humanId_fkey" FOREIGN KEY ("humanId") REFERENCES "Human"("id") ON DELETE SET NULL ON UPDATE CASCADE;
