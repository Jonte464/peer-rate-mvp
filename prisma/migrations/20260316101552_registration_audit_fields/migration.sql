-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "privacyAccepted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "privacyAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "privacyVersionAccepted" TEXT,
ADD COLUMN     "registrationIp" TEXT,
ADD COLUMN     "registrationMethod" TEXT,
ADD COLUMN     "registrationUserAgent" TEXT,
ADD COLUMN     "termsAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "termsVersionAccepted" TEXT;
