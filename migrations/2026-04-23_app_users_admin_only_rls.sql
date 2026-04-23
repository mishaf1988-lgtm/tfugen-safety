-- Migration: tighten app_users RLS to admin-email-only writes
-- Date: 2026-04-23
--
-- Context: the original policy `app_users_admin_write` used the
-- condition `is_anonymous = false` which actually allows ANY
-- authenticated (non-anonymous) user to INSERT/UPDATE/DELETE in the
-- app_users table. That means a regular logged-in user could modify
-- other users' profiles via a direct REST call — a real privilege
-- escalation hole.
--
-- This migration replaces the policy with an email-based check so
-- that only admin@tfugen.local can write. Reads stay open to all
-- authenticated users (needed for the reporter dropdown).
--
-- SELECT policy `app_users_read` is unchanged.

-- Drop the too-permissive policy
DROP POLICY IF EXISTS app_users_admin_write ON app_users;

-- Tighter replacement: only the admin email can write
CREATE POLICY app_users_admin_write ON app_users
  FOR ALL
  TO authenticated
  USING  (auth.jwt() ->> 'email' = 'admin@tfugen.local')
  WITH CHECK (auth.jwt() ->> 'email' = 'admin@tfugen.local');

-- Verify:
-- SELECT polname, polcmd, pg_get_expr(polqual, polrelid) AS using_expr
--   FROM pg_policy WHERE polrelid = 'app_users'::regclass;
