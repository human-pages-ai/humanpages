-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "ListingStatus" AS ENUM ('OPEN', 'CLOSED', 'EXPIRED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'OFFERED', 'REJECTED', 'WITHDRAWN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Listing" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" VARCHAR(5000) NOT NULL,
    "category" TEXT,
    "budgetUsdc" DECIMAL(18,6) NOT NULL,
    "requiredSkills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requiredEquipment" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "location" TEXT,
    "locationLat" DOUBLE PRECISION,
    "locationLng" DOUBLE PRECISION,
    "radiusKm" INTEGER,
    "workMode" "WorkMode",
    "status" "ListingStatus" NOT NULL DEFAULT 'OPEN',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "maxApplicants" INTEGER,
    "isPro" BOOLEAN NOT NULL DEFAULT false,
    "callbackUrl" TEXT,
    "callbackSecret" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ListingApplication" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "humanId" TEXT NOT NULL,
    "pitch" VARCHAR(500) NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "jobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListingApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Listing_status_isPro_createdAt_idx" ON "Listing"("status", "isPro", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Listing_agentId_idx" ON "Listing"("agentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Listing_status_expiresAt_idx" ON "Listing"("status", "expiresAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Listing_requiredSkills_idx" ON "Listing"("requiredSkills");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ListingApplication_jobId_key" ON "ListingApplication"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ListingApplication_listingId_humanId_key" ON "ListingApplication"("listingId", "humanId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ListingApplication_humanId_idx" ON "ListingApplication"("humanId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ListingApplication_listingId_status_idx" ON "ListingApplication"("listingId", "status");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Listing" ADD CONSTRAINT "Listing_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "ListingApplication" ADD CONSTRAINT "ListingApplication_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "ListingApplication" ADD CONSTRAINT "ListingApplication_humanId_fkey" FOREIGN KEY ("humanId") REFERENCES "Human"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "ListingApplication" ADD CONSTRAINT "ListingApplication_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
