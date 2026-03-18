-- Add denormalized vouch count column
ALTER TABLE "Human" ADD COLUMN IF NOT EXISTS "vouchCount" INTEGER NOT NULL DEFAULT 0;

-- Backfill existing vouch counts
UPDATE "Human" h
SET "vouchCount" = (
  SELECT COUNT(*)::int FROM "Vouch" v WHERE v."voucheeId" = h.id
);

-- Indexes for substring search on education fields
CREATE INDEX IF NOT EXISTS "Education_degree_idx" ON "Education" ("degree");
CREATE INDEX IF NOT EXISTS "Education_field_idx" ON "Education" ("field");
CREATE INDEX IF NOT EXISTS "Education_institution_idx" ON "Education" ("institution");

-- Indexes for substring search on certificate fields
CREATE INDEX IF NOT EXISTS "Certificate_name_idx" ON "Certificate" ("name");
CREATE INDEX IF NOT EXISTS "Certificate_issuer_idx" ON "Certificate" ("issuer");
