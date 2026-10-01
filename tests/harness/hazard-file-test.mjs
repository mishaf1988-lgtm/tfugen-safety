// The folder-13 workbook (28/09): the server rewrites the register rows of the
// EXISTING xlsm and must leave everything else alone. Builds a small workbook
// shaped like the real one (a report sheet with a formula, the register with
// formula columns N/O, a hidden row and a filter, calcChain, a "macro"), runs
// the real hazard-file.js with Graph and Supabase mocked, and reads the result.
import fs from 'fs';
import path from 'path';
import { onRequest, runFile, buildRows, trusteeDept, diffEdits, buildRegister, routedNote, applyEdits, supersede, runFileLocked, runArchive, stampMonth, mergeDropped, dropKey, subBudget, SUB_LIMIT } from './_build/hazard-file.mjs';
import { cleanAction } from './_build/_ai.mjs';
import { readZip, writeZip, entryText, serial, patchSheetRows, readSheetRows, rowHeight } from './_build/_xlsxpatch.mjs';

let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 400) : '')); } };
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'srv', ONEDRIVE_CLIENT_ID: 'cid', ONEDRIVE_CLIENT_SECRET: 'cs', TRUSTEE_NOTIFY_SECRET: 'nsec' };

async function deflate(u8) {
  const s = new Blob([u8]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}
function crc(buf) { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) { c ^= buf[i]; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; } return (c ^ 0xFFFFFFFF) >>> 0; }
// The smallest thing picInfo reads as a 64x48 JPEG.
const JPEG = new Uint8Array([0xFF, 0xD8, 0xFF, 0xC0, 0x00, 0x11, 0x08, 0x00, 0x30, 0x00, 0x40, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1, 0xFF, 0xD9]);
const PH = (n) => SB + '/storage/v1/object/public/incidents-photos/tour/' + n + '.jpg';
const VBA = new Uint8Array(3000).map((_, i) => (i * 37) % 251);
const reg = (rows) => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr codeName="x" filterMode="1"/><sheetData>'
  + '<row r="1"><c r="A1" t="inlineStr"><is><t>מס"ד</t></is></c><c r="N1" t="inlineStr"><is><t>חדש/ישן</t></is></c></row>' + rows
  + '</sheetData><autoFilter ref="A1:M8"><filterColumn colId="3"><filters><filter val="מעצבים"/></filters></filterColumn></autoFilter>'
  + '<dataValidations count="1"><dataValidation type="list" sqref="G2:G8"><formula1>"גבוהה,בינונית,נמוכה"</formula1></dataValidation></dataValidations></worksheet>';
const N = (r) => '<c r="N' + r + '" t="str"><f t="array" ref="N' + r + '">IF($A' + r + '="","","x")</f><v>x</v></c><c r="O' + r + '"><f>ROW()</f><v>' + r + '</v></c>';
function regRows(last) {
  let x = '<row r="2"><c r="A2" s="3"><v>1</v></c><c r="B2" s="10"/><c r="D2" s="8" t="inlineStr"><is><t>ישן</t></is></c><c r="J2" s="14"><v>46181</v></c><c r="K2" s="3"/><c r="L2" s="3"/>' + N(2) + '</row>';
  x += '<row r="3" hidden="1"><c r="A3" s="3"><f>A2+1</f><v>2</v></c><c r="B3" s="24"><v>46287</v></c><c r="L3" s="24"><v>46290</v></c>' + N(3) + '</row>';
  for (let r = 4; r <= (last || 8); r++) x += '<row r="' + r + '"' + (r === 5 ? ' hidden="1"' : '') + '><c r="A' + r + '" s="3"/><c r="B' + r + '" s="3"/><c r="J' + r + '" s="8"/>' + N(r) + '</row>';
  return x;
}
async function fixture(last) {
  const t = (name, text) => ({ name, text });
  const vbaZ = await deflate(VBA);
  const sheet1 = '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1"><f>COUNTIF(\'מאגר מפגעים\'!$K$2:$K$8,"פתוח")</f><v>0</v></c></row></sheetData></worksheet>';
  return writeZip([
    t('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/xl/calcChain.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.calcChain+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="x"/></Types>'),
    t('_rels/.rels', '<Relationships/>'),
    t('xl/workbook.xml', '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Claude Log" sheetId="9" r:id="rId9"/><sheet name="דוח מרכז" sheetId="1" r:id="rId1"/><sheet name="מאגר מפגעים" sheetId="3" r:id="rId2"/></sheets><calcPr calcId="191029"/></workbook>'),
    t('xl/_rels/workbook.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId9" Type="w" Target="worksheets/sheet9.xml"/><Relationship Id="rId1" Type="w" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="w" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/calcChain" Target="calcChain.xml"/></Relationships>'),
    t('xl/worksheets/sheet1.xml', sheet1),
    t('xl/worksheets/sheet9.xml', '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" s="1" t="inlineStr"><is><t>Turn #</t></is></c></row><row r="2"><c r="A2" s="5"><v>19</v></c><c r="B2" s="6" t="inlineStr"><is><t>22/06/2026</t></is></c></row><row r="3"/></sheetData></worksheet>'),
    t('xl/worksheets/sheet2.xml', reg(regRows(last))),
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
      const pref = (init && init.headers && init.headers.Prefer) || '';
      if (m === 'POST') { JSON.parse(init.body).forEach((r) => { if (/ignore-duplicates/.test(pref) && r.key in w.state) return; w.state[r.key] = r.value; }); return new Response(null, { status: 201 }); }
      if (m === 'PATCH') {
        // the lease: take it only when free; give it back only with its token
        const du = decodeURIComponent(u), key = /key=eq\.([^&]+)/.exec(du)[1], body = JSON.parse(init.body), cur = w.state[key] || '';
        if (/&or=/.test(du)) { if (o.lockHeld || cur) return json([]); w.state[key] = body.value; w.locks = (w.locks || 0) + 1; return json([{ key }]); }
        const tok = /&value=eq\.(.+)$/.exec(du); if (tok && tok[1] === cur) w.state[key] = body.value;
        return new Response(null, { status: 204 });
      }
      return json(Object.keys(w.state).map((k) => ({ key: k, value: w.state[k], updated_at: 'x' })));
    }
    if (u.startsWith(SB + '/rest/v1/oauth_tokens')) return json([{ user_email: 'sviva@tapugan.co.il', refresh_token: 'rt', access_token: 'at', expires_at: new Date(Date.now() + 3600e3).toISOString(), scope: 'Files.ReadWrite' }]);
    if (u.startsWith('https://graph.microsoft.com/') && m === 'GET') {
      if (o.missing) return json({ error: { code: 'itemNotFound' } }, 404);
      // o.years: the years whose folder holds the files; another year's file
      // exists only once something was PUT there (the roll-over, review 24).
      if (o.years) { const du = decodeURIComponent(u).split('?')[0], y = /13_סיורי מפגעים\/(\d{4})\//.exec(du); if (y && o.years.indexOf(+y[1]) < 0 && !w.puts.some((p) => du.endsWith(p.path.replace(/:\/content$/, '')))) return json({ error: { code: 'itemNotFound' } }, 404); }
      return json({ id: 'i1', cTag: w.meta.cTag, lastModifiedDateTime: '2026-09-28T10:37:00Z', webUrl: 'https://od/file', '@microsoft.graph.downloadUrl': 'https://dl/file' });
    }
    if (u === 'https://dl/file') return new Response(w.file, { status: 200 });
    if (u.startsWith(SB + '/storage/v1/object/sign/')) { w.signs = (w.signs || 0) + 1; return json(JSON.parse(init.body).paths.map((p) => ({ path: p, signedURL: '/object/sign/incidents-photos/' + p + '?token=t' }))); }
    if (u.startsWith(SB + '/storage/v1/render/image/')) { w.thumbs = (w.thumbs || 0) + 1; return new Response(o.badThumb ? new Uint8Array([1, 2, 3]) : JPEG, { status: 200 }); }
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
  // Upgrade review 23 (30/09/2026): נ-k is trustee_reports.num, fixed once. A
  // finding marked not relevant leaves a gap; the later ones keep their number.
  {
    const fixed = TR.map((r, i) => ({ ...r, num: 10 + i }));
    const nums = buildRows(HZ, fixed).filter((x) => /^נ-/.test(x[0])).map((x) => x[0]);
    const want = fixed.filter((r) => r.ok === false && +r.t >= 1 && +r.t <= 7 && !/^\s*לא רלוונטי/.test(r.mgr_note || '')).sort((a, b) => String(a.ts).localeCompare(String(b.ts))).map((r) => 'נ-' + r.num);
    check('נ-k comes from num (fixed), not from the position; a not-relevant finding leaves a gap', nums.length === want.length && nums.every((n, i) => n === want[i]) && nums[0] !== 'נ-1', { nums, want });
  }
  const withA = buildRows(HZ, TR.map((x) => (x.id === 'a' ? { ...x, action: 'להחליף את הפנס' } : x)));
  check('with a corrective action: "<action> (סיור נאמן: <name>)"', withA[2][8] === 'להחליף את הפנס (סיור נאמן: מוסא)', withA[2][8]);
  check('cleanAction: one line, no numbering / bold / long dash, keyboard characters only', cleanAction('1. **לתקן את הפנס** — ולוודא\nעוד') === 'לתקן את הפנס - ולוודא', cleanAction('1. **לתקן את הפנס** — ולוודא\nעוד'));
  check('cleanAction: too short / empty -> null', cleanAction('') === null && cleanAction('ok') === null);

  const rt = buildRows(HZ, TR, [{ id: 't1', source_table: 'trustee_reports', source_id: 'a', due: '2026-09-20', ts: '2026-09-23T10:00:00Z' }, { id: 't2', source_table: 'trustee_reports', source_id: 'a', due: '2026-10-04', ts: '2026-09-24T10:00:00Z' }, { id: 't3', source_table: 'ncr', source_id: 'b', due: '2026-12-01' }]);
  check('a routed finding is due when its (latest) task is due, others report + 3 days', rt[2][9].date === '2026-10-04' && rt[3][9].date === '2026-09-27', [rt[2][9], rt[3][9]]);
  check('routed in the note (WhatsApp / mail / Vitre): its "עד" date, the last one', routedNote('נותב לאחזקה עד 30/09/2026 (מייל 23/09/2026)') === '2026-09-30' && routedNote('נותב לאחזקה - מיכאל פרייליך עד 04/10/2026 (Vitre SMS #3612206 27/09/2026)') === '2026-10-04' && routedNote('נותב לחשמל עד 1/10/2026 (x). נותב לאחזקה עד 05/10/2026 (y)') === '2026-10-05' && routedNote('בדיקה של חשמלאים') === null && routedNote(null) === null);
  const rn = buildRows(HZ, TR.map((r) => (r.id === 'a' ? Object.assign({}, r, { mgr_note: 'נותב לאחזקה עד 04/10/2026 (מייל 23/09/2026)' }) : r)));
  check('a finding routed in its note is due on that date; a task wins over the note', rn[2][9].date === '2026-10-04' && buildRows(HZ, TR.map((r) => (r.id === 'a' ? Object.assign({}, r, { mgr_note: 'נותב לאחזקה עד 04/10/2026 (x)' }) : r)), [{ source_table: 'trustee_reports', source_id: 'a', due: '2026-10-09', ts: 'z' }])[2][9].date === '2026-10-09', rn[2][9]);
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
  // Michael, 29/09: after every write the filter shows only what is still open.
  const kOf = (r) => ((new RegExp('<c r="K' + r + '"[^>]*><is><t[^>]*>([^<]*)<').exec(x)) || [])[1] || '';
  const hid = (r) => new RegExp('<row r="' + r + '"[^>]*hidden="1"').test(x);
  const ks = [2, 3, 4, 5].map(kOf);
  check('the fixture has both open and closed rows', ks.includes('סגור') && ks.some((k) => k === 'פתוח' || k === 'בטיפול'), ks);
  check('the old filter selection is gone; the filter is on K (פתוח, בטיפול, blanks)', !x.includes('<filter val="מעצבים"') && /<autoFilter ref="A1:M8"><filterColumn colId="10"><filters blank="1"><filter val="פתוח"\/><filter val="בטיפול"\/><\/filters><\/filterColumn><\/autoFilter>/.test(x) && /<sheetPr codeName="x" filterMode="1"\/>|<sheetPr filterMode="1" codeName="x"\/>/.test(x), (x.match(/<autoFilter[\s\S]*?(\/>|<\/autoFilter>)/) || [])[0]);
  const htOf = (r) => +((new RegExp('<row r="' + r + '"[^>]*\\bht="([\\d.]+)"').exec(x)) || [])[1];
  check('written rows get a height that fits their text, marked custom; rows past the data keep theirs', [2, 3, 4, 5].every((r) => htOf(r) >= 18 && new RegExp('<row r="' + r + '"[^>]*customHeight="1"').test(x)) && !/<row r="7"[^>]*customHeight/.test(x), [2, 3, 4, 5, 7].map(htOf));
  check('row height: short text one line, long text more lines at the column width, never past 409', rowHeight(['a', 'קצר'], { 1: 20 }) === 18 && rowHeight(['x'.repeat(100)], { 0: 45.7 }) === 33 && rowHeight(['שורה\nשנייה\nשלישית'], { 0: 45 }) === 48 && rowHeight(['x'.repeat(10000)], { 0: 10 }) === 409 && rowHeight([{ date: '2026-09-29' }, 7], {}) === 18);
  check('closed rows hidden, open / in-progress and empty rows shown', [2, 3, 4, 5].every((r, i) => hid(r) === (ks[i] === 'סגור')) && [6, 7, 8].every((r) => !hid(r)), [2, 3, 4, 5, 6, 7, 8].map(hid));
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
  const logX = await sheetOf(w.puts[0].body, 'xl/worksheets/sheet9.xml');
  check('Claude Log: one line after the last one, numbered on (20), styles of the line above, what changed and where it came from', /<row r="3"><c r="A3" s="5"><v>20<\/v><\/c><c r="B3" s="6" t="inlineStr"><is><t xml:space="preserve">\d\d\/\d\d\/\d{4} \d\d:\d\d<\/t>/.test(logX) && logX.includes('שינוי באפליקציה') && logX.includes('מפגע חדש 3: חדש') && !/<row r="4"/.test(logX), logX.slice(-700));
  check('Claude Log: the first write (nothing to compare with) adds no line', !(await sheetOf(out, 'xl/worksheets/sheet9.xml')).includes('<v>20</v>'));
  w = world({ file: out, state: s1, cTag: 'onedrive-bumped', hazards: HZ.concat([{ id: 'th-3', n: 3, d: '2026-09-28', dept: 'תוצג', descr: 'חדש', s: 'פתוח' }]) });
  r = await runFile(ENV, 'xlsm', false);
  check('cTag changed by OneDrive but the sheets are ours: written, no copy to גרסאות שנדרסו', r.pushed && w.puts.length === 1 && !r.kept, w.puts.map((p) => p.path));
  const saved = readZip(out).map((e) => (e.name === 'xl/worksheets/sheet2.xml' ? { name: e.name, text: null } : e));
  saved.find((e) => e.name === 'xl/worksheets/sheet2.xml').text = (await sheetOf(out, 'xl/worksheets/sheet2.xml')).replace('</sheetData>', '<row r="99"><c r="A99"><v>7</v></c></row></sheetData>');
  const personFile = await writeZip(saved);
  w = world({ file: personFile, state: s1, cTag: 'someone-saved', hazards: HZ.concat([{ id: 'th-3', n: 3, d: '2026-09-28', dept: 'תוצג', descr: 'חדש', s: 'פתוח' }]) });
  r = await runFile(ENV, 'xlsm', false);
  check('saved in Excel, nothing there that the app does not take: rewritten, no copy (29/09/2026)', r.pushed && w.puts.length === 1 && !r.kept && JSON.parse(w.state.hazard_xlsm_dropped).items.length === 0, w.puts.map((p) => p.path));
  // A description edited in the file: the app does not take it, so the copy is kept and it is listed.
  const saved2 = readZip(out).map((e) => (e.name === 'xl/worksheets/sheet2.xml' ? { name: e.name, text: null } : e));
  saved2.find((e) => e.name === 'xl/worksheets/sheet2.xml').text = (await sheetOf(out, 'xl/worksheets/sheet2.xml')).replace(/(<c r="G2"[^>]*><is><t[^>]*>)[^<]*/, '$1גבוהה');
  w = world({ file: await writeZip(saved2), state: s1, cTag: 'someone-saved', hazards: HZ.concat([{ id: 'th-3', n: 3, d: '2026-09-28', dept: 'תוצג', descr: 'חדש', s: 'פתוח' }]) });
  r = await runFile(ENV, 'xlsm', false);
  const dr = JSON.parse(w.state.hazard_xlsm_dropped || '{}');
  const logP = await sheetOf(w.puts[w.puts.length - 1].body, 'xl/worksheets/sheet9.xml');
  check('Claude Log after a save in Excel: says so, and that 1 change was not taken', logP.includes('שמירה בקובץ Excel') && logP.includes('1 שינויים בקובץ לא נקלטו'), logP.slice(-600));
  check('severity edited in Excel: not taken, listed (row, column G, the text), and the file goes to גרסאות שנדרסו first', r.pushed && dr.items && dr.items.length === 1 && dr.items[0].ci === 6 && dr.items[0].r === 2 && dr.items[0].val === 'גבוהה' && /ארכיון\/גרסאות שנדרסו\/ניהול סיורי מפגעים - 28-09-2026 13\.37\.xlsm/.test(w.puts[0].path), [dr, w.puts.map((p) => p.path)]);
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
  check('manager hazard closed in Excel without a date: סגור, closed today', e2 && e2.s === 'סגור' && e2.closed_d === '2026-09-28' && e2.descr === 'תיאור ששונה ב-Excel', e2);
  check('notes edited: taken without the "דיווח ממונה" prefix', e1 && e1.notes === 'נבדק שוב' && Object.keys(e1).length === 2, e1);
  check('trustee finding closed: נסגר, its date, the action without "(סיור נאמן: ...)"', ea && ea.s === 'נסגר' && ea.closed_d === '2026-09-27' && ea.action === 'להחליף פנס', ea);
  check('a new row becomes a manager hazard with the next מס"ד, both responsibles', ed.fresh.length === 1 && ed.fresh[0].n === 3 && ed.fresh[0].resp === 'חשמל' && ed.fresh[0].resp2 === 'אחזקה' && ed.fresh[0].sev === 'גבוהה' && ed.fresh[0].d === '2026-09-28' && /^th-/.test(ed.fresh[0].id), ed.fresh);
  const hzApp = HZ.map((h) => (h.id === 'th-2' ? Object.assign({}, h, { s: 'בטיפול' }) : h));
  ed = diffEdits(back, last1, hzApp, TR, '2026-09-28');
  check('changed in the app too since the last write: the app wins for that field', !ed.hazards.some((x) => x.id === 'th-2' && 's' in x), ed.hazards);
  ed = diffEdits(back, last1, HZ.concat([{ id: 'th-9', n: 3, d: '2026-09-28', dept: 'תוצג', descr: 'כבל חשוף', s: 'פתוח' }]), TR, '2026-09-28');
  check('a new row already created on an earlier run is not created again', ed.fresh.length === 0, ed.fresh);
  ed = diffEdits(await readSheetRows(out, { sheet: 'מאגר מפגעים', lastCol: 12, maxRow: 8, dateCols: [1, 9, 11] }), last1, HZ, TR, '2026-09-28');
  check('the file exactly as the server wrote it: no edits, nothing reported as not taken', !ed.hazards.length && !ed.reports.length && !ed.fresh.length && ed.dropped.length === 0, ed);
  ed = diffEdits(back, last1, HZ, TR, '2026-09-28');
  check('closing / notes / description / a new row are all taken, nothing reported as not taken', ed.dropped.length === 0, ed.dropped);
  const trD = back.map((b) => (b.v[0] === 'נ-1' ? { r: b.r, v: b.v.map((x, i) => (i === 5 ? 'שונה בקובץ' : i === 9 ? '2026-12-01' : x)) } : b));
  ed = diffEdits(trD, last1, HZ, TR, '2026-09-28');
  check('a trustee finding: its description (what the trustee reported) and due are not taken, and are reported', !ed.reports.some((x) => 'descr' in x || 'due' in x || 'f' in x) && ed.dropped.some((d) => d.ci === 5 && d.val === 'שונה בקובץ') && ed.dropped.some((d) => d.ci === 9), ed);
  const dueE = back.map((b) => (b.v[0] === 1 ? { r: b.r, v: b.v.map((x, i) => (i === 9 ? '2026-11-15' : i === 5 ? '' : x)) } : b));
  ed = diffEdits(dueE, last1, HZ, TR, '2026-09-28');
  check('a manager hazard: a due date set in Excel is taken; an emptied description is not (never blank it)', ed.hazards.some((x) => x.id === 'th-1' && x.due === '2026-11-15' && !('descr' in x)) && ed.dropped.some((d) => d.ci === 5 && d.val === ''), ed);
  ed = diffEdits(back, last1, hzApp, TR, '2026-09-28');
  check('a status changed in both the app and the file: the file value is reported (the app wins)', ed.dropped.some((d) => d.ci === 10 && d.val === 'סגור'), ed.dropped);
  const badSt = back.map((b) => (b.v[0] === 1 ? { r: b.r, v: b.v.map((x, i) => (i === 10 ? 'גמור' : x)) } : b));
  ed = diffEdits(badSt, last1, HZ, TR, '2026-09-28');
  check('a status the app does not know ("גמור"): reported, not written', ed.dropped.some((d) => d.ci === 10 && d.val === 'גמור') && !ed.hazards.some((x) => x.id === 'th-1' && 's' in x), ed);

  // 29/09: an old copy still open in Excel saved over the file (44/46/47 reopened)
  const HZc = HZ.map((h) => (h.id === 'th-2' ? Object.assign({}, h, { s: 'סגור', closed_d: '2026-09-23' }) : h));
  const regC = buildRegister(HZc, TR);
  const oldC = supersede(last1, regC, '2026-09-29T07:36:00Z');
  check('what the app replaced is remembered: th-2 was פתוח, no closing date', JSON.stringify(oldC['h:th-2|10']) === JSON.stringify([['פתוח', '2026-09-29T07:36:00Z']]) && oldC['h:th-2|11'] && oldC['h:th-2|11'][0][0] === '', oldC);
  const staleRows = await readSheetRows(out, { sheet: 'מאגר מפגעים', lastCol: 12, maxRow: 8, dateCols: [1, 9, 11] });
  ed = diffEdits(staleRows, { rows: regC.rows, ids: regC.ids }, HZc, TR, '2026-09-29');
  check('(without it, the stale copy reads as "reopened in Excel": the bug)', ed.hazards.some((x) => x.id === 'th-2' && x.s === 'פתוח'), ed.hazards);
  ed = diffEdits(staleRows, { rows: regC.rows, ids: regC.ids, old: oldC }, HZc, TR, '2026-09-29');
  check('with it: the stale copy changes nothing, the app keeps סגור', !ed.hazards.some((x) => x.id === 'th-2'), ed.hazards);
  const realEdit = staleRows.map((b) => (b.v[0] === 2 ? { r: b.r, v: b.v.map((x, i) => (i === 10 ? 'בטיפול' : i === 11 ? null : x)) } : b));
  ed = diffEdits(realEdit, { rows: regC.rows, ids: regC.ids, old: oldC }, HZc, TR, '2026-09-29');
  check('a real edit to a value never written before is still taken (בטיפול)', ed.hazards.some((x) => x.id === 'th-2' && x.s === 'בטיפול'), ed.hazards);
  const later = supersede({ rows: regC.rows, ids: regC.ids, old: oldC }, regC, '2026-09-30T08:00:00Z');
  check('after 24 hours it is forgotten', !later['h:th-2|10'], later);
  const back2 = supersede({ rows: regC.rows, ids: regC.ids, old: oldC }, buildRegister(HZ, TR), '2026-09-29T08:00:00Z');
  check('reopened in the app: פתוח is current again, so it is not "old"; סגור is', !(back2['h:th-2|10'] || []).some((x) => x[0] === 'פתוח') && (back2['h:th-2|10'] || []).some((x) => x[0] === 'סגור'), back2);

  // 28/09 review fixes
  const lastDup = { rows: last1.rows.concat([last1.rows[1].slice()]), ids: last1.ids.concat(['h:th-X']) };
  ed = diffEdits(back, lastDup, HZ.concat([{ id: 'th-X', n: 2, dept: 'מעצבים', descr: 'כפול', s: 'פתוח' }]), TR, '2026-09-28');
  check('a number used twice in the last write: that row is skipped, not applied to either record', !ed.hazards.some((x) => x.id === 'th-2' || x.id === 'th-X'), ed.hazards);
  const shifted = back.map((b) => (b.v[0] === 'נ-1' ? { r: b.r, v: b.v.slice().map((x, i) => (i === 5 ? 'ליקוי אחר לגמרי' : i === 1 ? '2026-09-01' : x)) } : b));
  ed = diffEdits(shifted, last1, HZ, TR, '2026-09-28');
  check('a row whose description and date no longer match the record (stale copy, נ-k shift): skipped', !ed.reports.some((x) => x.id === 'a'), ed.reports);
  const aiApp = TR.map((r) => (r.id === 'a' ? Object.assign({}, r, { action: 'המלצת העוזר' }) : r));
  ed = diffEdits(back, last1, HZ, aiApp, '2026-09-28');
  check('the assistant filled an empty action in the same run, the person typed one in Excel: the person wins', (ed.reports.find((x) => x.id === 'a') || {}).action === 'להחליף פנס', ed.reports);
  const closedHz = HZ.map((h) => (h.id === 'th-1' ? Object.assign({}, h, { s: 'סגור', closed_d: '2026-09-01' }) : h));
  const lastC = { rows: buildRows(closedHz, TR), ids: last1.ids };
  const reopened = (await readSheetRows(await patchSheetRows(out, buildRows(closedHz, TR).map((x, i) => (i === 0 ? Object.assign(x.slice(), { 10: 'פתוח', 11: null }) : x)), { sheet: 'מאגר מפגעים', lastCol: 12, maxRow: 8, dateCols: [1, 9, 11] }), { sheet: 'מאגר מפגעים', lastCol: 12, maxRow: 8, dateCols: [1, 9, 11] }));
  ed = diffEdits(reopened, lastC, closedHz, TR, '2026-09-28');
  const ro = ed.hazards.find((x) => x.id === 'th-1');
  check('reopened in Excel: status פתוח and no closing date', ro && ro.s === 'פתוח' && ro.closed_d === null, ro);
  const many30 = Array.from({ length: 30 }, (_, i) => ({ id: 'm' + i, n: i + 1, d: '2026-09-01', dept: 'תוצג', descr: 'x' + i, s: 'פתוח' }));
  const reg30 = buildRegister(many30, []);
  const file30 = reg30.rows.map((x, i) => ({ r: i + 2, v: Object.assign(x.slice(), { 10: 'סגור', 11: '2026-09-28', 1: x[1] && x[1].date, 9: x[9] && x[9].date }) }));
  const w30 = world({ hazards: many30, reports: [] });
  const ed30 = diffEdits(file30, { rows: reg30.rows, ids: reg30.ids }, many30, [], '2026-09-28');
  check('30 edits found (over the 25-write budget)', ed30.hazards.length === 30, ed30.hazards.length);
  const ap = await applyEdits(ENV, ed30, many30.map((x) => Object.assign({}, x)), []);
  check('applyEdits writes 25, says which, and leaves the rest pending (they are not marked done)', ap.pending && ap.written.length === 25 && (w30.hz || []).filter((x) => x.m === 'PATCH').length === 25 && !ap.written.includes('h:m29'), [ap.pending, ap.written.length]);

  w = world({ file: xEdited, state: s1, cTag: 'saved-in-excel' });
  r = await runFile(ENV, 'xlsm', false);
  const hp = (w.hz || []).filter((x) => x.m === 'PATCH'), hn = (w.hz || []).filter((x) => x.m === 'POST');
  check('the run: new hazard posted first, then the edits patched', hn.length === 1 && hp.length === 2 && w.hz[0].m === 'POST' && (w.patches || []).some((x) => /id=eq\.a/.test(x.u) && x.body.s === 'נסגר'), w.hz);
  check('everything the person changed was taken (description too, since 29/09/2026): no copy kept, the file is rewritten from the updated app', r.pushed && !r.kept && w.puts.length === 1 && r.pulled && r.pulled.created === 1 && r.pulled.hazards === 2 && r.pulled.reports === 1, r);
  const x2 = await readSheetRows(w.puts[0].body, { sheet: 'מאגר מפגעים', lastCol: 12, maxRow: 8, dateCols: [1, 9, 11] });
  check('the rewritten file: hazard 2 closed with today, the description as fixed in Excel, the new hazard as 3, trustee closed with its date', (() => {
    const b = (k) => x2.find((q) => q.v[0] === k);
    return b(2) && b(2).v[10] === 'סגור' && b(2).v[11] === new Date().toISOString().substring(0, 10) && b(2).v[5] === 'תיאור ששונה ב-Excel' && b(3) && b(3).v[5] === 'כבל חשוף' && b('נ-1').v[10] === 'סגור' && b('נ-1').v[11] === '2026-09-27';
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

  console.log('\n3b2. rows skipped as a whole are listed, and the list collects (upgrade review 9, 29/09)');
  const row = (k, arr) => ({ r: 90 + back.length, v: Object.assign(Array(13).fill(null), arr, { 0: k }) });
  const why = (e, w) => e.dropped.filter((d) => d.why === w);
  // a recurring hazard, typed in the old one's words on a new tour
  let ex = diffEdits(back.concat([row('', { 1: '2026-09-29', 3: 'מעצבים', 5: 'ג\'ריקן', 10: 'פתוח' })]), last1, HZ, TR, '2026-09-29');
  check('a recurring hazard in an old one\'s words on a new tour date: created (it used to vanish)', ex.fresh.some((f) => f.descr === 'ג\'ריקן' && f.d === '2026-09-29'), ex.fresh);
  ex = diffEdits(back.concat([row('', { 1: '2026-09-22', 3: 'מעצבים', 5: 'ג\'ריקן' })]), last1, HZ, TR, '2026-09-29');
  check('... the same words, department and date (already created on an earlier run): not created twice, not listed', !ex.fresh.some((f) => f.descr === 'ג\'ריקן') && !ex.dropped.length, [ex.fresh, ex.dropped]);
  ex = diffEdits(back.concat([row('נ-9', { 3: 'תוצג', 5: 'ליקוי שהוקלד בקובץ' })]), last1, HZ, TR, '2026-09-29');
  check('a new נ- row typed in the file: listed "tru_new" (a trustee finding opens only from the app)', why(ex, 'tru_new').length === 1 && why(ex, 'tru_new')[0].val === 'ליקוי שהוקלד בקובץ', ex.dropped);
  ex = diffEdits(back.concat([row('', { 3: 'תוצג', 4: 'מחסן', 6: 'גבוהה' })]), last1, HZ, TR, '2026-09-29');
  check('a row with a department and a place but no description: listed "nodescr"', why(ex, 'nodescr').length === 1 && why(ex, 'nodescr')[0].ci === 5, ex.dropped);
  ex = diffEdits(back.concat([row('', { 10: 'פתוח' })]), last1, HZ, TR, '2026-09-29');
  check('... a row with only a status in it (an empty line): not listed', !why(ex, 'nodescr').length, ex.dropped);
  const asOut = await readSheetRows(out, { sheet: 'מאגר מפגעים', lastCol: 12, maxRow: 8, dateCols: [1, 9, 11] });
  const b1 = back.find((b) => b.v[0] === 1), o1 = asOut.find((b) => b.v[0] === 1);
  ex = diffEdits(back.concat([{ r: 95, v: Object.assign(b1.v.slice(), { 12: 'עותק ששונה' }) }]), last1, HZ, TR, '2026-09-29');
  check('the same number on two rows, the second one different: listed "seen"', why(ex, 'seen').length === 1 && why(ex, 'seen')[0].n === '1', ex.dropped);
  ex = diffEdits(asOut.concat([{ r: 95, v: o1.v.slice() }]), last1, HZ, TR, '2026-09-29');
  check('... the second an exact copy: not listed', !why(ex, 'seen').length, ex.dropped);
  ex = diffEdits(back, last1, HZ.filter((h) => h.id !== 'th-2'), TR, '2026-09-29');
  check('edited in Excel, deleted from the app meanwhile: listed "gone"', why(ex, 'gone').length === 1 && why(ex, 'gone')[0].n === '2', ex.dropped);
  ex = diffEdits(asOut, last1, HZ.filter((h) => h.id !== 'th-2'), TR, '2026-09-29');
  check('... not edited: not listed', !why(ex, 'gone').length, ex.dropped);
  ex = diffEdits(back, lastDup, HZ.concat([{ id: 'th-X', n: 2, dept: 'מעצבים', descr: 'כפול', s: 'פתוח' }]), TR, '2026-09-29');
  check('a number used twice in the last write, the row edited in Excel: listed "dup"', why(ex, 'dup').length === 1, ex.dropped);
  ex = diffEdits(await readSheetRows(out, { sheet: 'מאגר מפגעים', lastCol: 12, maxRow: 8, dateCols: [1, 9, 11] }), lastDup, HZ.concat([{ id: 'th-X', n: 2, dept: 'מעצבים', descr: 'כפול', s: 'פתוח' }]), TR, '2026-09-29');
  check('... not edited: not listed', !why(ex, 'dup').length, ex.dropped);
  ex = diffEdits(shifted, last1, HZ, TR, '2026-09-29');
  check('a נ- row whose words match no finding: listed "nomatch"', why(ex, 'nomatch').length === 1, ex.dropped);
  const shifted2 = back.map((b) => (b.v[0] === 'נ-1' ? { r: b.r, v: b.v.slice().map((x, i) => (i === 5 ? 'שמן' : i === 1 ? '2026-09-24' : x)) } : b));
  ex = diffEdits(shifted2, last1, HZ, TR, '2026-09-29');
  check('... a נ- row that is another finding\'s row shifted (stale copy): not listed', !why(ex, 'nomatch').length, ex.dropped);
  const sevE = back.map((b) => (b.v[0] === 2 ? { r: b.r, v: b.v.map((x, i) => (i === 6 ? 'גבוהה' : x)) } : b));
  ex = diffEdits(sevE, last1, HZ, TR, '2026-09-29');
  const it = ex.dropped.find((d) => d.ci === 6);
  check('a cell the app does not take: listed with its reason and the record it belongs to', it && it.why === 'keep' && it.id === 'h:th-2', it);

  const reg0 = buildRegister(HZ, TR), NOW = '2026-09-29T12:00:00Z';
  const itm = { n: '2', r: 3, ci: 6, val: 'גבוהה', why: 'keep', id: 'h:th-2', at: '2026-09-28T09:00:00Z' };
  let mg = mergeDropped([itm], [], reg0, HZ, TR, NOW);
  check('the list collects: an earlier item stays when the next save has nothing new', mg.length === 1 && mg[0].at === itm.at, mg);
  mg = mergeDropped([itm], [Object.assign({}, itm, { r: 4, at: undefined }), { n: '1', r: 2, ci: 12, val: 'x', why: 'both', id: 'h:th-1' }], reg0, HZ, TR, NOW);
  check('the same row/column/value twice is one item, keeping when it was first seen; new ones are added', mg.length === 2 && mg.filter((x) => x.ci === 6).length === 1 && mg.find((x) => x.ci === 6).at === itm.at && mg.find((x) => x.ci === 12).at === NOW, mg);
  const HZs = HZ.map((h) => (h.id === 'th-2' ? Object.assign({}, h, { sev: 'גבוהה' }) : h));
  mg = mergeDropped([itm], [], buildRegister(HZs, TR), HZs, TR, NOW);
  check('the value reached the app (severity set to גבוהה there): the item leaves by itself', mg.length === 0, mg);
  const legacy = { n: '2', r: 3, ci: 6, val: 'גבוהה' };
  check('an item stored before today (no record id): found by its number, leaves once the app has the value', mergeDropped([legacy], [], buildRegister(HZs, TR), HZs, TR, NOW).length === 0 && mergeDropped([legacy], [], reg0, HZ, TR, NOW, { prevAt: '2026-09-29T08:00:00Z' })[0].at === '2026-09-29T08:00:00Z');
  check('older than 30 days: dropped from the list', mergeDropped([Object.assign({}, itm, { at: '2026-08-20T09:00:00Z' })], [], reg0, HZ, TR, NOW).length === 0);
  check('marked handled (its key in the dismissed list): gone, and a run does not bring it back', mergeDropped([itm], [itm], reg0, HZ, TR, NOW, { dismissed: [dropKey(itm)] }).length === 0);
  check('a new-row item leaves once a record with those words exists in the app', mergeDropped([{ n: 'נ-9', r: 9, ci: -1, val: 'פנס', why: 'tru_new' }], [], reg0, HZ, TR, NOW).length === 0 && mergeDropped([{ n: 'נ-9', r: 9, ci: -1, val: 'משהו אחר', why: 'tru_new' }], [], reg0, HZ, TR, NOW).length === 1);

  // end to end: a save in Excel adds to what was listed before; a change in the app clears what it fixed
  const oldItem = { n: 'נ-9', r: 9, ci: -1, val: 'ליקוי ישן', why: 'tru_new', at: '2026-09-28T10:00:00Z' };
  w = world({ file: await writeZip(saved2), state: Object.assign({}, s1, { hazard_xlsm_dropped: JSON.stringify({ at: '2026-09-28T10:00:00Z', items: [oldItem] }) }), cTag: 'someone-saved', hazards: HZ.concat([{ id: 'th-3', n: 3, d: '2026-09-28', dept: 'תוצג', descr: 'חדש', s: 'פתוח' }]) });
  r = await runFile(ENV, 'xlsm', false);
  let st2 = JSON.parse(w.state.hazard_xlsm_dropped || '{}').items || [];
  check('a save in Excel: the new item is added, the one from before is still listed (it used to be replaced)', r.pushed && st2.length === 2 && st2.some((x) => x.val === 'ליקוי ישן') && st2.some((x) => x.ci === 6 && x.why === 'keep'), st2);
  const fixItem = { n: '3', r: 4, ci: 5, val: 'חדש מתוקן', why: 'keep', id: 'h:th-3', at: '2026-09-28T10:00:00Z' };
  w = world({ file: out, state: Object.assign({}, s1, { hazard_xlsm_dropped: JSON.stringify({ at: '2026-09-28T10:00:00Z', items: [oldItem, fixItem] }) }), cTag: 'c-ours-2', hazards: HZ.concat([{ id: 'th-3', n: 3, d: '2026-09-28', dept: 'תוצג', descr: 'חדש מתוקן', s: 'פתוח' }]) });
  r = await runFile(ENV, 'xlsm', false);
  st2 = JSON.parse(w.state.hazard_xlsm_dropped || '{}').items || [];
  check('a change in the app only (no Excel save): what it fixed leaves the list, the rest stays', r.pushed && st2.length === 1 && st2[0].val === 'ליקוי ישן', st2);
  // "טופל": op dismiss (admin or manager)
  w = world({ state: { hazard_xlsm_dropped: JSON.stringify({ at: NOW, items: [oldItem, itm] }) } });
  const wf = globalThis.fetch;
  globalThis.fetch = async (u, init) => (String(u).includes('/auth/v1/user') ? new Response(JSON.stringify({ email: 'admin@tfugen.local' }), { status: 200 }) : wf(u, init));
  const dreq = (b) => new Request('https://x/api/hazard-file', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer t', Origin: 'https://tapugan-safety.pages.dev' }, body: JSON.stringify(b) });
  const dres = await (await onRequest({ request: dreq({ op: 'dismiss', file: 'xlsm', key: dropKey(oldItem) }), env: ENV })).json();
  const after = JSON.parse(w.state.hazard_xlsm_dropped).items;
  check('"טופל" removes that one item and remembers it apart', dres.ok && dres.left === 1 && after.length === 1 && after[0].ci === 6 && JSON.parse(w.state.hazard_xlsm_dismissed)[0] === dropKey(oldItem), [dres, after, w.state.hazard_xlsm_dismissed]);
  globalThis.fetch = async (u, init) => (String(u).includes('/auth/v1/user') ? new Response('{}', { status: 401 }) : wf(u, init));
  const bad = await onRequest({ request: dreq({ op: 'dismiss', file: 'xlsm', key: dropKey(itm) }), env: ENV });
  check('... without a valid session: refused, nothing removed', bad.status === 401 && JSON.parse(w.state.hazard_xlsm_dropped).items.length === 1, bad.status);
  globalThis.fetch = wf;

  console.log('\n3c. one run per file (29/09: overlapping runs wrote an old copy)');
  w = world({ file: src, lockHeld: true });
  r = await runFileLocked(ENV, 'xlsm', true);
  check('file busy with another run: nothing read or written, a mark left for it', r.reason === 'busy' && !w.puts.length && !!w.state.hazard_xlsm_dirty, r);
  w = world({ file: src });
  const pr = [runFileLocked(ENV, 'xlsm', true), runFileLocked(ENV, 'xlsm', true)];
  const both = await Promise.all(pr);
  const nPush = w.puts.filter((p) => /2026\/ניהול סיורי מפגעים\.xlsm:/.test(p.path)).length;
  check('two at once: one waits (busy), the holder runs again for it, and the lease is given back', both.some((x) => x.reason === 'busy') && nPush >= 2 && w.state.hazard_xlsm_lock === '', [both.map((x) => x.reason || x.pushed), nPush, w.state.hazard_xlsm_lock]);

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
  check('... and the notification retry rides the same tick (trustee-notify op:retry, upgrade review 10)', w.calls.some((c) => c.startsWith('POST https://tapugan-safety.pages.dev/api/trustee-notify')), w.calls.filter((c) => c.startsWith('POST https://tapugan')));
  const w2 = world({ file: src });
  const waits2 = [];
  res = await onRequest({ request: req({ 'x-notify-secret': 'nsec' }, { file: 'xlsx' }), env: ENV, waitUntil: (p) => waits2.push(p) });
  j = await res.json();
  await Promise.all(waits2);
  check('the xlsx call writes the xlsx, then calls for the deck (not the xlsx again)', j.ok && j.file === 'xlsx' && j.next === 'deck' && waits2.length === 1 && w2.puts.some((p) => /2026\/ניהול סיורי מפגעים\.xlsx:/.test(p.path)) && w2.calls.some((c) => c.startsWith('POST https://tapugan-safety.pages.dev/api/hazard-deck')), j);

  console.log('\n8b. photos in column P (29/09/2026): manager and trustee photos alike');
  {
    const HZp = HZ.map((h) => (h.id === 'th-2' ? Object.assign({}, h, { photo_url: PH('open') }) : Object.assign({}, h, { photo_url: PH('closed-old') })));
    const TRp = TR.map((r) => (r.id === 'a' ? Object.assign({}, r, { photo_url: PH('trustee') }) : r.id === 'b' ? Object.assign({}, r, { photo_url: 'pending:abc' }) : r));
    let pw = world({ file: await fixture(), hazards: HZp, reports: TRp });
    let pr = await runFile(ENV, 'xlsm', true);
    const main = pw.puts.find((p) => /2026\/ניהול סיורי מפגעים\.xlsm:/.test(p.path));
    const z = readZip(main.body), names = z.map((e) => e.name);
    const sx = await sheetOf(main.body, 'xl/worksheets/sheet2.xml');
    const dx = await sheetOf(main.body, 'xl/drawings/drawing1.xml');
    const drels = await sheetOf(main.body, 'xl/drawings/_rels/drawing1.xml.rels');
    const srels = await sheetOf(main.body, 'xl/worksheets/_rels/sheet2.xml.rels');
    const ct = await sheetOf(main.body, '[Content_Types].xml');
    const rowOf = (id) => { const l = JSON.parse(pw.state.hazard_xlsm_last); return l.ids.indexOf(id) + 2; };
    check('written, one sign call for all, a thumbnail per open / recent photo (the closed June one: none)', pr.ok && pr.pushed && pw.signs === 1 && pw.thumbs === 2, [pr, pw.signs, pw.thumbs]);
    check('two pictures in a new drawing, each moving and hiding with its row, clickable to the full photo', (dx.match(/<xdr:twoCellAnchor editAs="twoCell">/g) || []).length === 2 && (dx.match(/name="TS-photo \d+"/g) || []).length === 2 && (dx.match(/<a:hlinkClick r:id="rIdH\d+"\/>/g) || []).length === 2 && /TargetMode="External"/.test(drels) && names.filter((n) => /^xl\/media\/tsphoto\d+\.jpeg$/.test(n)).length === 2, dx.slice(0, 300));
    check('the pictures sit in P on the rows of th-2 and trustee finding a', dx.includes('name="TS-photo ' + rowOf('h:th-2') + '"') && dx.includes('name="TS-photo ' + rowOf('t:a') + '"') && /<xdr:from><xdr:col>15<\/xdr:col>/.test(dx), dx.match(/name="TS-photo \d+"/g));
    check('the sheet points at the drawing, the package knows it and the jpeg type', /<drawing r:id="rIdD1"\/><\/worksheet>/.test(sx) && /Target="\.\.\/drawings\/drawing1\.xml"/.test(srels) && ct.includes('/xl/drawings/drawing1.xml') && /<Default Extension="jpeg"/.test(ct), [sx.slice(-200), srels, ct.slice(-300)]);
    check('P1 "תמונה", P as wide as a picture; the closed one gets "פתיחה בגודל מלא" linked; pending (not uploaded) photos nothing', /<c r="P1"[^>]*><is><t>תמונה<\/t>/.test(sx) && /<col min="16" max="16" width="17" customWidth="1"\/>/.test(sx) && sx.includes('<c r="P' + rowOf('h:th-1') + '" t="inlineStr"><is><t>פתיחה בגודל מלא</t>') && (sx.match(/<hyperlink ref="P\d+"/g) || []).length === 3 && !sx.includes('<c r="P' + rowOf('t:b') + '"'), sx.match(/<hyperlinks>[\s\S]*<\/hyperlinks>/));
    check('a row with a picture is tall enough for it', +((new RegExp('<row r="' + rowOf('h:th-2') + '"[^>]*\\bht="([\\d.]+)"').exec(sx)) || [])[1] >= 59);
    check('the register filter and data are as before (A..M untouched by the pictures)', /<autoFilter ref="A1:M8"><filterColumn colId="10">/.test(sx) && sx.includes("ג'ריקן"));
    // Next write: th-2's photo removed in the app. The old pictures go, media too; no duplicate links.
    const s1p = Object.assign({}, pw.state);
    pw = world({ file: main.body, state: s1p, cTag: s1p.hazard_xlsm_ctag, hazards: HZp.map((h) => (h.id === 'th-2' ? Object.assign({}, h, { photo_url: null }) : h)), reports: TRp });
    pr = await runFile(ENV, 'xlsm', false);
    const m2 = pw.puts.find((p) => /2026\/ניהול סיורי מפגעים\.xlsm:/.test(p.path));
    check('a photo removed in the app: the file is written again (photos are in the signature)', pr.pushed && !!m2, pr);
    const d2 = await sheetOf(m2.body, 'xl/drawings/drawing1.xml'), s2 = await sheetOf(m2.body, 'xl/worksheets/sheet2.xml'), r2 = await sheetOf(m2.body, 'xl/drawings/_rels/drawing1.xml.rels');
    check('rewritten: one picture, one media file, its relationships only, links not doubled, one drawing element', (d2.match(/TS-photo/g) || []).length === 1 && readZip(m2.body).filter((e) => /^xl\/media\//.test(e.name)).length === 1 && (r2.match(/<Relationship /g) || []).length === 2 && (s2.match(/<hyperlink ref="P\d+"/g) || []).length === 2 && (s2.match(/<drawing /g) || []).length === 1, [d2.length, r2]);
    // Someone's own picture in the drawing (saved in Excel): kept.
    const own = readZip(m2.body).map((e) => (e.name === 'xl/drawings/drawing1.xml' ? { name: e.name, text: null } : e));
    own.find((e) => e.name === 'xl/drawings/drawing1.xml').text = d2.replace('</xdr:wsDr>', '<xdr:oneCellAnchor><xdr:from><xdr:col>1</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:ext cx="1" cy="1"/><xdr:sp><xdr:nvSpPr><xdr:cNvPr id="40" name="My logo"/></xdr:nvSpPr></xdr:sp><xdr:clientData/></xdr:oneCellAnchor></xdr:wsDr>');
    pw = world({ file: await writeZip(own), hazards: HZp, reports: TRp });
    pr = await runFile(ENV, 'xlsm', true);
    const d3 = await sheetOf(pw.puts.find((p) => /2026\/ניהול סיורי מפגעים\.xlsm:/.test(p.path)).body, 'xl/drawings/drawing1.xml');
    check('a drawing someone added to (their own shape): theirs kept, ours replaced, ids do not clash', d3.includes('name="My logo"') && (d3.match(/TS-photo/g) || []).length === 2 && !/cNvPr id="40" name="TS/.test(d3), d3.match(/cNvPr id="\d+" name="[^"]+"/g));
    // Saved in Excel (01/10/2026, the live xlsm opened as damaged): Excel declares
    // r: on each <a:blip xmlns:r=...>, not on the root. Our old pictures go with
    // their declarations; the new ones must still be declared, on the root.
    const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
    const exXml = d2.replace(/<xdr:wsDr\b([^>]*)>/, (m, a) => '<xdr:wsDr' + a.replace(/\s+xmlns:r="[^"]*"/, '') + '>').replace(/<a:blip r:embed=/g, '<a:blip xmlns:r="' + R + '" r:embed=').replace(/<a:hlinkClick r:id=/g, '<a:hlinkClick xmlns:r="' + R + '" r:id=');
    check('fixture: an Excel-style drawing, r: declared only inside the picture', !/<xdr:wsDr\b[^>]*xmlns:r=/.test(exXml) && /<a:blip xmlns:r=/.test(exXml));
    const exE = readZip(m2.body).map((e) => (e.name === 'xl/drawings/drawing1.xml' ? { name: e.name, text: exXml } : e));
    pw = world({ file: await writeZip(exE), hazards: HZp, reports: TRp });
    pr = await runFile(ENV, 'xlsm', true);
    const d4 = await sheetOf(pw.puts.find((p) => /2026\/ניהול סיורי מפגעים\.xlsm:/.test(p.path)).body, 'xl/drawings/drawing1.xml');
    const undeclared = (d4.match(/<[a-z:]+\b[^>]*\sr:(?:embed|id)="[^"]*"[^>]*>/g) || []).filter((t) => !/xmlns:r=/.test(t)).length;
    check('rewritten after Excel saved it: the root declares r:, so every r:embed / r:id is valid (Excel no longer drops the drawing)', /<xdr:wsDr\b[^>]*\sxmlns:r="/.test(d4) && (d4.match(/TS-photo/g) || []).length === 2 && undeclared > 0, d4.slice(0, 400));
    // The real sheet has cell comments: a legacyDrawing and a rels file already.
    const withNotes = readZip(await fixture()).map((e) => (e.name === 'xl/worksheets/sheet2.xml' ? { name: e.name, text: null } : e));
    withNotes.find((e) => e.name === 'xl/worksheets/sheet2.xml').text = reg(regRows()).replace('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">', '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">').replace('</worksheet>', '<legacyDrawing r:id="rId1"/></worksheet>');
    withNotes.push({ name: 'xl/worksheets/_rels/sheet2.xml.rels', text: '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/vmlDrawing" Target="../drawings/vmlDrawing1.vml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="../comments1.xml"/></Relationships>' });
    pw = world({ file: await writeZip(withNotes), hazards: HZp, reports: TRp });
    pr = await runFile(ENV, 'xlsm', true);
    const nb = pw.puts.find((p) => /2026\/ניהול סיורי מפגעים\.xlsm:/.test(p.path)).body;
    const ns = await sheetOf(nb, 'xl/worksheets/sheet2.xml'), nr = await sheetOf(nb, 'xl/worksheets/_rels/sheet2.xml.rels');
    check('a sheet with comments: the drawing goes before legacyDrawing, the comment relationships stay, ids do not clash', /<drawing r:id="(rIdD1)"\/><legacyDrawing r:id="rId1"\/>/.test(ns) && nr.includes('vmlDrawing1.vml') && nr.includes('comments1.xml') && /Id="rIdD1"[^>]*drawing1\.xml/.test(nr) && /<hyperlinks>[\s\S]*<\/hyperlinks><drawing/.test(ns) && (ns.match(/xmlns:r=/g) || []).length === 1, [ns.slice(-400), nr]);
    pw = world({ file: await fixture(), hazards: HZp, reports: TRp, badThumb: true });
    pr = await runFile(ENV, 'xlsm', true);
    const s4 = await sheetOf(pw.puts.find((p) => /2026\/ניהול סיורי מפגעים\.xlsm:/.test(p.path)).body, 'xl/worksheets/sheet2.xml');
    check('thumbnails that are not a picture: no drawing at all, every photo still linked as text', pr.pushed && !/<drawing /.test(s4) && (s4.match(/פתיחה בגודל מלא/g) || []).length === 3, pr);
  }

  console.log('\n9. the archive: a copy each month, copies older than 30 days deleted (29/09/2026)');
  const arch = (o) => {
    const a = { state: Object.assign({}, o.state || {}), puts: [], dels: [], calls: [] };
    globalThis.fetch = async (url, init) => {
      const u = String(url), m = (init && init.method) || 'GET', du = decodeURIComponent(u);
      a.calls.push(m + ' ' + du);
      const json = (x, st = 200) => new Response(JSON.stringify(x), { status: st, headers: { 'Content-Type': 'application/json' } });
      if (u.startsWith(SB + '/rest/v1/server_state')) {
        if (m === 'POST') { JSON.parse(init.body).forEach((r) => { a.state[r.key] = r.value; }); return new Response(null, { status: 201 }); }
        return json(Object.keys(a.state).map((k) => ({ key: k, value: a.state[k], updated_at: 'x' })));
      }
      if (u.startsWith(SB + '/rest/v1/oauth_tokens')) return json([{ user_email: 'sviva@tapugan.co.il', refresh_token: 'rt', access_token: 'at', expires_at: new Date(Date.now() + 3600e3).toISOString(), scope: 'Files.ReadWrite' }]);
      if (m === 'GET' && /ארכיון\/חודשי\//.test(du)) return o.monthlyThere ? json({ id: 'x' }) : json({ error: {} }, 404);
      if (m === 'GET' && /גרסאות שנדרסו:\/children/.test(du)) return json({ value: o.children || [] });
      if (m === 'GET' && /2026\/ניהול סיורי מפגעים\.xlsm\?/.test(du)) return json({ id: 'f', '@microsoft.graph.downloadUrl': 'https://dl/file' });
      if (u === 'https://dl/file') return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
      if (m === 'PUT') { a.puts.push(du.split('/root:/')[1]); return json({ cTag: 'c' }); }
      if (m === 'DELETE') { a.dels.push(du.split('/items/')[1]); return new Response(null, { status: 204 }); }
      return json({ error: 'unexpected ' + u }, 599);
    };
    return a;
  };
  check('month name: "- 09-2026.xlsm"', stampMonth('ניהול סיורי מפגעים.xlsm', '2026-09') === 'ניהול סיורי מפגעים - 09-2026.xlsm');
  let aw = arch({});
  let ar = await runArchive(ENV, new Date('2026-09-29T12:00:00Z'));
  check('first run in the middle of a month: no copy (the month is not over), remembers August', !aw.puts.length && aw.state.hazard_snap_month === '2026-08' && ar.snap === 'from next month', [ar, aw.puts]);
  aw = arch({ state: { hazard_snap_month: '2026-08', hazard_prune_day: '2026-09-29' } });
  ar = await runArchive(ENV, new Date('2026-09-29T15:00:00Z'));
  check('same day, same month: nothing to do, not even a token', ar.reason === 'nothing to do' && !aw.calls.some((c) => /graph|oauth/.test(c)), aw.calls);
  const kids = [
    { id: 'old1', name: 'ניהול סיורי מפגעים - 28-08-2026 16.56.xlsm', createdDateTime: '2026-08-28T13:56:00Z', file: {} },
    { id: 'old2', name: 'ניהול סיורי מפגעים - 2026-08-20 10-00.xlsx', createdDateTime: '2026-08-20T10:00:00Z', file: {} },
    { id: 'new1', name: 'ניהול סיורי מפגעים - 29-09-2026 11.36.xlsm', createdDateTime: '2026-09-29T08:36:00Z', file: {} },
    { id: 'other', name: 'הערות שלי.xlsx', createdDateTime: '2026-01-01T00:00:00Z', file: {} },
    { id: 'dir', name: 'ניהול סיורי מפגעים - 01-01-2026 10.00.xlsm', createdDateTime: '2026-01-01T00:00:00Z', folder: {} },
  ];
  aw = arch({ state: { hazard_snap_month: '2026-08', hazard_prune_day: '2026-09-30' }, children: kids });
  ar = await runArchive(ENV, new Date('2026-10-01T00:20:00Z'));
  check('1/10 (Israel): the xlsm is copied to ארכיון/חודשי as "- 09-2026.xlsm", September remembered', aw.puts.length === 1 && /2026\/ארכיון\/חודשי\/ניהול סיורי מפגעים - 09-2026\.xlsm:\/content/.test(aw.puts[0]) && aw.state.hazard_snap_month === '2026-09', [aw.puts, aw.state]);
  check('only the server\'s own copies older than 30 days are deleted: not the new one, not another file, not a folder', aw.dels.join() === 'old1,old2' && aw.state.hazard_prune_day === '2026-10-01', aw.dels);
  check('nothing outside גרסאות שנדרסו is listed or deleted', aw.calls.filter((c) => /children/.test(c)).every((c) => /ארכיון\/גרסאות שנדרסו:\/children/.test(c)) && aw.calls.filter((c) => /^DELETE/.test(c)).length === 2, aw.calls);
  aw = arch({ state: { hazard_snap_month: '2026-08', hazard_prune_day: '2026-10-01' }, monthlyThere: true });
  ar = await runArchive(ENV, new Date('2026-10-01T09:00:00Z'));
  check('the month\'s copy already there: not written again', !aw.puts.length && ar.snap === 'already there' && aw.state.hazard_snap_month === '2026-09', ar);
  const lots = Array.from({ length: 25 }, (_, i) => ({ id: 'o' + i, name: 'ניהול סיורי מפגעים - 01-08-2026 10.' + String(i).padStart(2, '0') + '.xlsm', createdDateTime: '2026-08-01T07:00:00Z', file: {} }));
  aw = arch({ state: { hazard_snap_month: '2026-09', hazard_prune_day: '2026-10-01' }, children: lots });
  ar = await runArchive(ENV, new Date('2026-10-02T09:00:00Z'));
  check('more than 20 old copies: 20 deleted, the day not marked, so the rest go on the next run', aw.dels.length === 20 && aw.state.hazard_prune_day === '2026-10-01', [aw.dels.length, aw.state.hazard_prune_day]);

  console.log('\n10. a file per year (upgrade review 24, Michael 30/09/2026)');
  {
    const { yearReg, ilYear, folderFor, FIRST_YEAR, FULL_WARN, yearItem } = await import('./_build/hazard-file.mjs');
    check('Israel year: 31/12 22:30 UTC is already 2027 there', ilYear('2026-12-31T22:30:00Z') === 2027 && ilYear('2026-12-31T21:30:00Z') === 2026);
    check('the folder is 13_סיורי מפגעים/<year>', /13_סיורי מפגעים\/2027$/.test(folderFor(2027)) && FIRST_YEAR === 2026);
    const R = (d, s, c) => [1, d ? { date: d } : null, 1, 'מעצבים', '', 'x', '', '', '', null, s, c ? { date: c } : null, ''];
    const all = { rows: [R('2026-05-01', 'סגור', '2026-06-01'), R('2026-11-01', 'פתוח', null), R('2026-12-20', 'סגור', '2027-01-03'), R('2027-01-05', 'פתוח', null), R(null, 'סגור', null), R('2026-10-01', 'בטיפול', null)], ids: ['a', 'b', 'c', 'd', 'e', 'f'] };
    check('2026: every row, as today', yearReg(all, 2026).rows.length === 6);
    const y7 = yearReg(all, 2027);
    check('2027: this year\'s, all still open (פתוח / בטיפול) and those closed in 2027; not those closed in 2026', y7.ids.join() === 'b,c,d,f', y7.ids);
    check('...ids stay with their rows', y7.rows[1][11].date === '2027-01-03' && y7.ids[1] === 'c');

    // Roll-over: 01/01/2027, the 2027 folder is empty.
    const file = await fixture();
    let wy = world({ file, years: [2026] });
    let r = await runFile(ENV, 'xlsm', false, { now: '2027-01-01T06:00:00Z' });
    const p27 = wy.puts.filter((p) => /13_סיורי מפגעים\/2027\/ניהול סיורי מפגעים\.xlsm:\/content$/.test(p.path));
    check('the 2026 file is copied into 2027 as it is, then written there', r.ok && r.pushed && p27.length >= 2 && Buffer.from(p27[0].body).equals(Buffer.from(file)), [r, wy.puts.map((p) => p.path)]);
    check('nothing is written into the 2026 folder\'s file', !wy.puts.some((p) => /13_סיורי מפגעים\/2026\/ניהול סיורי מפגעים\.xlsm:/.test(p.path)), wy.puts.map((p) => p.path));
    check('the 2027 file: the open hazard and the open trustee finding, not those closed in 2026', r.rows === 2 && wy.state.hazard_xlsm_rows === '2' && wy.state.hazard_xlsm_year === '2027', [r.rows, wy.state.hazard_xlsm_rows]);
    wy = world({ file, years: [2026, 2027] });
    r = await runFile(ENV, 'xlsm', false, { now: '2027-01-01T06:15:00Z' });
    check('2027 file already there: last year\'s is not read or copied', r.ok && !wy.calls.some((c) => /13_סיורי מפגעים\/2026\//.test(c)), wy.calls.filter((c) => /graph/.test(c)));
    wy = world({ file, years: [2026] });
    r = await runFile(ENV, 'xlsm', false, { now: '2026-12-31T20:00:00Z' });
    check('in 2026: the 2026 folder, every row (4), no copy anywhere', r.ok && r.rows === 4 && wy.puts.every((p) => /\/2026\//.test(p.path)), [r.rows, wy.puts.map((p) => p.path)]);
    wy = world({ file, years: [] });
    const yi = await yearItem('t', 'ניהול סיורי מפגעים.xlsm', 'x', 2026, 'id');
    check('the first year never copies from 2025', yi.mr.status === 404 && !yi.rolled && !wy.puts.length);

    // Full: more rows than the sheet has prepared.
    const many = Array.from({ length: 206 }, (_, i) => ({ id: 'm' + i, n: i + 1, d: '2026-09-01', tour_no: 1, dept: 'מעצבים', loc: '', descr: 'מפגע ' + i, sev: 'נמוכה', resp: '', due: null, s: 'פתוח', closed_d: null, notes: '' }));
    wy = world({ file, years: [2026], hazards: many, reports: [] });
    r = await runFileLocked(ENV, 'xlsm', true, { now: '2026-12-01T06:00:00Z' });
    check('full: a Hebrew error (the tours screen and the watchdog show it), the file not written', !r.ok && /הקובץ מלא: 206 שורות/.test(r.error || '') && /הקובץ מלא/.test(wy.state.hazard_xlsm_err || '') && !wy.puts.some((p) => /\/ניהול סיורי מפגעים\.xlsm:\/content$/.test(p.path) && !/ארכיון/.test(p.path)), [r, wy.state.hazard_xlsm_err]);
    check('the warning is at 80% of the 205 rows (164)', FULL_WARN === 164 && Math.ceil(205 * 0.8) === FULL_WARN);

    // The monthly copy of December 2026 comes from, and goes to, 2026.
    aw = arch({ state: { hazard_snap_month: '2026-11', hazard_prune_day: '2027-01-01' } });
    ar = await runArchive(ENV, new Date('2027-01-01T08:00:00Z'));
    check('1/1/2027: December\'s copy is read from 2026 and kept in 2026/ארכיון/חודשי', aw.puts.length === 1 && /2026\/ארכיון\/חודשי\/ניהול סיורי מפגעים - 12-2026\.xlsm:\/content/.test(aw.puts[0]) && aw.calls.some((c) => /GET .*2026\/ניהול סיורי מפגעים\.xlsm\?/.test(c)), [aw.puts, aw.calls.filter((c) => /xlsm\?/.test(c))]);
    aw = arch({ state: { hazard_snap_month: '2026-12', hazard_prune_day: '2027-01-01' } });
    ar = await runArchive(ENV, new Date('2027-01-02T08:00:00Z'));
    check('from 2027 the old copies of both years are cleaned', aw.calls.some((c) => /2027\/ארכיון\/גרסאות שנדרסו:\/children/.test(c)) && aw.calls.some((c) => /2026\/ארכיון\/גרסאות שנדרסו:\/children/.test(c)), aw.calls.filter((c) => /children/.test(c)));

    const src = (f) => fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), '../../functions/', f), 'utf8');
    const hd = src('api/hazard-deck.js'), hr = src('api/hazard-report.js'), wd = src('_watchdog.js'), hf = src('api/hazard-file.js');
    check('the deck moves with the year (yearItem), and is written in that year\'s folder', /yearItem\(token, DECK\.name, DECK\.type, ilYear/.test(hd) && /const FOLDER = folderFor\(ilYear/.test(hd) && !/import \{[^}]*\bFOLDER\b/.test(hd));
    check('the department report reads this year\'s workbook, last year\'s until the copy exists', /book0\(ilYear\(\)\)/.test(hr) && /r\.status === 404\) r = await book0\(ilYear\(\) - 1\)/.test(hr));
    check('the watchdog\'s numbers are the file\'s (205 rows, warn at 164)', /FILE_ROWS = 205, FULL_WARN = 164/.test(wd) && /MAX_ROW = 206/.test(hf));
  }

  // Upgrade review 22 (30/09/2026): the free plan's 50 subrequests. The mock
  // throws on the 51st call, as Cloudflare does.
  console.log('\n14. the subrequest budget');
  {
    const cap = (n) => { const f = globalThis.fetch; let k = 0; globalThis.fetch = async (u, i) => { if (++k > n) throw new Error('Too many subrequests.'); return f(u, i); }; return () => k; };
    const busy = Array.from({ length: 20 }, (_, i) => ({ id: 'th-b' + i, n: i + 1, d: '2026-09-29', tour_no: 30, dept: 'מעצבים', loc: 'אולם', descr: 'מפגע ' + i, sev: 'בינונית', resp: 'מנהל המחלקה', due: '2026-10-05', s: 'פתוח', closed_d: null, notes: null, photo_url: PH('b' + i) }));
    const trb = [0, 1, 2, 3].map((i) => ({ id: 'tb' + i, u: 'מוסא', t: 1, d: '2026-09-29', loc: 'חומר גלם · רחבה', ok: false, s: 'פתוח', f: 'ממצא ' + i, ts: '2026-09-29T0' + i + ':00:00Z' }));
    const AENV = { ...ENV, GEMINI_API_KEY: 'g' };
    const run = (env, force) => runFileLocked(env, 'xlsm', force, { budget: subBudget().spend(4) }); // + the four requests the tick fires
    // A file the server wrote, then k hazards closed in Excel.
    const base = async () => { const b = world({ file: await fixture(30), hazards: busy, reports: trb }); await runFile(ENV, 'xlsm', true); return { out: b.puts.filter((q) => /2026\/ניהול סיורי מפגעים\.xlsm:/.test(q.path)).pop().body, s1: Object.assign({}, b.state) }; };
    const closeK = async (out, s1, k) => { const rows = JSON.parse(s1.hazard_xlsm_last).rows.map((x, i) => (i < k ? Object.assign(x.slice(), { 10: 'סגור', 11: { date: '2026-09-30' } }) : x)); return patchSheetRows(out, rows, { sheet: 'מאגר מפגעים', lastCol: 12, maxRow: 206, dateCols: [1, 9, 11] }); };
    const { out, s1 } = await base();
    // 12 edits + 3 suggestions + 12 thumbnails.
    const ed12 = await closeK(out, s1, 12);
    let wb = world({ file: ed12, state: s1, cTag: 'saved-in-excel', hazards: busy.map((x) => Object.assign({}, x)), reports: trb });
    let rb = await runFileLocked(AENV, 'xlsm', false, { budget: subBudget(1000).spend(4) });
    check('the busy day needs more than ' + SUB_LIMIT + ' subrequests without the budget', wb.calls.length + 4 > SUB_LIMIT && rb.pushed, wb.calls.length + 4);
    wb = world({ file: ed12, state: s1, cTag: 'saved-in-excel', hazards: busy.map((x) => Object.assign({}, x)), reports: trb });
    let n = cap(SUB_LIMIT - 4);
    rb = await run(AENV, false);
    let cnt = n();
    check('with the budget: the edits are taken and the file is written, inside 50', rb.ok && rb.pushed && rb.pulled && rb.pulled.hazards === 12 && cnt <= SUB_LIMIT - 4, { rb, cnt });
    check('the counter never under-counts (spent >= calls made)', rb.budget && rb.budget.used + 7 >= cnt, { used: rb.budget, cnt });
    check('thumbnails were given up first, and said so', rb.budget.pics > 0 && (wb.thumbs || 0) < 12, [rb.budget, wb.thumbs]);
    check('no signature kept, so the next run writes again with the pictures', wb.state.hazard_xlsm_sig === '' && !!wb.state.hazard_xlsm_ok_at, wb.state.hazard_xlsm_sig);
    const last = wb.puts.filter((q) => /2026\/ניהול סיורי מפגעים\.xlsm:/.test(q.path)).pop().body;
    const nx = world({ file: last, state: wb.state, cTag: wb.state.hazard_xlsm_ctag, hazards: busy.map((x, i) => (i < 12 ? Object.assign({}, x, { s: 'סגור', closed_d: '2026-09-30' }) : x)), reports: trb.map((r) => Object.assign({ action: 'לתקן את הממצא' }, r)) });
    n = cap(SUB_LIMIT - 4);
    const rn = await run(AENV, false);
    check('...and it does (not "unchanged"), with all 12 pictures, inside 50', rn.pushed && nx.thumbs === 12 && !rn.budget.pics && n() <= SUB_LIMIT - 4, [rn.reason, nx.thumbs, rn.budget]);
    // 20 edits: over what is left, the rest waits (as over MAX_PULL), nothing breaks.
    const ed20 = await closeK(out, s1, 20);
    const hz20 = busy.map((x) => Object.assign({}, x));
    wb = world({ file: ed20, state: s1, cTag: 'saved-in-excel', hazards: hz20, reports: trb.map((r) => Object.assign({ action: 'לתקן' }, r)) });
    n = cap(SUB_LIMIT - 4);
    rb = await run(ENV, false);
    cnt = n();
    check('20 edits: part taken, the rest waits for the next run, inside 50, no error', rb.ok && rb.reason === 'pulling' && rb.pulled.hazards > 0 && rb.pulled.hazards < 20 && rb.budget.edits === 20 - rb.pulled.hazards && cnt <= SUB_LIMIT - 4 && !wb.state.hazard_xlsm_err, { rb, cnt });
    const got = rb.pulled.hazards;
    const nx2 = world({ file: ed20, state: wb.state, cTag: 'saved-in-excel', hazards: busy.map((x, i) => (i < got ? Object.assign({}, x, { s: 'סגור', closed_d: '2026-09-30' }) : Object.assign({}, x))), reports: trb.map((r) => Object.assign({ action: 'לתקן' }, r)) });
    n = cap(SUB_LIMIT - 4);
    const r2 = await run(ENV, false);
    check('...the next run takes the rest and writes the file, inside 50', r2.pushed && r2.pulled && r2.pulled.hazards === 20 - got && n() <= SUB_LIMIT - 4, { r2 });
    // The file is not written at all (locked): the error is still recorded.
    wb = world({ file: ed12, state: s1, cTag: 'saved-in-excel', hazards: busy.map((x) => Object.assign({}, x)), reports: trb, locked: true });
    cap(SUB_LIMIT - 4);
    rb = await run(AENV, false);
    check('a failing run on a busy day still records its error', !rb.ok && rb.locked && !!wb.state.hazard_xlsm_err, [rb, wb.state.hazard_xlsm_err]);
    // Edits over what is left wait, as over MAX_PULL.
    const ed = { fresh: [], hazards: [1, 2, 3, 4, 5].map((i) => ({ id: 'th-b' + i, s: 'סגור' })), reports: [] };
    world({ file: await fixture() });
    const ap = await applyEdits(ENV, ed, busy.map((x) => Object.assign({}, x)), [], 2);
    check('applyEdits with 2 left: 2 written, the rest pending', ap.hazards === 2 && ap.pending && ap.calls === 2, ap);
    const ap0 = await applyEdits(ENV, { fresh: [{ id: 'th-new' }], hazards: [], reports: [] }, [], [], 0);
    check('...and with none left, not even the new-hazards request', ap0.pending && ap0.calls === 0 && !ap0.created, ap0);
  }

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
