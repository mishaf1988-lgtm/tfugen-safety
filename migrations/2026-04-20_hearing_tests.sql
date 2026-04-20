-- Migration: add hearing_tests table for employee hearing exams (ISO 45001, noise exposure)
-- Date: 2026-04-20

-- How to run:
-- 1. Open Supabase dashboard → SQL Editor
-- 2. Paste this entire file
-- 3. Click Run
-- 4. Verify: table hearing_tests appears under Tables
-- 5. Also add to Realtime publication if you want cross-device sync (see realtime migration)

CREATE TABLE IF NOT EXISTS hearing_tests (
  id         text        PRIMARY KEY,
  emp_name   text,                        -- employee full name
  emp_id     text,                        -- national ID
  dob        date,                        -- date of birth
  age        int,                         -- age
  gender     text,                        -- M / F
  role       text,                        -- job title
  dept       text,                        -- department / health fund
  category   text,                        -- category: חומר גלם / ייצור / מכני / אריזה / כללי ...
  year       text,                        -- year string (prior exam or relevant year)
  notes      text,                        -- recommendations / notes
  test_date  date,                        -- hearing exam date
  inspector  text,                        -- inspector / audiologist name
  ts         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hearing_tests_emp_idx      ON hearing_tests(emp_id);
CREATE INDEX IF NOT EXISTS hearing_tests_test_date_idx ON hearing_tests(test_date);

ALTER TABLE hearing_tests DISABLE ROW LEVEL SECURITY;

-- Rollback (if needed):
-- DROP TABLE hearing_tests;
