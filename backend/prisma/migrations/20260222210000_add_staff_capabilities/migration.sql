-- AlterTable
ALTER TABLE "Human" ADD COLUMN "capabilities" TEXT[] DEFAULT ARRAY[]::TEXT[];
