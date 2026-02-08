-- AlterTable: change hideContact default to true
ALTER TABLE "Human" ALTER COLUMN "hideContact" SET DEFAULT true;

-- AlterTable: add notification preference columns
ALTER TABLE "Human" ADD COLUMN "telegramNotifications" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "whatsappNotifications" BOOLEAN NOT NULL DEFAULT true;
