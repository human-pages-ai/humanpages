-- CreateTable
CREATE TABLE "McpSessionLog" (
    "id" SERIAL NOT NULL,
    "sessionId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "platform" TEXT,
    "callerIp" TEXT,
    "callerUa" TEXT,
    "apiKeyPrefix" TEXT,
    "country" TEXT,
    "method" TEXT NOT NULL,
    "toolName" TEXT,
    "sequenceNum" INTEGER NOT NULL DEFAULT 0,
    "requestArgs" JSONB,
    "responseBody" JSONB,
    "responseSize" INTEGER,
    "isError" BOOLEAN NOT NULL DEFAULT false,
    "errorMessage" TEXT,
    "latencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "McpSessionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "McpSessionLog_sessionId_idx" ON "McpSessionLog"("sessionId");

-- CreateIndex
CREATE INDEX "McpSessionLog_agentId_idx" ON "McpSessionLog"("agentId");

-- CreateIndex
CREATE INDEX "McpSessionLog_platform_idx" ON "McpSessionLog"("platform");

-- CreateIndex
CREATE INDEX "McpSessionLog_createdAt_idx" ON "McpSessionLog"("createdAt");

-- CreateIndex
CREATE INDEX "McpSessionLog_toolName_idx" ON "McpSessionLog"("toolName");
