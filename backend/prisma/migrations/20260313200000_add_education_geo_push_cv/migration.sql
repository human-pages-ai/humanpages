-- Education table
CREATE TABLE IF NOT EXISTS "Education" (
    "id" TEXT NOT NULL,
    "humanId" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "country" TEXT,
    "degree" TEXT,
    "field" TEXT,
    "year" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Education_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Education_humanId_idx" ON "Education"("humanId");
DO $$ BEGIN
  ALTER TABLE "Education" ADD CONSTRAINT "Education_humanId_fkey" FOREIGN KEY ("humanId") REFERENCES "Human"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Certificate table
CREATE TABLE IF NOT EXISTS "Certificate" (
    "id" TEXT NOT NULL,
    "humanId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuer" TEXT,
    "year" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Certificate_humanId_idx" ON "Certificate"("humanId");
DO $$ BEGIN
  ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_humanId_fkey" FOREIGN KEY ("humanId") REFERENCES "Human"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- GeoCache table (query is PK, no separate id)
CREATE TABLE IF NOT EXISTS "GeoCache" (
    "query" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GeoCache_pkey" PRIMARY KEY ("query")
);

-- PushSubscription table
CREATE TABLE IF NOT EXISTS "PushSubscription" (
    "id" TEXT NOT NULL,
    "humanId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_humanId_endpoint_key" ON "PushSubscription"("humanId", "endpoint");
DO $$ BEGIN
  ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_humanId_fkey" FOREIGN KEY ("humanId") REFERENCES "Human"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- PushNotificationJob table
CREATE TABLE IF NOT EXISTS "PushNotificationJob" (
    "id" TEXT NOT NULL,
    "humanId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PushNotificationJob_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PushNotificationJob_status_idx" ON "PushNotificationJob"("status");

-- Add CV-related columns to Human
ALTER TABLE "Human" ADD COLUMN IF NOT EXISTS "cvConsent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Human" ADD COLUMN IF NOT EXISTS "cvParsedAt" TIMESTAMP(3);
ALTER TABLE "Human" ADD COLUMN IF NOT EXISTS "experienceHighlights" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Human" ADD COLUMN IF NOT EXISTS "skillSources" JSONB;
