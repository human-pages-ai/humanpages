-- AlterTable
ALTER TABLE "Human" ADD COLUMN "featuredConsent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Human" ADD COLUMN "featuredInviteSentAt" TIMESTAMP(3);
