-- Migration: add toolbox table for daily safety talks (ISO 45001)
-- Date: 2026-04-24
--
-- Table holds short daily safety talks ("Toolbox Talks") given on the
-- shop floor. Each row records the date, topic, presenter, attendees,
-- status, free-text notes, and an optional attached file.
--
-- RLS: full CRUD restricted to admin@tfugen.local + managerial users
-- (role IN 'אדמין' / 'מנהל'), via the public.is_admin_manager() helper
-- introduced in Stage 1 of the RLS hardening (2026-04-24). No anon
-- access; reporters use the standard near_miss / rounds /
-- equip_inspections / tr emp_insert paths if any reporting is needed.
--
-- Realtime: table added to supabase_realtime publication so other
-- connected clients see changes immediately.
--
-- Safe to re-run: CREATE TABLE / CREATE INDEX use IF NOT EXISTS;
-- DROP/CREATE for the policy.

CREATE TABLE IF NOT EXISTS toolbox (
  id         text        PRIMARY KEY,
  d          date,
  topic      text        NOT NULL,
  presenter  text,
  attendees  text,
  s          text        DEFAULT 'נמסרה',
  notes      text,
  file_url   text,
  ts         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS toolbox_d_idx  ON toolbox(d);
CREATE INDEX IF NOT EXISTS toolbox_ts_idx ON toolbox(ts);

-- RLS: admin/manager only (matches the project-wide pattern set in
-- 2026-04-24_rls_stage2_admin_manager.sql).
ALTER TABLE toolbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS toolbox_admin_manager_all ON toolbox;
CREATE POLICY toolbox_admin_manager_all ON toolbox
  FOR ALL TO authenticated
  USING (public.is_admin_manager())
  WITH CHECK (public.is_admin_manager());

-- Realtime publication (skip silently if already in publication).
DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE toolbox';
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END $$;

-- Verify:
-- SELECT polname FROM pg_policy WHERE polrelid='toolbox'::regclass;
-- Expected: 1 row — toolbox_admin_manager_all.
--
-- SELECT relrowsecurity FROM pg_class WHERE relname='toolbox';
-- Expected: true.

-- Rollback:
-- DROP POLICY IF EXISTS toolbox_admin_manager_all ON toolbox;
-- ALTER TABLE toolbox DISABLE ROW LEVEL SECURITY;
-- ALTER PUBLICATION supabase_realtime DROP TABLE toolbox;
-- DROP TABLE toolbox;
