-- Remove duplicates: keep the oldest row for each URL
DELETE FROM "PostingGroup"
WHERE id NOT IN (
  SELECT MIN(id) FROM "PostingGroup" GROUP BY url
);

-- Add unique index on url
CREATE UNIQUE INDEX "PostingGroup_url_key" ON "PostingGroup"("url");
