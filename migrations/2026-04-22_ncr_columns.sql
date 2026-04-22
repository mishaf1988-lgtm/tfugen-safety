-- Migration: add NCR columns that client-side svNcr/xlParse send
-- Date: 2026-04-22
--
-- Context: schema drift fix. The HTML form's svNcr and the Excel
-- importer (xlParse) send these fields when creating/closing an NCR,
-- but the production ncr table was missing them. Supabase returned
-- PGRST204 "Could not find the 'cd' column of 'ncr' in the schema
-- cache" and blocked INSERTs. Follow-up to the 2026-04-22 'category'
-- column fix.
--
-- How to run:
-- 1. Open Supabase dashboard → SQL Editor
-- 2. Paste this entire file
-- 3. Click Run
-- 4. Verify: all 5 columns appear on the ncr table
--
-- Safe to re-run: every ALTER uses IF NOT EXISTS.

ALTER TABLE ncr ADD COLUMN IF NOT EXISTS cd          DATE;  -- close date (set when status = סגור)
ALTER TABLE ncr ADD COLUMN IF NOT EXISTS sd          DATE;  -- source date
ALTER TABLE ncr ADD COLUMN IF NOT EXISTS loc         TEXT;  -- free-text location
ALTER TABLE ncr ADD COLUMN IF NOT EXISTS root_cause  TEXT;  -- 5-Whys result (from Excel import)
ALTER TABLE ncr ADD COLUMN IF NOT EXISTS immediate   TEXT;  -- containment action (from Excel import)

-- Rollback (destructive — removes data in these columns):
-- ALTER TABLE ncr DROP COLUMN IF EXISTS cd;
-- ALTER TABLE ncr DROP COLUMN IF EXISTS sd;
-- ALTER TABLE ncr DROP COLUMN IF EXISTS loc;
-- ALTER TABLE ncr DROP COLUMN IF EXISTS root_cause;
-- ALTER TABLE ncr DROP COLUMN IF EXISTS immediate;
