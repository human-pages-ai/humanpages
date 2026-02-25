-- AlterTable
ALTER TABLE "ContentItem" ADD COLUMN "devtoUrl" TEXT,
ADD COLUMN "devtoArticleId" TEXT,
ADD COLUMN "hashnodeUrl" TEXT,
ADD COLUMN "hashnodePostId" TEXT,
ADD COLUMN "crosspostErrors" JSONB;
