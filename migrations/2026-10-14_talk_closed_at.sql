-- 14/10/2026 (Michael in the questionnaire: "בצע: סגירה אמיתית (מומלץ)"). "Close signatures" on an annual or
-- quality training used to raise link_v only, so a new link came out and nothing said the training was over.
-- toolbox_talks.closed_at: when its signatures were closed (talk.js op close / reopen). Null = open.
-- Backup first (CLAUDE.md, Supabase MCP 4). One nullable column, nothing deleted or rewritten.
create table if not exists backup_ops_20260918.toolbox_talks_20261014d as table public.toolbox_talks;
alter table public.toolbox_talks add column if not exists closed_at timestamptz;
