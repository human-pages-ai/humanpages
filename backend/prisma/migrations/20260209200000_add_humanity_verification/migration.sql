-- AlterTable
ALTER TABLE "Human" ADD COLUMN     "humanityVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "humanityProvider" TEXT,
ADD COLUMN     "humanityScore" DOUBLE PRECISION,
ADD COLUMN     "humanityVerifiedAt" TIMESTAMP(3);
