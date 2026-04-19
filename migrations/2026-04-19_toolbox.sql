-- Migration: add toolbox table for daily safety talks (ISO 45001)
-- Date: 2026-04-19
--
-- How to run:
-- 1. Open Supabase dashboard -> SQL Editor
-- 2. Paste this entire file
-- 3. Click Run
-- 4. Verify: table `toolbox` appears under Tables, and is part of `supabase_realtime` publication.

CREATE TABLE IF NOT EXISTS toolbox (
  id         text        PRIMARY KEY,
  d          date,
  topic      text        NOT NULL,
  presenter  text,
  attendees  text,
  s          text        DEFAULT 'נמסרה',
  notes      text,
  file_url   text,
  ts         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS toolbox_d_idx  ON toolbox(d);
CREATE INDEX IF NOT EXISTS toolbox_ts_idx ON toolbox(ts);

-- Match the access model of the other app tables (publishable/anon key).
ALTER TABLE toolbox DISABLE ROW LEVEL SECURITY;

-- Enable Realtime (postgres_changes) for immediate cross-device sync.
DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE toolbox';
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END $$;

-- Rollback (if needed):
-- DROP TABLE toolbox;
