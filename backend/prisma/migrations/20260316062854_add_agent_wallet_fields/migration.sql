-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "walletAddress" TEXT,
ADD COLUMN     "walletNetwork" TEXT DEFAULT 'base';
