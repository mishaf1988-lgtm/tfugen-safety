-- Seed: common Israeli NCR/incident issue types
-- Date: 2026-05-02
-- Optional. Run AFTER 2026-05-02_issue_types.sql.
-- Idempotent (ON CONFLICT DO NOTHING).
--
-- 3-level hierarchy: קטגוריה → תת-סוג → וריאנט.

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
