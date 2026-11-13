-- ספר חשבוניות (13/11/2026, מיכאל בשאלון: "בצע: ספר חשבוניות", ואחרי ראיון של שלוש שאלות: "בצע: לבנות לפי התכנית").
-- שורה לכל חשבונית שעברה דרך המייל של מיכאל: ספק, מספר, סכום, מתי התקבלה, מתי הועברה להנהלת חשבונות, ואם יש תסקיר.
-- שורה אחת לכל ספק ומספר חשבונית (supplier_key, num), כדי שהמקור וההעברה לא ייספרו פעמיים.
-- פרטי כספים: הטבלה סגורה לאפליקציה ולכל משתמש. RLS פעיל בלי אף policy, ואין הרשאות ל-anon ול-authenticated.
-- רק השרת (מפתח השירות) קורא וכותב, דרך routine-db (invoice_set, invoice_find).
-- הטבלה חדשה וריקה: אין גיבוי קודם.
create table if not exists public.invoices (
  id text primary key,
  supplier text not null,
  supplier_key text not null,
  num text not null,
  amount numeric(12,2),
  inv_date date,
  received_at timestamptz,
  forwarded_at timestamptz,
  approved_at timestamptz,
  has_report boolean,
  report_ref text,
  chk boolean not null default false,
  note text,
  src text,
  ts timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoices_supplier_num_key unique (supplier_key, num),
  constraint invoices_amount_check check (amount is null or (amount >= 0 and amount <= 100000000))
);
alter table public.invoices enable row level security;
revoke all on public.invoices from anon, authenticated;
