-- Accidents move into the app (DECISIONS 2026-09-28): the meeting data (slide
-- 2) is computed from inc instead of "טבלת תאונות 2026-.xlsx". The workbook
-- has columns inc did not: the department, its group, whether the accident
-- was reported (טופס 250 / ביטוח לאומי), and the running number in the file.
-- Additive, nullable, safe to re-run. inc had 0 rows when this ran.
--   dept        department as written in the file ("מחלקת " dropped)
--   dept_group  "קבוצת מחלקה" (ייצור ואריזה / חומר גלם / אחזקה וחשמל ...)
--   reported    true = מדווח, false = לא מדווח, null = unknown (2024 file)
--   src         where an imported row came from, e.g. "טבלת תאונות 2026-.xlsx #14"
ALTER TABLE public.inc ADD COLUMN IF NOT EXISTS dept text;
ALTER TABLE public.inc ADD COLUMN IF NOT EXISTS dept_group text;
ALTER TABLE public.inc ADD COLUMN IF NOT EXISTS reported boolean;
ALTER TABLE public.inc ADD COLUMN IF NOT EXISTS src text;
