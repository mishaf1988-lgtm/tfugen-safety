-- 24/11/2026 (Michael: a link in the induction mail to correct details, equipment and documents; DECISIONS 24/11/2026).
-- Every correction made through the link is kept on the row: when, who (hr), each field before and after, equipment before
-- and after, and how many photos were added. Additive: the signed copy and the other columns are untouched.
alter table toolbox_reads add column if not exists edits jsonb;
