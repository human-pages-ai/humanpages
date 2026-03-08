-- Add verified column to Wallet (deny-by-default: all wallets start unverified)
ALTER TABLE "Wallet" ADD COLUMN "verified" BOOLEAN NOT NULL DEFAULT false;

-- Mark existing signature-verified wallets (source = 'external' means they went through
-- the signature challenge flow in POST /wallets). Privy wallets added via /wallets/manual
-- without identity token verification remain unverified until re-verified.
UPDATE "Wallet" SET "verified" = true WHERE "source" = 'external';

-- Add privyDid to Human for Privy identity binding
ALTER TABLE "Human" ADD COLUMN "privyDid" TEXT;

-- Unique constraint: one Human Pages account = one Privy identity
CREATE UNIQUE INDEX "Human_privyDid_key" ON "Human"("privyDid");

-- Normalize all existing wallet addresses to lowercase to prevent EIP-55 checksum casing
-- issues with the @@unique([humanId, network, address]) constraint
UPDATE "Wallet" SET "address" = LOWER("address") WHERE "address" != LOWER("address");
