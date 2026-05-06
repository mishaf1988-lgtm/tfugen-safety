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

const TABLES = [
  'docs','auds','ncr','inc','tr','rsk','emp','ptw','ppe','med','ins','drl',
  'ctr','wst','hzm','env','leg','equip_inspections','near_miss','rounds',
  'hearing_tests','tasks','app_users','toolbox','env_aspects','page_files',
  'locations','saved_views','notification_prefs','custom_props','projects',
  'inspection_types','issue_types'
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
      return new Response('ok', { status: 200 });
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

  return {
    ok: uploadOk && errors.length === 0,
    filename,
    table_count: snapshot._meta.table_count,
    total_rows: snapshot._meta.total_rows,
    errors,
    upload_status: uploadResp.status,
    upload_body: uploadText.substring(0, 200),
    duration_ms: Date.now() - start
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
