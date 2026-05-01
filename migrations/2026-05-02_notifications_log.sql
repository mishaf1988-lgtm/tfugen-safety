-- Migration: notifications_log — audit trail of fired notifications
-- Date: 2026-05-02
-- Lets the user audit which notifications were dispatched, when, and via
-- which channel(s).
--
-- How to run:
--   1. Open Supabase dashboard → SQL Editor → + New query
--   2. Paste this entire file
--   3. Click Run

CREATE TABLE IF NOT EXISTS notifications_log (
  id          text        PRIMARY KEY,
  user_email  text,
  event_type  text        NOT NULL,
  channel     text        NOT NULL,
  payload     jsonb,
  ts          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_log_user_idx ON notifications_log(user_email);
CREATE INDEX IF NOT EXISTS notifications_log_event_idx ON notifications_log(event_type);

ALTER TABLE notifications_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'notifications_log_admin_manager_all'
  ) THEN
    CREATE POLICY notifications_log_admin_manager_all ON notifications_log
      FOR ALL
      TO authenticated
      USING (private.is_admin_manager())
      WITH CHECK (private.is_admin_manager());
  END IF;
END $$;

-- Rollback:
-- DROP TABLE IF EXISTS notifications_log;
