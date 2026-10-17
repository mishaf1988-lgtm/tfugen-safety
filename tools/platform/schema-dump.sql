-- Writes the structure of a live database as one SQL file that builds an empty one (17/10/2026,
-- "product for sale" step 2: the database with no rows). Read-only: it only reads the catalog.
-- Run it on the live project (Supabase MCP execute_sql), save the text of the one column it
-- returns as tools/platform/schema-live.sql under a first line "-- dumped YYYY-MM-DD", and run node tools/export-platform.mjs: the export
-- swaps this factory's values for the template's and scans the result like every other file.
--
-- What it covers: schema private, extensions, sequences, tables (public and private), keys and
-- checks, foreign keys, indexes, functions, triggers (with the one on auth.users), RLS and every
-- policy (storage too), table, function and schema grants, the two buckets, the realtime list
-- and the cron jobs. Not covered, on purpose: rows of any table, Vault secret values, the
-- leftover helpers (tmp_*), pgrst_watch (Supabase's own) and the backup_* schemas.
with
fn as (
  select p.oid, n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) args, p.proacl
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'private')
    and p.proname not like 'tmp\_%' and p.proname <> 'pgrst_watch'
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
),
tb as (
  select c.oid, n.nspname, c.relname, c.relacl, c.relrowsecurity
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'private') and c.relkind in ('r', 'p')
),
stmt as (
  select 10 sec, '' k, 'create schema if not exists private' s
  union all select 11, '', 'create extension if not exists "uuid-ossp" with schema extensions'
  union all select 11, '', 'create extension if not exists pgcrypto with schema extensions'
  union all select 11, '', 'create extension if not exists pg_net'
  union all select 11, '', 'create extension if not exists pg_cron'
  union all
  select 20, n.nspname || '.' || c.relname, format('create sequence if not exists %I.%I', n.nspname, c.relname)
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where c.relkind = 'S' and n.nspname in ('public', 'private')
  union all
  select 30, tb.nspname || '.' || tb.relname,
    format('create table if not exists %I.%I (%s)', tb.nspname, tb.relname,
      (select string_agg(format('%I %s', a.attname, format_type(a.atttypid, a.atttypmod))
         || coalesce(' default ' || pg_get_expr(d.adbin, d.adrelid), '')
         || case when a.attnotnull then ' not null' else '' end, ', ' order by a.attnum)
       from pg_attribute a left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
       where a.attrelid = tb.oid and a.attnum > 0 and not a.attisdropped))
  from tb
  union all
  select case when co.contype = 'f' then 41 else 40 end, tb.nspname || '.' || tb.relname || '.' || co.conname,
    format('alter table %I.%I add constraint %I %s', tb.nspname, tb.relname, co.conname, pg_get_constraintdef(co.oid))
  from pg_constraint co join tb on tb.oid = co.conrelid
  union all
  select 50, i.schemaname || '.' || i.indexname, i.indexdef 
  from pg_indexes i
  where i.schemaname in ('public', 'private')
    and not exists (select 1 from pg_constraint co where co.conindid = (quote_ident(i.schemaname) || '.' || quote_ident(i.indexname))::regclass)
  union all
  select 60, fn.nspname || '.' || fn.proname, pg_get_functiondef(fn.oid)  from fn
  union all
  select 70, n.nspname || '.' || c.relname || '.' || t.tgname, pg_get_triggerdef(t.oid) 
  from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
  where not t.tgisinternal
    and (n.nspname in ('public', 'private') or t.tgfoid in (select oid from fn))
  union all
  select 80, tb.nspname || '.' || tb.relname, format('alter table %I.%I enable row level security', tb.nspname, tb.relname)
  from tb where tb.relrowsecurity
  union all
  select 90, p.schemaname || '.' || p.tablename || '.' || p.policyname,
    format('create policy %I on %I.%I as %s for %s to %s%s%s', p.policyname, p.schemaname, p.tablename,
      p.permissive, p.cmd, array_to_string(p.roles, ', '),
      coalesce(' using (' || p.qual || ')', ''), coalesce(' with check (' || p.with_check || ')', ''))
  from pg_policies p where p.schemaname in ('public', 'private', 'storage')
  union all
  -- Grants written out in full, so the result does not depend on the defaults of a new project.
  select 100, tb.nspname || '.' || tb.relname,
    format('revoke all on table %I.%I from anon, authenticated', tb.nspname, tb.relname)
  from tb
  union all
  select 100, tb.nspname || '.' || tb.relname || '+' || a.grantee::regrole::text,
    format('grant %s on table %I.%I to %I', string_agg(a.privilege_type, ', ' order by a.privilege_type), tb.nspname, tb.relname, a.grantee::regrole::text)
  from tb, aclexplode(tb.relacl) a
  where a.grantee in ('anon'::regrole, 'authenticated'::regrole)
  group by tb.nspname, tb.relname, a.grantee
  union all
  select 101, fn.nspname || '.' || fn.proname,
    format('revoke all on function %I.%I(%s) from public, anon, authenticated', fn.nspname, fn.proname, fn.args)
  from fn where fn.proacl is not null
  union all
  select 101, fn.nspname || '.' || fn.proname || '+' || a.grantee::text,
    format('grant execute on function %I.%I(%s) to %s', fn.nspname, fn.proname, fn.args,
      case when a.grantee = 0 then 'public' else quote_ident(a.grantee::regrole::text) end)
  from fn, aclexplode(fn.proacl) a
  where fn.proacl is not null and (a.grantee = 0 or a.grantee in ('anon'::regrole, 'authenticated'::regrole, 'supabase_auth_admin'::regrole))
  union all
  select 102, n.nspname, format('grant usage on schema %I to %s', n.nspname,
    string_agg(quote_ident(a.grantee::regrole::text), ', ' order by a.grantee::regrole::text))
  from pg_namespace n, aclexplode(n.nspacl) a
  where n.nspname = 'private' and a.privilege_type = 'USAGE' and a.grantee <> n.nspowner
  group by n.nspname
  union all
  select 110, b.id, format('insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values (%L, %L, %s, %s, %L) on conflict (id) do nothing',
    b.id, b.name, b.public::text, coalesce(b.file_size_limit::text, 'null'), b.allowed_mime_types)
  from storage.buckets b
  union all
  select 120, '', 'alter publication supabase_realtime add table '
    || string_agg(format('%I.%I', t.schemaname, t.tablename), ', ' order by t.tablename) 
  from pg_publication_tables t where t.pubname = 'supabase_realtime'
  union all
  select 130, j.jobname, format('select cron.schedule(%L, %L, %L)', j.jobname, j.schedule, j.command)
  from cron.job j
)
select string_agg(rtrim(s, E'\n') || chr(59), E'\n\n' order by sec, k, s) || E'\n' as sql from stmt;
