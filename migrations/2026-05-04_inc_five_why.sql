-- Migration: 5-Why root cause analysis on incidents
-- Date: 2026-05-04
-- ISO 45001 §10.2 — every workplace incident requires a root-cause investigation,
-- and the 5-Why technique is the simplest structured approach. Mirrors
-- migrations/2026-05-03_ncr_five_why.sql which added the same field to ncr.
-- Storing the analysis as a free-text field (one Why per line) keeps the
-- schema simple while still preserving the audit trail.

ALTER TABLE inc ADD COLUMN IF NOT EXISTS five_why text;
NOTIFY pgrst, 'reload schema';

-- Verify:
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name='inc' AND column_name='five_why';
-- Expected: 1 row.

-- Rollback:
-- ALTER TABLE inc DROP COLUMN IF EXISTS five_why;
