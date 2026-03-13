-- WhatsAppOTP table (for self-service OTP signup/login)
CREATE TABLE IF NOT EXISTS "WhatsAppOTP" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "usedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WhatsAppOTP_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "WhatsAppOTP_phone_code_idx" ON "WhatsAppOTP"("phone", "code");
CREATE INDEX IF NOT EXISTS "WhatsAppOTP_expiresAt_idx" ON "WhatsAppOTP"("expiresAt");

-- WhatsAppSignupSession table (for inbound conversational signup)
CREATE TABLE IF NOT EXISTS "WhatsAppSignupSession" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "step" TEXT NOT NULL DEFAULT 'AWAITING_NAME',
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WhatsAppSignupSession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppSignupSession_phone_key" ON "WhatsAppSignupSession"("phone");
CREATE INDEX IF NOT EXISTS "WhatsAppSignupSession_expiresAt_idx" ON "WhatsAppSignupSession"("expiresAt");
