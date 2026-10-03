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
export const REC_SRC = [
  ['\u05ea\u05e8\u05d2\u05d9\u05dc \u05d7\u05d9\u05e8\u05d5\u05dd', 'drl', 'id,ty,d', (rows) => lastBy(rows, 'ty')],
  ['\u05d1\u05d9\u05e7\u05d5\u05e8\u05ea \u05e4\u05e0\u05d9\u05dd', 'auds', 'id,r,d,s', (rows) => lastBy(rows, 'r', (r) => r.s !== '\u05de\u05ea\u05d5\u05db\u05e0\u05df')],
  ['\u05e1\u05e7\u05d9\u05e8\u05ea \u05d4\u05e0\u05d4\u05dc\u05d4', 'mgmt_reviews', 'id,ts', (rows) => { const d = (rows || []).map((r) => ymd(String(r.ts || '').substring(0, 10))).filter(Boolean).sort().pop(); return d ? [{ name: '\u05e1\u05e7\u05d9\u05e8\u05ea \u05d4\u05e0\u05d4\u05dc\u05d4', owner: '\u05d0\u05d7\u05e8\u05d5\u05e0\u05d4: ' + fd(d), e: plusMonths(d, FREQ_M) }] : []; }, true],
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
// The talk's date, or the day it was saved when the date was left empty.
const talkKey = (t) => String((t && (t.d || String(t.ts || '').substring(0, 10))) || '');
export function latestTalk(talks) {
  return (Array.isArray(talks) ? talks : []).filter((t) => t && t.s === TALK_PUB).sort((a, b) => talkKey(b).localeCompare(talkKey(a)))[0] || null;
}
// emps: the current employee rows (signatures of people who left are not
// counted against today's list), or just a number.
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
  const red = age >= 1 && (empN ? n < Math.ceil(empN * TALK_MIN_SHARE) : n === 0);
  return { red, text: '\u05d4\u05d3\u05e8\u05db\u05d4 \u05e9\u05d1\u05d5\u05e2\u05d9\u05ea "' + (t.title || '') + '"' + (k ? ' (' + fd(k) + ')' : '') + ': ' + n + (empN ? ' \u05de\u05ea\u05d5\u05da ' + empN : '') + ' \u05d7\u05ea\u05de\u05d5' };
}
// Only the latest talk's signatures are read (the table grows by ~50 rows a week).
export async function talkData(env) {
  const talks = await readAll(env, 'toolbox_talks?select=id,d,title,s,ts&s=eq.' + encodeURIComponent(TALK_PUB));
  const t = latestTalk(talks);
  if (!t) return { talks, reads: [], emps: [] };
  const [reads, emps] = await Promise.all([readAll(env, 'toolbox_reads?select=talk_id,emp_id&talk_id=eq.' + encodeURIComponent(t.id)), readAll(env, 'emp?select=id')]);
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
  (lists || []).forEach(([label, nc, oc, rows]) => (rows || []).forEach((r) => {
    const e = ymd(r && r.e); if (!e) return;
    const days = dayDiff(today, e); if (days > EXP_DAYS) return;
    out.push({ label, name: String(pick(r, nc)), owner: String(pick(r, oc)), e, days });
  }));
  return out.sort((a, b) => a.days - b.days);
}
function expWhen(x) { return x.days < 0 ? H.expired + (-x.days) + H.days : x.days === 0 ? H.today : H.inDays + x.days + H.days; }
function expBlock(list, failed) {
  let h = '';
  if (!list.length) h += '<p style="color:#555">' + H.none + '</p>';
  else {
    h += '<table style="border-collapse:collapse;width:100%;margin-bottom:8px"><tr>' + H.expTh.map((t) => '<th style="' + cell + ';background:#1f3864;color:#fff">' + esc(t) + '</th>').join('') + '</tr>'
      + list.slice(0, EXP_SHOW).map((x) => '<tr style="background:' + (x.days < 0 ? '#fde8e8' : '#fff') + '">' + [x.label, x.name, x.owner].map((v) => '<td style="' + cell + '">' + esc(v) + '</td>').join('')
        + '<td style="' + cell + ';white-space:nowrap">' + esc(fd(x.e)) + '<br><span style="color:' + (x.days < 0 ? '#b91c1c;font-weight:bold' : '#555') + '">' + esc(expWhen(x)) + '</span></td></tr>').join('') + '</table>';
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
  if (m.expiring) h += h2(H.exp, m.expiring.length) + expBlock(m.expiring, m.expFail);
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
      const sel = ['id', 'e'].concat(nc, oc).join(',');
      const r = await fetch(base + t + '?select=' + sel + '&e=lte.' + lim + '&order=e.asc&limit=500', { headers: { apikey: key, Authorization: 'Bearer ' + key } });
      if (!r.ok) { failed.push(label); return [label, nc, oc, []]; }
      const j = await r.json();
      return [label, nc, oc, Array.isArray(j) ? j : []];
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
  return { expiring: expiringOf(lists.concat(recurringOf(sets)), today), expFail: failed, never: neverOf(sets) };
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

async function build(env) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
  const [hazards, reports, tasks, st, empty, exp, tk] = await Promise.all([
    readAll(env, 'tour_hazards?select=id,n,d,tour_no,dept,loc,descr,sev,resp,resp2,action,due,s,closed_d,notes&order=n.asc'),
    readAll(env, 'trustee_reports?select=id,num,u,t,d,loc,ok,f,s,ref,mgr_note,action,closed_d,ts&order=ts.asc'),
    readAll(env, TASKS_Q),
    stateGet(env, ['deck_at', 'deck_meeting_date', WATCH_KEY, STATE_KEY, 'backup_od', 'db_columns_drift']).catch(() => ({})),
    emptyRegs(env),
    expiries(env, today),
    talkData(env).catch(() => null),
  ]);
  const v = (k) => (st[k] && st[k].value) || '';
  let watch = null; try { watch = JSON.parse(v(WATCH_KEY) || 'null'); } catch (e) { watch = null; }
  const watchOpen = Object.keys((watch && watch.open) || {}).map((k) => watch.open[k].title).filter(Boolean);
  const bk = backupProblem(v('backup_od'), Date.now());
  if (bk) watchOpen.push(bk);
  const sc = schemaProblem(v('db_columns_drift'));
  if (sc) watchOpen.push(sc);
  const d = digestOf(buildRegister(hazards, reports, tasks).rows, today);
  const meta = { meeting: meetingDate(today, v('deck_meeting_date')), deckAt: v('deck_at'), watchOpen, emptyRegs: empty, expiring: exp.expiring, expFail: exp.expFail, never: exp.never, talk: tk ? talkLine(tk.talks, tk.reads, tk.emps, today) : null };
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
