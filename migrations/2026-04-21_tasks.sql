-- Migration: add tasks table for Phase C (task tracking + CAPA follow-up)
-- Date: 2026-04-21

-- How to run:
-- 1. Open Supabase dashboard → SQL Editor
-- 2. Paste this entire file
-- 3. Click Run
-- 4. Verify: table `tasks` appears under Tables

CREATE TABLE IF NOT EXISTS tasks (
  id            text        PRIMARY KEY,
  title         text        NOT NULL,
  assignee      text,                                  -- free-text name (multi-user is Phase E)
  due           date,                                  -- due date; null = no deadline
  status        text        DEFAULT 'פתוח',           -- פתוח / בהתקדמות / הושלם / בוטל
  priority      text        DEFAULT 'רגיל',           -- קריטי / גבוה / רגיל / נמוך
  source_table  text,                                  -- ncr | inc | rsk | exp | null
  source_id     text,                                  -- id in source_table
  notes         text,
  ts            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tasks_due_idx ON tasks(due);
CREATE INDEX IF NOT EXISTS tasks_status_idx ON tasks(status);
CREATE INDEX IF NOT EXISTS tasks_source_idx ON tasks(source_table, source_id);

ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;

-- Rollback:
-- DROP TABLE tasks;
