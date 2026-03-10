-- CreateEnum: PaymentMode
CREATE TYPE "PaymentMode" AS ENUM ('ONE_TIME', 'STREAM');

-- CreateEnum: StreamInterval
CREATE TYPE "StreamInterval" AS ENUM ('HOURLY', 'DAILY', 'WEEKLY');

-- CreateEnum: StreamMethod
CREATE TYPE "StreamMethod" AS ENUM ('SUPERFLUID', 'MICRO_TRANSFER');

-- CreateEnum: TickStatus
CREATE TYPE "TickStatus" AS ENUM ('PENDING', 'VERIFIED', 'MISSED', 'SKIPPED');

-- Add new JobStatus values
ALTER TYPE "JobStatus" ADD VALUE 'STREAMING';
ALTER TYPE "JobStatus" ADD VALUE 'PAUSED';

-- Migrate paymentPreference enum column to paymentPreferences text array
ALTER TABLE "Human" ADD COLUMN "paymentPreferences" TEXT[] DEFAULT ARRAY['UPFRONT', 'ESCROW', 'UPON_COMPLETION'];

-- Populate from old enum column
UPDATE "Human" SET "paymentPreferences" = CASE
  WHEN "paymentPreference" = 'BOTH' THEN ARRAY['UPFRONT', 'ESCROW', 'UPON_COMPLETION']
  WHEN "paymentPreference" = 'ESCROW' THEN ARRAY['ESCROW']
  WHEN "paymentPreference" = 'UPFRONT' THEN ARRAY['UPFRONT']
  ELSE ARRAY['UPFRONT', 'ESCROW', 'UPON_COMPLETION']
END;

-- Drop old column and enum
ALTER TABLE "Human" DROP COLUMN IF EXISTS "paymentPreference";
DROP TYPE IF EXISTS "PaymentPreference";

-- Add stream payment fields to Job
ALTER TABLE "Job" ADD COLUMN "paymentTiming" TEXT DEFAULT 'upfront';
ALTER TABLE "Job" ADD COLUMN "paymentMode" "PaymentMode" NOT NULL DEFAULT 'ONE_TIME';
ALTER TABLE "Job" ADD COLUMN "streamMethod" "StreamMethod";
ALTER TABLE "Job" ADD COLUMN "streamInterval" "StreamInterval";
ALTER TABLE "Job" ADD COLUMN "streamRateUsdc" DECIMAL(18,6);
ALTER TABLE "Job" ADD COLUMN "streamFlowRate" TEXT;
ALTER TABLE "Job" ADD COLUMN "streamMaxTicks" INTEGER;
ALTER TABLE "Job" ADD COLUMN "streamNetwork" TEXT;
ALTER TABLE "Job" ADD COLUMN "streamToken" TEXT;
ALTER TABLE "Job" ADD COLUMN "streamSuperToken" TEXT;
ALTER TABLE "Job" ADD COLUMN "streamSenderAddress" TEXT;
ALTER TABLE "Job" ADD COLUMN "streamStartedAt" TIMESTAMP(3);
ALTER TABLE "Job" ADD COLUMN "streamPausedAt" TIMESTAMP(3);
ALTER TABLE "Job" ADD COLUMN "streamEndedAt" TIMESTAMP(3);
ALTER TABLE "Job" ADD COLUMN "streamTickCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Job" ADD COLUMN "streamMissedTicks" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Job" ADD COLUMN "streamTotalPaid" DECIMAL(18,6);
ALTER TABLE "Job" ADD COLUMN "streamGraceTicks" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Job" ADD COLUMN "streamContractId" TEXT;

-- CreateTable: StreamTick
CREATE TABLE "StreamTick" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "tickNumber" INTEGER NOT NULL,
    "status" "TickStatus" NOT NULL DEFAULT 'PENDING',
    "expectedAt" TIMESTAMP(3) NOT NULL,
    "graceDeadline" TIMESTAMP(3) NOT NULL,
    "txHash" TEXT,
    "network" TEXT,
    "token" TEXT,
    "amount" DECIMAL(18,6),
    "fromAddress" TEXT,
    "toAddress" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "confirmations" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StreamTick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StreamTick_txHash_key" ON "StreamTick"("txHash");
CREATE UNIQUE INDEX "StreamTick_jobId_tickNumber_key" ON "StreamTick"("jobId", "tickNumber");
CREATE INDEX "StreamTick_jobId_status_idx" ON "StreamTick"("jobId", "status");
CREATE INDEX "StreamTick_status_graceDeadline_idx" ON "StreamTick"("status", "graceDeadline");

-- AddForeignKey
ALTER TABLE "StreamTick" ADD CONSTRAINT "StreamTick_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Job indexes
CREATE INDEX "Job_paymentMode_status_idx" ON "Job"("paymentMode", "status");
CREATE INDEX "Job_status_streamMethod_idx" ON "Job"("status", "streamMethod");
