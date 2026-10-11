-- New-worker induction form, more details (11/10/2026, Michael: "להוסיף לטופס מספר עובד, מחלקה,
-- מספר טלפון של עובד, תפקיד, במידה עובד כוח אדם תיבה לרשום של החברה"). The department goes in the
-- existing dept column. Additive only: four nullable text columns, no data touched.
alter table public.toolbox_reads add column if not exists emp_no text;
alter table public.toolbox_reads add column if not exists phone text;
alter table public.toolbox_reads add column if not exists job text;
alter table public.toolbox_reads add column if not exists agency text;
