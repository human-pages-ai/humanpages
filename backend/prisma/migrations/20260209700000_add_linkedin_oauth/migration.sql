-- AlterTable
ALTER TABLE "Human" ADD COLUMN "linkedinId" TEXT,
ADD COLUMN "linkedinVerified" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "Human_linkedinId_key" ON "Human"("linkedinId");
