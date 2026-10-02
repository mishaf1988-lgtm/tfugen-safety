-- BACKLOG 13 (מיכאל, 02/10/2026): בדיקה חוזרת למפגע סיור בחומרה גבוהה, 30 יום אחרי הסגירה.
-- recheck_d = התאריך שבו נבדק שהתיקון החזיק. ריק, או מוקדם מ-closed_d, = הבדיקה עוד פתוחה
-- (מפגע שנפתח מחדש ונסגר שוב צריך בדיקה חדשה). הוספה בלבד; קודם גיבוי, כי בטבלה יש נתונים.
CREATE SCHEMA IF NOT EXISTS backup_20261002;
CREATE TABLE IF NOT EXISTS backup_20261002.tour_hazards AS TABLE public.tour_hazards;
ALTER TABLE public.tour_hazards ADD COLUMN IF NOT EXISTS recheck_d date;
-- rollback: ALTER TABLE public.tour_hazards DROP COLUMN IF EXISTS recheck_d;
