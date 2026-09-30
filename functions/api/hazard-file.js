// Cloudflare Pages Function: the folder-13 hazard workbook, kept up to date by
// the server (28/09, Michael: "the existing file, same sheets and macros",
// "one merged report, the notes say manager or trustee", "everything in the
// safety-management folder and in the cloud"). DECISIONS 2026-09-28.
//
// The EXISTING files in sviva's OneDrive (synced to the office PC):
//   שולחן העבודה/ניהול בטיחות/13_סיורי מפגעים/2026/ניהול סיורי מפגעים.xlsm
//   ... and its twin ניהול סיורי מפגעים.xlsx
// Only rows 2..206, columns A..M of the sheet "מאגר מפגעים" are rewritten
// (functions/_xlsxpatch.js). Everything else stays: the macro, the formulas
// (columns N/O, and every report sheet, recalculated when Excel opens the
// file), validation, formatting, "נמענים", "דוח לשליחה".
//
// The rows, one merged register:
//   * every manager tour hazard (tour_hazards), by מס"ד; notes start with
//     "דיווח ממונה";
//   * every trustee finding (trustee_reports, a ליקוי on tasks 1-7), numbered
//     נ-1, נ-2 ... by report time; notes start with "דיווח נאמן: <name>".
//     A trustee has no severity, responsible or target: בינונית, מנהל המחלקה
//     and report date + 3 days (Michael, 28/09). "פעולה נדרשת" says
//     "סיור נאמן: <name>", because the department report (the macro) sends
//     columns A..K and not the notes. When the finding has a recommended
//     corrective action (trustee_reports.action, filled by the assistant, edited
//     by the manager) it comes first: "<action> (סיור נאמן: <name>)". Department = the part of the
//     location before " · ". Closed = s נסגר, closing date from the task-8
//     report that closed it.
//
// Nothing a person typed is lost: before the first write the file is copied to
// ארכיון/לפני כתיבה ראשונה מהאפליקציה, and whenever the file changed since the
// server last wrote it (someone saved it in Excel), that version is copied to
// ארכיון/גרסאות שנדרסו before it is replaced.
//
// Two-way (28/09): a person who saves the file in Excel changes the app. See
// diffEdits below: action / status / closing date / notes, and new rows.
//
// Callers: statement triggers on tour_hazards / trustee_reports and a
// 15-minute pg_cron tick (x-notify-secret), and the app (op:'status',
// force:true; admin/manager session). One file per request (CPU budget): the
// xlsm, then the request calls itself for the xlsx.

import { defaultAllowedOrigins, corsHeaders, jsonResp, requireRole } from '../_shared.js';
import { odConfigured, accessToken, stateGet, stateSet, tokenRow, runLeased } from '../_onedrive.js';
import { patchSheetRows, sheetsDigest, readSheetRows, picInfo, PIC_ROW_PT } from '../_xlsxpatch.js';
import { suggestAction } from '../_ai.js';
import { runWatch, WATCH_KEY } from '../_watchdog.js';

export const FOLDER_BASE = '\u05e9\u05d5\u05dc\u05d7\u05df \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4/\u05e0\u05d9\u05d4\u05d5\u05dc \u05d1\u05d8\u05d9\u05d7\u05d5\u05ea/13_\u05e1\u05d9\u05d5\u05e8\u05d9 \u05de\u05e4\u05d2\u05e2\u05d9\u05dd';
// A file per year (upgrade review 24, Michael 30/09/2026: «a new file every
// year», numbering continues): the folder is 13_.../<year>, Israel time. On
// the first run of a year the server copies last year's file, as it is, into
// the new folder (yearItem), and last year's stops being written.
export const FIRST_YEAR = 2026;
export const ilYear = (d) => +new Date(d || Date.now()).toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }).substring(0, 4);
export const folderFor = (y) => FOLDER_BASE + '/' + y;
// The first year's folder. Runs use folderFor(ilYear()), so the year is
// read when they run, not when the module was loaded.
export const FOLDER = folderFor(FIRST_YEAR);
// The file of `year` in its folder; when it is not there yet and last year's
// is, last year's is copied in first, as it is (a change typed there and not
// yet taken is taken from the copy on this run). Returns the metadata response.
export async function yearItem(token, name, type, year, select) {
  const auth = { Authorization: 'Bearer ' + token };
  const get = (y, sel) => fetch(G + seg(folderFor(y)) + '/' + encodeURIComponent(name) + '?select=' + sel, { headers: auth });
  let mr = await get(year, select);
  if (mr.status !== 404 || year <= FIRST_YEAR) return { mr, rolled: false };
  const pr = await get(year - 1, 'id,@microsoft.graph.downloadUrl');
  if (!pr.ok) return { mr, rolled: false };
  const dl = await fetch((await pr.json())['@microsoft.graph.downloadUrl']);
  if (!dl.ok) throw new Error('download failed (' + dl.status + ')');
  await graphPut(token, folderFor(year), name, new Uint8Array(await dl.arrayBuffer()), type);
  mr = await get(year, select);
  return { mr, rolled: true };
}
// The rows of the file of `year`: that year's hazards, everything still open,
// and what was closed in that year. A hazard closed in an earlier year stays
// in that year's file and in the app. The first year keeps everything.
export const FULL_WARN = 164;
export function yearReg(reg, year) {
  if (year <= FIRST_YEAR) return reg;
  const y = (v) => { const d = v && typeof v === 'object' ? v.date : v; return d ? +String(d).substring(0, 4) : 0; };
  const rows = [], ids = [];
  reg.rows.forEach((r, i) => { if (y(r[1]) >= year || r[10] !== '\u05e1\u05d2\u05d5\u05e8' || y(r[11]) >= year) { rows.push(r); ids.push(reg.ids[i]); } });
  return { rows, ids };
}
export const FILES = {
  xlsm: { name: '\u05e0\u05d9\u05d4\u05d5\u05dc \u05e1\u05d9\u05d5\u05e8\u05d9 \u05de\u05e4\u05d2\u05e2\u05d9\u05dd.xlsm', type: 'application/vnd.ms-excel.sheet.macroEnabled.12' },
  xlsx: { name: '\u05e0\u05d9\u05d4\u05d5\u05dc \u05e1\u05d9\u05d5\u05e8\u05d9 \u05de\u05e4\u05d2\u05e2\u05d9\u05dd.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
};
const SHEET = '\u05de\u05d0\u05d2\u05e8 \u05de\u05e4\u05d2\u05e2\u05d9\u05dd';
const LAST_COL = 12, MAX_ROW = 206, DATE_COLS = [1, 9, 11];
// In the signature: a change in how the file is written (29/09/2026: the filter
// on open hazards, then row heights that fit the text) reaches the file once,
// without waiting for the data to change.
const FILE_VERSION = 4;
export const DEPTS = ['\u05de\u05e2\u05e6\u05d1\u05d9\u05dd', '\u05d9\u05d9\u05e6\u05d5\u05e8 \u05d8\u05d5\u05d2\u05e0\u05d9\u05dd', '\u05d7\u05d5\u05de\u05e8 \u05d2\u05dc\u05dd', '\u05ea\u05d5\u05e6\u05d2', '\u05de\u05e2\u05d1\u05d3\u05d5\u05ea'];
// Area (the part of a trustee's loc before "\u00b7", or column D of a row typed in
// the file) -> the report's department. ONE map, the same object as AREA_DEPT
// in index.html (area-dept-map-test.mjs fails if they differ). Spellings of
// the departments, and the areas Michael assigned on 29/09/2026: packing and
// peeling to production, the lab to the labs. Yard, waste water and
// infrastructure were "no department" until 30/09/2026, when Michael moved
// them to maintenance («a classic finding for maintenance»): אחזקה is a sixth
// department of the department report (REPORT_DEPTS). The deck and the
// meeting data keep the five (DEPTS): the deck's chart has five columns.
// An area not in the map is still no department (null), shown in red.
export const AREA_DEPT = { '\u05de\u05e2\u05d5\u05e6\u05d1\u05d9\u05dd': '\u05de\u05e2\u05e6\u05d1\u05d9\u05dd', '\u05ea\u05d5\u05e6"\u05d2': '\u05ea\u05d5\u05e6\u05d2', '\u05de\u05e2\u05d1\u05d3\u05d4': '\u05de\u05e2\u05d1\u05d3\u05d5\u05ea', '\u05d0\u05e8\u05d9\u05d6\u05d4': '\u05d9\u05d9\u05e6\u05d5\u05e8 \u05d8\u05d5\u05d2\u05e0\u05d9\u05dd', '\u05e7\u05d9\u05dc\u05d5\u05e4\u05d9\u05dd': '\u05d9\u05d9\u05e6\u05d5\u05e8 \u05d8\u05d5\u05d2\u05e0\u05d9\u05dd', '\u05d7\u05e6\u05e8': '\u05d0\u05d7\u05d6\u05e7\u05d4', '\u05e9\u05e4\u05db\u05d9\u05dd': '\u05d0\u05d7\u05d6\u05e7\u05d4', '\u05ea\u05e9\u05ea\u05d9\u05d5\u05ea': '\u05d0\u05d7\u05d6\u05e7\u05d4' };
export const MAINT = '\u05d0\u05d7\u05d6\u05e7\u05d4';
export const REPORT_DEPTS = DEPTS.concat([MAINT]);
export const NO_DEPT = '\u05dc\u05dc\u05d0 \u05de\u05d7\u05dc\u05e7\u05d4';
// A department of the report, or null (no department / an area not in the map).
// Several areas ("A + B", a trustee picked two; 30/09/2026): maintenance when one of them
// is a maintenance area (Michael: that finding is maintenance's), else the
// first one that has a department.
export function deptOf(name) {
  const h = String(name || '').trim();
  if (REPORT_DEPTS.indexOf(h) >= 0) return h;
  if (Object.prototype.hasOwnProperty.call(AREA_DEPT, h)) return AREA_DEPT[h];
  const parts = h.split(/\s*\+\s*/).filter(Boolean);
  if (parts.length < 2) return null;
  const ds = parts.map((x) => deptOf(x));
  return ds.indexOf(MAINT) >= 0 ? MAINT : ds.find((d) => d) || null;
}
// Who handles a trustee finding (column H): the department's manager, and in
// the maintenance department maintenance or electrical by the finding
// (Michael 30/09/2026: «all these are maintenance's or electrical's,
// depending on the finding»). Electrical = a word of ELEC in the text (not
// \u00ab\u05e9\u05e7\u05e2\u00bb or \u00ab\u05dc\u05d5\u05d7\u00bb alone: a dip in the floor, a notice board).
export const ELEC = ['\u05d7\u05e9\u05de\u05dc', '\u05db\u05d1\u05dc', '\u05ea\u05d0\u05d5\u05e8\u05d4', '\u05e0\u05d5\u05e8\u05d4', '\u05de\u05e0\u05d5\u05e8\u05d4', '\u05e4\u05e0\u05e1', '\u05d4\u05d0\u05e8\u05e7\u05d4', '\u05de\u05e4\u05e1\u05e7'];
export function trusteeResp(dept, text) {
  if (dept !== MAINT) return '\u05de\u05e0\u05d4\u05dc \u05d4\u05de\u05d7\u05dc\u05e7\u05d4';
  const t = String(text || '');
  return ELEC.some((w) => t.indexOf(w) >= 0) ? '\u05d7\u05e9\u05de\u05dc' : MAINT;
}
const TRUSTEE_DUE_DAYS = 3;
const MAX_AI = 3; // assistant calls per run (subrequest budget)
const DAY = 86400000;

export const G = 'https://graph.microsoft.com/v1.0/me/drive/root:/';
export const seg = (p) => String(p).split('/').filter(Boolean).map(encodeURIComponent).join('/');
const d10 = (v) => (v ? String(v).substring(0, 10) : '');
const dt = (v) => (d10(v) ? { date: d10(v) } : null);
const addDays = (ymd, n) => new Date(Date.parse(ymd + 'T12:00:00Z') + n * DAY).toISOString().substring(0, 10);

// A trustee finding (a ליקוי on tasks 1-7). One the manager marked "not
// relevant" (mgr_note starts with it; rows are never deleted, CLAUDE.md) stays
// in the history and out of the register (28/09, the Tzeva Adom finding).
export const isFinding = (r) => !!r && r.ok === false && +r.t >= 1 && +r.t <= 7;
export const notRelevant = (r) => /^\s*\u05dc\u05d0 \u05e8\u05dc\u05d5\u05d5\u05e0\u05d8\u05d9/.test(String((r && r.mgr_note) || ''));

// Routing a finding from the trustees screen (WhatsApp / mail / Vitre SMS)
// writes it into the note, not a task: "\u05e0\u05d5\u05ea\u05d1 \u05dc\u05d0\u05d7\u05d6\u05e7\u05d4 \u05e2\u05d3 30/09/2026 (\u05de\u05d9\u05d9\u05dc ...)".
// The last such date is the finding's target (28/09, \u05e0-2 and \u05e0-4).
export function routedNote(note) {
  const re = /\u05e0\u05d5\u05ea\u05d1[^()]*?\u05e2\u05d3 (\d{1,2})\/(\d{1,2})\/(\d{4})/g; let m, last = null;
  while ((m = re.exec(String(note || '')))) last = m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
  return last;
}

export function trusteeDept(loc) {
  const head = String(loc || '').split('\u00b7')[0].trim();
  const rest = String(loc || '').indexOf('\u00b7') >= 0 ? String(loc).split('\u00b7').slice(1).join('\u00b7').trim() : String(loc || '');
  const d = deptOf(head);
  // No department: "\u05dc\u05dc\u05d0 \u05de\u05d7\u05dc\u05e7\u05d4" in column D (no department's report takes it), the area kept in E.
  if (!d) return { dept: NO_DEPT, loc: head && rest !== head ? head + (rest ? ' \u00b7 ' + rest : '') : rest };
  // Two areas ("A + B"): both kept in the place column, the department is one of them.
  return { dept: d, loc: /\+/.test(head) && rest !== head ? head + (rest ? ' \u00b7 ' + rest : '') : rest };
}

// Pure: the merged register, as rows of columns A..M.
export function buildRows(hazards, reports, tasks) { return buildRegister(hazards, reports, tasks).rows; }
// ... and, per row, the record behind it ('h:<id>' / 't:<id>'), so a row a
// person edited in Excel can be traced back (the trustee numbers נ-k move).
export function buildRegister(hazards, reports, tasks) {
  const rows = [], ids = [];
  // A finding the manager routed to someone (a task with a due date) is due
  // then, not report + 3 days (28/09, the נ-4 case: routed "עד 04/10").
  const routed = {};
  (tasks || []).forEach((t) => {
    if (!t || t.source_table !== 'trustee_reports' || !t.source_id || !t.due) return;
    const c = routed[t.source_id];
    if (!c || String(t.ts || '') > String(c.ts || '')) routed[t.source_id] = t;
  });
  (hazards || []).filter((r) => r && r.id).slice().sort((a, b) => (+a.n || 0) - (+b.n || 0)).forEach((r) => {
    rows.push([r.n == null ? '' : +r.n, dt(r.d), r.tour_no == null ? '' : +r.tour_no, r.dept || '', r.loc || '', r.descr || '',
      r.sev || '', (r.resp || '') + (r.resp2 ? ' + ' + r.resp2 : ''), r.action || '', dt(r.due), r.s || '', dt(r.closed_d),
      '\u05d3\u05d9\u05d5\u05d5\u05d7 \u05de\u05de\u05d5\u05e0\u05d4' + (r.notes ? '. ' + r.notes : '')]);
    ids.push('h:' + r.id);
  });
  const reps = (reports || []).filter((r) => r && r.id);
  const closer = {};
  reps.forEach((r) => {
    if (+r.t === 8 && r.ref) { const c = closer[r.ref]; if (!c || String(r.ts || r.d) < String(c.ts || c.d)) closer[r.ref] = r; }
  });
  const findings = reps.filter((r) => isFinding(r) && !notRelevant(r))
    .sort((a, b) => String(a.ts || a.d || '').localeCompare(String(b.ts || b.d || '')));
  // A trustee finding belongs to the period of the department's latest tour
  // held on or before it. Column C gets that tour's number, so the sheet's own
  // "חדש/ישן" formula (N) calls a finding made after the last tour "חדש" and
  // the report to the department does not flag it "מסיור קודם!" (28/09).
  const tours = {};
  (hazards || []).forEach((h) => { if (h && h.dept && h.d && h.tour_no != null) (tours[h.dept] = tours[h.dept] || []).push({ n: +h.tour_no, d: d10(h.d) }); });
  const tourFor = (dept, day) => (tours[dept] || []).filter((t) => t.d <= day).reduce((m, t) => (t.n > m ? t.n : m), 0) || '';
  findings.forEach((r, k) => {
    const { dept, loc } = trusteeDept(r.loc);
    const closed = r.s === '\u05e0\u05e1\u05d2\u05e8';
    const c = closer[r.id];
    rows.push(['\u05e0-' + (k + 1), dt(r.d), tourFor(dept, d10(r.d)), dept, loc, r.f || '', '\u05d1\u05d9\u05e0\u05d5\u05e0\u05d9\u05ea', trusteeResp(dept, r.f), (r.action ? r.action + ' (' : '') + '\u05e1\u05d9\u05d5\u05e8 \u05e0\u05d0\u05de\u05df: ' + (r.u || '') + (r.action ? ')' : ''),
      routed[r.id] ? dt(routed[r.id].due) : routedNote(r.mgr_note) ? { date: routedNote(r.mgr_note) } : d10(r.d) ? { date: addDays(d10(r.d), TRUSTEE_DUE_DAYS) } : null, closed ? '\u05e1\u05d2\u05d5\u05e8' : '\u05e4\u05ea\u05d5\u05d7',
      closed ? (c ? dt(c.d || c.ts) : dt(r.closed_d)) : null, '\u05d3\u05d9\u05d5\u05d5\u05d7 \u05e0\u05d0\u05de\u05df: ' + (r.u || '') + (r.mgr_note ? '. ' + r.mgr_note : '')]);
    ids.push('t:' + r.id);
  });
  return { rows, ids };
}

async function sha(s) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
export const TASKS_Q = 'tasks?select=id,due,source_table,source_id,ts&source_table=eq.trustee_reports';
// 30/09/2026 (upgrade review, item 30): this asked for 5000 rows, but
// PostgREST caps every response at db-max-rows (1000) without an error. With
// order=n.asc / ts.asc it is the NEWEST hazards and reports that would have
// been cut from the file, the department report, the deck and the meeting
// data once a table passed 1000 rows. It now reads page by page, and id is
// added to the order so a page boundary on equal values (same ts, same n)
// neither repeats nor skips a row. Every table read here has an id column.
// trustee-log.js had its own paged copy; it now uses this one.
export const READ_PAGE = 1000, READ_MAX_PAGES = 20;
export function pagedPath(path, off) {
  const q = path.indexOf('?') >= 0 ? path : path + '?';
  const m = /([?&])order=([^&]*)/.exec(q);
  let out = q;
  if (!m) out = q + (q.endsWith('?') ? '' : '&') + 'order=id.asc';
  else if (!/(^|,)id\./.test(m[2])) out = q.replace(m[0], m[1] + 'order=' + m[2] + ',id.asc');
  return out + '&limit=' + READ_PAGE + '&offset=' + off;
}
export async function readAll(env, path) {
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const base = (env.SUPABASE_URL || 'https://znhjtpcltrxxyfjczgvw.supabase.co') + '/rest/v1/';
  const out = [];
  for (let page = 0; page < READ_MAX_PAGES; page++) {
    const r = await fetch(base + pagedPath(path, page * READ_PAGE), { headers: { apikey: key, Authorization: 'Bearer ' + key } });
    if (!r.ok) throw new Error('read ' + path.split('?')[0] + ' failed (' + r.status + ')');
    const j = await r.json();
    if (!Array.isArray(j)) return out;
    out.push(...j);
    if (j.length < READ_PAGE) return out;
  }
  // A cut list would be written as if it were the whole register.
  throw new Error('read ' + path.split('?')[0] + ': more than ' + READ_PAGE * READ_MAX_PAGES + ' rows');
}
export async function graphPut(token, folder, name, bytes, type) {
  const r = await fetch(G + seg(folder) + '/' + encodeURIComponent(name) + ':/content', { method: 'PUT', headers: { Authorization: 'Bearer ' + token, 'Content-Type': type }, body: bytes });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error('onedrive ' + r.status + (j && j.error ? ': ' + String(j.error.message || j.error.code).substring(0, 160) : '')); e.status = r.status; throw e; }
  return j;
}
// Archive copies are named with the date as Michael reads it, DD-MM-YYYY, and
// Israel time (29/09/2026: "write dates like in Hebrew in the archive too").
// A file name cannot hold "/", so "-" between the parts and "." in the time.
export function stampName(name, iso) {
  const i = name.lastIndexOf('.');
  const d = new Date(iso);
  let stamp = iso.replace('T', ' ').substring(0, 16).replace(':', '-');
  if (!isNaN(d)) {
    const p = {};
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(d).forEach((x) => { p[x.type] = x.value; });
    stamp = p.day + '-' + p.month + '-' + p.year + ' ' + p.hour + '.' + p.minute;
  }
  return name.substring(0, i) + ' - ' + stamp + name.substring(i);
}

// ---- Excel -> app (28/09, Michael: "if I close in the file, the app has to
// update, and the other way round, fully automatic") ----
// When a person saved the file since the server last wrote it, the register
// rows are read back and compared with what the server wrote then
// (hazard_<file>_last). Columns I (action), K (status), L (closing date) and
// M (notes) are taken (Michael, 28/09: "סגירה + פעולה + הערות"), and since
// 29/09/2026 F (description) and J (due) of the manager's hazards; department,
// severity and the rest stay as in the app (listed as not taken). A field that changed
// in the app too since that write keeps the app's value (the file version is
// in the archive). A new row with a description becomes a new manager hazard.
// Rows deleted in Excel are not deleted in the app.
const S_OPEN = '\u05e4\u05ea\u05d5\u05d7', S_WIP = '\u05d1\u05d8\u05d9\u05e4\u05d5\u05dc', S_DONE = '\u05e1\u05d2\u05d5\u05e8', TR_CLOSED = '\u05e0\u05e1\u05d2\u05e8';
// 29/09/2026 (Michael fixed typos and set due dates in the file, and they
// were lost): the description (F) and the due date (J) too, for the manager's
// own hazards; a trustee's description is what the trustee reported.
const PULL_COLS = [5, 8, 9, 10, 11, 12];
const KEEP_COLS = [1, 2, 3, 4, 6, 7];
const MAX_DROPPED = 30;
// The "not taken" list (29/09/2026, upgrade review 9): it collects across saves
// instead of being replaced by the last one; an item leaves by itself once the
// app holds that value, when marked handled (op:'dismiss'), or after KEEP_DROPPED_DAYS.
const MAX_KEPT = 40, KEEP_DROPPED_DAYS = 30;
const MAX_PULL = 25; // database writes per run (subrequests); the rest next run
const norm = (v) => (v == null ? '' : typeof v === 'object' && v.date ? v.date : String(v).replace(/\r\n?/g, '\n').trim());
const isYmd = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v);
const orNull = (t) => (t ? t : null);
const stripMgr = (t) => orNull(String(t || '').replace(/^\u05d3\u05d9\u05d5\u05d5\u05d7 \u05de\u05de\u05d5\u05e0\u05d4\.?\s*/, '').trim());
const stripTrustee = (t) => orNull(String(t || '').replace(/^\u05d3\u05d9\u05d5\u05d5\u05d7 \u05e0\u05d0\u05de\u05df:[^.]*\.?\s*/, '').trim());
function stripTour(t) {
  t = String(t || '').trim();
  const m = /^([\s\S]*?)\s*\(\u05e1\u05d9\u05d5\u05e8 \u05e0\u05d0\u05de\u05df:[^)]*\)$/.exec(t);
  if (m) return orNull(m[1].trim());
  return /^\u05e1\u05d9\u05d5\u05e8 \u05e0\u05d0\u05de\u05df:/.test(t) ? null : orNull(t);
}
function takeField(kind, ci, fv, patch) {
  if (ci === 5) { if (kind !== 'h' || !fv) return false; patch.descr = fv; return true; }
  if (ci === 9) { if (kind !== 'h' || (fv && !isYmd(fv))) return false; patch.due = orNull(fv); return true; }
  if (ci === 8) { patch.action = kind === 'h' ? orNull(fv) : stripTour(fv); return true; }
  if (ci === 10) {
    if ([S_OPEN, S_WIP, S_DONE].indexOf(fv) < 0) return false;
    patch.s = kind === 'h' ? fv : (fv === S_DONE ? TR_CLOSED : S_OPEN); return true;
  }
  if (ci === 11) { if (fv && !isYmd(fv)) return false; patch.closed_d = orNull(fv); return true; }
  if (ci === 12) { if (kind === 'h') patch.notes = stripMgr(fv); else patch.mgr_note = stripTrustee(fv); return true; }
  return false;
}

// Pure. fileRows = readSheetRows(); last = {rows, ids} of the server's last write.
// Values this app wrote to a cell and then replaced, kept for STALE_MS in
// last.old ('<id>|<col>' -> [[value, iso]]), so a stale copy saved over the
// file is told apart from a person's edit. The cost: undoing in Excel, within
// that window, a change just made in the app is not taken; do it in the app.
const STALE_MS = 24 * 3600 * 1000;
function wasOurs(last, id, ci, fv) {
  const w = last && last.old && last.old[id + '|' + ci];
  return !!w && w.some((x) => x[0] === fv);
}
export function supersede(prev, reg, nowIso) {
  const t0 = Date.parse(nowIso) - STALE_MS, old = {};
  Object.entries((prev && prev.old) || {}).forEach(([k, arr]) => { const keep = (arr || []).filter((x) => Date.parse(x[1]) >= t0); if (keep.length) old[k] = keep; });
  const was = {}; ((prev && prev.ids) || []).forEach((id, i) => { if (prev.rows && prev.rows[i]) was[id] = prev.rows[i]; });
  reg.ids.forEach((id, i) => {
    const a = was[id], b = reg.rows[i]; if (!a || !b) return;
    PULL_COLS.forEach((ci) => {
      const k = id + '|' + ci, ov = norm(a[ci]), nv = norm(b[ci]);
      if (ov !== nv && !(old[k] || []).some((x) => x[0] === ov)) (old[k] = old[k] || []).push([ov, nowIso]);
      if (old[k]) { old[k] = old[k].filter((x) => x[0] !== nv); if (!old[k].length) delete old[k]; }
    });
  });
  return old;
}

export function diffEdits(fileRows, last, hazards, reports, today) {
  const cur = buildRegister(hazards, reports);
  const curBy = {}; cur.ids.forEach((id, i) => { curBy[id] = cur.rows[i]; });
  const lastBy = {};
  // A number that appears twice in the last write cannot say which record it
  // is: those rows are skipped rather than applied to the wrong one (28/09 review).
  const dup = new Set();
  (last.ids || []).forEach((id, i) => { const k = norm(((last.rows || [])[i] || [])[0]); if (!k) return; if (lastBy[k]) dup.add(k); lastBy[k] = { id, row: last.rows[i], i }; });
  dup.forEach((k) => { delete lastBy[k]; });
  const hById = {}, rById = {};
  (hazards || []).forEach((h) => { hById[h.id] = h; });
  (reports || []).forEach((r) => { rById[r.id] = r; });
  const hz = {}, tr = {}, fresh = [], pulled = [], seen = new Set();
  // What a person changed in the file and the app did not take (29/09/2026,
  // Michael: a change in the file must not vanish without a word). Shown on the
  // tours screen; a copy of the file is kept only when this is not empty.
  const dropped = [];
  const drop = (key, r, ci, val, why, id) => { if (dropped.length < MAX_DROPPED) dropped.push({ n: key, r, ci, val: String(val == null ? '' : val).substring(0, 80), why, id: id || null }); };
  // Rows skipped as a whole used to vanish without a word (29/09/2026, upgrade
  // review 9). They are listed only when the row holds something the last
  // write did not: an untouched row skipped every run is not news.
  const lastAll = {};
  (last.ids || []).forEach((id, i) => { const k = norm(((last.rows || [])[i] || [])[0]); if (k) (lastAll[k] = lastAll[k] || []).push((last.rows || [])[i]); });
  const sameRow = (v, lr) => !!lr && PULL_COLS.concat(KEEP_COLS).every((ci) => norm(v[ci]) === norm(lr[ci]));
  const asWritten = (key, v) => (lastAll[key] || []).some((lr) => sameRow(v, lr));
  const curDescr = new Set(cur.rows.map((x) => norm(x[5])));
  const usedN = new Set((hazards || []).map((h) => +h.n).filter((n) => n > 0));
  let maxN = Math.max(0, ...usedN);
  (fileRows || []).forEach(({ r, v }) => {
    const key = norm(v[0]);
    if (key && dup.has(key)) { if (!asWritten(key, v)) drop(key, r, -1, v[5], 'dup'); return; }
    const hit = key && lastBy[key];
    if (hit) {
      if (seen.has(key)) { if (!asWritten(key, v)) drop(key, r, -1, v[5], 'seen'); return; } seen.add(key);
      // The same record? A stale copy saved over a renumbered file would
      // otherwise put one finding's edits on another (נ-k shift when a
      // finding is marked not relevant). Description, or date + department + location.
      const lr = hit.row;
      const same = norm(v[5]) === norm(lr[5]) || (norm(v[1]) === norm(lr[1]) && norm(v[3]) === norm(lr[3]) && norm(v[4]) === norm(lr[4]));
      // Trustee rows (נ-k) are renumbered by the app, so a mismatch there is
      // a stale copy, not an edit; a manager row keeps its number.
      // A trustee row that is simply another finding's row shifted is a stale copy: silent.
      if (!same) { if (!/^\u05e0-/.test(key) || !curDescr.has(norm(v[5]))) drop(key, r, -1, v[5], 'nomatch'); return; }
      const kind = hit.id.charAt(0), id = hit.id.substring(2);
      const c = curBy[hit.id]; if (!c) { if (!sameRow(v, lr)) drop(key, r, -1, v[5], 'gone'); return; } // gone from the app since
      // Columns the app never takes from the file (description, department...):
      // an edit there is lost on the rewrite, unless the app already has it.
      KEEP_COLS.forEach((ci) => { const fv = norm(v[ci]); if (fv !== norm(lr[ci]) && fv !== norm(c[ci])) drop(key, r, ci, fv, 'keep', hit.id); });
      PULL_COLS.forEach((ci) => {
        const fv = norm(v[ci]), lv = norm(hit.row[ci]);
        if (fv === lv) return; // not edited
        // Changed in the app too: the app wins, except the trustee action the
        // assistant filled in the same run over an empty one (28/09 review).
        const aiFilled = kind === 't' && ci === 8 && stripTour(lv) === null;
        if (norm(c[ci]) !== lv && !aiFilled) { if (fv !== norm(c[ci])) drop(key, r, ci, fv, 'both', hit.id); return; }
        // A value this cell had in an earlier write of ours: a copy of the
        // file opened before that write and saved over it, not an edit
        // (29/09: 44/46/47 closed in the app, reopened by the old copy still
        // open in Excel). The app keeps its value; the rewrite fixes the file.
        if (wasOurs(last, hit.id, ci, fv)) return;
        const patch = kind === 'h' ? (hz[id] = hz[id] || {}) : (tr[id] = tr[id] || {});
        if (takeField(kind, ci, fv, patch)) pulled.push({ i: hit.i, ci, val: v[ci] == null ? '' : v[ci], id: hit.id });
        else drop(key, r, ci, fv, kind === 't' && (ci === 5 || ci === 9) ? 'tru_col' : 'bad', hit.id);
      });
      return;
    }
    const descr = norm(v[5]);
    // A trustee finding is opened by the trustee, never from the file.
    if (/^\u05e0-/.test(key)) { if (descr) drop(key, r, -1, descr, 'tru_new'); return; }
    if (!descr) { if ([1, 3, 4, 6, 8, 9, 12].filter((ci) => norm(v[ci])).length >= 2) drop(key, r, 5, '', 'nodescr'); return; }
    // Column D names a department of the report, through the same map. A row
    // whose department the app does not know (or an area with none) is not
    // opened: it goes to the not-taken list (upgrade review 4, 30/09/2026).
    const dept = deptOf(v[3]);
    if (!dept) { drop(key, r, 3, norm(v[3]), 'dept'); return; }
    // Already created from this row on an earlier run (the file is rewritten
    // only after the database writes all went through). The tour date is part
    // of it: a recurring hazard typed in an old one's words on a new tour used
    // to match the old one and was dropped from the file (upgrade review 9).
    if ((hazards || []).concat(fresh).some((h) => norm(h.descr) === descr && norm(h.dept) === dept && norm(h.d) === (isYmd(norm(v[1])) ? norm(v[1]) : ''))) return;
    let n = /^\d+$/.test(key) && !usedN.has(+key) ? +key : maxN + 1;
    usedN.add(n); maxN = Math.max(maxN, n);
    const rs = norm(v[7]).split(/\s*\+\s*/);
    const st = [S_OPEN, S_WIP, S_DONE].indexOf(norm(v[10])) >= 0 ? norm(v[10]) : S_OPEN;
    const dOf = (x) => (isYmd(norm(x)) ? norm(x) : null);
    const num = (x) => (/^\d+$/.test(norm(x)) ? +norm(x) : null);
    fresh.push({ id: 'th-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6), n, d: dOf(v[1]), tour_no: num(v[2]),
      dept, loc: orNull(norm(v[4])), descr, sev: orNull(norm(v[6])), resp: orNull(rs[0] || ''), resp2: orNull(rs[1] || ''),
      action: orNull(norm(v[8])), due: dOf(v[9]), s: st, closed_d: dOf(v[11]) || (st === S_DONE ? today : null), notes: stripMgr(norm(v[12])) });
  });
  // Closed in Excel without a date: today, as when closing in the app.
  // ... and reopened in Excel: no closing date, as in the app (28/09 review).
  Object.keys(hz).forEach((id) => { const p = hz[id]; if (!('s' in p) || 'closed_d' in p) return; if (p.s === S_DONE) { if (!hById[id].closed_d) p.closed_d = today; } else p.closed_d = null; });
  Object.keys(tr).forEach((id) => { const p = tr[id]; if (!('s' in p) || 'closed_d' in p) return; if (p.s === TR_CLOSED) { if (!rById[id].closed_d) p.closed_d = today; } else p.closed_d = null; });
  const list = (o) => Object.keys(o).filter((id) => Object.keys(o[id]).length).map((id) => Object.assign({ id }, o[id]));
  return { hazards: list(hz), reports: list(tr), fresh, pulled, dropped };
}

// ---- Photos (29/09/2026, Michael: every hazard's photo in the file, the
// manager's and the trustees' alike, and in the report mail) ----
// Column P of the register: a small picture for what the filter shows (open /
// in progress) and anything from the last 90 days, a "full size" link for
// every photo. A run fetches at most MAX_PICS thumbnails (the free plan's
// subrequests); the rest get the link only.
export const PHOTO_COL = 15, MAX_PICS = 12, PIC_DAYS = 90, THUMB_W = 240, SIGN_SECONDS = 365 * 86400;
const PHOTO_HEADER = '\u05ea\u05de\u05d5\u05e0\u05d4', PHOTO_TEXT = '\u05e4\u05ea\u05d9\u05d7\u05d4 \u05d1\u05d2\u05d5\u05d3\u05dc \u05de\u05dc\u05d0';
export function storagePath(url, base) {
  const u = String(url || '');
  if (u.indexOf(base + '/storage/v1/object/') !== 0) return null;
  const m = u.substring(base.length).match(/^\/storage\/v1\/object\/(?:public\/|sign\/|authenticated\/)?([^/?]+)\/([^?]+)/);
  return m ? { bucket: m[1], path: decodeURIComponent(m[2]) } : null;
}
// 'h:<id>' / 't:<id>' -> the record's photo URL, if it has one in our Storage.
export function photoOf(id, hazards, reports) {
  const k = String(id || ''), rid = k.substring(2);
  const rec = k.charAt(0) === 'h' ? (hazards || []).find((x) => x.id === rid) : (reports || []).find((x) => x.id === rid);
  return rec && rec.photo_url && !/^pending:/.test(rec.photo_url) ? rec.photo_url : null;
}
const sbBase = (env) => env.SUPABASE_URL || 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const sbHdr = (env) => ({ apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY });
// url -> a link that opens the photo for a year (one call per bucket).
export async function signPhotos(env, urls) {
  const base = sbBase(env), out = {}, buckets = {};
  (urls || []).forEach((u) => { const sp = storagePath(u, base); if (sp) (buckets[sp.bucket] = buckets[sp.bucket] || []).push({ u, path: sp.path }); });
  for (const b of Object.keys(buckets)) {
    try {
      const r = await fetch(base + '/storage/v1/object/sign/' + encodeURIComponent(b), { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, sbHdr(env)), body: JSON.stringify({ expiresIn: SIGN_SECONDS, paths: buckets[b].map((x) => x.path) }) });
      const j = r.ok ? await r.json() : [];
      (Array.isArray(j) ? j : []).forEach((e) => {
        if (!e || !e.signedURL || e.error) return;
        const hit = buckets[b].find((x) => x.path === e.path); if (!hit) return;
        out[hit.u] = /^https?:/.test(e.signedURL) ? e.signedURL : base + '/storage/v1' + e.signedURL;
      });
    } catch (e) { /* no links for this bucket this time */ }
  }
  return out;
}
// A small JPEG/PNG of the photo (Supabase image transform), or null.
export async function fetchThumb(env, url, width) {
  const base = sbBase(env), sp = storagePath(url, base); if (!sp) return null;
  const obj = encodeURIComponent(sp.bucket) + '/' + sp.path.split('/').map(encodeURIComponent).join('/');
  try {
    // format=origin: otherwise WebP, which Excel does not show (trustee-log.js, 27/09).
    const r = await fetch(base + '/storage/v1/render/image/authenticated/' + obj + '?width=' + (width || THUMB_W) + '&quality=60&resize=contain&format=origin', { headers: sbHdr(env) });
    if (!r.ok) return null;
    const b = new Uint8Array(await r.arrayBuffer());
    return picInfo(b) ? b : null;
  } catch (e) { return null; }
}
// Which register rows get a picture: open / in progress first, then the last
// PIC_DAYS days, up to max. Pure.
export function pickPhotoRows(reg, hazards, reports, today, max) {
  const all = [];
  reg.ids.forEach((id, i) => {
    const url = photoOf(id, hazards, reports); if (!url) return;
    const row = reg.rows[i], open = norm(row[10]) !== S_DONE;
    const d = norm(row[1]), recent = isYmd(d) && d >= addDays(today, -PIC_DAYS);
    all.push({ i, row: i + 2, url, open, recent });
  });
  const want = all.filter((x) => x.open || x.recent).sort((a, b) => (a.open === b.open ? a.i - b.i : a.open ? -1 : 1)).slice(0, max);
  return { all, want };
}

// ---- The "Claude Log" sheet (29/09/2026, Michael: "it is important for the
// record"): one line per write that changed something, in the columns the
// sheet already has: #, date, the request (where the change came from), the
// action, the details, the outcome. ----
const LOG_SHEET = 'Claude Log';
const COL_NAMES = ['','\u05ea\u05d0\u05e8\u05d9\u05da \u05e1\u05d9\u05d5\u05e8','\u05de\u05e1\u05e4\u05e8 \u05e1\u05d9\u05d5\u05e8','\u05de\u05d7\u05dc\u05e7\u05ea \u05e1\u05d9\u05d5\u05e8','\u05de\u05d9\u05e7\u05d5\u05dd','\u05ea\u05d9\u05d0\u05d5\u05e8','\u05d7\u05d5\u05de\u05e8\u05d4','\u05d0\u05d7\u05e8\u05d0\u05d9','\u05e4\u05e2\u05d5\u05dc\u05d4','\u05d9\u05e2\u05d3','\u05e1\u05d8\u05d8\u05d5\u05e1','\u05ea\u05d0\u05e8\u05d9\u05da \u05e1\u05d2\u05d9\u05e8\u05d4','\u05d4\u05e2\u05e8\u05d5\u05ea'];
const LOG_MAX = 12; // changes spelled out in one line; the rest counted
const short = (t, n) => { t = String(t == null ? '' : t).replace(/\s+/g, ' ').trim(); return t.length > n ? t.substring(0, n - 3) + '...' : t; };
const dispVal = (v) => { const x = norm(v); return isYmd(x) ? x.substring(8, 10) + '/' + x.substring(5, 7) + '/' + x.substring(0, 4) : x; };
export function logEntry(last, reg, o) {
  if (!last || !Array.isArray(last.ids)) return null;
  const was = {}; last.ids.forEach((id, i) => { was[id] = (last.rows || [])[i]; });
  const out = [];
  reg.ids.forEach((id, i) => {
    const b = reg.rows[i], a = was[id], n = norm(b[0]);
    if (!a) { out.push('\u05de\u05e4\u05d2\u05e2 \u05d7\u05d3\u05e9 ' + n + ': ' + short(b[5], 60)); return; }
    const ch = [];
    [10, 11, 8, 12, 9, 5, 6, 7, 3, 4].forEach((ci) => { if (norm(a[ci]) !== norm(b[ci])) ch.push(COL_NAMES[ci] + ' ' + (norm(a[ci]) ? '\u05de-"' + short(dispVal(a[ci]), 30) + '" ' : '') + '\u05dc-"' + short(dispVal(b[ci]), 30) + '"'); });
    if (ch.length) out.push('\u05de\u05e4\u05d2\u05e2 ' + n + ': ' + ch.join(', '));
  });
  if (!out.length && !(o.dropped && o.dropped.length)) return null;
  const at = new Date(o.now);
  const p = {}; new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(at).forEach((x) => { p[x.type] = x.value; });
  const when = p.day + '/' + p.month + '/' + p.year + ' ' + p.hour + ':' + p.minute;
  const details = out.slice(0, LOG_MAX).join('; ') + (out.length > LOG_MAX ? '; \u05d5\u05e2\u05d5\u05d3 ' + (out.length - LOG_MAX) : '');
  const nd = (o.dropped || []).length;
  return [when,
    o.personSaved ? '\u05e9\u05de\u05d9\u05e8\u05d4 \u05d1\u05e7\u05d5\u05d1\u05e5 Excel (\u05d4\u05e9\u05d9\u05e0\u05d5\u05d9\u05d9\u05dd \u05e0\u05e7\u05dc\u05d8\u05d5 \u05dc\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4)' : '\u05e9\u05d9\u05e0\u05d5\u05d9 \u05d1\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4 (\u05de\u05de\u05d5\u05e0\u05d4 / \u05e0\u05d0\u05de\u05df)',
    '\u05d4\u05e9\u05e8\u05ea \u05e2\u05d3\u05db\u05df \u05d0\u05ea \u05de\u05d0\u05d2\u05e8 \u05d4\u05de\u05e4\u05d2\u05e2\u05d9\u05dd \u05d1\u05e7\u05d5\u05d1\u05e5',
    details || '\u05d0\u05d9\u05df \u05e9\u05d9\u05e0\u05d5\u05d9 \u05d1\u05de\u05d0\u05d2\u05e8',
    nd ? '\u05e2\u05d5\u05d3\u05db\u05df. ' + nd + ' \u05e9\u05d9\u05e0\u05d5\u05d9\u05d9\u05dd \u05d1\u05e7\u05d5\u05d1\u05e5 \u05dc\u05d0 \u05e0\u05e7\u05dc\u05d8\u05d5, \u05e2\u05d5\u05ea\u05e7 \u05d1\u05d0\u05e8\u05db\u05d9\u05d5\u05df / \u05d2\u05e8\u05e1\u05d0\u05d5\u05ea \u05e9\u05e0\u05d3\u05e8\u05e1\u05d5' : '\u05e2\u05d5\u05d3\u05db\u05df'];
}

// Pure. The stored "not taken" list after this run: the earlier items plus the
// new ones (one per row/column/value), less those the app now holds, those
// marked handled, and those older than KEEP_DROPPED_DAYS.
export const dropKey = (x) => [x.n, x.ci, x.val].join('|');
export function mergeDropped(prevItems, items, reg, hazards, reports, nowIso, opt) {
  opt = opt || {};
  const regBy = {}, regByN = {}; reg.ids.forEach((id, i) => { regBy[id] = reg.rows[i]; const n = norm(reg.rows[i][0]); if (n) regByN[n] = regBy[n] ? null : reg.rows[i]; });
  const gone = new Set(opt.dismissed || []);
  const descrs = new Set((hazards || []).map((h) => norm(h.descr)).concat((reports || []).map((r) => norm(r.f))));
  const t0 = Date.parse(nowIso) - KEEP_DROPPED_DAYS * 86400000;
  const resolved = (x) => {
    // Items stored before 29/09 carry no record id: found by their number.
    if (x.ci >= 0 && (x.id || regByN[x.n])) { const row = x.id ? regBy[x.id] : regByN[x.n]; return !row || norm(row[x.ci]) === norm(x.val) || (x.ci === 8 && stripTour(norm(row[x.ci])) === orNull(norm(x.val))); }
    if (x.why === 'nodescr' || !x.val) return false;
    return x.why !== 'gone' && descrs.has(norm(x.val)) && x.why !== 'seen' && x.why !== 'dup';
  };
  // Newest first; an item seen again keeps when it was first seen and takes the new row number.
  const by = new Map();
  (prevItems || []).forEach((x) => { if (x && !by.has(dropKey(x))) by.set(dropKey(x), Object.assign({}, x, { at: x.at || opt.prevAt || nowIso })); });
  (items || []).forEach((x) => { if (!x) return; const k = dropKey(x), p = by.get(k); by.delete(k); by.set(k, Object.assign({}, x, { at: (p && p.at) || nowIso })); });
  const out = [];
  by.forEach((x, k) => { if (gone.has(k) || Date.parse(x.at) < t0 || resolved(x)) return; out.push(x); });
  return out.reverse().slice(0, MAX_KEPT);
}

// Writes the edits (new hazards first, in one request), updates the arrays in
// memory. More than MAX_PULL writes: the rest waits for the next run, and the
// file is not rewritten until then (it would drop them).
export async function applyEdits(env, ed, hazards, reports) {
  const key = env.SUPABASE_SERVICE_ROLE_KEY, base = (env.SUPABASE_URL || 'https://znhjtpcltrxxyfjczgvw.supabase.co') + '/rest/v1/';
  const h = { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', Prefer: 'return=minimal' };
  let budget = MAX_PULL, done = { created: 0, hazards: 0, reports: 0, written: [] };
  if (ed.fresh.length) {
    const r = await fetch(base + 'tour_hazards', { method: 'POST', headers: h, body: JSON.stringify(ed.fresh) });
    if (!r.ok) throw new Error('new hazards from the file failed (' + r.status + ')');
    ed.fresh.forEach((x) => hazards.push(x)); done.created = ed.fresh.length; budget--;
  }
  const one = async (table, arr, list, k) => {
    for (const p of list) {
      if (budget <= 0) return false;
      const body = Object.assign({}, p); delete body.id;
      const r = await fetch(base + table + '?id=eq.' + encodeURIComponent(p.id), { method: 'PATCH', headers: h, body: JSON.stringify(body) });
      if (!r.ok) throw new Error(table + ' update from the file failed (' + r.status + ')');
      const rec = arr.find((x) => x.id === p.id); if (rec) Object.assign(rec, body);
      budget--; done[k]++; done.written.push((table === 'tour_hazards' ? 'h:' : 't:') + p.id);
    }
    return true;
  };
  const all = (await one('tour_hazards', hazards, ed.hazards, 'hazards')) && (await one('trustee_reports', reports, ed.reports, 'reports'));
  done.pending = !all;
  return done;
}

export async function runFile(env, which, force, opt) {
  const f = FILES[which]; if (!f) throw new Error('unknown file');
  const year = ilYear((opt && opt.now) || Date.now()), FOLDER = folderFor(year);
  const [hazards, reports, tasks] = await Promise.all([
    readAll(env, 'tour_hazards?select=id,n,d,tour_no,dept,loc,descr,sev,resp,resp2,action,due,s,closed_d,notes,photo_url&order=n.asc'),
    readAll(env, 'trustee_reports?select=id,u,t,d,loc,ok,f,s,ref,mgr_note,action,closed_d,ts,photo_url&order=ts.asc'),
    readAll(env, TASKS_Q),
  ]);
  // Every finding gets a recommended corrective action (Michael, 28/09): the
  // ones still without one are asked from the assistant, a few per run, and
  // saved on the report, where the manager can change it. A failure leaves it
  // for the next run (every 15 minutes).
  const todo = reports.filter((r) => isFinding(r) && !notRelevant(r) && !r.action && r.s !== '\u05e0\u05e1\u05d2\u05e8').slice(0, MAX_AI);
  for (const r of todo) {
    const a = await suggestAction(env, r);
    if (!a) continue;
    try {
      const key = env.SUPABASE_SERVICE_ROLE_KEY, base = env.SUPABASE_URL || 'https://znhjtpcltrxxyfjczgvw.supabase.co';
      const up = await fetch(base + '/rest/v1/trustee_reports?id=eq.' + encodeURIComponent(r.id) + '&action=is.null', { method: 'PATCH', headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ action: a }) });
      if (up.ok) r.action = a;
    } catch (e) { /* next run */ }
  }
  let reg = yearReg(buildRegister(hazards, reports, tasks), year);
  let sig = await sha(JSON.stringify([FILE_VERSION, reg.rows, reg.ids.map((id) => (photoOf(id, hazards, reports) ? 1 : 0))]));
  const K = 'hazard_' + which + '_';
  const st = await stateGet(env, [K + 'sig', K + 'ctag', K + 'sheets', K + 'last', K + 'dropped', K + 'dismissed']).catch(() => ({}));
  const val = (k) => (st[K + k] && st[K + k].value) || '';
  const now = new Date().toISOString();
  try {
    const { token } = await accessToken(env);
    const { mr } = await yearItem(token, f.name, f.type, year, 'id,cTag,lastModifiedDateTime,size,webUrl,@microsoft.graph.downloadUrl');
    if (mr.status === 404) throw Object.assign(new Error('the file is not in the folder: ' + FOLDER + '/' + f.name), { status: 404 });
    if (!mr.ok) throw Object.assign(new Error('onedrive ' + mr.status), { status: mr.status });
    const meta = await mr.json();
    const ours = val('ctag');
    // Nothing new on either side: one metadata read, nothing downloaded.
    if (!force && ours && ours === meta.cTag && val('sig') === sig) return { ok: true, file: which, pushed: false, reason: 'unchanged', rows: reg.rows.length };
    const dl = await fetch(meta['@microsoft.graph.downloadUrl']);
    if (!dl.ok) throw new Error('download failed (' + dl.status + ')');
    const orig = new Uint8Array(await dl.arrayBuffer());
    // Did a person save it since our last write? The cTag alone is not enough:
    // OneDrive changes it after our own upload (28/09, a copy landed in
    // גרסאות שנדרסו with nobody touching the file), so the sheets are compared too.
    const changed = !!ours && ours !== meta.cTag;
    const personSaved = changed && (!val('sheets') || val('sheets') !== await sheetsDigest(orig).catch(() => ''));
    if (!force && !personSaved && val('sig') === sig) {
      if (changed) await stateSet(env, { [K + 'ctag']: meta.cTag || '' });
      return { ok: true, file: which, pushed: false, reason: 'unchanged', rows: reg.rows.length };
    }
    let prevD = null, dismissed = []; try { prevD = JSON.parse(val('dropped') || 'null'); } catch (e) { prevD = null; }
    try { dismissed = JSON.parse(val('dismissed') || '[]'); } catch (e) { dismissed = []; }
    const prevDropped = (prevD && prevD.items) || [];
    const saveDropped = async (rg) => {
      const items = mergeDropped(prevDropped, ed ? ed.dropped : [], rg, hazards, reports, now, { dismissed, prevAt: prevD && prevD.at });
      if (ed || JSON.stringify(items) !== JSON.stringify(prevDropped)) await stateSet(env, { [K + 'dropped']: JSON.stringify({ at: now, items }) });
    };
    // Excel -> app first, so the rewrite carries what the person changed.
    let pulled = null;
    let last = null, ed = null; try { last = val('last') ? JSON.parse(val('last')) : null; } catch (e) { last = null; }
    if (personSaved && last && Array.isArray(last.rows) && Array.isArray(last.ids)) {
      const fileRows = await readSheetRows(orig, { sheet: SHEET, lastCol: LAST_COL, maxRow: MAX_ROW, dateCols: DATE_COLS });
      ed = diffEdits(fileRows, last, hazards, reports, now.substring(0, 10));
      if (ed.fresh.length || ed.hazards.length || ed.reports.length) {
        pulled = await applyEdits(env, ed, hazards, reports);
        // If the write below fails (file open in Excel), the next run must not
        // take these cells as edited again, nor as changed in the app.
        // Only cells of records actually written: the rest (over the per-run
        // budget) must still look edited on the next run (28/09 review).
        const done = new Set(pulled.written);
        ed.pulled.forEach((p) => { if (done.has(p.id) && last.rows[p.i]) last.rows[p.i][p.ci] = p.val; });
        await stateSet(env, { [K + 'last']: JSON.stringify(last) });
        if (pulled.pending) { await saveDropped(yearReg(buildRegister(hazards, reports, tasks), year)); return { ok: true, file: which, pushed: false, reason: 'pulling', pulled }; }
        reg = yearReg(buildRegister(hazards, reports, tasks), year);
        sig = await sha(JSON.stringify([FILE_VERSION, reg.rows, reg.ids.map((id) => (photoOf(id, hazards, reports) ? 1 : 0))]));
      }
    }
    await saveDropped(reg);
    // Keep what a person saved, before replacing it: the first time, and when
    // a change in the file was not taken (ed.dropped). Otherwise everything
    // the person changed is in the app already and a copy would only pile up
    // (29/09/2026: 10 copies in a day and a half).
    let kept = null;
    if (!ours || (personSaved && (!ed || ed.dropped.length))) {
      const folder = FOLDER + '/\u05d0\u05e8\u05db\u05d9\u05d5\u05df/' + (ours ? '\u05d2\u05e8\u05e1\u05d0\u05d5\u05ea \u05e9\u05e0\u05d3\u05e8\u05e1\u05d5' : '\u05dc\u05e4\u05e0\u05d9 \u05db\u05ea\u05d9\u05d1\u05d4 \u05e8\u05d0\u05e9\u05d5\u05e0\u05d4 \u05de\u05d4\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4');
      await graphPut(token, folder, stampName(f.name, meta.lastModifiedDateTime || now), orig, f.type);
      kept = folder;
    }
    const entry = logEntry(last, reg, { now, personSaved, dropped: ed ? ed.dropped : [] });
    const ph = pickPhotoRows(reg, hazards, reports, now.substring(0, 10), MAX_PICS);
    const links = await signPhotos(env, ph.all.map((x) => x.url));
    const pics = [], minHeights = {};
    for (const x of ph.want) { const b = await fetchThumb(env, x.url); if (b) { pics.push({ row: x.row, bytes: b, link: links[x.url] || null }); minHeights[x.row] = PIC_ROW_PT; } }
    // Full: a Hebrew error the tours screen and the watchdog show, not
    // patchSheetRows' English one (upgrade review 24).
    if (reg.rows.length > MAX_ROW - 1) throw new Error('\u05d4\u05e7\u05d5\u05d1\u05e5 \u05de\u05dc\u05d0: ' + reg.rows.length + ' \u05e9\u05d5\u05e8\u05d5\u05ea, \u05d5\u05d1\u05d2\u05d9\u05dc\u05d9\u05d5\u05df \u05de\u05d5\u05db\u05e0\u05d5\u05ea ' + (MAX_ROW - 1) + '. \u05e6\u05e8\u05d9\u05da \u05dc\u05d4\u05d5\u05e1\u05d9\u05e3 \u05e9\u05d5\u05e8\u05d5\u05ea \u05de\u05d5\u05db\u05e0\u05d5\u05ea \u05d1\u05ea\u05d1\u05e0\u05d9\u05ea.');
    const out = await patchSheetRows(orig, reg.rows, { sheet: SHEET, lastCol: LAST_COL, maxRow: MAX_ROW, dateCols: DATE_COLS, show: { col: 10, vals: [S_OPEN, S_WIP] }, fitRows: true,
      log: entry ? { sheet: LOG_SHEET, rows: [entry] } : null, minHeights,
      pictures: { col: PHOTO_COL, header: PHOTO_HEADER, width: 17, text: PHOTO_TEXT, pics, links: ph.all.filter((x) => links[x.url]).map((x) => ({ row: x.row, link: links[x.url] })) } });
    const put = await graphPut(token, FOLDER, f.name, out, f.type);
    const outSheets = await sheetsDigest(out).catch(() => '');
    await stateSet(env, { [K + 'sig']: sig, [K + 'ctag']: put.cTag || '', [K + 'sheets']: outSheets, [K + 'last']: JSON.stringify({ rows: reg.rows, ids: reg.ids, old: supersede(last, reg, now) }),
      [K + 'at']: now, [K + 'err']: '', [K + 'url']: put.webUrl || meta.webUrl || '', [K + 'rows']: String(reg.rows.length), [K + 'year']: String(year) });
    return { ok: true, file: which, pushed: true, rows: reg.rows.length, managers: hazards.length, trustees: reg.rows.length - hazards.length, kept, pulled, webUrl: put.webUrl || null };
  } catch (e) {
    const msg = e && e.code === 'not_connected' ? 'not connected'
      : e && e.status === 423 ? '\u05d4\u05e7\u05d5\u05d1\u05e5 \u05e4\u05ea\u05d5\u05d7 \u05d1-Excel. \u05d9\u05e2\u05d5\u05d3\u05db\u05df \u05d0\u05d5\u05d8\u05d5\u05de\u05d8\u05d9\u05ea \u05d0\u05d7\u05e8\u05d9 \u05e9\u05d9\u05d9\u05e1\u05d2\u05e8 (\u05d1\u05d3\u05d9\u05e7\u05d4 \u05db\u05dc 15 \u05d3\u05e7\u05d5\u05ea).'
        : String((e && e.message) || e).substring(0, 200);
    // 409 = a parallel run wrote the file a moment ago: not an error (29/09).
    if (e && e.status === 409) return { ok: false, file: which, pushed: false, retry: true, error: 'conflict' };
    await stateSet(env, { [K + 'err']: msg, [K + 'err_at']: now }).catch(() => {});
    return { ok: false, file: which, pushed: false, error: msg, locked: !!(e && e.status === 423) };
  }
}

// ---- The archive (29/09/2026, Michael: "the archive keeps too many files";
// reports months back must still be there) ----
// Once a month: a copy of the xlsm as it stood when the month ended, in
// ארכיון/חודשי, named with the month (09-2026). Once a day: copies in
// ארכיון/גרסאות שנדרסו older than 30 days are deleted (to the OneDrive
// recycle bin). Nothing else in the archive is touched.
// By year (upgrade review 24): December's copy goes to the folder of the year
// it belongs to, from that year's file.
const ARCHIVE = (y) => folderFor(y) + '/\u05d0\u05e8\u05db\u05d9\u05d5\u05df';
export const MONTHLY = (y) => ARCHIVE(y) + '/\u05d7\u05d5\u05d3\u05e9\u05d9';
export const OVERWRITTEN = (y) => ARCHIVE(y) + '/\u05d2\u05e8\u05e1\u05d0\u05d5\u05ea \u05e9\u05e0\u05d3\u05e8\u05e1\u05d5';
const KEEP_DAYS = 30, MAX_PRUNE = 20;
// Only the server's own copies: the file's name, " - ", a stamp, xlsm/xlsx.
const COPY_RE = /^\u05e0\u05d9\u05d4\u05d5\u05dc \u05e1\u05d9\u05d5\u05e8\u05d9 \u05de\u05e4\u05d2\u05e2\u05d9\u05dd - [\d .-]+\.xls[xm]$/;
export async function runArchive(env, now) {
  const today = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
  const prevMonth = addDays(today.substring(0, 7) + '-01', -1).substring(0, 7);
  const st = await stateGet(env, ['hazard_snap_month', 'hazard_prune_day']).catch(() => ({}));
  const val = (k) => (st[k] && st[k].value) || '';
  const out = { ok: true };
  // First run: this month is not over, so nothing to copy until it is.
  if (!val('hazard_snap_month')) { await stateSet(env, { hazard_snap_month: prevMonth }); out.snap = 'from next month'; }
  const doSnap = !out.snap && val('hazard_snap_month') !== prevMonth, doPrune = val('hazard_prune_day') !== today;
  if (!doSnap && !doPrune) return Object.assign(out, { reason: 'nothing to do' });
  const { token } = await accessToken(env);
  const auth = { Authorization: 'Bearer ' + token };
  if (doSnap) {
    const f = FILES.xlsm, name = stampMonth(f.name, prevMonth), py = +prevMonth.substring(0, 4);
    const ex = await fetch(G + seg(MONTHLY(py)) + '/' + encodeURIComponent(name) + '?select=id', { headers: auth });
    if (ex.status === 404) {
      const mr = await fetch(G + seg(folderFor(py)) + '/' + encodeURIComponent(f.name) + '?select=id,@microsoft.graph.downloadUrl', { headers: auth });
      if (!mr.ok) throw new Error('onedrive ' + mr.status);
      const dl = await fetch((await mr.json())['@microsoft.graph.downloadUrl']);
      if (!dl.ok) throw new Error('download failed (' + dl.status + ')');
      await graphPut(token, MONTHLY(py), name, new Uint8Array(await dl.arrayBuffer()), f.type);
      out.snap = name;
    } else if (ex.ok) out.snap = 'already there';
    else throw new Error('onedrive ' + ex.status);
    await stateSet(env, { hazard_snap_month: prevMonth });
  }
  if (doPrune) {
    // This year's copies and last year's (they stop growing on 1 January).
    const y = ilYear(now), old = [], gone = [];
    for (const yy of y > FIRST_YEAR ? [y, y - 1] : [y]) {
      const lr = await fetch(G + seg(OVERWRITTEN(yy)) + ':/children?$select=id,name,createdDateTime,file&$top=200', { headers: auth });
      const items = lr.status === 404 ? [] : lr.ok ? ((await lr.json()).value || []) : null;
      if (!items) throw new Error('onedrive ' + lr.status);
      const cut = now.getTime() - KEEP_DAYS * DAY;
      items.filter((x) => x.file && COPY_RE.test(x.name || '') && Date.parse(x.createdDateTime) < cut).forEach((x) => old.push(x));
    }
    for (const x of old.slice(0, MAX_PRUNE)) {
      const d = await fetch('https://graph.microsoft.com/v1.0/me/drive/items/' + encodeURIComponent(x.id), { method: 'DELETE', headers: auth });
      if (d.ok || d.status === 404) gone.push(x.name);
    }
    out.pruned = gone;
    // More than a run's worth: the rest on the next run, not tomorrow.
    await stateSet(env, old.length > MAX_PRUNE ? { hazard_prune_report: gone.length + ' deleted' } : { hazard_prune_day: today, hazard_prune_report: gone.length + ' deleted' });
  }
  return out;
}
// "name - 09-2026.xlsm" for the month 2026-09.
export function stampMonth(name, ym) {
  const i = name.lastIndexOf('.');
  return name.substring(0, i) + ' - ' + ym.substring(5, 7) + '-' + ym.substring(0, 4) + name.substring(i);
}

// One run per file at a time (runLeased, _onedrive.js).
const LEASE_MS = 120000;
export async function runFileLocked(env, which, force, opt) {
  const r = await runLeased(env, 'hazard_' + which, LEASE_MS, () => runFile(env, which, force, opt));
  if (r && r.busy) return { ok: true, file: which, pushed: false, reason: 'busy' };
  // Proof of life for the sync watchdog (_watchdog.js): a run that finished,
  // written or unchanged, means the file and the app agree.
  if (r && r.ok) await stateSet(env, { ['hazard_' + which + '_ok_at']: new Date().toISOString() }).catch(() => {});
  return r;
}

export async function onRequest(context) {
  const { request, env } = context;
  const allowed = defaultAllowedOrigins(env);
  const cors = corsHeaders(request.headers.get('Origin') || '', allowed, 'POST,OPTIONS');
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return jsonResp({ error: 'method not allowed' }, 405, cors);
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return jsonResp({ error: 'server misconfigured' }, 500, cors);
  let body = {}; try { body = await request.json(); } catch (e) {}
  let force = false;
  if (/^Bearer\s+\S/i.test(request.headers.get('authorization') || '')) {
    const who = await requireRole(request, env, ['admin', 'manager']);
    if (!who.ok) return jsonResp({ error: who.error }, who.status, cors);
    if (body.op === 'status') {
      const keys = [];
      Object.keys(FILES).forEach((k) => ['at', 'err', 'err_at', 'url', 'dropped', 'rows'].forEach((x) => keys.push('hazard_' + k + '_' + x)));
      keys.push(WATCH_KEY);
      const s = await stateGet(env, keys).catch(() => ({}));
      const v = (k) => (s[k] && s[k].value) || null;
      let row = null; try { row = odConfigured(env) ? await tokenRow(env) : null; } catch (e) {}
      const files = {};
      const dj = (k) => { try { return JSON.parse(v('hazard_' + k + '_dropped') || 'null'); } catch (e) { return null; } };
      Object.keys(FILES).forEach((k) => { files[k] = { name: FILES[k].name, rows: +v('hazard_' + k + '_rows') || null, maxRows: MAX_ROW - 1, warnAt: FULL_WARN, last: v('hazard_' + k + '_at'), error: v('hazard_' + k + '_err'), errorAt: v('hazard_' + k + '_err_at'), webUrl: v('hazard_' + k + '_url'), dropped: dj(k) }; });
      // The sync watchdog's open problems, for the home screen: also when the
      // mail could not go out (the Microsoft connection is what broke).
      let watch = null; try { const w = JSON.parse(v(WATCH_KEY) || 'null'); if (w) watch = { at: w.at, mailErr: w.mail_err || '', open: Object.keys(w.open || {}).map((k) => ({ key: k, title: w.open[k].title, detail: w.open[k].detail, since: w.open[k].since })) }; } catch (e) { watch = null; }
      return jsonResp({ configured: odConfigured(env), connected: !!(row && row.refresh_token), folder: folderFor(ilYear()), files, watch }, 200, cors);
    }
    // "\u05d8\u05d5\u05e4\u05dc" on an item of the not-taken list.
    if (body.op === 'dismiss') {
      const f = body.file === 'xlsx' ? 'xlsx' : 'xlsm', k = String(body.key || '').substring(0, 300), sk = 'hazard_' + f + '_dropped', dk = 'hazard_' + f + '_dismissed';
      const s = await stateGet(env, [sk, dk]).catch(() => ({}));
      let d = null, ds = []; try { d = JSON.parse((s[sk] && s[sk].value) || 'null'); } catch (e) { d = null; }
      try { ds = JSON.parse((s[dk] && s[dk].value) || '[]'); } catch (e) { ds = []; }
      const items = ((d && d.items) || []).filter((x) => dropKey(x) !== k);
      // Also remembered apart, so a run that read the list a moment before
      // does not bring the item back.
      if (k && ds.indexOf(k) < 0) ds = ds.concat([k]).slice(-100);
      await stateSet(env, { [sk]: JSON.stringify({ at: (d && d.at) || new Date().toISOString(), items }), [dk]: JSON.stringify(ds) });
      return jsonResp({ ok: true, left: items.length }, 200, cors);
    }
    force = body.force === true;
  } else {
    const want = env.TRUSTEE_NOTIFY_SECRET;
    if (!want || (request.headers.get('x-notify-secret') || '') !== want) return jsonResp({ error: 'forbidden' }, 403, cors);
    force = body.force === true;
  }
  if (!odConfigured(env)) return jsonResp({ ok: false, error: 'server not configured' }, 200, cors);
  // The sync watchdog (upgrade review 12): the tick's own request, below.
  if (body.op === 'watch') {
    if (/^Bearer\s+\S/i.test(request.headers.get('authorization') || '')) return jsonResp({ error: 'forbidden' }, 403, cors);
    try { return jsonResp(await runWatch(env, new URL('/', request.url).toString()), 200, cors); } catch (e) { return jsonResp({ ok: false, error: String((e && e.message) || e).substring(0, 200) }, 200, cors); }
  }
  if (body.op === 'archive') {
    try { return jsonResp(await runArchive(env, new Date()), 200, cors); } catch (e) { return jsonResp({ ok: false, error: String((e && e.message) || e).substring(0, 200) }, 200, cors); }
  }
  const which = body.file === 'xlsx' ? 'xlsx' : 'xlsm';
  try {
    // The archive housekeeping (runArchive), in its own request; it does
    // nothing on most runs (one state read).
    if (which === 'xlsm' && context.waitUntil && env.TRUSTEE_NOTIFY_SECRET) {
      context.waitUntil(fetch(new URL('/api/hazard-file', request.url).toString(), {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-notify-secret': env.TRUSTEE_NOTIFY_SECRET },
        body: JSON.stringify({ op: 'archive' }),
      }).catch(() => {}));
    }
    // The sync watchdog (_watchdog.js), in its own request: it reads what the
    // previous runs left, so it does not wait for this one.
    if (which === 'xlsm' && context.waitUntil && env.TRUSTEE_NOTIFY_SECRET) {
      context.waitUntil(fetch(new URL('/api/hazard-file', request.url).toString(), {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-notify-secret': env.TRUSTEE_NOTIFY_SECRET },
        body: JSON.stringify({ op: 'watch' }),
      }).catch(() => {}));
    }
    // The notification retry (trustee-notify.js op:'retry', upgrade review 10)
    // rides the same 15-minute tick, in its own request.
    if (which === 'xlsm' && context.waitUntil && env.TRUSTEE_NOTIFY_SECRET) {
      context.waitUntil(fetch(new URL('/api/trustee-notify', request.url).toString(), {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-notify-secret': env.TRUSTEE_NOTIFY_SECRET },
        body: JSON.stringify({ op: 'retry' }),
      }).catch(() => {}));
    }
    const r = await runFileLocked(env, which, force);
    // The twin, in its own request (its own CPU and subrequest budget).
    if (which === 'xlsm' && context.waitUntil && env.TRUSTEE_NOTIFY_SECRET) {
      context.waitUntil(fetch(new URL('/api/hazard-file', request.url).toString(), {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-notify-secret': env.TRUSTEE_NOTIFY_SECRET },
        body: JSON.stringify({ file: 'xlsx', force }),
      }).catch(() => {}));
      r.next = 'xlsx';
    }
    // After the twin, the committee deck (hazard-deck.js), in its own request.
    if (which === 'xlsx' && context.waitUntil && env.TRUSTEE_NOTIFY_SECRET) {
      context.waitUntil(fetch(new URL('/api/hazard-deck', request.url).toString(), {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-notify-secret': env.TRUSTEE_NOTIFY_SECRET },
        body: JSON.stringify({ force }),
      }).catch(() => {}));
      r.next = 'deck';
    }
    r.commit = String(env.CF_PAGES_COMMIT_SHA || '').substring(0, 7) || null;
    return jsonResp(r, 200, cors);
  } catch (e) {
    return jsonResp({ ok: false, error: String((e && e.message) || e).substring(0, 200) }, 200, cors);
  }
}
