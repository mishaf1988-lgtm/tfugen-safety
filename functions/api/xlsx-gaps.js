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
//
// The invoice ledger (14/11/2026, stage 3 of DECISIONS 13/11/2026 "\u05e1\u05e4\u05e8 \u05d7\u05e9\u05d1\u05d5\u05e0\u05d9\u05d5\u05ea", Michael: "\u05d1\u05e6\u05e2: \u05d2\u05dd \u05e7\u05d5\u05d1\u05e5 Excel
// \u05d1\u05ea\u05d9\u05e7\u05d9\u05d9\u05d4"): after the board, the same run reads the invoices table (one read with the service key; the table
// is closed to anon) and writes 00_\u05d3\u05d5\u05d7\u05d5\u05ea \u05d5\u05de\u05e2\u05e7\u05d1/\u05e1\u05e4\u05e8 \u05d7\u05e9\u05d1\u05d5\u05e0\u05d9\u05d5\u05ea.xlsx, one sheet, replaced every night (OneDrive keeps the
// version history). It is also the backup of the table (backup-cron.js has no request budget left for it). A failed
// read or write never fails the board: it is kept in server_state.xlsx_gaps.invoices as { rows, ok, err }.
// Requests per run, worst case: 14 of Cloudflare's 50 (tests/harness/xlsx-gaps-test.mjs counts them).

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

// The invoice ledger (stage 3, 14/11/2026). One file beside the archive folder, replaced every night.
export const INV_DIR = ROOT + '00_\u05d3\u05d5\u05d7\u05d5\u05ea \u05d5\u05de\u05e2\u05e7\u05d1';
export const INV_NAME = '\u05e1\u05e4\u05e8 \u05d7\u05e9\u05d1\u05d5\u05e0\u05d9\u05d5\u05ea.xlsx';
export const INV_READ = 'invoices?select=supplier,num,amount,currency,inv_date,received_at,forwarded_at,approved_at,has_report,report_ref,chk,note&order=received_at.asc.nullslast';
export const CUR = { ILS: '\u05e9"\u05d7', EUR: '\u05d0\u05d9\u05e8\u05d5', GBP: '\u05dc\u05d9\u05e9"\u05d8', USD: '\u05d3\u05d5\u05dc\u05e8' };
// A timestamp is shown as its day in Israel (03:00 UTC is already the next day there); a plain date as is.
export const fday = (v) => {
  const s = String(v || '');
  if (!/T|\d \d/.test(s)) return fdd(s);
  const d = new Date(s);
  return isNaN(d) ? '' : fdd(d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }));
};
// rows: invoices as read; stamp: the build time as shown. Returns the one sheet. Pure.
export function invoiceSheets(rows, stamp) {
  const yes = '\u05db\u05df';
  const aoa = [['\u05e1\u05e4\u05e8 \u05d7\u05e9\u05d1\u05d5\u05e0\u05d9\u05d5\u05ea - \u05e2\u05d5\u05d3\u05db\u05df \u05d0\u05d5\u05d8\u05d5\u05de\u05d8\u05d9\u05ea \u05de\u05d4\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4: ' + stamp],
    ['\u05e1\u05e4\u05e7', '\u05de\u05e1\u05e4\u05e8 \u05d7\u05e9\u05d1\u05d5\u05e0\u05d9\u05ea', '\u05e1\u05db\u05d5\u05dd', '\u05de\u05d8\u05d1\u05e2', '\u05ea\u05d0\u05e8\u05d9\u05da \u05d7\u05e9\u05d1\u05d5\u05e0\u05d9\u05ea', '\u05d4\u05ea\u05e7\u05d1\u05dc\u05d4', '\u05d4\u05d5\u05e2\u05d1\u05e8\u05d4 \u05dc\u05d0\u05d9\u05dc\u05e0\u05d4', '\u05d0\u05d5\u05e9\u05e8\u05d4', '\u05d9\u05e9 \u05ea\u05e1\u05e7\u05d9\u05e8/\u05d3\u05d5\u05d7', '\u05dc\u05d1\u05d3\u05d5\u05e7', '\u05d4\u05e2\u05e8\u05d4']];
  (rows || []).filter(Boolean).forEach((r) => {
    const amt = r.amount === null || r.amount === undefined || r.amount === '' ? '' : Number(r.amount);
    const rep = r.has_report === true ? yes + (r.report_ref ? ' - ' + cut(r.report_ref, 80) : '') : r.has_report === false ? '\u05dc\u05d0' : cut(r.report_ref, 80);
    aoa.push([cut(r.supplier, 80), cut(r.num, 40), isNaN(amt) ? '' : amt, CUR[r.currency] || cut(r.currency, 10) || CUR.ILS,
      fdd(r.inv_date), fday(r.received_at), fday(r.forwarded_at), fday(r.approved_at), rep, r.chk === true ? yes : '', cut(r.note, 300)]);
  });
  return [{ name: '\u05e1\u05e4\u05e8 \u05d7\u05e9\u05d1\u05d5\u05e0\u05d9\u05d5\u05ea', aoa, widths: [30, 16, 12, 8, 13, 13, 15, 13, 22, 8, 50] }];
}
// Reads and writes the ledger. Never throws: returns { rows, ok, err } for the state.
export async function writeInvoices(env, token, stamp) {
  let rows = null;
  try {
    if (!token) throw new Error('no OneDrive token');
    const list = await readAll(env, INV_READ);
    rows = list.length;
    await putFile(token, INV_DIR, INV_NAME, buildXlsxBook(invoiceSheets(list, stamp)), XLSX_TYPE);
    return { rows, ok: true, err: '' };
  } catch (e) {
    return { rows, ok: false, err: String((e && e.message) || e).substring(0, 200) };
  }
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
  const cur = await fetch(G + enc(BOARD) + '?select=id,file,parentReference', { headers: h, signal: tmo(GRAPH_MS) });
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
  return { name, id: cj.id, home: cj.parentReference && cj.parentReference.id };
}
// retro 29/10/2026 (e): the board moved to the archive before the new one was written, so a write that failed left a
// day with no board in place. The archived copy goes back to its place and name (fail, never over a file).
async function unarchiveBoard(token, a) {
  if (!a || !a.id || !a.home) return false;
  const r = await fetch('https://graph.microsoft.com/v1.0/me/drive/items/' + encodeURIComponent(a.id) + '?@microsoft.graph.conflictBehavior=fail', {
    method: 'PATCH', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ parentReference: { id: a.home }, name: BOARD_NAME }), signal: tmo(GRAPH_MS) }).catch(() => null);
  return !!(r && r.ok);
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
  const stamp = fdd(today) + ' ' + stampName(now).split(' ')[1].replace('.', ':');
  let token = null;
  // The invoice ledger runs after the board, whatever the board did; its failure is only written in the state.
  const done = async (o) => { o.invoices = await writeInvoices(env, token, stamp); await save(o); return o; };
  try {
    const [docs, eq, tasks, st] = await Promise.all([
      readAll(env, 'docs?select=n,c,e,s,o,file_url'),
      readAll(env, 'equip_inspections?select=code,n,e,s,vendor,file_url,resp_area,inspection_type'),
      readAll(env, 'tasks?select=id,ext_id,title,due,status,assignee,notes,closed_date'),
      stateGet(env, [STATE_KEY]).catch(() => ({})),
    ]);
    const b = boardSheets(docs, eq, tasks, today, stamp);
    const hash = await hashOf(b.data);
    let prev = null; try { prev = JSON.parse((st && st[STATE_KEY] && st[STATE_KEY].value) || 'null'); } catch (e) { prev = null; }
    const same = !!(prev && prev.board && prev.board.hash === hash);
    token = (await accessToken(env)).token;
    const arc = same ? null : await archiveBoard(token, now);
    const archived = arc ? arc.name : null;
    const parts = BOARD.split('/'); parts.pop();
    try { await putFile(token, parts.join('/'), BOARD_NAME, buildXlsxBook(b.sheets), XLSX_TYPE); }
    catch (e) { const back = await unarchiveBoard(token, arc); e.message = String(e.message || e) + (arc ? (back ? '; the old board is back in place' : '; the old board stays in the archive') : ''); throw e; }
    const board = Object.assign({ hash, written: at, changed: !same, archived: archived || '' }, b.counts);
    const o = await done({ ok: true, error: '', board });
    return jsonResp({ ok: true, changed: !same, archived: !!archived, invoices: o.invoices.ok }, 200, {});
  } catch (e) {
    const why = String((e && e.message) || e).substring(0, 200);
    const o = await done({ ok: false, error: why });
    return jsonResp({ ok: false, error: why, invoices: o.invoices.ok }, 200, {});
  }
}
