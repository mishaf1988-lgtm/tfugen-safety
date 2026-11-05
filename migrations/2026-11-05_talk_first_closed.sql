-- 05/11/2026: תאריך הסגירה הראשון של הדרכה שנתית או איכות נשמר גם אחרי פתיחה מחדש
-- (DECISIONS 05/11/2026 "הדרכה שנתית או איכות שנפתחה מחדש"; מיכאל בשאלון: "בצע: גיבוי ושדה חדש").
-- closed_at מתאפס בפתיחה מחדש (סגורה = closed_at), ולכן התאריך הראשון נשמר בעמודה נפרדת שנכתבת פעם אחת.
-- גיבוי לפני השינוי: backup_talks_20261105.toolbox_talks (8 שורות, 2 סגורות, נמדד 05/11/2026).
create schema if not exists backup_talks_20261105;
create table if not exists backup_talks_20261105.toolbox_talks as table public.toolbox_talks;
revoke all on schema backup_talks_20261105 from anon, authenticated;
revoke all on all tables in schema backup_talks_20261105 from anon, authenticated;
alter table public.toolbox_talks add column if not exists first_closed_at timestamptz;
update public.toolbox_talks set first_closed_at = closed_at where closed_at is not null and first_closed_at is null;
