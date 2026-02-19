-- CreateTable
CREATE TABLE "StaffApiKey" (
    "id" TEXT NOT NULL,
    "humanId" TEXT NOT NULL,
    "apiKeyPrefix" TEXT NOT NULL,
    "apiKeyHash" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffApiKey_humanId_key" ON "StaffApiKey"("humanId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffApiKey_apiKeyPrefix_key" ON "StaffApiKey"("apiKeyPrefix");

-- AddForeignKey
ALTER TABLE "StaffApiKey" ADD CONSTRAINT "StaffApiKey_humanId_fkey" FOREIGN KEY ("humanId") REFERENCES "Human"("id") ON DELETE CASCADE ON UPDATE CASCADE;
