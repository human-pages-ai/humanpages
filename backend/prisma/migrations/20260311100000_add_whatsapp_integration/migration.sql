-- WhatsApp integration: link codes, verification, pending messages

-- Add WhatsApp fields to Human
ALTER TABLE "Human" ADD COLUMN "whatsappVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Human" ADD COLUMN "linkCode" TEXT;
ALTER TABLE "Human" ADD COLUMN "linkCodeExpiresAt" TIMESTAMP(3);
ALTER TABLE "Human" ADD COLUMN "whatsappAwaitingJobSelection" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Human" ADD COLUMN "whatsappDisambiguationAt" TIMESTAMP(3);
ALTER TABLE "Human" ADD COLUMN "whatsappLastInboundAt" TIMESTAMP(3);

-- Unique index on link codes
CREATE UNIQUE INDEX "Human_linkCode_key" ON "Human"("linkCode");

-- Pending WhatsApp messages (queued outside 24h window)
CREATE TABLE "PendingWhatsAppMessage" (
    "id" TEXT NOT NULL,
    "humanId" TEXT NOT NULL,
    "jobId" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingWhatsAppMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PendingWhatsAppMessage_humanId_idx" ON "PendingWhatsAppMessage"("humanId");

ALTER TABLE "PendingWhatsAppMessage" ADD CONSTRAINT "PendingWhatsAppMessage_humanId_fkey" FOREIGN KEY ("humanId") REFERENCES "Human"("id") ON DELETE CASCADE ON UPDATE CASCADE;
