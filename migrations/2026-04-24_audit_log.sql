-- Migration: add audit_log table — record who did what, when
-- Date: 2026-04-24
--
-- Each row records a single mutation performed via the app's REST
-- writes (sbIns / sbUpd / sbDel). The client appends an entry on
-- best-effort basis (failures do not block the original write).
--
-- Fields:
--   id           — bigserial PK
--   ts           — when (auto, server-side default)
--   user_email   — who (auth.jwt() ->> 'email' captured client-side)
--   table_name   — which table was changed
--   record_id    — id of the changed row
--   op           — 'ins' | 'upd' | 'del'
--   title        — short human-readable label of the row (first 80
--                  chars of title/topic/description). Optional.
--
-- RLS: admin/manager only. Reporters (role='מדווח') can write
-- (INSERT only) so audit entries from their own actions land in the
-- table, but they cannot SELECT/UPDATE/DELETE the audit log itself.
--
-- Realtime: included in supabase_realtime publication so admin's
-- audit page refreshes live.
--
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS audit_log (
  id          bigserial   PRIMARY KEY,
  ts          timestamptz NOT NULL DEFAULT now(),
  user_email  text,
  table_name  text        NOT NULL,
  record_id   text,
  op          text        NOT NULL CHECK (op IN ('ins','upd','del')),
  title       text
);

CREATE INDEX IF NOT EXISTS audit_log_ts_idx           ON audit_log(ts DESC);
CREATE INDEX IF NOT EXISTS audit_log_table_record_idx ON audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS audit_log_user_idx         ON audit_log(user_email);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Admin/manager: full read/manage.
DROP POLICY IF EXISTS audit_log_admin_manager_all ON audit_log;
CREATE POLICY audit_log_admin_manager_all ON audit_log
  FOR ALL TO authenticated
  USING (public.is_admin_manager())
  WITH CHECK (public.is_admin_manager());

-- Anyone authenticated (incl. role='מדווח') may INSERT their own
-- audit row. Without this, audit entries from reporter accounts
-- would be rejected silently. They still can't read/edit/delete.
DROP POLICY IF EXISTS audit_log_authenticated_insert ON audit_log;
CREATE POLICY audit_log_authenticated_insert ON audit_log
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Realtime
DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE audit_log';
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END $$;

-- Verify:
-- SELECT polname, polcmd FROM pg_policy WHERE polrelid='audit_log'::regclass ORDER BY polname;
-- Expected: 2 rows — _admin_manager_all (ALL) + _authenticated_insert (INSERT).
--
-- SELECT relrowsecurity FROM pg_class WHERE relname='audit_log';
-- Expected: true.

-- Rollback:
-- DROP POLICY IF EXISTS audit_log_admin_manager_all ON audit_log;
-- DROP POLICY IF EXISTS audit_log_authenticated_insert ON audit_log;
-- ALTER PUBLICATION supabase_realtime DROP TABLE audit_log;
-- DROP TABLE audit_log;
