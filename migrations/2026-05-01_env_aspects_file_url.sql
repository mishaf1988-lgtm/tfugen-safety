-- Migration: add file_url to env_aspects
-- Date: 2026-05-01
-- Allows attaching the official Tfugen form 28.01 Excel (or any supporting
-- document — lab report, photo, certificate) to an environmental aspect record.
--
-- How to run:
--   1. Open Supabase dashboard → SQL Editor → + New query
--   2. Paste this entire file
--   3. Click Run

ALTER TABLE env_aspects
  ADD COLUMN IF NOT EXISTS file_url text;

-- Rollback:
-- ALTER TABLE env_aspects DROP COLUMN IF EXISTS file_url;
