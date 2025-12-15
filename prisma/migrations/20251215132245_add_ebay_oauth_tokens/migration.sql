-- AlterEnum
ALTER TYPE "ExternalPlatform" ADD VALUE 'EBAY';

-- AlterTable
ALTER TABLE "Deal" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ExternalProfile" ADD COLUMN     "accessTokenEnc" TEXT,
ADD COLUMN     "accessTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "refreshTokenEnc" TEXT,
ADD COLUMN     "refreshTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "scopes" TEXT,
ADD COLUMN     "tokenType" TEXT;
