-- Add arbitrator approval gate
ALTER TABLE "Agent" ADD COLUMN "arbitratorApproved" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Agent" ADD COLUMN "arbitratorApprovedAt" TIMESTAMP(3);
