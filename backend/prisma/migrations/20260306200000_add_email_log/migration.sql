-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'email',
    "recipient" TEXT NOT NULL,
    "subject" TEXT,
    "type" TEXT,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "jobId" TEXT,
    "humanId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailLog_createdAt_idx" ON "EmailLog"("createdAt");

-- CreateIndex
CREATE INDEX "EmailLog_recipient_idx" ON "EmailLog"("recipient");

-- CreateIndex
CREATE INDEX "EmailLog_jobId_idx" ON "EmailLog"("jobId");

-- CreateIndex
CREATE INDEX "EmailLog_status_idx" ON "EmailLog"("status");
