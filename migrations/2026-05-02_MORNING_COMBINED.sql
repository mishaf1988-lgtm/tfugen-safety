-- =============================================================================
-- MORNING SESSION COMBINED MIGRATION — 2026-05-02
-- =============================================================================
-- Combines 3 NEW migrations from the morning autonomous session:
--   1. issue_types schema (REQUIRED for the Issue Types feature)
--   2. issue_types seed data (OPTIONAL — 30+ Israeli NCR categories)
--   3. inspection_types seed data (OPTIONAL — 15 Israeli safety inspections)
--
-- The schema for inspection_types itself was already part of
-- 2026-05-02_OVERNIGHT_COMBINED.sql (run earlier).
--
-- This file is IDEMPOTENT: safe to re-run, safe to run partial overlaps.
-- =============================================================================
-- HOW TO RUN
-- =============================================================================
-- 1. Open Supabase dashboard → SQL Editor → + New query
-- 2. Paste this entire file
-- 3. Click Run
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. issue_types — hierarchical NCR/incident category tree (Vitre §6.3)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS issue_types (
  id         text        PRIMARY KEY,
  name       text        NOT NULL,
  parent_id  text        REFERENCES issue_types(id) ON DELETE RESTRICT,
  level      smallint    NOT NULL CHECK (level BETWEEN 1 AND 3),
  category   text,
  notes      text,
  ts         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS issue_types_parent_idx ON issue_types(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS issue_types_level_idx  ON issue_types(level);

ALTER TABLE issue_types ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'issue_types_admin_manager_all'
  ) THEN
    CREATE POLICY issue_types_admin_manager_all ON issue_types
      FOR ALL
      TO authenticated
      USING (private.is_admin_manager())
      WITH CHECK (private.is_admin_manager());
  END IF;
END $$;

-- Add issue_type_id to NCR + incidents for classification
ALTER TABLE ncr ADD COLUMN IF NOT EXISTS issue_type_id text REFERENCES issue_types(id) ON DELETE SET NULL;
ALTER TABLE inc ADD COLUMN IF NOT EXISTS issue_type_id text REFERENCES issue_types(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS ncr_issue_type_idx ON ncr(issue_type_id) WHERE issue_type_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS inc_issue_type_idx ON inc(issue_type_id) WHERE issue_type_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 2. issue_types seed (OPTIONAL) — 30+ Israeli NCR/incident types in 3 levels
-- -----------------------------------------------------------------------------

-- Level 1: Categories
INSERT INTO issue_types (id, name, parent_id, level, category) VALUES
  ('IT-SAFETY',    'מפגעי בטיחות',          NULL, 1, 'בטיחות'),
  ('IT-ENV',       'אי-התאמות סביבתיות',     NULL, 1, 'איכות סביבה'),
  ('IT-HR',        'הון אנושי',              NULL, 1, 'כח אדם'),
  ('IT-PROC',      'תהליך/איכות',            NULL, 1, 'כללי'),
  ('IT-EQUIP',     'ציוד ותחזוקה',           NULL, 1, 'בטיחות')
ON CONFLICT (id) DO NOTHING;

-- Level 2: Subtypes under SAFETY
INSERT INTO issue_types (id, name, parent_id, level, category) VALUES
  ('IT-SAFETY-SLIP',  'החלקות, מעידות ונפילות',     'IT-SAFETY', 2, 'בטיחות'),
  ('IT-SAFETY-HAZ',   'חומרים מסוכנים',              'IT-SAFETY', 2, 'בטיחות'),
  ('IT-SAFETY-FIRE',  'אש וכיבוי',                   'IT-SAFETY', 2, 'בטיחות'),
  ('IT-SAFETY-ELEC',  'חשמל',                        'IT-SAFETY', 2, 'בטיחות'),
  ('IT-SAFETY-PPE',   'ציוד מגן אישי',               'IT-SAFETY', 2, 'בטיחות'),
  ('IT-SAFETY-HEIGHT','עבודה בגובה',                 'IT-SAFETY', 2, 'בטיחות'),
  ('IT-SAFETY-ERGO',  'ארגונומיה',                   'IT-SAFETY', 2, 'בטיחות'),
  ('IT-SAFETY-NOISE', 'רעש',                          'IT-SAFETY', 2, 'בטיחות')
ON CONFLICT (id) DO NOTHING;

-- Level 2: Subtypes under ENV
INSERT INTO issue_types (id, name, parent_id, level, category) VALUES
  ('IT-ENV-AIR',     'פליטות לאוויר',           'IT-ENV', 2, 'איכות סביבה'),
  ('IT-ENV-WATER',   'שפכים ומים',              'IT-ENV', 2, 'איכות סביבה'),
  ('IT-ENV-WASTE',   'פסולת',                   'IT-ENV', 2, 'איכות סביבה'),
  ('IT-ENV-SMELL',   'ריח',                     'IT-ENV', 2, 'איכות סביבה'),
  ('IT-ENV-NOISE',   'רעש סביבתי',              'IT-ENV', 2, 'איכות סביבה'),
  ('IT-ENV-ENERGY',  'צריכת אנרגיה',            'IT-ENV', 2, 'איכות סביבה')
ON CONFLICT (id) DO NOTHING;

-- Level 2: Subtypes under EQUIP
INSERT INTO issue_types (id, name, parent_id, level, category) VALUES
  ('IT-EQUIP-FORK',  'מלגזות',                  'IT-EQUIP', 2, 'בטיחות'),
  ('IT-EQUIP-CRANE', 'מנופים',                  'IT-EQUIP', 2, 'בטיחות'),
  ('IT-EQUIP-LADDER','סולמות',                  'IT-EQUIP', 2, 'בטיחות'),
  ('IT-EQUIP-PRESS', 'כלי לחץ',                 'IT-EQUIP', 2, 'בטיחות')
ON CONFLICT (id) DO NOTHING;

-- Level 3: Variants under SLIP
INSERT INTO issue_types (id, name, parent_id, level, category) VALUES
  ('IT-SLIP-OIL',    'שמן/מים על הרצפה',         'IT-SAFETY-SLIP', 3, 'בטיחות'),
  ('IT-SLIP-DRAIN',  'בור/תעלת ניקוז פתוחים',    'IT-SAFETY-SLIP', 3, 'בטיחות'),
  ('IT-SLIP-HOSE',   'צינור אוויר לא מגולגל',    'IT-SAFETY-SLIP', 3, 'בטיחות'),
  ('IT-SLIP-CABLE',  'כבלים פרושים על הרצפה',    'IT-SAFETY-SLIP', 3, 'בטיחות')
ON CONFLICT (id) DO NOTHING;

-- Level 3: Variants under HAZ
INSERT INTO issue_types (id, name, parent_id, level, category) VALUES
  ('IT-HAZ-LEAK',    'נזילה מצרבת/ברז/קוביה/גרקן', 'IT-SAFETY-HAZ', 3, 'בטיחות'),
  ('IT-HAZ-LABEL',   'אריזה/תיוג לקוי',            'IT-SAFETY-HAZ', 3, 'בטיחות'),
  ('IT-HAZ-MSDS',    'חוסר MSDS',                  'IT-SAFETY-HAZ', 3, 'בטיחות')
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 3. inspection_types seed (OPTIONAL) — 15 Israeli safety inspections
--    NOTE: requires the inspection_types schema to exist. It was created by
--    2026-05-02_OVERNIGHT_COMBINED.sql. If you didn't run that yet — RUN IT
--    FIRST, then run this file.
-- -----------------------------------------------------------------------------

INSERT INTO inspection_types (id, name, recur_count, recur_unit, responsible, notes, active) VALUES
  ('ITP-FIRE-EXT',    'בדיקת מטפי כיבוי אש',                 1,  'year',  'אחראי בטיחות',  'תקנות הבטיחות (כיבוי אש)', true),
  ('ITP-FIRE-CAB',    'בדיקת ארון כיבוי אש',                  1,  'year',  'אחראי בטיחות',  null,                              true),
  ('ITP-BOILER',      'ביקורת דוודי קיטור ושמן טרמי',         1,  'year',  'בודק מוסמך',     'פקודת הבטיחות',                  true),
  ('ITP-FORKLIFT',    'בדיקה שנתית מלגזות',                   1,  'year',  'בודק מוסמך',     'תקנות הבטיחות (ציוד מכני)',     true),
  ('ITP-CRANE',       'בדיקה שנתית מנופים',                   1,  'year',  'בודק מוסמך',     null,                              true),
  ('ITP-ELEC',        'בדיקה תקופתית מערכת חשמל',             1,  'year',  'חשמלאי בודק',    'תקנות חשמל',                       true),
  ('ITP-PRESSURE',    'בדיקת כלי לחץ',                        1,  'year',  'בודק מוסמך',     'תקנות הבטיחות (כלי לחץ)',       true),
  ('ITP-LADDER',      'בדיקת סולמות',                          6,  'month', 'אחראי בטיחות',  null,                              true),
  ('ITP-EYEWASH',     'בדיקת מקלחות חירום ושטיפת עיניים',      6,  'month', 'אחראי בטיחות',  null,                              true),
  ('ITP-FIRE-ALARM',  'בדיקת מערכת גילוי אש',                 6,  'month', 'אחראי בטיחות',  null,                              true),
  ('ITP-DRILL',       'תרגיל חירום - פינוי',                  1,  'year',  'אחראי בטיחות',  null,                              true),
  ('ITP-NOISE',       'מדידת רעש בעמדות עבודה',               1,  'year',  'מהנדס בטיחות',  null,                              true),
  ('ITP-AIR',         'דיגום איכות אוויר',                    1,  'year',  'מהנדס סביבה',   null,                              true),
  ('ITP-WATER',       'דיגום שפכים',                          3,  'month', 'מהנדס סביבה',   null,                              true),
  ('ITP-HEARING',     'בדיקות שמיעה לעובדי רעש',              1,  'year',  'אחראי בטיחות',  null,                              true)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- DONE.
-- After running, in the app:
--   - Issue Types page (📍 → Issue Types) will show the seeded tree
--   - NCR / Incident modals get a "🎯 סוג אי-התאמות" dropdown
--   - Inspection Types page will show 15 ready-to-use inspection schedules
-- =============================================================================
