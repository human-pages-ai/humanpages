-- AlterTable: Add hideRealName privacy toggle
ALTER TABLE "Human" ADD COLUMN "hideRealName" BOOLEAN NOT NULL DEFAULT false;
