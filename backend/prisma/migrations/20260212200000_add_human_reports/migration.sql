-- CreateEnum
CREATE TYPE "HumanStatus" AS ENUM ('ACTIVE', 'FLAGGED', 'SUSPENDED', 'BANNED');

-- AlterTable
ALTER TABLE "Human" ADD COLUMN     "status_human" "HumanStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "abuseScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "abuseStrikes" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "HumanReport" (
    "id" TEXT NOT NULL,
    "reportedHumanId" TEXT NOT NULL,
    "reporterHumanId" TEXT NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "description" VARCHAR(1000),
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HumanReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HumanReport_reportedHumanId_idx" ON "HumanReport"("reportedHumanId");

-- CreateIndex
CREATE INDEX "HumanReport_reporterHumanId_idx" ON "HumanReport"("reporterHumanId");

-- CreateIndex
CREATE INDEX "HumanReport_reportedHumanId_status_idx" ON "HumanReport"("reportedHumanId", "status");

-- CreateIndex
CREATE INDEX "Human_status_human_idx" ON "Human"("status_human");

-- AddForeignKey
ALTER TABLE "HumanReport" ADD CONSTRAINT "HumanReport_reportedHumanId_fkey" FOREIGN KEY ("reportedHumanId") REFERENCES "Human"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HumanReport" ADD CONSTRAINT "HumanReport_reporterHumanId_fkey" FOREIGN KEY ("reporterHumanId") REFERENCES "Human"("id") ON DELETE CASCADE ON UPDATE CASCADE;
