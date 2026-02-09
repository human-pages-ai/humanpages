-- AlterTable: Add analytics opt-out field for GDPR compliance
ALTER TABLE "Human" ADD COLUMN "analyticsOptOut" BOOLEAN NOT NULL DEFAULT false;
