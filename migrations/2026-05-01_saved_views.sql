-- Migration: saved_views — per-user filter presets
-- Date: 2026-05-01
-- Each user can save the current filter state of any list page (NCR, Near
-- Miss, Tasks, etc.) under a custom name. Re-applying the view restores
-- the same filters. RLS scoped to authenticated user's own rows.
--
-- Examples:
--   user_email='admin@tfugen.local'
--   page_slug='ncr'
--   name='ה-NCRs שלי באריזה'
--   filters={"category":"all","location_id":"LOC-004"}
--
-- How to run:
--   1. Open Supabase dashboard → SQL Editor → + New query
--   2. Paste this entire file
--   3. Click Run

CREATE TABLE IF NOT EXISTS saved_views (
  id          text        PRIMARY KEY,
  user_email  text        NOT NULL,
  page_slug   text        NOT NULL,
  name        text        NOT NULL,
  filters     jsonb       NOT NULL,
  ts          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS saved_views_user_page_idx ON saved_views(user_email, page_slug);

ALTER TABLE saved_views ENABLE ROW LEVEL SECURITY;

-- Each authenticated user only sees / writes their own views.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'saved_views_own'
  ) THEN
    CREATE POLICY saved_views_own ON saved_views
      FOR ALL
      TO authenticated
      USING (user_email = (auth.jwt() ->> 'email'))
      WITH CHECK (user_email = (auth.jwt() ->> 'email'));
  END IF;
END $$;

-- Rollback:
-- DROP TABLE IF EXISTS saved_views;
