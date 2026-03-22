-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "solverGithubId" TEXT,
ADD COLUMN     "solverTelegramId" TEXT,
ADD COLUMN     "solverVerificationToken" TEXT,
ADD COLUMN     "solverVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "solverVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "solverVerifiedMethod" TEXT;
