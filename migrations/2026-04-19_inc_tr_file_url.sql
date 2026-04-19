-- Migration: add file_url column to inc and tr tables
-- Date: 2026-04-19

-- How to run:
-- 1. Open Supabase dashboard → SQL Editor
-- 2. Paste this entire file
-- 3. Click Run

ALTER TABLE inc ADD COLUMN IF NOT EXISTS file_url text;
ALTER TABLE tr  ADD COLUMN IF NOT EXISTS file_url text;

-- Rollback (if needed):
-- ALTER TABLE inc DROP COLUMN IF EXISTS file_url;
-- ALTER TABLE tr  DROP COLUMN IF EXISTS file_url;
