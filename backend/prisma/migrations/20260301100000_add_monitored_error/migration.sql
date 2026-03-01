-- CreateTable
CREATE TABLE "MonitoredError" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "errorType" TEXT,
    "message" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "occurrences" INTEGER NOT NULL DEFAULT 1,
    "aiAnalysis" TEXT,
    "aiAnalyzedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'new',
    "alertedAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "samplePayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonitoredError_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MonitoredError_fingerprint_key" ON "MonitoredError"("fingerprint");

-- CreateIndex
CREATE INDEX "MonitoredError_status_idx" ON "MonitoredError"("status");

-- CreateIndex
CREATE INDEX "MonitoredError_lastSeenAt_idx" ON "MonitoredError"("lastSeenAt");

-- CreateIndex
CREATE INDEX "MonitoredError_fingerprint_idx" ON "MonitoredError"("fingerprint");
