-- Closing date of a trustee finding closed by the manager (28/09).
-- Until now a finding's closing date came only from the task-8 report that
-- closed it. The folder-13 file is now two-way (Michael: "if I close in the
-- file, the app has to update"): a finding closed in Excel, or by the manager
-- in the app, has no task-8 report, and its date would be lost on the next
-- rewrite. Additive, nullable, safe to re-run. No policy change: the column
-- follows the table's existing policies (anon inserts reports, admin/manager update).
ALTER TABLE public.trustee_reports ADD COLUMN IF NOT EXISTS closed_d date;
