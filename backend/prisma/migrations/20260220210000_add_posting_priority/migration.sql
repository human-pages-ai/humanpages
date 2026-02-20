-- AlterTable: notes from VarChar(1000) to Text, add priority column
ALTER TABLE "PostingGroup" ALTER COLUMN "notes" TYPE TEXT;
ALTER TABLE "PostingGroup" ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "PostingGroup_priority_idx" ON "PostingGroup"("priority");
