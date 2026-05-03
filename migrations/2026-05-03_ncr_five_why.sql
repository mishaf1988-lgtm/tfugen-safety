-- Migration: 5-Why root cause analysis on ncr
-- Date: 2026-05-03
-- ISO 45001 best practice — every NCR should drive a root-cause investigation,
-- and the 5-Why technique is the simplest structured approach. Storing the
-- analysis as a free-text field (one Why per line) keeps the schema simple
-- while still preserving the audit trail.

ALTER TABLE ncr ADD COLUMN IF NOT EXISTS five_why text;
NOTIFY pgrst, 'reload schema';
