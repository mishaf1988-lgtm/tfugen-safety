// Meeting data (stage 5, 28/09): the week, the per-department table of
// "סיכום שבועי למצגת", and the accidents of slide 2. The live numbers were
// checked against the workbook itself (see STATUS); this pins the rules.
import { weekBefore, meetingHazards, meetingAccidents, offSite } from './_build/_meeting.mjs';
import { onRequest } from './_build/meeting-data.mjs';

let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 400) : '')); } };
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const d = (x) => (x ? { date: x } : null);
// [A, date, tour, dept, loc, descr, sev, resp, action, due, status, closed, notes]
const row = (n, date, dept, sev, due, s, closed) => [n, d(date), 1, dept, '', 'מפגע ' + n, sev, '', '', d(due), s, d(closed), ''];

(async () => {
  console.log('\n1. the week');
  check('meeting on Tuesday 22.09: Sunday 13.09 to Saturday 19.09 (as in the sheet)', JSON.stringify(weekBefore('2026-09-22')) === '{"start":"2026-09-13","end":"2026-09-19"}');
  check('meeting on Sunday 20.09: the same week', weekBefore('2026-09-20').start === '2026-09-13');
  check('meeting on Saturday 19.09: the week before it', weekBefore('2026-09-19').start === '2026-09-06' && weekBefore('2026-09-19').end === '2026-09-12');

  console.log('\n2. hazards');
  const rows = [
    row(1, '2026-09-14', 'ייצור טוגנים', 'גבוהה', '2026-09-20', 'סגור', '2026-09-16'),   // new, closed in the week
    row(2, '2026-09-15', 'ייצור טוגנים', 'בינונית', '2026-09-30', 'פתוח', null),        // new, open
    row(3, '2026-09-07', 'חומר גלם', 'גבוהה', '2026-09-10', 'בטיפול', null),           // old, open, past due
    row(4, '2026-09-07', 'חומר גלם', 'נמוכה', '2026-09-10', 'סגור', '2026-09-18'),     // old, closed in the week
    row(5, null, 'מעצבים', 'בינונית', null, 'פתוח', null),                              // no date: outside weekly counts
    row(6, '2026-09-19', 'ייצור טוגנים', 'נמוכה', null, 'פתוח', null),                 // Saturday: in the week, no target
    row(7, '2026-09-20', 'תוצג', 'בינונית', '2026-09-21', 'פתוח', null),               // Sunday after: not in the week, past due
    ['נ-1', d('2026-09-13'), 8, 'חומר גלם', '', 'פנס', 'בינונית', '', '', d('2026-09-16'), 'סגור', d('2026-09-19'), ''], // trustee
  ];
  const h = meetingHazards(rows, '2026-09-22');
  const by = (k) => h.byDept.find((x) => x.dept === k);
  check('ייצור טוגנים: closed 1, open 2, new 3, closed in week 1, total 3, of the new closed 1', JSON.stringify([by('ייצור טוגנים').closed, by('ייצור טוגנים').open, by('ייצור טוגנים').newThisWeek, by('ייצור טוגנים').closedThisWeek, by('ייצור טוגנים').total, by('ייצור טוגנים').newClosed]) === '[1,2,3,1,3,1]', by('ייצור טוגנים'));
  check('trustee rows count in their department (the register is merged)', by('חומר גלם').total === 3 && by('חומר גלם').newThisWeek === 1 && by('חומר גלם').closedThisWeek === 2, by('חומר גלם'));
  check('"בטיפול" is open; a row with no date is in totals, not in the week', by('חומר גלם').open === 1 && by('מעצבים').open === 1 && by('מעצבים').newThisWeek === 0, [by('חומר גלם'), by('מעצבים')]);
  check('total row and closed + open = total everywhere', h.total.total === 8 && h.total.closed === 3 && h.total.open === 5 && h.check, h.total);
  check('past due: open, with a target before the meeting date (no target = not counted)', h.summary.pastDue === 2, h.summary);
  check('open by severity', JSON.stringify(h.summary.bySeverity) === '{"high":1,"medium":3,"low":1}', h.summary.bySeverity);
  check('of the new in the week: closed 2, still open 2', h.summary.newClosed === 2 && h.summary.newStillOpen === 2, h.summary);
  check('the department that stands out (closed / new / open)', h.standout.closedThisWeek === 'חומר גלם' && h.standout.newThisWeek === 'ייצור טוגנים' && h.standout.open === 'ייצור טוגנים', h.standout);
  check('lists of the week: id, department, short description', h.closedThisWeek.map((x) => x.id).join() === '1,4,נ-1' && h.openedThisWeek.map((x) => x.id).join() === '1,2,6,נ-1', [h.closedThisWeek, h.openedThisWeek]);
  check('the month and the month before', h.month.month === '2026-09' && h.month.openedThisMonth === 7 && h.month.prevMonth === '2026-08' && h.month.openedPrevMonth === 0, h.month);
  const none = meetingHazards([], '2026-09-22');
  check('nothing at all: no department stands out', none.standout.open === null && none.total.total === 0);

  console.log('\n3. accidents');
  const inc = [
    { id: 'a', dt: '2025-03-05T08:00:00Z', l: 'אחזקה', reported: false, r: 'מהות הפגיעה: פגיעת עין. איבר: עין' },
    { id: 'b', dt: '2026-01-21T05:00:00Z', l: 'החלפת סכינים', dept: 'ייצור טוגנים', reported: false, r: 'מהות הפגיעה: חתך באצבע' },
    { id: 'c', dt: '2026-07-26T00:00:00+03:00', l: 'מחלקת ייצור טוגנים', dept: 'אחזקה', reported: true, r: '' , d: 'כוויה משמן' },
    { id: 'e', dt: '2026-08-31T22:30:00Z', l: 'בדרך הביתה', dept: 'מעוצבים', reported: true, r: 'מהות הפגיעה: מעיכת אגודל יד ימין. איבר: אגודל' },
    { id: 'f', dt: '2024-06-01T09:00:00Z', l: 'מטוגנים', reported: null },
    { id: 'late', dt: '2026-09-25T09:00:00Z', l: 'x', reported: true },
  ];
  const a = meetingAccidents(inc, '2026-09-22');
  check('the meeting year only, not after the meeting date', a.year === 2026 && a.summary.total === 3, a.summary);
  check('reported / not reported (unknown counts in neither)', a.summary.reported === 2 && a.summary.notReported === 1, a.summary);
  check('on site / off site ("בדרך", "מחוץ למפעל")', a.summary.offSite === 1 && a.summary.onSite === 2 && offSite('מחוץ למפעל') && !offSite('במפעל'), a.summary);
  check('by month Jan..Sep, labels like the JSON ("ינו-26")', a.byMonth.length === 9 && a.byMonth[0].month === 'ינו-26' && a.byMonth[0].count === 1 && a.byMonth[8].count === 1 && a.byMonth[7].count === 0, a.byMonth);
  check('the two years before', a.byYear['2024'] === 1 && a.byYear['2025'] === 1, a.byYear);
  check('the last accident in Israeli time (22:30 UTC on 31.08 = 01.09), its injury, location, reported', a.lastAccident.date === '2026-09-01' && a.lastAccident.shortDescription === 'מעיכת אגודל יד ימין' && a.lastAccident.location === 'בדרך הביתה' && a.lastAccident.reported === true, a.lastAccident);
  check('days since: computed (01.09 to 22.09 = 21, as the slide said)', a.daysSinceLastAccident === 21, a.daysSinceLastAccident);
  check('no accidents: nulls, no crash', meetingAccidents([], '2026-09-22').lastAccident === null);

  console.log('\n4. the endpoint');
  const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'srv', TRUSTEE_NOTIFY_SECRET: 'nsec' };
  globalThis.fetch = async (url) => {
    const u = String(url);
    const json = (x, st = 200) => new Response(JSON.stringify(x), { status: st, headers: { 'Content-Type': 'application/json' } });
    if (u.startsWith(SB + '/auth/v1/user')) return json({ id: 'a', is_anonymous: true });
    if (u.startsWith(SB + '/rest/v1/tour_hazards')) return json([{ id: 'h1', n: 1, d: '2026-09-14', tour_no: 1, dept: 'תוצג', descr: 'x', s: 'פתוח' }]);
    if (u.startsWith(SB + '/rest/v1/trustee_reports')) return json([]);
    if (u.startsWith(SB + '/rest/v1/inc')) return json(inc);
    return json({}, 599);
  };
  const req = (h, b) => new Request('https://tapugan-safety.pages.dev/api/meeting-data', { method: 'POST', headers: Object.assign({ 'content-type': 'application/json' }, h), body: JSON.stringify(b || {}) });
  let r = await onRequest({ request: req({ authorization: 'Bearer anon' }, {}), env: ENV });
  check('anonymous: refused', r.status === 401 || r.status === 403, r.status);
  r = await onRequest({ request: req({ 'x-notify-secret': 'nsec' }, { ref: '2026-09-22' }), env: ENV });
  let j = await r.json();
  check('with the server secret: the data for that meeting date', j.ok && j.ref === '2026-09-22' && j.hazards.week.start === '2026-09-13' && j.hazards.total.newThisWeek === 1 && j.accidents.daysSinceLastAccident === 21, j);
  r = await onRequest({ request: req({ 'x-notify-secret': 'nsec' }, { ref: '22/09/2026' }), env: ENV });
  j = await r.json();
  check('a malformed date: today (Israel)', j.ok && /^\d{4}-\d{2}-\d{2}$/.test(j.ref) && j.ref !== '22/09/2026', j.ref);

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
