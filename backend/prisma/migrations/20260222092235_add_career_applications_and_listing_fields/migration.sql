-- CreateEnum (idempotent: may already exist)
DO $$ BEGIN
    CREATE TYPE "CareerApplicationStatus" AS ENUM ('PENDING', 'REVIEWED', 'CONTACTED', 'REJECTED', 'HIRED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable (idempotent: column may already exist from 20260220200000)
ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "profilePhotoKey" TEXT,
ADD COLUMN IF NOT EXISTS "profilePhotoStatus" TEXT NOT NULL DEFAULT 'none';

-- AlterTable (idempotent: columns may already exist)
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "budgetFlexible" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "imageKey" TEXT;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "imageStatus" TEXT NOT NULL DEFAULT 'none';

-- CreateTable (idempotent)
CREATE TABLE IF NOT EXISTS "CareerApplication" (
    "id" TEXT NOT NULL,
    "humanId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "positionTitle" TEXT NOT NULL,
    "about" VARCHAR(500) NOT NULL,
    "portfolioUrl" VARCHAR(500),
    "availability" TEXT NOT NULL DEFAULT 'flexible',
    "status" "CareerApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "adminNotes" VARCHAR(2000),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareerApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "CareerApplication_status_idx" ON "CareerApplication"("status");

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "CareerApplication_positionId_idx" ON "CareerApplication"("positionId");

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "CareerApplication_createdAt_idx" ON "CareerApplication"("createdAt");

-- CreateIndex (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS "CareerApplication_humanId_positionId_key" ON "CareerApplication"("humanId", "positionId");

-- AddForeignKey (idempotent)
DO $$ BEGIN
    ALTER TABLE "CareerApplication" ADD CONSTRAINT "CareerApplication_humanId_fkey" FOREIGN KEY ("humanId") REFERENCES "Human"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
