-- 16/10/2026 (BACKLOG 14.2, Michael in the questionnaire: "בצע: עמודת גרסה (מומלץ)").
-- ptw.ts is the permit's START TIME ("08:00", text), not a version, so the edit guard
-- (?ts=eq.<version seen>) never moved and never caught a parallel edit. `ver` is the
-- version column for ptw only (_verCol in index.html); the server moves it on every write.
-- No backup: public.ptw had 0 rows when this ran (16/10/2026).
ALTER TABLE public.ptw ADD COLUMN IF NOT EXISTS ver timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION private.ptw_ver()
RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN
  NEW.ver := clock_timestamp();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.ptw_ver() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS ptw_ver ON public.ptw;
CREATE TRIGGER ptw_ver BEFORE INSERT OR UPDATE ON public.ptw
  FOR EACH ROW EXECUTE FUNCTION private.ptw_ver();

-- The approved column snapshot (private.db_columns_check): add only this column.
update public.server_state set value = (
  select coalesce(jsonb_agg(e order by e), '[]'::jsonb)::text from (
    select jsonb_array_elements_text(value::jsonb) e from public.server_state where key = 'db_columns_snapshot'
    union select 'ptw.ver'
  ) x
), updated_at = now() where key = 'db_columns_snapshot';

-- Ran 16/10/2026 through the connector, one statement per call (the whole file in one
-- apply_migration timed out, tfugen-db 7a/8). Verified: column, trigger, and as role
-- authenticated the revoked function still stamps ver; a client-sent ver is overwritten.
-- rollback (needs approval, DROP): drop trigger ptw_ver on public.ptw; alter table public.ptw drop column ver;
