-- CreateEnum
CREATE TYPE "FiatPaymentPlatform" AS ENUM ('WISE', 'VENMO', 'PAYPAL', 'CASHAPP', 'REVOLUT', 'ZELLE', 'MONZO', 'N26', 'MERCADOPAGO');

-- CreateTable
CREATE TABLE "FiatPaymentMethod" (
    "id" TEXT NOT NULL,
    "humanId" TEXT NOT NULL,
    "platform" "FiatPaymentPlatform" NOT NULL,
    "handle" TEXT NOT NULL,
    "label" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FiatPaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FiatPaymentMethod_platform_handle_idx" ON "FiatPaymentMethod"("platform", "handle");

-- CreateIndex
CREATE UNIQUE INDEX "FiatPaymentMethod_humanId_platform_handle_key" ON "FiatPaymentMethod"("humanId", "platform", "handle");

-- AddForeignKey
ALTER TABLE "FiatPaymentMethod" ADD CONSTRAINT "FiatPaymentMethod_humanId_fkey" FOREIGN KEY ("humanId") REFERENCES "Human"("id") ON DELETE CASCADE ON UPDATE CASCADE;
