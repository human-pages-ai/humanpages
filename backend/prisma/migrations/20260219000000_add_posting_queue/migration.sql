-- CreateEnum
CREATE TYPE "HumanRole" AS ENUM ('USER', 'STAFF', 'ADMIN');

-- CreateEnum
CREATE TYPE "PostingGroupStatus" AS ENUM ('PENDING', 'JOINED', 'POSTED', 'REJECTED', 'SKIPPED');

-- AlterTable
ALTER TABLE "Human" ADD COLUMN "role" "HumanRole" NOT NULL DEFAULT 'USER';

-- CreateTable
CREATE TABLE "AdCopy" (
    "id" TEXT NOT NULL,
    "adNumber" INTEGER NOT NULL,
    "language" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdCopy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostingGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "adId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "status" "PostingGroupStatus" NOT NULL DEFAULT 'PENDING',
    "datePosted" TIMESTAMP(3),
    "notes" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostingGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdCopy_adNumber_language_key" ON "AdCopy"("adNumber", "language");

-- CreateIndex
CREATE INDEX "PostingGroup_status_idx" ON "PostingGroup"("status");

-- CreateIndex
CREATE INDEX "PostingGroup_adId_language_idx" ON "PostingGroup"("adId", "language");

-- CreateIndex
CREATE INDEX "PostingGroup_country_idx" ON "PostingGroup"("country");

-- AddForeignKey
ALTER TABLE "PostingGroup" ADD CONSTRAINT "PostingGroup_adId_fkey" FOREIGN KEY ("adId") REFERENCES "AdCopy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
