// Cloudflare Pages Function: the control board in Excel, rebuilt from the app every night (28/10/2026,
// Michael in the questionnaire: "\u05d1\u05e6\u05e2: \u05e2\u05d3\u05db\u05d5\u05df \u05d0\u05d5\u05d8\u05d5\u05de\u05d8\u05d9 \u05de\u05d4\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4 (\u05de\u05d5\u05de\u05dc\u05e5)"; DECISIONS 28/10/2026 replaces 08/10).
//
// Until 28/10 this endpoint read "00_\u05dc\u05d5\u05d7 \u05d1\u05e7\u05e8\u05d4 \u05de\u05e8\u05db\u05d6\u05d9 - \u05d1\u05d8\u05d9\u05d7\u05d5\u05ea \u05d5\u05d0\u05d9\u05db\u05d5\u05ea \u05e1\u05d1\u05d9\u05d1\u05d4.xlsx" and listed what the Excel said and
// the app did not (the gap check of 08/10/2026). The board was last edited on 11/10, so it showed stale dates
// while the app was right (the full validity check of 28/10/2026). Now the app writes the board: three sheets from
// docs, equip_inspections and tasks, same name, same place. A row the app marks "\u05dc\u05d0 \u05e8\u05dc\u05d5\u05d5\u05e0\u05d8\u05d9" is left out.
// Read only for people: a change in the Excel does not come back to the app.
//
// Written every night, so the days left are right. When the stored values changed since the last run (a hash in
// server_state.xlsx_gaps), the board in place first moves to 00_\u05d3\u05d5\u05d7\u05d5\u05ea \u05d5\u05de\u05e2\u05e7\u05d1/_\u05d2\u05e8\u05e1\u05d0\u05d5\u05ea \u05e7\u05d5\u05d3\u05de\u05d5\u05ea with the date in its
// name; otherwise the new one replaces it (OneDrive keeps its version history). Nothing is deleted.
// pg_cron calls it every night with the Vault secret (private.xlsx_gaps_tick, 03:05 UTC); the path and the state
// key kept their old names so the cron and the weekly mail line did not have to move.

import { jsonResp, GRAPH_TIMEOUT_MS as GRAPH_MS, tmo } from '../_shared.js';
import { odConfigured, accessToken, stateGet, stateSet, putFile } from '../_onedrive.js';
import { buildXlsxBook, XLSX_TYPE } from '../_xlsx.js';
import { readAll } from './hazard-file.js';
import { ROOT } from './od-read.js';

export const STATE_KEY = 'xlsx_gaps';
export const BOARD_NAME = '00_\u05dc\u05d5\u05d7 \u05d1\u05e7\u05e8\u05d4 \u05de\u05e8\u05db\u05d6\u05d9 - \u05d1\u05d8\u05d9\u05d7\u05d5\u05ea \u05d5\u05d0\u05d9\u05db\u05d5\u05ea \u05e1\u05d1\u05d9\u05d1\u05d4.xlsx';
export const BOARD = ROOT + BOARD_NAME;
export const ARCHIVE = ROOT + '00_\u05d3\u05d5\u05d7\u05d5\u05ea \u05d5\u05de\u05e2\u05e7\u05d1/_\u05d2\u05e8\u05e1\u05d0\u05d5\u05ea \u05e7\u05d5\u05d3\u05de\u05d5\u05ea';
// A row taken out of tracking on purpose (Michael, 08/10/2026).
export const OFF = /^\s*\u05dc\u05d0 \u05e8\u05dc\u05d5\u05d5\u05e0\u05d8\u05d9/;
const DAY = 86400000;
const ymd = (v) => (/^\d{4}-\d{2}-\d{2}/.test(String(v || '')) ? String(v).substring(0, 10) : null);
export const fdd = (v) => { const d = ymd(v); return d ? d.substring(8, 10) + '/' + d.substring(5, 7) + '/' + d.substring(0, 4) : ''; };
export const daysTo = (v, today) => { const d = ymd(v); return d ? Math.round((Date.parse(d) - Date.parse(today)) / DAY) : null; };
// Thresholds of the old board's legend: over 90 days fine, 31-90 near, up to 30 urgent, past expired.
export const BANDS = ['\u05e4\u05d2 \u05ea\u05d5\u05e7\u05e3', '\u05d3\u05d7\u05d5\u05e3', '\u05e7\u05e8\u05d5\u05d1', '\u05ea\u05e7\u05d9\u05df', '\u05dc\u05dc\u05d0 \u05ea\u05d0\u05e8\u05d9\u05da'];
export function band(days) { return days === null ? 4 : days < 0 ? 0 : days <= 30 ? 1 : days <= 90 ? 2 : 3; }
// A link only to the two places files live (28/10/2026 security review: the label hides the host).
export const LINK_HOST = /^https:\/\/([a-z0-9-]+\.)*(sharepoint\.com|supabase\.co)\//i;
const link = (u) => (LINK_HOST.test(String(u || '')) ? { text: '\u05e4\u05ea\u05d7 \u05e7\u05d5\u05d1\u05e5', link: String(u) } : '');
const closed = (s) => s === '\u05d4\u05d5\u05e9\u05dc\u05dd' || s === '\u05d1\u05d5\u05d8\u05dc';
const cut = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().substring(0, n);

// The equipment domain: the responsibility area, else calibrations ("\u05d0\u05d7\u05e8") or inspections.
export function eqDomain(r) { return cut(r.resp_area, 40) || (r.inspection_type === '\u05d0\u05d7\u05e8' ? '\u05db\u05d9\u05d5\u05dc\u05d9\u05dd \u05d5\u05d1\u05d3\u05d9\u05e7\u05d5\u05ea' : '\u05ea\u05e1\u05e7\u05d9\u05e8\u05d9 \u05e6\u05d9\u05d5\u05d3'); }

// docs, eq, tasks: rows as read; today: YYYY-MM-DD (Israel). Returns { sheets, data, counts }. data is what the
// hash covers: the stored values only, not the days left or the band, which move every night (28/10/2026
// security review: with them in, every night counted as a change and was archived). Pure.
export function boardSheets(docs, eq, tasks, today, stamp) {
  const items = [];
  (docs || []).forEach((r) => { if (r && !OFF.test(String(r.s || ''))) items.push({ dom: cut(r.c, 40) || '\u05de\u05e1\u05de\u05db\u05d9\u05dd', n: cut(r.n, 120), e: ymd(r.e), who: cut(r.o, 60), url: r.file_url }); });
  (eq || []).forEach((r) => { if (r && !OFF.test(String(r.s || ''))) items.push({ dom: eqDomain(r), n: cut((r.code ? r.code + ' - ' : '') + (r.n || ''), 120), e: ymd(r.e), who: cut(r.vendor, 60), url: r.file_url }); });
  items.forEach((x) => { x.days = daysTo(x.e, today); x.b = band(x.days); });
  items.sort((a, b) => (a.days === null) - (b.days === null) || (a.days || 0) - (b.days || 0) || a.dom.localeCompare(b.dom) || a.n.localeCompare(b.n));

  const doms = {};
  items.forEach((x) => { const d = doms[x.dom] || (doms[x.dom] = [0, 0, 0, 0, 0]); d[x.b]++; });
  const names = Object.keys(doms).sort((a, b) => a.localeCompare(b));
  const tot = [0, 0, 0, 0, 0];
  const sum = [['\u05ea\u05d7\u05d5\u05dd', '\u05e1\u05d4"\u05db'].concat(BANDS)];
  names.forEach((n) => { const d = doms[n]; d.forEach((v, i) => { tot[i] += v; }); sum.push([n, d.reduce((a, b) => a + b, 0)].concat(d)); });
  sum.push(['\u05e1\u05d4"\u05db', items.length].concat(tot));

  const tk = (tasks || []).filter(Boolean).map((t) => ({ t, days: daysTo(t.due, today), done: closed(t.status) }));
  tk.sort((a, b) => a.done - b.done || (a.days === null) - (b.days === null) || (a.days || 0) - (b.days || 0) || String(a.t.title || '').localeCompare(String(b.t.title || '')));
  const open = tk.filter((x) => !x.done), late = open.filter((x) => x.days !== null && x.days < 0);

  sum.push([]);
  sum.push(['\u05de\u05e9\u05d9\u05de\u05d5\u05ea \u05e4\u05ea\u05d5\u05d7\u05d5\u05ea: ' + open.length + ', \u05de\u05d4\u05df \u05d1\u05d0\u05d9\u05d7\u05d5\u05e8: ' + late.length + '. \u05d4\u05e4\u05d9\u05e8\u05d5\u05d8 \u05d1\u05d2\u05d9\u05dc\u05d9\u05d5\u05df "\u05de\u05e9\u05d9\u05de\u05d5\u05ea \u05d5\u05dc\u05d9\u05e7\u05d5\u05d9\u05d9\u05dd".']);
  sum.push(['\u05de\u05e7\u05e8\u05d0: \u05ea\u05e7\u05d9\u05df = \u05de\u05e2\u05dc 90 \u05d9\u05d5\u05dd, \u05e7\u05e8\u05d5\u05d1 = 31-90 \u05d9\u05d5\u05dd, \u05d3\u05d7\u05d5\u05e3 = \u05e2\u05d3 30 \u05d9\u05d5\u05dd, \u05e4\u05d2 \u05ea\u05d5\u05e7\u05e3 = \u05e2\u05d1\u05e8 \u05d4\u05ea\u05d0\u05e8\u05d9\u05da.']);
  sum.push(['\u05e7\u05d5\u05d1\u05e5 \u05dc\u05e7\u05e8\u05d9\u05d0\u05d4 \u05d1\u05dc\u05d1\u05d3: \u05e9\u05d9\u05e0\u05d5\u05d9 \u05db\u05d0\u05df \u05dc\u05d0 \u05d7\u05d5\u05d6\u05e8 \u05dc\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4. \u05de\u05e2\u05d3\u05db\u05e0\u05d9\u05dd \u05d1\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4, \u05d5\u05d4\u05e7\u05d5\u05d1\u05e5 \u05e0\u05d1\u05e0\u05d4 \u05de\u05d7\u05d3\u05e9 \u05d1\u05dc\u05d9\u05dc\u05d4.']);

  const sched = [['\u05ea\u05d7\u05d5\u05dd', '\u05e4\u05e8\u05d9\u05d8', '\u05ea\u05d0\u05e8\u05d9\u05da \u05ea\u05d5\u05e7\u05e3', '\u05d9\u05de\u05d9\u05dd', '\u05e1\u05d8\u05d8\u05d5\u05e1', '\u05e1\u05e4\u05e7 / \u05d2\u05d5\u05e8\u05dd', '\u05e7\u05d9\u05e9\u05d5\u05e8']];
  items.forEach((x) => sched.push([x.dom, x.n, fdd(x.e), x.days === null ? '' : x.days, BANDS[x.b], x.who, link(x.url)]));
  const tasksAoa = [['\u05de\u05e1"\u05d3', '\u05de\u05e9\u05d9\u05de\u05d4 / \u05dc\u05d9\u05e7\u05d5\u05d9', '\u05ea\u05d0\u05e8\u05d9\u05da \u05d9\u05e2\u05d3', '\u05d9\u05de\u05d9\u05dd', '\u05e1\u05d8\u05d8\u05d5\u05e1', '\u05d0\u05d7\u05e8\u05d0\u05d9', '\u05d4\u05e2\u05e8\u05d5\u05ea', '\u05ea\u05d0\u05e8\u05d9\u05da \u05e1\u05d2\u05d9\u05e8\u05d4']];
  tk.forEach((x) => tasksAoa.push([cut(x.t.ext_id || x.t.id, 30), cut(x.t.title, 200), fdd(x.t.due), x.done || x.days === null ? '' : x.days,
    cut(x.t.status, 30) + (!x.done && x.days !== null && x.days < 0 ? ' - \u05d1\u05d0\u05d9\u05d7\u05d5\u05e8' : ''), cut(x.t.assignee, 60), cut(x.t.notes, 300), fdd(x.t.closed_date)]));

  const data = { items: items.map((x) => [x.dom, x.n, x.e, x.who, x.url || '']), tasks: tk.map((x) => [x.t.ext_id || x.t.id, x.t.title, x.t.due, x.t.status, x.t.assignee, x.t.notes, x.t.closed_date]) };
  const head = sum.concat([[], ['\u05e2\u05d5\u05d3\u05db\u05df \u05d0\u05d5\u05d8\u05d5\u05de\u05d8\u05d9\u05ea \u05de\u05d4\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4: ' + stamp]]);
  return {
    data,
    counts: { items: items.length, expired: tot[0], urgent: tot[1], open: open.length, late: late.length },
    sheets: [
      { name: '\u05dc\u05d5\u05d7 \u05d1\u05e7\u05e8\u05d4 \u05e8\u05d0\u05e9\u05d9', aoa: head, widths: [70, 10, 10, 10, 10, 10, 12] },
      { name: '\u05dc\u05d5\u05d7 \u05d6\u05de\u05e0\u05d9\u05dd', aoa: sched, widths: [18, 60, 13, 8, 12, 26, 11] },
      { name: '\u05de\u05e9\u05d9\u05de\u05d5\u05ea \u05d5\u05dc\u05d9\u05e7\u05d5\u05d9\u05d9\u05dd', aoa: tasksAoa, widths: [16, 60, 13, 8, 18, 18, 50, 13] },
    ],
  };
}

export async function hashOf(data) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(data)));
  return Array.from(new Uint8Array(b)).map((x) => ('0' + x.toString(16)).slice(-2)).join('').substring(0, 32);
}
// "DD-MM-YYYY HH.MM" in Israel time, for the archived copy's name (no "/" in a file name).
export function stampName(d) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d).map((x) => [x.type, x.value]));
  return p.day + '-' + p.month + '-' + p.year + ' ' + p.hour + '.' + p.minute;
}

const G = 'https://graph.microsoft.com/v1.0/me/drive/root:/';
const enc = (p) => String(p).split('/').filter(Boolean).map(encodeURIComponent).join('/');

// Moves the board in place, if any, into ARCHIVE (made if missing) with the date in its name. Returns the new
// name, or null when there was no board. conflictBehavior=fail: a copy is never overwritten.
async function archiveBoard(token, now) {
  const h = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
  const cur = await fetch(G + enc(BOARD) + '?select=id,file', { headers: h, signal: tmo(GRAPH_MS) });
  if (cur.status === 404) return null;
  if (!cur.ok) throw new Error('board ' + cur.status);
  const cj = await cur.json();
  if (!cj.file) throw new Error('board is not a file');
  let dir = await fetch(G + enc(ARCHIVE) + '?select=id,folder', { headers: h, signal: tmo(GRAPH_MS) });
  if (dir.status === 404) {
    const parts = ARCHIVE.split('/'), leaf = parts.pop();
    const par = await fetch(G + enc(parts.join('/')) + '?select=id', { headers: h, signal: tmo(GRAPH_MS) });
    if (!par.ok) throw new Error('archive parent ' + par.status);
    dir = await fetch('https://graph.microsoft.com/v1.0/me/drive/items/' + encodeURIComponent((await par.json()).id) + '/children', {
      method: 'POST', headers: h, body: JSON.stringify({ name: leaf, folder: {}, '@microsoft.graph.conflictBehavior': 'fail' }), signal: tmo(GRAPH_MS) });
    if (!dir.ok) throw new Error('archive create ' + dir.status);
  } else if (!dir.ok) throw new Error('archive ' + dir.status);
  const dj = await dir.json();
  const name = BOARD_NAME.replace(/\.xlsx$/, '') + ' - ' + stampName(now) + '.xlsx';
  const mv = await fetch('https://graph.microsoft.com/v1.0/me/drive/items/' + encodeURIComponent(cj.id) + '?@microsoft.graph.conflictBehavior=fail', {
    method: 'PATCH', headers: h, body: JSON.stringify({ parentReference: { id: dj.id }, name }), signal: tmo(GRAPH_MS) });
  if (!mv.ok) throw new Error('archive move ' + mv.status);
  return name;
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return jsonResp({ error: 'method not allowed' }, 405, {});
  const want = env.TRUSTEE_NOTIFY_SECRET;
  if (!want || (request.headers.get('x-notify-secret') || '') !== want) return jsonResp({ error: 'forbidden' }, 403, {});
  if (!odConfigured(env) || !env.SUPABASE_SERVICE_ROLE_KEY) return jsonResp({ ok: false, error: 'server not configured' }, 200, {});
  const now = new Date(), at = now.toISOString();
  const today = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
  const save = (o) => stateSet(env, { [STATE_KEY]: JSON.stringify(Object.assign({ at, gaps: [] }, o)) }).catch(() => {});
  try {
    const [docs, eq, tasks, st] = await Promise.all([
      readAll(env, 'docs?select=n,c,e,s,o,file_url'),
      readAll(env, 'equip_inspections?select=code,n,e,s,vendor,file_url,resp_area,inspection_type'),
      readAll(env, 'tasks?select=id,ext_id,title,due,status,assignee,notes,closed_date'),
      stateGet(env, [STATE_KEY]).catch(() => ({})),
    ]);
    const b = boardSheets(docs, eq, tasks, today, fdd(today) + ' ' + stampName(now).split(' ')[1].replace('.', ':'));
    const hash = await hashOf(b.data);
    let prev = null; try { prev = JSON.parse((st && st[STATE_KEY] && st[STATE_KEY].value) || 'null'); } catch (e) { prev = null; }
    const same = !!(prev && prev.board && prev.board.hash === hash);
    const { token } = await accessToken(env);
    const archived = same ? null : await archiveBoard(token, now);
    const parts = BOARD.split('/'); parts.pop();
    await putFile(token, parts.join('/'), BOARD_NAME, buildXlsxBook(b.sheets), XLSX_TYPE);
    const board = Object.assign({ hash, written: at, changed: !same, archived: archived || '' }, b.counts);
    await save({ ok: true, error: '', board });
    return jsonResp({ ok: true, changed: !same, archived: !!archived }, 200, {});
  } catch (e) {
    const why = String((e && e.message) || e).substring(0, 200);
    await save({ ok: false, error: why });
    return jsonResp({ ok: false, error: why }, 200, {});
  }
}
