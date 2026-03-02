-- Drop unused columns that were added by earlier migrations but removed from schema.
-- These columns contain no production data.

-- Human: emailVerificationTokenCreatedAt (never used, token expiry not implemented)
ALTER TABLE "Human" DROP COLUMN IF EXISTS "emailVerificationTokenCreatedAt";

-- ContentItem: blog image fields (replaced by imageR2Key)
ALTER TABLE "ContentItem" DROP COLUMN IF EXISTS "blogImageR2Key";
ALTER TABLE "ContentItem" DROP COLUMN IF EXISTS "blogThumbR2Key";
ALTER TABLE "ContentItem" DROP COLUMN IF EXISTS "blogImageType";
