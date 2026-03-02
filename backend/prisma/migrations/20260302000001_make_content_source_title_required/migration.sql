-- Backfill any null sourceTitles before adding NOT NULL
UPDATE "ContentItem" SET "sourceTitle" = 'Untitled' WHERE "sourceTitle" IS NULL;

-- Make sourceTitle required (matches schema)
ALTER TABLE "ContentItem" ALTER COLUMN "sourceTitle" SET NOT NULL;
