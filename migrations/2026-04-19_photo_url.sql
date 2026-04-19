-- Migration: add photo_url column to near_miss and equip_inspections
-- Date: 2026-04-19

-- How to run:
-- 1. Open Supabase dashboard → SQL Editor
-- 2. Paste this entire file
-- 3. Click Run

ALTER TABLE near_miss ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE equip_inspections ADD COLUMN IF NOT EXISTS photo_url text;

-- Also create the Storage bucket via Supabase Dashboard:
-- Storage → New bucket → Name: incidents-photos → Public: ON
-- Then add INSERT policy for anon role:
--   Storage → incidents-photos → Policies → New policy
--   Policy name: allow_anon_insert
--   Allowed operation: INSERT
--   Target roles: anon
--   USING expression: true

-- Rollback (if needed):
-- ALTER TABLE near_miss DROP COLUMN IF EXISTS photo_url;
-- ALTER TABLE equip_inspections DROP COLUMN IF EXISTS photo_url;
