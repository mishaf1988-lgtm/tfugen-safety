-- Seed: common Israeli industrial safety inspection types
-- Date: 2026-05-02
-- Optional — populates inspection_types with common Israeli requirements
-- (פקודת הבטיחות, תקנות הבטיחות בעבודה).
-- Run AFTER 2026-05-02_inspection_types.sql.
-- Idempotent (ON CONFLICT DO NOTHING).

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
