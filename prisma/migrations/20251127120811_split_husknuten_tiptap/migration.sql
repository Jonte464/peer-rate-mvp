-- Lägg till de nya enum-värdena (utan att röra det gamla värdet)
ALTER TYPE "RatingSource" ADD VALUE IF NOT EXISTS 'HUSKNUTEN';
ALTER TYPE "RatingSource" ADD VALUE IF NOT EXISTS 'TIPTAP';
