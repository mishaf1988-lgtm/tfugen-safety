// routine-db filing_prep (24/11/2026, Michael in the questionnaire: "do it: as planned"): one read-only call that gives the
// mail-filing agent up to 10 inbox files with the start of their text, their tokens and matching rows, instead of a call per file.
import { onRequest, filingPrepCheck, filingTokens, filingMatches, filingPrepPage, filingDbTokens, FILING_PREP_MAX, FILING_PREP_MATCHES, FILING_PREP_CHARS, OD_ROOT, OD_INBOX, OD_OCR_DIR } from './_build/routine-db.mjs';
import { PDFDocument, StandardFonts } from './_build/_pdflib.mjs';
import { writeZip } from './_build/_xlsxpatch.mjs';
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 500) : '')); } };
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const GR = 'https://graph.microsoft.com/v1.0/me/drive/root:/';
const ENV = { ROUTINE_KEY: 'k-123', SUPABASE_SERVICE_ROLE_KEY: 'srv', SUPABASE_URL: SB };

async function pdf(text) {
  const d = await PDFDocument.create();
  const p = d.addPage([300, 300]);
  if (text) p.drawText(text, { x: 10, y: 200, size: 8, font: await d.embedFont(StandardFonts.Helvetica) });
  return d.save();
}
const TEXT_PDF = await pdf('Pressure vessel inspection report E-1227 serial 4455667 next test 12.05.2027 id 123456789 mail a.b@x.co.il');
const SCAN_PDF = await pdf('');
const DOCX = await writeZip([{ name: 'word/document.xml', text: '<w:document><w:body><w:p><w:r><w:t>Calibration certificate MS2345</w:t></w:r></w:p></w:body></w:document>' }]);

const at = (i) => new Date(Date.parse('2026-11-20T08:00:00Z') + i * 60000).toISOString();
let items = [], content = {}, sbRows = { docs: [], equip_inspections: [] }, sbFail = false, log = [];
const real = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  const u = String(url), m = init.method || 'GET';
  log.push({ u: decodeURIComponent(u), m });
  const json = (o, st = 200) => new Response(JSON.stringify(o), { status: st });
  if (u.startsWith(SB + '/rest/v1/oauth_tokens')) return json([{ user_email: 'm', refresh_token: 'r', access_token: 'at', expires_at: new Date(Date.now() + 3600e3).toISOString(), scope: 'Files.ReadWrite' }]);
  const t = /\/rest\/v1\/(docs|equip_inspections)\?/.exec(u);
  if (t) return sbFail ? new Response('x', { status: 500 }) : json(sbRows[t[1]]);
  if (u.startsWith(GR) && /:\/children\?/.test(u)) return json({ value: items });
  if (u.startsWith(GR) && /:\/content$/.test(u)) {
    const path = decodeURIComponent(u.slice(GR.length, -':/content'.length));
    const c = content[path];
    if (c === undefined) return new Response('{}', { status: 404 });
    if (c === 500) return new Response('{}', { status: 500 });
    return new Response(c, { status: 200 });
  }
  return json([]);
};
const call = async (body) => {
  const r = await onRequest({ request: new Request('https://x/api/routine-db', { method: 'POST', headers: { 'x-routine-key': 'k-123', 'content-type': 'application/json' }, body: JSON.stringify(body) }), env: ENV });
  return { st: r.status, j: await r.json() };
};
const inbox = (n) => OD_ROOT + OD_INBOX + '/' + n;

console.log('\n1. validation');
check('a good call: offset 0 by default', filingPrepCheck({ op: 'filing_prep', agent: 'routine-mail-filing' }).offset === 0);
check('bad agent, an extra field, a bad offset: refused', filingPrepCheck({ op: 'filing_prep', agent: 'Bad Agent' }).error
  && filingPrepCheck({ op: 'filing_prep', agent: 'a-b', path: '../x' }).error && filingPrepCheck({ op: 'filing_prep', agent: 'a-b', offset: -1 }).error
  && filingPrepCheck({ op: 'filing_prep', agent: 'a-b', offset: '3' }).error && filingPrepCheck({ op: 'filing_prep', agent: 'a-b', offset: 1.5 }).error);
log = [];
const bad = await call({ op: 'filing_prep', agent: 'a-b', folder: 'x' });
check('through the server: 400 and nothing read from OneDrive', bad.st === 400 && !log.some((x) => x.u.startsWith(GR)), bad);

console.log('\n2. tokens');
const tk = filingTokens('2026-11-20 0812 - נשלח - report E-1227.pdf serial 4455667 on 12.05.2027 and 3/4/2026 ms2345 v2');
check('codes, long digit runs and dates; the inbox time prefix is not a token; upper case', JSON.stringify(tk) === JSON.stringify(['E-1227', '4455667', '12.05.2027', '3/4/2026', 'MS2345']), tk);
check('at most 8', filingTokens('A11 A12 A13 A14 A15 A16 A17 A18 A19 A20').length === 8);
check('a short number and a word are not tokens', filingTokens('page 12 of 30, year 2026').length === 0, filingTokens('page 12 of 30, year 2026'));
check('db tokens: no dates, a hyphenated code also without its hyphen', JSON.stringify(filingDbTokens([{ tokens: ['E-1227', '12.05.2027', '4455667'] }])) === JSON.stringify(['E-1227', 'E1227', '4455667']));

console.log('\n3. matches');
const many = Array.from({ length: 5 }, (_, i) => ({ id: 'q' + i, n: 'Vessel E1227 part ' + i, code: 'X' + i, serial_number: null, e: '2027-01-01' }));
const mt = filingMatches(['E-1227'], [{ id: 'd1', n: 'E-1227 cert', e: '2027-02-02' }], many);
check('capped at ' + FILING_PREP_MATCHES + ', equipment first, the hyphen ignored', mt.length === FILING_PREP_MATCHES && mt.every((x) => x.t === 'equip_inspections') && mt[0].next === '2027-01-01', mt);
check('a serial number matches; a row with no token is left out; only the needed columns', JSON.stringify(filingMatches(['4455667'], [], [{ id: 'a', n: 'Pump', serial_number: 'SN 4455667', e: null, next_inspection_date: '2027-03-03', file_url: 'u', notes: 'secret' }, { id: 'b', n: 'Other' }]))
  === JSON.stringify([{ t: 'equip_inspections', id: 'a', n: 'Pump', serial: 'SN 4455667', next: '2027-03-03', file_url: 'u' }]));
check('dates alone do not match anything', filingMatches(['12.05.2027'], [{ id: 'd', n: '12.05.2027' }], []).length === 0);

console.log('\n4. the subrequest budget');
{
  const all = Array.from({ length: 10 }, (_, i) => ({ name: i + '.pdf', size: 1, file: {}, createdDateTime: at(i) }));
  const bud = { limit: 12, used: 4 };
  const pg = await filingPrepPage(all, 0, bud, async () => { bud.used += 2; return { text: 'x' }; });
  check('stops before a file the budget cannot cover with the table reads, and says where to go on', pg.files.length === 3 && pg.next === 3 && bud.used === 10, { n: pg.files.length, next: pg.next, used: bud.used });
  const bud2 = { limit: 45, used: 4 };
  const pg2 = await filingPrepPage(all, 0, bud2, async () => { bud2.used += 2; return { text: 'x' }; });
  check('with the real budget a full page of ' + FILING_PREP_MAX + ' fits (4 + 10 x 2 + 2 < 45)', pg2.files.length === FILING_PREP_MAX && pg2.next === null && bud2.used + 2 <= 45);
}

console.log('\n5. through the server: paging, oldest first, folders left out');
{
  items = [{ name: 'לא לתיוק', folder: { childCount: 4 }, createdDateTime: at(0) }];
  content = {};
  for (let i = 11; i >= 0; i--) { const n = '2026-11-20 08' + String(10 + i) + ' - r' + i + '.pdf'; items.push({ name: n, size: TEXT_PDF.length, file: {}, createdDateTime: at(i) }); content[inbox(n)] = TEXT_PDF; }
  sbRows = { docs: [], equip_inspections: [{ id: 'eq1', code: 'PV-7', n: 'Air tank', serial_number: '4455667', report_number: null, e: '2026-12-01', next_inspection_date: null, file_url: 'https://od/x', notes: 'not returned' }] };
  log = [];
  const r = await call({ op: 'filing_prep', agent: 'routine-mail-filing' });
  const f0 = r.j.files && r.j.files[0];
  check('12 files: 10 now, next_offset 10, total 12, the subfolder not counted', r.j.ok === true && r.j.files.length === 10 && r.j.next_offset === 10 && r.j.total === 12, { ok: r.j.ok, n: r.j.files && r.j.files.length, next: r.j.next_offset, total: r.j.total, err: r.j.error });
  check('oldest first', f0 && f0.name.indexOf(' - r0.pdf') > 0 && r.j.files[9].name.indexOf(' - r9.pdf') > 0, r.j.files && r.j.files.map((x) => x.name));
  check('the PDF text layer is read and cut at ' + FILING_PREP_CHARS, f0 && /E-1227/.test(f0.text) && f0.text.length <= FILING_PREP_CHARS && !f0.scan, f0);
  check('a nine-digit number and a mail address in the text are masked', f0 && f0.text.indexOf('123456789') < 0 && f0.text.indexOf('a.b@x.co.il') < 0 && f0.text.indexOf('מספר') >= 0, f0 && f0.text);
  check('tokens from name and text, the masked number is not a token', f0 && f0.tokens.indexOf('E-1227') >= 0 && f0.tokens.indexOf('4455667') >= 0 && f0.tokens.indexOf('123456789') < 0, f0 && f0.tokens);
  check('the matching row, its fields only', f0 && f0.matches.length === 1 && f0.matches[0].id === 'eq1' && f0.matches[0].serial === '4455667' && f0.matches[0].next === '2026-12-01' && !('notes' in f0.matches[0]), f0 && f0.matches);
  check('read-only: every call a GET', log.length > 0 && log.every((x) => x.m === 'GET'), log.filter((x) => x.m !== 'GET'));
  check('one query per table for the whole page, not one per file', log.filter((x) => /\/rest\/v1\/(docs|equip_inspections)\?/.test(x.u)).length === 2);
  check('at most 45 subrequests', log.length <= 45, log.length);
  const r2 = await call({ op: 'filing_prep', agent: 'routine-mail-filing', offset: 10 });
  check('offset 10: the last 2, next_offset null', r2.j.files.length === 2 && r2.j.next_offset === null && r2.j.files[1].name.indexOf(' - r11.pdf') > 0, { n: r2.j.files.length, next: r2.j.next_offset });
}

console.log('\n6. through the server: scans, Word, photos, a failed file');
{
  const n = { scan: '2026-11-20 0901 - scan.pdf', ocr: '2026-11-20 0902 - scanned.pdf', docx: '2026-11-20 0903 - cert.docx', jpg: '2026-11-20 0904 - photo.jpg', bad: '2026-11-20 0905 - broken.pdf', xlsx: '2026-11-20 0906 - list.xlsx' };
  items = Object.values(n).map((x, i) => ({ name: x, size: 3000, file: {}, createdDateTime: at(i) }));
  content = { [inbox(n.scan)]: SCAN_PDF, [inbox(n.ocr)]: SCAN_PDF, [OD_ROOT + OD_OCR_DIR + '/2026-11-20 0902 - scanned.txt']: 'Hoist check H-778 next 01.02.2027', [inbox(n.docx)]: DOCX, [inbox(n.bad)]: 500 };
  sbRows = { docs: [], equip_inspections: [] };
  log = [];
  const r = await call({ op: 'filing_prep', agent: 'routine-mail-filing' });
  const by = {}; (r.j.files || []).forEach((x) => { by[x.name] = x; });
  check('a scan with no text and no .txt: text "" and scan:true', by[n.scan] && by[n.scan].text === '' && by[n.scan].scan === true, by[n.scan]);
  check('a scan whose ocr_txt .txt exists: its text, no scan flag', by[n.ocr] && /H-778/.test(by[n.ocr].text) && !by[n.ocr].scan && by[n.ocr].tokens.indexOf('H-778') >= 0, by[n.ocr]);
  check('Word: the text of word/document.xml', by[n.docx] && by[n.docx].text === 'Calibration certificate MS2345' && by[n.docx].tokens.indexOf('MS2345') >= 0, by[n.docx]);
  check('a photo: scan:true and not downloaded', by[n.jpg] && by[n.jpg].scan === true && !log.some((x) => x.u.indexOf('photo.jpg') >= 0), by[n.jpg]);
  check('a file that fails to read: err on that file only, the call still ok', r.j.ok === true && by[n.bad] && /read 500/.test(by[n.bad].err || '') && Object.keys(by).length === 6, by[n.bad]);
  check('an Excel file: text "" without scan (read it as before)', by[n.xlsx] && by[n.xlsx].text === '' && !by[n.xlsx].scan, by[n.xlsx]);
  sbFail = true;
  const r3 = await call({ op: 'filing_prep', agent: 'routine-mail-filing' });
  check('a table that cannot be read: partial named, a note not to say "not in the register"', r3.j.ok === true && JSON.stringify(r3.j.partial) === JSON.stringify(['equip_inspections', 'docs']) && /could not be read/.test(r3.j.note), { p: r3.j.partial, note: r3.j.note });
  sbFail = false;
  items = [];
  log = [];
  const e = await call({ op: 'filing_prep', agent: 'routine-mail-filing' });
  check('an empty inbox: ok, no files, no table read', e.j.ok === true && e.j.total === 0 && e.j.next_offset === null && !log.some((x) => /\/rest\/v1\/(docs|equip)/.test(x.u)), e.j);
}

globalThis.fetch = real;
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
