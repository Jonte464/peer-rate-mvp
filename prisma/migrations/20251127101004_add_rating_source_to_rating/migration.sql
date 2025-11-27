-- CreateEnum
CREATE TYPE "RatingSource" AS ENUM ('BLOCKET', 'TRADERA', 'AIRBNB', 'HUSKNUTEN_TIPTAP', 'OTHER');

-- AlterTable
ALTER TABLE "Rating" ADD COLUMN     "source" "RatingSource" NOT NULL DEFAULT 'OTHER';
