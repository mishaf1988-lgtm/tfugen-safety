// Cloudflare Pages Function: the weekly summary to Michael (upgrade review 11,
// 30/09/2026; Michael: "yes, Sunday 07:00"). Until now nothing reminded anyone
// by itself: the expiry scan ran only in the browser and was off, a hazard past
// its target waited for someone to open the tours screen, and an old deck was
// found out in front of the committee.
//
// One mail a week, to the connected account only (sviva, the mailbox the
// reports go out from), built from the same merged register the file, the
// department report and the deck use (hazard-file.js buildRegister):
//   * hazards past their target, grouped by the responsible party, the longest
//     overdue first;
//   * hazards whose target is within the next 7 days;
//   * open hazards with no target at all;
//   * open trustee findings (the \u05e0-k rows), the oldest first;
//   * before the committee: the next meeting date (hazard-deck.js), when the
//     deck was last written, the sync problems the watchdog holds open
//     (_watchdog.js), and the three hazards to raise (highest severity, then
//     the most overdue);
//   * the statutory registers with no row at all (BACKLOG 9.1, the same four
//     as _REQ_REGS in index.html): an empty register raises no expiry, so the
//     rest of the mail would read "all clear" while nothing is tracked;
//   * expiries (02/10/2026, Michael: "yes"): every row of the expiry tables
//     the app scans (_expCollect: docs, tr, ppe, ctr, equip_inspections,
//     hearing_tests, med) that expired or expires within 30 days, so a
//     certificate or the Azure secret (a docs row) is said before it lapses,
//     not only on the expiry page nobody opened.
//   * recurring duties in the same block (02/10/2026, BACKLOG 7): a drill per
//     type, an internal audit per area, a management review of any kind and a
//     compliance evaluation per law fall due 12 months after the last one, the
//     rule of _drlNext / _audNext / _mrNext / _legNext in index.html. One never
//     done has no date and stays on the expiry page ("no date" tab); a
//     management review never done is a red line of its own (neverOf).
// pg_cron calls POST /api/weekly-digest every Sunday at 07:00 Israel time
// (migrations/2026-10-01_weekly_digest_cron.sql) with x-notify-secret; an
// admin can ask for {op:'preview'} (the data, no mail) or {op:'send'} (the same
// mail, now). A second call within 20 hours is skipped unless force: true,
// so the two UTC slots of the cron and a manual send never double the mail.
// The result lands in server_state (key weekly_digest). No Mail.Send, no
// OneDrive connection = the mail cannot go; the result says so.
import { defaultAllowedOrigins, corsHeaders, jsonResp, requireRole } from '../_shared.js';
import { odConfigured, accessToken, tokenRow, hasMail, sendMail, stateGet, stateSet } from '../_onedrive.js';
import { buildRegister, readAll, TASKS_Q } from './hazard-file.js';
import { meetingDate } from './hazard-deck.js';
import { WATCH_KEY, ilTime } from '../_watchdog.js';
import { UPLOAD_LOG } from './od-read.js';

export const STATE_KEY = 'weekly_digest';
export const APP_URL = 'https://tapugan-safety.pages.dev';
export const SOON_DAYS = 7, EXP_DAYS = 30, EXP_SHOW = 40, TOPICS = 3, REPEAT_MS = 20 * 3600 * 1000;
const DAY = 86400000;
// The same four as _REQ_REGS in index.html: [table, label].
export const REQ_REGS = [['equip_inspections', '\u05d1\u05d3\u05d9\u05e7\u05d5\u05ea \u05e6\u05d9\u05d5\u05d3'], ['hearing_tests', '\u05d1\u05d3\u05d9\u05e7\u05d5\u05ea \u05e9\u05de\u05d9\u05e2\u05d4'], ['tr', '\u05d4\u05d3\u05e8\u05db\u05d5\u05ea'], ['hzm', '\u05d7\u05d5\u05de\u05e8\u05d9\u05dd \u05de\u05e1\u05d5\u05db\u05e0\u05d9\u05dd']];
// The tables _expCollect in index.html scans: [table, label, name columns, owner columns].
export const EXP_SRC = [
  ['docs', '\u05de\u05e1\u05de\u05da', ['n'], ['o']],
  ['tr', '\u05d4\u05d3\u05e8\u05db\u05d4', ['n'], ['w']],
  ['ppe', '\u05e6\u05de"\u05d2', ['ty'], ['w']],
  ['ctr', '\u05e7\u05d1\u05dc\u05df', ['n'], ['c']],
  ['equip_inspections', '\u05d1\u05d3\u05d9\u05e7\u05ea \u05e6\u05d9\u05d5\u05d3', ['n', 'code'], ['vendor', 'loc']],
  ['hearing_tests', '\u05d1\u05d3\u05d9\u05e7\u05ea \u05e9\u05de\u05d9\u05e2\u05d4', ['emp_name'], ['dept', 'role']],
  ['med', '\u05d1\u05d3\u05d9\u05e7\u05d4 \u05e8\u05e4\u05d5\u05d0\u05d9\u05ea', ['n'], ['w']],
];
// The recurring duties, as the expiry page computes them: [label, table, select, rows -> [{name, owner, e}]].
export const FREQ_M = 12;
export function plusMonths(d, n) {
  const p = ymd(d).split('-'); if (p.length < 3) return '';
  let y = +p[0], m = +p[1] - 1 + n; y += Math.floor(m / 12); m %= 12;
  const dd = Math.min(+p[2], new Date(Date.UTC(y, m + 1, 0)).getUTCDate());
  return y + '-' + ('0' + (m + 1)).slice(-2) + '-' + ('0' + dd).slice(-2);
}
const lastBy = (rows, key, ok) => { const m = {}; (rows || []).forEach((r) => { const d = ymd(r.d), k = r[key]; if (d && k && (!ok || ok(r)) && !(m[k] > d)) m[k] = d; }); return Object.keys(m).map((k) => ({ name: k, owner: '\u05d0\u05d7\u05e8\u05d5\u05df: ' + fd(m[k]), e: plusMonths(m[k], FREQ_M) })); };
// The factory's measurements, as _envNext in the app: months 0 = once a calendar year.
export const ENV_DUTIES = [['\u05d1\u05d3\u05d9\u05e7\u05ea \u05e4\u05dc\u05d9\u05d8\u05d5\u05ea \u05d1\u05d0\u05e8\u05d5\u05d1\u05d5\u05ea', 0], ['\u05d3\u05d9\u05d2\u05d5\u05dd \u05e9\u05e4\u05db\u05d9\u05dd \u05e9\u05e0\u05ea\u05d9', 12], ['\u05d3\u05d9\u05d2\u05d5\u05dd \u05e9\u05e4\u05db\u05d9\u05dd \u05d7\u05d5\u05d3\u05e9\u05d9', 1]];
const envOf = (rows) => ENV_DUTIES.map(([ty, n]) => { const d = (rows || []).filter((r) => r.ty === ty).map((r) => ymd(r.d)).filter(Boolean).sort().pop(); return d ? { name: ty, owner: '\u05d0\u05d7\u05e8\u05d5\u05df: ' + fd(d), e: n ? plusMonths(d, n) : (+d.substring(0, 4) + 1) + '-12-31' } : null; }).filter(Boolean);
export const REC_SRC = [
  ['\u05ea\u05e8\u05d2\u05d9\u05dc \u05d7\u05d9\u05e8\u05d5\u05dd', 'drl', 'id,ty,d', (rows) => lastBy(rows, 'ty')],
  ['\u05d1\u05d9\u05e7\u05d5\u05e8\u05ea \u05e4\u05e0\u05d9\u05dd', 'auds', 'id,r,d,s', (rows) => lastBy(rows, 'r', (r) => r.s !== '\u05de\u05ea\u05d5\u05db\u05e0\u05df')],
  ['\u05e1\u05e7\u05d9\u05e8\u05ea \u05d4\u05e0\u05d4\u05dc\u05d4', 'mgmt_reviews', 'id,ts', (rows) => { const d = (rows || []).map((r) => ymd(String(r.ts || '').substring(0, 10))).filter(Boolean).sort().pop(); return d ? [{ name: '\u05e1\u05e7\u05d9\u05e8\u05ea \u05d4\u05e0\u05d4\u05dc\u05d4', owner: '\u05d0\u05d7\u05e8\u05d5\u05e0\u05d4: ' + fd(d), e: plusMonths(d, FREQ_M) }] : []; }, true],
  ['\u05e0\u05d9\u05d8\u05d5\u05e8 \u05e1\u05d1\u05d9\u05d1\u05ea\u05d9', 'env', 'id,ty,d', envOf],
  ['\u05d4\u05e2\u05e8\u05db\u05ea \u05e6\u05d9\u05d5\u05ea', 'leg', 'id,s,law_num,c,c_date', (rows) => (rows || []).filter((r) => ymd(r.c_date)).map((r) => ({ name: r.s || r.law_num || '', owner: '\u05d4\u05d5\u05e2\u05e8\u05da: ' + fd(r.c_date) + (r.c ? ' (' + r.c + ')' : ''), e: plusMonths(r.c_date, FREQ_M) }))],
];
// The fifth field: never done is a red line of its own (the app shows 9.3 red
// when mgmt_reviews is empty). Pure: only a table that was read and came back empty.
export const neverOf = (sets) => REC_SRC.filter(([, t, , , red]) => red && Array.isArray((sets || {})[t]) && !sets[t].length).map(([label]) => label);
// Pure. sets = {table: rows}; the lists expiringOf takes.
export const recurringOf = (sets) => REC_SRC.map(([label, t, , f]) => [label, ['name'], ['owner'], f((sets || {})[t])]);
const S_DONE = '\u05e1\u05d2\u05d5\u05e8';
const SEV_RANK = { '\u05d2\u05d1\u05d5\u05d4\u05d4': 3, '\u05d1\u05d9\u05e0\u05d5\u05e0\u05d9\u05ea': 2, '\u05e0\u05de\u05d5\u05db\u05d4': 1 };
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ymd = (v) => { const d = v && typeof v === 'object' ? v.date : v; return /^\d{4}-\d{2}-\d{2}/.test(String(d || '')) ? String(d).substring(0, 10) : ''; };
const fd = (v) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd(v)); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; };
const dayDiff = (from, to) => Math.round((Date.parse(to + 'T12:00:00Z') - Date.parse(from + 'T12:00:00Z')) / DAY);
const isTrustee = (r) => /^\u05e0-/.test(String(r[0] || ''));

function item(r, today) {
  const due = ymd(r[9]), d = ymd(r[1]);
  return { n: r[0], dept: r[3] || '', loc: r[4] || '', descr: r[5] || '', sev: r[6] || '', resp: r[7] || '', status: r[10] || '',
    due, days: due ? dayDiff(due, today) : null, age: d ? dayDiff(d, today) : null, trustee: isTrustee(r) };
}

// Pure. rows = buildRegister(...).rows; today = YYYY-MM-DD (Israel).
export function digestOf(rows, today) {
  const open = (rows || []).filter((r) => r && r[10] !== S_DONE).map((r) => item(r, today));
  const overdue = open.filter((x) => x.days > 0).sort((a, b) => b.days - a.days);
  const groups = [];
  overdue.forEach((x) => { let g = groups.find((y) => y.resp === x.resp); if (!g) { g = { resp: x.resp, items: [] }; groups.push(g); } g.items.push(x); });
  const soon = open.filter((x) => x.due && x.days <= 0 && x.days >= -SOON_DAYS).sort((a, b) => b.days - a.days || String(a.n).localeCompare(String(b.n)));
  const noDue = open.filter((x) => !x.due).sort((a, b) => (+a.n || 1e9) - (+b.n || 1e9));
  const trustee = open.filter((x) => x.trustee).sort((a, b) => (b.age || 0) - (a.age || 0));
  const score = (x) => (SEV_RANK[x.sev] || 0) * 1000 + Math.min(999, Math.max(0, x.days || 0));
  const topics = open.slice().sort((a, b) => score(b) - score(a) || (b.age || 0) - (a.age || 0)).slice(0, TOPICS);
  return { open: open.length, overdue: groups, overdueCount: overdue.length, soon, noDue, trustee, topics };
}

const H = {
  title: '\u05e1\u05d9\u05db\u05d5\u05dd \u05e9\u05d1\u05d5\u05e2\u05d9 - \u05de\u05e4\u05d2\u05e2\u05d9\u05dd \u05d5\u05dc\u05d9\u05e7\u05d5\u05d9\u05d9\u05dd',
  overdue: '\u05de\u05e4\u05d2\u05e2\u05d9\u05dd \u05d1\u05d0\u05d9\u05d7\u05d5\u05e8 \u05dc\u05e4\u05d9 \u05d0\u05d7\u05e8\u05d0\u05d9',
  soon: '\u05d9\u05e2\u05d3 \u05d1\u05e9\u05d1\u05d5\u05e2 \u05d4\u05e7\u05e8\u05d5\u05d1',
  noDue: '\u05de\u05e4\u05d2\u05e2\u05d9\u05dd \u05e4\u05ea\u05d5\u05d7\u05d9\u05dd \u05d1\u05dc\u05d9 \u05d9\u05e2\u05d3',
  trustee: '\u05dc\u05d9\u05e7\u05d5\u05d9\u05d9 \u05e0\u05d0\u05de\u05e0\u05d9\u05dd \u05e4\u05ea\u05d5\u05d7\u05d9\u05dd',
  committee: '\u05dc\u05e4\u05e0\u05d9 \u05d4\u05d5\u05d5\u05e2\u05d3\u05d4',
  none: '\u05d0\u05d9\u05df',
  th: ['\u05de\u05e1"\u05d3', '\u05de\u05d7\u05dc\u05e7\u05d4', '\u05de\u05d9\u05e7\u05d5\u05dd', '\u05ea\u05d9\u05d0\u05d5\u05e8', '\u05d7\u05d5\u05de\u05e8\u05d4', '\u05d0\u05d7\u05e8\u05d0\u05d9', '\u05d9\u05e2\u05d3', '\u05e1\u05d8\u05d8\u05d5\u05e1'],
  overdueBy: '\u05e2\u05d1\u05e8 \u05d4\u05d9\u05e2\u05d3 \u05d1-', inDays: '\u05d1\u05e2\u05d5\u05d3 ', today: '\u05d4\u05d9\u05d5\u05dd', days: ' \u05d9\u05de\u05d9\u05dd',
  openFor: '\u05e4\u05ea\u05d5\u05d7 ', total: '\u05e1\u05d4"\u05db \u05de\u05e4\u05d2\u05e2\u05d9\u05dd \u05e4\u05ea\u05d5\u05d7\u05d9\u05dd: ',
  meeting: '\u05d9\u05e9\u05d9\u05d1\u05ea \u05d4\u05d5\u05d5\u05e2\u05d3\u05d4 \u05d4\u05e7\u05e8\u05d5\u05d1\u05d4: ',
  deckAt: '\u05d4\u05de\u05e6\u05d2\u05ea \u05e2\u05d5\u05d3\u05db\u05e0\u05d4 \u05dc\u05d0\u05d7\u05e8\u05d5\u05e0\u05d4: ', deckNever: '\u05d4\u05de\u05e6\u05d2\u05ea \u05dc\u05d0 \u05e2\u05d5\u05d3\u05db\u05e0\u05d4 \u05de\u05e2\u05d5\u05dc\u05dd',
  deckOld: ' (\u05dc\u05e4\u05e0\u05d9 \u05d9\u05d5\u05ea\u05e8 \u05de\u05e9\u05d1\u05d5\u05e2)',
  sync: '\u05e9\u05d2\u05d9\u05d0\u05d5\u05ea \u05e1\u05e0\u05db\u05e8\u05d5\u05df \u05e4\u05ea\u05d5\u05d7\u05d5\u05ea: ', topics: '\u05e0\u05d5\u05e9\u05d0\u05d9\u05dd \u05dc\u05d4\u05e2\u05dc\u05d5\u05ea:',
  foot: '\u05de\u05d9\u05d9\u05dc \u05d0\u05d5\u05d8\u05d5\u05de\u05d8\u05d9, \u05e4\u05e2\u05dd \u05d1\u05e9\u05d1\u05d5\u05e2 \u05d1\u05d9\u05d5\u05dd \u05e8\u05d0\u05e9\u05d5\u05df \u05d1\u05d1\u05d5\u05e7\u05e8. ',
  app: '\u05dc\u05e4\u05ea\u05d5\u05d7 \u05d0\u05ea \u05d4\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4',
  exp: '\u05ea\u05e4\u05d5\u05d2\u05d5\u05ea: \u05e4\u05d2 \u05d0\u05d5 \u05d9\u05e4\u05d5\u05d2 \u05d1-30 \u05d9\u05d5\u05dd', expTh: ['\u05e1\u05d5\u05d2', '\u05e9\u05dd', '\u05d0\u05d7\u05e8\u05d0\u05d9', '\u05ea\u05e4\u05d5\u05d2\u05d4'], expired: '\u05e4\u05d2 \u05dc\u05e4\u05e0\u05d9 ', more: '\u05d5\u05e2\u05d5\u05d3 ', expFail: '\u05dc\u05d0 \u05e0\u05e7\u05e8\u05d0, \u05dc\u05d1\u05d3\u05d5\u05e7 \u05d1\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4: ',
  qGroups: '\u05d1\u05e7\u05e9\u05d5\u05ea \u05d4\u05e6\u05e2\u05ea \u05de\u05d7\u05d9\u05e8 \u05dc\u05e4\u05d9 \u05e0\u05d5\u05ea\u05df \u05e9\u05d9\u05e8\u05d5\u05ea', qGTh: ['\u05e0\u05d5\u05ea\u05df \u05e9\u05d9\u05e8\u05d5\u05ea', '\u05e4\u05e8\u05d9\u05d8\u05d9\u05dd', '\u05d1\u05e7\u05e9\u05d4'], qMailN: '\u05de\u05d9\u05d9\u05dc ', qNoVendor: '\u05e1\u05e4\u05e7 \u05dc\u05d0 \u05d9\u05d3\u05d5\u05e2', qDone: '\u05d1\u05d8\u05d9\u05e4\u05d5\u05dc',
  qTh: '\u05d4\u05e6\u05e2\u05ea \u05de\u05d7\u05d9\u05e8', qAsk: '\u05d1\u05e7\u05e9 \u05d4\u05e6\u05e2\u05ea \u05de\u05d7\u05d9\u05e8', qNoMail: ' (\u05d0\u05d9\u05df \u05de\u05d9\u05d9\u05dc \u05e1\u05e4\u05e7)', qMany: ['\u05de\u05d9\u05d9\u05dc \u05d0\u05d7\u05d3 \u05dc-', ' \u05e4\u05e8\u05d9\u05d8\u05d9\u05dd \u05e9\u05dc \u05d4\u05e1\u05e4\u05e7'], qSent: '\u05e0\u05e9\u05dc\u05d7\u05d4 \u05d1\u05e7\u05e9\u05d4 ', qQuote: '\u05d4\u05ea\u05e7\u05d1\u05dc\u05d4 \u05d4\u05e6\u05e2\u05d4 ', qOrder: '\u05e0\u05e9\u05dc\u05d7\u05d4 \u05d4\u05d6\u05de\u05e0\u05d4 ', qPlanned: '\u05de\u05ea\u05d5\u05db\u05e0\u05df ', qWait: '\u05d0\u05d9\u05df \u05ea\u05e9\u05d5\u05d1\u05d4 ', qSubj: '\u05d1\u05e7\u05e9\u05ea \u05d4\u05e6\u05e2\u05ea \u05de\u05d7\u05d9\u05e8 - \u05ea\u05e2\u05e9\u05d9\u05d5\u05ea \u05ea\u05e4\u05d5\u05d2\u05df',
  qBody: ['\u05e9\u05dc\u05d5\u05dd,', '\u05d0\u05d1\u05e7\u05e9 \u05d4\u05e6\u05e2\u05ea \u05de\u05d7\u05d9\u05e8 \u05dc\u05d1\u05d9\u05e6\u05d5\u05e2 \u05d1\u05d3\u05d9\u05e7\u05d4 \u05ea\u05e7\u05d5\u05e4\u05ea\u05d9\u05ea:', '\u05d0\u05d1\u05e7\u05e9 \u05d4\u05e6\u05e2\u05ea \u05de\u05d7\u05d9\u05e8 \u05dc\u05d1\u05d9\u05e6\u05d5\u05e2 \u05d1\u05d3\u05d9\u05e7\u05d4 \u05ea\u05e7\u05d5\u05e4\u05ea\u05d9\u05ea \u05dc\u05e4\u05e8\u05d9\u05d8\u05d9\u05dd \u05d4\u05d1\u05d0\u05d9\u05dd:'], qSerial: '\u05de\u05e1\u05e4\u05e8 \u05e1\u05d9\u05d3\u05d5\u05e8\u05d9 ', qReport: '\u05d3\u05d5\u05d7 \u05e7\u05d5\u05d3\u05dd ', qLoc: '\u05de\u05d9\u05e7\u05d5\u05dd ', qExp: '\u05ea\u05d5\u05e7\u05e3 \u05e0\u05d5\u05db\u05d7\u05d9 ',
  qEnd: '\u05d0\u05e9\u05de\u05d7 \u05dc\u05e7\u05d1\u05dc \u05d2\u05dd \u05de\u05d5\u05e2\u05d3 \u05d0\u05e4\u05e9\u05e8\u05d9 \u05dc\u05d1\u05d9\u05e6\u05d5\u05e2.', qSign: ['\u05ea\u05d5\u05d3\u05d4,', '\u05de\u05d9\u05db\u05d0\u05dc \u05e4\u05e8\u05d9\u05d9\u05dc\u05d9\u05da', '\u05de\u05de\u05d5\u05e0\u05d4 \u05d1\u05d8\u05d9\u05d7\u05d5\u05ea \u05d5\u05d0\u05d9\u05db\u05d5\u05ea \u05e1\u05d1\u05d9\u05d1\u05d4, \u05ea\u05e2\u05e9\u05d9\u05d5\u05ea \u05ea\u05e4\u05d5\u05d2\u05df'],
  qVendor: '\u05e1\u05e4\u05e7:',
  odNew: '\u05e7\u05d1\u05e6\u05d9\u05dd \u05d7\u05d3\u05e9\u05d9\u05dd \u05d1\u05ea\u05d9\u05e7\u05d9\u05d9\u05ea \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea (7 \u05d9\u05de\u05d9\u05dd)',
  eqf: '\u05e6\u05d9\u05d5\u05d3 \u05dc\u05d0 \u05db\u05e9\u05d9\u05e8, \u05dc\u05d0 \u05dc\u05e9\u05d9\u05de\u05d5\u05e9 \u05e2\u05d3 \u05ea\u05d9\u05e7\u05d5\u05df: ', eqfMore: ' \u05d5\u05e2\u05d5\u05d3 ',
  ag: '\u05d4\u05e1\u05d5\u05db\u05e0\u05d9\u05dd \u05d4\u05d0\u05d5\u05d8\u05d5\u05e0\u05d5\u05de\u05d9\u05d9\u05dd: ', agOk: ' \u05d3\u05d9\u05d5\u05d5\u05d7\u05d5 \u05d4\u05e9\u05d1\u05d5\u05e2', agFail: '\u05e0\u05db\u05e9\u05dc\u05d5: ', agLate: '\u05dc\u05d0 \u05d3\u05d9\u05d5\u05d5\u05d7\u05d5 \u05d1\u05d6\u05de\u05df: ', agNever: '\u05e2\u05d5\u05d3 \u05dc\u05d0 \u05d3\u05d9\u05d5\u05d5\u05d7\u05d5: ',
  nevo: '\u05de\u05e2\u05e7\u05d1 \u05e0\u05d1\u05d5 (\u05de\u05e8\u05e9\u05dd \u05d4\u05d7\u05d5\u05e7\u05d9\u05dd): ', nevoChanged: '\u05d4\u05ea\u05e2\u05d3\u05db\u05e0\u05d5 \u05d1\u05e0\u05d1\u05d5, \u05dc\u05d1\u05d3\u05d5\u05e7 \u05de\u05d4 \u05d4\u05e9\u05ea\u05e0\u05d4: ', nevoNone: '\u05d0\u05d9\u05df \u05e9\u05d9\u05e0\u05d5\u05d9 \u05d1\u05e0\u05d5\u05e1\u05d7, \u05e0\u05d1\u05d3\u05e7 ', nevoNever: '\u05dc\u05d0 \u05e8\u05e5 \u05e2\u05d3\u05d9\u05d9\u05df', nevoStale: '\u05dc\u05d0 \u05e8\u05e5 \u05de\u05d0\u05d6 ', nevoFail: '\u05e0\u05db\u05e9\u05dc \u05d1-', asst: '\u05d4\u05e2\u05d5\u05d6\u05e8 \u05d4\u05e9\u05d1\u05d5\u05e2: ', asstClosed: '\u05d4\u05d7\u05d5\u05e7\u05e8 \u05e1\u05d2\u05e8 ', asstGaps: ' \u05e4\u05e2\u05e8\u05d9\u05dd', asstNone: '\u05d4\u05d7\u05d5\u05e7\u05e8 \u05dc\u05d0 \u05e1\u05d2\u05e8 \u05d0\u05e3 \u05e4\u05e2\u05e8 \u05d1-7 \u05d4\u05d9\u05de\u05d9\u05dd \u05d4\u05d0\u05d7\u05e8\u05d5\u05e0\u05d9\u05dd', asstQs: ' \u05e9\u05d0\u05dc\u05d5\u05ea \u05de\u05d7\u05db\u05d5\u05ea \u05dc\u05da: ', asstNoQs: '\u05d0\u05d9\u05df \u05e9\u05d0\u05dc\u05d5\u05ea \u05e4\u05ea\u05d5\u05d7\u05d5\u05ea', xg: '\u05e4\u05e2\u05e8\u05d9\u05dd \u05d1\u05d9\u05df \u05d4\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4 \u05dc-Excel: ', xgNone: '\u05d0\u05d9\u05df, \u05e0\u05d1\u05d3\u05e7 ', xgNever: '\u05d4\u05d1\u05d3\u05d9\u05e7\u05d4 \u05dc\u05d0 \u05e8\u05e6\u05d4 \u05e2\u05d3\u05d9\u05d9\u05df', xgStale: '\u05d4\u05d1\u05d3\u05d9\u05e7\u05d4 \u05dc\u05d0 \u05e8\u05e6\u05d4 \u05de\u05d0\u05d6 ', xgFail: '\u05d4\u05d1\u05d3\u05d9\u05e7\u05d4 \u05e0\u05db\u05e9\u05dc\u05d4 \u05d1-', xgMore: ' \u05d5\u05e2\u05d5\u05d3 ', xgLabel: { date: '\u05ea\u05d0\u05e8\u05d9\u05da \u05e9\u05d5\u05e0\u05d4', missing: '\u05d0\u05d9\u05df \u05d1\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4', 'task-missing': '\u05de\u05e9\u05d9\u05de\u05d4 \u05e9\u05d0\u05d9\u05df \u05d1\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4', 'task-state': '\u05e1\u05d8\u05d8\u05d5\u05e1 \u05e9\u05d5\u05e0\u05d4', 'task-due': '\u05d9\u05e2\u05d3 \u05e9\u05d5\u05e0\u05d4' }, asstFail: '\u05d4\u05ea\u05d5\u05e8 \u05dc\u05d0 \u05e0\u05e7\u05e8\u05d0 ',
  emptyRegs: '\u05de\u05e8\u05e9\u05de\u05d9 \u05d7\u05d5\u05d1\u05d4 \u05e8\u05d9\u05e7\u05d9\u05dd: ',
  never: '\u05dc\u05d0 \u05d1\u05d5\u05e6\u05e2 \u05d0\u05e3 \u05e4\u05e2\u05dd: ',
  neverWhy: '. \u05d0\u05d9\u05df \u05dc\u05d6\u05d4 \u05de\u05d5\u05e2\u05d3, \u05d5\u05dc\u05db\u05df \u05d6\u05d4 \u05dc\u05d0 \u05de\u05d5\u05e4\u05d9\u05e2 \u05d1\u05d8\u05d1\u05dc\u05ea \u05d4\u05ea\u05e4\u05d5\u05d2\u05d5\u05ea \u05dc\u05de\u05d8\u05d4.',
  emptyWhy: '. \u05d0\u05d9\u05df \u05de\u05d4\u05dd \u05d0\u05e3 \u05d4\u05ea\u05e8\u05d0\u05ea \u05ea\u05e4\u05d5\u05d2\u05d4 \u05e2\u05d3 \u05e9\u05d9\u05d5\u05d6\u05e0\u05d5 \u05d1\u05d4\u05dd \u05e8\u05e9\u05d5\u05de\u05d5\u05ea.',
};
export const T = H;

// The weekly talk each worker reads and signs (03/10/2026, stage 4): one line
// for the latest published talk, red when fewer than 80% signed or when no new
// talk was published for more than 8 days. null = nothing to say (no talk ever,
// or the read failed: a missing line never breaks the mail).
export const TALK_PUB = '\u05e4\u05d5\u05e8\u05e1\u05de\u05d4', TALK_STALE_DAYS = 8, TALK_MIN_SHARE = 0.8;
// The workers' link runs out TALK_LINK_DAYS after link_at (TALK_TTL_DAYS in talk.js,
// weekly-digest-test.mjs keeps the two equal). The mail is weekly, so it warns when the
// link runs out before the next mail, not 3 days ahead: a Sunday mail would miss most of those.
export const TALK_LINK_DAYS = 14, TALK_LINK_WARN = 7;
const ilDay = (iso) => { const t = Date.parse(iso || ''); return isNaN(t) ? '' : new Date(t).toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }); };
// The talk's date, or the day it was saved when the date was left empty.
const talkKey = (t) => String((t && (t.d || String(t.ts || '').substring(0, 10))) || '');
export function latestTalk(talks) {
  return (Array.isArray(talks) ? talks : []).filter((t) => t && t.s === TALK_PUB).sort((a, b) => talkKey(b).localeCompare(talkKey(a)))[0] || null;
}
// emps: the current employee rows, without those who left (emp.left_d, read by talkData),
// so signatures of people who left are not counted against today's list; or just a number.
export function talkLine(talks, reads, emps, today) {
  if (!Array.isArray(talks)) return null;
  const t = latestTalk(talks);
  if (!t) return null;
  const k = talkKey(t);
  const age = k ? Math.round((Date.parse(today + 'T12:00:00Z') - Date.parse(k.substring(0, 10) + 'T12:00:00Z')) / DAY) : 0;
  if (age > TALK_STALE_DAYS) return { red: true, text: '\u05d4\u05d3\u05e8\u05db\u05d4 \u05e9\u05d1\u05d5\u05e2\u05d9\u05ea: \u05dc\u05d0 \u05e4\u05d5\u05e8\u05e1\u05de\u05d4 \u05d4\u05d3\u05e8\u05db\u05d4 \u05d7\u05d3\u05e9\u05d4 \u05de\u05d0\u05d6 ' + fd(k) };
  const ids = Array.isArray(emps) ? new Set(emps.filter((e) => e && e.id != null).map((e) => String(e.id))) : null;
  const empN = ids ? ids.size : (+emps || 0);
  const n = new Set((Array.isArray(reads) ? reads : []).filter((r) => r && r.talk_id === t.id && (!ids || ids.has(String(r.emp_id)))).map((r) => String(r.emp_id))).size;
  // Published this morning: nobody had a chance to sign yet, so not red today.
  const short = empN ? n < Math.ceil(empN * TALK_MIN_SHARE) : n === 0;
  let red = age >= 1 && short;
  let text = '\u05d4\u05d3\u05e8\u05db\u05d4 \u05e9\u05d1\u05d5\u05e2\u05d9\u05ea "' + (t.title || '') + '"' + (k ? ' (' + fd(k) + ')' : '') + ': ' + n + (empN ? ' \u05de\u05ea\u05d5\u05da ' + empN : '') + ' \u05d7\u05ea\u05de\u05d5';
  // Signatures still missing and the link runs out before the next mail (or already did).
  const end = t.link_at ? ilDay(new Date(Date.parse(t.link_at) + TALK_LINK_DAYS * DAY).toISOString()) : '';
  if (short && end) {
    const left = dayDiff(today, end);
    if (left < 0) { red = true; text += '. \u05d4\u05e7\u05d9\u05e9\u05d5\u05e8 \u05dc\u05e2\u05d5\u05d1\u05d3\u05d9\u05dd \u05e4\u05d2 \u05d1-' + fd(end) + '. \u05dc\u05d9\u05e6\u05d5\u05e8 \u05e7\u05d9\u05e9\u05d5\u05e8 \u05d7\u05d3\u05e9 \u05d1\u05d8\u05d1\u05dc\u05ea \u05d4\u05d4\u05d3\u05e8\u05db\u05d5\u05ea'; }
    else if (left <= TALK_LINK_WARN) { red = true; text += '. \u05d4\u05e7\u05d9\u05e9\u05d5\u05e8 \u05dc\u05e2\u05d5\u05d1\u05d3\u05d9\u05dd \u05e4\u05d2 \u05d1-' + fd(end) + (left === 0 ? ' (\u05d4\u05d9\u05d5\u05dd)' : ' (\u05d1\u05e2\u05d5\u05d3 ' + left + ' \u05d9\u05de\u05d9\u05dd)') + '. \u05db\u05d3\u05d0\u05d9 \u05dc\u05e9\u05dc\u05d5\u05d7 \u05e7\u05d9\u05e9\u05d5\u05e8 \u05d7\u05d3\u05e9 \u05dc\u05de\u05d9 \u05e9\u05dc\u05d0 \u05d7\u05ea\u05dd'; }
  } else if (n === 0 && !t.link_at && age >= 1) text += '. \u05e2\u05d5\u05d3 \u05dc\u05d0 \u05e0\u05d5\u05e6\u05e8 \u05e7\u05d9\u05e9\u05d5\u05e8 \u05dc\u05e2\u05d5\u05d1\u05d3\u05d9\u05dd';
  return { red, text };
}
// Only the latest talk's signatures are read (the table grows by ~50 rows a week).
export async function talkData(env) {
  const talks = await readAll(env, 'toolbox_talks?select=id,d,title,s,ts,link_at&s=eq.' + encodeURIComponent(TALK_PUB));
  const t = latestTalk(talks);
  if (!t) return { talks, reads: [], emps: [] };
  const [reads, emps] = await Promise.all([readAll(env, 'toolbox_reads?select=talk_id,emp_id&talk_id=eq.' + encodeURIComponent(t.id)), readAll(env, 'emp?select=id&or=(left_d.is.null,left_d.gt.' + new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }) + ')')]);
  return { talks, reads, emps };
}

function when(x) {
  if (x.days == null) return '';
  if (x.days > 0) return H.overdueBy + x.days + H.days;
  if (x.days === 0) return H.today;
  return H.inDays + (-x.days) + H.days;
}
const cell = 'border:1px solid #ccc;padding:5px;vertical-align:top';
function table(items, opt) {
  if (!items.length) return '<p style="color:#555">' + H.none + '</p>';
  const th = H.th.slice(); if (opt && opt.age) th[6] = '\u05d3\u05d5\u05d5\u05d7';
  return '<table style="border-collapse:collapse;width:100%;margin-bottom:8px"><tr>' + th.map((h) => '<th style="' + cell + ';background:#1f3864;color:#fff">' + esc(h) + '</th>').join('') + '</tr>'
    + items.map((x) => {
      const dueTd = opt && opt.age ? esc(fd(x.dueRep || '')) + (x.age != null ? '<br><span style="color:#555">' + H.openFor + x.age + H.days + '</span>' : '')
        : esc(fd(x.due)) + (x.days > 0 ? '<br><span style="color:#b91c1c;font-weight:bold">' + esc(when(x)) + '</span>' : x.due ? '<br><span style="color:#555">' + esc(when(x)) + '</span>' : '');
      return '<tr style="background:' + (x.days > 0 ? '#fde8e8' : '#fff') + '">' + [x.n, x.dept, x.loc, x.descr, x.sev, x.resp].map((v) => '<td style="' + cell + '">' + esc(v) + '</td>').join('')
        + '<td style="' + cell + ';white-space:nowrap">' + dueTd + '</td><td style="' + cell + '">' + esc(x.status) + '</td></tr>';
    }).join('') + '</table>';
}

// Pure. lists = [[label, nameCols, ownerCols, rows]]; the rows that expired or
// expire within EXP_DAYS, the earliest first. An e that is not YYYY-MM-DD
// (ctr, ppe and med keep e as text) is left out, as du() in the app does.
export function expiringOf(lists, today) {
  const pick = (r, cols) => cols.map((k) => r[k]).find((v) => v != null && String(v).trim() !== '') || '';
  const out = [];
  (lists || []).forEach(([label, nc, oc, rows, t]) => (rows || []).forEach((r) => {
    const e = ymd(r && r.e); if (!e) return;
    const days = dayDiff(today, e); if (days > EXP_DAYS) return;
    const x = { label, name: String(pick(r, nc)), owner: String(pick(r, oc)), e, days };
    if (t) { x.t = t; x.row = r; }
    out.push(x);
  }));
  return out.sort((a, b) => a.days - b.days);
}
// Quote request (08/10/2026, Michael: "\u05d1\u05e6\u05e2: \u05db\u05de\u05d5 \u05d1\u05ea\u05d5\u05db\u05e0\u05d9\u05ea", "\u05d1\u05e6\u05e2: \u05e7\u05d9\u05e9\u05d5\u05e8 + \u05de\u05e2\u05e7\u05d1 \u05d3\u05e8\u05db\u05d9"): next to an
// equipment inspection or a document that expired or expires within EXP_DAYS, a mailto link
// opens a ready request for a price quote in Michael's own mail. The server sends nothing
// (DECISIONS 23/09: routing out = links from the device). One mail per supplier for all its
// items in the list, and no tracking code in it (Michael, 08/10/2026: a code is out of place in
// a mail to someone outside). The server cannot read mail (Mail.Read needs admin consent,
// DECISIONS 27/09), so a weekly Routine (project-files/routine-quotes.md) finds the sent
// requests by their subject, matches each listed item to its row, and writes the stage to
// server_state.quote_track: {key: {stage, sent, quote, order, planned}}.
// Supplier addresses: server_state.vendor_contacts, [[name, email]], matched by name.
// The key holds the expiry, so the next cycle of the same item starts a new request.
export const QUOTE_SRC = { equip_inspections: ['eq', ['vendor', 'serial_number', 'report_number', 'loc']], docs: ['dc', ['nt']] };
export const QUOTE_KEY = 'quote_track', VENDOR_KEY = 'vendor_contacts', QUOTE_WAIT_DAYS = 7, QUOTE_HREF_MAX = 2000, QUOTE_NAME_MAX = 70;
const QSTAGES = ['sent', 'quote', 'order'];
export function quoteKey(t, id, e) {
  const k = QUOTE_SRC[t] && /^[A-Za-z0-9_-]{1,24}$/.test(String(id || '')) && ymd(e) ? 'Q-' + QUOTE_SRC[t][0] + '-' + id + '-' + ymd(e).substring(2).replace(/-/g, '') : '';
  return k;
}
const vnorm = (v) => String(v || '').replace(/[\s"'`.,()\u05f3\u05f4\u2010-\u2015-]/g, '').toLowerCase();
// Pure. The supplier of a row: equipment has a vendor column, a document says "\u05e1\u05e4\u05e7: X." in its note.
export function vendorOf(t, r) {
  if (t === 'equip_inspections') return String((r && r.vendor) || '').trim();
  const m = /\u05e1\u05e4\u05e7:\s*([^.\n]+)/.exec(String((r && r.nt) || ''));
  return m ? m[1].trim() : '';
}
// Pure. contacts = [[name, email]]; the longest name found inside the vendor wins.
export function contactOf(vendor, contacts) {
  const v = vnorm(vendor); let best = null;
  if (!v) return '';
  (contacts || []).forEach((c) => {
    const n = vnorm(c && c[0]);
    if (n.length >= 3 && v.includes(n) && /^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$/i.test(String(c[1] || '')) && (!best || n.length > best[0].length)) best = [n, String(c[1])];
  });
  return best ? best[1] : '';
}
// Pure. The mailto link for one supplier's items: keyboard characters only, no code. Each item on one
// line (name, serial, last report, location, expiry). QUOTE_HREF_MAX keeps it short enough for a phone
// mail app and Outlook on Windows; attachQuotes splits a long group into more mails.
export function quoteMailto(items, email) {
  const lines = [H.qBody[0], items.length > 1 ? H.qBody[2] : H.qBody[1]];
  items.forEach((x, i) => {
    const r = x.row || {}, nm = String(x.name || '').length > QUOTE_NAME_MAX ? String(x.name).substring(0, QUOTE_NAME_MAX - 3).trim() + '...' : String(x.name || '');
    const parts = [];
    if (r.serial_number) parts.push(H.qSerial + r.serial_number);
    if (r.report_number) parts.push(H.qReport + r.report_number);
    if (r.loc) parts.push(H.qLoc + r.loc);
    parts.push(H.qExp + fd(x.e));
    lines.push((items.length > 1 ? (i + 1) + '. ' : '') + nm + ' (' + parts.join(', ') + ')');
  });
  lines.push('', H.qEnd, '');
  const subj = H.qSubj + (items.length === 1 ? ': ' + String(items[0].name || '').substring(0, QUOTE_NAME_MAX) : '');
  return 'mailto:' + (email || '') + '?subject=' + encodeURIComponent(subj) + '&body=' + encodeURIComponent(lines.concat(H.qSign).join('\r\n'));
}
// Pure. Adds x.quote to the rows of QUOTE_SRC tables: {key, email, st, href, n}. st = the tracked stage;
// rows not tracked yet share one mail per supplier (by address, else by name), n = items in it.
export function attachQuotes(list, contacts, track, today) {
  const groups = {}, order = [];
  (list || []).forEach((x) => {
    const key = x.t ? quoteKey(x.t, x.row && x.row.id, x.e) : '';
    if (!key) return;
    const vendor = vendorOf(x.t, x.row);
    // A document with no supplier (a license from an authority) has no one to ask for a quote (08/10/2026).
    if (x.t === 'docs' && !vendor) return;
    const email = contactOf(vendor, contacts);
    const st = track && typeof track === 'object' && track[key] && QSTAGES.indexOf(track[key].stage) >= 0 ? track[key] : null;
    const g = email ? 'm:' + email.toLowerCase() : vnorm(vendor) ? 'v:' + vnorm(vendor) : 'k:' + key;
    x.quote = { key, email, st, today, g, vendor };
    if (st) return;
    if (!groups[g]) { groups[g] = []; order.push(g); }
    groups[g].push(x);
  });
  order.forEach((g) => {
    const items = groups[g], email = items[0].quote.email;
    let chunk = [];
    const close = () => { const href = quoteMailto(chunk, email); chunk.forEach((x) => { x.quote.href = href; x.quote.n = chunk.length; }); chunk = []; };
    items.forEach((x) => {
      if (chunk.length && quoteMailto(chunk.concat([x]), email).length > QUOTE_HREF_MAX) close();
      chunk.push(x);
    });
    if (chunk.length) close();
  });
  return list;
}
function stageText(q) {
  const s = q && q.st;
  if (!s) return '';
  const at = (k) => (ymd(s[k]) ? fd(s[k]) : '');
  let t = s.stage === 'order' ? H.qOrder + at('order') : s.stage === 'quote' ? H.qQuote + at('quote') : H.qSent + at('sent');
  if (ymd(s.planned)) t += ', ' + H.qPlanned + fd(s.planned);
  const wait = s.stage === 'sent' && ymd(s.sent) && q.today ? dayDiff(ymd(s.sent), q.today) : 0;
  let h = esc(t.trim());
  if (wait >= QUOTE_WAIT_DAYS) h += ' <span style="color:#b45309">(' + esc(H.qWait + wait + H.days) + ')</span>';
  return h;
}
// Pure. The rows with a quote, one group per service provider (the same grouping as the mails),
// the provider with the most overdue item first (Michael, 08/10/2026: "a table for each provider").
export function quoteGroups(list) {
  const by = {}, out = [];
  (list || []).forEach((x) => {
    if (!x.quote) return;
    const g = x.quote.g;
    if (!by[g]) { by[g] = { vendor: x.quote.vendor || '', email: x.quote.email || '', items: [], hrefs: [] }; out.push(by[g]); }
    by[g].items.push(x);
    if (x.quote.href && by[g].hrefs.indexOf(x.quote.href) < 0) by[g].hrefs.push(x.quote.href);
  });
  out.forEach((G) => { G.min = Math.min.apply(null, G.items.map((x) => x.days)); });
  return out; // expiringOf sorts by days, so the first group seen holds the most overdue item
}
function quoteBlock(groups) {
  const td = (v) => '<td style="' + cell + ';vertical-align:top">' + v + '</td>';
  return '<table style="border-collapse:collapse;width:100%;margin-bottom:8px"><tr>' + H.qGTh.map((t) => '<th style="' + cell + ';background:#1f3864;color:#fff">' + esc(t) + '</th>').join('') + '</tr>'
    + groups.map((G) => '<tr style="background:' + (G.min < 0 ? '#fde8e8' : '#fff') + '">'
      + td('<b>' + esc(G.vendor || H.qNoVendor) + '</b><br><span style="color:#555">' + esc(G.email || H.qNoMail.trim().replace(/[()]/g, '')) + '</span>')
      + td(G.items.map((x) => esc(x.name) + ' - ' + esc(fd(x.e)) + ' <span style="color:' + (x.days < 0 ? '#b91c1c;font-weight:bold' : '#555') + '">(' + esc(expWhen(x)) + ')</span>' + (x.quote.st ? '<br><span style="color:#166534">' + stageText(x.quote) + '</span>' : '')).join('<br>'))
      + td(G.hrefs.length ? G.hrefs.map((h, i) => '<a href="' + esc(h) + '" style="color:#1d4ed8;font-weight:bold">' + esc(H.qAsk + (G.hrefs.length > 1 ? ' (' + H.qMailN + (i + 1) + ')' : '')) + '</a>').join('<br>') : esc(H.qDone))
      + '</tr>').join('') + '</table>';
}
function expWhen(x) { return x.days < 0 ? H.expired + (-x.days) + H.days : x.days === 0 ? H.today : H.inDays + x.days + H.days; }
function expBlock(list, failed) {
  let h = '';
  if (!list.length) h += '<p style="color:#555">' + H.none + '</p>';
  else {
    h += '<table style="border-collapse:collapse;width:100%;margin-bottom:8px"><tr>' + H.expTh.map((t) => '<th style="' + cell + ';background:#1f3864;color:#fff">' + esc(t) + '</th>').join('') + '</tr>'
      + list.slice(0, EXP_SHOW).map((x) => '<tr style="background:' + (x.days < 0 ? '#fde8e8' : '#fff') + '">' + [x.label, x.name, x.owner].map((v) => '<td style="' + cell + '">' + esc(v) + '</td>').join('')
        + '<td style="' + cell + ';white-space:nowrap">' + esc(fd(x.e)) + '<br><span style="color:' + (x.days < 0 ? '#b91c1c;font-weight:bold' : '#555') + '">' + esc(expWhen(x)) + '</span></td>'
        + '</tr>').join('') + '</table>';
    if (list.length > EXP_SHOW) h += '<p style="color:#555">' + esc(H.more + (list.length - EXP_SHOW)) + '</p>';
  }
  if (failed && failed.length) h += '<p style="color:#b45309">' + esc(H.expFail + failed.join(', ')) + '</p>';
  return h;
}

// Pure. meta = { meeting: YYYY-MM-DD, deckAt: ISO or '', watchOpen: [titles], emptyRegs: [labels], expiring: [expiringOf], expFail: [labels], never: [labels] }.
export function digestHtml(d, today, meta) {
  const m = meta || {};
  const h2 = (t, n) => '<h3 style="margin:14px 0 6px;color:#1f3864">' + esc(t) + (n != null ? ' (' + n + ')' : '') + '</h3>';
  let h = '<div dir="rtl" style="font-family:Arial,sans-serif;font-size:14px">';
  h += '<h2 style="margin:0 0 6px">' + esc(H.title) + ' ' + esc(fd(today)) + '</h2>';
  h += '<p>' + esc(H.total) + d.open + '</p>';
  const er = m.emptyRegs || [];
  if (er.length) h += '<p style="color:#b91c1c;font-weight:bold">' + esc(H.emptyRegs + er.join(', ') + H.emptyWhy) + '</p>';
  const nv = m.never || [];
  if (nv.length) h += '<p style="color:#b91c1c;font-weight:bold">' + esc(H.never + nv.join(', ') + H.neverWhy) + '</p>';
  if (m.eqiFail) h += '<p style="margin:4px 0;color:#b91c1c;font-weight:bold">' + esc(m.eqiFail.text) + '</p>';
  if (m.expiring) h += h2(H.exp, m.expiring.length) + expBlock(m.expiring, m.expFail);
  const qg = quoteGroups(m.expiring);
  if (qg.length) h += h2(H.qGroups, qg.length) + quoteBlock(qg);
  h += h2(H.overdue, d.overdueCount);
  if (!d.overdue.length) h += '<p style="color:#555">' + H.none + '</p>';
  d.overdue.forEach((g) => { h += '<p style="margin:8px 0 4px;font-weight:bold">' + esc(g.resp || '-') + ' (' + g.items.length + ')</p>' + table(g.items); });
  h += h2(H.soon, d.soon.length) + table(d.soon);
  h += h2(H.noDue, d.noDue.length) + table(d.noDue);
  h += h2(H.trustee, d.trustee.length) + table(d.trustee.map((x) => Object.assign({}, x, { dueRep: x.due })), { age: true });
  if (m.talk) h += '<p style="margin:8px 0' + (m.talk.red ? ';color:#b91c1c;font-weight:bold' : '') + '">' + esc(m.talk.text) + '</p>';
  h += h2(H.committee);
  h += '<p style="margin:4px 0">' + esc(H.meeting) + esc(fd(m.meeting)) + '</p>';
  const deckAt = m.deckAt ? Date.parse(m.deckAt) : 0;
  const old = !!deckAt && Date.parse(today + 'T12:00:00Z') - deckAt > 7 * DAY;
  h += '<p style="margin:4px 0' + (!deckAt || old ? ';color:#b91c1c;font-weight:bold' : '') + '">' + (deckAt ? esc(H.deckAt + ilTime(m.deckAt)) + (old ? esc(H.deckOld) : '') : esc(H.deckNever)) + '</p>';
  const w = m.watchOpen || [];
  h += '<p style="margin:4px 0' + (w.length ? ';color:#b91c1c;font-weight:bold' : '') + '">' + esc(H.sync) + (w.length ? esc(w.join('; ')) : H.none) + '</p>';
  if (m.upload) h += '<p style="margin:4px 0' + (m.upload.red ? ';color:#b91c1c;font-weight:bold' : '') + '">' + esc(m.upload.text) + '</p>';
  if (m.agents) h += '<p style="margin:4px 0' + (m.agents.red ? ';color:#b91c1c;font-weight:bold' : '') + '">' + esc(m.agents.text) + '</p>';
  if (m.nevo) h += '<p style="margin:4px 0' + (m.nevo.red ? ';color:#b91c1c;font-weight:bold' : '') + '">' + esc(m.nevo.text) + '</p>';
  if (m.asst) h += '<p style="margin:4px 0' + (m.asst.red ? ';color:#b91c1c;font-weight:bold' : '') + '">' + esc(m.asst.text) + '</p>';
  if (m.xg) h += '<p style="margin:4px 0' + (m.xg.red ? ';color:#b91c1c;font-weight:bold' : '') + '">' + esc(m.xg.text) + '</p>';
  const on = m.odNew || [];
  h += h2(H.odNew, on.length) + (on.length ? '<ul style="margin:0;padding-right:20px">' + on.slice(0, 15).map((f) => '<li>' + esc(f.p) + ' (' + esc(fd(new Date(f.c).toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }))) + ')</li>').join('') + (on.length > 15 ? '<li>' + esc(H.more + (on.length - 15)) + '</li>' : '') + '</ul>' : '<p style="color:#555">' + H.none + '</p>');
  h += '<p style="margin:8px 0 2px;font-weight:bold">' + esc(H.topics) + '</p>';
  h += d.topics.length ? '<ol style="margin:0;padding-right:20px">' + d.topics.map((x) => '<li>' + esc([x.n, x.dept, x.descr].filter(Boolean).join(' - ')) + (x.sev ? ' (' + esc(x.sev) + ')' : '') + (x.days > 0 ? ', <span style="color:#b91c1c">' + esc(when(x)) + '</span>' : '') + '</li>').join('') + '</ol>' : '<p style="color:#555">' + H.none + '</p>';
  h += '<p style="color:#555;font-size:12px;margin-top:16px">' + esc(H.foot) + '<a href="' + APP_URL + '">' + esc(H.app) + '</a></p></div>';
  return h;
}

export function digestSubject(d, today) {
  return 'Tapugan Safety: ' + H.title.split(' - ')[0] + ' ' + fd(today) + ' - ' + d.overdueCount + ' \u05d1\u05d0\u05d9\u05d7\u05d5\u05e8, ' + d.soon.length + ' \u05d9\u05e2\u05d3 \u05e7\u05e8\u05d5\u05d1, ' + d.trustee.length + ' \u05dc\u05d9\u05e7\u05d5\u05d9\u05d9 \u05e0\u05d0\u05de\u05e0\u05d9\u05dd';
}

// One row is enough to know a register is not empty. A read that fails says
// nothing (null), so a passing network error is not reported as an empty register.
export async function emptyRegs(env) {
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const base = (env.SUPABASE_URL || 'https://znhjtpcltrxxyfjczgvw.supabase.co') + '/rest/v1/';
  const res = await Promise.all(REQ_REGS.map(async ([t, label]) => {
    try {
      const r = await fetch(base + t + '?select=*&limit=1', { headers: { apikey: key, Authorization: 'Bearer ' + key } });
      if (!r.ok) return null;
      const j = await r.json();
      return Array.isArray(j) && !j.length ? label : null;
    } catch (e) { return null; }
  }));
  return res.filter(Boolean);
}

// Rows with an expiry up to EXP_DAYS from today, per table. A read that fails
// is named in the mail ("not read"), so a network error never reads as "none".
export async function expiries(env, today) {
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const base = (env.SUPABASE_URL || 'https://znhjtpcltrxxyfjczgvw.supabase.co') + '/rest/v1/';
  const lim = new Date(Date.parse(today + 'T12:00:00Z') + EXP_DAYS * DAY).toISOString().substring(0, 10);
  const failed = [];
  const lists = await Promise.all(EXP_SRC.map(async ([t, label, nc, oc]) => {
    try {
      const sel = Array.from(new Set(['id', 'e'].concat(nc, oc, QUOTE_SRC[t] ? QUOTE_SRC[t][1] : []))).join(',');
      const r = await fetch(base + t + '?select=' + sel + '&e=lte.' + lim + '&order=e.asc&limit=500', { headers: { apikey: key, Authorization: 'Bearer ' + key } });
      if (!r.ok) { failed.push(label); return [label, nc, oc, []]; }
      const j = await r.json();
      return [label, nc, oc, Array.isArray(j) ? j : [], QUOTE_SRC[t] ? t : undefined];
    } catch (e) { failed.push(label); return [label, nc, oc, []]; }
  }));
  const sets = {};
  await Promise.all(REC_SRC.map(async ([label, t, sel]) => {
    try {
      const r = await fetch(base + t + '?select=' + sel + '&limit=1000', { headers: { apikey: key, Authorization: 'Bearer ' + key } });
      if (!r.ok) throw new Error(r.status);
      sets[t] = await r.json();
    } catch (e) { failed.push(label); }
  }));
  let eqf = null;
  try {
    const r = await fetch(base + 'equip_inspections?select=id,n,code,s,d,deficiencies&limit=1000', { headers: { apikey: key, Authorization: 'Bearer ' + key } });
    if (r.ok) eqf = eqiFailLine(await r.json());
  } catch (e) { eqf = null; }
  const qs = await stateGet(env, [QUOTE_KEY, VENDOR_KEY]).catch(() => ({}));
  const pj = (k, d) => { try { return JSON.parse((qs[k] && qs[k].value) || 'null') || d; } catch (e) { return d; } };
  const expiring = attachQuotes(expiringOf(lists.concat(recurringOf(sets)), today), pj(VENDOR_KEY, []), pj(QUOTE_KEY, {}), today);
  return { expiring, expFail: failed, never: neverOf(sets), eqiFail: eqf };
}

// BACKLOG 12.1 (09/10/2026): a failed inspection, as _eqiFail in index.html. Its expiry can be a
// year away, so the expiry table never showed it: equipment marked "fix" stayed silent. Pure.
export const EQI_FAIL = /^(\u05dc\u05d0 \u05ea\u05e7\u05d9\u05df|\u05dc\u05d0 \u05db\u05e9\u05d9\u05e8|\u05dc\u05ea\u05e7\u05df|\u05d0\u05e1\u05d5\u05e8|\u05e4\u05e1\u05d5\u05dc)/;
export function eqiFailLine(rows) {
  const f = (rows || []).filter((r) => r && EQI_FAIL.test(String(r.s || '')));
  if (!f.length) return null;
  const one = (r) => String(r.n || r.code || r.id) + (r.deficiencies ? ' (' + String(r.deficiencies).substring(0, 60) + ')' : '') + (r.d ? ', ' + fd(ymd(r.d)) : '');
  return { text: H.eqf + f.slice(0, 6).map(one).join('; ') + (f.length > 6 ? H.eqfMore + (f.length - 6) : ''), red: true, n: f.length };
}

// The daily OneDrive backup (backup-od.js, 01/10/2026): a line among the sync
// problems when the last run failed or there was none for two days.
export function backupProblem(raw, nowMs) {
  let r = null; try { r = JSON.parse(raw || 'null'); } catch (e) { r = null; }
  const t = '\u05d2\u05d9\u05d1\u05d5\u05d9 \u05dc-OneDrive: ';
  if (!r || !r.at) return t + '\u05dc\u05d0 \u05e8\u05e5 \u05e2\u05d3\u05d9\u05d9\u05df';
  if (nowMs - Date.parse(r.at) > 48 * 3600 * 1000) return t + '\u05dc\u05d0 \u05e8\u05e5 \u05de\u05d0\u05d6 ' + ilTime(r.at);
  if (!r.ok) return t + '\u05e0\u05db\u05e9\u05dc \u05d1-' + ilTime(r.at) + ' (' + String((r.errors || []).join('; ')).substring(0, 120) + ')';
  return null;
}

// 04/10/2026 (Michael, "approve all"): /api/od-scan writes server_state.od_scan every
// night: the files added to the safety folder. A scan that failed or stopped running is
// named with the sync problems; the files of the last 7 days get their own block. Pure.
export function odScanProblem(raw, nowMs) {
  let r = null; try { r = JSON.parse(raw || 'null'); } catch (e) { r = null; }
  const t = '\u05e1\u05e8\u05d9\u05e7\u05ea \u05ea\u05d9\u05e7\u05d9\u05d9\u05ea \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea: ';
  if (!r || !r.at) return t + '\u05dc\u05d0 \u05e8\u05e6\u05d4 \u05e2\u05d3\u05d9\u05d9\u05df';
  if (nowMs - Date.parse(r.at) > 3 * DAY) return t + '\u05dc\u05d0 \u05e8\u05e6\u05d4 \u05de\u05d0\u05d6 ' + ilTime(r.at);
  if (!r.ok) return t + '\u05e0\u05db\u05e9\u05dc\u05d4 \u05d1-' + ilTime(r.at) + ' (' + String(r.error || '').substring(0, 120) + ')';
  return null;
}
export function odScanFiles(raw, nowMs) {
  let r = null; try { r = JSON.parse(raw || 'null'); } catch (e) { r = null; }
  return ((r && r.files) || []).filter((f) => f && f.c && nowMs - Date.parse(f.c) <= 7 * DAY);
}

// 04/10/2026 (Michael, "approve both"): the task on Michael's computer uploads each new
// account skill and writes a line to UPLOAD_LOG. Its line format is not known yet, so this
// reads it loosely: the last non-empty line as is, its date from the first DD/MM/YYYY
// or YYYY-MM-DD in it, else the file's last change. Red with no line in 8 days, a failure
// word in the last line, or no file. Pure.
export const UPLOAD_STALE_DAYS = 8;
// 07/10/2026 (Michael chose it after the task stopped at 06/10 10:20 unnoticed for a day): a
// zip or .skill still in the folder's top (the task moves what it handled to "הועלו") while the
// last log line is over 24 hours old = the task on the computer is not running.
export const UPLOAD_STUCK_MS = 24 * 3600e3;
export function logText(bytes) {
  const b = bytes || new Uint8Array(0);
  if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder('utf-16le').decode(b.subarray(2));
  return new TextDecoder('utf-8').decode(b).replace(/^\ufeff/, '');
}
export function uploadLine(log, nowMs) {
  const t = '\u05d4\u05e2\u05dc\u05d0\u05ea \u05d4\u05e2\u05d5\u05d6\u05e8 \u05dc\u05d7\u05e9\u05d1\u05d5\u05df: ';
  if (!log || log.missing) return { red: true, text: t + '\u05d0\u05d9\u05df \u05d9\u05d5\u05de\u05df \u05d4\u05e2\u05dc\u05d0\u05d5\u05ea (\u05d4\u05de\u05e9\u05d9\u05de\u05d4 \u05d1\u05de\u05d7\u05e9\u05d1 \u05dc\u05d0 \u05e8\u05e6\u05d4 \u05e2\u05d3\u05d9\u05d9\u05df)' };
  if (log.error) return { red: true, text: t + '\u05d4\u05d9\u05d5\u05de\u05df \u05dc\u05d0 \u05e0\u05e7\u05e8\u05d0' + ' (' + String(log.error).substring(0, 80) + ')' };
  const lines = String(log.text || '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  const last = lines[lines.length - 1];
  if (!last) return { red: true, text: t + '\u05d4\u05d9\u05d5\u05de\u05df \u05e8\u05d9\u05e7' };
  let at = null, m;
  // The first date: the line's own time. A later one is the skill's version (verified on the real
  // log 04/10/2026: "04/10/2026 15:32 | michael-assistant | ... \u05d2\u05e8\u05e1\u05d4: 04/10/2026 (6) ...").
  if ((m = /(\d{4})-(\d{2})-(\d{2})|(\d{1,2})[/.](\d{1,2})[/.](\d{4})/.exec(last))) at = m[1] ? m[1] + '-' + m[2] + '-' + m[3] : m[6] + '-' + m[5].padStart(2, '0') + '-' + m[4].padStart(2, '0');
  if (!at && log.mod) at = new Date(log.mod).toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
  const today = new Date(nowMs).toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
  const age = at ? Math.round((Date.parse(today + 'T12:00:00Z') - Date.parse(at + 'T12:00:00Z')) / DAY) : null;
  const failed = /\u05e0\u05db\u05e9\u05dc|\u05e9\u05d2\u05d9\u05d0|fail|error/i.test(last);
  const pending = (log.pending || []).filter(Boolean);
  if (at && pending.length) {
    // The line's own time (HH:MM after its date), Israel time taken as UTC+3: an hour off at
    // most in winter, nothing against a 24-hour limit.
    const hm = /\b(\d{1,2}):(\d{2})\b/.exec(last.substring(m ? m.index + m[0].length : 0));
    const lastMs = Date.parse(at + 'T' + (hm ? hm[1].padStart(2, '0') + ':' + hm[2] : '12:00') + ':00Z') - 3 * 3600e3;
    if (nowMs - lastMs > UPLOAD_STUCK_MS) {
      const names = pending.join(', ');
      return { red: true, stuck: true, text: t + '\u05de\u05e9\u05d9\u05de\u05ea \u05d4\u05d4\u05e2\u05dc\u05d0\u05d4 \u05dc\u05d0 \u05e8\u05e6\u05d4 \u05de\u05d0\u05d6 ' + fd(at) + (hm ? ' ' + hm[1] + ':' + hm[2] : '') + ', ' + pending.length + ' \u05de\u05de\u05ea\u05d9\u05e0\u05d9\u05dd \u05d1\u05ea\u05d9\u05e7\u05d9\u05d9\u05d4: ' + (names.length > 120 ? names.substring(0, 117) + '...' : names) };
    }
  }
  const stale = age == null || age > UPLOAD_STALE_DAYS;
  return { red: failed || stale, text: t + (at ? '\u05e9\u05d5\u05e8\u05d4 \u05d0\u05d7\u05e8\u05d5\u05e0\u05d4 \u05de-' + fd(at) + ': ' : '') + last.substring(0, 160) + (stale && age != null ? ' (\u05d0\u05d9\u05df \u05e9\u05d5\u05e8\u05d4 \u05d7\u05d3\u05e9\u05d4 ' + age + ' \u05d9\u05de\u05d9\u05dd)' : '') };
}
export async function uploadLog(env) {
  try {
    const { token } = await accessToken(env);
    const seg = UPLOAD_LOG.split('/').map(encodeURIComponent).join('/');
    const base = 'https://graph.microsoft.com/v1.0/me/drive/root:/' + seg;
    const r = await fetch(base + '?$select=lastModifiedDateTime', { headers: { Authorization: 'Bearer ' + token } });
    if (r.status === 404) return { missing: true };
    if (!r.ok) return { error: 'onedrive ' + r.status };
    const mod = (await r.json()).lastModifiedDateTime || null;
    const c = await fetch(base + ':/content', { headers: { Authorization: 'Bearer ' + token } });
    if (!c.ok) return { error: 'onedrive ' + c.status };
    const text = logText(new Uint8Array(await c.arrayBuffer()));
    // What waits in the folder's top (read only). A failed listing just leaves the check out.
    let pending = [];
    try {
      const dir = UPLOAD_LOG.split('/').slice(0, -1).map(encodeURIComponent).join('/');
      const k = await fetch('https://graph.microsoft.com/v1.0/me/drive/root:/' + dir + ':/children?$select=name,file&$top=200', { headers: { Authorization: 'Bearer ' + token } });
      if (k.ok) pending = ((await k.json()).value || []).filter((x) => x && x.file && /\.(zip|skill)$/i.test(x.name || '')).map((x) => x.name);
    } catch (e) { pending = []; }
    return { mod, text, pending };
  } catch (e) {
    return { error: String((e && e.message) || e).substring(0, 80) };
  }
}

// 03/10/2026 (Michael, option 1): private.db_columns_check() compares the DB columns with the
// approved snapshot on the 1st of each month and writes db_columns_drift. A column with no
// match is a field the app may be losing silently (PGRST204 self-heal). Pure.
export function schemaProblem(raw) {
  let r = null; try { r = JSON.parse(raw || 'null'); } catch (e) { r = null; }
  if (!r) return null;
  const a = r.added || [], d = r.removed || [];
  if (!a.length && !d.length) return null;
  const list = (x) => x.slice(0, 6).join(', ') + (x.length > 6 ? ' +' + (x.length - 6) : '');
  const parts = [];
  if (a.length) parts.push('\u05e0\u05d5\u05e1\u05e4\u05d5 ' + a.length + ' (' + list(a) + ')');
  if (d.length) parts.push('\u05e0\u05de\u05d7\u05e7\u05d5 ' + d.length + ' (' + list(d) + ')');
  return '\u05e9\u05d9\u05e0\u05d5\u05d9 \u05d1\u05de\u05d1\u05e0\u05d4 \u05d4\u05de\u05e1\u05d3: ' + parts.join(', ') + '. \u05dc\u05d1\u05d3\u05d5\u05e7 \u05e2\u05dd Claude \u05d5\u05dc\u05d0\u05e9\u05e8';
}

// 07/10/2026 (Michael, "בצע: server_state"): once a month a Routine reads, for every law in
// leg with a Nevo link, the "נוסח עדכני נכון ליום" date, and writes server_state.nevo_versions:
// { at, ok, error, v: {leg id: YYYY-MM-DD}, changed: [{id, s, old, new}] }. leg.last_review is
// Michael's compliance round and is not touched. A changed version is red until the next run;
// a run older than NEVO_STALE_DAYS is red too (the Routine stopped). Pure.
export const NEVO_STALE_DAYS = 40;
export function nevoLine(raw, nowMs) {
  let r = null; try { r = JSON.parse(raw || 'null'); } catch (e) { r = null; }
  if (!r || !r.at) return { text: H.nevo + H.nevoNever, red: false };
  if (nowMs - Date.parse(r.at) > NEVO_STALE_DAYS * DAY) return { text: H.nevo + H.nevoStale + ilTime(r.at), red: true };
  if (!r.ok) return { text: H.nevo + H.nevoFail + ilTime(r.at) + ' (' + String(r.error || '').substring(0, 120) + ')', red: true };
  const ch = (r.changed || []).filter((x) => x && (x.s || x.id));
  if (ch.length) return { text: H.nevo + H.nevoChanged + ch.slice(0, 8).map((x) => (x.s || x.id) + (x.new ? ' (' + fd(x.new) + ')' : '')).join('; ') + (ch.length > 8 ? ' +' + (ch.length - 8) : ''), red: true };
  return { text: H.nevo + H.nevoNone + fd(String(r.at).substring(0, 10)), red: false };
}

// 09/10/2026 (review of the agents): every Routine ends with agent_report to /api/routine-db,
// which appends {agent, at, ok, line, learned} to server_state.agent_log. A failed run, or an
// agent silent longer than its period after it already reported once, is red: before this a
// run's last message stayed in a persistent session that nobody opens. Never reported = listed,
// not red (the monthly ones first run on 01/11). Pure.
export const AGENT_PERIODS = { 'routine-researcher': 4, retro: 4, 'routine-quotes': 8, 'routine-radar-learn': 8, 'routine-compliance': 35, 'routine-od-scan': 35, 'routine-nevo-versions': 35, 'routine-factory-trends': 35 };
export function agentsLine(raw, nowMs) {
  let log = []; try { log = JSON.parse(raw || '[]'); } catch (e) { log = []; }
  if (!Array.isArray(log)) log = [];
  const last = {}, fails = [];
  for (const e of log) {
    if (!e || !e.agent || !e.at) continue;
    const t = Date.parse(e.at);
    if (!last[e.agent] || t > last[e.agent]) last[e.agent] = t;
    if (e.ok !== true && nowMs - t <= 8 * DAY) fails.push(e.agent + (e.line ? ' (' + String(e.line).substring(0, 80) + ')' : ''));
  }
  const week = Object.keys(last).filter((a) => nowMs - last[a] <= 7 * DAY).length;
  const late = Object.keys(AGENT_PERIODS).filter((a) => last[a] && nowMs - last[a] > AGENT_PERIODS[a] * DAY);
  const never = Object.keys(AGENT_PERIODS).filter((a) => !last[a]);
  const parts = [week + H.agOk];
  if (fails.length) parts.push(H.agFail + fails.slice(0, 5).join('; '));
  if (late.length) parts.push(H.agLate + late.join(', '));
  if (never.length) parts.push(H.agNever + never.join(', '));
  return { text: H.ag + parts.join('. '), red: !!(fails.length || late.length) };
}

// 08/10/2026 (Michael, "בצע: מפתח קריאה ל-GitHub"): the researcher Routine closes one gap a
// weekday in michael-skills (private), research-queue.md: "## נסגר" lines start "- DD/MM/YYYY,",
// "## שאלות למיכאל" lines start "- ". The digest reads the file with a read-only token
// (env.GH_SKILLS_TOKEN); no token = no line. Nothing closed in 7 days = red (the Routine stopped).
export const ASST_QUEUE = 'https://api.github.com/repos/mishaf1988-lgtm/michael-skills/contents/plugins/michael/skills/michael-assistant/references/research-queue.md';
function mdSection(md, title) {
  const out = []; let on = false;
  for (const ln of String(md || '').split(/\r?\n/)) {
    if (/^##\s/.test(ln)) { on = ln.replace(/^##\s+/, '').trim().indexOf(title) === 0; continue; }
    if (on && /^-\s+\S/.test(ln)) out.push(ln.replace(/^-\s+/, '').trim());
  }
  return out;
}
export function assistantLine(q, nowMs) {
  if (!q) return null;
  if (q.error) return { text: H.asst + H.asstFail + '(' + String(q.error).substring(0, 80) + ')', red: true };
  const from = nowMs - 7 * DAY;
  const closed = mdSection(q.text, '\u05e0\u05e1\u05d2\u05e8').filter((x) => {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(x);
    return m && Date.UTC(+m[3], +m[2] - 1, +m[1]) + DAY > from;
  });
  const qs = mdSection(q.text, '\u05e9\u05d0\u05dc\u05d5\u05ea');
  const cut = (t) => (t.length > 90 ? t.substring(0, 87) + '...' : t);
  const parts = [closed.length ? H.asstClosed + closed.length + H.asstGaps : H.asstNone];
  parts.push(qs.length ? qs.length + H.asstQs + cut(qs[0]) : H.asstNoQs);
  return { text: H.asst + parts.join(', '), red: !closed.length };
}
export async function assistantQueue(env) {
  if (!env.GH_SKILLS_TOKEN) return null;
  try {
    const r = await fetch(ASST_QUEUE, { headers: { Authorization: 'Bearer ' + env.GH_SKILLS_TOKEN, Accept: 'application/vnd.github.raw', 'User-Agent': 'tapugan-safety-digest' } });
    if (!r.ok) return { error: 'HTTP ' + r.status };
    return { text: await r.text() };
  } catch (e) { return { error: String((e && e.message) || e) }; }
}

// 08/10/2026 (Michael, "בצע: כמו בתוכנית", "שורה במייל השבועי"): /api/xlsx-gaps compares the
// Excel control board with the app every night and writes server_state.xlsx_gaps
// { at, ok, error, gaps: [{k, n, app, xl}] }. Any gap is red (the app is the source of truth);
// a run older than XG_STALE_DAYS or a failed run is red too. Pure.
export const XG_STALE_DAYS = 3;
export function xlsxGapsLine(raw, nowMs) {
  let r = null; try { r = JSON.parse(raw || 'null'); } catch (e) { r = null; }
  if (!r || !r.at) return { text: H.xg + H.xgNever, red: false };
  if (nowMs - Date.parse(r.at) > XG_STALE_DAYS * DAY) return { text: H.xg + H.xgStale + ilTime(r.at), red: true };
  if (!r.ok) return { text: H.xg + H.xgFail + ilTime(r.at) + ' (' + String(r.error || '').substring(0, 120) + ')', red: true };
  const g = (r.gaps || []).filter((x) => x && x.n);
  if (!g.length) return { text: H.xg + H.xgNone + fd(String(r.at).substring(0, 10)), red: false };
  const one = (x) => String(x.n).substring(0, 60) + ' (' + (H.xgLabel[x.k] || x.k) + (x.app || x.xl ? ': ' + (fd(x.app || '') || x.app || '-') + ' / ' + (fd(x.xl || '') || x.xl || '-') : '') + ')';
  return { text: H.xg + g.length + ': ' + g.slice(0, 5).map(one).join('; ') + (g.length > 5 ? H.xgMore + (g.length - 5) : ''), red: true };
}

async function build(env) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
  const [hazards, reports, tasks, st, empty, exp, tk, ul, aq] = await Promise.all([
    readAll(env, 'tour_hazards?select=id,n,d,tour_no,dept,loc,descr,sev,resp,resp2,action,due,s,closed_d,notes&order=n.asc'),
    readAll(env, 'trustee_reports?select=id,num,u,t,d,loc,ok,f,s,ref,mgr_note,action,closed_d,ts&order=ts.asc'),
    readAll(env, TASKS_Q),
    stateGet(env, ['deck_at', 'deck_meeting_date', WATCH_KEY, STATE_KEY, 'backup_od', 'db_columns_drift', 'od_scan', 'nevo_versions', 'xlsx_gaps', 'agent_log']).catch(() => ({})),
    emptyRegs(env),
    expiries(env, today),
    talkData(env).catch(() => null),
    odConfigured(env) ? uploadLog(env) : Promise.resolve({ error: 'not configured' }),
    assistantQueue(env),
  ]);
  const v = (k) => (st[k] && st[k].value) || '';
  let watch = null; try { watch = JSON.parse(v(WATCH_KEY) || 'null'); } catch (e) { watch = null; }
  const watchOpen = Object.keys((watch && watch.open) || {}).map((k) => watch.open[k].title).filter(Boolean);
  const bk = backupProblem(v('backup_od'), Date.now());
  if (bk) watchOpen.push(bk);
  const sc = schemaProblem(v('db_columns_drift'));
  if (sc) watchOpen.push(sc);
  const os = odScanProblem(v('od_scan'), Date.now());
  if (os) watchOpen.push(os);
  const d = digestOf(buildRegister(hazards, reports, tasks).rows, today);
  const meta = { meeting: meetingDate(today, v('deck_meeting_date')), deckAt: v('deck_at'), watchOpen, emptyRegs: empty, expiring: exp.expiring, expFail: exp.expFail, never: exp.never, eqiFail: exp.eqiFail, talk: tk ? talkLine(tk.talks, tk.reads, tk.emps, today) : null, odNew: odScanFiles(v('od_scan'), Date.now()), upload: uploadLine(ul, Date.now()), nevo: nevoLine(v('nevo_versions'), Date.now()), agents: agentsLine(v('agent_log'), Date.now()), asst: assistantLine(aq, Date.now()), xg: xlsxGapsLine(v('xlsx_gaps'), Date.now()) };
  let last = null; try { last = JSON.parse(v(STATE_KEY) || 'null'); } catch (e) { last = null; }
  return { today, d, meta, last, html: digestHtml(d, today, meta), subject: digestSubject(d, today) };
}

export async function onRequest(context) {
  const { request, env } = context;
  const cors = corsHeaders(request.headers.get('Origin') || '', defaultAllowedOrigins(env), 'POST,OPTIONS');
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return jsonResp({ error: 'method not allowed' }, 405, cors);
  const secret = env.TRUSTEE_NOTIFY_SECRET;
  const bySecret = !!secret && (request.headers.get('x-notify-secret') || '') === secret;
  if (!bySecret) {
    const who = await requireRole(request, env, ['admin', 'manager']);
    if (!who.ok) return jsonResp({ error: who.error }, who.status, cors);
  }
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return jsonResp({ error: 'server misconfigured' }, 500, cors);
  let body = {}; try { body = await request.json(); } catch (e) {}
  const op = bySecret ? 'send' : body.op === 'send' ? 'send' : 'preview';
  try {
    const b = await build(env);
    const counts = { open: b.d.open, overdue: b.d.overdueCount, soon: b.d.soon.length, noDue: b.d.noDue.length, trustee: b.d.trustee.length, emptyRegs: b.meta.emptyRegs.length, never: (b.meta.never || []).length, expiring: b.meta.expiring.length, expired: b.meta.expiring.filter((x) => x.days < 0).length };
    if (op !== 'send') return jsonResp({ ok: true, today: b.today, counts, digest: b.d, meta: b.meta, subject: b.subject, html: b.html, last: b.last }, 200, cors);
    const lastAt = b.last && b.last.ok && b.last.at ? Date.parse(b.last.at) : 0;
    if (lastAt && Date.now() - lastAt < REPEAT_MS && body.force !== true) return jsonResp({ ok: true, skipped: 'sent ' + b.last.at, counts }, 200, cors);
    const rec = { at: new Date().toISOString(), ok: false, to: null, counts, error: '' };
    const fail = async (why) => { rec.error = why; await stateSet(env, { [STATE_KEY]: JSON.stringify(rec) }).catch(() => {}); return jsonResp({ ok: false, error: why, counts }, 200, cors); };
    if (!odConfigured(env)) return fail('server not configured');
    const row = await tokenRow(env);
    if (!row || !row.refresh_token) return fail('not connected');
    if (!hasMail(row)) return fail('no Mail.Send');
    const { token, email } = await accessToken(env);
    const to = email || row.user_email;
    if (!to) return fail('no address');
    try { await sendMail(token, to, b.subject, b.html); } catch (e) { return fail(String((e && e.message) || e).substring(0, 200)); }
    rec.ok = true; rec.to = to;
    await stateSet(env, { [STATE_KEY]: JSON.stringify(rec) }).catch(() => {});
    return jsonResp({ ok: true, sent: true, to, counts }, 200, cors);
  } catch (e) {
    return jsonResp({ ok: false, error: String((e && e.message) || e).substring(0, 200) }, 200, cors);
  }
}
