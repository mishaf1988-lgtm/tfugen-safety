-- Migration: add equip_inspections table for equipment due-for-inspection per work ordinance
-- Date: 2026-04-18
-- Related: routine/equip-inspections-2026-04-18

-- How to run:
-- 1. Open Supabase dashboard → SQL Editor
-- 2. Paste this entire file
-- 3. Click Run
-- 4. Verify: table equip_inspections appears under Tables

CREATE TABLE IF NOT EXISTS equip_inspections (
  id      text        PRIMARY KEY,
  code    text,                  -- equipment code (e.g. B213138-010)
  n       text        NOT NULL,  -- description (e.g. 2 יח' מהפך דולבים)
  vendor  text,                  -- supplier/manufacturer (WIFO, RWM, Slos)
  loc     text,                  -- location / area
  d       date,                  -- last inspection date
  e       date,                  -- next due date (matches project convention)
  s       text        DEFAULT '\u05ea\u05e7\u05d9\u05df',  -- status: תקין / לא תקין / חייב בדיקה
  notes   text,
  ts      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS equip_inspections_e_idx    ON equip_inspections(e);
CREATE INDEX IF NOT EXISTS equip_inspections_code_idx ON equip_inspections(code);

-- Match the access model of other tables (publishable key / anon role).
ALTER TABLE equip_inspections DISABLE ROW LEVEL SECURITY;

-- Rollback (if needed):
-- DROP TABLE equip_inspections;
