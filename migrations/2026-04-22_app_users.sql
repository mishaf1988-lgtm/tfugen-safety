-- Migration: app_users table for app-level user management
-- Date: 2026-04-22
--
-- Purpose: app-layer user registry. Every Supabase Auth account
-- (userN@tfugen.local) has a matching row here that stores the
-- display name, role, department, contact info, and active flag.
--
-- The app resolves a user's profile after login by matching on
-- `username` (the part before @tfugen.local).

CREATE TABLE IF NOT EXISTS app_users (
  id         text PRIMARY KEY,                    -- same as username (e.g. 'user1')
  username   text UNIQUE NOT NULL,                -- login handle (user1, user2, ...)
  full_name  text,                                -- display name after assignment
  email      text,                                -- contact email (NOT the auth email)
  phone      text,                                -- contact phone
  role       text DEFAULT 'מדווח',                -- אדמין / מנהל / מדווח
  dept       text,                                -- department
  active     boolean DEFAULT false,               -- false until admin fills in the name
  notes      text,
  ts         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_users_username_idx ON app_users(username);
CREATE INDEX IF NOT EXISTS app_users_active_idx ON app_users(active);

-- Seed 10 placeholder slots. Admin fills in real names/roles later
-- via the app's "משתמשים" page. Passwords for these accounts are set
-- manually in Supabase Dashboard → Authentication → Users:
--   user1@tfugen.local  Aa000001!
--   user2@tfugen.local  Aa000002!
--   ...
--   user10@tfugen.local Aa000010!
INSERT INTO app_users (id, username, active) VALUES
  ('user1',  'user1',  false),
  ('user2',  'user2',  false),
  ('user3',  'user3',  false),
  ('user4',  'user4',  false),
  ('user5',  'user5',  false),
  ('user6',  'user6',  false),
  ('user7',  'user7',  false),
  ('user8',  'user8',  false),
  ('user9',  'user9',  false),
  ('user10', 'user10', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: authenticated users can read the list (to populate "reporter"
-- dropdowns in forms). Only the admin JWT (non-anonymous) can write.
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_users_read ON app_users
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY app_users_admin_write ON app_users
  FOR ALL
  TO authenticated
  USING  (COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false)
  WITH CHECK (COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false);

-- Rollback:
-- DROP TABLE IF EXISTS app_users;
