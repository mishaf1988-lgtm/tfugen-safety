-- Migration: page_files — single "official document" attached to a whole page
-- Date: 2026-05-01
-- Use case: a page (e.g. "Environmental Aspects Register") has one canonical
-- Excel/PDF file representing the entire register, separate from any
-- per-record attachments. Generic — reusable for any page (rsk, ncr, etc).
--
-- Examples:
--   page='env_aspects'  file_url='.../tofes_28-01.xlsx'
--   page='rsk'          file_url='.../survey_2026.pdf'
--
-- How to run:
--   1. Open Supabase dashboard → SQL Editor → + New query
--   2. Paste this entire file
--   3. Click Run

-- `id` holds the page slug (e.g. 'env_aspects'). One row per page.
CREATE TABLE IF NOT EXISTS page_files (
  id           text        PRIMARY KEY,
  file_url     text        NOT NULL,
  file_name    text,
  uploaded_by  text,
  ts           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE page_files ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'page_files_admin_manager_all'
  ) THEN
    CREATE POLICY page_files_admin_manager_all ON page_files
      FOR ALL
      TO authenticated
      USING (private.is_admin_manager())
      WITH CHECK (private.is_admin_manager());
  END IF;
END $$;

-- Rollback:
-- DROP TABLE IF EXISTS page_files;
