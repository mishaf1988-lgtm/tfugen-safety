-- 14/10/2026 (Michael: "before I open the annual training, a box where I note which kinds of training
-- were given: fire, environment, general, forklifts..."; in the questionnaire: "בצע: רשימה לסימון + אחר").
-- toolbox_talks.subjects: the kinds of training covered, one per line; form 08.01 "נושאי ההדרכה".
-- Backup first (CLAUDE.md, Supabase MCP 4). One nullable column, nothing deleted or rewritten.
create table if not exists backup_ops_20260918.toolbox_talks_20261014b as table public.toolbox_talks;
alter table public.toolbox_talks add column if not exists subjects text;
