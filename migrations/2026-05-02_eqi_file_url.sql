-- Migration: add file_url column to equip_inspections
-- Date: 2026-05-02
-- Reason: PDF inspection report upload feature stores the scanned PDF URL
--         on the equipment record so users can view it from the eqi page.

-- How to run:
-- 1. Open Supabase dashboard → SQL Editor
-- 2. Paste this entire file
-- 3. Click Run

ALTER TABLE equip_inspections ADD COLUMN IF NOT EXISTS file_url text;

-- Rollback (if needed):
-- ALTER TABLE equip_inspections DROP COLUMN IF EXISTS file_url;
