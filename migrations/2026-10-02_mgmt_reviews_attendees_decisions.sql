-- BACKLOG 9.25 (02/10/2026): סקירת הנהלה נשמרת עם נוכחים והחלטות.
-- attendees: מי השתתף (טקסט חופשי). decisions: ההחלטות כפי שנקבעו ביום הסקירה,
-- כטקסט. כל החלטה נפתחת גם כמשימה ב-tasks (source_table = 'mgmt_reviews'),
-- ושם נעקב הסטטוס. הוספה בלבד; בטוח להרצה חוזרת.
ALTER TABLE public.mgmt_reviews ADD COLUMN IF NOT EXISTS attendees text;
ALTER TABLE public.mgmt_reviews ADD COLUMN IF NOT EXISTS decisions text;
