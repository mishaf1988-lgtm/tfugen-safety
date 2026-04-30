-- Migration: add sens (sensitivity) flag to ncr
-- Date: 2026-04-30
-- Related: Vitre §16#16 — per-record sensitivity flag.
--
-- Use case: NCRs that involve HR investigations, legal cases, or other
-- material that only admin should see. Default false → no behavior change
-- on existing rows.
--
-- Note: gating is currently UI-level only (rNcr filter + showView guard).
-- True row-level RLS can be added later by tightening ncr_admin_manager_all
-- to also check for sens=false unless admin.
--
-- How to run:
--   1. Open Supabase dashboard → SQL Editor → + New query
--   2. Paste this entire file
--   3. Click Run

ALTER TABLE ncr ADD COLUMN IF NOT EXISTS sens boolean DEFAULT false;
CREATE INDEX IF NOT EXISTS ncr_sens_idx ON ncr(sens) WHERE sens = true;

-- Rollback:
-- ALTER TABLE ncr DROP COLUMN IF EXISTS sens;
