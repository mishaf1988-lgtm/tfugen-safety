// The report to each department (stage 4, 28/09): replaces the workbook macro.
// The recipients sheet below is the real layout of "נמענים" (read with
// od-read on 28/09); the חומר גלם case is the one the macro itself showed in
// "דוח לשליחה" that day: אל gelem, Igal, vitaly, shlomi; עותק sviva, tzachi.
import { onRequest, parseRecipients, buildReport } from './_build/hazard-report.mjs';
import { writeZip } from './_build/_xlsxpatch.mjs';

let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 400) : '')); } };
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'srv', ONEDRIVE_CLIENT_ID: 'cid', ONEDRIVE_CLIENT_SECRET: 'cs', TRUSTEE_NOTIFY_SECRET: 'nsec' };
const R = (r, ...v) => ({ r, v });
const RCPT_ROWS = [
  R(1, 'הגדרת נמענים למיילים'), R(3, '1. מנהלי מחלקות (נמען ראשי - אל)'), R(4, 'מחלקת סיור', 'שם מנהל', 'כתובת מייל (אל)'),
  R(5, 'מעצבים', 'רומן', 'Roman@tapugan.co.il'), R(6, 'ייצור טוגנים', 'נועם', 'prod@tapugan.co.il'),
  R(7, 'חומר גלם', 'שימי, יגאל', 'gelem@tapugan.co.il,Igal@tapugan.co.il'), R(8, 'תוצג', 'יגאל', 'Igal@tapugan.co.il'), R(9, 'מעבדות', 'מורן', 'Moran@tapugan.co.il'),
  R(14, '2. גורמי טיפול (אל - מתווסף רק אם יש משימה פתוחה שלהם)'), R(15, 'גורם אחראי', 'כתובת מייל (אל)'),
  R(16, 'אחזקה', 'vitaly@tapugan.co.il'), R(17, 'חשמל', 'tech_manager@tapugan.co.il'),
  R(18, 'הנדסה + מנהל אחזקה וחשמל (שלומי זבארי)', 'shlomi@tapugan.co.il', 'שלומי מקבל את המייל גם כשיש משימה פתוחה לאחזקה או לחשמל'),
  R(19, '3. נמענים קבועים (עותק - בכל מייל)'), R(20, 'תפקיד', 'כתובת מייל (עותק)'),
  R(21, 'ממונה בטיחות (אתה)', 'sviva@tapugan.co.il'), R(22, 'סמנכ"ל תפעול', 'tzachi@tapugan.co.il'), R(24, 'הצהוב = למילוי. אפשר כמה כתובות מופרדות בפסיק.'),
];
const d = (x) => ({ date: x });
const ROWS = [
  [31, d('2026-08-17'), 6, 'חומר גלם', 'מתקן', 'מתקן אורגונומי', 'בינונית', 'אחזקה', 'לייצר', d('2026-08-31'), 'בטיפול', null, 'דיווח ממונה'],
  [33, d('2026-09-07'), 8, 'חומר גלם', 'רצפות', 'רצפות שבורות', 'בינונית', 'הנדסה', 'לתקן', d('2026-10-07'), 'בטיפול', null, 'דיווח ממונה'],
  [34, d('2026-09-07'), 8, 'חומר גלם', 'לוח', 'לוח חשמל', 'גבוהה', 'חשמל', 'לסגור', d('2026-09-10'), 'סגור', d('2026-09-09'), 'דיווח ממונה'],
  ['נ-1', d('2026-09-23'), 8, 'חומר גלם', 'רחבה', 'פנס', 'בינונית', 'מנהל המחלקה', 'להחליף <b> (סיור נאמן: מוסא)', d('2026-09-26'), 'פתוח', null, 'דיווח נאמן: מוסא'],
  [10, d('2026-09-22'), 10, 'מעצבים', 'כניסה', 'ג\'ריקן', 'בינונית', 'מנהל המחלקה + חשמל', '', null, 'פתוח', null, ''],
];

(async () => {
  console.log('\n1. who gets it');
  const rc = parseRecipients(RCPT_ROWS);
  check('department managers, several addresses in one cell', rc.depts['חומר גלם'].join() === 'gelem@tapugan.co.il,Igal@tapugan.co.il' && Object.keys(rc.depts).length === 5, rc.depts);
  check('responsible parties by the start of the label (הנדסה row = שלומי)', rc.resp['אחזקה'][0] === 'vitaly@tapugan.co.il' && rc.resp['חשמל'][0] === 'tech_manager@tapugan.co.il' && rc.resp['הנדסה'][0] === 'shlomi@tapugan.co.il', rc.resp);
  check('copies: part 3; header and note rows ignored', rc.cc.join() === 'sviva@tapugan.co.il,tzachi@tapugan.co.il', rc.cc);
  const texts = { open: 'שלום, להלן המפגעים.', sign: 'בברכה, ממונה בטיחות' };
  const g = buildReport('חומר גלם', ROWS, rc, texts);
  check('חומר גלם: אל exactly as the macro put it (managers, אחזקה, שלומי)', g.to.join() === 'gelem@tapugan.co.il,Igal@tapugan.co.il,vitaly@tapugan.co.il,shlomi@tapugan.co.il', g.to);
  check('עותק sviva + tzachi', g.cc.join() === 'sviva@tapugan.co.il,tzachi@tapugan.co.il', g.cc);
  check('a closed hazard is not in the report, and its חשמל does not add a recipient', g.count === 3 && !g.rows.some((r) => r.n === 34) && !g.to.includes('tech_manager@tapugan.co.il'), g.rows.map((r) => r.n));
  check('from an earlier tour: "<status> - מסיור קודם!", highlighted; latest tour not', g.rows[0].status === 'בטיפול - מסיור קודם!' && g.rows[0].old && !g.rows[1].old && g.old === 1, g.rows.map((r) => r.status));
  check('the mail: title, opening and closing lines from the sheet, dates DD/MM/YYYY, text escaped', /דוח מפגעים פתוחים לטיפול - מחלקת חומר גלם/.test(g.html) && g.html.includes('שלום, להלן המפגעים.') && g.html.includes('בברכה, ממונה בטיחות') && g.html.includes('31/08/2026') && g.html.includes('&lt;b&gt;') && !g.html.includes('<b>'), g.html.slice(0, 200));
  check('keyboard characters only in what the server writes (no long dash, no arrows)', !/[—–־←-⇿«»“”…]/.test(g.html.replace(/שלום, להלן המפגעים\.|בברכה, ממונה בטיחות/g, '')));
  const m = buildReport('מעצבים', ROWS, rc, texts);
  check('shared "מנהל המחלקה + חשמל": חשמל and שלומי added once', m.to.join() === 'Roman@tapugan.co.il,tech_manager@tapugan.co.il,shlomi@tapugan.co.il', m.to);
  const t = buildReport('תוצג', ROWS, rc, texts);
  check('nothing open: count 0', t.count === 0 && t.to.join() === 'Igal@tapugan.co.il', t);
  check('the same address in אל is not repeated in עותק', buildReport('חומר גלם', ROWS, { depts: { 'חומר גלם': ['sviva@tapugan.co.il'] }, resp: {}, cc: ['SVIVA@tapugan.co.il', 'x@y.co'] }, texts).cc.join() === 'x@y.co');

  console.log('\n2. the endpoint');
  const book = await writeZip([
    { name: 'xl/workbook.xml', text: '<workbook xmlns:r="r"><sheets><sheet name="דוח לשליחה" sheetId="1" r:id="rId1"/><sheet name="נמענים" sheetId="2" r:id="rId2"/></sheets></workbook>' },
    { name: 'xl/_rels/workbook.xml.rels', text: '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/></Relationships>' },
    { name: 'xl/worksheets/sheet1.xml', text: '<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>כותרת</t></is></c><c r="L1" t="inlineStr"><is><t>פתיחה מהקובץ</t></is></c></row><row r="2"><c r="L2" t="inlineStr"><is><t>חתימה מהקובץ</t></is></c></row></sheetData></worksheet>' },
    { name: 'xl/worksheets/sheet2.xml', text: '<worksheet><sheetData>' + RCPT_ROWS.map((x) => '<row r="' + x.r + '">' + x.v.map((c, i) => '<c r="' + 'ABC'[i] + x.r + '" t="inlineStr"><is><t>' + c.replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '</t></is></c>').join('') + '</row>').join('') + '</sheetData></worksheet>' },
  ]);
  const HZ = [
    { id: 'h31', n: 31, d: '2026-08-17', tour_no: 6, dept: 'חומר גלם', loc: 'מתקן', descr: 'מתקן', sev: 'בינונית', resp: 'אחזקה', due: '2026-08-31', s: 'בטיפול' },
    { id: 'h33', n: 33, d: '2026-09-07', tour_no: 8, dept: 'חומר גלם', loc: 'רצפות', descr: 'רצפות', sev: 'בינונית', resp: 'הנדסה', due: '2026-10-07', s: 'בטיפול' },
  ];
  function world(o) {
    const w = { mails: [], state: {} };
    globalThis.fetch = async (url, init) => {
      const u = String(url), mth = (init && init.method) || 'GET';
      const json = (x, st = 200) => new Response(JSON.stringify(x), { status: st, headers: { 'Content-Type': 'application/json' } });
      if (u.startsWith(SB + '/auth/v1/user')) return json(o.email ? { id: 'u1', email: o.email, is_anonymous: false } : { id: 'a', is_anonymous: true });
      if (u.startsWith(SB + '/rest/v1/app_users')) return json(o.row ? [o.row] : []);
      if (u.startsWith(SB + '/rest/v1/oauth_tokens')) return json([{ user_email: 'sviva@tapugan.co.il', refresh_token: 'rt', access_token: 'at', expires_at: new Date(Date.now() + 3600e3).toISOString(), scope: o.scope || 'Files.ReadWrite Mail.Send' }]);
      if (u.startsWith(SB + '/rest/v1/tour_hazards')) return json(HZ);
      if (u.startsWith(SB + '/rest/v1/trustee_reports')) return json([]);
      if (u.startsWith(SB + '/rest/v1/server_state')) { if (mth === 'POST') JSON.parse(init.body).forEach((r) => { w.state[r.key] = r.value; }); return new Response(null, { status: 201 }); }
      if (u.startsWith('https://graph.microsoft.com/v1.0/me/sendMail')) { w.mails.push(JSON.parse(init.body)); return new Response(null, { status: o.mailFail ? 500 : 202 }); }
      if (u.startsWith('https://graph.microsoft.com/') && mth === 'GET') { w.read = decodeURIComponent(u); return new Response(book, { status: 200 }); }
      return json({ error: 'unexpected ' + u }, 599);
    };
    return w;
  }
  const call = async (o, body) => {
    const w = world(o);
    const r = await onRequest({ request: new Request('https://tapugan-safety.pages.dev/api/hazard-report', { method: 'POST', headers: { authorization: 'Bearer tok', 'content-type': 'application/json' }, body: JSON.stringify(body || {}) }), env: ENV });
    let j = null; try { j = await r.json(); } catch (e) {}
    return { status: r.status, j, w };
  };
  let c = await call({ email: null }, { op: 'preview' });
  check('anonymous: refused', c.status === 401 || c.status === 403, c.status);
  c = await call({ email: 'qwer@tfugen.local', row: { role: 'צופה', active: true } }, { op: 'send', depts: ['חומר גלם'] });
  check('viewer: refused, nothing sent', c.status === 403 && !c.w.mails.length, c);
  c = await call({ email: 'admin@tfugen.local' }, { op: 'preview' });
  const pg = c.j && c.j.reports && c.j.reports.find((x) => x.dept === 'חומר גלם');
  check('preview: 5 departments, recipients from the workbook, nothing sent', c.j.ok && c.j.reports.length === 5 && pg.count === 2 && pg.to.join() === 'gelem@tapugan.co.il,Igal@tapugan.co.il,vitaly@tapugan.co.il,shlomi@tapugan.co.il' && !c.w.mails.length && c.j.canSend, c.j);
  check('reads the folder-13 xlsm', /13_סיורי מפגעים\/2026\/ניהול סיורי מפגעים\.xlsm:\/content/.test(c.w.read || ''), c.w.read);
  c = await call({ email: 'admin@tfugen.local' }, { op: 'send', depts: ['חומר גלם', 'תוצג'] });
  const mail = c.w.mails[0] && c.w.mails[0].message;
  check('send: one mail per department asked, empty department skipped', c.j.ok && c.w.mails.length === 1 && c.j.sent[0].dept === 'חומר גלם' && c.j.skipped[0].dept === 'תוצג', c.j);
  check('the mail: אל + עותק, subject, the sheet\'s own opening and closing, kept in Sent Items', mail && mail.toRecipients.length === 4 && mail.ccRecipients.map((x) => x.emailAddress.address).join() === 'sviva@tapugan.co.il,tzachi@tapugan.co.il' && mail.subject === 'דוח מפגעים פתוחים לטיפול - מחלקת חומר גלם' && mail.body.content.includes('פתיחה מהקובץ') && mail.body.content.includes('חתימה מהקובץ') && c.w.mails[0].saveToSentItems === true, mail && mail.subject);
  check('the send is logged', /חומר גלם/.test(c.w.state.hazard_report_last || ''), c.w.state);
  c = await call({ email: 'admin@tfugen.local', scope: 'Files.ReadWrite' }, { op: 'send', depts: ['חומר גלם'] });
  check('no Mail.Send permission: a clear error, nothing sent', !c.j.ok && /Mail\.Send/.test(c.j.error) && !c.w.mails.length, c.j);
  c = await call({ email: 'admin@tfugen.local', mailFail: true }, { op: 'send', depts: ['חומר גלם'] });
  check('Outlook refuses: reported per department', !c.j.ok && c.j.failed.length === 1 && /outlook 500/.test(c.j.failed[0].error), c.j);

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
