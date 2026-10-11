// Cloudflare Pages Function: the Routines' way to the database (09/10/2026,
// Michael: "לא רוצה תלות במנהל הארגון", "בצע: דרך האתר שלנו").
//
// The Routines used the Supabase connector's execute_sql. The organisation
// admin locked "Always allow" for it, so a call can wait for a click that
// nobody gives at 22:47 on a Saturday. A Routine calls this endpoint with curl
// instead: same data, no connector, no admin.
//
// The gate is one secret, ROUTINE_KEY, in Cloudflare and in the cloud
// environment's variables (Michael sets both, once). No key in Cloudflare =
// every call is refused. Machine path in _middleware (the cloud is not in
// Israel).
//
// What it can do, and nothing else:
//   select     GET one table of TABLES with a PostgREST query string. No "("
//              in select=, so no embedding of a table that is not on the list.
//              Medical tables (med, hearing_tests) give only the expiry, and
//              trustee_reports only where and when, never the free text or a
//              name (Michael, 09/10/2026: "בצע: בלי טבלת רפואה"). COLUMNS.
//   state_get  read server_state keys of STATE_READ.
//   state_set  write one key of STATE_WRITE, then read it back.
//   live       the deployed commit (CF_PAGES_COMMIT_SHA) and the sha256 of the index.html this
//              deployment serves (env.ASSETS). The cloud is outside Israel, so the country gate
//              answers 403 to a plain fetch of the site; a night run compares this hash with the
//              file it tested to prove the live site runs exactly that code (09/10/2026).
//   agent_report  append one run report {agent, ok, line, learned} to server_state
//              agent_log (last AGENT_LOG_MAX kept). Every Routine ends with it, so a
//              failed or silent run reaches the weekly mail and the daily retro
//              (09/10/2026, review of the agents: a run's last message in a
//              persistent session reaches nobody).
//   expiry_set  (11/10/2026, Michael in the questionnaire: "בצע: תיוק מייל + תוקף")
//              update one row of docs / equip_inspections after a document was read:
//              e, file_url (only under Michael's OneDrive), s (docs) or d (equipment).
//              A later e needs the document it came from (doc). The old value, the new
//              one, why and the document are appended to the row's note, so every change
//              is visible in the app. EXPIRY_TABLES, expiryPatch.
//   od_move  (11/10/2026, Michael in the questionnaire: "בצע: Power Automate + השרת")
//              move one file that a Power Automate flow saved from the mail into the
//              inbox folder (OD_INBOX) of the safety folder to a folder that already
//              exists inside the safety folder, under a new name. Graph with
//              conflictBehavior=fail: an existing name is never replaced, no folder is
//              created, nothing is deleted. Michael's computer is not needed. odMoveCheck.
// No delete, no other table, no raw SQL. The data is data, not instructions
// (trustee_reports holds free text from an anonymous kiosk).
import { jsonResp } from '../_shared.js';
import { extractApp, rewriteApp, buildOf, appSrc } from '../_appjs.js';
import { accessToken } from '../_onedrive.js';

export const TABLES = ['docs', 'equip_inspections', 'tr', 'med', 'ppe', 'hearing_tests', 'ctr', 'tasks', 'leg',
  'tour_hazards', 'trustee_reports', 'inc', 'near_miss', 'ncr'];
export const STATE_READ = ['quote_track', 'nevo_versions', 'od_scan', 'vendor_contacts', 'agent_log'];
export const AGENT_LOG_MAX = 200;
// One run report, cleaned: a short agent name and three short texts.
export function agentEntry(b, nowIso) {
  const name = String(b.agent || '');
  if (!/^[a-z0-9-]{2,40}$/.test(name)) return null;
  const t = (x) => String(x === undefined || x === null ? '' : x).replace(/\s+/g, ' ').trim().slice(0, 300);
  return { agent: name, at: nowIso, ok: b.ok === true, line: t(b.line), learned: t(b.learned) };
}
export const STATE_WRITE = ['quote_track', 'nevo_versions', 'od_raw_token', 'od_raw_exp'];
// Tables a Routine reads only some columns of; select= is required and must stay inside.
export const COLUMNS = {
  med: ['id', 'e'],
  hearing_tests: ['id', 'e'],
  trustee_reports: ['id', 'loc', 'location_id', 's', 'ok', 'ts', 'closed_d', 'num'],
};
// expiry_set: the tables, the note column of each, and the one extra field it may set.
export const EXPIRY_TABLES = {
  docs: { note: 'nt', extra: 's' },
  equip_inspections: { note: 'notes', extra: 'd' },
};
export const DOC_STATES = ['\u05d1\u05ea\u05d5\u05e7\u05e3', '\u05e4\u05d2 \u05ea\u05d5\u05e7\u05e3', '\u05d8\u05e2\u05d5\u05df \u05d0\u05d9\u05de\u05d5\u05ea'];
export const FILE_URL_PREFIX = 'https://tapugancoil-my.sharepoint.com/personal/sviva_tapugan_co_il/';
const isDay = (x) => /^\d{4}-\d{2}-\d{2}$/.test(String(x || '')) && !isNaN(Date.parse(x + 'T00:00:00Z')) && new Date(x + 'T00:00:00Z').toISOString().slice(0, 10) === x;
const ddmm = (x) => x ? x.slice(8, 10) + '/' + x.slice(5, 7) + '/' + x.slice(0, 4) : '-';
const short = (x, n) => String(x === undefined || x === null ? '' : x).replace(/\s+/g, ' ').trim().slice(0, n);

// The PATCH for one row, or { error }. row = the row as it is now; today = YYYY-MM-DD.
export function expiryPatch(b, row, today) {
  const t = EXPIRY_TABLES[b.table];
  if (!t) return { error: 'table not allowed' };
  if (!/^[a-z0-9-]{2,40}$/.test(String(b.agent || ''))) return { error: 'bad agent name' };
  const why = short(b.why, 300), doc = short(b.doc, 300);
  if (why.length < 5) return { error: 'why required' };
  const patch = {}, said = [];
  if (b.e !== undefined) {
    if (!isDay(b.e) || b.e < '2000-01-01' || b.e > String(Number(today.slice(0, 4)) + 6) + today.slice(4)) return { error: 'bad e' };
    const old = row.e ? String(row.e).slice(0, 10) : '';
    // later than now = the run read a document that says so; earlier is always allowed (careful)
    if ((!old || b.e > old) && !doc) return { error: 'doc required for a later e' };
    if (b.e !== old) { patch.e = b.e; said.push('\u05ea\u05d5\u05e7\u05e3 ' + ddmm(old) + ' -> ' + ddmm(b.e)); }
  }
  if (b.file_url !== undefined) {
    const u = String(b.file_url || '');
    if (u.indexOf(FILE_URL_PREFIX) !== 0 || u.length > 600 || /[\s"<>]/.test(u)) return { error: 'bad file_url' };
    if (u !== row.file_url) { patch.file_url = u; said.push('\u05e7\u05d9\u05e9\u05d5\u05e8 \u05dc\u05e7\u05d5\u05d1\u05e5'); }
  }
  if (b[t.extra] !== undefined) {
    const v = b[t.extra];
    if (t.extra === 's' && DOC_STATES.indexOf(v) < 0) return { error: 'bad s' };
    if (t.extra === 'd' && (!isDay(v) || v > today)) return { error: 'bad d' };
    if (v !== row[t.extra]) { patch[t.extra] = v; said.push(t.extra + ' ' + (t.extra === 'd' ? ddmm(v) : v)); }
  }
  for (const k of Object.keys(b)) {
    if (['op', 'table', 'id', 'agent', 'why', 'doc', 'e', 'file_url', t.extra].indexOf(k) < 0) return { error: 'field not allowed: ' + k };
  }
  if (!said.length) return { patch: null };
  const line = ddmm(today) + ' Claude (' + b.agent + '): ' + said.join(', ') + '. ' + why + (doc ? '. \u05de\u05e1\u05de\u05da: ' + doc : '');
  const prev = String(row[t.note] || '').trim();
  patch[t.note] = prev ? prev + ' | ' + line : line;
  return { patch };
}

// od_move: the safety folder, the folder the flow saves into, and what may go where.
export const OD_ROOT = '\u05e9\u05d5\u05dc\u05d7\u05df \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4/\u05e0\u05d9\u05d4\u05d5\u05dc \u05d1\u05d8\u05d9\u05d7\u05d5\u05ea/';
export const OD_INBOX = '_\u05e0\u05db\u05e0\u05e1 \u05de\u05d4\u05de\u05d9\u05d9\u05dc';
// Files that are not filed (invoices, quotes, unclear) go here, so the inbox holds only what is new
// (11/10/2026, Michael: "בצע: כל מה שמגיע, חוץ מרעש"). The only folder inside the inbox a file may go to.
export const OD_SKIP = '\u05dc\u05d0 \u05dc\u05ea\u05d9\u05d5\u05e7';
const OD_NO_DIR = /(^|\/)(_\u05d2\u05e8\u05e1\u05d0\u05d5\u05ea \u05e7\u05d5\u05d3\u05de\u05d5\u05ea|\u05dc\u05de\u05d7\u05d9\u05e7\u05d4|ARCHIVE)(\/|$)/i;
const OD_EXT = /\.(pdf|docx?|xlsx|jpe?g|png)$/i;
const OD_BAD = /[<>:"|?*\\\u0000-\u001f]/;
// { from, toDir, name } as Graph paths under the drive root, or { error }.
export function odMoveCheck(b) {
  if (!/^[a-z0-9-]{2,40}$/.test(String(b.agent || ''))) return { error: 'bad agent name' };
  if (String(b.why || '').trim().length < 5) return { error: 'why required' };
  const clean = (x) => String(x === undefined || x === null ? '' : x).split('/').filter(Boolean);
  const bad = (parts) => parts.some((x) => x === '.' || x === '..' || OD_BAD.test(x) || x.length > 180);
  const from = clean(b.from), dir = clean(b.to_dir), name = String(b.name || '');
  if (from.length !== 1 || bad(from) || !OD_EXT.test(from[0])) return { error: 'from: one file inside the inbox folder' };
  const skip = dir.length === 2 && dir[0] === OD_INBOX && dir[1] === OD_SKIP;
  if (!dir.length || bad(dir) || OD_NO_DIR.test(dir.join('/')) || (dir[0] === OD_INBOX && !skip)) return { error: 'bad to_dir' };
  if (!name || name.indexOf('/') >= 0 || OD_BAD.test(name) || name.length > 180 || !OD_EXT.test(name)) return { error: 'bad name' };
  return { from: OD_ROOT + OD_INBOX + '/' + from[0], toDir: OD_ROOT + dir.join('/'), name };
}

const SB_DEFAULT = 'https://znhjtpcltrxxyfjczgvw.supabase.co';

async function digest(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(s)));
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join('');
}

// Same length compare of the hashes, so the time does not tell how much matched.
export async function keyOk(given, want) {
  if (!want || !given) return false;
  const a = await digest(given), b = await digest(want);
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

// The query string for one table, or null when it asks for more than that table.
export function cleanQuery(q, table) {
  const p = new URLSearchParams(String(q || '').replace(/^\?/, ''));
  for (const [k, v] of p) {
    if (k === 'select' && /[()]/.test(v)) return null;
    if (/[^a-zA-Z0-9_.]/.test(k)) return null;
  }
  const only = COLUMNS[table];
  if (only) {
    const sel = p.getAll('select');
    if (sel.length !== 1) return null;
    const cols = sel[0].split(',').map((c) => c.trim().split('::')[0]);
    if (!cols.length || cols.some((c) => only.indexOf(c) < 0)) return null;
    // a filter or an order on a column outside the list would still leak it
    for (const [k, v] of p) {
      if (k === 'select' || k === 'limit' || k === 'offset') continue;
      if (k === 'order') { if (v.split(',').some((o) => only.indexOf(o.split('.')[0]) < 0)) return null; continue; }
      if (k === 'or' || k === 'and' || only.indexOf(k) < 0) return null;
    }
  }
  return p.toString();
}

export async function liveInfo(request, env) {
  const out = { ok: false, commit: env.CF_PAGES_COMMIT_SHA || null, branch: env.CF_PAGES_BRANCH || null };
  try {
    if (!env.ASSETS) { out.error = 'no ASSETS binding'; return out; }
    const r = await env.ASSETS.fetch(new Request(new URL('/index.html', request.url).toString()));
    if (!r.ok) { out.error = 'index ' + r.status; return out; }
    const buf = await r.arrayBuffer();
    out.bytes = buf.byteLength;
    out.index_sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', buf))).map((b) => b.toString(16).padStart(2, '0')).join('');
    // /app.js (10/10/2026): the main script is cut out of this index and the page is
    // rewritten to load it. The cloud cannot open the site (country gate), so the night run
    // proves both here, in the real runtime: the cut's length, and that the swap happened.
    const html = new TextDecoder().decode(buf), js = extractApp(html);
    out.app_js_bytes = js === null ? null : js.length;
    try {
      const sw = rewriteApp(new Response(html, { headers: { 'Content-Type': 'text/html' } }), buildOf(env));
      out.app_swap = (await sw.text()).indexOf('src="' + appSrc(buildOf(env)) + '"') >= 0;
    } catch (e) { out.app_swap = false; }
    out.ok = true;
  } catch (e) { out.error = String(e && e.message || e).slice(0, 200); }
  return out;
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return jsonResp({ error: 'method not allowed' }, 405, {});
  if (!(await keyOk(request.headers.get('x-routine-key') || '', env.ROUTINE_KEY))) return jsonResp({ error: 'forbidden' }, 403, {});
  let peek = null;
  try { peek = await request.clone().json(); } catch (e) { peek = null; }
  if (peek && peek.op === 'live') return jsonResp(await liveInfo(request, env), 200, {});
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return jsonResp({ ok: false, error: 'server not configured' }, 200, {});
  let body = {};
  try { body = await request.json(); } catch (e) { return jsonResp({ ok: false, error: 'bad json' }, 400, {}); }
  const url = env.SUPABASE_URL || SB_DEFAULT, k = env.SUPABASE_SERVICE_ROLE_KEY;
  const h = { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' };
  const stateRead = async (keys) => {
    const r = await fetch(url + '/rest/v1/server_state?select=key,value,updated_at&key=in.(' + keys.map(encodeURIComponent).join(',') + ')', { headers: h });
    if (!r.ok) throw new Error('read ' + r.status);
    return r.json();
  };
  try {
    if (body.op === 'select') {
      if (TABLES.indexOf(body.table) < 0) return jsonResp({ ok: false, error: 'table not allowed' }, 400, {});
      const q = cleanQuery(body.query, body.table);
      if (q === null) return jsonResp({ ok: false, error: 'query not allowed' }, 400, {});
      const r = await fetch(url + '/rest/v1/' + body.table + (q ? '?' + q : ''), { headers: h });
      if (!r.ok) return jsonResp({ ok: false, error: 'select ' + r.status, detail: (await r.text()).slice(0, 300) }, 200, {});
      return jsonResp({ ok: true, rows: await r.json() }, 200, {});
    }
    if (body.op === 'state_get') {
      const keys = (Array.isArray(body.keys) ? body.keys : [body.key]).filter((x) => STATE_READ.indexOf(x) >= 0);
      if (!keys.length) return jsonResp({ ok: false, error: 'key not allowed' }, 400, {});
      return jsonResp({ ok: true, rows: await stateRead(keys) }, 200, {});
    }
    if (body.op === 'state_set') {
      if (STATE_WRITE.indexOf(body.key) < 0) return jsonResp({ ok: false, error: 'key not allowed' }, 400, {});
      const value = body.value === null || body.value === undefined ? null : (typeof body.value === 'string' ? body.value : JSON.stringify(body.value));
      const r = await fetch(url + '/rest/v1/server_state?on_conflict=key', {
        method: 'POST',
        headers: { ...h, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify([{ key: body.key, value, updated_at: new Date().toISOString() }]),
      });
      if (!r.ok) return jsonResp({ ok: false, error: 'write ' + r.status }, 200, {});
      const rows = await stateRead([body.key]);
      const got = Array.isArray(rows) && rows[0] ? rows[0].value : null;
      return jsonResp({ ok: got === value, value: got }, 200, {});
    }
    if (body.op === 'agent_report') {
      const e = agentEntry(body, new Date().toISOString());
      if (!e) return jsonResp({ ok: false, error: 'bad agent name' }, 400, {});
      const rows = await stateRead(['agent_log']);
      let log = [];
      try { log = JSON.parse(rows && rows[0] && rows[0].value || '[]'); } catch (x) { log = []; }
      if (!Array.isArray(log)) log = [];
      log.push(e);
      log = log.slice(-AGENT_LOG_MAX);
      const r = await fetch(url + '/rest/v1/server_state?on_conflict=key', {
        method: 'POST',
        headers: { ...h, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify([{ key: 'agent_log', value: JSON.stringify(log), updated_at: e.at }]),
      });
      if (!r.ok) return jsonResp({ ok: false, error: 'write ' + r.status }, 200, {});
      return jsonResp({ ok: true, entry: e, kept: log.length }, 200, {});
    }
    if (body.op === 'expiry_set') {
      const t = EXPIRY_TABLES[body.table];
      if (!t) return jsonResp({ ok: false, error: 'table not allowed' }, 400, {});
      const id = String(body.id === undefined || body.id === null ? '' : body.id);
      if (!/^[A-Za-z0-9_.-]{1,80}$/.test(id)) return jsonResp({ ok: false, error: 'bad id' }, 400, {});
      const cols = ['id', 'e', 'file_url', t.note, t.extra].join(',');
      const g = await fetch(url + '/rest/v1/' + body.table + '?select=' + cols + '&id=eq.' + encodeURIComponent(id), { headers: h });
      if (!g.ok) return jsonResp({ ok: false, error: 'read ' + g.status }, 200, {});
      const rows = await g.json();
      if (!Array.isArray(rows) || rows.length !== 1) return jsonResp({ ok: false, error: 'row not found' }, 200, {});
      const today = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
      const p = expiryPatch(body, rows[0], today);
      if (p.error) return jsonResp({ ok: false, error: p.error }, 400, {});
      if (!p.patch) return jsonResp({ ok: true, changed: false, row: rows[0] }, 200, {});
      const w = await fetch(url + '/rest/v1/' + body.table + '?id=eq.' + encodeURIComponent(id), {
        method: 'PATCH', headers: { ...h, Prefer: 'return=representation' }, body: JSON.stringify(p.patch),
      });
      if (!w.ok) return jsonResp({ ok: false, error: 'write ' + w.status, detail: (await w.text()).slice(0, 300) }, 200, {});
      const after = await w.json();
      if (!Array.isArray(after) || after.length !== 1) return jsonResp({ ok: false, error: 'write touched ' + (Array.isArray(after) ? after.length : '?') + ' rows' }, 200, {});
      return jsonResp({ ok: true, changed: true, before: rows[0], after: after[0] }, 200, {});
    }
    if (body.op === 'od_move') {
      const c = odMoveCheck(body);
      if (c.error) return jsonResp({ ok: false, error: c.error }, 400, {});
      const at = await accessToken(env);
      const gh = { Authorization: 'Bearer ' + at.token, 'Content-Type': 'application/json' };
      const G = 'https://graph.microsoft.com/v1.0/me/drive/root:/';
      const enc = (p) => p.split('/').filter(Boolean).map(encodeURIComponent).join('/');
      const src = await fetch(G + enc(c.from) + '?select=id,name,size,file', { headers: gh });
      if (!src.ok) return jsonResp({ ok: false, error: 'source ' + src.status }, 200, {});
      const sj = await src.json();
      if (!sj.file) return jsonResp({ ok: false, error: 'source is not a file' }, 200, {});
      const dst = await fetch(G + enc(c.toDir) + '?select=id,folder', { headers: gh });
      if (!dst.ok) return jsonResp({ ok: false, error: 'folder ' + dst.status }, 200, {});
      const dj = await dst.json();
      if (!dj.folder) return jsonResp({ ok: false, error: 'to_dir is not a folder' }, 200, {});
      const taken = await fetch(G + enc(c.toDir + '/' + c.name) + '?select=id', { headers: gh });
      if (taken.status !== 404) return jsonResp({ ok: false, error: taken.ok ? 'name taken' : 'name check ' + taken.status }, 200, {});
      const mv = await fetch('https://graph.microsoft.com/v1.0/me/drive/items/' + encodeURIComponent(sj.id) + '?@microsoft.graph.conflictBehavior=fail', {
        method: 'PATCH', headers: gh, body: JSON.stringify({ parentReference: { id: dj.id }, name: c.name }),
      });
      const mj = await mv.json().catch(() => ({}));
      if (!mv.ok) return jsonResp({ ok: false, error: 'move ' + mv.status }, 200, {});
      return jsonResp({ ok: true, path: c.toDir + '/' + c.name, size: mj.size || sj.size || null, webUrl: mj.webUrl || null }, 200, {});
    }
    return jsonResp({ ok: false, error: 'unknown op' }, 400, {});
  } catch (e) {
    return jsonResp({ ok: false, error: String(e && e.message || e).slice(0, 200) }, 200, {});
  }
}
