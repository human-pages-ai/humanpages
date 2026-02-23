-- CreateEnum
CREATE TYPE "IdleAlertStatus" AS ENUM ('ACTIVE', 'RESOLVED', 'DISMISSED');

-- CreateTable
CREATE TABLE "StaffActivity" (
    "id" TEXT NOT NULL,
    "humanId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdleAlert" (
    "id" TEXT NOT NULL,
    "humanId" TEXT NOT NULL,
    "status" "IdleAlertStatus" NOT NULL DEFAULT 'ACTIVE',
    "idleSince" TIMESTAMP(3) NOT NULL,
    "idleMinutes" INTEGER NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "dismissedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdleAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffActivity_humanId_createdAt_idx" ON "StaffActivity"("humanId", "createdAt");

-- CreateIndex
CREATE INDEX "StaffActivity_createdAt_idx" ON "StaffActivity"("createdAt");

-- CreateIndex
CREATE INDEX "IdleAlert_status_idx" ON "IdleAlert"("status");

-- CreateIndex
CREATE INDEX "IdleAlert_humanId_status_idx" ON "IdleAlert"("humanId", "status");

-- CreateIndex
CREATE INDEX "IdleAlert_createdAt_idx" ON "IdleAlert"("createdAt");

-- AddForeignKey
ALTER TABLE "StaffActivity" ADD CONSTRAINT "StaffActivity_humanId_fkey" FOREIGN KEY ("humanId") REFERENCES "Human"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdleAlert" ADD CONSTRAINT "IdleAlert_humanId_fkey" FOREIGN KEY ("humanId") REFERENCES "Human"("id") ON DELETE CASCADE ON UPDATE CASCADE;
