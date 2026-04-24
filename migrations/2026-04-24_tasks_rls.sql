-- Migration: enable RLS on tasks — admin/manager only
-- Date: 2026-04-24
--
-- Context: stage D of schema hardening. Tasks are a management tool
-- (CAPA follow-up) and should not be created/read/updated by field
-- workers (emp-mode). Field workers report via near_miss / rounds /
-- equip_inspections / tr; a manager promotes those to tasks via the
-- Virtual Tasks UI or promote-to-task action.
--
-- Option A (chosen): emp-mode has NO access to the tasks table.
-- admin@tfugen.local OR app_users with role in ('אדמין','מנהל')
-- have full CRUD.
--
-- Decision log: DECISIONS.md — 2026-04-24 ברירת מחדל לתכנון RLS
-- עבור tasks.
--
-- PREREQUISITE: migrations/2026-04-21_tasks.sql MUST be run FIRST
-- so the tasks table exists. This migration then enables RLS on it.
--
-- How to run:
-- 1. Open Supabase dashboard → SQL Editor
-- 2. (If not done yet) Paste and Run 2026-04-21_tasks.sql
-- 3. Paste this file and Run
--
-- Safe to re-run: uses DROP POLICY IF EXISTS + CREATE POLICY.

-- Enable RLS (idempotent — already-enabled is a no-op)
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Drop any prior version of the policy so the migration is re-runnable
DROP POLICY IF EXISTS tasks_admin_manager_all ON tasks;

-- Full CRUD for admin or managerial users only
CREATE POLICY tasks_admin_manager_all ON tasks
  FOR ALL
  TO authenticated
  USING (
    auth.jwt() ->> 'email' = 'admin@tfugen.local'
    OR EXISTS (
      SELECT 1 FROM app_users u
       WHERE u.id = split_part(auth.jwt() ->> 'email', '@', 1)
         AND u.role IN ('אדמין','מנהל')
    )
  )
  WITH CHECK (
    auth.jwt() ->> 'email' = 'admin@tfugen.local'
    OR EXISTS (
      SELECT 1 FROM app_users u
       WHERE u.id = split_part(auth.jwt() ->> 'email', '@', 1)
         AND u.role IN ('אדמין','מנהל')
    )
  );

-- Verify:
-- SELECT polname, polcmd,
--        pg_get_expr(polqual, polrelid) AS using_expr
--   FROM pg_policy WHERE polrelid='tasks'::regclass;
-- Expected: 1 row — tasks_admin_manager_all, cmd=ALL.

-- Rollback (re-opens the table to any authenticated user):
-- DROP POLICY IF EXISTS tasks_admin_manager_all ON tasks;
-- ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;
