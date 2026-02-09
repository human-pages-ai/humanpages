-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" VARCHAR(500),
    "websiteUrl" TEXT,
    "contactEmail" TEXT,
    "apiKeyHash" TEXT NOT NULL,
    "apiKeyPrefix" TEXT NOT NULL,
    "domainVerified" BOOLEAN NOT NULL DEFAULT false,
    "verificationToken" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Job" ADD COLUMN "registeredAgentId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Agent_apiKeyPrefix_key" ON "Agent"("apiKeyPrefix");

-- CreateIndex
CREATE INDEX "Agent_lastActiveAt_idx" ON "Agent"("lastActiveAt");

-- CreateIndex
CREATE INDEX "Job_registeredAgentId_idx" ON "Job"("registeredAgentId");

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_registeredAgentId_fkey" FOREIGN KEY ("registeredAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
