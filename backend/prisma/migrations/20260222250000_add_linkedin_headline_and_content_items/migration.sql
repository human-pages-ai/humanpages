-- CreateEnum (if not exists)
DO $$ BEGIN
  CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'REVIEW', 'APPROVED', 'PUBLISHED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ContentPlatform" AS ENUM ('TWITTER', 'LINKEDIN', 'BLOG');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable
ALTER TABLE "Human" ADD COLUMN IF NOT EXISTS "linkedinHeadline" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "ContentItem" (
    "id" TEXT NOT NULL,
    "sourceTitle" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "source" TEXT,
    "relevanceScore" INTEGER,
    "whyUs" TEXT,
    "platform" "ContentPlatform" NOT NULL,
    "tweetDraft" TEXT,
    "linkedinSnippet" TEXT,
    "blogTitle" TEXT,
    "blogSlug" TEXT,
    "blogBody" TEXT,
    "blogExcerpt" VARCHAR(500),
    "blogReadingTime" TEXT,
    "metaDescription" VARCHAR(300),
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "publishedUrl" TEXT,
    "publishError" TEXT,
    "manualInstructions" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ContentItem_blogSlug_key" ON "ContentItem"("blogSlug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ContentItem_status_idx" ON "ContentItem"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ContentItem_platform_status_idx" ON "ContentItem"("platform", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ContentItem_blogSlug_idx" ON "ContentItem"("blogSlug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ContentItem_createdAt_idx" ON "ContentItem"("createdAt");
