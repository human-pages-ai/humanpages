-- Data backfill migration (no schema changes)
-- Part of security-bug-fixes branch. Companion to the code changes that
-- enforce lowercased Ethereum addresses at write time going forward.
--
-- Problem 1: Historical address records may be stored mixed-case, causing
-- silent lookup failures now that the code normalizes to lowercase at read time
-- (escrow arbitrator check, wallet verification, humanity scoring).
--
-- Problem 2: Listings never auto-transition to EXPIRED — expiry was checked
-- on read and returned an error, but the row's status stayed OPEN, so stale
-- listings counted against human listing quota forever. The new quota filter
-- excludes EXPIRED, so we need to actually flip them.
--
-- All statements are idempotent and safe to re-run.

-- 1. Lowercase agent wallet addresses.
UPDATE "AgentWallet"
SET address = LOWER(address)
WHERE address IS NOT NULL
  AND address <> LOWER(address);

-- 2. Lowercase human wallet addresses.
UPDATE "Wallet"
SET address = LOWER(address)
WHERE address IS NOT NULL
  AND address <> LOWER(address);

-- 3. Lowercase escrow addresses on jobs.
UPDATE "Job"
SET "escrowArbitratorAddress" = LOWER("escrowArbitratorAddress")
WHERE "escrowArbitratorAddress" IS NOT NULL
  AND "escrowArbitratorAddress" <> LOWER("escrowArbitratorAddress");

UPDATE "Job"
SET "escrowDepositorAddress" = LOWER("escrowDepositorAddress")
WHERE "escrowDepositorAddress" IS NOT NULL
  AND "escrowDepositorAddress" <> LOWER("escrowDepositorAddress");

UPDATE "Job"
SET "escrowPayeeAddress" = LOWER("escrowPayeeAddress")
WHERE "escrowPayeeAddress" IS NOT NULL
  AND "escrowPayeeAddress" <> LOWER("escrowPayeeAddress");

-- 4. Flip stale OPEN listings to EXPIRED so they stop consuming quota.
UPDATE "Listing"
SET status = 'EXPIRED'
WHERE status = 'OPEN'
  AND "expiresAt" <= NOW();
