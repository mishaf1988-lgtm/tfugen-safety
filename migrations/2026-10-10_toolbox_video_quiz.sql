-- 10/10/2026: סרטון ושאלות הבנה בהדרכה השבועית (מיכאל: "יש גם סרטונים"; הסדר שאושר ב-05/10/2026:
-- סרטון בדף, ואחריו שאלת הבנה לא חובה). נוהל 8 סעיף 5.5.4 (לומדות) ו-5.5.5 (אפקטיביות).
-- video_url: קישור YouTube, או קובץ ב-incidents-photos (הדף של העובד מקבל קישור חתום לשעה).
-- quiz: [{"q": "...", "a": ["...","...","...","..."], "c": 2}], עד 5 שאלות, c = אינדקס התשובה הנכונה.
-- quiz_ok / quiz_n: כמה נכונות בתשובה הראשונה, מתוך כמה שאלות. null = לא ענה.
-- הוספה בלבד, בלי שינוי בשורות קיימות. גיבוי לפני השינוי: backup_20261010.
create schema if not exists backup_20261010;
create table if not exists backup_20261010.toolbox_talks as select * from public.toolbox_talks;
create table if not exists backup_20261010.toolbox_reads as select * from public.toolbox_reads;
alter table public.toolbox_talks add column if not exists video_url text;
alter table public.toolbox_talks add column if not exists quiz jsonb;
alter table public.toolbox_reads add column if not exists quiz_ok smallint;
alter table public.toolbox_reads add column if not exists quiz_n smallint;
UPDATE public.server_state SET value = (
  select coalesce(jsonb_agg(c order by c), '[]'::jsonb)::text
    from (select table_name || '.' || column_name as c from information_schema.columns where table_schema = 'public') x
), updated_at = now() WHERE key = 'db_columns_snapshot';
