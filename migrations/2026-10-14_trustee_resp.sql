-- 14/10/2026 (Michael in the questionnaire: "בצע: עמודה + שינוי לכל ליקוי"):
-- a trustee finding's responsible department, set by the manager before the
-- department report. Empty = computed as before (hazard-file.js trusteeResp).
-- Backup first (CLAUDE.md, Supabase MCP 4), then one nullable column. Nothing is
-- deleted or rewritten; the existing admin/manager UPDATE policy covers it.
create table if not exists backup_ops_20260918.trustee_reports_20261014 as table public.trustee_reports;
alter table public.trustee_reports add column if not exists resp text;
