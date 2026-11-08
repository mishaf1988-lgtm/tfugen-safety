-- משפטי סכנה (H) לחומרים מסוכנים (מיכאל, 08/11/2026, בשאלון: "בצע: סיווגי סכנה לחומרים מסוכנים",
-- "בצע: שדה חדש + סיכון מוצע", "בצע: הסולם + כמות גדולה"; DECISIONS 08/11/2026).
-- (1) גיבוי של hzm לפני שינוי הסכמה (32 שורות).
-- (2) עמודה h: משפטי הסכנה מגיליון הבטיחות, טקסט "H314, H290" (ריק = null). הערכים נכתבים רק אחרי אישור של מיכאל.
-- בטוח להרצה חוזרת. rollback: alter table public.hzm drop column if exists h;  (באישור מפורש בלבד)

create schema if not exists backup_ops_20261108;
create table if not exists backup_ops_20261108.hzm as table public.hzm;

alter table public.hzm add column if not exists h text;
