-- Migration: add CAPA verification fields to ncr
-- Date: 2026-05-01
-- Related: ISO 45001:10.2 / ISO 14001:10.2 — verify effectiveness of
-- corrective actions. After NCR is closed, the responsible person should
-- verify (typically 30+ days later) that the corrective action actually
-- prevented recurrence.
--
-- How to run:
--   1. Open Supabase dashboard → SQL Editor → + New query
--   2. Paste this entire file
--   3. Click Run

ALTER TABLE ncr
  ADD COLUMN IF NOT EXISTS verified_by         text,
  ADD COLUMN IF NOT EXISTS verified_at         timestamptz,
  ADD COLUMN IF NOT EXISTS verification_notes  text;

CREATE INDEX IF NOT EXISTS ncr_verified_at_idx ON ncr(verified_at) WHERE verified_at IS NOT NULL;

-- Rollback:
-- ALTER TABLE ncr
--   DROP COLUMN IF EXISTS verified_by,
--   DROP COLUMN IF EXISTS verified_at,
--   DROP COLUMN IF EXISTS verification_notes;
