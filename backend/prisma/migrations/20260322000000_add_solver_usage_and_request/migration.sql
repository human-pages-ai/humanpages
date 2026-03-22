-- CreateTable
CREATE TABLE "SolverUsage" (
    "id" SERIAL NOT NULL,
    "agentId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SolverUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolverRequest" (
    "id" SERIAL NOT NULL,
    "agentId" TEXT NOT NULL,
    "challenge" TEXT NOT NULL,
    "answer" TEXT,
    "correct" BOOLEAN,
    "solveTimeMs" INTEGER NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "rejected" BOOLEAN NOT NULL DEFAULT false,
    "rejectReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SolverRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SolverUsage_agentId_idx" ON "SolverUsage"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "SolverUsage_agentId_date_key" ON "SolverUsage"("agentId", "date");

-- CreateIndex
CREATE INDEX "SolverRequest_agentId_idx" ON "SolverRequest"("agentId");

-- CreateIndex
CREATE INDEX "SolverRequest_createdAt_idx" ON "SolverRequest"("createdAt");

-- CreateIndex
CREATE INDEX "SolverRequest_rejected_idx" ON "SolverRequest"("rejected");
