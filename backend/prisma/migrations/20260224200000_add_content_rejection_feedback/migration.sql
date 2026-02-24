-- AlterTable
ALTER TABLE "ContentItem" ADD COLUMN "rejectionReason" TEXT;
ALTER TABLE "ContentItem" ADD COLUMN "rejectedById" TEXT;
ALTER TABLE "ContentItem" ADD COLUMN "rejectedAt" TIMESTAMP(3);
