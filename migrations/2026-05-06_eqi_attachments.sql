-- Migration: equip_inspections.attachments — multi-file support
-- Date: 2026-05-06
-- The "+ הוסף ציוד" form previously allowed only one photo. The user can
-- now attach any number of files (PDF / Excel / Word / image) to one
-- equipment record. The first file is still mirrored into photo_url for
-- backward compatibility with code that hasn't been updated yet.
--
-- How to run:
--   1. Open Supabase dashboard → SQL Editor → + New query
--   2. Paste this entire file
--   3. Click Run

ALTER TABLE equip_inspections
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

NOTIFY pgrst, 'reload schema';

-- Verify (optional):
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name='equip_inspections' AND column_name='attachments';
-- Expected: 1 row.

-- Rollback:
-- ALTER TABLE equip_inspections DROP COLUMN IF EXISTS attachments;
