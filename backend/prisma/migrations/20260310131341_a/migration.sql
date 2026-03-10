/*
  Warnings:

  - You are about to drop the column `parentJobId` on the `Job` table. All the data in the column will be lost.
  - You are about to drop the `ConciergePosting` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ExternalApplication` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ConciergePosting" DROP CONSTRAINT "ConciergePosting_conciergeId_fkey";

-- DropForeignKey
ALTER TABLE "ConciergePosting" DROP CONSTRAINT "ConciergePosting_jobId_fkey";

-- DropForeignKey
ALTER TABLE "ExternalApplication" DROP CONSTRAINT "ExternalApplication_linkedHumanId_fkey";

-- DropForeignKey
ALTER TABLE "ExternalApplication" DROP CONSTRAINT "ExternalApplication_postingId_fkey";

-- DropForeignKey
ALTER TABLE "ExternalApplication" DROP CONSTRAINT "ExternalApplication_subJobId_fkey";

-- DropForeignKey
ALTER TABLE "Job" DROP CONSTRAINT "Job_parentJobId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "Job_parentJobId_idx";

-- AlterTable
ALTER TABLE "Job" DROP COLUMN IF EXISTS "parentJobId";

-- DropTable
DROP TABLE "ConciergePosting";

-- DropTable
DROP TABLE "ExternalApplication";

-- DropEnum
DROP TYPE "ConciergePostingStatus";

-- DropEnum
DROP TYPE "ExternalApplicationStatus";
