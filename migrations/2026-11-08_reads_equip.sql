-- הצהרה על קבלת ציוד והחזרתו בקליטת עובד חדש (מיכאל, 08/11/2026, בשאלון: "בצע: משאבי אנוש ממלאים, העובד חותם",
-- "בצע: משאבי אנוש כותבים לכל עובד" (למי מחזירים), "בצע: לבנות ככה"; DECISIONS 08/11/2026).
-- (1) גיבוי של toolbox_reads לפני שינוי הסכמה.
-- (2) עמודה equip: {"items":[{"n":"<פריט>","q":<כמות>,"d":"<פירוט>"}],"ret":"<למי מחזירים>"}, ריק = null (לא נמסר ציוד).
-- בטוח להרצה חוזרת. rollback: alter table public.toolbox_reads drop column if exists equip;  (באישור מפורש בלבד)

create schema if not exists backup_ops_20261108;
create table if not exists backup_ops_20261108.toolbox_reads as table public.toolbox_reads;

alter table public.toolbox_reads add column if not exists equip jsonb;
