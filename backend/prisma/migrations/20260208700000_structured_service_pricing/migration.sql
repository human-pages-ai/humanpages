-- AlterTable: Replace free-text priceRange with structured pricing fields
ALTER TABLE "Service" ADD COLUMN "priceMin" DECIMAL(10,2);
ALTER TABLE "Service" ADD COLUMN "priceUnit" "RateType";
ALTER TABLE "Service" DROP COLUMN "priceRange";
