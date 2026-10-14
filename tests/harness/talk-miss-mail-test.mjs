// Who did not sign the annual / quality training, to the department managers (14/10/2026, Michael in the
// questionnaire: "בצע: מי לא חתם למנהלים"). talk.js op missMail: the workers who did not sign, by the
// department of the department report (packing with production), to that department's managers in the
// recipients sheet of the hazard workbook; a preview sends nothing, a test goes to the connected account
// only, and a closed, weekly or unpublished training is refused.
import { onRequest, missingByDept, missMailHtml, TBT_REPORT, TBT_DEPTS } from './_build/talk.mjs';
import { REPORT_DEPTS } from './_build/hazard-file.mjs';
import { writeZip } from './_build/_xlsxpatch.mjs';
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 400) : '')); } };
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const URL0 = 'https://tapugan-safety.pages.dev/api/talk';
const GR = 'https://graph.' + 'microsoft.com/v1.0/';
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'srv', TRUSTEE_NOTIFY_SECRET: 'nsec', GEMINI_API_KEY: 'g' };
const R = (r, ...v) => ({ r, v });
const RCPT = [
  R(3, '1. מנהלי מחלקות (נמען ראשי - אל)'), R(4, 'מחלקת סיור', 'שם מנהל', 'כתובת מייל (אל)'),
  R(5, 'מעצבים', 'רומן', 'Roman@tapugan.co.il'), R(6, 'ייצור טוגנים', 'נועם', 'prod@tapugan.co.il'),
  R(9, 'מעבדות', 'מורן', 'Moran@tapugan.co.il'),
  R(19, '3. נמענים קבועים (עותק - בכל מייל)'), R(21, 'ממונה בטיחות (אתה)', 'sviva@tapugan.co.il'),
];
const xe = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const BOOK = await writeZip([
  { name: 'xl/workbook.xml', text: '<workbook xmlns:r="r"><sheets><sheet name="נמענים" sheetId="1" r:id="rId1"/></sheets></workbook>' },
  { name: 'xl/_rels/workbook.xml.rels', text: '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>' },
  { name: 'xl/worksheets/sheet1.xml', text: '<worksheet><sheetData>' + RCPT.map((x) => '<row r="' + x.r + '">' + x.v.map((c, i) => '<c r="' + 'ABC'[i] + x.r + '" t="inlineStr"><is><t>' + xe(c) + '</t></is></c>').join('') + '</row>').join('') + '</sheetData></worksheet>' },
]);
const T = {
  ann: { id: 'an1', d: '2026-10-20', title: 'הדרכה שנתית 2026', s: 'פורסמה', kind: 'annual', link_v: 3, trainer_signed_at: 'x', subjects: 'כיבוי אש' },
  cl: { id: 'cl1', d: '2026-10-20', title: 'סגורה', s: 'פורסמה', kind: 'annual', link_v: 0, closed_at: '2026-10-21T08:00:00Z' },
  dr: { id: 'dr1', d: '2026-10-20', title: 'טיוטה', s: 'טיוטה', kind: 'quality', link_v: 0 },
  wk: { id: 'wk1', d: '2026-10-11', title: 'שבועית', s: 'פורסמה', kind: null, link_v: 0 },
};
const EMPS = [
  { id: 'e1', n: 'אחמד', dep: 'יצור', eid: '1111111' },
  { id: 'e2', n: 'בוריס', dep: 'אריזה', eid: '2222222' },
  { id: 'e3', n: 'גיל', dep: 'טבע (מעצבים)', eid: '3333333' },
  { id: 'e4', n: 'דנה', dep: 'מעבדה', eid: '4444444' },
  { id: 'e5', n: 'הדר', dep: 'הנהלה', eid: '5555555' },
  { id: 'e6', n: 'ורד', dep: 'יצור', eid: '6666666', left_d: '2026-01-01' },
  { id: 'e7', n: 'זיו', dep: 'חומרי גלם', eid: '7777777' },
];
// גיל signed with his ID typed with a dash; דנה did not sign; nobody from חומר גלם has a manager in the sheet
const READS = [{ emp_id: 'x:גיל', id_no: '333-3333' }];
const w = { mails: [] };
globalThis.fetch = async (url, init) => {
  const u = String(url), m = (init && init.method) || 'GET';
  const json = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { 'Content-Type': 'application/json' } });
  if (u.startsWith(SB + '/rest/v1/toolbox_talks')) { const id = decodeURIComponent((u.match(/id=eq\.([^&]+)/) || [])[1] || ''); return json(Object.values(T).filter((t) => t.id === id).map((t) => ({ ...t }))); }
  if (u.startsWith(SB + '/rest/v1/emp')) return json(EMPS);
  if (u.startsWith(SB + '/rest/v1/toolbox_reads')) return json(READS);
  if (u.startsWith(SB + '/rest/v1/server_state') || u.startsWith(SB + '/rest/v1/rpc/')) return json([]);
  if (u === SB + '/auth/v1/user') { const tok = init.headers.Authorization.replace('Bearer ', ''); return tok === 'good' ? json({ id: 'u1', email: 'michael@tfugen.local' }) : json({ id: 'u2', email: 'rep@tfugen.local' }); }
  if (u.startsWith(SB + '/rest/v1/app_users')) return json([u.includes('michael') ? { role: 'מנהל', active: true } : { role: 'צופה', active: true }]);
  if (u.startsWith(SB + '/rest/v1/oauth_tokens')) return json([{ user_email: 'sviva@tapugan.co.il', refresh_token: 'rt', access_token: 'at', expires_at: new Date(Date.now() + 3600e3).toISOString(), scope: 'Files.ReadWrite Mail.Send' }]);
  if (u.startsWith(GR + 'me/sendMail')) { w.mails.push(JSON.parse(init.body)); return new Response(null, { status: 202 }); }
  if (u.startsWith(GR) && u.includes('.xlsm:/content')) { w.book = decodeURIComponent(u); return new Response(BOOK, { status: 200 }); }
  return json({ error: 'unexpected ' + u }, 599);
};
const post = async (body, auth) => { const r = await onRequest({ request: new Request(URL0, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json', Origin: 'https://tapugan-safety.pages.dev', ...(auth ? { Authorization: 'Bearer ' + auth } : {}) } }), env: ENV }); let j = null; try { j = await r.json(); } catch (e) { j = null; } return { st: r.status, j }; };

console.log('\n1. the map and the list');
check('every training department maps to a department of the department report', TBT_DEPTS.every((x) => REPORT_DEPTS.indexOf(TBT_REPORT[x[0]]) >= 0), TBT_REPORT);
check('packing goes with production (AREA_DEPT, 29/09/2026)', TBT_REPORT['אריזה'] === 'ייצור טוגנים' && TBT_REPORT['טוגנים'] === 'ייצור טוגנים');
const mb = missingByDept(T.ann, EMPS, READS, '2026-10-22');
check('production: the packer and the production worker; not the one who left', (mb.groups['ייצור טוגנים'] || []).map((x) => x.n).join() === 'אחמד,בוריס', mb.groups);
check('signed by the typed ID (dashes ignored): not on the list', !mb.groups['מעצבים'], mb.groups);
check('a worker in no training department: listed apart', mb.noDept.map((x) => x.n).join() === 'הדר', mb.noDept);
const html = missMailHtml(T.ann, 'מעבדות', [{ n: '<b>דנה</b>', dep: 'מעבדה' }], 'https://x/k');
check('the mail: kind, title, date, department, escaped names, the link', html.includes('הדרכה שנתית') && html.includes('20/10/2026') && html.includes('מעבדות') && html.includes('&lt;b&gt;') && html.includes('href="https://x/k"'));
check('the mail text has no long dash, Hebrew maqaf or guillemets', !/[—–־«»]/.test(html));

console.log('\n2. the endpoint');
let r = await post({ op: 'missMail', id: 'an1', preview: true }, 'rep');
check('a viewer is refused', r.st === 403, r.st);
r = await post({ op: 'missMail', id: 'an1', preview: true }, 'good');
const pl = (r.j && r.j.plan) || [];
const byD = Object.fromEntries(pl.map((p) => [p.dept, p]));
check('preview: one row per department with someone missing, nothing sent', r.st === 200 && r.j.preview && pl.map((p) => p.dept).join() === 'ייצור טוגנים,חומר גלם,מעבדות' && !w.mails.length, pl);
check('...the department managers from the recipients sheet, the copy row too', byD['ייצור טוגנים'].to.join() === 'prod@tapugan.co.il' && byD['מעבדות'].to.join() === 'Moran@tapugan.co.il' && byD['מעבדות'].cc.join() === 'sviva@tapugan.co.il', byD);
check('...a department with no manager in the sheet shows no recipient', byD['חומר גלם'] && byD['חומר גלם'].to.length === 0, byD['חומר גלם']);
check('...the worker with no department listed', (r.j.noDept || []).join() === 'הדר (הנהלה)', r.j.noDept);
check('...read from the hazard workbook', /13_סיורי מפגעים\/\d{4}\/ניהול סיורי מפגעים\.xlsm:\/content/.test(w.book || ''), w.book);
r = await post({ op: 'missMail', id: 'an1', test: true }, 'good');
check('test: every department to the connected account only, marked as a test, no copy', r.st === 200 && r.j.sent.length === 3 && w.mails.length === 3 && w.mails.every((x) => x.message.toRecipients.map((y) => y.emailAddress.address).join() === 'sviva@tapugan.co.il' && !(x.message.ccRecipients || []).length && /^בדיקה - /.test(x.message.subject)), w.mails.map((x) => x.message.subject));
check('...the test mail says who would get it', w.mails[0].message.body.content.includes('prod@tapugan.co.il'));
w.mails = [];
r = await post({ op: 'missMail', id: 'an1' }, 'good');
const to = w.mails.map((x) => x.message.toRecipients.map((y) => y.emailAddress.address).join());
check('send: to each department\'s managers, with the copy row; a department with no manager is skipped', r.st === 200 && r.j.sent.map((x) => x.dept).join() === 'ייצור טוגנים,מעבדות' && r.j.skipped.map((x) => x.dept).join() === 'חומר גלם' && to.join('|') === 'prod@tapugan.co.il|Moran@tapugan.co.il' && w.mails.every((x) => x.message.ccRecipients.map((y) => y.emailAddress.address).join() === 'sviva@tapugan.co.il'), { j: r.j, to });
check('...not kept in Sent Items, the names and a working link in the body', w.mails.every((x) => x.saveToSentItems === false) && /אחמד[\s\S]*בוריס/.test(w.mails[0].message.body.content) && /\/api\/talk\?k=/.test(w.mails[0].message.body.content));
r = await post({ op: 'missMail', id: 'an1', depts: ['מעבדות'], preview: true }, 'good');
check('depts: only the ones asked for', r.j.plan.map((p) => p.dept).join() === 'מעבדות', r.j.plan);
w.mails = [];
for (const [id, er] of [['cl1', 'closed'], ['dr1', 'not published'], ['wk1', 'not an annual / quality training']]) {
  r = await post({ op: 'missMail', id }, 'good');
  check('refused: ' + er, r.st === 409 && r.j.error === er && !w.mails.length, r);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
