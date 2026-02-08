-- DropIndex
DROP INDEX IF EXISTS "Human_githubId_key";

-- AlterTable
ALTER TABLE "Human" DROP COLUMN IF EXISTS "githubId";
