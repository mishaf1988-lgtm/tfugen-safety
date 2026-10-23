// Cloudflare Pages Function: the morning update on WhatsApp, sent by the server (20/10/2026, Michael
// in the assistant's questionnaire: "do it: hand the server update to development"). The assistant's own run could
// not send it: routine-db wa_me from a scheduled run was refused by the permission classifier on
// 19/10 and 20/10, so no update went out.
//
// pg_cron calls POST /api/wa-morning at 04:47 and 05:47 UTC, Sunday to Thursday, with the Vault
// secret (x-notify-secret), like /api/weather. Only the call that lands on 07:xx in Israel sends,
// so daylight saving needs no second job; server_state.wa_morning_last stops a second send that day.
// The text (routine-wa-assistant.md step 3, at most 700 characters): what workers left for Michael
// (agent_report for_michael, since the last update), agents that failed in the last
// 24 hours (agent_log) and up to 3 urgent expiries (docs, equip_inspections: expired or within 7
// days). No employee names: docs.n and equip_inspections.n are document and equipment names.
// What waits for Michael in the office (ArtifactData) is not on the server; the line points to the
// assistant ("what's up?") for it.
//   body {}             the scheduled call
//   body {dry: true}    returns the text, sends nothing
//   body {force: true}  sends now, any hour or day (a manual retry)
//   body {calendar: true} only the calendar requests, now; no WhatsApp (a check after the flow is built)
//   body {watch: true}  the watchdog for a stuck run, every 5 minutes (watchVerdict)
// The same run writes calendar requests for upcoming expiries (calendarStep, below).
import { jsonResp, sbFrom, SB_TIMEOUT_MS, tmo } from '../_shared.js';
import { ownerWa, sendToOwner, ownerWindowOpen, noteLastOut, stripInternalIds, PROMISE_KEY, promiseDue, promiseRemindText, promiseToCheck, promiseCheckDue, promiseCheckFireText, assistantFire } from '../_wa.js';
import { odConfigured, accessToken, putFile } from '../_onedrive.js';

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
  'routine-researcher': '\u05d7\u05d5\u05e7\u05e8 \u05d4\u05e2\u05d5\u05d6\u05e8', 'routine-talk-field': '\u05d4\u05d4\u05d3\u05e8\u05db\u05d4 \u05d4\u05e9\u05d1\u05d5\u05e2\u05d9\u05ea', 'routine-validity': '\u05d1\u05d5\u05d3\u05e7 \u05d4\u05ea\u05d5\u05e7\u05e3', 'routine-wa-assistant': '\u05d4\u05e2\u05d5\u05d6\u05e8 \u05d1\u05d5\u05d5\u05d0\u05d8\u05e1\u05d0\u05e4', 'dev': '\u05e4\u05d9\u05ea\u05d5\u05d7' };
export const agentName = (a) => AGENT_NAMES[a] || String(a || '').replace(/^routine-/, '');

// Equipment of another area (equip_inspections.resp_area, 20/10/2026): the update names the role, not the
// person (Michael: "do it: no calendar entry, just a mark"); who holds the role sits in SITE.equipAreas.
export const AREA_ROLE = { '\u05ea\u05e9\u05ea\u05d9\u05d5\u05ea': '\u05d0\u05d7\u05e8\u05d0\u05d9 \u05d4\u05ea\u05e9\u05ea\u05d9\u05d5\u05ea', '\u05e7\u05d9\u05e8\u05d5\u05e8 \u05d5\u05d0\u05de\u05d5\u05e0\u05d9\u05d4': '\u05d0\u05d7\u05e8\u05d0\u05d9 \u05d4\u05e7\u05d9\u05e8\u05d5\u05e8' };
export const areaRole = (a) => { a = String(a || '').trim(); return a ? (AREA_ROLE[a] || '\u05d0\u05d7\u05e8\u05d0\u05d9 ' + a) : ''; };
const due = (x, today) => (x.e < today ? ' (\u05e4\u05d2 ' : ' (\u05e2\u05d3 ') + dmy(x.e) + (x.area ? ', ' + areaRole(x.area) : '') + ')';

// One weather line from server_state.weather_tomorrow (/api/weather writes it at 17:07 for the next day),
// only when it is for today and has the summary (20/10/2026, Michael on WhatsApp: "add the weather").
const WX_KIND = { heat: '\u05e2\u05d5\u05de\u05e1 \u05d7\u05d5\u05dd', gust: '\u05de\u05e9\u05d1\u05d9\u05dd \u05d7\u05d6\u05e7\u05d9\u05dd', rain: '\u05d2\u05e9\u05dd' };
export function weatherLine(w, today) {
  const s = w && w.ok && w.day === today && w.sum;
  if (!s) return '';
  const parts = [];
  if (s.tmin !== null && s.tmax !== null) parts.push(s.tmin + '-' + s.tmax + ' \u05de\u05e2\u05dc\u05d5\u05ea');
  if (s.rain !== null && s.rain > 0) parts.push('\u05e1\u05d9\u05db\u05d5\u05d9 \u05dc\u05d2\u05e9\u05dd \u05e2\u05d3 ' + s.rain + '%');
  if (s.gust !== null) parts.push('\u05de\u05e9\u05d1\u05d9\u05dd \u05e2\u05d3 ' + s.gust + ' \u05e7\u05de"\u05e9');
  if (!parts.length) return '';
  const al = (w.alerts || []).map((a) => WX_KIND[a.kind]).filter(Boolean);
  return '\u05de\u05d6\u05d2 \u05d4\u05d0\u05d5\u05d5\u05d9\u05e8: ' + parts.join(', ') + '.' + (al.length ? ' \u05d6\u05d4\u05d9\u05e8\u05d5\u05ea \u05d1\u05e2\u05d1\u05d5\u05d3\u05d4 \u05d1\u05d7\u05d5\u05e5: ' + al.join(', ') + '.' : '');
}

// Pure: the text. items = [{n, e}] already sorted by e, today = 'YYYY-MM-DD',
// failed = agent names that reported ok:false in the last 24 hours.
// notes = [{agent, text}]: agent_report for_michael lines since the last update (20/10/2026).
// weather = the weather_tomorrow record (weatherLine), first in the text.
// devDone = development requests closed yesterday (devClosedYesterday), the last line; null = not read, no line.
export const LEARN_ALERT = 30;
export function buildBrief(items, failed, today, compact, notes, weather, devDone, learnOpen) {
  const wx = weatherLine(weather, today);
  failed = failed.map(agentName);
  // A worker's note goes out as written, so an internal id is cut out here (21/10/2026, hasInternalId).
  notes = (notes || []).map((x) => ({ agent: x.agent, text: stripInternalIds(x.text) })).filter((x) => x.text).slice(0, 3);
  // compact (20/10/2026, Michael's screenshot): outside the 24 hour window the template carries one
  // line between its own "update from the assistant:" and "to answer, write here", so no heading, no
  // closing line, and items joined by "; " instead of new lines that would turn into " | ".
  // 21/10/2026 (Michael on WhatsApp: "add at the end a line with the number of development requests closed yesterday")
  const devLine = Number.isInteger(devDone) ? '\u05d1\u05e7\u05e9\u05d5\u05ea \u05e4\u05d9\u05ea\u05d5\u05d7 \u05e9\u05e0\u05e1\u05d2\u05e8\u05d5 \u05d0\u05ea\u05de\u05d5\u05dc: ' + devDone + '.' : '';
  // 22/10/2026 (Michael: "approve the upgrade"): the assistant's notebook is folded into its rules by the daily retro
  // (retro-prompt.md 7b). More than LEARN_ALERT open entries = the retro is not folding them; one line says so.
  const nb = Number.isInteger(learnOpen) && learnOpen > LEARN_ALERT ? '\u05d4\u05de\u05d7\u05d1\u05e8\u05ea \u05e9\u05dc \u05d4\u05e2\u05d5\u05d6\u05e8: ' + learnOpen + ' \u05d3\u05d1\u05e8\u05d9\u05dd \u05e9\u05dc\u05de\u05d3 \u05e2\u05d5\u05d3 \u05dc\u05d0 \u05e0\u05db\u05e0\u05e1\u05d5 \u05dc\u05d4\u05d5\u05e8\u05d0\u05d5\u05ea \u05e9\u05dc\u05d5.' : '';
  const dev = [devLine, nb].filter(Boolean).join(' ');
  if (compact) {
    const parts = [];
    if (wx) parts.push(wx);
    if (notes.length) parts.push('\u05de\u05d4\u05e2\u05d5\u05d1\u05d3\u05d9\u05dd: ' + notes.map((x) => agentName(x.agent) + ': ' + clip(x.text, 160)).join('; ') + '.');
    if (items.length) parts.push('\u05ea\u05e4\u05d5\u05d2\u05d5\u05ea \u05d3\u05d7\u05d5\u05e4\u05d5\u05ea: ' + items.slice(0, 3).map((x) => clip(x.n, 50) + due(x, today)).join('; ')
      + (items.length > 3 ? '; \u05d5\u05e2\u05d5\u05d3 ' + (items.length - 3) : '') + '.');
    if (failed.length) parts.push('\u05e1\u05d5\u05db\u05df \u05e9\u05e0\u05db\u05e9\u05dc: ' + failed.slice(0, 5).join(', ') + '.');
    if (wx && parts.length === 1) parts.push('\u05d0\u05d9\u05df \u05e9\u05d5\u05dd \u05d3\u05d1\u05e8 \u05e9\u05de\u05d7\u05db\u05d4 \u05dc\u05da \u05d4\u05d9\u05d5\u05dd.');
    const body = parts.length ? parts.join(' ') : '\u05d0\u05d9\u05df \u05e9\u05d5\u05dd \u05d3\u05d1\u05e8 \u05e9\u05de\u05d7\u05db\u05d4 \u05dc\u05da \u05d4\u05d9\u05d5\u05dd.';
    return dev ? body.slice(0, MAX_CHARS - dev.length - 1) + ' ' + dev : body.slice(0, MAX_CHARS);
  }
  const lines = [];
  if (wx) lines.push(wx);
  if (items.length) {
    lines.push('\u05ea\u05e4\u05d5\u05d2\u05d5\u05ea \u05d3\u05d7\u05d5\u05e4\u05d5\u05ea:');
    items.slice(0, 3).forEach((x) => lines.push('- ' + clip(x.n, 60) + due(x, today)));
    if (items.length > 3) lines.push('\u05d5\u05e2\u05d5\u05d3 ' + (items.length - 3) + ' \u05d1\u05de\u05e1\u05da \u05d4\u05ea\u05e4\u05d5\u05d2\u05d5\u05ea.');
  }
  if (notes.length) {
    lines.push('\u05de\u05d4\u05e2\u05d5\u05d1\u05d3\u05d9\u05dd:');
    notes.forEach((x) => lines.push('- ' + agentName(x.agent) + ': ' + clip(x.text, 160)));
  }
  if (failed.length) lines.push('\u05e1\u05d5\u05db\u05df \u05e9\u05e0\u05db\u05e9\u05dc \u05d1-24 \u05d4\u05e9\u05e2\u05d5\u05ea \u05d4\u05d0\u05d7\u05e8\u05d5\u05e0\u05d5\u05ea: ' + failed.slice(0, 5).join(', ') + '.');
  if (!lines.length) return '\u05d1\u05d5\u05e7\u05e8 \u05d8\u05d5\u05d1, \u05d0\u05d9\u05df \u05e9\u05d5\u05dd \u05d3\u05d1\u05e8 \u05e9\u05de\u05d7\u05db\u05d4 \u05dc\u05da \u05d4\u05d9\u05d5\u05dd.' + (dev ? '\n' + dev : '');
  const head = '\u05d1\u05d5\u05e7\u05e8 \u05d8\u05d5\u05d1. \u05e2\u05d3\u05db\u05d5\u05df ' + dmy(today) + ':';
  const tail = '\u05de\u05d4 \u05de\u05d7\u05db\u05d4 \u05dc\u05da \u05d1\u05de\u05e9\u05e8\u05d3: \u05db\u05ea\u05d1\u05d5 \u05dc\u05d9 "\u05de\u05d4 \u05d4\u05de\u05e6\u05d1?".';
  const end = dev ? [tail, dev] : [tail];
  let text = [head].concat(lines, end).join('\n');
  while (text.length > MAX_CHARS && lines.length > 1) { lines.pop(); text = [head].concat(lines, end).join('\n'); }
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
  const [docs, equip] = await Promise.all([q('docs', 'n,e'), q('equip_inspections', 'n,loc,e,resp_area')]);
  const items = [].concat((docs || []).map((x) => ({ n: x.n, e: x.e })),
    (equip || []).map((x) => ({ n: x.loc ? x.n + ', ' + x.loc : x.n, e: x.e, area: x.resp_area || '' })))
    .filter((x) => x.n && /^\d{4}-\d{2}-\d{2}/.test(String(x.e))).sort((a, b) => String(a.e).localeCompare(String(b.e)));
  let log = [];
  try { log = JSON.parse((await stateGet(env, 'agent_log')) || '[]'); } catch (e) { log = []; }
  const since = now.getTime() - 86400000;
  // 20/10/2026 (Michael: "do it: the assistant does not report itself as failed"): an agent counts as
  // failed only when its latest report in the 24 hours failed. A failure followed by a good run is over.
  const latest = {};
  (Array.isArray(log) ? log : []).filter((x) => x && x.agent && Date.parse(x.at) >= since)
    .forEach((x) => { const a = String(x.agent); if (!latest[a] || Date.parse(x.at) >= Date.parse(latest[a].at)) latest[a] = x; });
  const failed = Object.keys(latest).filter((a) => latest[a].ok === false);
  // for_michael since the previous update: 24 hours, and on Sunday since Thursday's update (72 hours).
  const nsince = now.getTime() - (ilDow(now) === 0 ? 3 : 1) * 86400000;
  const notes = (Array.isArray(log) ? log : []).filter((x) => x && x.agent && x.for_michael && Date.parse(x.at) >= nsince)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).map((x) => ({ agent: x.agent, text: x.for_michael }));
  let weather = null;
  try { weather = JSON.parse((await stateGet(env, 'weather_tomorrow')) || 'null'); } catch (e) { weather = null; }
  let devDone = null;
  try { devDone = devClosedYesterday(JSON.parse((await stateGet(env, 'dev_inbox')) || '[]'), today); } catch (e) { devDone = null; }
  let learnOpen = null;
  try { learnOpen = JSON.parse((await stateGet(env, 'assistant_learned')) || '[]').filter((x) => x && x.status === 'new').length; } catch (e) { learnOpen = null; }
  return { today, items, failed, notes, weather, devDone, learnOpen };
}
// Pure: requests in dev_inbox closed (done_at) on the Israel day before today. A Sunday counts Saturday only.
export function devClosedYesterday(list, today) {
  if (!Array.isArray(list)) return null;
  const y = ilDay(new Date(Date.parse(today + 'T12:00:00Z') - 86400000));
  return list.filter((x) => x && x.status === 'done' && x.done_at && ilDay(new Date(x.done_at)) === y).length;
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

// ---- calendar requests (20/10/2026, Michael: "do it: calendar slots for expiries") ----
// The server token has no Calendars scope and the 365 connector is read only, so like mail_request the
// server writes one JSON file per expiry into the safety folder, and the Power Automate flow
// "\u05ea\u05d5\u05e8\u05d9\u05dd \u05dc\u05d9\u05d5\u05de\u05df" (power-automate-mail.md, flow 4) turns it into an event in Michael's calendar.
// Which: docs and equip_inspections with e up to CAL_DAYS ahead (expired ones too), at most CAL_MAX new
// a day so the first run does not flood the calendar. When: LEAD_DAYS before e, at the earliest
// tomorrow, moved off Friday and Saturday, 09:00-09:30 Israel. server_state.cal_sent keeps
// "table:id:e" of what was written; a renewed item (new e) gets a new event when it comes close again.
export const OD_CAL = '\u05e9\u05d5\u05dc\u05d7\u05df \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4/\u05e0\u05d9\u05d4\u05d5\u05dc \u05d1\u05d8\u05d9\u05d7\u05d5\u05ea/_\u05ea\u05d5\u05e8\u05d9\u05dd \u05dc\u05d9\u05d5\u05de\u05df';
export const CAL_KEY = 'cal_sent', CAL_DAYS = 45, LEAD_DAYS = 21, CAL_MAX = 5;
const addDays = (ymd, n) => new Date(Date.parse(ymd + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
export function eventDay(e, today) {
  let d = addDays(e, -LEAD_DAYS);
  const first = addDays(today, 1);
  if (d < first) d = first;
  const w = new Date(d + 'T00:00:00Z').getUTCDay();
  return w === 5 ? addDays(d, 2) : w === 6 ? addDays(d, 1) : d;
}
// Pure. rows = [{t, id, n, e, vendor, loc, resp_area}] (a row with resp_area is another area's, no calendar entry), sent = {key: 1}. Returns the files to write, in e order,
// and the sent map pruned to what is still in the window (a renewed or deleted item leaves it).
export function calendarPlan(rows, sent, today) {
  const ok = rows.filter((r) => r && !r.resp_area && r.id != null && r.n && /^\d{4}-\d{2}-\d{2}$/.test(String(r.e || '').slice(0, 10)))
    .map((r) => Object.assign({}, r, { e: String(r.e).slice(0, 10), key: r.t + ':' + r.id + ':' + String(r.e).slice(0, 10) }))
    .sort((a, b) => a.e.localeCompare(b.e));
  const keep = {};
  ok.forEach((r) => { if (sent && sent[r.key]) keep[r.key] = 1; });
  const todo = ok.filter((r) => !keep[r.key]).slice(0, CAL_MAX).map((r) => {
    const day = eventDay(r.e, today);
    const what = r.loc ? clip(r.n, 70) + ', ' + clip(r.loc, 40) : clip(r.n, 90);
    const lines = ['\u05ea\u05e4\u05d5\u05d2\u05d4: ' + dmy(r.e) + (r.e < today ? ' (\u05db\u05d1\u05e8 \u05e4\u05d2)' : '')];
    if (r.vendor) lines.push('\u05e1\u05e4\u05e7: ' + clip(r.vendor, 60));
    lines.push('\u05e0\u05d5\u05e6\u05e8 \u05d0\u05d5\u05d8\u05d5\u05de\u05d8\u05d9\u05ea \u05de\u05d4\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4 \u05db\u05d3\u05d9 \u05dc\u05ea\u05d0\u05dd \u05d1\u05d6\u05de\u05df. \u05d0\u05e4\u05e9\u05e8 \u05dc\u05d4\u05d6\u05d9\u05d6 \u05d0\u05d5 \u05dc\u05de\u05d7\u05d5\u05e7 \u05d1\u05d9\u05d5\u05de\u05df.');
    const esc = (x) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return { key: r.key, day, file: JSON.stringify({
      subject: '\u05dc\u05ea\u05d0\u05dd: ' + what + (r.e < today ? ' (\u05e4\u05d2 ' : ' (\u05e2\u05d3 ') + dmy(r.e) + ')',
      start: day + 'T09:00:00', end: day + 'T09:30:00', tz: 'Israel Standard Time',
      html: '<div dir="rtl">' + lines.map(esc).join('<br>') + '</div>' }) };
  });
  return { todo, keep };
}
export async function calendarStep(env, now, dry) {
  if (!odConfigured(env)) return { skipped: 'onedrive not configured' };
  const today = ilDay(now), until = addDays(today, CAL_DAYS);
  const q = (t, cols) => sb(env, t + '?select=' + cols + '&e=not.is.null&e=lte.' + until + (t === 'equip_inspections' ? '&resp_area=is.null' : '') + '&order=e.asc&limit=100');
  const [docs, equip] = await Promise.all([q('docs', 'id,n,e'), q('equip_inspections', 'id,n,loc,vendor,resp_area,e')]);
  const rows = [].concat((docs || []).map((x) => Object.assign({ t: 'docs' }, x)), (equip || []).map((x) => Object.assign({ t: 'equip' }, x)));
  let sent = {};
  try { sent = JSON.parse((await stateGet(env, CAL_KEY)) || '{}') || {}; } catch (e) { sent = {}; }
  const p = calendarPlan(rows, sent, today);
  if (dry) return { would: p.todo.map((x) => ({ day: x.day, subject: JSON.parse(x.file).subject })) };
  const keep = p.keep;
  let written = 0, error = null;
  if (p.todo.length) {
    try {
      const at = await accessToken(env);
      for (const x of p.todo) {
        await putFile(at.token, OD_CAL, x.key.replace(/:/g, '_') + '.txt', x.file, 'text/plain');
        keep[x.key] = 1; written++;
      }
    } catch (e) { error = String(e.message || e).slice(0, 200); }
  }
  await stateSet(env, CAL_KEY, JSON.stringify(keep));
  return { written, error };
}

// The watchdog (20/10/2026, Michael in the questionnaire: "do it: a guard for a run that got stuck"; the
// same evening a message got "got it" and then 13 minutes of nothing). pg_cron calls {watch: true} every
// 5 minutes. Michael's latest message (owner_in) with no answer after it: after WATCH_MIN minutes one
// line goes to him, once per message. An answer that only says it started ("מתחיל") counts after
// WATCH_START_MIN. Pure: last = the latest owner_in row, outs = assistant rows after it.
export const WATCH_KEY = 'wa_watch_last', WATCH_MIN = 10, WATCH_START_MIN = 20, WATCH_MAX_MIN = 60;
const STARTED = /^\s*\u05de\u05ea\u05d7\u05d9\u05dc/;
export function watchVerdict(last, outs, nowMs, warned) {
  if (!last || !last.ts) return null;
  const wamid = (last.payload && last.payload.wamid) || last.ts;
  if (warned === wamid) return null;
  const age = (nowMs - Date.parse(last.ts)) / 60000;
  if (!(age >= WATCH_MIN) || age > WATCH_MAX_MIN) return null;
  const real = (outs || []).filter((x) => !STARTED.test(String((x.payload && (x.payload.text || x.payload.title)) || '')));
  if (real.length) return null;
  if ((outs || []).length && age < WATCH_START_MIN) return null;
  const hm = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(last.ts));
  return { wamid, text: '\u05e2\u05d3\u05d9\u05d9\u05df \u05d0\u05d9\u05df \u05ea\u05e9\u05d5\u05d1\u05d4 \u05dc\u05d4\u05d5\u05d3\u05e2\u05d4 \u05de-' + hm
    + '. \u05d9\u05d9\u05ea\u05db\u05df \u05e9\u05d4\u05e8\u05d9\u05e6\u05d4 \u05e0\u05ea\u05e7\u05e2\u05d4. \u05d0\u05e4\u05e9\u05e8 \u05dc\u05e9\u05dc\u05d5\u05d7 \u05e9\u05d5\u05d1, \u05d0\u05d5 \u05dc\u05d7\u05db\u05d5\u05ea \u05e2\u05d5\u05d3 \u05db\u05de\u05d4 \u05d3\u05e7\u05d5\u05ea.' };
}
// 21/10/2026: a promise to Michael still open after a day: one reminder (_wa.js promiseDue).
async function promiseRemind(env, now) {
  const raw = await stateGet(env, PROMISE_KEY);
  const due = promiseDue(raw, now.getTime(), ilHour(now));
  if (!due.length) return null;
  // the assistant checks first (promiseToCheck); the plain reminder only when it cannot be woken
  if (assistantFire(env)) {
    await stateSet(env, PROMISE_KEY, JSON.stringify(promiseToCheck(raw, due.map((x) => x.id), now.toISOString())));
    return { checks: due.length };
  }
  if (!env.META_PHONE_NUMBER_ID || !env.META_ACCESS_TOKEN) return null;
  const to = await ownerWa(env, sbFrom(env));
  if (!to) return null;
  let list = []; try { list = JSON.parse(raw || '[]'); } catch (e) { list = []; }
  const ids = due.map((x) => x.id);
  list.forEach((x) => { if (x && ids.indexOf(x.id) >= 0) x.reminded_at = now.toISOString(); });
  await stateSet(env, PROMISE_KEY, JSON.stringify(list));
  const text = promiseRemindText(due);
  const r = await sendToOwner(env, to, text, { windowOpen: await ownerWindowOpen(env, sbFrom(env)) });
  await sb(env, 'notifications_log', { method: 'POST', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify([{ id: 'wp' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), user_email: 'server', ts: now.toISOString(),
      event_type: 'promise', channel: r.ok ? 'whatsapp' : 'whatsapp_error', payload: { title: clip(text, 120), kind: 'promise', detail: r.error || null } }]) }).catch(() => {});
  return { reminded: ids.length, sent: r.ok };
}
// 21/10/2026: a check the assistant scheduled (promise check_in_min): wake it now, one per call. The mark is
// written before the fire, so a slow fire is never fired twice; a failed fire is logged and not retried.
export async function promiseCheck(env, now) {
  const raw = await stateGet(env, PROMISE_KEY);
  const p = promiseCheckDue(raw, now.getTime(), ilHour(now));
  const af = p && assistantFire(env);
  if (!af) return null;
  let list = []; try { list = JSON.parse(raw || '[]'); } catch (e) { list = []; }
  const e = list.find((x) => x && x.id === p.id);
  if (!e) return null;
  e.checks = (e.checks || 0) + 1; e.checked_at = now.toISOString(); delete e.check_at;
  await stateSet(env, PROMISE_KEY, JSON.stringify(list));
  const fr = await fetch(af.url, { method: 'POST', signal: tmo(20000),
    headers: { Authorization: 'Bearer ' + af.token, 'anthropic-beta': 'experimental-cc-routine-2026-04-01', 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: promiseCheckFireText(e, now.toISOString()) }) }).catch(() => null);
  const fj = fr && fr.ok ? await fr.json().catch(() => null) : null;
  await sb(env, 'notifications_log', { method: 'POST', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify([{ id: 'wc' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), user_email: 'server', ts: now.toISOString(),
      event_type: 'promise_check', channel: fr && fr.ok ? 'routine' : 'routine_error',
      payload: { title: clip(e.text, 120), kind: 'promise_check', ref: e.id, check_no: e.checks, status: fr ? fr.status : 'network', session: (fj && fj.claude_code_session_id) || null } }]) }).catch(() => {});
  return { id: e.id, fired: !!(fr && fr.ok) };
}
export async function watch(env, now) {
  const pc = await promiseCheck(env, now).catch(() => null);
  const pr = await promiseRemind(env, now).catch(() => null);
  const r = await watchReply(env, now);
  return Object.assign({}, r, pr ? { promises: pr } : {}, pc ? { check: pc } : {});
}
async function watchReply(env, now) {
  const rows = await sb(env, 'notifications_log?select=ts,payload&event_type=eq.owner_in&order=ts.desc&limit=1').catch(() => []);
  const last = Array.isArray(rows) && rows[0];
  if (!last) return { ok: true, sent: false, reason: 'no message' };
  // 21/10/2026: a failed read is "unknown", not "no answer": the first alert ever (13:30 UTC) told Michael
  // a message from 16:19 had no answer, when the answer was logged at 16:20.
  const outs = await sb(env, 'notifications_log?select=ts,payload&event_type=eq.assistant&ts=gt.' + encodeURIComponent(last.ts) + '&limit=20').catch(() => null);
  if (!Array.isArray(outs)) return { ok: false, sent: false, error: 'could not read the answers' };
  const v = watchVerdict(last, outs, now.getTime(), await stateGet(env, WATCH_KEY).catch(() => null));
  if (!v) return { ok: true, sent: false };
  if (!env.META_PHONE_NUMBER_ID || !env.META_ACCESS_TOKEN) return { ok: false, error: 'whatsapp not configured' };
  const to = await ownerWa(env, sbFrom(env));
  if (!to) return { ok: false, error: 'no owner number in notification_prefs' };
  await stateSet(env, WATCH_KEY, v.wamid);
  const r = await sendToOwner(env, to, v.text, { windowOpen: true, noTemplate: true });
  // Its own event_type, not 'assistant': the weekly retro (retro-prompt.md 7a) counts these, and an
  // alert is not an answer to Michael's message.
  await sb(env, 'notifications_log', { method: 'POST', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify([{ id: 'ww' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), user_email: 'server', ts: now.toISOString(),
      event_type: 'watch', channel: r.ok ? 'whatsapp' : 'whatsapp_error', payload: { title: clip(v.text, 120), kind: 'watch', wamid: v.wamid, detail: r.error || null } }]) }).catch(() => {});
  return { ok: r.ok, sent: r.ok, error: r.error || null };
}

// The call itself, with the clock as an argument (tested at 07:47 Israel).
// 20/10/2026 (Michael: "do it: buttons in WhatsApp"): three questions to tap under the update, inside
// the window. A tap reaches the assistant as "1. ...", like a typed message.
export const MORNING_CHOICES = ['\u05de\u05d4 \u05d3\u05d7\u05d5\u05e3', '\u05de\u05d4 \u05de\u05d7\u05db\u05d4 \u05dc\u05d9', '\u05ea\u05e4\u05d5\u05d2\u05d5\u05ea'];
export async function run(env, now, body) {
  if (body.watch) return watch(env, now);
  if (body.calendar) return { ok: true, sent: false, cal: await calendarStep(env, now, false).catch((e) => ({ error: String(e.message || e).slice(0, 200) })) };
  if (!body.force && !body.dry && !dueNow(now)) return { ok: true, sent: false, reason: 'not 07:xx on a workday in Israel' };
  // Calendar first and on its own: a WhatsApp failure or "already sent today" does not stop it.
  const cal = await calendarStep(env, now, !!body.dry).catch((e) => ({ error: String(e.message || e).slice(0, 200) }));
  const g = await gather(env, now);
  const open = await ownerWindowOpen(env, sbFrom(env), now.getTime());
  const text = buildBrief(g.items, g.failed, g.today, !open, g.notes, g.weather, g.devDone, g.learnOpen);
  if (body.dry) return { ok: true, sent: false, dry: true, text, cal };
  if (!body.force && (await stateGet(env, LAST_KEY).catch(() => null)) === g.today) return { ok: true, sent: false, reason: 'already sent today', cal };
  if (!env.META_PHONE_NUMBER_ID || !env.META_ACCESS_TOKEN) return { ok: false, error: 'whatsapp not configured' };
  const to = await ownerWa(env, sbFrom(env));
  if (!to) return { ok: false, error: 'no owner number in notification_prefs' };
  const r = await sendToOwner(env, to, text, { windowOpen: open, choices: open ? MORNING_CHOICES : null });
  if (r.ok) { await stateSet(env, LAST_KEY, g.today).catch(() => {}); await noteLastOut(env, sbFrom(env), text, 'morning'); }
  await sb(env, 'notifications_log', { method: 'POST', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify([{ id: 'wm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), user_email: 'server', ts: now.toISOString(),
      event_type: 'assistant', channel: r.ok ? 'whatsapp' : 'whatsapp_error',
      payload: { title: clip(text, 120), kind: 'morning', via: r.via || null, wamid: r.wamid || null, detail: r.error || null } }]) }).catch(() => {});
  return { ok: r.ok, sent: r.ok, via: r.via || null, error: r.error || null, chars: text.length, cal };
}
