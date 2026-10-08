// Cloudflare Pages Function: the nightly gap check between the app and the Excel control
// board (08/10/2026, Michael: "בצע: כמו בתוכנית", the line in the weekly mail).
//
// On 08/10/2026 the board "00_לוח בקרה מרכזי - בטיחות ואיכות סביבה.xlsx" was imported into
// docs, equip_inspections and tasks (xl1008-*), and the app became the source of truth. While
// Michael still edits the Excel, this finds what changed there and not in the app:
//  - "לוח זמנים" (A domain, B item, C date): an item whose date differs from the row of the
//    same name in docs / equip_inspections, or an item the app does not have at all;
//  - "משימות וליקויים" (A number, C task, E due, G status): task n is tasks.ext_id
//    'xl1008-t<n>' (1 and 9 came in earlier as fire260012-m1/m2); open on one side and closed
//    on the other, a different due date, or open in the Excel and missing in the app.
// Read only: Graph's workbook API returns the cells as text (usedRange, valuesOnly), nothing
// is written to the Excel or to the tables. The result is server_state.xlsx_gaps; the weekly
// mail shows it (xlsxGapsLine in weekly-digest.js). pg_cron calls it every night with the
// Vault secret (private.xlsx_gaps_tick).

import { jsonResp } from '../_shared.js';
import { odConfigured, accessToken, stateSet } from '../_onedrive.js';
import { readAll } from './hazard-file.js';
import { ROOT } from './od-read.js';

export const STATE_KEY = 'xlsx_gaps';
export const BOARD = ROOT + '00_\u05dc\u05d5\u05d7 \u05d1\u05e7\u05e8\u05d4 \u05de\u05e8\u05db\u05d6\u05d9 - \u05d1\u05d8\u05d9\u05d7\u05d5\u05ea \u05d5\u05d0\u05d9\u05db\u05d5\u05ea \u05e1\u05d1\u05d9\u05d1\u05d4.xlsx';
export const SHEET_DATES = '\u05dc\u05d5\u05d7 \u05d6\u05de\u05e0\u05d9\u05dd', SHEET_TASKS = '\u05de\u05e9\u05d9\u05de\u05d5\u05ea \u05d5\u05dc\u05d9\u05e7\u05d5\u05d9\u05d9\u05dd';
export const GAPS_MAX = 60;
// Board items kept in the app under other names (49 inspections imported 04/10, the plan in
// docs) or grouped there; not compared.
export const ELSEWHERE = [
  '\u05d2\u05dc\u05d0\u05d9 \u05d0\u05de\u05d5\u05e0\u05d9\u05d4 \u2013 \u05db\u05d9\u05d5\u05dc',
  '\u05de\u05dc\u05d2\u05d6\u05d5\u05ea',
  '\u05e6\u05d9\u05d5\u05d3 \u05d5\u05d0\u05d1\u05d9\u05d6\u05e8\u05d9 \u05d4\u05e8\u05de\u05d4',
  '\u05d0\u05d1\u05d9\u05d6\u05e8\u05d9 \u05d4\u05e8\u05de\u05d4 (\u05de\u05d7\u05e1\u05df)',
  '\u05d1\u05de\u05d5\u05ea \u05de\u05ea\u05e8\u05d5\u05de\u05de\u05d5\u05ea',
  '\u05de\u05d9\u05db\u05dc \u05e4\u05e1\u05d5\u05dc\u05ea \u05e2\u05dc \u05de\u05dc\u05d2\u05d6\u05d4',
  '\u05e7\u05d5\u05dc\u05d8\u05d9 \u05d0\u05d5\u05d5\u05d9\u05e8',
  '\u05e7\u05d5\u05dc\u05d8\u05d9 \u05e7\u05d9\u05d8\u05d5\u05e8',
  '\u05d3\u05d5\u05d5\u05d3\u05d9 \u05e7\u05d9\u05d8\u05d5\u05e8 SB-101/102 - \u05d1\u05d3\u05d9\u05e7\u05d4 \u05e7\u05e8\u05d4',
  '\u05d0\u05d5\u05d8\u05d5\u05e7\u05dc\u05d1',
  '\u05db\u05d9\u05d5\u05dc \u05d2\u05dc\u05d0\u05d9 \u05d0\u05de\u05d5\u05e0\u05d9\u05d4 \u05e0\u05d9\u05d9\u05d7\u05d9\u05dd (26 \u05d2\u05dc\u05d0\u05d9\u05dd, VARIOGARD)',
  '\u05db\u05d9\u05d5\u05dc \u05d2\u05dc\u05d0\u05d9 \u05d2\u05d6\u05d9\u05dd \u05d3\u05dc\u05d9\u05e7\u05d9\u05dd PEX-3000 / VARIOGARD 3200 (3 \u05d2\u05dc\u05d0\u05d9\u05dd)',
  '\u05db\u05d9\u05d5\u05dc \u05de\u05db\u05e9\u05d5\u05e8 \u05de\u05ea\u05e7\u05df \u05d8\u05d9\u05e4\u05d5\u05dc \u05d1\u05e9\u05e4\u05db\u05d9\u05dd (6 \u05de\u05db\u05e9\u05d9\u05e8\u05d9\u05dd)',
  '\u05ea\u05d5\u05db\u05e0\u05d9\u05ea \u05dc\u05e0\u05d9\u05d4\u05d5\u05dc \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea (\u05e9\u05e0\u05ea\u05d9\u05ea)',
  '\u05d8\u05d5\u05e4\u05e1 3 - \u05d0\u05d9\u05e9\u05d5\u05e8 \u05ea\u05e7\u05d9\u05e0\u05d5\u05ea \u05de\u05e2\u05e8\u05db\u05ea \u05d7\u05e9\u05de\u05dc \u05d5\u05ea\u05d0\u05d5\u05e8\u05ea \u05d7\u05d9\u05e8\u05d5\u05dd (\u05db\u05d1\u05d0\u05d5\u05ea)',
  '\u05d2\u05e0\u05e8\u05d8\u05d5\u05e8 \u05d7\u05d9\u05e8\u05d5\u05dd 50 \u05e7\u05d5"\u05d0 - \u05d1\u05d3\u05d9\u05e7\u05ea \u05d7\u05e9\u05de\u05dc\u05d0\u05d9 \u05d1\u05d5\u05d3\u05e7 (\u05d3\u05e8\u05d9\u05e9\u05d4: \u05d0\u05d7\u05ea \u05dc-5 \u05e9\u05e0\u05d9\u05dd \u05dc\u05e4\u05d7\u05d5\u05ea, \u05de\u05d1\u05d5\u05e6\u05e2 \u05db\u05dc \u05e9\u05e0\u05d4)',
];
const TASK_ALIAS = { 1: 'fire260012-m1', 9: 'fire260012-m2' };

// "04.08.2027" or "04/08/2027" -> "2027-08-04"; anything else (empty, "-", "ללא תוקף") -> null.
export function xlDate(t) {
  const m = /^\s*(\d{1,2})[./](\d{1,2})[./](\d{4})\s*$/.exec(String(t == null ? '' : t));
  return m ? m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2) : null;
}
const closedXl = (s) => /^\s*(\u05d4\u05d5\u05e9\u05dc\u05dd|\u05dc\u05d0 \u05e8\u05dc\u05d5\u05d5\u05e0\u05d8\u05d9)/.test(String(s || ''));
const closedApp = (s) => s === '\u05d4\u05d5\u05e9\u05dc\u05dd' || s === '\u05d1\u05d5\u05d8\u05dc';
const nm = (s) => String(s || '').replace(/\s+/g, ' ').trim();

// dates: rows of "לוח זמנים"; tasks: rows of "משימות וליקויים" (text, as Graph returns them).
// app: {items: [{n, e}], tasks: [{ext_id, id, title, due, status}]}. Pure.
export function findGaps(dates, tasks, app) {
  const gaps = [];
  const skip = new Set(ELSEWHERE.map(nm));
  const byName = new Map();
  (app.items || []).forEach((x) => { const k = nm(x.n); if (k && !byName.has(k)) byName.set(k, x); });
  (dates || []).forEach((r) => {
    const dom = nm(r[0]), item = nm(r[1]);
    if (!dom || !item || dom === '\u05ea\u05d7\u05d5\u05dd' || /^\u05de\u05e9\u05d9\u05de\u05d4/.test(dom) || skip.has(item)) return;
    const a = byName.get(item), xl = xlDate(r[2]);
    if (!a) gaps.push({ k: 'missing', n: item, xl });
    else if ((a.e || null) !== xl) gaps.push({ k: 'date', n: item, app: a.e || null, xl });
  });
  const byExt = new Map();
  (app.tasks || []).forEach((t) => { if (t.ext_id) byExt.set(t.ext_id, t); if (t.id) byExt.set(t.id, t); });
  (tasks || []).forEach((r) => {
    const n = parseInt(String(r[0] || '').trim(), 10);
    if (!(n > 0) || String(n) !== String(r[0]).trim()) return;
    const title = nm(r[2]), t = byExt.get(TASK_ALIAS[n] || 'xl1008-t' + n), xlClosed = closedXl(r[6]);
    if (!t) { if (!xlClosed) gaps.push({ k: 'task-missing', n: title, xl: xlDate(r[4]) }); return; }
    if (xlClosed !== closedApp(t.status)) gaps.push({ k: 'task-state', n: title, app: t.status, xl: String(r[6] || '').split(' - ')[0].trim() });
    else if (!xlClosed && (t.due || null) !== xlDate(r[4])) gaps.push({ k: 'task-due', n: title, app: t.due || null, xl: xlDate(r[4]) });
  });
  return gaps.slice(0, GAPS_MAX);
}

const G = 'https://graph.microsoft.com/v1.0/me/drive/root:/';
export function rangeUrl(sheet) {
  return G + BOARD.split('/').map(encodeURIComponent).join('/') + ':/workbook/worksheets/' + encodeURIComponent(sheet) + '/usedRange(valuesOnly=true)?$select=text';
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return jsonResp({ error: 'method not allowed' }, 405, {});
  const want = env.TRUSTEE_NOTIFY_SECRET;
  if (!want || (request.headers.get('x-notify-secret') || '') !== want) return jsonResp({ error: 'forbidden' }, 403, {});
  if (!odConfigured(env) || !env.SUPABASE_SERVICE_ROLE_KEY) return jsonResp({ ok: false, error: 'server not configured' }, 200, {});
  const at = new Date().toISOString();
  const save = (o) => stateSet(env, { [STATE_KEY]: JSON.stringify(Object.assign({ at }, o)) }).catch(() => {});
  try {
    const { token } = await accessToken(env);
    const sheet = async (name) => {
      const r = await fetch(rangeUrl(name), { headers: { Authorization: 'Bearer ' + token } });
      if (r.status !== 200) throw new Error('sheet ' + r.status);
      return ((await r.json()).text) || [];
    };
    const [dates, tasks, docs, eq, tk] = await Promise.all([
      sheet(SHEET_DATES), sheet(SHEET_TASKS),
      readAll(env, 'docs?select=n,e'), readAll(env, 'equip_inspections?select=n,e'),
      readAll(env, 'tasks?select=id,ext_id,title,due,status'),
    ]);
    if (!dates.length || !tasks.length) throw new Error('empty sheet');
    const gaps = findGaps(dates, tasks, { items: docs.concat(eq), tasks: tk });
    await save({ ok: true, error: '', gaps });
    return jsonResp({ ok: true, gaps: gaps.length }, 200, {});
  } catch (e) {
    const why = String((e && e.message) || e).substring(0, 200);
    await save({ ok: false, error: why, gaps: [] });
    return jsonResp({ ok: false, error: why }, 200, {});
  }
}
