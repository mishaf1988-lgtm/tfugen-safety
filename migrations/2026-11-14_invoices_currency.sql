-- ספר החשבוניות: עמודת מטבע (14/11/2026, מיכאל בשאלון: "בצע: עמודת מטבע (מומלץ)").
-- 9 חשבוניות מ-2026 במטבע זר (אירו, פאונד) לא נרשמו עם סכום, כי סכום בלי מטבע נקרא כשקלים.
-- הסכום נשמר כמו שכתוב בחשבונית, בלי המרה. ברירת מחדל ILS, כך שכל השורות הקיימות נשארות בשקלים.
-- גיבוי לפני השינוי: backup_ops_20260918.invoices_20261114 (132 שורות, נספר 14/11/2026).
alter table public.invoices add column if not exists currency text not null default 'ILS';
alter table public.invoices add constraint invoices_currency_chk check (currency in ('ILS', 'EUR', 'USD', 'GBP'));
