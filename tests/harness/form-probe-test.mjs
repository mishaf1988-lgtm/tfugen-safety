// The weekly form probe (16/11/2026, Michael: "בצע: בדיקה שבועית לטופס"): Sunday from 06:00 the server fills form
// 146.03 with made-up details, saves one fixed Word file, has Microsoft make the PDF and reads its text; a failure goes to
// Michael. Here: when it is due, what counts as a failure (a date reversed, a name missing), and the run with mocked
// Graph: one file written (replaced, always the same name), a PDF that is not right -> one WhatsApp, a day runs once.
import { probeDue, probeData, probeFails, probeText, formProbe, PROBE_KEY, PROBE_DIR, PROBE_NAME, PROBE_COMPANY, PROBE_WORKERS } from './_build/_formprobe.mjs';
import { writeZip, readZip, entryText } from './_build/_xlsxpatch.mjs';
import { PDFDocument, StandardFonts } from './_build/_pdflib.mjs';
import { onRequest as rdbRequest } from './_build/routine-db.mjs';

let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 400) : '')); } };
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'srv', ROUTINE_KEY: 'k-123', WEEKEND_QUIET: 'off', META_PHONE_NUMBER_ID: '1', META_ACCESS_TOKEN: 't' };
const BAD = /[—–־«»“”‘’→←…]/;
const db = { state: {}, meta: [] };
const json = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { 'Content-Type': 'application/json' } });
const q = (u, k) => { const m = new RegExp('[?&]' + k + '=([^&]*)').exec(u); return m ? decodeURIComponent(m[1]) : null; };
globalThis.fetch = async (url, init) => {
  const u = String(url), m = (init && init.method) || 'GET';
  if (u.startsWith(SB + '/rest/v1/server_state')) {
    if (m === 'GET') { const k = (q(u, 'key') || '').slice(3); return json(db.state[k] ? [{ key: k, value: db.state[k] }] : []); }
    for (const r of JSON.parse(init.body)) db.state[r.key] = r.value; return json([]);
  }
  if (u.startsWith(SB + '/rest/v1/notification_prefs')) return json([{ prefs: { trustee_hazard: { whatsapp_to: '972500000000' } } }]);
  if (u.startsWith('https://graph.facebook.com/')) { db.meta.push(JSON.parse(init.body)); return json({ messages: [{ id: 'wamid.P' }] }); }
  return json([]);
};
const WNS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"';
const XP = (t) => '<w:p><w:pPr><w:bidi/></w:pPr><w:r><w:rPr><w:b w:val="false"/><w:bCs w:val="false"/><w:rtl/></w:rPr><w:t xml:space="preserve">' + t + '</w:t></w:r></w:p>';
const XR = (...c) => '<w:tr>' + c.map((t) => '<w:tc>' + XP(t) + '</w:tc>').join('') + '</w:tr>';
const TPL_DOC = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ' + WNS + '><w:body>' + XP('הצהרת הקבלן') + XP('קראתי את ההוראות, הבנתי אותן, ואני מתחייב לקיים אותן ולהדריך בהן את עובדיי.')
  + '<w:tbl>' + XR('שם הקבלן:', 'ת.ז.:', 'ח.פ / עוסק מורשה:') + XR('תאריך:', 'חתימה:', '') + '</w:tbl>' + XP('עובדי הקבלן')
  + '<w:tbl>' + XR('שם העובד', 'ת.ז.', 'חתימה') + Array(8).fill(XR('', '', '')).join('') + '</w:tbl></w:body></w:document>';
const TPL = await writeZip([
  { name: '[Content_Types].xml', text: '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default ContentType="application/xml" Extension="xml"/><Override ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml" PartName="/word/document.xml"/></Types>' },
  { name: 'word/document.xml', text: TPL_DOC },
  { name: 'word/_rels/document.xml.rels', text: '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId9" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.png"/></Relationships>' },
  { name: 'word/media/logo.png', bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]) }]);
const puts = [];
const deps = (pdf) => ({ accessToken: async () => ({ token: 'gt' }), formTemplate: async () => ({ name: 't.docx', bytes: TPL }),
  putFile: async (token, folder, name, bytes, type, conflict) => { puts.push({ folder, name, conflict, bytes }); return { webUrl: 'x' }; }, graphPdf: async () => pdf });
const latinPdf = async () => { const d = await PDFDocument.create(); const p = d.addPage(); p.drawText('hello 2026.11.22', { x: 50, y: 700, size: 12, font: await d.embedFont(StandardFonts.Helvetica) }); return new Uint8Array(await d.save()); };

(async () => {
  console.log('\n1. when');
  check('Sunday 06:00, not yet today', probeDue(0, 6, '2026-11-22', '2026-11-15'));
  check('not twice the same Sunday', !probeDue(0, 7, '2026-11-22', '2026-11-22'));
  check('not on Monday, not at 05:00, not in the evening', !probeDue(1, 6, 'd', 'x') && !probeDue(0, 5, 'd', 'x') && !probeDue(0, 18, 'd', 'x'));

  console.log('\n2. what counts as a failure');
  const day = '2026-11-22';
  const all = (extra) => (n) => (extra && Object.prototype.hasOwnProperty.call(extra, n) ? extra[n] : (/^\d{4}\./.test(n) ? 0 : 1));
  check('all there, nothing reversed = no failure', probeFails(all(), day).length === 0, probeFails(all(), day));
  check('a date reversed by Word is a failure', probeFails(all({ '2026.11.22': 1 }), day).some((b) => b.indexOf('הפוך') >= 0));
  check('a missing date is a failure', probeFails(all({ '22.11.2026': 0 }), day).some((b) => b.indexOf('22.11.2026') >= 0));
  check('a missing worker is a failure', probeFails(all({ [PROBE_WORKERS[1]]: 0 }), day).some((b) => b.indexOf(PROBE_WORKERS[1]) >= 0));
  check('the job dates in the form are DD.MM.YYYY', probeData(day).d.job.indexOf('22.11.2026 עד 25.11.2026') === 0, probeData(day).d.job);
  const t = probeText(['התאריך 22.11.2026 יצא הפוך (2026.11.22)']);
  check('the message: what failed and where the file is, keyboard only', t.indexOf('הפוך') >= 0 && t.indexOf(PROBE_NAME) >= 0 && !BAD.test(t), t);

  console.log('\n3. the run (Graph mocked)');
  let r = await formProbe(ENV, { dow: 0, hour: 6, day }, deps(await latinPdf()));
  check('it ran and found the PDF wrong (no Hebrew names, a reversed date)', r.ran && !r.ok && r.fails.some((b) => b.indexOf(PROBE_COMPANY) >= 0 || b.indexOf('שם החברה') >= 0) && r.fails.some((b) => b.indexOf('הפוך') >= 0), r);
  check('one Word file, always the same name and folder, replaced (no rename)', puts.length === 1 && puts[0].name === PROBE_NAME && puts[0].folder === PROBE_DIR && !puts[0].conflict, puts.map((p) => p.name));
  const xml = await entryText(readZip(puts[0].bytes).find((e) => e.name === 'word/document.xml'));
  check('the Word file holds the made-up company and both workers', xml.indexOf(PROBE_COMPANY) >= 0 && PROBE_WORKERS.every((w) => xml.indexOf(w) >= 0));
  check('Michael is told once', db.meta.length === 1 && r.told === true);
  check('the result is kept', JSON.parse(db.state[PROBE_KEY]).ok === false && JSON.parse(db.state[PROBE_KEY]).day === day);
  r = await formProbe(ENV, { dow: 0, hour: 7, day }, deps(await latinPdf()));
  check('the same Sunday does not run again', r.ran === false && puts.length === 1 && db.meta.length === 1);
  r = await formProbe(ENV, { dow: 0, hour: 6, day: '2026-11-29' }, deps(null));
  check('no PDF from Microsoft is a failure', r.ran && r.fails[0].indexOf('PDF') >= 0, r);

  console.log('\n4. routine-db form_probe runs it now');
  const res = await rdbRequest({ env: ENV, request: new Request('https://x/api/routine-db', { method: 'POST', headers: { 'x-routine-key': 'k-123', 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'form_probe', agent: 'claude-code', extra: 1 }) }) });
  check('an unknown field is refused', res.status === 400);

  console.log(`\nform-probe-test.mjs        ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('CRASH', e && e.stack); process.exit(1); });
