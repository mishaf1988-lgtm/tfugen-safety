// The weekly summary mail (upgrade review 11; Michael, 30/09/2026: "yes,
// Sunday 07:00"). What goes in (overdue by responsible party, target within a
// week, no target, open trustee findings, the committee block), that the mail
// reads as Michael reads dates, that pg_cron's call sends it once to the
// connected account and a second call the same day is skipped, and that a
// missing permission or a refusing Outlook is reported, not swallowed.
import { attachQuotes, quoteKey, contactOf, vendorOf, QUOTE_WAIT_DAYS, QUOTE_HREF_MAX } from './_build/weekly-digest.mjs';
import { onRequest, digestOf, digestHtml, digestSubject, expiringOf, recurringOf, neverOf, plusMonths, STATE_KEY, T, EXP_SHOW, talkLine, latestTalk, uploadLine, logText, UPLOAD_STALE_DAYS, nevoLine, NEVO_STALE_DAYS, assistantLine, assistantQueue } from './_build/weekly-digest.mjs';

let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 400) : '')); } };
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'srv', ONEDRIVE_CLIENT_ID: 'cid', ONEDRIVE_CLIENT_SECRET: 'cs', TRUSTEE_NOTIFY_SECRET: 'nsec' };
const DAY = 86400000;
const d = (x) => ({ date: x });
const TODAY = '2026-10-04'; // a Sunday
const fdNow = () => new Date().toLocaleDateString('en-GB', { timeZone: 'Asia/Jerusalem' });
const DAYMS = 86400000;
const fdAgo = (n) => new Date(Date.now() - n * DAYMS).toLocaleDateString('en-GB', { timeZone: 'Asia/Jerusalem' });
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

  console.log('\n2b. expiries (02/10/2026): expired or within 30 days, from the tables the app scans');
  const X = expiringOf([
    ['מסמך', ['n'], ['o'], [{ id: 'd1', n: 'סוד Azure', o: 'מיכאל', e: plus(10) }, { id: 'd2', n: 'ישן', o: '', e: plus(-3) }]],
    ['הדרכה', ['n'], ['w'], [{ id: 't1', n: 'גובה', w: 'דוד', e: plus(30) }, { id: 't2', n: 'רחוק', w: 'דוד', e: plus(31) }]],
    ['קבלן', ['n'], ['c'], [{ id: 'c1', n: 'ריק', c: 'x', e: '' }, { id: 'c2', n: 'טקסט', c: 'x', e: '15/10/2026' }, { id: 'c3', n: 'בלי', c: 'x', e: null }]],
    ['בדיקת ציוד', ['n', 'code'], ['vendor', 'loc'], [{ id: 'q1', n: '', code: 'FL-07', vendor: null, loc: 'מחסן', e: TODAY }]],
  ], TODAY);
  check('expired, today, within 30 days in; 31 days, empty, non-ISO and null out; the earliest first', X.map((x) => x.name + ':' + x.days).join() === 'ישן:-3,FL-07:0,סוד Azure:10,גובה:30', X);
  check('name and owner fall back to the next column (code, loc), as _expCollect does', X[1].name === 'FL-07' && X[1].owner === 'מחסן' && X[1].label === 'בדיקת ציוד', X[1]);
  const hx = digestHtml(g, TODAY, { meeting: '2026-10-06', deckAt: '', watchOpen: [], emptyRegs: [], expiring: X, expFail: [] });
  check('the mail: a section with the count, above the overdue hazards', hx.includes(T.exp + ' (4)') && hx.indexOf(T.exp) < hx.indexOf(T.overdue), hx.substring(0, 300));
  check('the row reads as Michael reads it: DD/MM/YYYY, "פג לפני 3 ימים" in red, "בעוד 10 ימים"', hx.includes('01/10/2026') && /color:#b91c1c;font-weight:bold">פג לפני 3 ימים/.test(hx) && hx.includes('בעוד 10 ימים') && hx.includes('>היום<'), hx);
  const many = Array.from({ length: EXP_SHOW + 5 }, (_, i) => ({ id: 'm' + i, n: 'מסמך ' + i, o: '', e: plus(-1) }));
  const hm = digestHtml(g, TODAY, { meeting: '2026-10-06', expiring: expiringOf([['מסמך', ['n'], ['o'], many]], TODAY), expFail: ['קבלן'] });
  check('more than ' + EXP_SHOW + ' rows: the first ' + EXP_SHOW + ' and "ועוד 5"; a table not read is named', (hm.match(/מסמך \d+/g) || []).length === EXP_SHOW && hm.includes('ועוד 5') && hm.includes(T.expFail + 'קבלן'), hm.length);
  const h0 = digestHtml(g, TODAY, { meeting: '2026-10-06', expiring: [], expFail: [] });
  check('nothing expiring: the section says אין', new RegExp(T.exp.replace(/[()]/g, '\\$&') + ' \\(0\\)</h3><p style="color:#555">אין').test(h0), h0.substring(0, 400));

  console.log('\n2b2. quote request (08/10/2026): one mail per supplier, no tracking code, the stage from server_state.quote_track');
  const QL = () => expiringOf([
    ['בדיקת ציוד', ['n', 'code'], ['vendor', 'loc'], [
      { id: 'abc123', n: 'מדחס 3', vendor: 'דוד בן-כליפא (בודק 207)', serial_number: 'SN-9', report_number: '400/1', loc: 'חדר מדחסים', e: plus(-5) },
      { id: 'abc124', n: 'מדחס 4', vendor: 'דוד בן-כליפא', serial_number: 'SN-10', loc: 'חדר מדחסים', e: plus(3) },
      { id: 'q9', n: 'מלגזה', vendor: null, e: plus(-1) }], 'equip_inspections'],
    ['מסמך', ['n'], ['o'], [
      { id: 'xl1008-d10', n: 'טופס 9א', o: 'מיכאל', nt: 'תדירות: חצי-שנתי. ספק: אלפיין סיסטמס מיגון אש. יובא', e: plus(3) },
      { id: 'xl1008-d54', n: 'רישיון ייצור מזון', o: 'מיכאל', nt: 'גורם מאשר: משרד הבריאות.', e: plus(-9) }], 'docs'],
    ['הדרכה', ['n'], ['w'], [{ id: 't1', n: 'גובה', w: 'דוד', e: plus(2) }], 'tr'],
  ], TODAY);
  const CT = [['בן כליפא', 'bkeng.ltd@gmail.com'], ['אלפיין', 'tali@alpinesystem.com'], ['כליפא', 'short@x.com'], ['ריק', 'not-an-email']];
  const Q = attachQuotes(QL(), CT, {}, TODAY);
  const qby = (n) => Q.find((x) => x.name === n);
  const qm3 = qby('מדחס 3'), qm4 = qby('מדחס 4'), qf9 = qby('טופס 9א'), qfl = qby('מלגזה');
  check('the key (for the Routine, not in the mail): table code, id, expiry; training and a document with no supplier get none', qm3.quote.key === 'Q-eq-abc123-' + plus(-5).substring(2).replace(/-/g, '') && qf9.quote.key.startsWith('Q-dc-xl1008-d10-') && !qby('גובה').quote && !qby('רישיון ייצור מזון').quote);
  check('an id with other characters gets no key', quoteKey('docs', 'a b', TODAY) === '' && quoteKey('tr', 't1', TODAY) === '' && quoteKey('docs', 'x1', '') === '');
  check('supplier: the vendor column for equipment, "ספק: X." in the note for a document', vendorOf('equip_inspections', { vendor: 'גיל לקס' }) === 'גיל לקס' && vendorOf('docs', { nt: 'תדירות: שנתי. ספק: יהודה נייקרוג. יובא' }) === 'יהודה נייקרוג' && vendorOf('docs', { nt: 'בלי' }) === '');
  check('the address: the longest name inside the vendor, dashes and brackets ignored; a qbad or empty name never', qm3.quote.email === 'bkeng.ltd@gmail.com' && qf9.quote.email === 'tali@alpinesystem.com' && contactOf('ריק בע"מ', CT) === '' && contactOf('', CT) === '' && contactOf('גיל לקס', [['', 'any@x.com'], ['גל', 'g@x.com']]) === '');
  check('one mail per supplier (Michael, 08/10/2026): both compressors of Ben-Kalifa share one link, n = 2; other suppliers alone', qm3.quote.href === qm4.quote.href && qm3.quote.n === 2 && qf9.quote.n === 1 && qf9.quote.href !== qm3.quote.href, [qm3.quote.n, qf9.quote.n]);
  const qdec = decodeURIComponent(qm3.quote.href.replace(/^mailto:[^?]*\?/, '').replace(/&body=/, '\n'));
  check('the mail: to the supplier, a plain subject, both items numbered with serial, last report, location and expiry DD/MM/YYYY', qm3.quote.href.startsWith('mailto:bkeng.ltd@gmail.com?subject=') && qdec.startsWith('subject=בקשת הצעת מחיר - תעשיות תפוגן\n') && qdec.includes('לפריטים הבאים:') && qdec.includes('1. מדחס 3 (מספר סידורי SN-9, דוח קודם 400/1, מיקום חדר מדחסים, תוקף נוכחי ' + plus(-5).split('-').reverse().join('/') + ')') && qdec.includes('2. מדחס 4 (מספר סידורי SN-10'), qdec);
  const qall = Q.filter((x) => x.quote).map((x) => decodeURIComponent(x.quote.href)).join('\n');
  check('no tracking code anywhere in a mail to a supplier (Michael, 08/10/2026)', !/TS-|Q-eq|Q-dc|\[|\]/.test(qall), qall.match(/TS-|Q-eq|Q-dc/));
  check('a single item: its name in the subject, no numbering', decodeURIComponent(qf9.quote.href).includes('subject=בקשת הצעת מחיר - תעשיות תפוגן: טופס 9א') && !decodeURIComponent(qf9.quote.href).includes('1. '));
  check('the mail text is keyboard characters only (sent to a person)', !/[—–־«»“”…•→←]/.test(qall), qall.match(/[—–־«»“”…•→←]/));
  const longList = Array.from({ length: 30 }, (_, i) => ({ id: 'L' + i, n: 'אביזר הרמה מורכב על מלגזה מספר ' + i + ' עם שם ארוך מאוד שממשיך וממשיך הלאה עד הסוף', vendor: "ג'ורג' פריד מהנדסים", serial_number: 'SER-' + i, e: plus(-2) }));
  const QM2 = attachQuotes(expiringOf([["בדיקת ציוד", ["n"], ["vendor"], longList, "equip_inspections"]], TODAY), CT, {}, TODAY);
  const qhrefs = [...new Set(QM2.map((x) => x.quote.href))];
  check('a long supplier list is split: every link under ' + QUOTE_HREF_MAX + ' characters, every item in exactly one mail, long names cut', qhrefs.length > 1 && qhrefs.every((h) => h.length <= QUOTE_HREF_MAX) && QM2.reduce((a, x) => a + 1 / x.quote.n, 0) > qhrefs.length - 0.01 && decodeURIComponent(qhrefs[0]).includes('...'), qhrefs.map((h) => h.length));
  const qhq = digestHtml(g, TODAY, { meeting: '2026-10-06', expiring: Q, expFail: [] });
  check('the mail column: a link on 4 rows, "מייל אחד ל-2 פריטים של הספק" qby the shared one, nothing on training or the license', (qhq.match(/>בקש הצעת מחיר<\/a>/g) || []).length === 4 && qhq.includes('>הצעת מחיר</th>') && (qhq.match(/מייל אחד ל-2 פריטים של הספק/g) || []).length === 2, qhq.substring(qhq.indexOf(T.exp), qhq.indexOf(T.exp) + 900));
  check('no address known: the link opens with an empty "to", and says so', qfl.quote.href.startsWith('mailto:?subject=') && qhq.includes('(אין מייל ספק)'));
  const qk1 = qm3.quote.key, qk2 = qf9.quote.key;
  const QTR = {}; QTR[qk1] = { stage: 'order', sent: plus(-20), quote: plus(-12), order: plus(-6), planned: plus(9) }; QTR[qk2] = { stage: 'sent', sent: plus(-QUOTE_WAIT_DAYS - 1) };
  const QS2 = attachQuotes(QL(), CT, QTR, TODAY);
  const qhs = digestHtml(g, TODAY, { meeting: '2026-10-06', expiring: QS2, expFail: [] });
  const qfdd = (d) => d.split('-').reverse().join('/');
  check('tracked: the stage replaces the link, with its date and the planned date', qhs.includes('נשלחה הזמנה ' + qfdd(plus(-6)) + ', מתוכנן ' + qfdd(plus(9))), qhs.substring(qhs.indexOf(T.exp), qhs.indexOf(T.exp) + 1500));
  check('a tracked item leaves its supplier mail: the other compressor alone (n = 1)', QS2.find((x) => x.name === 'מדחס 4').quote.n === 1);
  check('a request with no answer for ' + QUOTE_WAIT_DAYS + '+ days says so', qhs.includes('נשלחה בקשה ' + qfdd(plus(-QUOTE_WAIT_DAYS - 1))) && qhs.includes('אין תשובה ' + (QUOTE_WAIT_DAYS + 1) + ' ימים'));
  const qbad = {}; qbad[qk1] = { stage: 'whatever' }; qbad[qk2] = 'x';
  check('a stage that is not sent/quote/order (or not an object) is ignored: the link stays', attachQuotes(QL(), CT, qbad, TODAY).filter((x) => x.quote && !x.quote.st).length === 4 && attachQuotes(QL(), CT, null, TODAY).length === 6);
  check('a list with no quote rows: the table has no extra column (as before)', !hx.includes('>הצעת מחיר</th>'));

  console.log('\n2c. recurring duties (02/10/2026, BACKLOG 7): 12 months after the last one, as _drlNext/_audNext/_mrNext/_legNext');
  check('plusMonths: 12 months on, 29/02 to 28/02, empty stays empty', plusMonths('2025-10-20', 12) === '2026-10-20' && plusMonths('2024-02-29', 12) === '2025-02-28' && plusMonths(null, 12) === '');
  const R = expiringOf(recurringOf({
    drl: [{ id: 'a', ty: 'פינוי', d: plus(-365 - 10) }, { id: 'b', ty: 'פינוי', d: plus(-300) }, { id: 'c', ty: 'שריפה', d: plus(-360) }, { id: 'x', ty: 'דליפה', d: null }],
    auds: [{ id: 'u1', r: 'מחסן', d: plus(-370), s: 'בוצע' }, { id: 'u2', r: 'מחסן', d: plus(-10), s: 'מתוכנן' }],
    mgmt_reviews: [{ id: 'm1', ts: plus(-400) + 'T09:00:00Z' }, { id: 'm2', ts: plus(-350) + 'T09:00:00Z' }],
    leg: [{ id: 'l1', s: 'חוק ארגון הפיקוח', c: 'עומד', c_date: plus(-366) }, { id: 'l2', s: 'טרם', c_date: null }],
  }), TODAY);
  const nm = R.map((x) => x.label + '/' + x.name).join();
  check('per type the latest counts (פינוי done 300 days ago = not due); a planned audit does not reset the area; any review; per law; never done = no row', nm === 'ביקורת פנים/מחסן,הערכת ציות/חוק ארגון הפיקוח,תרגיל חירום/שריפה,סקירת הנהלה/סקירת הנהלה', R);
  check('the owner column says when it was last done, as on the expiry page', R[1].owner === 'הוערך: ' + plus(-366).split('-').reverse().join('/') + ' (עומד)' && /^אחרונה: \d{2}\/\d{2}\/\d{4}$/.test(R[3].owner), R);
  check('empty registers (live 02/10/2026: drl, mgmt_reviews and leg have 0 rows): no row at all', expiringOf(recurringOf({}), TODAY).length === 0);
  check('never done (live 02/10/2026: mgmt_reviews 0 rows): only the review, only when read and empty', neverOf({ mgmt_reviews: [], drl: [], leg: [] }).join() === 'סקירת הנהלה' && !neverOf({}).length && !neverOf({ mgmt_reviews: [{ id: 'm1', ts: plus(-10) }] }).length);
  const RE = expiringOf(recurringOf({ env: [{ id: 'v1', ty: 'דיגום שפכים חודשי', d: plus(-40) }, { id: 'v2', ty: 'דיגום שפכים שנתי', d: plus(-200) }, { id: 'v3', ty: 'בדיקת פליטות בארובות', d: (+TODAY.substring(0, 4) - 2) + '-06-01' }, { id: 'v4', ty: 'צריכת מים', d: plus(-900) }] }), TODAY);
  check('factory measurements (04/10/2026): monthly sewage 40 days ago is due, stacks two years ago overdue since 31/12 last year, yearly sewage 200 days ago not yet, other types never', RE.map((x) => x.name).sort().join() === ['בדיקת פליטות בארובות', 'דיגום שפכים חודשי'].sort().join() && RE.find((x) => x.name === 'בדיקת פליטות בארובות').e === (+TODAY.substring(0, 4) - 1) + '-12-31', RE);
  const hn = digestHtml(e, TODAY, { meeting: '2026-10-06', deckAt: '', watchOpen: [], emptyRegs: [], expiring: [], expFail: [], never: ['סקירת הנהלה'] });
  check('never done: a red line before the expiry block', /<p style="color:#b91c1c;font-weight:bold">לא בוצע אף פעם: סקירת הנהלה\./.test(hn) && hn.indexOf('לא בוצע אף פעם') < hn.indexOf(T.exp), hn.substring(0, 600));

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
      if (u.includes('&e=lte.')) { const t = u.slice((SB + '/rest/v1/').length).split('?')[0]; (w.expUrls = w.expUrls || []).push(u); if (o.expFail === t) return json({ error: 'x' }, 500); return json((o.exp || {})[t] || []); }
      const rec = ['drl', 'auds', 'mgmt_reviews', 'leg', 'env'].find((t) => u.startsWith(SB + '/rest/v1/' + t + '?'));
      if (rec) { (w.recUrls = w.recUrls || []).push(u); if (o.recFail === rec) return json({ error: 'x' }, 500); return json((o.rec || {})[rec] || []); }
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
      if (u.startsWith('https://graph.microsoft.com/v1.0/me/drive/root:/') && decodeURIComponent(u).includes('סקילים להעלאה:/children')) {
        (w.dirUrls = w.dirUrls || []).push(decodeURIComponent(u));
        const L = o.upload || {}; if (L.dirFail) return json({ error: 'x' }, 500); if (L.dirThrow) throw new Error('network');
        return json({ value: L.children || [] });
      }
      if (u.startsWith('https://graph.microsoft.com/v1.0/me/drive/root:/') && decodeURIComponent(u).includes('סקילים להעלאה/יומן.txt')) {
        (w.logUrls = w.logUrls || []).push(decodeURIComponent(u));
        const L = o.upload; if (!L) return json({ error: 'not found' }, 404);
        if (L.status) return json({ error: 'x' }, L.status);
        if (u.includes(':/content')) return new Response(L.bytes || new TextEncoder().encode(L.text), { status: 200 });
        return json({ lastModifiedDateTime: L.mod || null });
      }
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
  check('no review in the table (read, empty): the never-done line, counted', /לא בוצע אף פעם: סקירת הנהלה\./.test(m.body.content) && c.j.counts.never === 1, c.j.counts);
  c = await call({ rec: { mgmt_reviews: [{ id: 'm1', ts: plus(-30) + 'T09:00:00Z' }] } }, { force: true }, 'nsec');
  check('a review done: no never-done line, count 0', c.w.mails[0] && !/לא בוצע אף פעם/.test(c.w.mails[0].message.body.content) && c.j.counts.never === 0, c.j.counts);
  c = await call({ recFail: 'mgmt_reviews' }, { force: true }, 'nsec');
  check('the review read fails: not called never done, named as not read', c.w.mails[0] && !/לא בוצע אף פעם/.test(c.w.mails[0].message.body.content) && /לא נקרא, לבדוק באפליקציה: [^<]*סקירת הנהלה/.test(c.w.mails[0].message.body.content), c.j.counts);
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
  check('upload log: read from the fixed path, never written', (c.w.logUrls || []).length === 1 && c.w.logUrls[0].endsWith('/שולחן העבודה/סקילים להעלאה/יומן.txt?$select=lastModifiedDateTime'), c.w.logUrls);
  check('no upload log yet: red line in the preview', c.j.meta.upload && c.j.meta.upload.red && /אין יומן העלאות/.test(c.j.html), c.j.meta.upload);
  c = await call({ email: 'admin@tfugen.local', upload: { mod: new Date().toISOString(), text: 'x\r\n' + fdNow() + ' 09:12 הועלה michael-assistant.zip\r\n\r\n' } }, { op: 'preview' });
  check('upload log with a fresh line: shown as is, not red', c.j.meta.upload && !c.j.meta.upload.red && c.j.meta.upload.text.endsWith('הועלה michael-assistant.zip') && c.w.logUrls.length === 2, c.j.meta.upload);
  // 07/10/2026: a zip waiting in the folder's top and a log over 24 hours old = the task is not running.
  const stuckLog = { mod: new Date(Date.now() - 3 * DAYMS).toISOString(), text: fdAgo(3) + ' 10:20 | michael-assistant | הועלה (v13)\r\n', children: [{ name: 'm365-guard-07-10-2026.zip', file: {} }, { name: 'הועלו', folder: {} }, { name: 'ישן.zip', folder: {} }, { name: 'יומן.txt', file: {} }] };
  c = await call({ email: 'admin@tfugen.local', upload: stuckLog }, { op: 'preview' });
  check('stuck task: red, "לא רצה מאז" with the last line\'s date and time, the waiting zip named; folders and the log are not counted', c.j.meta.upload.red && c.j.meta.upload.text === 'העלאת העוזר לחשבון: משימת ההעלאה לא רצה מאז ' + fdAgo(3) + ' 10:20, 1 ממתינים בתיקייה: m365-guard-07-10-2026.zip' && c.w.dirUrls.length === 1 && c.w.dirUrls[0].endsWith('/שולחן העבודה/סקילים להעלאה:/children?$select=name,file&$top=200'), [c.j.meta.upload, c.w.dirUrls]);
  c = await call({ email: 'admin@tfugen.local', upload: Object.assign({}, stuckLog, { dirFail: true }) }, { op: 'preview' });
  check('folder listing fails: no stuck line, the mail still builds (3-day-old line, under the 8-day limit: green)', c.j.ok && !c.j.meta.upload.red && !/לא רצה מאז/.test(c.j.meta.upload.text), c.j.meta.upload);
  c = await call({ email: 'admin@tfugen.local', upload: Object.assign({}, stuckLog, { dirThrow: true }) }, { op: 'preview' });
  check('folder listing throws: the log line still shown, not "לא נקרא"', c.j.ok && !/לא נקרא/.test(c.j.meta.upload.text) && /10:20 \| michael-assistant/.test(c.j.meta.upload.text), c.j.meta.upload);
  c = await call({ email: 'admin@tfugen.local', upload: { status: 500 } }, { op: 'preview' });
  check('upload log read fails: red, says not read, the mail still builds', c.j.ok && c.j.meta.upload.red && /לא נקרא \(onedrive 500\)/.test(c.j.meta.upload.text), c.j.meta.upload);
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

  const now = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
  c = await call({ exp: { docs: [{ id: 'd1', n: 'סוד Azure של OneDrive', o: 'מיכאל', e: plus(10, now) }], tr: [{ id: 't1', n: 'עבודה בגובה', w: 'דוד', e: plus(-2, now) }] } }, { op: 'send', force: true }, 'nsec');
  const mx = c.w.mails[0] && c.w.mails[0].message.body.content;
  check('the endpoint reads all seven tables up to today + 30, and the mail carries the rows', (c.w.expUrls || []).length === 7 && c.w.expUrls.every((u) => u.includes('&e=lte.' + plus(30, now))) && /סוד Azure של OneDrive/.test(mx) && /עבודה בגובה/.test(mx) && c.j.counts.expiring === 2 && c.j.counts.expired === 1, [c.j.counts, (c.w.expUrls || []).length]);
  c = await call({ rec: { drl: [{ id: 'd1', ty: 'פינוי חירום', d: plus(-370, now) }] } }, { op: 'send', force: true }, 'nsec');
  const mr = c.w.mails[0] && c.w.mails[0].message.body.content;
  check('the endpoint reads the five duty tables, and a drill past its 12 months is in the block, counted as expired', (c.w.recUrls || []).length === 5 && /תרגיל חירום<\/td><td[^>]*>פינוי חירום/.test(mr) && c.j.counts.expiring === 1 && c.j.counts.expired === 1, [c.j.counts, c.w.recUrls]);
  c = await call({ recFail: 'leg' }, {}, 'nsec');
  check('a duty table that fails to read is named, not taken as "none"', c.w.mails[0] && c.w.mails[0].message.body.content.includes(T.expFail + 'הערכת ציות'), c.j);
  c = await call({ expFail: 'ctr' }, {}, 'nsec');
  check('a table that fails to read is named in the mail, not taken as "none"', c.w.mails[0] && c.w.mails[0].message.body.content.includes(T.expFail + 'קבלן'), c.j);

  console.log('\nweekly talk line (03/10/2026, stage 4)');
  {
    const talks = [{ id: 'a', d: '2026-09-27', title: 'ישן', s: 'פורסמה' }, { id: 'b', d: '2026-10-04', title: 'מלגזות', s: 'פורסמה' }, { id: 'c', d: '2026-10-11', title: 'טיוטה', s: 'טיוטה' }];
    const reads = [{ talk_id: 'b', emp_id: 'e1' }, { talk_id: 'b', emp_id: 'e2' }, { talk_id: 'b', emp_id: 'e2' }, { talk_id: 'a', emp_id: 'e3' }];
    const l = talkLine(talks, reads, 10, '2026-10-05');
    check('the latest published talk (not the draft), distinct signers, of all workers', l && l.text === 'הדרכה שבועית "מלגזות" (04/10/2026): 2 מתוך 10 חתמו', l);
    check('under 80%: red', l && l.red === true);
    const full = talkLine(talks, Array.from({ length: 8 }, (_, i) => ({ talk_id: 'b', emp_id: 'x' + i })), 10, '2026-10-05');
    check('8 of 10: not red', full && full.red === false, full);
    const stale = talkLine(talks, reads, 10, '2026-10-13');
    check('nothing new for over 8 days: red, says since when', stale && stale.red && /לא פורסמה הדרכה חדשה מאז 04\/10\/2026/.test(stale.text), stale);
    check('no talk ever, or the read failed: no line', talkLine([], [], 10, '2026-10-05') === null && talkLine(null, null, 0, '2026-10-05') === null);
    check('no workers listed: count only, red only at 0', talkLine(talks, reads, 0, '2026-10-05').text.endsWith(': 2 חתמו') && talkLine(talks, [], 0, '2026-10-05').red === true);
    // checker 03/10/2026
    const undated = [{ id: 'a', d: '2026-09-27', title: 'ישן', s: 'פורסמה', ts: '2026-09-27T05:00:00Z' }, { id: 'n', d: null, title: 'בלי תאריך', s: 'פורסמה', ts: '2026-10-04T05:00:00Z' }];
    check('checker 3: a talk with no date is placed by when it was saved', latestTalk(undated).id === 'n' && /בלי תאריך/.test(talkLine(undated, [], 10, '2026-10-06').text), talkLine(undated, [], 10, '2026-10-06'));
    const emps = [{ id: 'e1' }, { id: 'e2' }, { id: 3 }];
    const lr = [{ talk_id: 'b', emp_id: 'e1' }, { talk_id: 'b', emp_id: '3' }, { talk_id: 'b', emp_id: 'left1' }];
    check('checker 6: only signatures of current employees count, numeric ids too', talkLine(talks, lr, emps, '2026-10-05').text.endsWith(': 2 מתוך 3 חתמו'), talkLine(talks, lr, emps, '2026-10-05'));
    check('published today: not red yet', talkLine(talks, [], 10, '2026-10-04').red === false && talkLine(talks, [], 10, '2026-10-05').red === true);
    // link_at (03/10/2026, Michael chose a column): the link runs out 14 days after it was made.
    const lk = (at, d) => [{ id: 'b', d: d || '2026-10-04', title: 'מלגזות', s: 'פורסמה', link_at: at }];
    const soon = talkLine(lk('2026-10-04T06:00:00Z'), reads, 10, '2026-10-12');
    check('link runs out before the next mail, signatures missing: red, says when', soon.red && soon.text.endsWith('. הקישור לעובדים פג ב-18/10/2026 (בעוד 6 ימים). כדאי לשלוח קישור חדש למי שלא חתם'), soon);
    check('a week and a day left: no link warning', !/הקישור/.test(talkLine(lk('2026-10-04T06:00:00Z'), reads, 10, '2026-10-10').text));
    check('runs out today', /פג ב-12\/10\/2026 \(היום\)/.test(talkLine(lk('2026-09-28T06:00:00Z', '2026-10-10'), reads, 10, '2026-10-12').text));
    const gone = talkLine(lk('2026-09-20T06:00:00Z'), reads, 10, '2026-10-05');
    check('already ran out: red, make a new one', gone.red && /הקישור לעובדים פג ב-04\/10\/2026\. ליצור קישור חדש/.test(gone.text), gone);
    const okFull = talkLine(lk('2026-10-04T06:00:00Z'), Array.from({ length: 8 }, (_, i) => ({ talk_id: 'b', emp_id: 'x' + i })), 10, '2026-10-11');
    check('80% signed: no link warning a week before it runs out', !okFull.red && !/הקישור/.test(okFull.text), okFull);
    check('link made late in the evening: the day is Israel\'s', /פג ב-19\/10\/2026/.test(talkLine(lk('2026-10-04T22:30:00Z', '2026-10-12'), reads, 10, '2026-10-13').text));
    check('no link yet and nobody signed: says so', /עוד לא נוצר קישור לעובדים$/.test(talkLine(lk(null), [], 10, '2026-10-05').text) && !/קישור/.test(talkLine(lk(null), [], 10, '2026-10-04').text));
    const fs0 = await import('fs');
    check('the employee count leaves out who left (emp.left_d up to today)', /readAll\(env, 'emp\?select=id&or=\(left_d\.is\.null,left_d\.gt\.' \+ new Date\(\)\.toLocaleDateString\('en-CA', \{ timeZone: 'Asia\/Jerusalem' \}\)/.test(fs0.readFileSync(new URL('../../functions/api/weekly-digest.js', import.meta.url), 'utf8')));
    check('TALK_LINK_DAYS here = TALK_TTL_DAYS in talk.js', /TALK_TTL_DAYS = 14;/.test(fs0.readFileSync(new URL('../../functions/api/talk.js', import.meta.url), 'utf8')) && /TALK_LINK_DAYS = 14,/.test(fs0.readFileSync(new URL('../../functions/api/weekly-digest.js', import.meta.url), 'utf8')));
    const g = digestOf([], '2026-10-05');
    const h = digestHtml(g, '2026-10-05', { meeting: '2026-10-06', deckAt: '', watchOpen: [], talk: l });
    check('in the mail, before the committee block, red', /color:#b91c1c;font-weight:bold">הדרכה שבועית &quot;מלגזות&quot;/.test(h) && h.indexOf('מלגזות') < h.indexOf(T.committee), h.slice(0, 200));
    check('no talk: no line in the mail', !/הדרכה שבועית/.test(digestHtml(g, '2026-10-05', { meeting: '2026-10-06', deckAt: '', watchOpen: [] })));
  }

  {
    console.log('\n9. the skill upload log line (04/10/2026)');
    const now = Date.parse('2026-10-04T09:00:00Z');
    const ok = uploadLine({ text: '01/10/2026 10:00 הועלה a.zip\n04/10/2026 08:30 הועלה michael-assistant.zip\n', mod: '2026-10-04T05:30:00Z' }, now);
    check('fresh DD/MM/YYYY line: green, its date, the line', !ok.red && ok.text === 'העלאת העוזר לחשבון: שורה אחרונה מ-04/10/2026: 04/10/2026 08:30 הועלה michael-assistant.zip', ok);
    const real = uploadLine({ text: '\ufeff04/10/2026 15:32 | michael-assistant-04-10-2026.zip | כבר בחשבון (v8, גרסה: 04/10/2026 (6)), הועבר להועלו\r\n04/10/2026 15:32 | michael-assistant | michael-assistant repo גרסה: 20/09/2026 (6) כבר בחשבון (v8)\r\n' }, now);
    check('the real log line (04/10/2026): the line\'s date, not the version date in it; "already in the account" is not a failure', !real.red && /מ-04\/10\/2026: 04\/10\/2026 15:32 \| michael-assistant \|/.test(real.text), real);
    const iso = uploadLine({ text: '2026-09-30T08:00:00 uploaded a.zip' }, now);
    check('ISO date in the line, 4 days old: green', !iso.red && /מ-30\/09\/2026/.test(iso.text), iso);
    const old = uploadLine({ text: '25/09/2026 הועלה a.zip' }, now);
    check(UPLOAD_STALE_DAYS + ' days is the limit: 9 days old is red and says how long', old.red && /אין שורה חדשה 9 ימים/.test(old.text), old);
    check('8 days old: still green', !uploadLine({ text: '26/09/2026 הועלה' }, now).red);
    check('a line with no date: the file\'s last change (Israel\'s day)', /מ-04\/10\/2026/.test(uploadLine({ text: 'uploaded', mod: '2026-10-03T22:30:00Z' }, now).text));
    check('no date and no change time: red', uploadLine({ text: 'uploaded' }, now).red);
    check('last line failed (Hebrew): red', uploadLine({ text: '04/10/2026 העלאה נכשלה: Chrome סגור' }, now).red);
    check('last line failed (English): red', uploadLine({ text: '04/10/2026 upload ERROR' }, now).red);
    check('an old failure followed by a success: green', !uploadLine({ text: '03/10/2026 נכשל\n04/10/2026 הועלה' }, now).red);
    check('empty file: red', uploadLine({ text: '\r\n \n' }, now).red);
    // 07/10/2026: the real log of that day, last line 06/10/2026 10:20, a zip waiting since.
    const realLog = '06/10/2026 10:20 | michael-assistant-06-10-2026.zip | הועלה (v13, גרסה: 06/10/2026 (17)), הועבר להועלו\r\n06/10/2026 10:20 | michael-assistant | michael-assistant repo גרסה: 06/10/2026 (17) הועלה (v13)\r\n';
    const st = uploadLine({ text: realLog, pending: ['m365-guard-07-10-2026.zip'] }, Date.parse('2026-10-07T09:00:00Z'));
    check('the real case (07/10 12:00, last line 06/10 10:20, one zip waiting): red, stuck', st.red && st.stuck && st.text === 'העלאת העוזר לחשבון: משימת ההעלאה לא רצה מאז 06/10/2026 10:20, 1 ממתינים בתיקייה: m365-guard-07-10-2026.zip', st);
    check('...the same a few hours later on 06/10: under 24 hours, not stuck', !uploadLine({ text: realLog, pending: ['a.zip'] }, Date.parse('2026-10-06T17:00:00Z')).red);
    check('...25 hours, nothing waiting: not stuck (nothing to upload is fine)', !uploadLine({ text: realLog, pending: [] }, Date.parse('2026-10-07T09:00:00Z')).stuck);
    check('long list of waiting files: cut at 120 characters', /\.\.\.$/.test(uploadLine({ text: realLog, pending: Array.from({ length: 12 }, (_, i) => 'michael-assistant-0' + i + '.zip') }, Date.parse('2026-10-08T09:00:00Z')).text));
    check('no file: red', uploadLine({ missing: true }, now).red && uploadLine(null, now).red);
    const long = uploadLine({ text: '04/10/2026 ' + 'א'.repeat(400) }, now);
    check('a long line is cut', long.text.length < 260, long.text.length);
    const u16 = new Uint8Array([0xff, 0xfe, ...Array.from('04/10/2026 הועלה').flatMap((ch) => [ch.charCodeAt(0) & 255, ch.charCodeAt(0) >> 8])]);
    check('UTF-16 file (Windows PowerShell): read', logText(u16) === '04/10/2026 הועלה', logText(u16));
    check('UTF-8 with BOM: read without it', logText(new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode('הועלה')])) === 'הועלה');
    const h = digestHtml(digestOf([], '2026-10-04'), '2026-10-04', { meeting: '2026-10-06', deckAt: '', watchOpen: [], upload: old });
    check('in the mail, in the committee block, red', /color:#b91c1c;font-weight:bold">העלאת העוזר לחשבון/.test(h) && h.indexOf('העלאת העוזר') > h.indexOf(T.committee), h.slice(0, 120));
    check('no upload meta: no line', !/העלאת העוזר/.test(digestHtml(digestOf([], '2026-10-04'), '2026-10-04', { meeting: '2026-10-06', deckAt: '', watchOpen: [] })));
  }

  {
    console.log('\nNevo versions (server_state.nevo_versions, 07/10/2026)');
    const now = Date.parse('2026-11-03T08:00:00Z');
    const at = '2026-11-02T05:30:00Z';
    const j = (o) => JSON.stringify(o);
    check('never ran: a grey line, not red', /לא רץ עדיין/.test(nevoLine(null, now).text) && !nevoLine(null, now).red);
    check('ran, no change: grey, with the date', /אין שינוי.*02\/11\/2026/.test(nevoLine(j({ at, ok: true, changed: [] }), now).text) && !nevoLine(j({ at, ok: true, changed: [] }), now).red);
    const ch = nevoLine(j({ at, ok: true, changed: [{ id: 'leg-nevo-61', s: 'תקנות עבודה בגובה', old: '2024-01-01', new: '2026-10-20' }] }), now);
    check('a changed law: red, named, with the new version date', ch.red && /תקנות עבודה בגובה \(20\/10\/2026\)/.test(ch.text), ch);
    check('failed run: red with the reason', nevoLine(j({ at, ok: false, error: 'nevo 403' }), now).red && /nevo 403/.test(nevoLine(j({ at, ok: false, error: 'nevo 403' }), now).text));
    const old = nevoLine(j({ at: new Date(now - (NEVO_STALE_DAYS + 1) * DAY).toISOString(), ok: true, changed: [] }), now);
    check('stale run: red (the Routine stopped)', old.red && /לא רץ מאז/.test(old.text), old);
    check('broken JSON: treated as never ran', /לא רץ עדיין/.test(nevoLine('{oops', now).text));
    const many = nevoLine(j({ at, ok: true, changed: Array.from({ length: 11 }, (_, i) => ({ id: 'leg-nevo-' + i, s: 'חוק ' + i })) }), now);
    check('many changes: cut at 8 with +N', /\+3$/.test(many.text), many.text);
    const h = digestHtml(digestOf([], '2026-10-04'), '2026-10-04', { meeting: '2026-10-06', deckAt: '', watchOpen: [], nevo: ch });
    check('in the mail, red', /color:#b91c1c;font-weight:bold">מעקב נבו/.test(h));
    check('no nevo meta: no line', !/מעקב נבו/.test(digestHtml(digestOf([], '2026-10-04'), '2026-10-04', { meeting: '2026-10-06', deckAt: '', watchOpen: [] })));
    console.log('\nThe assistant this week (michael-skills research-queue.md, 08/10/2026)');
    // The real file of 08/10/2026: two closed lines dated 08/10, no questions.
    const rq = '# תור\n## פתוח\n- פריט פתוח 1\n## פעם בחודש\n- סריקה\n## שאלות למיכאל\n(הסבר)\n\n## נסגר\n(תאריך, פריט)\n- 08/10/2026, חודשי: סריקת skills.\n- 08/10/2026, ה\' 1 (בדיקה מול בקשות אמיתיות): נבדקו 3 בקשות.\n';
    const n11 = Date.parse('2026-10-11T05:00:00Z');
    const a1 = assistantLine({ text: rq }, n11);
    check('the real file on Sunday 11/10: 2 closed, no questions, grey', a1.text === 'העוזר השבוע: החוקר סגר 2 פערים, אין שאלות פתוחות' && !a1.red, a1);
    check('open items and the monthly list are not counted as closed', !/[3-9] פערים/.test(a1.text));
    const a2 = assistantLine({ text: rq.replace('(הסבר)\n', '(הסבר)\n- האם תקנות הגהות חלות על המחסן בהוד השרון? נבדק בנבו ובתיקייה, לא נמצא\n- שאלה שנייה\n') }, n11);
    check('questions: the count and the first one', /2 שאלות מחכות לך: האם תקנות הגהות/.test(a2.text), a2.text);
    const a3 = assistantLine({ text: rq }, Date.parse('2026-10-18T05:00:00Z'));
    check('nothing closed in 7 days (18/10): red', a3.red && /לא סגר אף פער/.test(a3.text), a3);
    check('the edge: closed on 11/10, read on 18/10 08:00 (7 days): still counted', !assistantLine({ text: rq.replace(/08\/10\/2026/g, '11/10/2026') }, Date.parse('2026-10-18T05:00:00Z')).red);
    const longQ = assistantLine({ text: rq.replace('(הסבר)\n', '(הסבר)\n- ' + 'א'.repeat(300) + '\n') }, n11);
    check('a long question is cut', longQ.text.length < 160 && /\.\.\.$/.test(longQ.text), longQ.text.length);
    check('read failed: red with the reason', assistantLine({ error: 'HTTP 401' }, n11).red && assistantLine({ error: 'HTTP 401' }, n11).text === 'העוזר השבוע: התור לא נקרא (HTTP 401)');
    check('no token: no line', assistantLine(null, n11) === null && (await assistantQueue({})) === null);
    const h2 = digestHtml(digestOf([], '2026-10-11'), '2026-10-11', { meeting: '2026-10-13', deckAt: '', watchOpen: [], asst: a3 });
    check('in the mail, red', /color:#b91c1c;font-weight:bold">העוזר השבוע/.test(h2));
    check('no assistant meta: no line', !/העוזר השבוע/.test(digestHtml(digestOf([], '2026-10-04'), '2026-10-04', { meeting: '2026-10-06', deckAt: '', watchOpen: [] })));
  }

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
})();
