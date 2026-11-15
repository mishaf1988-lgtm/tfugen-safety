-- מרשם הקבלנים: תוקף ביטוח (15/11/2026, מיכאל בראיון של שלוש שאלות: "בצע: תוקף ביטוח קבלן",
-- "בצע: דגל אדום, אתה מחליט", "בצע: הסוכן מהמייל ומהתיקים"; DECISIONS 15/11/2026 "ביטוח קבלן").
-- ins = תאריך סוף הביטוח (YYYY-MM-DD, ריק = לא ידוע). ins_src = מאיפה נלקח: שורה לכל עדכון, עם הקובץ.
-- גיבוי לפני השינוי: backup_ops_20260918.ctr_20261115 (10 שורות, נספר 15/11/2026).
alter table public.ctr add column if not exists ins date;
alter table public.ctr add column if not exists ins_src text;
