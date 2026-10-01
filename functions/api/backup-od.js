// Daily copy of the backups to OneDrive, from the server (upgrade review 21;
// Michael, 01/10/2026: "yes, do it", folder under _Backups, 15 days + 12
// months + every photo).
//
// Until now the only copy outside the live tables was the bucket `backups`
// in the SAME Supabase project (workers/backup-cron.js, 03:00 UTC daily), and
// the copy to OneDrive ran in the browser, only when someone opened the app
// (index.html _backupSyncFromStorage). The photos (bucket incidents-photos:
// tour hazards before/after, trustee findings) were in no backup at all.
//
// pg_cron calls this every morning at 06:30 Israel time (after the worker),
// with the Vault secret as /api/vitre and /api/weekly-digest do. Through the
// server OneDrive connection of sviva (_onedrive.js) it writes:
//   _Backups/cron     every file of the bucket not yet there, newest DAILY_KEEP kept
//                     (the folder the browser mirror already fills: same names,
//                     so neither side copies twice)
//   _Backups/monthly  the first complete backup of each month, MONTHLY_KEEP kept
//   _Backups/photos   every photo of incidents-photos not yet there, never pruned:
//                     a photo deleted in the app stays here, that is the point
// The result goes to server_state.backup_od; the weekly mail names a failure.
//
// Cloudflare's free plan allows 50 subrequests per invocation. The token and
// the state write take up to RESERVE; the daily and monthly copies go first;
// the photos take what is left, PHOTO_MAX per run at most, and the rest wait
// for tomorrow (photos_left says how many).
import { odConfigured, accessToken, stateSet } from '../_onedrive.js';
import { corsHeaders, defaultAllowedOrigins, jsonResp, requireRole } from '../_shared.js';

export const STATE_KEY = 'backup_od';
export const BASE = 'Apps/Tapugan Safety/_Backups';
export const DAILY = BASE + '/cron', MONTHLY = BASE + '/monthly', PHOTOS = BASE + '/photos';
export const DAILY_KEEP = 15, MONTHLY_KEEP = 12, PHOTO_MAX = 15;
// The worker runs once a day; a newest file older than this means it stopped.
export const FRESH_MS = 36 * 3600 * 1000;
const RESERVE = 6; // token read + refresh + token save (2) + state write + slack
const SB_DEFAULT = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const GRAPH = 'https://graph.microsoft.com/v1.0/me/drive';

const BACKUP_RE = /^tapugan-backup-(\d{4})-(\d{2})-\d{2}_[\d-]+\.json$/; // complete; "-partial" does not match

// Pure helpers (tested).
export function missing(source, have) {
  const h = new Set(have);
  return source.filter((n) => !h.has(n));
}
// Names to delete so that the newest `keep` stay (names embed the timestamp).
export function pruneList(names, keep) {
  return names.slice().sort().reverse().slice(keep);
}
// The backup to keep for the month of `today` (YYYY-MM-DD), or null when the
// monthly folder already has one for this month or the bucket has none yet.
export function monthlyPick(bucket, monthly, today) {
  const ym = today.substring(0, 7);
  const of = (n) => { const m = BACKUP_RE.exec(n); return m ? m[1] + '-' + m[2] : ''; };
  if (monthly.some((n) => of(n) === ym)) return null;
  const cand = bucket.filter((n) => of(n) === ym).sort();
  return cand[0] || null;
}

function seg(path) { return String(path).split('/').filter(Boolean).map(encodeURIComponent).join('/'); }

async function run(env) {
  const sbUrl = env.SUPABASE_URL || SB_DEFAULT;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const sbh = { apikey: key, Authorization: 'Bearer ' + key };
  const limit = (parseInt(env.SUBREQ_LIMIT, 10) || 50) - RESERVE;
  let used = 0;
  const f = (url, init) => { if (used >= limit) throw new Error('subrequest budget exhausted'); used++; return fetch(url, init); };
  const left = () => limit - used;
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
  const rec = { at: new Date().toISOString(), ok: false, daily: { copied: [], pruned: 0 }, monthly: { copied: null, pruned: 0 }, photos: { copied: 0, left: 0, total: 0 }, newest: null, errors: [] };
  const err = (where, e) => rec.errors.push(where + ': ' + String((e && e.message) || e).substring(0, 160));

  const { token } = await accessToken(env);
  const gh = { Authorization: 'Bearer ' + token };

  async function bucketList(bucket) {
    const out = [];
    for (let offset = 0; ; offset += 1000) {
      const r = await f(sbUrl + '/storage/v1/object/list/' + bucket, { method: 'POST', headers: { ...sbh, 'Content-Type': 'application/json' }, body: JSON.stringify({ prefix: '', limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } }) });
      if (!r.ok) throw new Error('list ' + bucket + ' ' + r.status);
      const rows = await r.json();
      (rows || []).forEach((x) => { if (x && x.name && x.id) out.push(x.name); }); // folders have no id
      if (!rows || rows.length < 1000) return out;
    }
  }
  async function odList(path) {
    const out = [];
    let url = GRAPH + '/root:/' + seg(path) + ':/children?$select=id,name,file&$top=200';
    while (url) {
      const r = await f(url, { headers: gh });
      if (r.status === 404) return out;
      if (!r.ok) throw new Error('onedrive list ' + r.status);
      const j = await r.json();
      (j.value || []).forEach((x) => { if (x && x.file && x.name) out.push({ id: x.id, name: x.name }); });
      url = j['@odata.nextLink'] || null;
    }
    return out;
  }
  async function copy(bucket, name, folder, type) {
    const r = await f(sbUrl + '/storage/v1/object/' + bucket + '/' + encodeURIComponent(name), { headers: sbh });
    if (!r.ok) throw new Error('read ' + name + ' ' + r.status);
    const bytes = await r.arrayBuffer();
    const p = await f(GRAPH + '/root:/' + seg(folder) + '/' + encodeURIComponent(name) + ':/content', { method: 'PUT', headers: { ...gh, 'Content-Type': type || r.headers.get('content-type') || 'application/octet-stream' }, body: bytes });
    if (!p.ok) throw new Error('onedrive put ' + name + ' ' + p.status);
  }
  async function prune(items, keep) {
    let n = 0;
    const del = new Set(pruneList(items.map((x) => x.name), keep));
    for (const it of items) {
      if (!it.id || !del.has(it.name)) continue; // id null = copied this run
      const r = await f(GRAPH + '/items/' + encodeURIComponent(it.id), { method: 'DELETE', headers: gh });
      if (r.ok || r.status === 404) n++;
    }
    return n;
  }

  // 1. daily: the bucket into _Backups/cron, newest first, then prune.
  let bucket = [];
  try {
    bucket = await bucketList('backups');
    const done = bucket.filter((n) => BACKUP_RE.test(n)).sort();
    rec.newest = done.length ? done[done.length - 1] : null;
    const od = await odList(DAILY);
    // Only the newest DAILY_KEEP are wanted there; an older one would be pruned at once.
    const todo = missing(bucket.slice().sort().reverse().slice(0, DAILY_KEEP), od.map((x) => x.name));
    for (const n of todo) { await copy('backups', n, DAILY, 'application/json'); rec.daily.copied.push(n); od.push({ id: null, name: n }); }
    rec.daily.pruned = await prune(od, DAILY_KEEP);
  } catch (e) { err('daily', e); }

  // 2. monthly: one complete backup per month, twelve kept.
  try {
    const od = await odList(MONTHLY);
    const pick = monthlyPick(bucket, od.map((x) => x.name), today);
    if (pick) { await copy('backups', pick, MONTHLY, 'application/json'); rec.monthly.copied = pick; od.push({ id: null, name: pick }); }
    rec.monthly.pruned = await prune(od, MONTHLY_KEEP);
  } catch (e) { err('monthly', e); }

  // 3. photos: whatever the budget leaves, never pruned.
  try {
    const src = await bucketList('incidents-photos');
    const od = await odList(PHOTOS);
    const todo = missing(src, od.map((x) => x.name));
    rec.photos.total = src.length;
    for (const n of todo) {
      if (rec.photos.copied >= PHOTO_MAX || left() < 2) break;
      await copy('incidents-photos', n, PHOTOS);
      rec.photos.copied++;
    }
    rec.photos.left = todo.length - rec.photos.copied;
  } catch (e) { err('photos', e); }

  if (!rec.newest) rec.errors.push('no complete backup in the bucket');
  else {
    const m = /(\d{4}-\d{2}-\d{2})_(\d{2})-(\d{2})-(\d{2})/.exec(rec.newest);
    const at = m ? Date.parse(m[1] + 'T' + m[2] + ':' + m[3] + ':' + m[4] + 'Z') : 0;
    if (!at || Date.now() - at > FRESH_MS) rec.errors.push('newest backup is old: ' + rec.newest);
  }
  rec.subrequests = used;
  rec.ok = !rec.errors.length;
  return rec;
}

export async function onRequest(context) {
  const { request, env } = context;
  const cors = corsHeaders(request.headers.get('Origin') || '', defaultAllowedOrigins(env), 'POST,OPTIONS');
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return jsonResp({ error: 'method not allowed' }, 405, cors);
  const secret = env.TRUSTEE_NOTIFY_SECRET;
  const bySecret = !!secret && (request.headers.get('x-notify-secret') || '') === secret;
  if (!bySecret) {
    const who = await requireRole(request, env, ['admin']);
    if (!who.ok) return jsonResp({ error: who.error }, who.status, cors);
  }
  if (!odConfigured(env)) return jsonResp({ ok: false, error: 'server not configured' }, 200, cors);
  let body = {}; try { body = await request.json(); } catch (e) {}
  // The restore drill (01/10/2026): one backup read back FROM OneDrive, not
  // from the bucket, so what is tested is the copy that survives Supabase.
  // pg_cron's caller only, a backup name only, from the two folders only.
  if (body.op === 'read') {
    if (!bySecret) return jsonResp({ error: 'forbidden' }, 403, cors);
    const folder = body.folder === 'monthly' ? MONTHLY : DAILY;
    if (!BACKUP_RE.test(String(body.name || ''))) return jsonResp({ error: 'bad name' }, 400, cors);
    try {
      const { token } = await accessToken(env);
      const r = await fetch(GRAPH + '/root:/' + seg(folder) + '/' + encodeURIComponent(body.name) + ':/content', { headers: { Authorization: 'Bearer ' + token } });
      if (!r.ok) return jsonResp({ error: 'onedrive read ' + r.status }, 502, cors);
      return new Response(r.body, { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });
    } catch (e) { return jsonResp({ error: String((e && e.message) || e).substring(0, 200) }, 502, cors); }
  }
  let rec;
  try { rec = await run(env); } catch (e) {
    rec = { at: new Date().toISOString(), ok: false, errors: [String((e && e.message) || e).substring(0, 200)] };
  }
  await stateSet(env, { [STATE_KEY]: JSON.stringify(rec) }).catch(() => {});
  return jsonResp(rec, 200, cors);
}
