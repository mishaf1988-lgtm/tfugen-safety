-- ראיה לפינוי ביומן הפסולת (13/10/2026, BACKLOG 12 פריט 7, ISO 14001 8.1).
-- מיכאל בשאלון: "בצע: 4 שדות (מומלץ)": מוביל, אתר קליטה, מספר תעודת משלוח, צירוף התעודה.
-- המוביל נכנס לעמודה הקיימת h (הייתה עם שתי תוויות שונות, "כלל פסולת" בטופס ו"הולכה" בצפייה, ו-0 שורות),
-- ולכן כאן שלוש עמודות בלבד. הוספה בלבד, nullable, בלי נגיעה בנתונים.
-- הטבלה נמדדה ריקה: select count(*) from wst = 0 (13/10/2026).
alter table public.wst add column if not exists site text;
alter table public.wst add column if not exists cert text;
alter table public.wst add column if not exists file_url text;

-- צילום העמודות המאושר (private.db_columns_check): מוסיפים רק את שלוש העמודות האלה,
-- כדי לא לאשר בשקט שינוי אחר שאולי קרה בינתיים.
update public.server_state set value = (
  select coalesce(jsonb_agg(e order by e), '[]'::jsonb)::text from (
    select jsonb_array_elements_text(value::jsonb) e from public.server_state where key = 'db_columns_snapshot'
    union select unnest(array['wst.site','wst.cert','wst.file_url'])
  ) x
), updated_at = now() where key = 'db_columns_snapshot';

-- rollback (צריך אישור, DROP COLUMN): alter table public.wst drop column site, drop column cert, drop column file_url;
