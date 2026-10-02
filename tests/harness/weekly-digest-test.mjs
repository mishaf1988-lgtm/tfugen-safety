// The weekly summary mail (upgrade review 11; Michael, 30/09/2026: "yes,
// Sunday 07:00"). What goes in (overdue by responsible party, target within a
// week, no target, open trustee findings, the committee block), that the mail
// reads as Michael reads dates, that pg_cron's call sends it once to the
// connected account and a second call the same day is skipped, and that a
// missing permission or a refusing Outlook is reported, not swallowed.
import { onRequest, digestOf, digestHtml, digestSubject, STATE_KEY, T } from './_build/weekly-digest.mjs';

let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 400) : '')); } };
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'srv', ONEDRIVE_CLIENT_ID: 'cid', ONEDRIVE_CLIENT_SECRET: 'cs', TRUSTEE_NOTIFY_SECRET: 'nsec' };
const DAY = 86400000;
const d = (x) => ({ date: x });
const TODAY = '2026-10-04'; // a Sunday
const plus = (n, from) => new Date(Date.parse((from || TODAY) + 'T12:00:00Z') + n * DAY).toISOString().substring(0, 10);
// Register rows, columns A..M as buildRegister writes them.
const ROWS = [
  [31, d(plus(-40)), 6, 'חומר גלם', 'מתקן', 'מתקן ארגונומי', 'בינונית', 'אחזקה', 'לייצר', d(plus(-20)), 'בטיפול', null, 'דיווח ממונה'],
  [33, d(plus(-30)), 8, 'חומר גלם', 'רצפות', 'רצפות שבורות', 'גבוהה', 'הנדסה', 'לתקן', d(plus(-3)), 'בטיפול', null, 'דיווח ממונה'],
  [34, d(plus(-30)), 8, 'חומר גלם', 'לוח', 'לוח חשמל', 'גבוהה', 'חשמל', 'לסגור', d(plus(-50)), 'סגור', d(plus(-10)), 'דיווח ממונה'],
  [35, d(plus(-14)), 9, 'מעצבים', 'כניסה', 'ג\'ריקן פתוח', 'נמוכה', 'אחזקה', 'לסגור', d(plus(-10)), 'פתוח', null, 'דיווח ממונה'],
  [36, d(plus(-7)), 10, 'מעצבים', 'מעבר', 'מעבר חסום', 'בינונית', 'מנהל המחלקה', 'לפנות', d(plus(3)), 'פתוח', null, 'דיווח ממונה'],
  [37, d(plus(-7)), 10, 'תוצג', 'מדף', 'מדף רופף', 'בינונית', 'אחזקה', 'לחזק', d(TODAY), 'פתוח', null, 'דיווח ממונה'],
  [38, d(plus(-7)), 10, 'תוצג', 'דלת', 'דלת חירום', 'גבוהה', 'הנדסה', 'לשחרר', d(plus(10)), 'פתוח', null, 'דיווח ממונה'],
  [39, d(plus(-2)), 11, 'מעבדות', 'מקרר', 'מקרר', 'נמוכה', 'מנהל המחלקה', '', null, 'פתוח', null, 'דיווח ממונה'],
  ['נ-1', d(plus(-12)), 8, 'חומר גלם', 'רחבה', 'פנס שבור', 'בינונית', 'מנהל המחלקה + חשמל', 'להחליף (סיור נאמן: מוסא)', d(plus(-9)), 'פתוח', null, 'דיווח נאמן: מוסא'],
  ['נ-2', d(plus(-5)), 8, 'תוצג', 'מחסן', 'ארגז חוסם', 'בינונית', 'מנהל המחלקה', '(סיור נאמן: דוד)', d(plus(-2)), 'סגור', d(plus(-1)), 'דיווח נאמן: דוד'],
];

(async () => {
  console.log('\n1. what goes in');
  const g = digestOf(ROWS, TODAY);
  check('open = everything not סגור (8 of 10)', g.open === 8, g.open);
  check('overdue: 4 rows in 3 groups, the party with the longest delay first, then by delay', g.overdueCount === 4 && g.overdue.map((x) => x.resp).join('|') === 'אחזקה|מנהל המחלקה + חשמל|הנדסה'
    && g.overdue[0].items.map((x) => x.n + ':' + x.days).join() === '31:20,35:10', g.overdue.map((x) => [x.resp, x.items.map((y) => y.n + ':' + y.days)]));
  check('target within 7 days, today included, nearest first; 10 days out is not', g.soon.map((x) => x.n + ':' + x.days).join() === '37:0,36:-3', g.soon.map((x) => x.n));
  check('no target: the one row without a date', g.noDue.map((x) => x.n).join() === '39', g.noDue);
  check('open trustee findings: נ-1 (12 days), the closed נ-2 not', g.trustee.length === 1 && g.trustee[0].n === 'נ-1' && g.trustee[0].age === 12, g.trustee);
  check('three topics: highest severity first, the most overdue among equals', g.topics.map((x) => x.n).join() === '33,38,31', g.topics.map((x) => [x.n, x.sev, x.days]));
  const e = digestOf([], TODAY);
  check('nothing open: empty lists, no crash', e.open === 0 && !e.overdue.length && !e.topics.length);

  console.log('\n2. the mail');
  const meta = { meeting: '2026-10-06', deckAt: '2026-09-25T05:00:00Z', watchOpen: ['מצגת הוועדה: לא התעדכן'] };
  const h = digestHtml(g, TODAY, meta);
  check('rtl, the title with the date DD/MM/YYYY, the total', /dir="rtl"/.test(h) && h.includes(T.title + ' 04/10/2026') && h.includes(T.total.replace('"', '&quot;') + '8'), h.substring(0, 200));
  check('a group heading per responsible party with its count, the delay in red', h.includes('אחזקה (2)') && h.includes('עבר היעד ב-20 ימים') && /color:#b91c1c[^>]*>עבר היעד ב-10 ימים/.test(h));
  check('the near targets say "today" / "in 3 days"', h.includes('>היום<') && h.includes('בעוד 3 ימים'));
  check('trustee findings: the report date and how long open', h.includes('פתוח 12 ימים') && h.includes(T.trustee + ' (1)'));
  check('the committee block: meeting date, the deck older than a week in red, the open sync problem, 3 topics', h.includes(T.meeting + '06/10/2026') && /color:#b91c1c[^>]*>המצגת עודכנה לאחרונה: 25\/09\/2026 08:00 \(לפני יותר משבוע\)/.test(h)
    && h.includes(T.sync + 'מצגת הוועדה: לא התעדכן') && (h.match(/<li>/g) || []).length === 3 && /<li>33 - חומר גלם - רצפות שבורות \(גבוהה\), <span[^>]*>עבר היעד ב-3 ימים/.test(h), h.substring(h.indexOf(T.committee), h.indexOf(T.committee) + 700));
  const h2 = digestHtml(e, TODAY, { meeting: '2026-10-06', deckAt: '', watchOpen: [] });
  check('nothing open, deck never written: "אין" in every section, the deck line in red', (h2.match(/>אין</g) || []).length >= 5 && /color:#b91c1c[^>]*>המצגת לא עודכנה מעולם/.test(h2));
  check('a fresh deck: not red', !/color:#b91c1c[^>]*>המצגת עודכנה/.test(digestHtml(e, TODAY, { meeting: '2026-10-06', deckAt: '2026-10-03T05:00:00Z', watchOpen: [] })));
  check('the link to the app, and the text escaped', h.includes('href="https://tapugan-safety.pages.dev"') && h.includes('ג&#39;ריקן') === false && h.includes("ג'ריקן"));
  check('keyboard characters only', !/[—–־«»“”…•→←]/.test(h + h2 + digestSubject(g, TODAY)), (h + h2).match(/[—–־«»“”…•→←]/));
  const h3 = digestHtml(e, TODAY, { meeting: '2026-10-06', deckAt: '', watchOpen: [], emptyRegs: ['בדיקות שמיעה', 'חומרים מסוכנים'] });
  check('empty statutory registers: one red line near the top, the names, why it matters', /color:#b91c1c;font-weight:bold">מרשמי חובה ריקים: בדיקות שמיעה, חומרים מסוכנים\. אין מהם אף התראת תפוגה/.test(h3)
    && h3.indexOf('מרשמי חובה ריקים') < h3.indexOf(T.overdue), h3.substring(0, 500));
  check('no empty register: no such line', !h.includes('מרשמי חובה ריקים') && !h2.includes('מרשמי חובה ריקים'));
  check('the subject carries the counts', digestSubject(g, TODAY) === 'Tapugan Safety: סיכום שבועי 04/10/2026 - 4 באיחור, 2 יעד קרוב, 1 ליקויי נאמנים', digestSubject(g, TODAY));

  console.log('\n3. the endpoint');
  const HZ = [
    { id: 'h31', n: 31, d: plus(-40, undefined), tour_no: 6, dept: 'חומר גלם', loc: 'מתקן', descr: 'מתקן', sev: 'בינונית', resp: 'אחזקה', due: plus(-20), s: 'בטיפול' },
    { id: 'h38', n: 38, d: plus(-7), tour_no: 10, dept: 'תוצג', loc: 'דלת', descr: 'דלת חירום', sev: 'גבוהה', resp: 'הנדסה', due: plus(10), s: 'פתוח' },
  ];
  const TR = [{ id: 't1', num: 1, u: 'מוסא', t: 3, d: plus(-12), loc: 'חומר גלם · רחבה', ok: false, f: 'פנס שבור', s: 'פתוח', ts: plus(-12) + 'T08:00:00Z' }];
  function world(o) {
    const w = { mails: [], state: Object.assign({}, o.state || {}) };
    globalThis.fetch = async (url, init) => {
      const u = String(url), mth = (init && init.method) || 'GET';
      const json = (x, st = 200) => new Response(JSON.stringify(x), { status: st, headers: { 'Content-Type': 'application/json' } });
      const reg = ['equip_inspections', 'hearing_tests', 'tr', 'hzm'].find((t) => u.startsWith(SB + '/rest/v1/' + t + '?'));
      if (reg) { if (o.regFail === reg) return json({ error: 'x' }, 500); return json((o.emptyRegs || []).includes(reg) ? [] : [{ id: 'r1' }]); }
      if (u.startsWith(SB + '/auth/v1/user')) return json(o.email ? { id: 'u1', email: o.email, is_anonymous: false } : { id: 'a', is_anonymous: true });
      if (u.startsWith(SB + '/rest/v1/app_users')) return json(o.row ? [o.row] : []);
      if (u.startsWith(SB + '/rest/v1/oauth_tokens')) return json(o.noToken ? [] : [{ user_email: 'sviva@tapugan.co.il', refresh_token: 'rt', access_token: 'at', expires_at: new Date(Date.now() + 3600e3).toISOString(), scope: o.scope || 'offline_access User.Read Files.ReadWrite Mail.Send' }]);
      if (u.startsWith(SB + '/rest/v1/tour_hazards')) return json(HZ);
      if (u.startsWith(SB + '/rest/v1/trustee_reports')) return json(TR);
      if (u.startsWith(SB + '/rest/v1/tasks')) return json([]);
      if (u.startsWith(SB + '/rest/v1/server_state') && mth === 'GET') return json(Object.keys(w.state).map((k) => ({ key: k, value: w.state[k], updated_at: 'x' })));
      if (u.startsWith(SB + '/rest/v1/server_state')) { if (mth === 'POST') JSON.parse(init.body).forEach((r) => { w.state[r.key] = r.value; }); return new Response(null, { status: 201 }); }
      if (u.startsWith('https://graph.microsoft.com/v1.0/me/sendMail')) { w.mails.push(JSON.parse(init.body)); return new Response(null, { status: o.mailFail ? 500 : 202 }); }
      return json({ error: 'unexpected ' + u }, 599);
    };
    return w;
  }
  const call = async (o, body, secret) => {
    const w = world(o);
    const headers = { 'content-type': 'application/json' };
    if (secret) headers['x-notify-secret'] = secret; else headers.authorization = 'Bearer tok';
    const r = await onRequest({ request: new Request('https://tapugan-safety.pages.dev/api/weekly-digest', { method: 'POST', headers, body: JSON.stringify(body || {}) }), env: ENV });
    let j = null; try { j = await r.json(); } catch (e) {}
    return { status: r.status, j, w };
  };
  let c = await call({ email: null }, {});
  check('anonymous, no secret: refused', c.status === 401 || c.status === 403, c.status);
  c = await call({}, {}, 'wrong');
  check('a wrong secret: refused', c.status === 401 || c.status === 403, c.status);
  c = await call({ email: 'qwer@tfugen.local', row: { role: 'צופה', active: true } }, { op: 'send' });
  check('viewer: refused, nothing sent', c.status === 403 && !c.w.mails.length, c.status);
  c = await call({}, {}, 'nsec');
  const m = c.w.mails[0] && c.w.mails[0].message;
  let rec = null; try { rec = JSON.parse(c.w.state[STATE_KEY]); } catch (e) {}
  check('pg_cron (the secret): one mail to the connected account only, the counts in the answer', c.j.ok && c.j.sent && c.j.to === 'sviva@tapugan.co.il' && c.w.mails.length === 1 && m.toRecipients.length === 1 && m.toRecipients[0].emailAddress.address === 'sviva@tapugan.co.il'
    && c.j.counts.open === 3 && c.j.counts.overdue === 2 && c.j.counts.trustee === 1, c.j);
  check('the mail: the overdue hazard under אחזקה, the trustee finding, the committee block with a real meeting date', /אחזקה \(1\)/.test(m.body.content) && /נ-1/.test(m.body.content) && new RegExp(T.meeting + '\\d{2}/\\d{2}/\\d{4}').test(m.body.content), m.subject);
  check('every register has rows: no empty-register line, count 0', !/מרשמי חובה ריקים/.test(m.body.content) && c.j.counts.emptyRegs === 0, c.j.counts);
  check('the run is recorded: ok, to, at, counts', rec && rec.ok && rec.to === 'sviva@tapugan.co.il' && rec.at && rec.counts.overdue === 2, rec);
  c = await call({ state: { [STATE_KEY]: JSON.stringify({ at: new Date(Date.now() - 3600e3).toISOString(), ok: true }) } }, {}, 'nsec');
  check('the second cron slot an hour later: skipped, no second mail', c.j.ok && /^sent /.test(c.j.skipped || '') && !c.w.mails.length, c.j);
  c = await call({ state: { [STATE_KEY]: JSON.stringify({ at: new Date(Date.now() - 3600e3).toISOString(), ok: true }) } }, { force: true }, 'nsec');
  check('... unless forced', c.j.ok && c.j.sent && c.w.mails.length === 1, c.j);
  c = await call({ state: { [STATE_KEY]: JSON.stringify({ at: new Date(Date.now() - 3600e3).toISOString(), ok: false, error: 'x' }) } }, {}, 'nsec');
  check('a failed run an hour ago does not block the next try', c.j.ok && c.j.sent, c.j);
  c = await call({ state: { [STATE_KEY]: JSON.stringify({ at: new Date(Date.now() - 8 * 86400e3).toISOString(), ok: true }) } }, {}, 'nsec');
  check('a week later: sent again', c.j.ok && c.j.sent, c.j);
  c = await call({ email: 'admin@tfugen.local' }, { op: 'preview' });
  check('admin preview: the data and the html, nothing sent, nothing recorded', c.j.ok && c.j.html && c.j.digest && c.j.counts.open === 3 && c.j.subject && !c.w.mails.length && !c.w.state[STATE_KEY], Object.keys(c.j));
  c = await call({ emptyRegs: ['hearing_tests', 'hzm'] }, {}, 'nsec');
  const m2 = c.w.mails[0] && c.w.mails[0].message;
  check('two registers empty: the red line in the mail, in the order of the app, counted', m2 && /מרשמי חובה ריקים: בדיקות שמיעה, חומרים מסוכנים\./.test(m2.body.content) && c.j.counts.emptyRegs === 2, c.j.counts);
  c = await call({ emptyRegs: ['tr'], regFail: 'equip_inspections' }, {}, 'nsec');
  const m3 = c.w.mails[0] && c.w.mails[0].message;
  check('a register read that fails is not called empty, and does not stop the mail', c.j.ok && c.j.sent && m3 && /מרשמי חובה ריקים: הדרכות\./.test(m3.body.content) && !/בדיקות ציוד/.test(m3.body.content.split('מרשמי חובה ריקים')[1].split('</p>')[0]), c.j);
  c = await call({ email: 'admin@tfugen.local' }, {});
  check('admin without op: a preview too', c.j.ok && !c.w.mails.length);
  c = await call({ email: 'admin@tfugen.local' }, { op: 'send' });
  check('admin send: the mail goes now, to the connected account', c.j.ok && c.j.sent && c.w.mails.length === 1);
  c = await call({ scope: 'offline_access Files.ReadWrite' }, {}, 'nsec');
  rec = null; try { rec = JSON.parse(c.w.state[STATE_KEY]); } catch (e) {}
  check('no Mail.Send: a clear error, nothing sent, the failure recorded', !c.j.ok && c.j.error === 'no Mail.Send' && !c.w.mails.length && rec && !rec.ok && rec.error === 'no Mail.Send', c.j);
  c = await call({ noToken: true }, {}, 'nsec');
  check('OneDrive not connected: "not connected"', !c.j.ok && c.j.error === 'not connected' && !c.w.mails.length, c.j);
  c = await call({ mailFail: true }, {}, 'nsec');
  rec = null; try { rec = JSON.parse(c.w.state[STATE_KEY]); } catch (e) {}
  check('Outlook refuses: the error with its status, recorded', !c.j.ok && /outlook 500/.test(c.j.error) && rec && /outlook 500/.test(rec.error), c.j);

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
})();
