-- CreateEnum
CREATE TYPE "CareerApplicationStatus" AS ENUM ('PENDING', 'REVIEWED', 'CONTACTED', 'REJECTED', 'HIRED');

-- CreateTable
CREATE TABLE "CareerApplication" (
    "id" TEXT NOT NULL,
    "humanId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "positionTitle" TEXT NOT NULL,
    "about" VARCHAR(500) NOT NULL,
    "portfolioUrl" VARCHAR(500),
    "availability" TEXT NOT NULL DEFAULT 'flexible',
    "status" "CareerApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "adminNotes" VARCHAR(2000),
    "utmSource" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareerApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CareerApplication_humanId_positionId_key" ON "CareerApplication"("humanId", "positionId");

-- CreateIndex
CREATE INDEX "CareerApplication_status_idx" ON "CareerApplication"("status");

-- CreateIndex
CREATE INDEX "CareerApplication_positionId_idx" ON "CareerApplication"("positionId");

-- CreateIndex
CREATE INDEX "CareerApplication_createdAt_idx" ON "CareerApplication"("createdAt");

-- AddForeignKey
ALTER TABLE "CareerApplication" ADD CONSTRAINT "CareerApplication_humanId_fkey" FOREIGN KEY ("humanId") REFERENCES "Human"("id") ON DELETE CASCADE ON UPDATE CASCADE;
