-- 29/10/2026: מקור של מפגע בסיורי המפגעים (מיכאל בשאלון: "בצע: שתי עמודות חדשות").
-- פעולה מתקנת שנפתחת מתחקיר או מוועדה נרשמת כמפגע ב-tour_hazards, עם סימון מקור
-- ובדיקת כפילות לפי מזהה המקור ושם הפעולה. הוספה בלבד, nullable, בלי שינוי בשורות הקיימות.
-- גיבוי לפני: backup_thz_20261029.tour_hazards (58 = 58, הפרש 0, נמדד 29/10/2026).
-- src = 'committee' | 'investigation' (ריק = מסיור רגיל); src_ref = "<מזהה תחקיר או ישיבה>|<שם הפעולה>".
ALTER TABLE public.tour_hazards ADD COLUMN IF NOT EXISTS src text;
ALTER TABLE public.tour_hazards ADD COLUMN IF NOT EXISTS src_ref text;
-- rollback: ALTER TABLE public.tour_hazards DROP COLUMN IF EXISTS src_ref; ALTER TABLE public.tour_hazards DROP COLUMN IF EXISTS src;
