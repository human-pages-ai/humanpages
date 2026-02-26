-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "profilePhotoKey" TEXT,
ADD COLUMN     "profilePhotoStatus" TEXT NOT NULL DEFAULT 'none';
