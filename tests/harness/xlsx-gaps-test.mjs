// The nightly gap check between the app and the Excel control board (08/10/2026,
// /api/xlsx-gaps): dates of "לוח זמנים" against docs/equip_inspections by name, tasks of
// "משימות וליקויים" against tasks.ext_id xl1008-t<n>, read only, and the weekly-mail line.
// The rows below are made up; the real board is never copied into the public repo.
import { onRequest, findGaps, xlDate, rangeUrl, ELSEWHERE, STATE_KEY } from './_build/xlsx-gaps.mjs';
import { xlsxGapsLine, digestHtml, digestOf } from './_build/weekly-digest.mjs';

let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 400) : '')); } };
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const DAY = 86400000;

(async () => {
  console.log('1. dates');
  check('DD.MM.YYYY', xlDate('04.08.2027') === '2027-08-04');
  check('D/M/YYYY', xlDate('4/8/2027') === '2027-08-04');
  check('empty, dash, text: null', xlDate('') === null && xlDate('-') === null && xlDate('ללא תוקף') === null && xlDate(null) === null);

  console.log('\n2. the schedule sheet');
  const DATES = [
    ['', 'לוח זמנים מרכז', '', '', '', '', '', ''],
    ['תחום', 'פריט', 'תאריך יעד', 'ימים', 'סטטוס', 'ספק', 'קישור', 'דירוג'],
    ['כיבוי אש', 'טופס 6 – כריזה', '15.07.2027', '280', 'תקין', 'ספק', 'פתח קובץ', '1'],
    ['כיבוי אש', 'טופס 7 – מתזים', '30.07.2028', '600', 'תקין', 'ספק', 'פתח קובץ', '2'],
    ['רישוי והיתרים', 'היתר רעלים', '', '', 'מידע', '', '', ''],
    ['סביבה וכיולים', 'בדיקה חדשה', '01.01.2027', '', '', '', '', ''],
    ['משימה / ליקוי', 'משימה כלשהי', '30.09.2026', '', '', '', '', ''],
    ['תסקירי ציוד', ELSEWHERE[1], '03.10.2027', '', '', '', '', ''],
  ];
  const ITEMS = [{ n: 'טופס 6 – כריזה', e: '2027-07-15' }, { n: 'טופס  7 – מתזים', e: '2027-07-30' }, { n: 'היתר רעלים', e: null }];
  let g = findGaps(DATES, [], { items: ITEMS, tasks: [] });
  check('same date: no gap; empty both sides: no gap', !g.some((x) => /כריזה|רעלים/.test(x.n)), g);
  check('a later date in the Excel: a date gap with both values (spaces in the name ignored)', g.some((x) => x.k === 'date' && /מתזים/.test(x.n) && x.app === '2027-07-30' && x.xl === '2028-07-30'), g);
  check('an item the app does not have: missing', g.some((x) => x.k === 'missing' && x.n === 'בדיקה חדשה' && x.xl === '2027-01-01'), g);
  check('headers, task rows and items kept elsewhere: skipped', g.length === 2, g);

  console.log('\n3. the tasks sheet');
  const TASKS = [
    ['מס"ד', 'תחום', 'משימה / ליקוי', 'מקור', 'תאריך יעד', 'ימים', 'סטטוס'],
    ['1', 'כבאות', 'תכנית בטיחות אש', '', '31.12.2026', '84', 'בטיפול - 84 ימים'],
    ['2', 'סביבה', 'כיול שפכים', '', '', '', 'הושלם'],
    ['3', 'חשמל', 'ליקוי תרמוגרפי 1', '', '30.09.2026', '-8', 'הושלם'],
    ['4', 'חשמל', 'ליקוי תרמוגרפי 2', '', '31.10.2026', '23', 'דחוף - 23 ימים'],
    ['5', 'ציוד', 'שרשרת', '', '', '', 'פתוח - ללא יעד'],
    ['17', 'כיולים', 'גלאי', '', '20.09.2026', '', 'לא רלוונטי'],
    ['26', 'כבאות', 'משימה חדשה', '', '01.11.2026', '', 'פתוח - 24 ימים'],
    ['הוראות:', '', '', '', '', '', ''],
  ];
  const TK = [
    { id: 'fire260012-m1', ext_id: null, title: 'אחר', due: '2026-12-31', status: 'פתוח' },
    { id: 'xl1008-t3', ext_id: 'xl1008-t3', title: 'ליקוי תרמוגרפי 1', due: '2026-09-30', status: 'פתוח' },
    { id: 'xl1008-t4', ext_id: 'xl1008-t4', title: 'ליקוי תרמוגרפי 2', due: '2026-09-30', status: 'פתוח' },
    { id: 'xl1008-t5', ext_id: 'xl1008-t5', title: 'שרשרת', due: null, status: 'בהתקדמות' },
  ];
  g = findGaps([], TASKS, { items: [], tasks: TK });
  check('task 1 matches fire260012-m1, same due: no gap', !g.some((x) => /אש/.test(x.n)), g);
  check('closed in the Excel, open in the app: a state gap', g.some((x) => x.k === 'task-state' && /תרמוגרפי 1/.test(x.n) && x.app === 'פתוח' && x.xl === 'הושלם'), g);
  check('open on both sides, due moved: a due gap', g.some((x) => x.k === 'task-due' && /תרמוגרפי 2/.test(x.n) && x.app === '2026-09-30' && x.xl === '2026-10-31'), g);
  check('open on both, no due on both: no gap', !g.some((x) => x.n === 'שרשרת'), g);
  check('a new open task in the Excel: missing', g.some((x) => x.k === 'task-missing' && x.n === 'משימה חדשה'), g);
  check('closed or not relevant and not in the app: no gap; text rows skipped', g.length === 3, g);

  console.log('\n4. the endpoint');
  check('the Graph URL: the board path and the sheet, encoded, cells as text', /\/workbook\/worksheets\/%D7%9C%D7%95%D7%97%20%D7%96%D7%9E%D7%A0%D7%99%D7%9D\/usedRange\(valuesOnly=true\)\?\$select=text$/.test(rangeUrl('לוח זמנים')) && rangeUrl('x').includes('%D7%A0%D7%99%D7%94%D7%95%D7%9C%20%D7%91%D7%98%D7%99%D7%97%D7%95%D7%AA/00_'));
  const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'srv', ONEDRIVE_CLIENT_ID: 'cid', ONEDRIVE_CLIENT_SECRET: 'cs', TRUSTEE_NOTIFY_SECRET: 'nsec' };
  function world(o) {
    const w = { state: {}, writes: [], graph: [] };
    globalThis.fetch = async (url, init) => {
      const u = String(url), mth = (init && init.method) || 'GET';
      const json = (x, st = 200) => new Response(JSON.stringify(x), { status: st, headers: { 'Content-Type': 'application/json' } });
      if (u.startsWith(SB + '/rest/v1/oauth_tokens')) return json([{ user_email: 'a@b', refresh_token: 'rt', access_token: 'at', expires_at: new Date(Date.now() + 3600e3).toISOString(), scope: 'offline_access User.Read Files.ReadWrite Mail.Send' }]);
      if (u.startsWith(SB + '/rest/v1/server_state') && mth !== 'GET') { JSON.parse(init.body).forEach((x) => { w.state[x.key] = x.value; }); return new Response(null, { status: 201 }); }
      if (mth !== 'GET') { w.writes.push(mth + ' ' + u); return json({}, 599); }
      if (u.startsWith(SB + '/rest/v1/docs')) return json(ITEMS);
      if (u.startsWith(SB + '/rest/v1/equip_inspections')) return json([]);
      if (u.startsWith(SB + '/rest/v1/tasks')) return json(TK);
      if (u.startsWith('https://graph.microsoft.com/')) {
        w.graph.push(u);
        if (o.sheet404) return json({ error: 'nf' }, 404);
        return json({ text: decodeURIComponent(u).includes('לוח זמנים') ? DATES : TASKS });
      }
      return json({ error: 'unexpected ' + u }, 599);
    };
    return w;
  }
  const req = (h) => new Request('https://x/api/xlsx-gaps', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, h || {}), body: '{}' });
  let w = world({});
  let res = await onRequest({ request: req(), env: ENV });
  check('no secret: 403, nothing read', res.status === 403 && !w.graph.length);
  res = await onRequest({ request: req({ 'x-notify-secret': 'nsec' }), env: ENV });
  let s = JSON.parse(w.state[STATE_KEY] || '{}');
  check('a run: both sheets read, 5 gaps saved, ok', s.ok === true && s.gaps.length === 5 && w.graph.length === 2 && s.at, s);
  check('read only: nothing written but server_state', !w.writes.length, w.writes);
  w = world({ sheet404: true });
  await onRequest({ request: req({ 'x-notify-secret': 'nsec' }), env: ENV });
  s = JSON.parse(w.state[STATE_KEY] || '{}');
  check('the board moved or renamed (404): ok false with the reason', s.ok === false && /sheet 404/.test(s.error), s);

  console.log('\n5. the weekly mail');
  const now = Date.parse('2026-10-11T04:00:00Z'), at = '2026-10-11T03:05:00Z';
  const j = (x) => JSON.stringify(x);
  check('never ran: grey', !xlsxGapsLine(null, now).red && /לא רצה עדיין/.test(xlsxGapsLine(null, now).text));
  check('no gaps: grey with the date', !xlsxGapsLine(j({ at, ok: true, gaps: [] }), now).red && /אין, נבדק 11\/10\/2026/.test(xlsxGapsLine(j({ at, ok: true, gaps: [] }), now).text));
  const l = xlsxGapsLine(j({ at, ok: true, gaps: [{ k: 'date', n: 'טופס 7', app: '2027-07-30', xl: '2028-07-30' }, { k: 'task-state', n: 'ליקוי 1', app: 'פתוח', xl: 'הושלם' }] }), now);
  check('gaps: red, the count, the kind and both values in DD/MM/YYYY', l.red && l.text === 'פערים בין האפליקציה ל-Excel: 2: טופס 7 (תאריך שונה: 30/07/2027 / 30/07/2028); ליקוי 1 (סטטוס שונה: פתוח / הושלם)', l.text);
  const many = xlsxGapsLine(j({ at, ok: true, gaps: Array.from({ length: 8 }, (_, i) => ({ k: 'missing', n: 'פריט ' + i, xl: null })) }), now);
  check('more than 5: the first 5 and the rest counted', /ועוד 3$/.test(many.text), many.text);
  check('failed: red with the reason', xlsxGapsLine(j({ at, ok: false, error: 'sheet 404' }), now).red && /sheet 404/.test(xlsxGapsLine(j({ at, ok: false, error: 'sheet 404' }), now).text));
  check('older than 3 days: red (the cron stopped)', xlsxGapsLine(j({ at: new Date(now - 4 * DAY).toISOString(), ok: true, gaps: [] }), now).red);
  const h = digestHtml(digestOf([], '2026-10-11'), '2026-10-11', { meeting: '2026-10-13', deckAt: '', watchOpen: [], xg: l });
  check('in the mail, red', /color:#b91c1c;font-weight:bold">פערים בין האפליקציה/.test(h));

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('HARNESS ERROR: ' + (e && e.stack || e)); process.exit(1); });
