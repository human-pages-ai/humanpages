-- AlterTable
ALTER TABLE "Human" ADD COLUMN     "githubId" TEXT,
ADD COLUMN     "githubVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "githubUsername" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Human_githubId_key" ON "Human"("githubId");
