-- 05/10/2026: הדרכה בקבוצה (פנים אל פנים) וחתימת המדריך. מיכאל: "מאשר".
-- toolbox_reads.mode: איך העובד הודרך. 'group' = פנים אל פנים (טלפון של המדריך שעובר מיד ליד),
--   'link' = מקוון (קישור אישי). ריק = חתימה מלפני השינוי. התקנות החדשות (16/10/2026)
--   מבדילות בין השניים: פנים אל פנים כברירת מחדל, מקוון באישור הממונה.
-- toolbox_talks.trainer_sig_url / trainer_signed_at: הצהרה חתומה של המדריך שהעביר את ההדרכה.
-- הוספה בלבד. גיבוי לפני: backup_20261005.toolbox_reads (שורה אחת, נמדד 05/10/2026);
--   toolbox_talks כבר גובתה באותו יום (2026-10-05_toolbox_trainer.sql).
create table if not exists backup_20261005.toolbox_reads as table public.toolbox_reads;
alter table public.toolbox_reads add column if not exists mode text;
alter table public.toolbox_talks add column if not exists trainer_sig_url text;
alter table public.toolbox_talks add column if not exists trainer_signed_at timestamptz;
UPDATE public.server_state SET value = (
  select coalesce(jsonb_agg(c order by c), '[]'::jsonb)::text
    from (select table_name || '.' || column_name as c from information_schema.columns where table_schema = 'public') x
), updated_at = now() WHERE key = 'db_columns_snapshot';
