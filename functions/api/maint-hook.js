// The link to the factory maintenance app ("moked ahzaka", an in-house Cloudflare Worker of the plant engineer).
// 19/11/2026, Michael: hazards I report should open there as tickets (questionnaire: only maintenance and electricity,
// at once when the hazard is written, and a ticket closed there leaves the hazard open here until I check on site).
//
// Two callers, one file:
//   1. our own server (hazard-file.js, which every change of tour_hazards and the 15-minute tick already call), with
//      x-notify-secret and {op:'push'}: opens a ticket for every new open hazard of maintenance or electricity.
//   2. the maintenance app, when a ticket is closed: POST of {ext_id, status, action_taken, handled_by, closed_at},
//      signed with HMAC-SHA256 over the raw body (hex, in MAINT_HOOK_HEADER or x-signature, "sha256=" allowed).
//
// Off until the secrets exist: MAINT_API_KEY (push) and MAINT_HOOK_SECRET (the way back). Nothing is sent and
// nothing is accepted without them. The key is sent only to MAINT_URL (a constant here, not from the request).
// State (server_state, no schema change): maint_from = the first day whose hazards are sent (set on the first run,
// so the open backlog is not poured into the ticket app), maint_sent = {"<hazard id>": {at, ticket}} (written by the
// push only) and maint_closed = {"<hazard id>": at} (written by the way back only, under its own lease, so a long push
// never turns a closing away; security review 19/11/2026).
import { jsonResp, secretOk, sbFrom, tmo, SB_TIMEOUT_MS as SB_MS } from '../_shared.js';
import { stateGet, stateSet, runLeased } from '../_onedrive.js';
import { respKey } from './hazard-report.js';
import { ownerWa, sendToOwner, hmacHex, ownerWindowOpen } from '../_wa.js';

export const MAINT_URL = 'https://maint.shlomi-5da.workers.dev/api/ext/req';
export const MAINT_KEYS = ['\u05d0\u05d7\u05d6\u05e7\u05d4', '\u05d7\u05e9\u05de\u05dc'];
const S_OPEN = '\u05e4\u05ea\u05d5\u05d7';
const ID_RE = /^th-[0-9a-z]{1,24}$/;
const MAX_PER_RUN = 10, MAX_SENT = 600, MAX_BODY = 20000, PUSH_MS = 10000;
const DAY_RE = /^\d{4}-\d{2}-\d{2}/, FROM_RE = /^\d{4}-\d{2}-\d{2}$/;
// The way back acts only on a closing; any other status of a ticket (assigned, in work) is acknowledged and left.
const CLOSED_RE = /^(closed?|done|resolved|completed|\u05e1\u05d2\u05d5\u05e8\u05d4?|\u05e0\u05e1\u05d2\u05e8\u05d4?|\u05d8\u05d5\u05e4\u05dc\u05d4?|\u05d1\u05d5\u05e6\u05e2\u05d4?)$/i;
export const isClosing = (st) => st === undefined || st === null || st === '' || CLOSED_RE.test(String(st).trim());
const clean = (x, n) => String(x == null ? '' : x).replace(/[\u0000-\u0008\u000b-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, ' ').replace(/[ \t]+/g, ' ').trim().slice(0, n);
const ilDay = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(d);
const dmy = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; };

// Is this hazard maintenance's or electricity's? "A + B" in resp, and resp2. Pure.
export function isMaint(row) {
  return ['resp', 'resp2'].some((f) => String((row && row[f]) || '').split(/\s*\+\s*/).some((x) => MAINT_KEYS.indexOf(respKey(x)) >= 0));
}
// The ticket of one hazard, or null when it must not go (closed, another party, before the first day, bad id). Pure.
export function ticketOf(row, from) {
  if (!row || !ID_RE.test(String(row.id || '')) || row.s !== S_OPEN || !isMaint(row)) return null;
  if (!DAY_RE.test(String(row.d || '')) || !from || String(row.d).slice(0, 10) < from) return null;
  let descr = clean(row.descr, 900);
  const action = clean(row.action, 300);
  if (action) descr += '\n\u05e0\u05d3\u05e8\u05e9: ' + action;
  if (descr.replace(/\s/g, '').length < 10) descr = '\u05dc\u05d9\u05e7\u05d5\u05d9 \u05d1\u05d8\u05d9\u05d7\u05d5\u05ea: ' + (descr || '\u05dc\u05dc\u05d0 \u05ea\u05d9\u05d0\u05d5\u05e8');
  const t = { ext_id: row.id, description: descr, location: clean(row.loc, 200) || clean(row.dept, 100) || '\u05dc\u05d0 \u05e6\u05d5\u05d9\u05df' };
  if (clean(row.dept, 100)) t.department = clean(row.dept, 100);
  if (clean(row.sev, 20)) t.severity = clean(row.sev, 20);
  if (clean(row.resp, 80)) t.owner = clean(row.resp, 80);
  if (DAY_RE.test(String(row.due || ''))) t.due_date = String(row.due).slice(0, 10);
  return t;
}
// A photo goes only as a public link of our own storage (never a signed or foreign address). Pure.
export function photoOf(row, sbUrl) {
  const u = String((row && row.photo_url) || '');
  return sbUrl && u.indexOf(sbUrl + '/storage/v1/object/public/') === 0 && u.length < 500 ? u : null;
}
// The signature of the way back: hex HMAC-SHA256 of the raw body, compared as digests in constant time. Pure but for crypto.
export async function sigOk(secret, raw, header) {
  const got = String(header || '').trim().toLowerCase().replace(/^sha256=/, '');
  if (!secret || !/^[0-9a-f]{64}$/.test(got)) return false;
  return secretOk(got, await hmacHex(secret, raw));
}
function parseMap(v) { try { const j = JSON.parse(v || '{}'); return j && typeof j === 'object' && !Array.isArray(j) ? j : {}; } catch (e) { return {}; } }
function trimMap(m) {
  const ks = Object.keys(m);
  if (ks.length <= MAX_SENT) return m;
  ks.sort((a, b) => String(m[a].at).localeCompare(String(m[b].at)));
  ks.slice(0, ks.length - MAX_SENT).forEach((k) => { delete m[k]; });
  return m;
}
const sbH = (env) => ({ apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY, 'Content-Type': 'application/json' });
async function tellOwner(env, sb, text) {
  try { const to = await ownerWa(env, sb); if (to) await sendToOwner(env, to, text, { kind: 'agent', windowOpen: await ownerWindowOpen(env, sb) }); } catch (e) {}
}

// Open a ticket for every hazard that is due one. Returns counts only.
export async function pushNew(env, now) {
  if (!env.MAINT_API_KEY) return { ok: true, off: true };
  const sb = sbFrom(env);
  const st = await stateGet(env, ['maint_from', 'maint_sent', 'maint_err'], true);
  let from = st.maint_from && st.maint_from.value;
  if (!FROM_RE.test(String(from || ''))) { from = ilDay(now || new Date()); await stateSet(env, { maint_from: from }); }
  const sent = parseMap(st.maint_sent && st.maint_sent.value);
  const r = await fetch(sb + '/rest/v1/tour_hazards?select=id,n,d,dept,loc,descr,sev,resp,resp2,action,due,s,photo_url&s=eq.' + encodeURIComponent(S_OPEN) + '&d=gte.' + from + '&order=n.asc&limit=500', { headers: sbH(env), signal: tmo(SB_MS) });
  if (!r.ok) return { ok: false, error: 'read ' + r.status };
  const due = (await r.json()).filter((x) => !sent[x.id] && ticketOf(x, from)).slice(0, MAX_PER_RUN);
  let opened = 0, failed = 0, last = '';
  for (const row of due) {
    const t = ticketOf(row, from), ph = photoOf(row, sb);
    if (ph) t.photo_url = ph;
    try {
      const w = await fetch(MAINT_URL, { method: 'POST', redirect: 'error', headers: { 'Content-Type': 'application/json', 'X-Api-Key': env.MAINT_API_KEY }, body: JSON.stringify(t), signal: tmo(PUSH_MS) });
      if (!w.ok) { failed++; last = 'HTTP ' + w.status; continue; }
      let j = null; try { j = JSON.parse((await w.text()).slice(0, 2000)); } catch (e) { j = null; }
      const ticket = j && typeof j === 'object' ? clean(j.id != null ? j.id : j.req_id != null ? j.req_id : j.number != null ? j.number : '', 40) : '';
      sent[row.id] = { at: (now || new Date()).toISOString(), ticket: ticket || null };
      opened++;
    } catch (e) { failed++; last = clean((e && e.message) || e, 80); }
  }
  const prev = parseMap(st.maint_err && st.maint_err.value), set = {};
  if (opened) set.maint_sent = JSON.stringify(trimMap(sent));
  if (failed) {
    const n = (+prev.n || 0) + 1;
    set.maint_err = JSON.stringify({ n, at: (now || new Date()).toISOString(), msg: last });
    // the third failed run in a row, once: Michael hears that tickets are not opening
    if (n === 3) await tellOwner(env, sb, '\u05d4\u05d7\u05d9\u05d1\u05d5\u05e8 \u05dc\u05de\u05d5\u05e7\u05d3 \u05d4\u05d0\u05d7\u05d6\u05e7\u05d4 \u05dc\u05d0 \u05e2\u05d5\u05d1\u05d3: \u05e9\u05dc\u05d5\u05e9 \u05e4\u05e2\u05de\u05d9\u05dd \u05d1\u05e8\u05e6\u05e3 \u05dc\u05d0 \u05e0\u05e4\u05ea\u05d7\u05d4 \u05e7\u05e8\u05d9\u05d0\u05d4 \u05dc\u05dc\u05d9\u05e7\u05d5\u05d9 (' + last + '). \u05d4\u05dc\u05d9\u05e7\u05d5\u05d9\u05d9\u05dd \u05e9\u05de\u05d5\u05e8\u05d9\u05dd \u05d0\u05e6\u05dc\u05e0\u05d5 \u05d5\u05d9\u05d9\u05e9\u05dc\u05d7\u05d5 \u05db\u05e9\u05d4\u05de\u05d5\u05e7\u05d3 \u05d9\u05d7\u05d6\u05d5\u05e8.');
  } else if (prev.n) set.maint_err = JSON.stringify({ n: 0 });
  if (Object.keys(set).length) await stateSet(env, set);
  return { ok: !failed, opened, failed, waiting: Math.max(0, due.length - opened - failed) };
}

// A ticket was closed in the maintenance app. The hazard stays open: a note on the row and a message to Michael.
export async function closedThere(env, b, now) {
  const id = String((b && b.ext_id) || '');
  if (!ID_RE.test(id)) return { status: 400, body: { ok: false, error: 'bad ext_id' } };
  const sb = sbFrom(env);
  if (!isClosing(b.status)) return { status: 200, body: { ok: true } };
  const st = await stateGet(env, ['maint_sent', 'maint_closed'], true);
  const sent = parseMap(st.maint_sent && st.maint_sent.value), closed = parseMap(st.maint_closed && st.maint_closed.value);
  // only a ticket we opened; an unknown id is answered the same as a known one that is done, so ids cannot be probed
  if (!sent[id] || closed[id]) return { status: 200, body: { ok: true } };
  const r = await fetch(sb + '/rest/v1/tour_hazards?select=id,n,loc,dept,s,notes&id=eq.' + encodeURIComponent(id), { headers: sbH(env), signal: tmo(SB_MS) });
  if (!r.ok) return { status: 503, body: { ok: false, error: 'try again' } };
  const row = (await r.json())[0];
  const action = clean(b.action_taken, 300), by = clean(b.handled_by, 60), day = dmy(ilDay(now || new Date()));
  const mark = '\u05de\u05d5\u05e7\u05d3 \u05d0\u05d7\u05d6\u05e7\u05d4 ';
  // a note of ours already on the row = an earlier try wrote it and only the mark was lost: no second note or message
  if (row && row.s === S_OPEN && String(row.notes || '').indexOf(mark) < 0) {
    const line = mark + day + ': \u05d4\u05e7\u05e8\u05d9\u05d0\u05d4 \u05e0\u05e1\u05d2\u05e8\u05d4' + (action ? '. \u05d1\u05d5\u05e6\u05e2: ' + action : '') + (by ? ' (' + by + ')' : '') + '. \u05de\u05de\u05ea\u05d9\u05df \u05dc\u05d1\u05d3\u05d9\u05e7\u05d4 \u05d1\u05e9\u05d8\u05d7';
    const notes = (String(row.notes || '').trim() ? String(row.notes).trim() + '\n' : '') + line;
    const w = await fetch(sb + '/rest/v1/tour_hazards?id=eq.' + encodeURIComponent(id) + '&s=eq.' + encodeURIComponent(S_OPEN), { method: 'PATCH', headers: { ...sbH(env), Prefer: 'return=minimal' }, body: JSON.stringify({ notes }), signal: tmo(SB_MS) });
    if (!w.ok) return { status: 503, body: { ok: false, error: 'try again' } };
    await tellOwner(env, sb, '\u05de\u05d5\u05e7\u05d3 \u05d4\u05d0\u05d7\u05d6\u05e7\u05d4 \u05e1\u05d2\u05e8 \u05e7\u05e8\u05d9\u05d0\u05d4 \u05e2\u05dc \u05dc\u05d9\u05e7\u05d5\u05d9 ' + (row.n != null ? row.n : '') + ' (' + (clean(row.loc, 80) || clean(row.dept, 60)) + ').' + (action ? '\n\u05d1\u05d5\u05e6\u05e2: ' + action : '') + (by ? '\n\u05d8\u05d9\u05e4\u05dc: ' + by : '') + '\n\u05d4\u05dc\u05d9\u05e7\u05d5\u05d9 \u05e0\u05e9\u05d0\u05e8 \u05e4\u05ea\u05d5\u05d7 \u05d0\u05e6\u05dc\u05da \u05e2\u05d3 \u05e9\u05ea\u05d1\u05d3\u05d5\u05e7 \u05d1\u05e9\u05d8\u05d7.');
  }
  closed[id] = (now || new Date()).toISOString();
  const ks = Object.keys(closed);
  if (ks.length > MAX_SENT) ks.sort((a, c) => String(closed[a]).localeCompare(String(closed[c]))).slice(0, ks.length - MAX_SENT).forEach((k) => { delete closed[k]; });
  await stateSet(env, { maint_closed: JSON.stringify(closed) });
  return { status: 200, body: { ok: true } };
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return jsonResp({ error: 'method not allowed' }, 405, {});
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return jsonResp({ error: 'server misconfigured' }, 500, {});
  if (+(request.headers.get('content-length') || 0) > MAX_BODY) return jsonResp({ error: 'too large' }, 413, {});
  const raw = (await request.text()).slice(0, MAX_BODY + 1);
  if (raw.length > MAX_BODY) return jsonResp({ error: 'too large' }, 413, {});
  // 1. our own server
  if (request.headers.get('x-notify-secret')) {
    const want = env.TRUSTEE_NOTIFY_SECRET;
    if (!want || !(await secretOk(request.headers.get('x-notify-secret'), want))) return jsonResp({ error: 'forbidden' }, 403, {});
    try { return jsonResp((await runLeased(env, 'maint_push', 120000, () => pushNew(env, new Date()))) || { ok: true }, 200, {}); }
    catch (e) { return jsonResp({ ok: false, error: 'push failed' }, 200, {}); }
  }
  // 2. the maintenance app
  if (!env.MAINT_HOOK_SECRET) return jsonResp({ error: 'not configured' }, 503, {});
  let hdr = String(env.MAINT_HOOK_HEADER || 'x-signature').toLowerCase();
  if (!/^[a-z0-9-]{3,40}$/.test(hdr) || hdr === 'x-notify-secret') hdr = 'x-signature';
  if (!(await sigOk(env.MAINT_HOOK_SECRET, raw, request.headers.get(hdr)))) return jsonResp({ error: 'forbidden' }, 403, {});
  let b = null; try { b = JSON.parse(raw); } catch (e) { b = null; }
  if (!b || typeof b !== 'object' || Array.isArray(b)) return jsonResp({ ok: false, error: 'bad json' }, 400, {});
  try { const out = await runLeased(env, 'maint_close', 30000, () => closedThere(env, b, new Date())); return out && out.status ? jsonResp(out.body, out.status, {}) : jsonResp({ ok: false, error: 'try again' }, 503, {}); }
  catch (e) { return jsonResp({ ok: false, error: 'try again' }, 503, {}); }
}
