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
import { odConfigured, accessToken, stateGet, stateSet, tokenRow } from '../_onedrive.js';
import { patchSheetRows, sheetsDigest, readSheetRows } from '../_xlsxpatch.js';
import { suggestAction } from '../_ai.js';

export const FOLDER = '\u05e9\u05d5\u05dc\u05d7\u05df \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4/\u05e0\u05d9\u05d4\u05d5\u05dc \u05d1\u05d8\u05d9\u05d7\u05d5\u05ea/13_\u05e1\u05d9\u05d5\u05e8\u05d9 \u05de\u05e4\u05d2\u05e2\u05d9\u05dd/2026';
export const FILES = {
  xlsm: { name: '\u05e0\u05d9\u05d4\u05d5\u05dc \u05e1\u05d9\u05d5\u05e8\u05d9 \u05de\u05e4\u05d2\u05e2\u05d9\u05dd.xlsm', type: 'application/vnd.ms-excel.sheet.macroEnabled.12' },
  xlsx: { name: '\u05e0\u05d9\u05d4\u05d5\u05dc \u05e1\u05d9\u05d5\u05e8\u05d9 \u05de\u05e4\u05d2\u05e2\u05d9\u05dd.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
};
const SHEET = '\u05de\u05d0\u05d2\u05e8 \u05de\u05e4\u05d2\u05e2\u05d9\u05dd';
const LAST_COL = 12, MAX_ROW = 206, DATE_COLS = [1, 9, 11];
export const DEPTS = ['\u05de\u05e2\u05e6\u05d1\u05d9\u05dd', '\u05d9\u05d9\u05e6\u05d5\u05e8 \u05d8\u05d5\u05d2\u05e0\u05d9\u05dd', '\u05d7\u05d5\u05de\u05e8 \u05d2\u05dc\u05dd', '\u05ea\u05d5\u05e6\u05d2', '\u05de\u05e2\u05d1\u05d3\u05d5\u05ea'];
// Spellings in the locations list / trustee screens -> the sheet's departments.
const DEPT_ALIAS = { '\u05de\u05e2\u05d5\u05e6\u05d1\u05d9\u05dd': '\u05de\u05e2\u05e6\u05d1\u05d9\u05dd', '\u05ea\u05d5\u05e6"\u05d2': '\u05ea\u05d5\u05e6\u05d2', '\u05de\u05e2\u05d1\u05d3\u05d4': '\u05de\u05e2\u05d1\u05d3\u05d5\u05ea' };
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

export function trusteeDept(loc) {
  const head = String(loc || '').split('\u00b7')[0].trim();
  const d = DEPT_ALIAS[head] || head;
  return { dept: d, loc: String(loc || '').indexOf('\u00b7') >= 0 ? String(loc).split('\u00b7').slice(1).join('\u00b7').trim() : String(loc || '') };
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
    rows.push(['\u05e0-' + (k + 1), dt(r.d), tourFor(dept, d10(r.d)), dept, loc, r.f || '', '\u05d1\u05d9\u05e0\u05d5\u05e0\u05d9\u05ea', '\u05de\u05e0\u05d4\u05dc \u05d4\u05de\u05d7\u05dc\u05e7\u05d4', (r.action ? r.action + ' (' : '') + '\u05e1\u05d9\u05d5\u05e8 \u05e0\u05d0\u05de\u05df: ' + (r.u || '') + (r.action ? ')' : ''),
      routed[r.id] ? dt(routed[r.id].due) : d10(r.d) ? { date: addDays(d10(r.d), TRUSTEE_DUE_DAYS) } : null, closed ? '\u05e1\u05d2\u05d5\u05e8' : '\u05e4\u05ea\u05d5\u05d7',
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
export async function readAll(env, path) {
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const base = (env.SUPABASE_URL || 'https://znhjtpcltrxxyfjczgvw.supabase.co') + '/rest/v1/';
  const r = await fetch(base + path + '&limit=5000', { headers: { apikey: key, Authorization: 'Bearer ' + key } });
  if (!r.ok) throw new Error('read ' + path.split('?')[0] + ' failed (' + r.status + ')');
  const j = await r.json();
  return Array.isArray(j) ? j : [];
}
export async function graphPut(token, folder, name, bytes, type) {
  const r = await fetch(G + seg(folder) + '/' + encodeURIComponent(name) + ':/content', { method: 'PUT', headers: { Authorization: 'Bearer ' + token, 'Content-Type': type }, body: bytes });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error('onedrive ' + r.status + (j && j.error ? ': ' + String(j.error.message || j.error.code).substring(0, 160) : '')); e.status = r.status; throw e; }
  return j;
}
export function stampName(name, iso) {
  const i = name.lastIndexOf('.');
  return name.substring(0, i) + ' - ' + iso.replace('T', ' ').substring(0, 16).replace(':', '-') + name.substring(i);
}

// ---- Excel -> app (28/09, Michael: "if I close in the file, the app has to
// update, and the other way round, fully automatic") ----
// When a person saved the file since the server last wrote it, the register
// rows are read back and compared with what the server wrote then
// (hazard_<file>_last). Only columns I (action), K (status), L (closing date)
// and M (notes) are taken (Michael: "סגירה + פעולה + הערות"); description,
// department, severity and the rest stay as in the app. A field that changed
// in the app too since that write keeps the app's value (the file version is
// in the archive). A new row with a description becomes a new manager hazard.
// Rows deleted in Excel are not deleted in the app.
const S_OPEN = 'פתוח', S_WIP = 'בטיפול', S_DONE = 'סגור', TR_CLOSED = 'נסגר';
const PULL_COLS = [8, 10, 11, 12];
const MAX_PULL = 25; // database writes per run (subrequests); the rest next run
const norm = (v) => (v == null ? '' : typeof v === 'object' && v.date ? v.date : String(v).replace(/\r\n?/g, '\n').trim());
const isYmd = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v);
const orNull = (t) => (t ? t : null);
const stripMgr = (t) => orNull(String(t || '').replace(/^דיווח ממונה\.?\s*/, '').trim());
const stripTrustee = (t) => orNull(String(t || '').replace(/^דיווח נאמן:[^.]*\.?\s*/, '').trim());
function stripTour(t) {
  t = String(t || '').trim();
  const m = /^([\s\S]*?)\s*\(סיור נאמן:[^)]*\)$/.exec(t);
  if (m) return orNull(m[1].trim());
  return /^סיור נאמן:/.test(t) ? null : orNull(t);
}
function takeField(kind, ci, fv, patch) {
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
export function diffEdits(fileRows, last, hazards, reports, today) {
  const cur = buildRegister(hazards, reports);
  const curBy = {}; cur.ids.forEach((id, i) => { curBy[id] = cur.rows[i]; });
  const lastBy = {};
  (last.ids || []).forEach((id, i) => { const k = norm(((last.rows || [])[i] || [])[0]); if (k) lastBy[k] = { id, row: last.rows[i], i }; });
  const hById = {}, rById = {};
  (hazards || []).forEach((h) => { hById[h.id] = h; });
  (reports || []).forEach((r) => { rById[r.id] = r; });
  const hz = {}, tr = {}, fresh = [], pulled = [], seen = new Set();
  const usedN = new Set((hazards || []).map((h) => +h.n).filter((n) => n > 0));
  let maxN = Math.max(0, ...usedN);
  (fileRows || []).forEach(({ v }) => {
    const key = norm(v[0]);
    const hit = key && lastBy[key];
    if (hit) {
      if (seen.has(key)) return; seen.add(key);
      const kind = hit.id.charAt(0), id = hit.id.substring(2);
      const c = curBy[hit.id]; if (!c) return; // gone from the app since
      PULL_COLS.forEach((ci) => {
        const fv = norm(v[ci]), lv = norm(hit.row[ci]);
        if (fv === lv || norm(c[ci]) !== lv) return; // not edited, or the app changed it too
        const patch = kind === 'h' ? (hz[id] = hz[id] || {}) : (tr[id] = tr[id] || {});
        if (takeField(kind, ci, fv, patch)) pulled.push({ i: hit.i, ci, val: v[ci] == null ? '' : v[ci] });
      });
      return;
    }
    const descr = norm(v[5]);
    if (/^נ-/.test(key) || !descr) return;
    // Already created from this row on an earlier run (the file is rewritten
    // only after the database writes all went through).
    if ((hazards || []).concat(fresh).some((h) => norm(h.descr) === descr && norm(h.dept) === norm(v[3]))) return;
    let n = /^\d+$/.test(key) && !usedN.has(+key) ? +key : maxN + 1;
    usedN.add(n); maxN = Math.max(maxN, n);
    const rs = norm(v[7]).split(/\s*\+\s*/);
    const st = [S_OPEN, S_WIP, S_DONE].indexOf(norm(v[10])) >= 0 ? norm(v[10]) : S_OPEN;
    const dOf = (x) => (isYmd(norm(x)) ? norm(x) : null);
    const num = (x) => (/^\d+$/.test(norm(x)) ? +norm(x) : null);
    fresh.push({ id: 'th-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6), n, d: dOf(v[1]), tour_no: num(v[2]),
      dept: norm(v[3]), loc: orNull(norm(v[4])), descr, sev: orNull(norm(v[6])), resp: orNull(rs[0] || ''), resp2: orNull(rs[1] || ''),
      action: orNull(norm(v[8])), due: dOf(v[9]), s: st, closed_d: dOf(v[11]) || (st === S_DONE ? today : null), notes: stripMgr(norm(v[12])) });
  });
  // Closed in Excel without a date: today, as when closing in the app.
  Object.keys(hz).forEach((id) => { const p = hz[id]; if (p.s === S_DONE && !('closed_d' in p) && !hById[id].closed_d) p.closed_d = today; });
  Object.keys(tr).forEach((id) => { const p = tr[id]; if (p.s === TR_CLOSED && !('closed_d' in p) && !rById[id].closed_d) p.closed_d = today; });
  const list = (o) => Object.keys(o).filter((id) => Object.keys(o[id]).length).map((id) => Object.assign({ id }, o[id]));
  return { hazards: list(hz), reports: list(tr), fresh, pulled };
}

// Writes the edits (new hazards first, in one request), updates the arrays in
// memory. More than MAX_PULL writes: the rest waits for the next run, and the
// file is not rewritten until then (it would drop them).
async function applyEdits(env, ed, hazards, reports) {
  const key = env.SUPABASE_SERVICE_ROLE_KEY, base = (env.SUPABASE_URL || 'https://znhjtpcltrxxyfjczgvw.supabase.co') + '/rest/v1/';
  const h = { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', Prefer: 'return=minimal' };
  let budget = MAX_PULL, done = { created: 0, hazards: 0, reports: 0 };
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
      budget--; done[k]++;
    }
    return true;
  };
  const all = (await one('tour_hazards', hazards, ed.hazards, 'hazards')) && (await one('trustee_reports', reports, ed.reports, 'reports'));
  done.pending = !all;
  return done;
}

export async function runFile(env, which, force) {
  const f = FILES[which]; if (!f) throw new Error('unknown file');
  const [hazards, reports, tasks] = await Promise.all([
    readAll(env, 'tour_hazards?select=id,n,d,tour_no,dept,loc,descr,sev,resp,resp2,action,due,s,closed_d,notes&order=n.asc'),
    readAll(env, 'trustee_reports?select=id,u,t,d,loc,ok,f,s,ref,mgr_note,action,closed_d,ts&order=ts.asc'),
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
  let reg = buildRegister(hazards, reports, tasks);
  let sig = await sha(JSON.stringify(reg.rows));
  const K = 'hazard_' + which + '_';
  const st = await stateGet(env, [K + 'sig', K + 'ctag', K + 'sheets', K + 'last']).catch(() => ({}));
  const val = (k) => (st[K + k] && st[K + k].value) || '';
  const now = new Date().toISOString();
  try {
    const { token } = await accessToken(env);
    const mr = await fetch(G + seg(FOLDER) + '/' + encodeURIComponent(f.name) + '?select=id,cTag,lastModifiedDateTime,size,webUrl,@microsoft.graph.downloadUrl', { headers: { Authorization: 'Bearer ' + token } });
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
    // Excel -> app first, so the rewrite carries what the person changed.
    let pulled = null;
    let last = null; try { last = val('last') ? JSON.parse(val('last')) : null; } catch (e) { last = null; }
    if (personSaved && last && Array.isArray(last.rows) && Array.isArray(last.ids)) {
      const fileRows = await readSheetRows(orig, { sheet: SHEET, lastCol: LAST_COL, maxRow: MAX_ROW, dateCols: DATE_COLS });
      const ed = diffEdits(fileRows, last, hazards, reports, now.substring(0, 10));
      if (ed.fresh.length || ed.hazards.length || ed.reports.length) {
        pulled = await applyEdits(env, ed, hazards, reports);
        // If the write below fails (file open in Excel), the next run must not
        // take these cells as edited again, nor as changed in the app.
        ed.pulled.forEach((p) => { if (last.rows[p.i]) last.rows[p.i][p.ci] = p.val; });
        await stateSet(env, { [K + 'last']: JSON.stringify(last) });
        if (pulled.pending) return { ok: true, file: which, pushed: false, reason: 'pulling', pulled };
        reg = buildRegister(hazards, reports, tasks);
        sig = await sha(JSON.stringify(reg.rows));
      }
    }
    // Keep what a person saved, before replacing it.
    let kept = null;
    if (!ours || personSaved) {
      const folder = FOLDER + '/ארכיון/' + (ours ? 'גרסאות שנדרסו' : 'לפני כתיבה ראשונה מהאפליקציה');
      await graphPut(token, folder, stampName(f.name, meta.lastModifiedDateTime || now), orig, f.type);
      kept = folder;
    }
    const out = await patchSheetRows(orig, reg.rows, { sheet: SHEET, lastCol: LAST_COL, maxRow: MAX_ROW, dateCols: DATE_COLS });
    const put = await graphPut(token, FOLDER, f.name, out, f.type);
    const outSheets = await sheetsDigest(out).catch(() => '');
    await stateSet(env, { [K + 'sig']: sig, [K + 'ctag']: put.cTag || '', [K + 'sheets']: outSheets, [K + 'last']: JSON.stringify({ rows: reg.rows, ids: reg.ids }),
      [K + 'at']: now, [K + 'err']: '', [K + 'url']: put.webUrl || meta.webUrl || '' });
    return { ok: true, file: which, pushed: true, rows: reg.rows.length, managers: hazards.length, trustees: reg.rows.length - hazards.length, kept, pulled, webUrl: put.webUrl || null };
  } catch (e) {
    const msg = e && e.code === 'not_connected' ? 'not connected'
      : e && e.status === 423 ? '\u05d4\u05e7\u05d5\u05d1\u05e5 \u05e4\u05ea\u05d5\u05d7 \u05d1-Excel. \u05d9\u05e2\u05d5\u05d3\u05db\u05df \u05d0\u05d5\u05d8\u05d5\u05de\u05d8\u05d9\u05ea \u05d0\u05d7\u05e8\u05d9 \u05e9\u05d9\u05d9\u05e1\u05d2\u05e8 (\u05d1\u05d3\u05d9\u05e7\u05d4 \u05db\u05dc 15 \u05d3\u05e7\u05d5\u05ea).'
        : String((e && e.message) || e).substring(0, 200);
    await stateSet(env, { [K + 'err']: msg, [K + 'err_at']: now }).catch(() => {});
    return { ok: false, file: which, pushed: false, error: msg, locked: !!(e && e.status === 423) };
  }
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
      Object.keys(FILES).forEach((k) => ['at', 'err', 'err_at', 'url'].forEach((x) => keys.push('hazard_' + k + '_' + x)));
      const s = await stateGet(env, keys).catch(() => ({}));
      const v = (k) => (s[k] && s[k].value) || null;
      let row = null; try { row = odConfigured(env) ? await tokenRow(env) : null; } catch (e) {}
      const files = {};
      Object.keys(FILES).forEach((k) => { files[k] = { name: FILES[k].name, last: v('hazard_' + k + '_at'), error: v('hazard_' + k + '_err'), errorAt: v('hazard_' + k + '_err_at'), webUrl: v('hazard_' + k + '_url') }; });
      return jsonResp({ configured: odConfigured(env), connected: !!(row && row.refresh_token), folder: FOLDER, files }, 200, cors);
    }
    force = body.force === true;
  } else {
    const want = env.TRUSTEE_NOTIFY_SECRET;
    if (!want || (request.headers.get('x-notify-secret') || '') !== want) return jsonResp({ error: 'forbidden' }, 403, cors);
    force = body.force === true;
  }
  if (!odConfigured(env)) return jsonResp({ ok: false, error: 'server not configured' }, 200, cors);
  const which = body.file === 'xlsx' ? 'xlsx' : 'xlsm';
  try {
    const r = await runFile(env, which, force);
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
