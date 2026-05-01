-- =====================================================================
-- OVERNIGHT COMBINED MIGRATION — 2026-05-02
-- =====================================================================
-- Run this ONCE to apply all schema changes from the overnight session.
-- Idempotent (uses IF NOT EXISTS / DO $$ guards) so re-running is safe.
--
-- Covers PRs:
--   #169 — location_id on inc + hearing_tests
--   #171 — custom_props table
--   #174 — projects table
--   #175 — project_id FK on ncr/tasks/inc
--
-- How to run:
--   1. Open Supabase dashboard → SQL Editor → + New query
--   2. Paste THIS WHOLE FILE
--   3. Click Run
-- =====================================================================


-- ----- #169 location_id on inc + hearing_tests -----
ALTER TABLE inc            ADD COLUMN IF NOT EXISTS location_id text REFERENCES locations(id) ON DELETE SET NULL;
ALTER TABLE hearing_tests  ADD COLUMN IF NOT EXISTS location_id text REFERENCES locations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS inc_location_idx           ON inc(location_id)           WHERE location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS hearing_tests_location_idx ON hearing_tests(location_id) WHERE location_id IS NOT NULL;


-- ----- #171 custom_props (generic key-value per record) -----
CREATE TABLE IF NOT EXISTS custom_props (
  id            text        PRIMARY KEY,
  entity_table  text        NOT NULL,
  entity_id     text        NOT NULL,
  k             text        NOT NULL,
  v             text,
  ts            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS custom_props_entity_idx ON custom_props(entity_table, entity_id);

ALTER TABLE custom_props ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'custom_props_admin_manager_all'
  ) THEN
    CREATE POLICY custom_props_admin_manager_all ON custom_props
      FOR ALL
      TO authenticated
      USING (private.is_admin_manager())
      WITH CHECK (private.is_admin_manager());
  END IF;
END $$;


-- ----- #174 projects table -----
CREATE TABLE IF NOT EXISTS projects (
  id           text        PRIMARY KEY,
  name         text        NOT NULL,
  description  text,
  start_date   date,
  end_date     date,
  status       text        DEFAULT 'פעיל',
  ts           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS projects_status_idx ON projects(status);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'projects_admin_manager_all'
  ) THEN
    CREATE POLICY projects_admin_manager_all ON projects
      FOR ALL
      TO authenticated
      USING (private.is_admin_manager())
      WITH CHECK (private.is_admin_manager());
  END IF;
END $$;


-- ----- #175 project_id FK on ncr / tasks / inc -----
ALTER TABLE ncr    ADD COLUMN IF NOT EXISTS project_id text REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE tasks  ADD COLUMN IF NOT EXISTS project_id text REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE inc    ADD COLUMN IF NOT EXISTS project_id text REFERENCES projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ncr_project_idx   ON ncr(project_id)   WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS tasks_project_idx ON tasks(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS inc_project_idx   ON inc(project_id)   WHERE project_id IS NOT NULL;


-- ----- notifications_log (audit trail for fired notifications) -----
CREATE TABLE IF NOT EXISTS notifications_log (
  id          text        PRIMARY KEY,
  user_email  text,
  event_type  text        NOT NULL,
  channel     text        NOT NULL,
  payload     jsonb,
  ts          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_log_user_idx  ON notifications_log(user_email);
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


-- ----- inspection_types (recurrence templates, Vitre §12.2) -----
CREATE TABLE IF NOT EXISTS inspection_types (
  id            text        PRIMARY KEY,
  name          text        NOT NULL,
  scope_table   text,
  recur_count   int         NOT NULL DEFAULT 1,
  recur_unit    text        NOT NULL DEFAULT 'year',
  next_due      date,
  responsible   text,
  notes         text,
  active        boolean     NOT NULL DEFAULT true,
  ts            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inspection_types_due_idx ON inspection_types(next_due) WHERE active=true;

ALTER TABLE inspection_types ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'inspection_types_admin_manager_all'
  ) THEN
    CREATE POLICY inspection_types_admin_manager_all ON inspection_types
      FOR ALL
      TO authenticated
      USING (private.is_admin_manager())
      WITH CHECK (private.is_admin_manager());
  END IF;
END $$;


-- =====================================================================
-- DONE. The UI works without these changes (sbIns queues writes), but
-- once these run, sync flows normally and structured data persists.
-- =====================================================================
