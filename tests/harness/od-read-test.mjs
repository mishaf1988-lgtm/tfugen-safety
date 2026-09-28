// od-read (28/09): read one sheet of a workbook in the safety folder, server
// to server, read-only. Graph mocked; the workbook is built by writeZip.
import { onRequest, safePath } from './_build/od-read.mjs';
import { writeZip } from './_build/_xlsxpatch.mjs';

let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 300) : '')); } };
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'srv', ONEDRIVE_CLIENT_ID: 'cid', ONEDRIVE_CLIENT_SECRET: 'cs', TRUSTEE_NOTIFY_SECRET: 'nsec' };

(async () => {
  const book = await writeZip([
    { name: 'xl/workbook.xml', text: '<workbook xmlns:r="r"><sheets><sheet name="נמענים" sheetId="1" r:id="rId1"/><sheet name="אחר &amp; עוד" sheetId="2" r:id="rId2"/></sheets></workbook>' },
    { name: 'xl/_rels/workbook.xml.rels', text: '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/></Relationships>' },
    { name: 'xl/sharedStrings.xml', text: '<sst><si><t>מחלקה</t></si><si><r><t>מייל</t></r><r><t> ראשי</t></r></si><si><t>a@b.co</t></si></sst>' },
    { name: 'xl/worksheets/sheet1.xml', text: '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>תוצג</t></is></c><c r="B2" t="s"><v>2</v></c><c r="C2"><v>46293</v></c></row></sheetData></worksheet>' },
    { name: 'xl/worksheets/sheet2.xml', text: '<worksheet><sheetData/></worksheet>' },
  ]);
  const calls = [];
  globalThis.fetch = async (url, init) => {
    const u = String(url); calls.push(decodeURIComponent(u));
    const json = (x, st = 200) => new Response(JSON.stringify(x), { status: st, headers: { 'Content-Type': 'application/json' } });
    if (u.startsWith(SB + '/rest/v1/oauth_tokens')) return json([{ user_email: 'sviva@tapugan.co.il', refresh_token: 'rt', access_token: 'at', expires_at: new Date(Date.now() + 3600e3).toISOString(), scope: 'Files.ReadWrite' }]);
    if (u.startsWith('https://graph.microsoft.com/') && (!init || !init.method || init.method === 'GET')) return new Response(book, { status: 200 });
    return json({ error: 'unexpected ' + u }, 599);
  };
  const req = (h, b) => new Request('https://tapugan-safety.pages.dev/api/od-read', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, h || {}), body: JSON.stringify(b || {}) });
  const S = { 'x-notify-secret': 'nsec' };

  let res = await onRequest({ request: req({}, { path: '13_סיורי מפגעים/2026/x.xlsm' }), env: ENV });
  check('no secret: 403, OneDrive not touched', res.status === 403 && !calls.length);
  res = await onRequest({ request: req({ 'x-notify-secret': 'x' }, { path: 'a.xlsx' }), env: { ...ENV, TRUSTEE_NOTIFY_SECRET: '' } });
  check('secret not configured: still 403', res.status === 403);
  check('paths cannot leave the safety folder, only workbooks', safePath('../../x.xlsx') === null && safePath('a/./b.xlsx') === null && safePath('a.docx') === null && safePath('12/t.xlsx') === 'שולחן העבודה/ניהול בטיחות/12/t.xlsx');
  res = await onRequest({ request: req(S, { path: '../secret.xlsx' }), env: ENV });
  check('a bad path: 400', res.status === 400);
  res = await onRequest({ request: req(S, { path: '13_סיורי מפגעים/2026/ניהול.xlsm' }), env: ENV });
  let j = await res.json();
  check('without a sheet: the tab names', j.ok && j.sheets.join('|') === 'נמענים|אחר & עוד', j);
  check('read from inside the safety folder, content only (GET)', calls.some((c) => c.includes('/root:/שולחן העבודה/ניהול בטיחות/13_סיורי מפגעים/2026/ניהול.xlsm:/content')));
  res = await onRequest({ request: req(S, { path: '13_סיורי מפגעים/2026/ניהול.xlsm', sheet: 'נמענים' }), env: ENV });
  j = await res.json();
  check('a sheet: from row 1, shared strings (rich text too), inline text, numbers', j.ok && j.rows.length === 2 && j.rows[0].v[1] === 'מייל ראשי' && j.rows[1].v[0] === 'תוצג' && j.rows[1].v[1] === 'a@b.co' && j.rows[1].v[2] === 46293, j.rows);

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
