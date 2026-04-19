-- Migration: add rounds table for Morning Round daily checklist (ISO 45001)
-- Date: 2026-04-19

-- How to run:
-- 1. Open Supabase dashboard → SQL Editor
-- 2. Paste this entire file
-- 3. Click Run
-- 4. Verify: table rounds appears under Tables

CREATE TABLE IF NOT EXISTS rounds (
  id         text        PRIMARY KEY,
  d          date        NOT NULL,       -- round date
  inspector  text,                       -- inspector name
  fire       boolean     DEFAULT false,  -- fire detectors OK
  corridors  boolean     DEFAULT false,  -- emergency corridors clear
  ppe        boolean     DEFAULT false,  -- PPE at workstations
  samples    boolean     DEFAULT false,  -- environmental samples taken
  chemicals  boolean     DEFAULT false,  -- hazardous materials secured
  firstaid   boolean     DEFAULT false,  -- first aid kits available
  notes      text,
  s          text        DEFAULT 'חלקי', -- status: הושלם / חלקי
  ts         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rounds_d_idx ON rounds(d);

ALTER TABLE rounds DISABLE ROW LEVEL SECURITY;

-- Rollback (if needed):
-- DROP TABLE rounds;
