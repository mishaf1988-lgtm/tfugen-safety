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
  'hearing_tests','tasks','app_users','toolbox','tour_hazards','env_aspects','page_files',
  'locations','saved_views','notification_prefs','custom_props','projects',
  'inspection_types','issue_types',
  // the trustee programme
  'trustee_reports','trustees','trustee_winners','trustee_tasks',
  // history nothing else keeps
  'ncr_ai','ncr_comments','ncr_patterns','equip_inspection_history','audit_log',
  // renewal history (3.3) and the management reviews §9.3.3 says to retain (6.11)
  'record_history','mgmt_reviews'
];

// Tables with no `ts` column (checked against the live schema 28/09). They are
// read without `order=ts`, in ONE request. The old code tried `order=ts` first
// and fell back on the 400, which cost these 15 tables two requests each.
const NO_TS = new Set(['auds','ctr','docs','drl','emp','env','hzm','inc','ins','leg','med','ppe','rsk','tr','wst']);

// Cloudflare caps the subrequests (fetch calls) of one invocation: 50 on the
// Free plan, far more on Paid. 45 tables + upload + list + delete fits in 50
// only because of NO_TS. The budget below makes the limit visible instead of
// fatal: tables are read until only RESERVE requests are left, so the upload
// always happens, and any table skipped for budget is named in `errors` (which
// turns ok false and /health 'failing'). Cowork found this 28/09 before the
// deploy: without it, 62 requests would have lost the upload itself.
// SUBREQ_LIMIT (env, optional) raises it on a Paid plan.
const RESERVE = 3; // upload + list + delete
function makeBudget(env) {
  const limit = parseInt(env && env.SUBREQ_LIMIT, 10) || 50;
  return { limit, used: 0, left() { return this.limit - this.used; } };
}
function bfetch(budget, url, init) {
  if (budget.used >= budget.limit) throw new Error('subrequest budget exhausted');
  budget.used++;
  return fetch(url, init);
}

export default {
  // Cron entrypoint — Cloudflare calls this on the schedule.
  async scheduled(event, env, ctx) {
    // One summary line in Logs: the dashboard shows it after a test run, and
    // it is the only place a skipped table is visible without opening the file.
    ctx.waitUntil(runBackup(env).then((r) => console.log(JSON.stringify({
      ok: r.ok, filename: r.filename, table_count: r.table_count, total_rows: r.total_rows,
      subrequests: r.subrequests, errors: r.errors, upload_status: r.upload_status
    }))));
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
        // No KV binding and a cold instance: the newest file in the bucket is
        // the evidence (one list request; this is a separate invocation).
        try {
          const lr = await fetch(`${env.SUPABASE_URL}/storage/v1/object/list/backups`, {
            method: 'POST',
            headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ prefix: '', limit: 1, sortBy: { column: 'name', order: 'desc' } })
          });
          const top = lr.ok ? (await lr.json())[0] : null;
          if (top && top.created_at) last = { at: top.created_at, ok: !/-partial\.json$/.test(top.name), filename: top.name, errors: null, from: 'bucket' };
        } catch (e) { /* unknown below */ }
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
  const budget = makeBudget(env);
  for (const table of TABLES) {
    if (budget.left() <= RESERVE) {
      errors.push({ table, error: 'skipped: subrequest budget (' + budget.limit + ')' });
      snapshot[table] = [];
      continue;
    }
    try {
      const rows = await fetchAllRows(env, table, budget);
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
  // A backup with errors (a skipped or unreadable table) says so in its NAME,
  // so it is visible from outside without downloading it: from /health (which
  // without KV only sees the bucket listing) and from SQL on storage.objects.
  // Lexical order still follows the timestamp, so pruning is unaffected.
  const filename = `tapugan-backup-${stamp}${errors.length ? '-partial' : ''}.json`;
  const body = JSON.stringify(snapshot, null, 2);

  const uploadResp = await bfetch(budget, `${env.SUPABASE_URL}/storage/v1/object/backups/${filename}`, {
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
  if (uploadOk && budget.left() >= 2) {
    try {
      pruneInfo = await pruneOldBackups(env, 15, budget);
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
    prune: pruneInfo || (uploadOk ? { skipped: 'subrequest budget' } : null),
    subrequests: budget.used,
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
async function pruneOldBackups(env, keep, budget) {
  const listResp = await bfetch(budget, `${env.SUPABASE_URL}/storage/v1/object/list/backups`, {
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
  const delResp = await bfetch(budget, `${env.SUPABASE_URL}/storage/v1/object/backups`, {
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
// A NO_TS table is read unordered in one request per page. For the others,
// order=ts is tried and, if the column turns out to be missing after all
// (a schema change), the page is re-read unordered.
async function fetchAllRows(env, table, budget) {
  const all = [];
  const pageSize = 1000;
  const h = (from, to) => ({
    apikey: env.SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
    Range: `${from}-${to}`
  });
  let ordered = !NO_TS.has(table);
  let from = 0;
  while (true) {
    const to = from + pageSize - 1;
    let r = await bfetch(budget, `${env.SUPABASE_URL}/rest/v1/${table}?select=*${ordered ? '&order=ts.desc.nullslast' : ''}`, { headers: h(from, to) });
    if (!r.ok && ordered) {
      ordered = false;
      r = await bfetch(budget, `${env.SUPABASE_URL}/rest/v1/${table}?select=*`, { headers: h(from, to) });
    }
    if (!r.ok) throw new Error(`${table}: ${r.status} ${(await r.text()).substring(0, 80)}`);
    const rows = await r.json();
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return all;
}
