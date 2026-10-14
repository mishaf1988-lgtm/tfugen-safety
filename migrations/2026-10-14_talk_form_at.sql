-- 14/10/2026 (Michael: "בצע את שתי ההצעות לשדרוג", the second: an alert on the training screen when an
-- annual or quality training is open more than a week and form 08.01 was not produced).
-- toolbox_talks.form_at: when form 08.01 was last filed (talk.js op form0801). Null = not filed yet.
-- Backup first (CLAUDE.md, Supabase MCP 4). One nullable column, nothing deleted or rewritten.
create table if not exists backup_ops_20260918.toolbox_talks_20261014c as table public.toolbox_talks;
alter table public.toolbox_talks add column if not exists form_at timestamptz;
