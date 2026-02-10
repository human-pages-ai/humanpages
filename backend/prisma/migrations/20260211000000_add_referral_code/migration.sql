-- AlterTable: add referralCode column with a temporary default
ALTER TABLE "Human" ADD COLUMN "referralCode" TEXT NOT NULL DEFAULT '';

-- Backfill existing rows with unique 8-char codes derived from their id
UPDATE "Human" SET "referralCode" = substr(md5(id), 1, 8) WHERE "referralCode" = '';

-- Now enforce uniqueness
CREATE UNIQUE INDEX "Human_referralCode_key" ON "Human"("referralCode");
