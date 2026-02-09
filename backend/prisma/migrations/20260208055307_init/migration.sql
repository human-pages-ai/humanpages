/*
  Warnings:

  - A unique constraint covering the columns `[emailVerificationToken]` on the table `Human` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "PaymentPreference" AS ENUM ('ESCROW', 'UPFRONT', 'BOTH');

-- AlterTable
ALTER TABLE "Human" ADD COLUMN     "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "emailVerificationToken" TEXT,
ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paymentPreference" "PaymentPreference" NOT NULL DEFAULT 'BOTH',
ADD COLUMN     "termsAcceptedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Human_emailVerificationToken_key" ON "Human"("emailVerificationToken");
