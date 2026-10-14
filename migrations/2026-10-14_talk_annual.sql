-- 14/10/2026 (Michael in the questionnaire: "בצע: לפי התוכנית"): the annual safety training and the
-- quality department training, as kinds of toolbox_talks ('annual', 'quality'; kind is free text).
-- Two nullable columns for form 08.01: dur = "משך ההדרכה", mail_cc = who else gets the filled form
-- (the quality department). Backup first (CLAUDE.md, Supabase MCP 4). Nothing deleted or rewritten.
create table if not exists backup_ops_20260918.toolbox_talks_20261014 as table public.toolbox_talks;
alter table public.toolbox_talks add column if not exists dur text;
alter table public.toolbox_talks add column if not exists mail_cc text;
