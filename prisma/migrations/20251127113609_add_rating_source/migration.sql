/*
  Warnings:

  - You are about to drop the column `source` on the `Rating` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Rating" DROP COLUMN "source",
ADD COLUMN     "ratingSource" "RatingSource" NOT NULL DEFAULT 'OTHER';
