-- Migration: add missing 'notes' column to ncr
-- Date: 2026-04-24
--
-- Context: schema drift in the production ncr table.
-- The app (svNcr in index.html:1725) sends `notes` on every
-- INSERT / UPDATE. The form contains textarea#ncr-notes
-- (index.html:1007) labeled "הערות". But the notes column
-- is missing in production, so every save fails with:
--   PGRST204 "Could not find the 'notes' column of 'ncr'
--   in the schema cache"
--
-- The previous drift fix (2026-04-22_ncr_columns.sql) added
-- cd / sd / loc / root_cause / immediate but left out notes
-- by oversight.
--
-- Safe to re-run: uses IF NOT EXISTS.

-- How to run:
-- 1. Open Supabase dashboard → SQL Editor
-- 2. Paste this file
-- 3. Click Run
-- 4. Verify with:
--    SELECT column_name, data_type
--      FROM information_schema.columns
--     WHERE table_schema='public'
--       AND table_name='ncr'
--       AND column_name='notes';
-- 5. In the app: open the outbox pill and retry the
--    pending ins ncr operations — they should succeed now.

ALTER TABLE ncr ADD COLUMN IF NOT EXISTS notes TEXT;

-- Rollback (if needed):
-- ALTER TABLE ncr DROP COLUMN IF EXISTS notes;
