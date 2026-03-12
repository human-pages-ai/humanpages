-- CreateTable
CREATE TABLE "ListingLink" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "label" TEXT,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListingLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ListingLink_code_key" ON "ListingLink"("code");

-- CreateIndex
CREATE INDEX "ListingLink_listingId_idx" ON "ListingLink"("listingId");

-- AddForeignKey
ALTER TABLE "ListingLink" ADD CONSTRAINT "ListingLink_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
