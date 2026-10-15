// Cloudflare Pages Function — a hazard report → WhatsApp (+ email) to the
// safety officer, server-side, so it lands even when the app is closed.
//
// Two sources, because on the floor they are the same event: something that
// is about to hurt somebody. A trustee's ליקוי comes from trustee_reports; a
// כמעט ונפגע comes from near_miss and can be filed by anyone, which is
// exactly why it used to reach nobody until the manager next opened the app.
// Michael on 2026-09-21: "שלא יצא מצב שכמה אנשים מעלים ומגלים מאוחר".
//
// Both notify the SAME recipient, the one saved under `trustee_hazard` in
// notification_prefs, so there is one phone number and one address to fill in
// rather than two.
//
// Callers:
//   1. A Supabase database trigger (pg_net) after INSERT:
//        trustee_reports, ok=false → POST {"id":"<id>"}
//        near_miss, any row        → POST {"id":"<id>","src":"near_miss"}
//      `src` is absent on the older trigger and defaults to trustee_reports.
//   2. The app's notification settings, "send a test":
//                                 POST /api/trustee-notify   {"test":true, ...}
//      with a Supabase session in `Authorization: Bearer` (same gate as wa-send).
//
// Trust model for (1): TRUSTEE_NOTIFY_SECRET is required (02/10/2026; before
// that it was optional and a missing secret left the path open). The DB
// trigger sends it as the x-notify-secret header. On top of it: the row must
// exist, be a hazard, be recent and not yet notified (notified_at is claimed
// atomically, so each hazard notifies once), and the recipient comes from the
// manager's own settings row in notification_prefs, never from the request.
//
// Env: SUPABASE_SERVICE_ROLE_KEY (required), META_PHONE_NUMBER_ID +
// META_ACCESS_TOKEN (WhatsApp), RESEND_KEY (+ optional RESEND_FROM) for email.

import { defaultAllowedOrigins, corsHeaders, jsonResp, requireRole } from '../_shared.js';
import { odConfigured, tokenRow, hasMail, accessToken, sendMail, stateGet, stateSet, runLeased } from '../_onedrive.js';
import { makeCloseToken, closeUrl } from '../_closelink.js';

const SUPABASE_URL = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const META_API_VERSION = 'v25.0';
const APP_URL = 'https://tapugan-safety.pages.dev';
const PREFS_ID = 'admin@tfugen.local';
const EVENT = 'trustee_hazard';
const MAX_AGE_MS = 48 * 3600 * 1000;
// Retrying (29/09/2026, upgrade review 10): one attempt used to be all a
// hazard got. The 15-minute tick (hazard-file.js) calls op:'retry': a hazard
// the trigger never delivered (notified_at still null) is sent, and one whose
// every channel failed is tried again, up to MAX_TRIES in all; then a
// 'notify_failed' line in notifications_log puts it on the app's home screen.
const FAIL_KEY = 'notify_fail', MAX_TRIES = 3, RETRY_MS = 14 * 60 * 1000, MAX_RETRY_RUN = 5, SETTLE_MS = 3 * 60 * 1000;
// Deadlines and a subrequest budget (15/10/2026, review: "no data that disappears").
// Every outbound call has a deadline, so one hanging call cannot hold a run
// until the platform cuts it. A call from _onedrive.js cannot take our signal,
// so it is raced against the same deadline instead.
const DB_MS = 10000, NET_MS = 20000;
function tfetch(url, init, ms) { return fetch(url, Object.assign({}, init || {}, { signal: AbortSignal.timeout(ms) })); }
function within(p, ms, what) {
  let t;
  return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(new Error((what || 'call') + ' timeout')), ms); })]).finally(() => clearTimeout(t));
}
// One request may make 50 subrequests on the free plan and the 51st throws
// (the same limit as hazard-file.js subBudget). The sweep counts what it spends
// and stops before a hazard it might not finish; the rest go on the next tick.
const SUB_LIMIT = 50;
function subBudget(limit) {
  return { limit: limit || SUB_LIMIT, used: 0, spend(n) { this.used += n; return this; }, left() { return this.limit - this.used; } };
}
const spend = (B, n) => { if (B) B.spend(n); };
// The lease (runLeased): lock 2, unlock 1, mark checks 2, and once more
// (lock 2, unlock 1, checks 2) when a mark arrives at the end.
const LEASE_COST = 10, LEASE_MS = 60000;
// The worst one hazard costs: claim 1, day count 2, task name 1, WhatsApp 2,
// photo link 1, Outlook 6 (token read, refresh 4, send), Resend 1, log 1,
// failure log 1, fail map 1, row read 1. The cap notice instead of the row
// costs less (state 2, notice 10, log 1).
const HAZARD_MAX = 18;
// A row claimed this long ago with no log line and no failure noted: the run
// that claimed it was cut before it sent (pg_net hangs up at 8s; waitUntil ends
// at 30s). The sweep sends it again.
const STALE_CLAIM_MS = 5 * 60 * 1000, STALE_LIMIT = 200;
const anySent = (res) => !!res && (res.whatsapp === 'sent' || res.email === 'sent');
// Daily ceiling (30/09/2026, upgrade review 18, Michael chose 15): after 15
// hazards claimed since midnight Israel time, the 16th sends ONE notice
// instead of itself ("from now until tomorrow, only in the app") and the rest
// of the day sends nothing. The rows are saved and reach the file as always;
// only the phone stops ringing. Real use so far: at most 2 in a day. The
// insert ceiling for anonymous sessions is in migrations/2026-09-30_anon_write_cap.sql.
const DAILY_CAP = 15, CAP_KEY = 'notify_cap_day';
// The template this system is meant to send on. Until it exists and is
// approved in Meta, the approved incident template carries the message -- and
// carries it badly: its fixed text reads «🚨 תקרית בטיחות ... נא לטפל מיידית»,
// which is a road accident, not a fire extinguisher missing a seal. Michael saw
// the first one on 2026-09-21 and said so. project-files/WHATSAPP-TEMPLATE.md
// is the text to submit; the moment it is approved this code uses it with no
// further change.
const TEMPLATE_DEDICATED = 'tfugen_safety_report';
const TEMPLATE_FALLBACK = 'tfugen_incident_alert';
// The built-in catalogue, and the fallback. Once migrations/2026-09-19_trustee_tasks.sql
// has run the manager can rename a task from the app — and the message that
// went out still carried this wording. taskName() reads the table first.
const TASKS = {
  1: '\u05e1\u05d9\u05d5\u05e8 \u05de\u05e4\u05d2\u05e2\u05d9\u05dd \u05d1\u05d0\u05d6\u05d5\u05e8', 2: '\u05de\u05e7\u05dc\u05d7\u05d5\u05ea \u05d7\u05d9\u05e8\u05d5\u05dd \u05d5\u05e9\u05d8\u05d9\u05e4\u05d5\u05ea \u05e2\u05d9\u05e0\u05d9\u05d9\u05dd', 3: '\u05d3\u05e8\u05db\u05d9 \u05de\u05d9\u05dc\u05d5\u05d8 \u05d5\u05d9\u05e6\u05d9\u05d0\u05d5\u05ea \u05d7\u05d9\u05e8\u05d5\u05dd',
  4: '\u05ea\u05e7\u05d9\u05e0\u05d5\u05ea \u05e1\u05d5\u05dc\u05de\u05d5\u05ea \u05d5\u05d2\u05d9\u05e9\u05d4 \u05dc\u05d2\u05d5\u05d1\u05d4', 5: '\u05e2\u05de\u05d3\u05d5\u05ea \u05db\u05d9\u05d1\u05d5\u05d9 \u05d0\u05e9', 6: '\u05de\u05d2\u05d9\u05e0\u05d9 \u05de\u05db\u05d5\u05e0\u05d5\u05ea \u05d5\u05dc\u05d7\u05e6\u05e0\u05d9 \u05e2\u05e6\u05d9\u05e8\u05d4',
  7: '\u05e2\u05d6\u05e8\u05d4 \u05e8\u05d0\u05e9\u05d5\u05e0\u05d4 \u05d5\u05e6\u05d9\u05d5\u05d3 \u05de\u05d2\u05df', 8: '\u05de\u05e2\u05e7\u05d1 \u05e1\u05d2\u05d9\u05e8\u05d4'
};

// The two tables, and everything that differs between them. Anything the rest
// of the file needs per-source lives here, so adding a third source later is a
// table entry rather than a hunt through the delivery code.
const SOURCES = {
  trustee_reports: {
    select: 'id,u,t,d,loc,f,ok,s,photo_url,ts,received_at,notified_at',
    // Only a ליקוי is a hazard. A clean check is the trustee doing the job.
    skipReason: (r) => (r.ok === false ? null : 'not a hazard'),
    // One shape for the delivery code: who reported, where, what.
    // A finding already closed when the alert goes out was fixed on the spot
    // (BACKLOG 4.13: the form saves it closed). Said up front, so the manager
    // does not go looking for an open hazard.
    norm: (r) => (r.s === '\u05e0\u05e1\u05d2\u05e8' ? Object.assign({}, r, { f: '✅ \u05ea\u05d5\u05e7\u05df \u05d1\u05de\u05e7\u05d5\u05dd: ' + (r.f || '') }) : r),
    event: 'trustee_hazard',
    emoji: '🦺',
    title: '\u05dc\u05d9\u05e7\u05d5\u05d9 \u05d7\u05d3\u05e9 \u05de\u05e0\u05d0\u05de\u05df \u05d1\u05d8\u05d9\u05d7\u05d5\u05ea',
    subject: '\u05dc\u05d9\u05e7\u05d5\u05d9 \u05de\u05e0\u05d0\u05de\u05df \u05d1\u05d8\u05d9\u05d7\u05d5\u05ea',
    whoLabel: '\u05e0\u05d0\u05de\u05df',
    lineLabel: '\u05de\u05e9\u05d9\u05de\u05d4',
    // The task number reads naturally in front of its name, and only there.
    lineText: (row, line) => (row.t ? esc(row.t) + '. ' : '') + esc(line),
    kindLabel: (row, line) => '\u05dc\u05d9\u05e7\u05d5\u05d9 \u05d1\u05e1\u05d9\u05d5\u05e8 \u05e0\u05d0\u05de\u05df: ' + line,
    footer: '\u05e0\u05e9\u05dc\u05d7 \u05d0\u05d5\u05d8\u05d5\u05de\u05d8\u05d9\u05ea \u05db\u05e9\u05e0\u05d0\u05de\u05df \u05e9\u05d5\u05de\u05e8 \u05dc\u05d9\u05e7\u05d5\u05d9. \u05d1\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4: \u05de\u05d5\u05d3\u05d5\u05dc\u05d9\u05dd > \u05e0\u05d0\u05de\u05e0\u05d9 \u05d1\u05d8\u05d9\u05d7\u05d5\u05ea',
  },
  near_miss: {
    select: 'id,rep,descr,area,sev,typ,d,s,photo_url,ts,received_at,notified_at',
    // Every near-miss is worth knowing about the moment it is filed. There is
    // no "clean" near-miss to filter out.
    skipReason: () => null,
    norm: (r) => ({ ...r, u: r.rep || '\u05dc\u05d0 \u05e6\u05d5\u05d9\u05df', loc: r.area || '', f: r.descr || '', t: '' }),
    event: 'near_miss',
    emoji: '⛔',
    title: '\u05d3\u05d9\u05d5\u05d5\u05d7 \u05d7\u05d3\u05e9: \u05db\u05de\u05e2\u05d8 \u05d5\u05e0\u05e4\u05d2\u05e2',
    subject: '\u05db\u05de\u05e2\u05d8 \u05d5\u05e0\u05e4\u05d2\u05e2',
    whoLabel: '\u05de\u05d3\u05d5\u05d5\u05d7',
    lineLabel: '\u05d7\u05d5\u05de\u05e8\u05d4 / \u05e1\u05d5\u05d2',
    lineText: (row, line) => esc(line),
    kindLabel: (row, line) => '\u05db\u05de\u05e2\u05d8 \u05d5\u05e0\u05e4\u05d2\u05e2' + (row.sev ? ', \u05d7\u05d5\u05de\u05e8\u05d4 ' + row.sev : ''),
    footer: '\u05e0\u05e9\u05dc\u05d7 \u05d0\u05d5\u05d8\u05d5\u05de\u05d8\u05d9\u05ea \u05db\u05e9\u05e0\u05e9\u05de\u05e8 \u05d3\u05d9\u05d5\u05d5\u05d7 \u05db\u05de\u05e2\u05d8 \u05d5\u05e0\u05e4\u05d2\u05e2. \u05d1\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4: \u05de\u05d5\u05d3\u05d5\u05dc\u05d9\u05dd > \u05db\u05de\u05e2\u05d8 \u05d5\u05e0\u05e4\u05d2\u05e2',
  },
};

// Meta rejects parameters with newlines / tabs / long runs of spaces.
function clean(s, max) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().substring(0, max || 200); }
// DD/MM/YYYY (Michael, 29/09/2026: dates he reads are in the Hebrew order).
// d is a date column, YYYY-MM-DD; anything else is shown as it came.
function dmy(d) { const m = String(d == null ? '' : d).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '/' + m[2] + '/' + m[1] : String(d == null ? '' : d); }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

export async function onRequest(context) {
  const { request, env } = context;
  const allowed = defaultAllowedOrigins(env);
  const origin = request.headers.get('origin') || '';
  const cors = corsHeaders(origin, allowed, 'POST,OPTIONS');

  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  // Read-only probe (25/09): is the shared secret configured on this deployment?
  // A boolean only, so the env can be checked from a phone browser after a deploy.
  if (request.method === 'GET' && new URL(request.url).searchParams.get('probe') === '1') {
    return jsonResp({ ok: true, secret_configured: !!env.TRUSTEE_NOTIFY_SECRET }, 200, cors);
  }
  if (request.method !== 'POST') return jsonResp({ error: 'method not allowed' }, 405, cors);

  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return jsonResp({ error: 'server misconfigured: missing SUPABASE_SERVICE_ROLE_KEY' }, 500, cors);

  let body;
  try { body = await request.json(); }
  catch (e) { return jsonResp({ error: 'invalid json' }, 400, cors); }
  body = body && typeof body === 'object' ? body : {};

  const sb = mkSb(serviceKey);

  // ---- (2) test message from the settings screen: needs a logged-in session ----
  if (body.test === true) {
    // Same hole as wa-send: this path takes an attacker-chosen recipient and
    // sends through Meta AND Resend. An anonymous kiosk token must not reach it,
    // and (2026-09-24 review) neither may a reporter -- sending a test to any
    // recipient is a manager action. Only admin/manager.
    const who = await requireRole(request, env, ['admin', 'manager']);
    if (!who.ok) return jsonResp({ error: who.error }, who.status, cors);
    // The test uses what the screen holds right now (the prefs row may not be saved yet).
    const prefs = {
      whatsapp: body.whatsapp !== false, whatsapp_to: clean(body.whatsapp_to, 20).replace(/[^0-9]/g, ''),
      email: body.email !== false, email_to: clean(body.email_to, 120)
    };
    if (!prefs.whatsapp_to && !prefs.email_to) return jsonResp({ error: 'no recipient: fill a WhatsApp number or an email' }, 400, cors);
    const sample = { id: 'test', u: '\u05d1\u05d3\u05d9\u05e7\u05d4', t: 5, d: ilDay(Date.now()), loc: '\u05de\u05d7\u05e1\u05df, \u05de\u05d8\u05e3 \u05de\u05d6\u05e8\u05d7\u05d9', f: '\u05d4\u05d5\u05d3\u05e2\u05ea \u05d1\u05d3\u05d9\u05e7\u05d4 - \u05de\u05d8\u05e3 \u05dc\u05dc\u05d0 \u05e4\u05dc\u05d5\u05de\u05d1\u05d4', photo_url: null };
    const res = await deliver(env, prefs, sample, await taskName(sb, sample.t), SOURCES.trustee_reports);
    return jsonResp({ ok: true, test: true, ...res }, 200, cors);
  }

  // ---- (1) a real hazard, referenced by id ----
  // Fail closed (02/10/2026): no secret on the deployment = nobody gets in.
  // Until then a missing secret left this path open to anyone. The secret has
  // been set since 25/09 (?probe=1), so the live behaviour does not change.
  if (!env.TRUSTEE_NOTIFY_SECRET || request.headers.get('x-notify-secret') !== env.TRUSTEE_NOTIFY_SECRET) {
    return jsonResp({ error: 'forbidden' }, 403, cors);
  }
  if (body.op === 'retry') {
    return jsonResp(await retrySweep(env, serviceKey), 200, cors);
  }
  const id = clean(body.id, 64);
  if (!id || /[^A-Za-z0-9_-]/.test(id)) return jsonResp({ error: 'id required' }, 400, cors);
  // The table name reaches the query string, so it is picked from the map by
  // key and never taken from the request as text.
  const srcKey = clean(body.src, 32) || 'trustee_reports';
  const src = Object.prototype.hasOwnProperty.call(SOURCES, srcKey) ? SOURCES[srcKey] : null;
  if (!src) return jsonResp({ error: 'unknown src' }, 400, cors);

  const rowResp = await sb(srcKey + '?id=eq.' + encodeURIComponent(id) + '&select=' + src.select);
  if (!rowResp.ok) return jsonResp({ error: 'db read failed', status: rowResp.status }, 502, cors);
  const rows = await rowResp.json();
  const raw = Array.isArray(rows) ? rows[0] : null;
  if (!raw) return jsonResp({ error: 'not found' }, 404, cors);
  const skip = src.skipReason(raw);
  if (skip) return jsonResp({ ok: true, skipped: skip }, 200, cors);
  if (raw.notified_at) return jsonResp({ ok: true, skipped: 'already notified' }, 200, cors);
  // The age counts from when the server got the report (received_at, 15/10/2026),
  // not from the phone's clock: a report that waited days in the phone's queue,
  // or a phone set to a wrong date, still reaches the manager.
  const age = Date.now() - Date.parse(raw.received_at || raw.ts || 0);
  if (!(age < MAX_AGE_MS)) return jsonResp({ ok: true, skipped: 'too old' }, 200, cors);
  const row = src.norm(raw);

  const prefs = await loadPrefs(sb);
  if (!(prefs.whatsapp && prefs.whatsapp_to) && !(prefs.email && prefs.email_to)) {
    return jsonResp({ ok: true, skipped: 'no recipient configured' }, 200, cors);
  }

  // Claim the row: only the caller whose PATCH flips notified_at from null sends.
  const claim = await sb(srcKey + '?id=eq.' + encodeURIComponent(id) + '&notified_at=is.null', {
    method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ notified_at: new Date().toISOString() })
  });
  const claimed = claim.ok ? await claim.json() : [];
  if (!Array.isArray(claimed) || !claimed.length) return jsonResp({ ok: true, skipped: 'already notified' }, 200, cors);
  // From here the row is ours, and nothing else will send it until the sweep
  // finds it. pg_net hangs up at 8s (migrations/2026-09-25_notify_secret_header.sql),
  // so the trigger gets its answer now and the sending goes on in waitUntil
  // (15/10/2026). A run cut even so leaves a claimed row with no log line,
  // and the sweep's stale-claim pass sends it again.
  const work = async () => {
    const capped = await capGate(env, sb, prefs, src, row);
    if (capped) return { skipped: capped };
    const task = await lineFor(sb, src, row);
    const res = await deliver(env, prefs, row, task, src);
    await logDelivery(sb, src, row, task, res);
    if (!anySent(res)) {
      try { const m = await failGet(env); await noteFail(sb, m, srcKey, src, row, task, res); await sSet(env, { [FAIL_KEY]: JSON.stringify(m) }); } catch (e) { /* the retry sweep also finds it by its log */ }
    }
    return res;
  };
  if (typeof context.waitUntil === 'function') {
    context.waitUntil(work().catch(() => {}));
    return jsonResp({ ok: true, accepted: true, id }, 202, cors);
  }
  return jsonResp({ ok: true, ...(await work()) }, 200, cors);
}

// Supabase REST with the service key and a deadline; with a budget, each call is counted.
function mkSb(serviceKey, B) {
  return (path, init) => { spend(B, 1); return tfetch(SUPABASE_URL + '/rest/v1/' + path, {
    ...(init || {}),
    headers: { apikey: serviceKey, Authorization: 'Bearer ' + serviceKey, 'Content-Type': 'application/json', ...((init && init.headers) || {}) }
  }, DB_MS); };
}
// server_state through _onedrive.js, with a deadline and counted.
function sGet(env, keys, B, strict) { spend(B, 1); return within(stateGet(env, keys, strict), DB_MS, 'state read'); }
function sSet(env, obj, B) { spend(B, 1); return within(stateSet(env, obj), DB_MS, 'state write'); }

function titleOf(row, task) { return clean((row.u || '') + ' - ' + task + (row.f ? ': ' + row.f : ''), 120); }
async function logRows(sb, rows) {
  if (!rows.length) return;
  try {
    await sb('notifications_log', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(rows.map((l) => Object.assign({
      id: 'tn' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), user_email: 'server', ts: new Date().toISOString() }, l))) });
  } catch (e) { /* the message went out; a missing log line is not worth a failure */ }
}
async function logDelivery(sb, src, row, task, res) {
  const title = titleOf(row, task), logs = [];
  if (res.whatsapp) logs.push({ channel: res.whatsapp === 'sent' ? 'whatsapp' : 'whatsapp_error', detail: res.whatsapp });
  if (res.email) logs.push({ channel: res.email === 'sent' ? 'email' : 'email_error', detail: res.email });
  await logRows(sb, logs.map((l) => ({ event_type: src.event, channel: l.channel, payload: { id: row.id, title, detail: l.detail } })));
}
// strict: a failed read throws, so an unread map is never written back as empty.
async function failGet(env, B, strict) {
  const st = await sGet(env, [FAIL_KEY], B, strict).catch((e) => { if (strict) throw e; return {}; });
  try { const m = JSON.parse((st[FAIL_KEY] && st[FAIL_KEY].value) || '{}'); return m && typeof m === 'object' ? m : {}; } catch (e) { return {}; }
}
// One more failed attempt on the map; the third gives up and says so in the log.
async function noteFail(sb, m, srcKey, src, row, task, res) {
  const k = srcKey + ':' + row.id, p = m[k] || {};
  const detail = clean([res.whatsapp, res.email].filter(Boolean).join(' | '), 200);
  const e = { tries: (p.tries || 0) + 1, last: new Date().toISOString(), err: detail, title: titleOf(row, task) };
  if (e.tries >= MAX_TRIES) {
    e.gave_up = true;
    await logRows(sb, [{ event_type: src.event, channel: 'notify_failed', payload: { id: row.id, src: srcKey, title: e.title, detail, tries: e.tries } }]);
  }
  m[k] = e;
}
// The retry sweep, one run at a time (15/10/2026): it is fired from every save
// (hazard-file.js) and from the cron, and two runs at once sent the same alert
// twice and wrote over each other's fail map. A run that finds the lease held
// leaves a mark and the holder goes once more (runLeased, _onedrive.js).
async function retrySweep(env, serviceKey) {
  const B = subBudget(SUB_LIMIT);
  B.spend(LEASE_COST);
  const r = await runLeased(env, 'notify_retry', LEASE_MS, () => sweepOnce(env, serviceKey, B));
  if (r && r.busy) return { ok: true, busy: true, skipped: 'another sweep is running' };
  return r;
}
// A log line that means the row was dealt with: sent on a channel, held back
// by the daily cap (or replaced by its notice), or given up on. Error lines
// alone do not count: a row whose every channel failed and whose fail-map
// entry was not written must still be tried again.
const DONE_CHANNELS = { whatsapp: 1, email: 1, capped: 1, notify_failed: 1 };
async function sweepOnce(env, serviceKey, B) {
  const out = { ok: true, tried: 0, sent: 0, failed: 0, gave_up: 0, resent: 0 };
  // Reads up front (prefs 1, fail map 1, lists 4, log 1), then at least one hazard and the tail.
  if (B.left() < 7 + HAZARD_MAX + 1) { out.deferred = true; return out; }
  const sb = mkSb(serviceKey, B);
  const prefs = await loadPrefs(sb);
  if (!(prefs.whatsapp && prefs.whatsapp_to) && !(prefs.email && prefs.email_to)) return { ok: true, skipped: 'no recipient configured' };
  // Strict: a map that could not be read must not be written back as empty.
  let m;
  try { m = await failGet(env, B, true); } catch (e) { return { ok: false, error: 'fail map read failed' }; }
  const now = Date.now();
  const since = new Date(now - MAX_AGE_MS).toISOString(), until = new Date(now - SETTLE_MS).toISOString();
  // After each hazard (not only at the end): what was sent is never sent again
  // because a later step of this run failed. Read again and merged, so an entry
  // the trigger path wrote meanwhile is kept.
  const persist = async (k) => {
    try {
      const cur = await failGet(env, B, true);
      if (m[k]) cur[k] = m[k]; else delete cur[k];
      await sSet(env, { [FAIL_KEY]: JSON.stringify(cur) }, B);
    } catch (e) { /* the end of the run writes the whole map again */ }
  };
  const one = async (srcKey, raw, mode) => {
    const src = SOURCES[srcKey], k = srcKey + ':' + raw.id;
    if (mode === 'claim') {
      const c = await sb(srcKey + '?id=eq.' + encodeURIComponent(raw.id) + '&notified_at=is.null', { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ notified_at: new Date().toISOString() }) });
      const got = c.ok ? await c.json() : [];
      if (!Array.isArray(got) || !got.length) return;
    }
    // A claimed row that never went out never passed the daily cap either.
    if (mode !== 'retry' && await capGate(env, sb, prefs, src, src.norm(raw), B)) return;
    const row = src.norm(raw), task = await lineFor(sb, src, row);
    const res = await deliver(env, prefs, row, task, src, B);
    out.tried++;
    if (mode === 'stale') out.resent++;
    await logDelivery(sb, src, row, task, res);
    if (anySent(res)) { out.sent++; if (m[k]) { delete m[k]; await persist(k); } return; }
    out.failed++; await noteFail(sb, m, srcKey, src, row, task, res);
    if (m[k].gave_up) out.gave_up++;
    await persist(k);
  };
  // Room for one more hazard at its worst and the final write of the map.
  const room = () => out.tried < MAX_RETRY_RUN && B.left() >= HAZARD_MAX + 1;
  const run = async (srcKey, raw, mode) => {
    if (!room()) { out.deferred = true; return false; }
    try { await one(srcKey, raw, mode); } catch (e) { out.errors = (out.errors || 0) + 1; }
    return true;
  };
  const read = async (q) => { try { const r = await sb(q); const j = r.ok ? await r.json() : []; return Array.isArray(j) ? j : []; } catch (e) { return []; } };
  // 1. never delivered: the trigger's call did not arrive, or failed before the claim.
  const win = '&received_at=gte.' + encodeURIComponent(since) + '&received_at=lte.' + encodeURIComponent(until) + '&order=received_at.asc';
  const lost = (await read('trustee_reports?ok=eq.false&notified_at=is.null' + win + '&limit=' + MAX_RETRY_RUN + '&select=' + SOURCES.trustee_reports.select)).map((r) => ['trustee_reports', r])
    .concat((await read('near_miss?select=' + SOURCES.near_miss.select + '&notified_at=is.null' + win + '&limit=' + MAX_RETRY_RUN)).map((r) => ['near_miss', r]));
  // 3. claimed and never sent: the run that claimed it was cut before it
  // logged anything (15/10/2026). Claimed over 5 minutes ago, no fail-map entry,
  // and no log line that says it was dealt with.
  const stale = '&notified_at=not.is.null&notified_at=lt.' + encodeURIComponent(new Date(now - STALE_CLAIM_MS).toISOString())
    + '&received_at=gte.' + encodeURIComponent(since) + '&order=received_at.asc&limit=' + STALE_LIMIT;
  let claimed = (await read('trustee_reports?ok=eq.false' + stale + '&select=' + SOURCES.trustee_reports.select)).map((r) => ['trustee_reports', r])
    .concat((await read('near_miss?select=' + SOURCES.near_miss.select + stale)).map((r) => ['near_miss', r]))
    .filter(([k, r]) => r && r.id && r.notified_at && !/[^A-Za-z0-9_-]/.test(r.id) && !m[k + ':' + r.id]);
  if (claimed.length) {
    // Strict: a log that cannot be read must not look like "nothing was sent".
    let logs = null;
    try {
      const ids = Array.from(new Set(claimed.map(([, r]) => r.id)));
      const r = await sb('notifications_log?select=event_type,channel,payload&payload->>id=in.(' + ids.map(encodeURIComponent).join(',') + ')&ts=gte.' + encodeURIComponent(since) + '&limit=2000');
      const j = r.ok ? await r.json() : null;
      logs = Array.isArray(j) ? j : null;
    } catch (e) { logs = null; }
    const done = new Set((logs || []).filter((l) => l && l.payload && (DONE_CHANNELS[l.channel] || l.event_type === 'notify_cap')).map((l) => String(l.payload.id)));
    claimed = logs ? claimed.filter(([, r]) => !done.has(String(r.id))) : [];
    if (!logs) out.log_read_failed = true;
  }
  for (const [k, r] of lost) { if (!await run(k, r, 'claim')) break; }
  for (const [k, r] of claimed) { if (!await run(k, r, 'stale')) break; }
  // 2. delivered and failed on every channel: again, 15 minutes apart.
  for (const k of Object.keys(m)) {
    const e = m[k]; if (!e || e.gave_up || now - Date.parse(e.last || 0) < RETRY_MS) continue;
    const [srcKey, id] = [k.split(':')[0], k.split(':').slice(1).join(':')];
    if (!Object.prototype.hasOwnProperty.call(SOURCES, srcKey) || /[^A-Za-z0-9_-]/.test(id)) { delete m[k]; continue; }
    if (!room()) { out.deferred = true; break; }
    const rows = await read(srcKey + '?id=eq.' + encodeURIComponent(id) + '&select=' + SOURCES[srcKey].select);
    if (!rows[0]) { delete m[k]; continue; }
    await run(srcKey, rows[0], 'retry');
  }
  // Given-up entries are kept a week (so a failure is not retried forever), then dropped.
  Object.keys(m).forEach((k) => { if (m[k] && m[k].gave_up && now - Date.parse(m[k].last || 0) > 7 * 86400000) delete m[k]; });
  try { await sSet(env, { [FAIL_KEY]: JSON.stringify(m) }, B); } catch (e) { /* next tick */ }
  out.subrequests = B.used;
  return out;
}

// Midnight Israel time today, as an ISO instant, and today's date there.
function ilDay(now) { return new Date(now).toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }); }
function ilDayStart(now) {
  const wall = Date.parse(new Date(now).toLocaleString('sv-SE', { timeZone: 'Asia/Jerusalem' }).replace(' ', 'T') + 'Z');
  const off = Math.round((wall - now) / 60000) * 60000;
  return new Date(Date.parse(ilDay(now) + 'T00:00:00Z') - off).toISOString();
}
// The one notice that replaces the 16th alert of the day.
const CAP_SRC = {
  event: 'notify_cap', emoji: '🔕', title: '\u05d4\u05e8\u05d1\u05d4 \u05d3\u05d9\u05d5\u05d5\u05d7\u05d9\u05dd \u05d4\u05d9\u05d5\u05dd', subject: '\u05d4\u05d2\u05d1\u05dc\u05ea \u05d4\u05ea\u05e8\u05d0\u05d5\u05ea \u05d9\u05d5\u05de\u05d9\u05ea',
  whoLabel: '\u05de\u05d0\u05ea', lineLabel: '\u05de\u05d4 \u05e7\u05e8\u05d4', lineText: (row, line) => esc(line), kindLabel: () => '\u05d4\u05d2\u05d1\u05dc\u05ea \u05d4\u05ea\u05e8\u05d0\u05d5\u05ea \u05d9\u05d5\u05de\u05d9\u05ea',
  footer: '\u05e0\u05e9\u05dc\u05d7 \u05d0\u05d5\u05d8\u05d5\u05de\u05d8\u05d9\u05ea \u05e4\u05e2\u05dd \u05d0\u05d7\u05ea \u05d1\u05d9\u05d5\u05dd, \u05db\u05e9\u05e2\u05d5\u05d1\u05e8\u05d9\u05dd ' + DAILY_CAP + ' \u05d4\u05ea\u05e8\u05d0\u05d5\u05ea. \u05d1\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4: \u05de\u05d5\u05d3\u05d5\u05dc\u05d9\u05dd > \u05e0\u05d0\u05de\u05e0\u05d9 \u05d1\u05d8\u05d9\u05d7\u05d5\u05ea',
};
// null = send as usual. Otherwise the row is not sent and the reason is returned;
// the first row over the ceiling sends CAP_SRC's notice in its place.
async function capGate(env, sb, prefs, src, row, B) {
  const now = Date.now(), since = encodeURIComponent(ilDayStart(now));
  let n = 0;
  try {
    for (const q of ['trustee_reports?ok=eq.false&', 'near_miss?']) {
      const r = await sb(q + 'notified_at=gte.' + since + '&select=id&limit=' + (DAILY_CAP * 4));
      const j = r.ok ? await r.json() : [];
      n += Array.isArray(j) ? j.length : 0;
    }
  } catch (e) { return null; }   // a failed count never costs a real alert
  if (n <= DAILY_CAP) return null;
  const day = ilDay(now);
  const st = await sGet(env, [CAP_KEY], B).catch(() => ({}));
  if (st[CAP_KEY] && st[CAP_KEY].value === day) {
    await logRows(sb, [{ event_type: src.event, channel: 'capped', payload: { id: row.id, n } }]);
    return 'daily cap';
  }
  try { await sSet(env, { [CAP_KEY]: day }, B); } catch (e) { /* worst case the notice goes twice */ }
  const [y, m, d] = day.split('-');
  const note = { id: row.id, u: '\u05de\u05e2\u05e8\u05db\u05ea \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea', loc: '\u05db\u05dc \u05d4\u05de\u05e4\u05e2\u05dc', d: d + '/' + m + '/' + y, photo_url: null,
    f: '\u05d4\u05d9\u05d5\u05dd \u05db\u05d1\u05e8 \u05e0\u05e9\u05dc\u05d7\u05d5 ' + DAILY_CAP + ' \u05d4\u05ea\u05e8\u05d0\u05d5\u05ea \u05e2\u05dc \u05de\u05e4\u05d2\u05e2\u05d9\u05dd. \u05e2\u05d3 \u05de\u05d7\u05e8 \u05dc\u05d0 \u05d9\u05d9\u05e9\u05dc\u05d7\u05d5 \u05e2\u05d5\u05d3 \u05d4\u05ea\u05e8\u05d0\u05d5\u05ea. \u05d4\u05d3\u05d9\u05d5\u05d5\u05d7\u05d9\u05dd \u05e0\u05e9\u05de\u05e8\u05d9\u05dd \u05db\u05e8\u05d2\u05d9\u05dc \u05d5\u05e0\u05de\u05e6\u05d0\u05d9\u05dd \u05d1\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4 \u05d5\u05d1\u05e7\u05d5\u05d1\u05e5.' };
  const line = '\u05d9\u05d5\u05ea\u05e8 \u05de-' + DAILY_CAP + ' \u05d3\u05d9\u05d5\u05d5\u05d7\u05d9\u05dd \u05d4\u05d9\u05d5\u05dd';
  const res = await deliver(env, prefs, note, line, CAP_SRC, B);
  await logDelivery(sb, CAP_SRC, note, line, res);
  return 'daily cap (notice sent)';
}

// The manager's saved settings: notification_prefs[admin].prefs.trustee_hazard
async function loadPrefs(sb) {
  const out = { whatsapp: false, whatsapp_to: '', email: false, email_to: '' };
  try {
    const r = await sb('notification_prefs?id=eq.' + encodeURIComponent(PREFS_ID) + '&select=prefs');
    if (!r.ok) return out;
    const rows = await r.json();
    const p = rows && rows[0] && rows[0].prefs && rows[0].prefs[EVENT];
    if (!p) return out;
    out.whatsapp = !!p.whatsapp; out.whatsapp_to = clean(p.whatsapp_to, 20).replace(/[^0-9]/g, '');
    out.email = !!p.email; out.email_to = clean(p.email_to, 120);
  } catch (e) { /* no prefs → nothing to send */ }
  return out;
}

// The task's current name. Falls back to the built-in map for the window
// before the migration runs, for a number the table does not carry, and for
// any read that fails — a notification must never be lost over its subject line.
async function taskName(sb, n) {
  const num = parseInt(n, 10);
  const fallback = TASKS[num] || ('\u05de\u05e9\u05d9\u05de\u05d4 ' + n);
  if (!(num > 0)) return fallback;
  try {
    const r = await sb('trustee_tasks?n=eq.' + num + '&select=t');
    if (!r.ok) return fallback;
    const rows = await r.json();
    const t = Array.isArray(rows) && rows[0] && rows[0].t;
    return t ? String(t) : fallback;
  } catch (e) { return fallback; }
}

// The one line under the reporter's name: which check it was for a trustee,
// how bad it was for a near-miss.
async function lineFor(sb, src, row) {
  if (src.event === 'near_miss') {
    const bits = [];
    if (row.sev) bits.push('\u05d7\u05d5\u05de\u05e8\u05d4 ' + clean(row.sev, 20));
    if (row.typ) bits.push(clean(row.typ, 40));
    return bits.length ? bits.join(', ') : '\u05db\u05de\u05e2\u05d8 \u05d5\u05e0\u05e4\u05d2\u05e2';
  }
  return taskName(sb, row.t);
}

async function deliver(env, prefs, row, task, src, B) {
  const res = {};
  if (prefs.whatsapp && prefs.whatsapp_to) res.whatsapp = await sendWhatsApp(env, prefs.whatsapp_to, row, task, src, B);
  if (prefs.email && prefs.email_to) res.email = await sendEmail(env, prefs.email_to, row, task, src, B);
  return res;
}

async function metaSend(env, to, template, params, B) {
  spend(B, 1);
  const resp = await tfetch(`https://graph.facebook.com/${META_API_VERSION}/${env.META_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + env.META_ACCESS_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp', to, type: 'template',
      template: { name: template, language: { code: 'he' }, components: [{ type: 'body', parameters: params.map((p) => ({ type: 'text', text: p })) }] }
    })
  }, NET_MS);
  const text = await resp.text();
  let parsed; try { parsed = JSON.parse(text); } catch (e) { parsed = { raw: text }; }
  return { ok: resp.ok, status: resp.status, parsed };
}

async function sendWhatsApp(env, to, row, task, src, B) {
  if (!env.META_PHONE_NUMBER_ID || !env.META_ACCESS_TOKEN) return 'error: WhatsApp not configured (META env vars)';
  const who = clean(row.u, 40), loc = clean(row.loc || '\u05dc\u05d0 \u05e6\u05d5\u05d9\u05df', 60), finding = clean(row.f || '\u05dc\u05dc\u05d0 \u05ea\u05d9\u05d0\u05d5\u05e8', 150);
  try {
    const kind = clean(src.kindLabel(row, task), 90);
    // The template we want: {{1}} reporter, {{2}} kind, {{3}} location, {{4}} finding.
    let r = await metaSend(env, to, TEMPLATE_DEDICATED, [who, kind, loc, finding], B);
    const err = r.parsed && r.parsed.error;
    const missing = !r.ok && err && (err.code === 132001 || /template/i.test(String(err.message || '')));
    if (missing) {
      // The approved incident template, whose fixed labels are, in order:
      //   סוג: {{1}}   מיקום: {{2}}   חומרה: {{3}}
      // We were passing location, kind, finding -- so every line was captioned
      // as something it was not: the store room appeared under «סוג», the task
      // name under «מיקום». Read on a phone it looked like a broken system
      // reporting a road accident. This is the order the labels actually want.
      r = await metaSend(env, to, TEMPLATE_FALLBACK, [kind, loc, finding], B);
    }
    if (r.ok) return 'sent';
    const e2 = r.parsed && r.parsed.error;
    return 'error: Meta ' + r.status + (e2 && e2.message ? ' ' + String(e2.message).substring(0, 160) : '');
  } catch (e) {
    return 'error: network ' + String(e && e.message || e).substring(0, 120);
  }
}

// The bucket has been private since 2026-04-21, but the email kept linking the
// /object/public/… URL the client stores — so "📷 תמונת הממצא" answered 400 for
// every manager who ever clicked it. Mint a signed link instead. It is valid
// for seven days, which is long enough to act on a hazard and short enough that
// a forwarded mail does not become a permanent key to the photo.
const PHOTO_LINK_TTL = 7 * 24 * 3600;
async function signPhoto(serviceKey, publicUrl, B) {
  const m = String(publicUrl || '').match(/\/storage\/v1\/object\/(?:public\/|sign\/)?([^/]+)\/([^?]+)/);
  if (!m) return null;
  try {
    spend(B, 1);
    const r = await tfetch(SUPABASE_URL + '/storage/v1/object/sign/' + m[1] + '/' + m[2], {
      method: 'POST',
      headers: { apikey: serviceKey, Authorization: 'Bearer ' + serviceKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: PHOTO_LINK_TTL }),
    }, DB_MS);
    if (!r.ok) return null;
    const d = await r.json();
    return d && d.signedURL ? SUPABASE_URL + '/storage/v1' + d.signedURL : null;
  } catch (e) { return null; }
}

async function sendEmail(env, to, row, task, src, B) {
  const who = esc(row.u), loc = esc(row.loc || '\u05dc\u05d0 \u05e6\u05d5\u05d9\u05df'), finding = esc(row.f || '\u05dc\u05dc\u05d0 \u05ea\u05d9\u05d0\u05d5\u05e8');
  const date = esc(dmy(row.d));
  // A photo that cannot be opened is worse than no photo: it reads as a broken
  // system. Link it only when the signature actually came back.
  const signed = row.photo_url && /^https?:\/\//.test(row.photo_url) && env.SUPABASE_SERVICE_ROLE_KEY
    ? await signPhoto(env.SUPABASE_SERVICE_ROLE_KEY, row.photo_url, B)
    : null;
  const photo = signed ? '<p><a href="' + esc(signed) + '">📷 \u05ea\u05de\u05d5\u05e0\u05ea \u05d4\u05de\u05de\u05e6\u05d0</a></p>' : '';
  // A [TS-<id>] reply tag belongs here if mail-inbox.js is ever switched on
  // (needs admin consent for Mail.Read, DECISIONS 2026-09-27).
  // 27/09: a signed "mark as handled" link instead of reply-to-close. Opens a
  // short form (close-hazard.js); GET writes nothing, so link scanners are harmless.
  // Trustee findings only, and only when TRUSTEE_NOTIFY_SECRET is set.
  const closeTok = src.event === 'trustee_hazard' && row.id ? await makeCloseToken(env, row.id) : null;
  const closeBtn = closeTok
    ? '<a href="' + esc(closeUrl(APP_URL, closeTok)) + '" style="background:#15803d;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;margin-left:8px;display:inline-block;margin-bottom:8px">\u2705 \u05e1\u05de\u05df \u05db\u05d8\u05d5\u05e4\u05dc</a> '
    : '';
  const subject = src.emoji + ' ' + src.subject + ' - ' + clean(row.u, 40) + ', ' + clean(task, 40);
  const html = '<div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">'
    + '<div style="background:#cc1f1f;padding:16px;text-align:center;border-radius:8px 8px 0 0"><h1 style="color:#fff;margin:0;font-size:18px">' + src.emoji + ' ' + esc(src.title) + '</h1><p style="color:#ffcccc;margin:4px 0 0;font-size:12px">\u05ea\u05e2\u05e9\u05d9\u05d5\u05ea \u05ea\u05e4\u05d5\u05d2\u05df - \u05e0\u05d9\u05d4\u05d5\u05dc \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea</p></div>'
    + '<div style="background:#fff;padding:20px;border:1px solid #e5e7eb;font-size:14px;line-height:1.7">'
    + '<p><strong>' + esc(src.whoLabel) + ':</strong> ' + who + '</p><p><strong>' + esc(src.lineLabel) + ':</strong> ' + src.lineText(row, task) + '</p><p><strong>\u05ea\u05d0\u05e8\u05d9\u05da:</strong> ' + date + '</p><p><strong>\u05de\u05d9\u05e7\u05d5\u05dd:</strong> ' + loc + '</p><p><strong>\u05d4\u05de\u05de\u05e6\u05d0:</strong> ' + finding + '</p>' + photo
    + '<p style="margin-top:16px">' + closeBtn + '<a href="' + APP_URL + '" style="background:#cc1f1f;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold">\u05dc\u05e0\u05d9\u05ea\u05d5\u05d1 \u05d1\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4</a></p>'
    + '</div><div style="background:#f9fafb;padding:10px;text-align:center;font-size:11px;color:#9ca3af;border-radius:0 0 8px 8px">' + esc(src.footer) + '</div></div>';
  // 2026-09-27: through Outlook as the account connected in /api/ms-auth, when
  // it granted Mail.Send. That is the only way the mail reaches an address at
  // the factory's own domain: Resend without a verified domain delivers only to
  // its account owner. Resend stays as the fallback.
  let outlookErr = null;
  if (odConfigured(env)) {
    try {
      spend(B, 1);
      const tr = await within(tokenRow(env), DB_MS, 'token read');
      if (hasMail(tr)) {
        // accessToken reads the row again, and refreshes it (3 more) when it is near expiry.
        const fresh = tr.access_token && tr.expires_at && Date.parse(tr.expires_at) > Date.now() + 60000;
        spend(B, fresh ? 1 : 4);
        const { token } = await within(accessToken(env), NET_MS, 'token');
        spend(B, 1);
        await within(sendMail(token, to, subject, html), NET_MS, 'outlook send');
        return 'sent';
      }
    } catch (e) { outlookErr = String((e && e.message) || e).substring(0, 140); }
  }
  if (!env.RESEND_KEY) return 'error: ' + (outlookErr || 'email not configured (RESEND_KEY missing in Cloudflare env)');
  try {
    spend(B, 1);
    const r = await tfetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: 'Bearer ' + env.RESEND_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.RESEND_FROM || 'Tapugan Safety <onboarding@resend.dev>', to: [to], subject, html, text: subject + ' - ' + clean(row.loc, 60) + ': ' + clean(row.f, 200) + ' ' + APP_URL })
    }, NET_MS);
    if (r.ok) return 'sent';
    const t = await r.text();
    // Resend's most common refusal, and the one that reads like a bug in us.
    // With no verified domain it delivers ONLY to the address the account was
    // opened with, and answers 403 with a wall of English JSON that lands in a
    // Hebrew log line. Michael hit it on 2026-09-21 and had to read it out of
    // net._http_response in the SQL editor to find out what to do.
    if (r.status === 403 && /only send testing emails/i.test(t)) {
      const own = (t.match(/\(([^()\s]+@[^()\s]+)\)/) || [])[1] || '';
      return 'error: Resend \u05e9\u05d5\u05dc\u05d7 \u05e8\u05e7 \u05d0\u05dc ' + (own || '\u05db\u05ea\u05d5\u05d1\u05ea \u05d4\u05d7\u05e9\u05d1\u05d5\u05df')
        + ' \u05db\u05dc \u05e2\u05d5\u05d3 \u05d0\u05d9\u05df \u05d3\u05d5\u05de\u05d9\u05d9\u05df \u05de\u05d0\u05d5\u05de\u05ea. \u05d0\u05d5 \u05dc\u05e9\u05d9\u05dd \u05d0\u05ea \u05d4\u05db\u05ea\u05d5\u05d1\u05ea \u05d4\u05d6\u05d5 \u05db\u05d9\u05e2\u05d3, \u05d0\u05d5 \u05dc\u05d0\u05de\u05ea \u05d3\u05d5\u05de\u05d9\u05d9\u05df \u05d1-resend.com/domains \u05d5\u05dc\u05d4\u05d2\u05d3\u05d9\u05e8 RESEND_FROM \u05d1-Cloudflare';
    }
    return 'error: ' + (outlookErr ? outlookErr + ' / ' : '') + 'Resend ' + r.status + ' ' + t.substring(0, 160);
  } catch (e) {
    return 'error: network ' + String(e && e.message || e).substring(0, 120);
  }
}
