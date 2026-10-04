// od-read (28/09): read one sheet of a workbook in the safety folder, server
// to server, read-only. Graph mocked; the workbook is built by writeZip.
import { onRequest, safePath, safeDir } from './_build/od-read.mjs';
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

  const deck = await writeZip([
    { name: 'ppt/presentation.xml', text: '<p:presentation><p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst></p:presentation>' },
    { name: 'ppt/_rels/presentation.xml.rels', text: '<Relationships><Relationship Id="rId2" Type="s" Target="slides/slide1.xml"/></Relationships>' },
    { name: 'ppt/slides/slide1.xml', text: '<p:sld><p:sp><p:nvSpPr><p:cNvPr id="2" name="כותרת 1"/></p:nvSpPr><p:txBody><a:p><a:r><a:t>21 ימים</a:t></a:r><a:r><a:t> ללא תאונה</a:t></a:r></a:p></p:txBody></p:sp><p:graphicFrame><a:graphic><a:graphicData><c:chart r:id="rId3"/></a:graphicData></a:graphic></p:graphicFrame></p:sld>' },
    { name: 'ppt/slides/_rels/slide1.xml.rels', text: '<Relationships><Relationship Id="rId3" Target="../charts/chart1.xml"/></Relationships>' },
    { name: 'ppt/charts/chart1.xml', text: '<c:chartSpace><c:chart><c:plotArea><c:barChart><c:ser><c:tx><c:strRef><c:strCache><c:pt idx="0"><c:v>נסגרו</c:v></c:pt></c:strCache></c:strRef></c:tx><c:cat><c:strRef><c:strCache><c:pt idx="0"><c:v>מעצבים</c:v></c:pt><c:pt idx="1"><c:v>תוצג</c:v></c:pt></c:strCache></c:strRef></c:cat><c:val><c:numRef><c:f>Sheet1!$B$2:$B$3</c:f><c:numCache><c:pt idx="0"><c:v>4</c:v></c:pt><c:pt idx="1"><c:v>5</c:v></c:pt></c:numCache></c:numRef></c:val></c:ser></c:barChart></c:plotArea></c:chart><c:externalData r:id="rId1"/></c:chartSpace>' },
    { name: 'ppt/charts/_rels/chart1.xml.rels', text: '<Relationships><Relationship Id="rId1" Target="../embeddings/Microsoft_Excel_Worksheet.xlsx"/></Relationships>' },
  ]);
  globalThis.fetch = async (url) => (String(url).startsWith(SB) ? new Response(JSON.stringify([{ user_email: 'sviva@tapugan.co.il', refresh_token: 'rt', access_token: 'at', expires_at: new Date(Date.now() + 3600e3).toISOString(), scope: 'Files.ReadWrite' }]), { status: 200 }) : new Response(deck, { status: 200 }));
  res = await onRequest({ request: req(S, { path: '13_סיורי מפגעים/2026/מצגת שבועית.חודשית.pptx' }), env: ENV });
  j = await res.json();
  const sl = j.deck && j.deck.slides[0];
  check('a .pptx: slides, shape text, chart series with categories and values, the embedded workbook', j.ok && sl && sl.shapes[0].name === 'כותרת 1' && sl.shapes[0].text[0] === '21 ימים ללא תאונה' && sl.charts[0].kinds[0] === 'bar' && sl.charts[0].series[0].name === 'נסגרו' && sl.charts[0].series[0].cats.join() === 'מעצבים,תוצג' && sl.charts[0].series[0].vals.join() === '4,5' && sl.charts[0].series[0].ref === 'Sheet1!$B$2:$B$3' && sl.charts[0].embedded === 'ppt/embeddings/Microsoft_Excel_Worksheet.xlsx', j);
  res = await onRequest({ request: req(S, { path: '13_סיורי מפגעים/2026/מצגת שבועית.חודשית.pptx', part: 'ppt/charts/chart1.xml' }), env: ENV });
  j = await res.json();
  check('one xml part as text', j.ok && j.part === 'ppt/charts/chart1.xml' && /<c:barChart>/.test(j.text) && j.length === j.text.length, j);
  res = await onRequest({ request: req(S, { path: '13_סיורי מפגעים/2026/מצגת שבועית.חודשית.pptx', part: 'ppt/media/image1.png' }), env: ENV });
  j = await res.json();
  check('a part that is not xml: refused', !j.ok, j);
  const TOK = 'a'.repeat(40);
  const rawWorld = (state) => { globalThis.fetch = async (url, init) => { const u = String(url); if (u.startsWith(SB + '/rest/v1/server_state')) return new Response(JSON.stringify(Object.keys(state).map((k) => ({ key: k, value: state[k] }))), { status: 200 }); if (u.startsWith(SB)) return new Response(JSON.stringify([{ user_email: 'sviva@tapugan.co.il', refresh_token: 'rt', access_token: 'at', expires_at: new Date(Date.now() + 3600e3).toISOString(), scope: 'Files.ReadWrite' }]), { status: 200 }); return new Response(deck, { status: 200 }); }; };
  rawWorld({ od_raw_token: TOK, od_raw_exp: new Date(Date.now() + 600e3).toISOString() });
  res = await onRequest({ request: req({ 'x-raw-token': TOK }, { path: '13_סיורי מפגעים/2026/מצגת שבועית.חודשית.pptx', raw: true }), env: ENV });
  const rawBytes = new Uint8Array(await res.arrayBuffer());
  check('raw download with a valid one-off token: the file bytes', res.status === 200 && rawBytes.length === deck.length, [res.status, rawBytes.length]);
  res = await onRequest({ request: req({ 'x-raw-token': TOK }, { path: '13_סיורי מפגעים/2026/מצגת שבועית.חודשית.pptx' }), env: ENV });
  check('the token opens only the raw download, not the other reads', res.status === 403);
  rawWorld({ od_raw_token: TOK, od_raw_exp: new Date(Date.now() - 1000).toISOString() });
  res = await onRequest({ request: req({ 'x-raw-token': TOK }, { path: '13_סיורי מפגעים/2026/מצגת שבועית.חודשית.pptx', raw: true }), env: ENV });
  check('an expired token: refused', res.status === 403);
  rawWorld({ od_raw_token: TOK, od_raw_exp: new Date(Date.now() + 600e3).toISOString() });
  res = await onRequest({ request: req({ 'x-raw-token': 'b'.repeat(40) }, { path: '13_סיורי מפגעים/2026/מצגת שבועית.חודשית.pptx', raw: true }), env: ENV });
  check('a wrong token: refused', res.status === 403);
  rawWorld({ od_raw_token: TOK, od_raw_exp: new Date(Date.now() + 600e3).toISOString() });
  let seen = [];
  { const f0 = globalThis.fetch; globalThis.fetch = async (url, init) => { seen.push(decodeURIComponent(String(url))); return f0(url, init); }; }
  res = await onRequest({ request: req({ 'x-raw-token': TOK }, { uploadLog: true, raw: true }), env: ENV });
  check('upload log: the one fixed file outside the folder, with a raw token', res.status === 200 && seen.some((u) => u.endsWith('/root:/שולחן העבודה/סקילים להעלאה/יומן.txt:/content')), seen);
  res = await onRequest({ request: req(S, { uploadLog: true }), env: ENV });
  check('upload log with the server secret alone: refused (raw token only)', res.status === 400, res.status);
  res = await onRequest({ request: req({ 'x-raw-token': TOK }, { path: '../סקילים להעלאה/יומן.txt', raw: true }), env: ENV });
  check('a path out of the folder is still refused', res.status === 400, res.status);
  rawWorld({});
  res = await onRequest({ request: req({ 'x-raw-token': '' }, { path: 'x.pptx', raw: true }), env: ENV });
  check('no token stored: refused (never open by default)', res.status === 403);
  check('other file types still refused', safePath('a/b.docx') === null && !!safePath('a/b.pptx'));

  // Scan (04/10/2026): the listing and the raw download of documents.
  check('raw may fetch documents, the parsed reads still only workbooks', !!safePath('a/b.pdf', true) && !!safePath('a/b.docx', true) && safePath('a/b.pdf') === null && safePath('a/b.exe', true) === null && safePath('../b.pdf', true) === null);
  check('a folder stays inside the safety folder', safeDir('') === 'שולחן העבודה/ניהול בטיחות' && safeDir('12/א') === 'שולחן העבודה/ניהול בטיחות/12/א' && safeDir('../x') === null && safeDir('a/./b') === null);
  const listed = [];
  const listWorld = (state) => { globalThis.fetch = async (url) => { const u = String(url); listed.push(decodeURIComponent(u)); if (u.startsWith(SB + '/rest/v1/server_state')) return new Response(JSON.stringify(Object.keys(state).map((k) => ({ key: k, value: state[k] }))), { status: 200 }); if (u.startsWith(SB)) return new Response(JSON.stringify([{ user_email: 'sviva@tapugan.co.il', refresh_token: 'rt', access_token: 'at', expires_at: new Date(Date.now() + 3600e3).toISOString(), scope: 'Files.ReadWrite' }]), { status: 200 }); if (u.includes('page2')) return new Response(JSON.stringify({ value: [{ name: 'היתר רעלים.pdf', size: 9, file: {} }] }), { status: 200 }); return new Response(JSON.stringify({ value: [{ name: '05_רישוי', folder: { childCount: 3 } }, { name: 'רישיון עסק.docx', size: 5, file: {} }], '@odata.nextLink': 'https://graph.microsoft.com/v1.0/page2' }), { status: 200 }); }; };
  listWorld({ od_raw_token: TOK, od_raw_exp: new Date(Date.now() + 600e3).toISOString() });
  res = await onRequest({ request: req({ 'x-raw-token': TOK }, { list: '' }), env: ENV });
  j = await res.json();
  check('a listing with the one-off token: folders and files, every page', j.ok && j.items.length === 3 && j.items[0].dir && j.items[0].n === 3 && j.items[1].name === 'רישיון עסק.docx' && !j.items[1].dir && j.items[2].name === 'היתר רעלים.pdf', j);
  check('the listing reads the safety folder only (children, GET)', listed.some((c) => c.includes('/root:/שולחן העבודה/ניהול בטיחות:/children')));
  res = await onRequest({ request: req({}, { list: '' }), env: ENV });
  check('a listing with no token or secret: 403', res.status === 403);
  res = await onRequest({ request: req({ 'x-raw-token': TOK }, { list: '../..' }), env: ENV });
  check('a listing above the safety folder: 400', res.status === 400);
  listWorld({ od_raw_token: TOK, od_raw_exp: new Date(Date.now() - 1000).toISOString() });
  res = await onRequest({ request: req({ 'x-raw-token': TOK }, { list: '' }), env: ENV });
  check('a listing with an expired token: 403', res.status === 403);

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
