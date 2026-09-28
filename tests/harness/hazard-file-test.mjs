// The folder-13 workbook (28/09): the server rewrites the register rows of the
// EXISTING xlsm and must leave everything else alone. Builds a small workbook
// shaped like the real one (a report sheet with a formula, the register with
// formula columns N/O, a hidden row and a filter, calcChain, a "macro"), runs
// the real hazard-file.js with Graph and Supabase mocked, and reads the result.
import { onRequest, runFile, buildRows, trusteeDept, diffEdits, buildRegister } from './_build/hazard-file.mjs';
import { cleanAction } from './_build/_ai.mjs';
import { readZip, writeZip, entryText, serial, patchSheetRows, readSheetRows } from './_build/_xlsxpatch.mjs';

let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 400) : '')); } };
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'srv', ONEDRIVE_CLIENT_ID: 'cid', ONEDRIVE_CLIENT_SECRET: 'cs', TRUSTEE_NOTIFY_SECRET: 'nsec' };

async function deflate(u8) {
  const s = new Blob([u8]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}
function crc(buf) { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) { c ^= buf[i]; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; } return (c ^ 0xFFFFFFFF) >>> 0; }
const VBA = new Uint8Array(3000).map((_, i) => (i * 37) % 251);
const reg = (rows) => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr codeName="x" filterMode="1"/><sheetData>'
  + '<row r="1"><c r="A1" t="inlineStr"><is><t>מס"ד</t></is></c><c r="N1" t="inlineStr"><is><t>חדש/ישן</t></is></c></row>' + rows
  + '</sheetData><autoFilter ref="A1:M8"><filterColumn colId="3"><filters><filter val="מעצבים"/></filters></filterColumn></autoFilter>'
  + '<dataValidations count="1"><dataValidation type="list" sqref="G2:G8"><formula1>"גבוהה,בינונית,נמוכה"</formula1></dataValidation></dataValidations></worksheet>';
const N = (r) => '<c r="N' + r + '" t="str"><f t="array" ref="N' + r + '">IF($A' + r + '="","","x")</f><v>x</v></c><c r="O' + r + '"><f>ROW()</f><v>' + r + '</v></c>';
function regRows() {
  let x = '<row r="2"><c r="A2" s="3"><v>1</v></c><c r="B2" s="10"/><c r="D2" s="8" t="inlineStr"><is><t>ישן</t></is></c><c r="J2" s="14"><v>46181</v></c><c r="K2" s="3"/><c r="L2" s="3"/>' + N(2) + '</row>';
  x += '<row r="3" hidden="1"><c r="A3" s="3"><f>A2+1</f><v>2</v></c><c r="B3" s="24"><v>46287</v></c><c r="L3" s="24"><v>46290</v></c>' + N(3) + '</row>';
  for (let r = 4; r <= 8; r++) x += '<row r="' + r + '"' + (r === 5 ? ' hidden="1"' : '') + '><c r="A' + r + '" s="3"/><c r="B' + r + '" s="3"/><c r="J' + r + '" s="8"/>' + N(r) + '</row>';
  return x;
}
async function fixture() {
  const t = (name, text) => ({ name, text });
  const vbaZ = await deflate(VBA);
  const sheet1 = '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1"><f>COUNTIF(\'מאגר מפגעים\'!$K$2:$K$8,"פתוח")</f><v>0</v></c></row></sheetData></worksheet>';
  return writeZip([
    t('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/xl/calcChain.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.calcChain+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="x"/></Types>'),
    t('_rels/.rels', '<Relationships/>'),
    t('xl/workbook.xml', '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="דוח מרכז" sheetId="1" r:id="rId1"/><sheet name="מאגר מפגעים" sheetId="3" r:id="rId2"/></sheets><calcPr calcId="191029"/></workbook>'),
    t('xl/_rels/workbook.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="w" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="w" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/calcChain" Target="calcChain.xml"/></Relationships>'),
    t('xl/worksheets/sheet1.xml', sheet1),
    t('xl/worksheets/sheet2.xml', reg(regRows())),
    t('xl/calcChain.xml', '<calcChain><c r="A3" i="2"/></calcChain>'),
    { name: 'xl/vbaProject.bin', method: 8, crc: crc(VBA), csize: vbaZ.length, usize: VBA.length, raw: vbaZ, time: 0, date: 0x21 },
  ]);
}
const HZ = [
  { id: 'th-2', n: 2, d: '2026-09-22', tour_no: 10, dept: 'מעצבים', loc: 'כניסה', descr: 'ג\'ריקן', sev: 'בינונית', resp: 'מנהל המחלקה', resp2: 'בטיחות', action: 'לפנות', due: '2026-09-25', s: 'פתוח', closed_d: null, notes: null },
  { id: 'th-1', n: 1, d: null, tour_no: 1, dept: 'מעצבים', loc: 'חדר חשמל', descr: 'פתוח', sev: 'בינונית', resp: 'חשמל', due: '2026-06-08', s: 'סגור', closed_d: null, notes: 'לא טופל' },
];
const TR = [
  { id: 'a', u: 'מוסא', t: 1, d: '2026-09-23', loc: 'חומר גלם · רחבת קירור', ok: false, s: 'פתוח', f: 'פנס', ts: '2026-09-23T08:00:00Z' },
  { id: 'b', u: 'מוסא', t: 2, d: '2026-09-24', loc: 'מעוצבים · מחסן', ok: false, s: 'נסגר', f: 'שמן', ts: '2026-09-24T08:00:00Z', mgr_note: 'טופל' },
  { id: 'c', u: 'רונית', t: 8, d: '2026-09-26', ok: true, ref: 'b', ts: '2026-09-26T08:00:00Z' },
  { id: 'ok', u: 'מוסא', t: 3, d: '2026-09-25', ok: true, s: 'תקין', ts: '2026-09-25T08:00:00Z' },
  { id: 'nr', u: 'מוסא', t: 3, d: '2026-09-28', loc: 'חומר גלם · חדרי קירור', ok: false, s: 'נסגר', f: 'אין כריזה צבע אדום', ts: '2026-09-28T08:00:00Z', mgr_note: 'לא רלוונטי (מיכאל 28/09): הוסר מהדוח' },
];

function world(o) {
  o = o || {};
  const w = { state: Object.assign({}, o.state || {}), puts: [], file: o.file, calls: [], meta: { cTag: o.cTag || 'c1' } };
  globalThis.fetch = async (url, init) => {
    const u = String(url), m = (init && init.method) || 'GET';
    w.calls.push(m + ' ' + decodeURIComponent(u));
    const json = (x, st = 200) => new Response(JSON.stringify(x), { status: st, headers: { 'Content-Type': 'application/json' } });
    if (u.startsWith(SB + '/rest/v1/tour_hazards')) {
      if (m === 'PATCH' || m === 'POST') { w.hz = (w.hz || []).concat([{ m, u: decodeURIComponent(u), body: JSON.parse(init.body) }]); return new Response(null, { status: o.hzFail ? 500 : m === 'POST' ? 201 : 204 }); }
      return json(o.hazards || HZ);
    }
    if (u.startsWith(SB + '/rest/v1/tasks')) return json(o.tasks || []);
    if (u.startsWith(SB + '/rest/v1/trustee_reports')) {
      if (m === 'PATCH') { w.patches = (w.patches || []).concat([{ u: decodeURIComponent(u), body: JSON.parse(init.body) }]); return new Response(null, { status: o.patchFail ? 500 : 204 }); }
      return json(o.reports || TR);
    }
    if (u.startsWith('https://generativelanguage.googleapis.com/')) {
      w.ai = (w.ai || 0) + 1;
      if (o.aiFail) return json({ error: 'x' }, 500);
      return json({ candidates: [{ content: { parts: [{ text: '1. **לתקן את הפנס** — ולוודא תאורה תקינה\nעוד שורה' }] } }] });
    }
    if (u.startsWith(SB + '/rest/v1/server_state')) {
      if (m === 'POST') { JSON.parse(init.body).forEach((r) => { w.state[r.key] = r.value; }); return new Response(null, { status: 201 }); }
      return json(Object.keys(w.state).map((k) => ({ key: k, value: w.state[k], updated_at: 'x' })));
    }
    if (u.startsWith(SB + '/rest/v1/oauth_tokens')) return json([{ user_email: 'sviva@tapugan.co.il', refresh_token: 'rt', access_token: 'at', expires_at: new Date(Date.now() + 3600e3).toISOString(), scope: 'Files.ReadWrite' }]);
    if (u.startsWith('https://graph.microsoft.com/') && m === 'GET') {
      if (o.missing) return json({ error: { code: 'itemNotFound' } }, 404);
      return json({ id: 'i1', cTag: w.meta.cTag, lastModifiedDateTime: '2026-09-28T10:37:00Z', webUrl: 'https://od/file', '@microsoft.graph.downloadUrl': 'https://dl/file' });
    }
    if (u === 'https://dl/file') return new Response(w.file, { status: 200 });
    if (u.startsWith('https://graph.microsoft.com/') && m === 'PUT') {
      if (o.locked && !/%D7%90%D7%A8%D7%9B%D7%99%D7%95%D7%9F/.test(u)) return json({ error: { code: 'resourceLocked', message: 'locked' } }, 423);
      w.puts.push({ path: decodeURIComponent(u.split('/root:/')[1]), body: init.body });
      return json({ cTag: 'c-ours-' + w.puts.length, webUrl: 'https://od/file' });
    }
    return json({ error: 'unexpected ' + u }, 599);
  };
  return w;
}
const sheetOf = async (bytes, name) => entryText(readZip(bytes).find((e) => e.name === name));

(async () => {
  console.log('\n1. the merged register');
  const rows = buildRows(HZ, TR);
  check('managers first, by מס"ד, then the trustee findings (not the clean check, not the task-8 closure)', rows.length === 4 && rows[0][0] === 1 && rows[1][0] === 2 && rows[2][0] === 'נ-1' && rows[3][0] === 'נ-2', rows.map((r) => r[0]));
  check('manager notes start with "דיווח ממונה"; a shared responsible is "X + Y"', rows[0][12] === 'דיווח ממונה. לא טופל' && rows[1][12] === 'דיווח ממונה' && rows[1][7] === 'מנהל המחלקה + בטיחות', [rows[0][12], rows[1][7]]);
  check('no tour date stays empty (never invented)', rows[0][1] === null);
  check('trustee: department from the location, the rest is the place', rows[2][3] === 'חומר גלם' && rows[2][4] === 'רחבת קירור' && trusteeDept('מעוצבים · מחסן').dept === 'מעצבים', [rows[2][3], rows[2][4]]);
  check('trustee: בינונית, מנהל המחלקה, target = report + 3 days', rows[2][6] === 'בינונית' && rows[2][7] === 'מנהל המחלקה' && rows[2][9].date === '2026-09-26', rows[2]);
  check('trustee notes: "דיווח נאמן: <name>" + manager note', rows[2][12] === 'דיווח נאמן: מוסא' && rows[3][12] === 'דיווח נאמן: מוסא. טופל', [rows[2][12], rows[3][12]]);
  check('closed trustee finding: סגור, closing date from the task-8 report', rows[3][10] === 'סגור' && rows[3][11].date === '2026-09-26', rows[3]);
  check('trustee: "סיור נאמן: <name>" in פעולה נדרשת (the column the department report shows)', rows[2][8] === 'סיור נאמן: מוסא', rows[2][8]);
  check('trustee: tour number = the department\'s latest tour on or before the finding (so not "מסיור קודם")', rows[3][2] === 10 && rows[2][2] === '', [rows[2][2], rows[3][2]]);

  check('a finding marked "לא רלוונטי" is not in the register (and never deleted)', !rows.some((x) => x[5] === 'אין כריזה צבע אדום'), rows.map((x) => x[5]));
  const withA = buildRows(HZ, TR.map((x) => (x.id === 'a' ? { ...x, action: 'להחליף את הפנס' } : x)));
  check('with a corrective action: "<action> (סיור נאמן: <name>)"', withA[2][8] === 'להחליף את הפנס (סיור נאמן: מוסא)', withA[2][8]);
  check('cleanAction: one line, no numbering / bold / long dash, keyboard characters only', cleanAction('1. **לתקן את הפנס** — ולוודא\nעוד') === 'לתקן את הפנס - ולוודא', cleanAction('1. **לתקן את הפנס** — ולוודא\nעוד'));
  check('cleanAction: too short / empty -> null', cleanAction('') === null && cleanAction('ok') === null);

  const rt = buildRows(HZ, TR, [{ id: 't1', source_table: 'trustee_reports', source_id: 'a', due: '2026-09-20', ts: '2026-09-23T10:00:00Z' }, { id: 't2', source_table: 'trustee_reports', source_id: 'a', due: '2026-10-04', ts: '2026-09-24T10:00:00Z' }, { id: 't3', source_table: 'ncr', source_id: 'b', due: '2026-12-01' }]);
  check('a routed finding is due when its (latest) task is due, others report + 3 days', rt[2][9].date === '2026-10-04' && rt[3][9].date === '2026-09-27', [rt[2][9], rt[3][9]]);
  console.log('\n1b. the assistant fills a missing corrective action');
  {
    const AENV = { ...ENV, GEMINI_API_KEY: 'g' };
    let wa = world({ file: await fixture() });
    const ra = await runFile(AENV, 'xlsm', true);
    const p = (wa.patches || [])[0];
    check('open finding without one: asked once, saved with action=is.null (never over the manager\'s text)', wa.ai === 1 && p && /trustee_reports\?id=eq\.a&action=is\.null/.test(p.u) && p.body.action === 'לתקן את הפנס - ולוודא תאורה תקינה', [wa.ai, p]);
    check('closed and not-relevant findings are not asked', !(wa.patches || []).some((x) => /id=eq\.(b|nr)/.test(x.u)));
    const regx = await sheetOf(wa.puts.find((q) => /2026\/ניהול סיורי מפגעים\.xlsm:/.test(q.path)).body, 'xl/worksheets/sheet2.xml');
    check('...and it is in this very write', regx.includes('לתקן את הפנס - ולוודא תאורה תקינה (סיור נאמן: מוסא)'), ra);
    wa = world({ file: await fixture(), aiFail: true });
    const rb = await runFile(AENV, 'xlsm', true);
    check('assistant down: the file is still written, without the action (next run tries again)', rb.ok && rb.pushed && !(wa.patches || []).length, rb);
    wa = world({ file: await fixture() });
    await runFile(ENV, 'xlsm', true);
    check('no GEMINI_API_KEY: no call at all', !wa.ai);
  }

  console.log('\n2. first write into the existing workbook');
  const src = await fixture();
  let w = world({ file: src });
  let r = await runFile(ENV, 'xlsm', false);
  check('written', r.ok && r.pushed && r.rows === 4, r);
  const backup = w.puts.find((p) => /לפני כתיבה ראשונה מהאפליקציה/.test(p.path));
  const main = w.puts.find((p) => /^שולחן העבודה\/ניהול בטיחות\/13_סיורי מפגעים\/2026\/ניהול סיורי מפגעים\.xlsm:/.test(p.path));
  check('the original was backed up first, byte for byte', backup && Buffer.compare(Buffer.from(backup.body), Buffer.from(src)) === 0 && w.puts.indexOf(backup) < w.puts.indexOf(main), w.puts.map((p) => p.path));
  const out = main.body;
  const z = readZip(out);
  const x = await sheetOf(out, 'xl/worksheets/sheet2.xml');
  check('register rows written (inline strings), old text gone', x.includes('<t xml:space="preserve">ג\'ריקן</t>') && x.includes('נ-1') && !x.includes('>ישן<'), x.slice(0, 300));
  check('formula columns N/O untouched on every row', (x.match(/<f t="array" ref="N\d+">/g) || []).length === 7 && (x.match(/<f>ROW\(\)<\/f>/g) || []).length === 7);
  check('a formula in the data columns (A3 = A2+1) becomes the value', !/<c r="A3"[^>]*><f>/.test(x) && /<c r="A3" s="3"><v>2<\/v><\/c>/.test(x), (x.match(/<c r="A3".*?<\/c>/) || [])[0]);
  check('dates are serials with a date style taken from the same column', x.includes('<c r="B3" s="24"><v>' + serial('2026-09-22') + '</v></c>') && x.includes('<c r="J2" s="14"><v>' + serial('2026-06-08') + '</v></c>') && x.includes('<c r="L5" s="24"><v>' + serial('2026-09-26') + '</v></c>'), (x.match(/<row r="5".*?<\/row>/) || [])[0]);
  check('text keeps the cell style of that column', /<c r="D2" s="8" t="inlineStr">/.test(x));
  check('rows hidden by the old filter are shown; the filter stays, its selection goes', !/hidden="1"/.test(x) && /<autoFilter ref="A1:M8"\/>/.test(x) && !/filterMode/.test(x));
  check('data validation kept', x.includes('<formula1>"גבוהה,בינונית,נמוכה"</formula1>'));
  check('rows past the data are blank in A..M', /<row r="6"[^>]*><c r="A6" s="3"\/>/.test(x) && !/<c r="[A-M]7"[^>]*>[^<]/.test(x));
  const vba = z.find((e) => e.name === 'xl/vbaProject.bin');
  check('the macro is copied as-is (same compressed bytes, CRC)', vba && vba.method === 8 && vba.crc === crc(VBA) && vba.usize === VBA.length);
  check('the other sheet is untouched', (await sheetOf(out, 'xl/worksheets/sheet1.xml')).includes('COUNTIF('));
  check('calcChain removed (entry, relationship, content type)', !z.some((e) => e.name === 'xl/calcChain.xml') && !(await sheetOf(out, 'xl/_rels/workbook.xml.rels')).includes('calcChain') && !(await sheetOf(out, '[Content_Types].xml')).includes('calcChain'));
  check('Excel is told to recalculate on open', (await sheetOf(out, 'xl/workbook.xml')).includes('<calcPr calcId="191029" fullCalcOnLoad="1"/>'));
  check('state: signature and our cTag saved', w.state.hazard_xlsm_sig && w.state.hazard_xlsm_ctag === 'c-ours-2' && w.state.hazard_xlsm_err === '', w.state);
  check('state: digest of the sheets we wrote saved', /^[0-9a-f]{64}$/.test(w.state.hazard_xlsm_sheets || ''), w.state.hazard_xlsm_sheets);
  const edited = z.filter((e) => ['xl/worksheets/sheet2.xml', 'xl/workbook.xml', '[Content_Types].xml', 'xl/_rels/workbook.xml.rels'].includes(e.name));
  check('rewritten parts are deflated again, not stored (28/09: file tripled)', edited.length === 4 && edited.every((e) => e.method === 8), edited.map((e) => e.name + ':' + e.method));

  console.log('\n3. the next runs');
  const s1 = Object.assign({}, w.state);
  w = world({ file: out, state: s1, cTag: 'c-ours-2' });
  r = await runFile(ENV, 'xlsm', false);
  check('same data, file untouched: one metadata read, nothing downloaded or written', r.pushed === false && r.reason === 'unchanged' && w.puts.length === 0 && w.calls.filter((c) => c.includes('graph.microsoft.com')).length === 1 && !w.calls.includes('GET https://dl/file'), w.calls.filter((c) => /graph|dl\/file/.test(c)));
  w = world({ file: out, state: s1, cTag: 'c-ours-2', hazards: HZ.concat([{ id: 'th-3', n: 3, d: '2026-09-28', tour_no: 11, dept: 'תוצג', descr: 'חדש', s: 'פתוח' }]) });
  r = await runFile(ENV, 'xlsm', false);
  check('new hazard in the app: written, no backup (file still ours)', r.pushed && w.puts.length === 1 && !w.puts.some((p) => /ארכיון/.test(p.path)), w.puts.map((p) => p.path));
  w = world({ file: out, state: s1, cTag: 'onedrive-bumped', hazards: HZ.concat([{ id: 'th-3', n: 3, d: '2026-09-28', dept: 'תוצג', descr: 'חדש', s: 'פתוח' }]) });
  r = await runFile(ENV, 'xlsm', false);
  check('cTag changed by OneDrive but the sheets are ours: written, no copy to גרסאות שנדרסו', r.pushed && w.puts.length === 1 && !r.kept, w.puts.map((p) => p.path));
  const saved = readZip(out).map((e) => (e.name === 'xl/worksheets/sheet2.xml' ? { name: e.name, text: null } : e));
  saved.find((e) => e.name === 'xl/worksheets/sheet2.xml').text = (await sheetOf(out, 'xl/worksheets/sheet2.xml')).replace('</sheetData>', '<row r="99"><c r="A99"><v>7</v></c></row></sheetData>');
  const personFile = await writeZip(saved);
  w = world({ file: personFile, state: s1, cTag: 'someone-saved', hazards: HZ.concat([{ id: 'th-3', n: 3, d: '2026-09-28', dept: 'תוצג', descr: 'חדש', s: 'פתוח' }]) });
  r = await runFile(ENV, 'xlsm', false);
  check('file saved in Excel since our write: that version goes to ארכיון/גרסאות שנדרסו first', r.pushed && w.puts[0] && /ארכיון\/גרסאות שנדרסו\/ניהול סיורי מפגעים - 2026-09-28 10-37\.xlsm/.test(w.puts[0].path), w.puts.map((p) => p.path));
  w = world({ file: out, state: s1, cTag: 'c-ours-2', locked: true, hazards: HZ.slice(0, 1) });
  r = await runFile(ENV, 'xlsm', false);
  check('open in Excel (423): a clear Hebrew message, signature not saved (retried)', !r.ok && r.locked && /פתוח ב-Excel/.test(r.error) && w.state.hazard_xlsm_sig === s1.hazard_xlsm_sig, r);
  w = world({ file: out, missing: true });
  r = await runFile(ENV, 'xlsx', true);
  check('file not in the folder: says where it looked', !r.ok && /13_סיורי מפגעים\/2026\/ניהול סיורי מפגעים\.xlsx/.test(r.error), r);
  const many = Array.from({ length: 8 }, (_, i) => ({ id: 'm' + i, n: i + 1, dept: 'תוצג', descr: 'x', s: 'פתוח' }));
  w = world({ file: src, hazards: many, reports: [] });
  r = await runFile(ENV, 'xlsm', true);
  check('more rows than the sheet holds: refused, file not written', !r.ok && /too many rows/.test(r.error) && !w.puts.some((p) => /2026\/ניהול סיורי מפגעים\.xlsm:/.test(p.path)), r);

  console.log('\n3b. Excel -> app (closing in the file updates the app)');
  check('state: the rows and the record behind each saved', (() => { const l = JSON.parse(s1.hazard_xlsm_last || '{}'); return l.rows && l.rows.length === 4 && l.ids.join() === 'h:th-1,h:th-2,t:a,t:b'; })(), s1.hazard_xlsm_last);
  const base = buildRows(HZ, TR).map((x) => x.slice());
  base[1][10] = 'סגור';                                   // hazard 2 closed, no date
  base[0][12] = 'דיווח ממונה. נבדק שוב';                   // hazard 1 notes
  base[2][10] = 'סגור'; base[2][11] = { date: '2026-09-27' }; // trustee finding נ-1 closed with a date
  base[2][8] = 'להחליף פנס (סיור נאמן: מוסא)';              // ... and its action
  base[1][5] = 'תיאור ששונה ב-Excel';                       // description: not taken
  base.push(['', { date: '2026-09-28' }, 12, 'תוצג', 'מחסן', 'כבל חשוף', 'גבוהה', 'חשמל + אחזקה', 'לבודד', null, 'פתוח', null, '']);
  const xEdited = await patchSheetRows(out, base, { sheet: 'מאגר מפגעים', lastCol: 12, maxRow: 8, dateCols: [1, 9, 11] });
  const back = await readSheetRows(xEdited, { sheet: 'מאגר מפגעים', lastCol: 12, maxRow: 8, dateCols: [1, 9, 11] });
  check('the file is read back: numbers, text, dates as YYYY-MM-DD', back.length === 5 && back[0].v[0] === 1 && back[2].v[0] === 'נ-1' && back[2].v[11] === '2026-09-27' && back[4].v[5] === 'כבל חשוף', back.map((b) => b.v.slice(0, 2)));
  const last1 = JSON.parse(s1.hazard_xlsm_last);
  let ed = diffEdits(back, last1, HZ, TR, '2026-09-28');
  const e2 = ed.hazards.find((x) => x.id === 'th-2'), e1 = ed.hazards.find((x) => x.id === 'th-1'), ea = ed.reports.find((x) => x.id === 'a');
  check('manager hazard closed in Excel without a date: סגור, closed today', e2 && e2.s === 'סגור' && e2.closed_d === '2026-09-28' && !('descr' in e2), e2);
  check('notes edited: taken without the "דיווח ממונה" prefix', e1 && e1.notes === 'נבדק שוב' && Object.keys(e1).length === 2, e1);
  check('trustee finding closed: נסגר, its date, the action without "(סיור נאמן: ...)"', ea && ea.s === 'נסגר' && ea.closed_d === '2026-09-27' && ea.action === 'להחליף פנס', ea);
  check('a new row becomes a manager hazard with the next מס"ד, both responsibles', ed.fresh.length === 1 && ed.fresh[0].n === 3 && ed.fresh[0].resp === 'חשמל' && ed.fresh[0].resp2 === 'אחזקה' && ed.fresh[0].sev === 'גבוהה' && ed.fresh[0].d === '2026-09-28' && /^th-/.test(ed.fresh[0].id), ed.fresh);
  const hzApp = HZ.map((h) => (h.id === 'th-2' ? Object.assign({}, h, { s: 'בטיפול' }) : h));
  ed = diffEdits(back, last1, hzApp, TR, '2026-09-28');
  check('changed in the app too since the last write: the app wins for that field', !ed.hazards.some((x) => x.id === 'th-2' && 's' in x), ed.hazards);
  ed = diffEdits(back, last1, HZ.concat([{ id: 'th-9', n: 3, dept: 'תוצג', descr: 'כבל חשוף', s: 'פתוח' }]), TR, '2026-09-28');
  check('a new row already created on an earlier run is not created again', ed.fresh.length === 0, ed.fresh);
  ed = diffEdits(await readSheetRows(out, { sheet: 'מאגר מפגעים', lastCol: 12, maxRow: 8, dateCols: [1, 9, 11] }), last1, HZ, TR, '2026-09-28');
  check('the file exactly as the server wrote it: no edits', !ed.hazards.length && !ed.reports.length && !ed.fresh.length, ed);

  w = world({ file: xEdited, state: s1, cTag: 'saved-in-excel' });
  r = await runFile(ENV, 'xlsm', false);
  const hp = (w.hz || []).filter((x) => x.m === 'PATCH'), hn = (w.hz || []).filter((x) => x.m === 'POST');
  check('the run: new hazard posted first, then the edits patched', hn.length === 1 && hp.length === 2 && w.hz[0].m === 'POST' && (w.patches || []).some((x) => /id=eq\.a/.test(x.u) && x.body.s === 'נסגר'), w.hz);
  check('the person\'s version is archived, then the file is rewritten from the updated app', r.pushed && r.kept && /גרסאות שנדרסו/.test(w.puts[0].path) && r.pulled && r.pulled.created === 1 && r.pulled.hazards === 2 && r.pulled.reports === 1, r);
  const x2 = await readSheetRows(w.puts[1].body, { sheet: 'מאגר מפגעים', lastCol: 12, maxRow: 8, dateCols: [1, 9, 11] });
  check('the rewritten file: hazard 2 closed with today, the old description back, the new hazard as 3, trustee closed with its date', (() => {
    const b = (k) => x2.find((q) => q.v[0] === k);
    return b(2) && b(2).v[10] === 'סגור' && b(2).v[11] === new Date().toISOString().substring(0, 10) && b(2).v[5] === "ג'ריקן" && b(3) && b(3).v[5] === 'כבל חשוף' && b('נ-1').v[10] === 'סגור' && b('נ-1').v[11] === '2026-09-27';
  })(), x2.map((q) => [q.v[0], q.v[5], q.v[10], q.v[11]]));
  w = world({ file: xEdited, state: s1, cTag: 'saved-in-excel', hzFail: true });
  r = await runFile(ENV, 'xlsm', false);
  check('a database write fails: error, the file is not rewritten', !r.ok && !w.puts.some((p) => /2026\/ניהול סיורי מפגעים\.xlsm:/.test(p.path)), r);
  w = world({ file: xEdited, state: s1, cTag: 'saved-in-excel', locked: true });
  r = await runFile(ENV, 'xlsm', false);
  const lastAfter = JSON.parse(w.state.hazard_xlsm_last);
  check('file open in Excel: the edits are in the app, and the saved baseline takes them (not pulled twice)', !r.ok && r.locked && lastAfter.rows[1][10] === 'סגור' && lastAfter.rows[2][8] === 'להחליף פנס (סיור נאמן: מוסא)', lastAfter.rows[1]);
  w = world({ file: out, state: s1, cTag: 'onedrive-bumped-only' });
  r = await runFile(ENV, 'xlsm', false);
  check('cTag bumped by OneDrive, same data: nothing written, the new cTag remembered', !r.pushed && r.reason === 'unchanged' && !w.puts.length && w.state.hazard_xlsm_ctag === 'onedrive-bumped-only', r);

  console.log('\n4. who may call it, and the twin');
  w = world({ file: src });
  const req = (h, b) => new Request('https://tapugan-safety.pages.dev/api/hazard-file', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, h || {}), body: JSON.stringify(b || {}) });
  let res = await onRequest({ request: req(), env: ENV });
  check('no secret -> 403', res.status === 403);
  res = await onRequest({ request: req(), env: { ...ENV, TRUSTEE_NOTIFY_SECRET: '' } });
  check('secret not configured -> still 403 (never open)', res.status === 403);
  const waits = [];
  res = await onRequest({ request: req({ 'x-notify-secret': 'nsec' }), env: ENV, waitUntil: (p) => waits.push(p) });
  let j = await res.json();
  await Promise.all(waits);
  check('with the secret: the xlsm, then a call for the xlsx', j.ok && j.file === 'xlsm' && j.next === 'xlsx' && w.calls.some((c) => c.startsWith('POST https://tapugan-safety.pages.dev/api/hazard-file')), j);
  const w2 = world({ file: src });
  const waits2 = [];
  res = await onRequest({ request: req({ 'x-notify-secret': 'nsec' }, { file: 'xlsx' }), env: ENV, waitUntil: (p) => waits2.push(p) });
  j = await res.json();
  check('the xlsx call writes the xlsx and does not chain again', j.ok && j.file === 'xlsx' && !j.next && waits2.length === 0 && w2.puts.some((p) => /2026\/ניהול סיורי מפגעים\.xlsx:/.test(p.path)), j);

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
