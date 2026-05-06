-- Migration: rounds.theme + rounds.items — broader morning rounds
-- Date: 2026-05-06
-- The morning round used to be a fixed 6-item checklist (fire/corridors/
-- ppe/samples/chemicals/firstaid). The new system supports multiple
-- themes (fire-focused / chemicals / ergonomics / environment /
-- production / morning-default) plus user-defined custom themes, with
-- 4-state status (OK / warning / critical / N/A) per item plus
-- per-item notes and photo.
--
-- Backward compat: legacy boolean columns (fire/corridors/ppe/samples/
-- chemicals/firstaid) are kept. Old records without `items` still
-- render correctly. New records populate both for ~6 months until we
-- deprecate the legacy columns.
--
-- How to run:
--   1. Open Supabase dashboard → SQL Editor → + New query
--   2. Paste this entire file
--   3. Click Run

ALTER TABLE rounds ADD COLUMN IF NOT EXISTS theme text DEFAULT 'morning';
ALTER TABLE rounds ADD COLUMN IF NOT EXISTS items jsonb NOT NULL DEFAULT '[]'::jsonb;

NOTIFY pgrst, 'reload schema';

-- Verify (optional):
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name='rounds' AND column_name IN ('theme','items');
-- Expected: 2 rows.

-- Rollback:
-- ALTER TABLE rounds DROP COLUMN IF EXISTS items;
-- ALTER TABLE rounds DROP COLUMN IF EXISTS theme;
