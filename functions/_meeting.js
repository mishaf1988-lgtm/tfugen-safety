// The safety-committee meeting data (stage 5, 28/09), computed instead of
// copied by hand into the slides. Pure functions, shared by the endpoint.
//
// Hazards (slide 1), 1:1 with the workbook sheet "\u05e1\u05d9\u05db\u05d5\u05dd \u05e9\u05d1\u05d5\u05e2\u05d9 \u05dc\u05de\u05e6\u05d2\u05ea" and
// "\u05d3\u05d5\u05d7 \u05de\u05e8\u05db\u05d6" (DECISIONS 2026-09-27/28), over the merged register (manager +
// trustees, the same rows the file has):
//   * the week = the calendar week Sunday..Saturday BEFORE the meeting date
//     (22.09 -> 13.09-19.09), the month = the calendar month of the meeting;
//   * per department: \u05e1\u05d2\u05d5\u05e8\u05d9\u05dd (status \u05e1\u05d2\u05d5\u05e8), \u05e4\u05ea\u05d5\u05d7\u05d9\u05dd \u05db\u05e2\u05ea (anything else), \u05d7\u05d3\u05e9\u05d9\u05dd
//     \u05d1\u05e9\u05d1\u05d5\u05e2 (tour date in the week), \u05e0\u05e1\u05d2\u05e8\u05d5 \u05d1\u05e9\u05d1\u05d5\u05e2 (closing date in the week),
//     \u05e1\u05da \u05d0\u05d9 \u05e4\u05e2\u05dd, \u05de\u05ea\u05d5\u05da \u05d4\u05d7\u05d3\u05e9\u05d9\u05dd - \u05e0\u05e1\u05d2\u05e8\u05d5; no date = outside the weekly counts;
//   * \u05e2\u05d1\u05e8\u05d5 \u05d9\u05e2\u05d3 = not closed and target before the meeting date (no target = not
//     counted); "the department that stands out" = the largest, first in the
//     sheet's order on a tie, none when all are 0.
// Accidents (slide 2) from inc: the meeting's year, reported / not, on site /
// off (on the way to or from work, outside the plant), by month, the two
// years before, the last accident and the days since it (computed, never
// stored: the slide once said 21 while the JSON said 14).
import { DEPTS } from './api/hazard-file.js';

const DAY = 86400000;
const d10 = (v) => { const d = v && typeof v === 'object' ? v.date : v; return d ? String(d).substring(0, 10) : ''; };
const addDays = (ymd, n) => new Date(Date.parse(ymd + 'T12:00:00Z') + n * DAY).toISOString().substring(0, 10);
const dow = (ymd) => new Date(Date.parse(ymd + 'T12:00:00Z')).getUTCDay(); // 0 = Sunday
const diffDays = (a, b) => Math.round((Date.parse(a + 'T12:00:00Z') - Date.parse(b + 'T12:00:00Z')) / DAY);
const S_DONE = '\u05e1\u05d2\u05d5\u05e8';
const SEV = { high: '\u05d2\u05d1\u05d5\u05d4\u05d4', medium: '\u05d1\u05d9\u05e0\u05d5\u05e0\u05d9\u05ea', low: '\u05e0\u05de\u05d5\u05db\u05d4' };
export const MONTHS = ['\u05d9\u05e0\u05d5', '\u05e4\u05d1\u05e8', '\u05de\u05e8\u05e5', '\u05d0\u05e4\u05e8', '\u05de\u05d0\u05d9', '\u05d9\u05d5\u05e0', '\u05d9\u05d5\u05dc', '\u05d0\u05d5\u05d2', '\u05e1\u05e4\u05d8', '\u05d0\u05d5\u05e7', '\u05e0\u05d5\u05d1', '\u05d3\u05e6\u05de'];

export function weekBefore(ref) {
  const sun = addDays(ref, -dow(ref));
  return { start: addDays(sun, -7), end: addDays(sun, -1) };
}
function standout(list, k) {
  let best = null;
  list.forEach((x) => { if (x[k] > 0 && (!best || x[k] > best[k])) best = x; });
  return best ? best.dept : null;
}

// rows = buildRegister(...).rows (columns A..M); ref = meeting date YYYY-MM-DD.
export function meetingHazards(rows, ref) {
  const wk = weekBefore(ref);
  const inWk = (v) => { const x = d10(v); return !!x && x >= wk.start && x <= wk.end; };
  const month = ref.substring(0, 7);
  const prevMonth = addDays(month + '-01', -1).substring(0, 7);
  const inMonth = (v, m) => d10(v).substring(0, 7) === m;
  const byDept = DEPTS.map((dept) => {
    const mine = rows.filter((r) => r[3] === dept);
    const isNew = (r) => inWk(r[1]);
    return {
      dept,
      closed: mine.filter((r) => r[10] === S_DONE).length,
      open: mine.filter((r) => r[10] !== S_DONE).length,
      newThisWeek: mine.filter(isNew).length,
      closedThisWeek: mine.filter((r) => inWk(r[11])).length,
      total: mine.length,
      newClosed: mine.filter((r) => isNew(r) && r[10] === S_DONE).length,
      openPrior: mine.filter((r) => r[10] !== S_DONE && !isNew(r)).length,
    };
  });
  const sum = (k) => byDept.reduce((s, x) => s + x[k], 0);
  const total = { dept: '\u05e1\u05d4"\u05db', closed: sum('closed'), open: sum('open'), newThisWeek: sum('newThisWeek'), closedThisWeek: sum('closedThisWeek'), total: sum('total'), newClosed: sum('newClosed'), openPrior: sum('openPrior') };
  const open = rows.filter((r) => r[10] !== S_DONE);
  const item = (r) => ({ id: r[0], dept: r[3], shortDescription: String(r[5] || '').replace(/\s+/g, ' ').substring(0, 80) });
  return {
    week: { start: wk.start, end: wk.end, reference: ref },
    summary: {
      openNow: open.length, openedThisWeek: total.newThisWeek, closedThisWeek: total.closedThisWeek,
      pastDue: open.filter((r) => d10(r[9]) && d10(r[9]) < ref).length,
      bySeverity: { high: open.filter((r) => r[6] === SEV.high).length, medium: open.filter((r) => r[6] === SEV.medium).length, low: open.filter((r) => r[6] === SEV.low).length },
      newClosed: total.newClosed, newStillOpen: total.newThisWeek - total.newClosed,
    },
    byDept, total,
    standout: { closedThisWeek: standout(byDept, 'closedThisWeek'), newThisWeek: standout(byDept, 'newThisWeek'), open: standout(byDept, 'open') },
    month: {
      month, openedThisMonth: rows.filter((r) => inMonth(r[1], month)).length, closedThisMonth: rows.filter((r) => inMonth(r[11], month)).length,
      prevMonth, openedPrevMonth: rows.filter((r) => inMonth(r[1], prevMonth)).length, closedPrevMonth: rows.filter((r) => inMonth(r[11], prevMonth)).length,
    },
    closedThisWeek: rows.filter((r) => inWk(r[11])).map(item),
    openedThisWeek: rows.filter((r) => inWk(r[1])).map(item),
    check: byDept.concat([total]).every((x) => x.closed + x.open === x.total),
    meta: { totalAllTime: rows.length },
  };
}

// inc rows: {dt (timestamptz), d, l, dept, reported, r}. day = the Israeli date.
const ilDay = (ts) => (ts ? new Date(ts).toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }) : '');
export const offSite = (l) => /\u05d1\u05d3\u05e8\u05da|\u05de\u05d7\u05d5\u05e5 \u05dc\u05de\u05e4\u05e2\u05dc/.test(String(l || ''));
function nature(x) { const m = /\u05de\u05d4\u05d5\u05ea \u05d4\u05e4\u05d2\u05d9\u05e2\u05d4: ([^.]+)/.exec(String(x.r || '')); return (m ? m[1] : String(x.d || '')).replace(/\s+/g, ' ').substring(0, 80); }
export function meetingAccidents(inc, ref) {
  const y = +ref.substring(0, 4);
  const wk = weekBefore(ref);
  const all = (inc || []).map((x) => Object.assign({}, x, { day: ilDay(x.dt) })).filter((x) => x.day && x.day <= ref);
  const yr = all.filter((x) => +x.day.substring(0, 4) === y);
  const refMonth = +ref.substring(5, 7);
  const byMonth = [];
  for (let m = 1; m <= refMonth; m++) byMonth.push({ month: MONTHS[m - 1] + '-' + String(y).substring(2), count: yr.filter((x) => +x.day.substring(5, 7) === m).length });
  const last = all.slice().sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : String(b.dt).localeCompare(String(a.dt))))[0] || null;
  return {
    year: y,
    summary: { total: yr.length, reported: yr.filter((x) => x.reported === true).length, notReported: yr.filter((x) => x.reported === false).length, onSite: yr.filter((x) => !offSite(x.l)).length, offSite: yr.filter((x) => offSite(x.l)).length },
    byMonth,
    byYear: { [y - 2]: all.filter((x) => +x.day.substring(0, 4) === y - 2).length, [y - 1]: all.filter((x) => +x.day.substring(0, 4) === y - 1).length },
    lastAccident: last ? { date: last.day, dept: last.dept || null, shortDescription: nature(last), location: last.l || null, reported: last.reported == null ? null : !!last.reported, offSite: offSite(last.l) } : null,
    inWeek: all.filter((x) => x.day >= wk.start && x.day <= wk.end).length,
    daysSinceLastAccident: last ? diffDays(ref, last.day) : null,
  };
}
