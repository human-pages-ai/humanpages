-- CreateEnum
CREATE TYPE "AdjustmentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Human" ADD COLUMN "staffDailyRate" DECIMAL(10,2),
ADD COLUMN "staffDailyHours" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "StaffPayment" (
    "id" TEXT NOT NULL,
    "humanId" TEXT NOT NULL,
    "amountUsd" DECIMAL(10,2) NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HoursAdjustment" (
    "id" TEXT NOT NULL,
    "humanId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "minutes" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "AdjustmentStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HoursAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffPayment_humanId_paymentDate_idx" ON "StaffPayment"("humanId", "paymentDate");

-- CreateIndex
CREATE INDEX "HoursAdjustment_humanId_date_idx" ON "HoursAdjustment"("humanId", "date");

-- CreateIndex
CREATE INDEX "HoursAdjustment_status_idx" ON "HoursAdjustment"("status");

-- AddForeignKey
ALTER TABLE "StaffPayment" ADD CONSTRAINT "StaffPayment_humanId_fkey" FOREIGN KEY ("humanId") REFERENCES "Human"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPayment" ADD CONSTRAINT "StaffPayment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Human"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoursAdjustment" ADD CONSTRAINT "HoursAdjustment_humanId_fkey" FOREIGN KEY ("humanId") REFERENCES "Human"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoursAdjustment" ADD CONSTRAINT "HoursAdjustment_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "Human"("id") ON DELETE SET NULL ON UPDATE CASCADE;
