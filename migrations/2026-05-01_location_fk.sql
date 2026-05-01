-- Migration: add location_id FK to ncr + near_miss
-- Date: 2026-05-01
-- Adds structured location reference alongside legacy free-text fields
-- (ncr.loc, near_miss.area). New entries use the cascading dropdown;
-- legacy text values stay readable.
--
-- How to run:
--   1. Open Supabase dashboard → SQL Editor → + New query
--   2. Paste this entire file
--   3. Click Run

ALTER TABLE ncr
  ADD COLUMN IF NOT EXISTS location_id text REFERENCES locations(id) ON DELETE SET NULL;

ALTER TABLE near_miss
  ADD COLUMN IF NOT EXISTS location_id text REFERENCES locations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ncr_location_idx ON ncr(location_id) WHERE location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS near_miss_location_idx ON near_miss(location_id) WHERE location_id IS NOT NULL;

-- Rollback:
-- ALTER TABLE ncr DROP COLUMN IF EXISTS location_id;
-- ALTER TABLE near_miss DROP COLUMN IF EXISTS location_id;
