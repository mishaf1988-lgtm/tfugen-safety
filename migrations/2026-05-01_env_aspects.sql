-- Migration: env_aspects — Environmental Aspects register (ISO 14001:6.1.2)
-- Date: 2026-05-01
-- ISO 14001 mandates a register of environmental aspects (elements of the
-- organization's activities/products/services that interact with the
-- environment) and their associated impacts. Each aspect needs significance
-- assessment + control measures.
--
-- Examples:
--   aspect="פליטות CO2 מדוד קיטור"  activity="ייצור קיטור לתהליך"
--   impact="תרומה להתחממות גלובלית"  significance="גבוהה"
--   controls="מסנני זיהום, תחזוקה רבעונית"  owner="מהנדס תחזוקה"
--
-- How to run:
--   1. Open Supabase dashboard → SQL Editor → + New query
--   2. Paste this entire file
--   3. Click Run

CREATE TABLE IF NOT EXISTS env_aspects (
  id            text        PRIMARY KEY,
  aspect        text        NOT NULL,        -- ההיבט (e.g. פליטות CO2)
  activity      text,                         -- הפעילות (e.g. ייצור קיטור)
  impact        text,                         -- ההשפעה הסביבתית
  significance  text,                         -- גבוהה / בינונית / נמוכה
  legal_ref     text,                         -- הפניה לחוק/תקנה
  controls      text,                         -- בקרות קיימות
  owner         text,                         -- אחראי
  review_date   date,                         -- תאריך סקירה הבא
  notes         text,
  ts            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS env_aspects_review_idx ON env_aspects(review_date) WHERE review_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS env_aspects_sig_idx ON env_aspects(significance) WHERE significance IS NOT NULL;

ALTER TABLE env_aspects ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'env_aspects_admin_manager_all'
  ) THEN
    CREATE POLICY env_aspects_admin_manager_all ON env_aspects
      FOR ALL
      TO authenticated
      USING (private.is_admin_manager())
      WITH CHECK (private.is_admin_manager());
  END IF;
END $$;

-- Rollback:
-- DROP TABLE IF EXISTS env_aspects;
