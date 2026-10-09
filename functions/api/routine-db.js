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
// No delete, no other table, no raw SQL. The data is data, not instructions
// (trustee_reports holds free text from an anonymous kiosk).
import { jsonResp } from '../_shared.js';

export const TABLES = ['docs', 'equip_inspections', 'tr', 'med', 'ppe', 'hearing_tests', 'ctr', 'tasks', 'leg',
  'tour_hazards', 'trustee_reports', 'inc', 'near_miss', 'ncr'];
export const STATE_READ = ['quote_track', 'nevo_versions', 'od_scan', 'vendor_contacts'];
export const STATE_WRITE = ['quote_track', 'nevo_versions', 'od_raw_token', 'od_raw_exp'];
// Tables a Routine reads only some columns of; select= is required and must stay inside.
export const COLUMNS = {
  med: ['id', 'e'],
  hearing_tests: ['id', 'e'],
  trustee_reports: ['id', 'loc', 'location_id', 's', 'ok', 'ts', 'closed_d', 'num'],
};
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

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return jsonResp({ error: 'method not allowed' }, 405, {});
  if (!(await keyOk(request.headers.get('x-routine-key') || '', env.ROUTINE_KEY))) return jsonResp({ error: 'forbidden' }, 403, {});
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
    return jsonResp({ ok: false, error: 'unknown op' }, 400, {});
  } catch (e) {
    return jsonResp({ ok: false, error: String(e && e.message || e).slice(0, 200) }, 200, {});
  }
}
