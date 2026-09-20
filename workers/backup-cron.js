// Cloudflare Worker — daily Tapugan Safety backup
//
// Trigger: cron schedule (configured in wrangler.toml or dashboard).
// Default: "0 3 * * *" = every day at 03:00 UTC = 06:00 Israel summer time.
//
// What it does:
// 1. Fetches every table from Supabase REST.
// 2. Builds a JSON snapshot with meta info.
// 3. Uploads the snapshot to Supabase Storage bucket `backups`
//    as `tapugan-backup-<YYYY-MM-DD_HH-MM-SS>.json`.
//
// Why Supabase Storage and not OneDrive directly?
// Going to OneDrive would require us to store a Microsoft refresh_token
// somewhere. That's possible but adds complexity. Supabase Storage is
// the simplest fully-automatic destination because the Worker already
// has Supabase credentials. The browser app (when next opened) can copy
// the new backup file into OneDrive via the existing mirror flow — so
// the user still ends up with backups in OneDrive without us needing to
// solve the cross-platform auth problem on the Worker side.

// Every table that would have to be restored to bring the factory back.
//
// 2026-09-20: this list had 33 names and was missing two whole groups.
//   * the four trustee tables — the entire worker-participation programme,
//     which is ISO 45001 §5.4 evidence, and the only record of who reported
//     what. The in-app backup had them; the cron, which is the one that runs
//     unattended, did not.
//   * the history tables nothing else keeps: ncr_ai (CLAUDE.md names it
//     protected production history, versioned per analysis), ncr_comments,
//     ncr_patterns, equip_inspection_history, and audit_log — which is the
//     answer to "who changed this record" and exists nowhere else.
//
// notifications_log is deliberately NOT here: it is an append-only delivery
// log, it is the one table capped on sync (_sbLimit), and it is recoverable
// from the CSV export. Everything else that holds a fact goes in.
const TABLES = [
  'docs','auds','ncr','inc','tr','rsk','emp','ptw','ppe','med','ins','drl',
  'ctr','wst','hzm','env','leg','equip_inspections','near_miss','rounds',
  'hearing_tests','tasks','app_users','toolbox','env_aspects','page_files',
  'locations','saved_views','notification_prefs','custom_props','projects',
  'inspection_types','issue_types',
  // the trustee programme
  'trustee_reports','trustees','trustee_winners','trustee_tasks',
  // history nothing else keeps
  'ncr_ai','ncr_comments','ncr_patterns','equip_inspection_history','audit_log'
];

export default {
  // Cron entrypoint — Cloudflare calls this on the schedule.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runBackup(env));
  },

  // HTTP entrypoint — used for manual testing. Requires the
  // x-trigger header to match env.MANUAL_KEY (a shared secret) so
  // random traffic can't trigger backups or read state.
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      // Answers what actually happened, not that the worker is reachable.
      // 200 = a backup succeeded recently. 503 = it has not, and says why, so
      // an uptime check pointed here notices a cron that stopped running.
      let last = LAST_RUN;
      if (!last && env.BACKUP_STATE) {
        try { const raw = await env.BACKUP_STATE.get('last_run'); if (raw) last = JSON.parse(raw); } catch (e) { /* fall through to unknown */ }
      }
      if (!last) {
        return new Response(JSON.stringify({ status: 'unknown', detail: 'no run recorded by this worker yet' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
      }
      const age = Date.now() - Date.parse(last.at);
      const stale = !(age < STALE_MS);
      const healthy = last.ok && !stale;
      return new Response(JSON.stringify({
        status: healthy ? 'ok' : (stale ? 'stale' : 'failing'),
        last_run_at: last.at,
        age_hours: Math.round(age / 3600000),
        ok: last.ok, errors: last.errors,
        total_rows: last.total_rows, table_count: last.table_count,
        filename: last.filename,
      }), { status: healthy ? 200 : 503, headers: { 'Content-Type': 'application/json' } });
    }
    if (url.pathname === '/run') {
      const key = request.headers.get('x-trigger') || url.searchParams.get('key');
      if (!env.MANUAL_KEY || key !== env.MANUAL_KEY) {
        return new Response('forbidden', { status: 403 });
      }
      const result = await runBackup(env);
      return new Response(JSON.stringify(result, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response('Tapugan Safety backup worker — POST /run with x-trigger header', { status: 200 });
  }
};

async function runBackup(env) {
  const start = Date.now();
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
    return { ok: false, error: 'missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars' };
  }

  const snapshot = {
    _meta: {
      version: 1,
      app: 'Tapugan Safety',
      created_at: new Date().toISOString(),
      created_by: 'cloudflare-worker-cron',
      table_count: 0,
      total_rows: 0
    }
  };

  const errors = [];
  for (const table of TABLES) {
    try {
      const rows = await fetchAllRows(env, table);
      snapshot[table] = rows;
      if (rows.length > 0) {
        snapshot._meta.table_count++;
        snapshot._meta.total_rows += rows.length;
      }
    } catch (e) {
      errors.push({ table, error: String(e && e.message || e) });
      snapshot[table] = [];
    }
  }
  snapshot._meta.errors = errors;

  // Upload as `tapugan-backup-2026-05-06_03-00-00.json` to the `backups`
  // bucket. The bucket must exist (private) — see setup doc.
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').substring(0, 19);
  const filename = `tapugan-backup-${stamp}.json`;
  const body = JSON.stringify(snapshot, null, 2);

  const uploadResp = await fetch(`${env.SUPABASE_URL}/storage/v1/object/backups/${filename}`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'x-upsert': 'true'
    },
    body
  });

  const uploadOk = uploadResp.ok;
  const uploadText = await uploadResp.text();

  // After a successful upload, prune older snapshots so the bucket
  // doesn't grow unbounded. Keep the latest 15 (≈ 2 weeks of dailies).
  // Failures here don't fail the backup run — the new snapshot already
  // landed and that's the critical path.
  let pruneInfo = null;
  if (uploadOk) {
    try {
      pruneInfo = await pruneOldBackups(env, 15);
    } catch (e) {
      pruneInfo = { error: String(e && e.message || e) };
    }
  }

  const result = {
    ok: uploadOk && errors.length === 0,
    filename,
    table_count: snapshot._meta.table_count,
    total_rows: snapshot._meta.total_rows,
    errors,
    upload_status: uploadResp.status,
    upload_body: uploadText.substring(0, 200),
    prune: pruneInfo,
    duration_ms: Date.now() - start
  };
  // Remember it. Until now the only trace of a run was a Cloudflare log line,
  // and /health answered 'ok' whether the cron had run an hour ago or stopped
  // in July — so a backup that quietly died looked exactly like one that
  // worked. LAST_RUN is a KV binding when one is configured; without it the
  // value lives in module scope, which still covers the common case of a
  // warm worker and costs nothing.
  LAST_RUN = { at: new Date().toISOString(), ok: result.ok, filename: result.filename,
               total_rows: result.total_rows, table_count: result.table_count,
               errors: result.errors.length, duration_ms: result.duration_ms };
  try { if (env.BACKUP_STATE) await env.BACKUP_STATE.put('last_run', JSON.stringify(LAST_RUN)); } catch (e) { /* state is a convenience, never fail a good backup over it */ }
  return result;
}

// The last run this worker instance saw. Module scope survives between
// invocations on a warm worker; env.BACKUP_STATE (KV) survives a cold one.
let LAST_RUN = null;

// How long a gap makes a backup system "not working". Dailies, so a day and a
// half of silence is already wrong.
const STALE_MS = 36 * 3600 * 1000;

// Keep only the latest `keep` snapshot files in the bucket, sorted by
// filename DESC (filenames embed the ISO timestamp so lexical sort
// matches chronological sort). Older files are deleted in one batch.
async function pruneOldBackups(env, keep) {
  const listResp = await fetch(`${env.SUPABASE_URL}/storage/v1/object/list/backups`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ prefix: '', limit: 200, sortBy: { column: 'name', order: 'desc' } })
  });
  if (!listResp.ok) {
    const t = await listResp.text();
    return { pruned: 0, error: `list ${listResp.status}: ${t.substring(0, 100)}` };
  }
  const items = (await listResp.json()).filter(i => i && i.name && !i.name.endsWith('/'));
  if (items.length <= keep) {
    return { pruned: 0, kept: items.length };
  }
  const toDelete = items.slice(keep).map(i => i.name);
  // Supabase Storage delete API: DELETE /storage/v1/object/<bucket>
  // with body {prefixes: ["file1", "file2"]}
  const delResp = await fetch(`${env.SUPABASE_URL}/storage/v1/object/backups`, {
    method: 'DELETE',
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ prefixes: toDelete })
  });
  return {
    pruned: toDelete.length,
    kept: keep,
    deleted_names: toDelete,
    delete_status: delResp.status
  };
}

// Supabase REST returns at most 1000 rows per request by default, so
// page through the table for safety. Most Tapugan tables have fewer
// than 100 rows but ncr/audit_log can grow. We use range headers.
async function fetchAllRows(env, table) {
  const all = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const to = from + pageSize - 1;
    const r = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?select=*&order=ts.desc.nullslast`, {
      headers: {
        apikey: env.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        Range: `${from}-${to}`,
        Prefer: 'count=exact'
      }
    });
    if (!r.ok) {
      // If the table doesn't exist or doesn't have a `ts` column for ordering,
      // fall back to no-ordering and don't fail the whole backup.
      const r2 = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?select=*`, {
        headers: {
          apikey: env.SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          Range: `${from}-${to}`
        }
      });
      if (!r2.ok) throw new Error(`${table}: ${r2.status} ${(await r2.text()).substring(0, 80)}`);
      const rows = await r2.json();
      all.push(...rows);
      if (rows.length < pageSize) break;
      from += pageSize;
      continue;
    }
    const rows = await r.json();
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return all;
}
