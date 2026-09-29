-- 29/09/2026: the accident's root cause gets its own column.
-- Until now the investigation wrote the root cause into inc.r, which holds the
-- accident's notes (all 41 imported accidents have notes there), so saving an
-- investigation replaced the notes. Adds a column only; nothing is changed or removed.
alter table public.inc add column if not exists rc text;
comment on column public.inc.rc is 'Root cause from the accident investigation (5-Why summary). inc.r stays the notes.';
