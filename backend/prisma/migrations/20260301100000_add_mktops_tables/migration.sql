-- CreateTable
CREATE TABLE "MktOpsLog" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "event" TEXT NOT NULL,
    "staff" TEXT,
    "prompt" TEXT,
    "response" TEXT,
    "model" TEXT,
    "durationMs" INTEGER,
    "details" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "MktOpsLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MktOpsDecision" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "staff" TEXT,
    "question" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "chosen" TEXT,
    "telegramMsgId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',

    CONSTRAINT "MktOpsDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MktOpsConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "MktOpsConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MktOpsLog_timestamp_idx" ON "MktOpsLog"("timestamp");

-- CreateIndex
CREATE INDEX "MktOpsLog_staff_idx" ON "MktOpsLog"("staff");

-- CreateIndex
CREATE INDEX "MktOpsLog_event_idx" ON "MktOpsLog"("event");

-- CreateIndex
CREATE INDEX "MktOpsDecision_status_idx" ON "MktOpsDecision"("status");

-- CreateIndex
CREATE INDEX "MktOpsDecision_createdAt_idx" ON "MktOpsDecision"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MktOpsConfig_key_key" ON "MktOpsConfig"("key");
