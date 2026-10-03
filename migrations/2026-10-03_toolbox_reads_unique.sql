-- Weekly talk, stage 2 (03/10/2026): one signature per worker per talk.
-- /api/talk inserts with the service key; a second signature from the same
-- worker is refused by this index (409) and the page says "already signed".
-- Additive. Applied 03/10/2026 via execute_sql and verified in pg_indexes.
CREATE UNIQUE INDEX IF NOT EXISTS toolbox_reads_talk_emp_uq ON public.toolbox_reads(talk_id, emp_id);
-- Rollback: DROP INDEX public.toolbox_reads_talk_emp_uq;  (needs Michael's OK)
