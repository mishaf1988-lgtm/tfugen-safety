// Cloudflare Pages Function: the morning update on WhatsApp, sent by the server (20/10/2026, Michael
// in the assistant's questionnaire: "do it: hand the server update to development"). The assistant's own run could
// not send it: routine-db wa_me from a scheduled run was refused by the permission classifier on
// 19/10 and 20/10, so no update went out.
//
// pg_cron calls POST /api/wa-morning at 04:47 and 05:47 UTC, Sunday to Thursday, with the Vault
// secret (x-notify-secret), like /api/weather. Only the call that lands on 07:xx in Israel sends,
// so daylight saving needs no second job; server_state.wa_morning_last stops a second send that day.
// The text (routine-wa-assistant.md step 3, at most 700 characters): agents that failed in the last
// 24 hours (agent_log) and up to 3 urgent expiries (docs, equip_inspections: expired or within 7
// days). No employee names: docs.n and equip_inspections.n are document and equipment names.
// What waits for Michael in the office (ArtifactData) is not on the server; the line points to the
// assistant ("what's up?") for it.
//   body {}             the scheduled call
//   body {dry: true}    returns the text, sends nothing
//   body {force: true}  sends now, any hour or day (a manual retry)
import { jsonResp, sbFrom, SB_TIMEOUT_MS, tmo } from '../_shared.js';
import { ownerWa, sendToOwner, ownerWindowOpen, noteLastOut } from '../_wa.js';

export const LAST_KEY = 'wa_morning_last';
export const MAX_CHARS = 700;
const TZ = 'Asia/Jerusalem';

export function ilDay(d) { return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d); }
export function ilHour(d) { return Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' }).format(d)); }
export function ilDow(d) { return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(d)); }
export function dueNow(d) { const w = ilDow(d); return w >= 0 && w <= 4 && ilHour(d) === 7; }
const dmy = (ymd) => { const p = String(ymd || '').slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : ''; };
// Names come from the database: their long dashes, curly quotes and ellipses become keyboard characters
// (CLAUDE.md, text sent to people).
export const keyboard = (s) => String(s || '').replace(/[\u2013\u2014\u05be]/g, '-').replace(/[\u201c\u201d\u05f4]/g, '"').replace(/[\u2018\u2019\u05f3]/g, "'").replace(/\u2026/g, '...');
const clip = (s, n) => { s = keyboard(s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trim() + '.' : s; };

// Agent names in agent_log are technical (routine-*); the update shows the office name.
export const AGENT_NAMES = { 'routine-coa': '\u05e1\u05d9\u05d3\u05d5\u05e8 \u05ea\u05e2\u05d5\u05d3\u05d5\u05ea COA', 'routine-compliance': '\u05d3\u05d5\u05d7 \u05d4\u05e6\u05d9\u05d5\u05ea', 'routine-factory-trends': '\u05de\u05d2\u05de\u05d5\u05ea \u05d4\u05de\u05e4\u05e2\u05dc',
  'routine-inspector': '\u05d4\u05de\u05e4\u05e7\u05d7 \u05d4\u05de\u05d3\u05d5\u05de\u05d4', 'routine-inventor': '\u05d7\u05d5\u05e7\u05e8 \u05d4\u05d4\u05de\u05e6\u05d0\u05d5\u05ea', 'routine-mail-filing': '\u05ea\u05d9\u05d5\u05e7 \u05de\u05d4\u05de\u05d9\u05d9\u05dc', 'routine-nevo-versions': '\u05de\u05e2\u05e7\u05d1 \u05e0\u05d1\u05d5',
  'routine-od-scan': '\u05e1\u05e8\u05d9\u05e7\u05ea \u05ea\u05d9\u05e7\u05d9\u05d9\u05ea \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea', 'routine-preferences': '\u05de\u05d5\u05d3\u05dc \u05d4\u05d4\u05e2\u05d3\u05e4\u05d5\u05ea', 'routine-quotes': '\u05de\u05e2\u05e7\u05d1 \u05d4\u05e6\u05e2\u05d5\u05ea \u05de\u05d7\u05d9\u05e8', 'routine-radar-learn': '\u05d4\u05e8\u05d3\u05d0\u05e8',
  'routine-researcher': '\u05d7\u05d5\u05e7\u05e8 \u05d4\u05e2\u05d5\u05d6\u05e8', 'routine-talk-field': '\u05d4\u05d4\u05d3\u05e8\u05db\u05d4 \u05d4\u05e9\u05d1\u05d5\u05e2\u05d9\u05ea', 'routine-validity': '\u05d1\u05d5\u05d3\u05e7 \u05d4\u05ea\u05d5\u05e7\u05e3', 'routine-wa-assistant': '\u05d4\u05e2\u05d5\u05d6\u05e8 \u05d1\u05d5\u05d5\u05d0\u05d8\u05e1\u05d0\u05e4' };
export const agentName = (a) => AGENT_NAMES[a] || String(a || '').replace(/^routine-/, '');

// Pure: the text. items = [{n, e}] already sorted by e, today = 'YYYY-MM-DD',
// failed = agent names that reported ok:false in the last 24 hours.
export function buildBrief(items, failed, today, compact) {
  failed = failed.map(agentName);
  // compact (20/10/2026, Michael's screenshot): outside the 24 hour window the template carries one
  // line between its own "update from the assistant:" and "to answer, write here", so no heading, no
  // closing line, and items joined by "; " instead of new lines that would turn into " | ".
  if (compact) {
    const parts = [];
    if (items.length) parts.push('\u05ea\u05e4\u05d5\u05d2\u05d5\u05ea \u05d3\u05d7\u05d5\u05e4\u05d5\u05ea: ' + items.slice(0, 3).map((x) => clip(x.n, 50) + (x.e < today ? ' (\u05e4\u05d2 ' : ' (\u05e2\u05d3 ') + dmy(x.e) + ')').join('; ')
      + (items.length > 3 ? '; \u05d5\u05e2\u05d5\u05d3 ' + (items.length - 3) : '') + '.');
    if (failed.length) parts.push('\u05e1\u05d5\u05db\u05df \u05e9\u05e0\u05db\u05e9\u05dc: ' + failed.slice(0, 5).join(', ') + '.');
    return (parts.length ? parts.join(' ') : '\u05d0\u05d9\u05df \u05e9\u05d5\u05dd \u05d3\u05d1\u05e8 \u05e9\u05de\u05d7\u05db\u05d4 \u05dc\u05da \u05d4\u05d9\u05d5\u05dd.').slice(0, MAX_CHARS);
  }
  const lines = [];
  if (items.length) {
    lines.push('\u05ea\u05e4\u05d5\u05d2\u05d5\u05ea \u05d3\u05d7\u05d5\u05e4\u05d5\u05ea:');
    items.slice(0, 3).forEach((x) => lines.push('- ' + clip(x.n, 60) + (x.e < today ? ' (\u05e4\u05d2 ' : ' (\u05e2\u05d3 ') + dmy(x.e) + ')'));
    if (items.length > 3) lines.push('\u05d5\u05e2\u05d5\u05d3 ' + (items.length - 3) + ' \u05d1\u05de\u05e1\u05da \u05d4\u05ea\u05e4\u05d5\u05d2\u05d5\u05ea.');
  }
  if (failed.length) lines.push('\u05e1\u05d5\u05db\u05df \u05e9\u05e0\u05db\u05e9\u05dc \u05d1-24 \u05d4\u05e9\u05e2\u05d5\u05ea \u05d4\u05d0\u05d7\u05e8\u05d5\u05e0\u05d5\u05ea: ' + failed.slice(0, 5).join(', ') + '.');
  if (!lines.length) return '\u05d1\u05d5\u05e7\u05e8 \u05d8\u05d5\u05d1, \u05d0\u05d9\u05df \u05e9\u05d5\u05dd \u05d3\u05d1\u05e8 \u05e9\u05de\u05d7\u05db\u05d4 \u05dc\u05da \u05d4\u05d9\u05d5\u05dd.';
  const head = '\u05d1\u05d5\u05e7\u05e8 \u05d8\u05d5\u05d1. \u05e2\u05d3\u05db\u05d5\u05df ' + dmy(today) + ':';
  const tail = '\u05de\u05d4 \u05de\u05d7\u05db\u05d4 \u05dc\u05da \u05d1\u05de\u05e9\u05e8\u05d3: \u05db\u05ea\u05d1\u05d5 \u05dc\u05d9 "\u05de\u05d4 \u05d4\u05de\u05e6\u05d1?".';
  let text = [head].concat(lines, [tail]).join('\n');
  while (text.length > MAX_CHARS && lines.length > 1) { lines.pop(); text = [head].concat(lines, [tail]).join('\n'); }
  return text.slice(0, MAX_CHARS);
}

async function sb(env, path, init) {
  const k = env.SUPABASE_SERVICE_ROLE_KEY;
  const r = await fetch(sbFrom(env) + '/rest/v1/' + path, Object.assign({ signal: tmo(SB_TIMEOUT_MS) }, init || {},
    { headers: Object.assign({ apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' }, (init && init.headers) || {}) }));
  if (!r.ok) throw new Error('sb ' + r.status);
  return r.status === 204 || r.status === 201 ? null : r.json().catch(() => null);
}
async function stateGet(env, key) {
  const rows = await sb(env, 'server_state?key=eq.' + key + '&select=value');
  return rows && rows[0] ? rows[0].value : null;
}
async function stateSet(env, key, value) {
  await sb(env, 'server_state?on_conflict=key', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([{ key, value, updated_at: new Date().toISOString() }]) });
}

export async function gather(env, now) {
  const today = ilDay(now);
  const week = ilDay(new Date(now.getTime() + 7 * 86400000));
  const q = (t, cols) => sb(env, t + '?select=' + cols + '&e=not.is.null&e=lte.' + week + '&order=e.asc&limit=20').catch(() => []);
  const [docs, equip] = await Promise.all([q('docs', 'n,e'), q('equip_inspections', 'n,loc,e')]);
  const items = [].concat((docs || []).map((x) => ({ n: x.n, e: x.e })),
    (equip || []).map((x) => ({ n: x.loc ? x.n + ', ' + x.loc : x.n, e: x.e })))
    .filter((x) => x.n && /^\d{4}-\d{2}-\d{2}/.test(String(x.e))).sort((a, b) => String(a.e).localeCompare(String(b.e)));
  let log = [];
  try { log = JSON.parse((await stateGet(env, 'agent_log')) || '[]'); } catch (e) { log = []; }
  const since = now.getTime() - 86400000;
  const failed = Array.from(new Set((Array.isArray(log) ? log : []).filter((x) => x && x.ok === false && Date.parse(x.at) >= since).map((x) => String(x.agent))));
  return { today, items, failed };
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return jsonResp({ error: 'method not allowed' }, 405, {});
  const want = env.TRUSTEE_NOTIFY_SECRET;
  if (!want || (request.headers.get('x-notify-secret') || '') !== want) return jsonResp({ error: 'forbidden' }, 403, {});
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return jsonResp({ error: 'server misconfigured' }, 500, {});
  let body = {}; try { body = await request.json(); } catch (e) { body = {}; }
  return jsonResp(await run(env, new Date(), body), 200, {});
}

// The call itself, with the clock as an argument (tested at 07:47 Israel).
export async function run(env, now, body) {
  if (!body.force && !body.dry && !dueNow(now)) return { ok: true, sent: false, reason: 'not 07:xx on a workday in Israel' };
  const g = await gather(env, now);
  const open = await ownerWindowOpen(env, sbFrom(env), now.getTime());
  const text = buildBrief(g.items, g.failed, g.today, !open);
  if (body.dry) return { ok: true, sent: false, dry: true, text };
  if (!body.force && (await stateGet(env, LAST_KEY).catch(() => null)) === g.today) return { ok: true, sent: false, reason: 'already sent today' };
  if (!env.META_PHONE_NUMBER_ID || !env.META_ACCESS_TOKEN) return { ok: false, error: 'whatsapp not configured' };
  const to = await ownerWa(env, sbFrom(env));
  if (!to) return { ok: false, error: 'no owner number in notification_prefs' };
  const r = await sendToOwner(env, to, text, { windowOpen: open });
  if (r.ok) { await stateSet(env, LAST_KEY, g.today).catch(() => {}); await noteLastOut(env, sbFrom(env), text, 'morning'); }
  await sb(env, 'notifications_log', { method: 'POST', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify([{ id: 'wm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), user_email: 'server', ts: now.toISOString(),
      event_type: 'assistant', channel: r.ok ? 'whatsapp' : 'whatsapp_error',
      payload: { title: clip(text, 120), kind: 'morning', via: r.via || null, wamid: r.wamid || null, detail: r.error || null } }]) }).catch(() => {});
  return { ok: r.ok, sent: r.ok, via: r.via || null, error: r.error || null, chars: text.length };
}
