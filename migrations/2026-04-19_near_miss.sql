-- Migration: add near_miss table for Near-Miss capture (ISO 45001)
-- Date: 2026-04-19

-- How to run:
-- 1. Open Supabase dashboard → SQL Editor
-- 2. Paste this entire file
-- 3. Click Run
-- 4. Verify: table near_miss appears under Tables

CREATE TABLE IF NOT EXISTS near_miss (
  id      text        PRIMARY KEY,
  d       date,                        -- incident date
  t       text,                        -- time (HH:MM)
  descr   text        NOT NULL,        -- description
  area    text,                        -- area / location
  rep     text,                        -- reported by
  sev     text        DEFAULT 'קטין',  -- severity: קטין / בינוני / חמור
  typ     text,                        -- type: פיזי / כימי / חשמלי / שריפה / נפילה / אחר
  s       text        DEFAULT 'פתוח',  -- status: פתוח / בטיפול / סגור
  notes   text,
  ts      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS near_miss_d_idx ON near_miss(d);
CREATE INDEX IF NOT EXISTS near_miss_s_idx ON near_miss(s);

ALTER TABLE near_miss DISABLE ROW LEVEL SECURITY;

-- Rollback (if needed):
-- DROP TABLE near_miss;
