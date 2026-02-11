-- AlterTable: add profileNudgeSentAt for tracking profile completion reminder emails
ALTER TABLE "Human" ADD COLUMN "profileNudgeSentAt" TIMESTAMP(3);
