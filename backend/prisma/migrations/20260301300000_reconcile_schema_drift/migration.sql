-- Reconcile schema drift: add tables/columns/enums that exist in schema.prisma
-- but were never given a migration (applied via db push only).
-- All statements use IF NOT EXISTS so this is safe to run on any database state.

-- ===== Video pipeline enums =====
DO $$ BEGIN CREATE TYPE "VideoTier" AS ENUM ('NANO', 'DRAFT', 'FINAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "VideoStatus" AS ENUM ('GENERATING', 'DRAFT', 'READY', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "PublishPlatform" AS ENUM ('TIKTOK', 'YOUTUBE', 'INSTAGRAM', 'LINKEDIN', 'TWITTER', 'FACEBOOK', 'BLOG'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "PublishContentType" AS ENUM ('VIDEO', 'ARTICLE', 'SHORT_POST', 'IMAGE_POST'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "PublicationStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'FAILED', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ===== Video table =====
CREATE TABLE IF NOT EXISTS "Video" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "conceptSnapshot" JSONB NOT NULL,
    "scriptSnapshot" JSONB,
    "tier" "VideoTier" NOT NULL DEFAULT 'NANO',
    "status" "VideoStatus" NOT NULL DEFAULT 'GENERATING',
    "durationSeconds" DOUBLE PRECISION,
    "aspectRatio" TEXT NOT NULL DEFAULT '9:16',
    "videoR2Key" TEXT,
    "thumbnailR2Key" TEXT,
    "estimatedCostUsd" DOUBLE PRECISION,
    "conceptSlug" TEXT,
    "generatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Video_slug_key" ON "Video"("slug");
CREATE INDEX IF NOT EXISTS "Video_status_idx" ON "Video"("status");
CREATE INDEX IF NOT EXISTS "Video_tier_idx" ON "Video"("tier");
CREATE INDEX IF NOT EXISTS "Video_conceptSlug_idx" ON "Video"("conceptSlug");

-- ===== VideoAsset table =====
CREATE TABLE IF NOT EXISTS "VideoAsset" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "r2Key" TEXT NOT NULL,
    "assetType" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "fileSize" INTEGER,
    "sceneNumber" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoAsset_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "VideoAsset_videoId_idx" ON "VideoAsset"("videoId");
CREATE INDEX IF NOT EXISTS "VideoAsset_assetType_idx" ON "VideoAsset"("assetType");
DO $$ BEGIN
    ALTER TABLE "VideoAsset" ADD CONSTRAINT "VideoAsset_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ===== PublicationSchedule table =====
CREATE TABLE IF NOT EXISTS "PublicationSchedule" (
    "id" TEXT NOT NULL,
    "videoId" TEXT,
    "contentItemId" TEXT,
    "title" TEXT,
    "body" TEXT,
    "imageR2Key" TEXT,
    "platform" "PublishPlatform" NOT NULL,
    "contentType" "PublishContentType" NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "isAuto" BOOLEAN NOT NULL DEFAULT false,
    "status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedUrl" TEXT,
    "errorMessage" TEXT,
    "platformMeta" JSONB,
    "assignedToId" TEXT,
    "completedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicationSchedule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PublicationSchedule_status_scheduledAt_idx" ON "PublicationSchedule"("status", "scheduledAt");
CREATE INDEX IF NOT EXISTS "PublicationSchedule_platform_status_idx" ON "PublicationSchedule"("platform", "status");
CREATE INDEX IF NOT EXISTS "PublicationSchedule_videoId_idx" ON "PublicationSchedule"("videoId");
CREATE INDEX IF NOT EXISTS "PublicationSchedule_contentItemId_idx" ON "PublicationSchedule"("contentItemId");
DO $$ BEGIN
    ALTER TABLE "PublicationSchedule" ADD CONSTRAINT "PublicationSchedule_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE "PublicationSchedule" ADD CONSTRAINT "PublicationSchedule_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE "PublicationSchedule" ADD CONSTRAINT "PublicationSchedule_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "Human"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE "PublicationSchedule" ADD CONSTRAINT "PublicationSchedule_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "Human"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
