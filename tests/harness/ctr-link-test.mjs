// The contractor approval link (15/11/2026, phase 1): the assistant's op ctr_link makes a request and a draft
// contractor talk; the contractor's page asks for the details, the works and the documents those works need (refused on
// the server, one message per missing item), the commitment and a finger signature; the files go to the contractor's
// folder and a copy to Michael's mail. Since 16/11/2026 the page shows the instructions of form 146.03 and every worker
// signs his own row (name, ID, finger) on the same phone; form 146.03 is filled with the rows and the signatures inside
// its tables (functions/_ctrform.js) and each worker becomes a signature of the talk. A worker who joins later signs in
// talk.js (kind 'contractor'), which no list of factory trainings shows. Mocked network, nothing leaves.
import fs from 'fs';
import vm from 'vm';
import { onRequest, ctrDeps, makeCtrToken, readCtrToken, ctrLinkCheck, ctrLinkCreate, ctrLinkText, checkCtrForm, checkWorkers, mailHtml, summaryHtml, formHtml,
  pickAttach, MAIL_BUDGET, CTR_MAX_FILES, workLabel, MAIL_SUBJECT, ROW_HTML, buildForm, dotDay } from './_build/ctr-link.mjs';
import { fillCtrForm, pickTemplate, FORM_ROWS, repeatHead } from './_build/_ctrform.mjs';
import { readZip, writeZip, entryText } from './_build/_xlsxpatch.mjs';
import { KIND_CTR, CTR_PREFIX, CTR_STATE, CTR_WORKS, CTR_DOCS, CTR_DOC_L, requiredDocs, optionalDocs, missingDocs, missingMsg, ctrLinkId, parseCtrLinkId, linkTtlDays, workerTtlDays,
  safeName, ctrFolder, CTR_DIR, stateAdd, statePatch, stateList, CTR_STATE_MAX, INSTR_MISSING, isInstrMissing, CTR_OK, CTR_SIGN_MAX, isStuck, canSend, CTR_STUCK_MS } from './_build/_ctr.mjs';
import { onRequest as talkRequest, PERM_KINDS, TYPED_KINDS, makePermToken, readPermToken, talkUrl, ctrSignDeps, ctrName, fileCtrSign } from './_build/talk.mjs';
import { onRequest as rdbRequest } from './_build/routine-db.mjs';
import { latestTalk } from './_build/weekly-digest.mjs';
import { makeLinkToken } from './_build/_closelink.mjs';
import { fileType, MAX_FILE } from './_build/works.mjs';

let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 400) : '')); } };
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const ORIGIN = 'https://tapugan-safety.pages.dev';
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'srv', TRUSTEE_NOTIFY_SECRET: 'nsec', ROUTINE_KEY: 'k-123', WEEKEND_QUIET: 'off' };
const BAD = /[—–־«»“”‘’→←…]/;
const NOW = Date.now();
const today = new Date(NOW).toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
const addD = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);

// ---------- the fake database ----------
const db = { state: {}, talks: {}, reads: [], guess: 0, puts: [], mails: [], patches: [], storage: 0, empReads: 0, talkPostFail: false };
const reset = () => Object.assign(db, { state: {}, talks: {}, reads: [], guess: 0, puts: [], mails: [], patches: [], storage: 0, empReads: 0, talkPostFail: false });
const json = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { 'Content-Type': 'application/json' } });
const q = (u, k) => { const m = new RegExp('[?&]' + k + '=([^&]*)').exec(u); return m ? decodeURIComponent(m[1]) : null; };
globalThis.fetch = async (url, init) => {
  const u = String(url), m = (init && init.method) || 'GET';
  if (u.startsWith(SB + '/rest/v1/rpc/guess_hit')) { db.guess++; return json(db.guess); }
  if (u.startsWith(SB + '/rest/v1/server_state')) {
    if (m === 'GET') {
      const eq = q(u, 'key'); if (!eq) return json([]);
      const keys = eq.startsWith('eq.') ? [eq.slice(3)] : eq.startsWith('in.(') ? eq.slice(4, -1).split(',') : [];
      return json(keys.filter((k) => db.state[k]).map((k) => ({ key: k, value: db.state[k].value, updated_at: db.state[k].updated_at })));
    }
    const rows = JSON.parse(init.body);
    if (m === 'PATCH') {
      const k = q(u, 'key').slice(3), at = q(u, 'updated_at');
      if (!db.state[k] || (at && db.state[k].updated_at !== at.slice(3))) return json([]);
      db.state[k] = { value: rows.value, updated_at: rows.updated_at }; return json([{ key: k }]);
    }
    const r = rows[0];
    if (db.state[r.key] && /ignore-duplicates/.test(init.headers.Prefer || '')) return json([]);
    db.state[r.key] = { value: r.value, updated_at: r.updated_at }; return json([{ key: r.key }]);
  }
  if (u.startsWith(SB + '/rest/v1/toolbox_talks')) {
    if (m === 'POST') { if (db.talkPostFail) return json({}, 500); for (const r of JSON.parse(init.body)) db.talks[r.id] = { ...r }; return json([], 201); }
    const id = (q(u, 'id') || '').slice(3), kind = q(u, 'kind');
    const t = db.talks[id];
    if (m === 'PATCH') { db.patches.push({ id, body: JSON.parse(init.body) }); const lv = q(u, 'link_v'); const hit = t && (!kind || t.kind === kind.slice(3)) && (!lv || String(Number(t.link_v) || 0) === lv.slice(3)); if (hit) Object.assign(t, JSON.parse(init.body)); if (/return=representation/.test(String((init.headers || {}).Prefer || ''))) return json(hit ? [{ ...t }] : []); return new Response(null, { status: 204 }); }
    return json(t ? [{ ...t }] : []);
  }
  if (u.startsWith(SB + '/rest/v1/toolbox_reads')) {
    if (m === 'POST') {
      // as the live unique index (talk_id, emp_id): a second signature is 409 unless the insert ignores duplicates
      const ign = /ignore-duplicates/.test((init.headers && (init.headers.Prefer || init.headers.prefer)) || '') && /on_conflict=talk_id,emp_id/.test(u);
      const rs = [].concat(JSON.parse(init.body)), dup = (r) => db.reads.some((x) => x.talk_id === r.talk_id && x.emp_id === r.emp_id);
      if (!ign && rs.some(dup)) return new Response('dup', { status: 409 });
      for (const r of rs) if (!dup(r)) db.reads.push(r);
      return new Response(null, { status: 201 });
    }
    if (m === 'PATCH') { const id = q(u, 'id').slice(3); const r = db.reads.find((x) => x.id === id); if (r) Object.assign(r, JSON.parse(init.body)); return new Response(null, { status: 204 }); }
    const tid = (q(u, 'talk_id') || '').slice(3), like = q(u, 'emp_id');
    return json(db.reads.filter((r) => r.talk_id === tid && (!like || (like.startsWith('like.') ? r.emp_id.startsWith(like.slice(5).replace(/\*$/, '')) : r.emp_id === like.slice(3)))).map((r) => ({ id: r.id })));
  }
  if (u.startsWith(SB + '/rest/v1/emp')) { db.empReads++; return json([{ id: 'e1', n: 'עובד המפעל', dep: 'ייצור', eid: '111111118' }]); }
  if (u.startsWith(SB + '/storage/v1/object/')) { db.storage++; return json({ Key: 'x' }); }
  return json([]);
};
// A small form 146.03: the declaration sentence, the declaration table and the workers table with 8 empty rows (the live
// template's structure, 16/11/2026; its text is the factory's, its parts are only these).
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
const docXml = async (bytes) => entryText(readZip(bytes).find((e) => e.name === 'word/document.xml'));
// Graph: never called; the deps record what would be sent.
const fakeDeps = {
  accessToken: async () => ({ token: 'gt', email: 'owner@example.test' }),
  putFile: async (token, folder, name, bytes, type, conflict) => { db.puts.push({ folder, name, size: bytes.length, type, conflict }); return { webUrl: 'https://od.example/' + encodeURIComponent(name) }; },
  sendMailTo: async (token, to, cc, subject, html, att) => { db.mails.push({ to, cc, subject, html, att: att || [] }); return true; },
  graphPdf: async () => { const u = new Uint8Array(900); u.set([0x25, 0x50, 0x44, 0x46]); return u; },
  formTemplate: async () => { db.tplReads = (db.tplReads || 0) + 1; if (db.tplFail) throw new Error('form 146.03 not in the folder'); return { name: 'טופס 146.03 - הוראות בטיחות לקבלני חוץ - 16.10.2026.docx', bytes: TPL }; },
};
Object.assign(ctrDeps, fakeDeps);
Object.assign(ctrSignDeps, fakeDeps);

const PDF = () => { const u = new Uint8Array(2000); u.set([0x25, 0x50, 0x44, 0x46, 0x2d]); return u; };
const PNG = () => { const u = new Uint8Array(600); u.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); return u; };
const SIG = 'data:image/png;base64,' + Buffer.from(PNG()).toString('base64');
const SIGB = () => PNG();

console.log('\n1. the link id and its life');
{
  const p = parseCtrLinkId(ctrLinkId('cabc1234', 'perm', true));
  check('perm id round trip (kind, insurance, no dates)', p && p.rid === 'cabc1234' && p.kind === 'perm' && p.ins === true && p.ds === null && p.de === null, p);
  const t = parseCtrLinkId(ctrLinkId('cabc1234', 'temp', false, '2026-11-20', '2026-11-25'));
  check('temp id round trip (dates)', t && t.kind === 'temp' && t.ins === false && t.ds === '2026-11-20' && t.de === '2026-11-25', t);
  check('a temp id without dates, a perm id with dates, an end before the start, a bad day: refused',
    !parseCtrLinkId('cabc1234-t0') && !parseCtrLinkId('cabc1234-p0-20261120-20261125') && !parseCtrLinkId('cabc1234-t0-20261125-20261120') && !parseCtrLinkId('cabc1234-t0-20261131-20261201') && !parseCtrLinkId('x-p0'));
  check('perm link: 14 days', linkTtlDays('perm', null, NOW) === 14);
  const de3 = addD(today, 3), ttl3 = linkTtlDays('temp', de3, NOW);
  check('temp job ending in 3 days: the link ends the day after the job (3-5 days, not 14)', ttl3 > 3 && ttl3 < 5.1, ttl3);
  check('temp job ending in 40 days: 14 days', linkTtlDays('temp', addD(today, 40), NOW) === 14);
  check('a job that ended two days ago: no link', linkTtlDays('temp', addD(today, -2), NOW) <= 0);
  check('the new-worker link: a year for a permanent contractor, until the day after the job for a temp one', workerTtlDays('perm', null, NOW) === 365 && workerTtlDays('temp', de3, NOW) < 5.1);
  const tok = await makeCtrToken(ENV, ctrLinkId('cabc1234', 'temp', true, today, de3), ttl3, NOW);
  const r = await readCtrToken(ENV, tok, NOW);
  check('token: read back with kind, insurance and dates', r.rid === 'cabc1234' && r.kind === 'temp' && r.ins === true && r.de === de3, r);
  check('token: expired after its days', (await readCtrToken(ENV, tok, NOW + 6 * 86400000)).error === 'expired');
  check('token: one changed character is refused', (await readCtrToken(ENV, tok.slice(0, -2) + (tok.slice(-2) === 'AA' ? 'BB' : 'AA'), NOW)).error === 'bad');
  const other = await makeLinkToken(ENV, 'works-link:v1:', ctrLinkId('cabc1234', 'perm', true), 14, NOW);
  check('token: a link signed for another purpose (works) is refused', (await readCtrToken(ENV, other, NOW)).error === 'bad');
  const perm = await makePermToken(ENV, ctrLinkId('cabc1234', 'perm', true), 0, NOW);
  check('token: a talk permanent link is not a contractor link', (await readCtrToken(ENV, perm, NOW)).error === 'bad');
  check('no secret: no token', (await makeCtrToken({}, ctrLinkId('cabc1234', 'perm', true), 14, NOW)) === null);
  check('prefix is its own', CTR_PREFIX === 'ctr-link:v1:');
}

console.log('\n2. the documents each work needs (Michael\'s table)');
{
  const want = { hot: [], eng: [], hgt: ['hgtc'], rof: ['hgtc'], elc: ['elcl'], lft: ['crane', 'oper'], chm: ['sds'], cnf: ['cnft'], frk: ['frkl'] };
  for (const w of CTR_WORKS) {
    for (const ins of [false, true]) {
      const got = requiredDocs([w], ins);
      const exp = (ins ? ['ins'] : []).concat(want[w]);
      check(w + (ins ? ' with' : ' without') + ' insurance: ' + got.join(','), got.length === exp.length && exp.every((k) => got.indexOf(k) >= 0), got);
    }
  }
  check('nine works: the eight of the works list and the forklift', CTR_WORKS.join() === 'hot,hgt,elc,eng,lft,chm,cnf,rof,frk' && workLabel('frk') && workLabel('hot') !== 'hot');
  check('two works that need the same document ask for it once', requiredDocs(['hgt', 'rof'], false).filter((k) => k === 'hgtc').length === 1);
  check('without insurance it is optional; with it, only "other" is', optionalDocs(false).join() === 'ins,oth' && optionalDocs(true).join() === 'oth');
  check('height or roof work: the platform report is optional, never required (Michael 16/11/2026)', optionalDocs(true, ['hgt']).join() === 'plat,oth' && optionalDocs(false, ['rof', 'hgt']).join() === 'ins,plat,oth' && requiredDocs(['hgt', 'rof'], false).indexOf('plat') < 0 && optionalDocs(true, ['hot']).join() === 'oth');
  check('lifting: the crane\'s report and the operator\'s licence stay required', requiredDocs(['lft'], false).join() === 'crane,oper');
  check('missing: each item by itself', missingDocs(['ins', 'plat', 'frkl'], { plat: 1 }).join() === 'ins,frkl');
  check('the workers list is no document any more (16/11/2026: a signed row per worker on the page)', !CTR_DOC_L.wkr && CTR_DOCS.every((d) => d[0] !== 'wkr'));
  const msgs = missingMsg(['ins', 'frkl']);
  check('one clear Hebrew message per missing item, naming the document', msgs.length === 2 && msgs[0].indexOf(CTR_DOC_L.ins) > 0 && msgs[1].indexOf(CTR_DOC_L.frkl) > 0 && /^חסר/.test(msgs[0]), msgs);
  check('every document has a label, keyboard characters only', CTR_DOCS.every((d) => d[1] && !BAD.test(d[1])));
}

console.log('\n3. the folder name');
{
  check('slashes and backslashes never make a sub-folder', safeName('a/b\\c') === 'a b c');
  check('".." is no way up', safeName('..') === 'קבלן' && safeName('../../x') === 'x' && safeName(' .hidden. ') === 'hidden');
  check('control and direction characters are dropped', safeName('A‮B\u0000C\n') === 'A B C');
  check('characters OneDrive refuses are dropped', safeName('a:b*c?d"e<f>g|h#i%j') === 'a b c d e f g h i j');
  check('empty = a fixed name', safeName('   ') === 'קבלן' && safeName(null) === 'קבלן');
  check('at most 60 characters', safeName('x'.repeat(200)).length === 60);
  const f = ctrFolder('../evil/co', '2026');
  check('the folder: the contractors folder, "work of contractors <year>", one segment for the company', f.indexOf(CTR_DIR + '/עבודות קבלן 2026/') === 0 && f.split('/').length === CTR_DIR.split('/').length + 2, f);
  check('the folder is under "ניהול בטיחות/11_הדרכות/03_הדרכות קבלני חוץ"', CTR_DIR.indexOf('ניהול בטיחות/11_הדרכות/03_') > 0);
}

console.log('\n4. the form, checked on the server');
{
  const tP = { kind: 'perm', ins: true }, tT = { kind: 'temp', ins: false, ds: today, de: addD(today, 3) };
  const E = addD(today, 200);
  const W2 = [{ n: 'ישראל ישראלי', id: '012345678', sig: SIGB(), hgt: true, e: E }, { n: 'محمد علي', id: '987654321', sig: SIGB(), hgt: true, e: addD(today, 90) }];
  const base = { company: 'אחים בע"מ', cnum: '51-234567-8', contact: 'דני', mobile: '050-1234567', email: 'a@b.co.il', place: 'אולם 2', desc: 'החלפת פאנלים בגג', workers: W2, signer: 'דני כהן', sid: '023456789', commit: '1', sig: true, works: ['hgt'], dates: { ins: E, plat: addD(today, 150), elcl: E, sds: E } };
  // 'hgtc' = the height certificate of each of the two workers (in their rows, w = the row; 16/11/2026)
  const files = (docs) => docs.flatMap((doc) => (doc === 'hgtc' ? [0, 1] : [null]).map((w) => ({ doc, w, size: 2000, type: ['pdf', 'application/pdf'] })));
  const ok = checkCtrForm(base, files(['ins', 'hgtc', 'plat']), tP);
  check('a complete form passes', !!ok.v && ok.v.workers.length === 2 && ok.v.cnum === '512345678' && ok.v.mobile === '0501234567' && ok.v.desc === 'החלפת פאנלים בגג' && ok.v.sid === '023456789', ok.errors);
  const miss = checkCtrForm(base, files(['ins']), tP);
  // 17/11/2026, Michael: "the height certificate must not stop the form": passes, both kept as at height without one
  check('height work without the height certificates: passes, both named as with no certificate', !!miss.v && miss.v.noCert.join() === 'ישראל ישראלי,محمد علي', miss.errors);
  const mm = mailHtml(tP, { ...miss.v, optMissing: [] }, [], null, [], null, false, null), sm = summaryHtml(tP, miss.v, { day: today, hm: '10:00' }, 'AAA', []);
  check('the mail and the summary say in red "no certificate attached" beside each one', [mm, sm].every((h) => (h.match(/color:#b91c1c;font-weight:bold">לא צורף אישור/g) || []).length === 2), [mm.length, sm.length]);
  const noPlat = checkCtrForm(base, files(['ins', 'hgtc']), tP);
  check('height work without the platform report: passes, noted as optional and not given', !!noPlat.v && noPlat.v.optMissing.indexOf('plat') >= 0, noPlat.errors);
  check('a platform report attached to height work is taken', checkCtrForm(base, files(['ins', 'hgtc', 'plat']), tP).v.files.some((x) => x.doc === 'plat'));
  const noIns = checkCtrForm(base, files(['hgtc', 'plat']), tP);
  check('insurance required by the link and not attached: refused', noIns.errors && noIns.errors.some((e) => e.indexOf(CTR_DOC_L.ins) > 0));
  const optIns = checkCtrForm({ ...base, place: 'x2' }, files(['hgtc', 'plat']), tT);
  check('insurance not required: passes, and noted as optional and not given', !!optIns.v && optIns.v.optMissing.indexOf('ins') >= 0, optIns.errors);
  const noWk = checkCtrForm({ ...base, workers: [] }, files(['ins', 'hgtc', 'plat']), tP);
  check('no worker signed: refused (at least one row)', noWk.errors && noWk.errors.some((e) => e.indexOf('לפחות עובד') >= 0), noWk.errors);
  check('a wholly empty row is skipped', checkCtrForm({ ...base, workers: W2.concat([{ n: '', id: '', sig: null }]) }, files(['ins', 'hgtc', 'plat']), tP).v.workers.length === 2);
  const noSig = checkCtrForm({ ...base, workers: [W2[0], { n: 'דוד לוי', id: '123456782', sig: null }] }, files(['ins', 'hgtc', 'plat']), tP);
  check('a worker without a signature: refused naming his row', noSig.errors && noSig.errors.some((e) => e.indexOf('עובד 2') === 0), noSig.errors);
  check('a worker without an ID, or with a name of digits: refused', !!checkCtrForm({ ...base, workers: [{ n: 'דוד לוי', id: '', sig: SIGB() }] }, files(['ins', 'hgtc', 'plat']), tP).errors && !!checkWorkers([{ n: 'A1', id: '123456782', sig: SIGB() }]).errors);
  check('the same ID twice (leading zeros too): refused', !!checkWorkers([{ n: 'א ב', id: '012345678', sig: SIGB() }, { n: 'ג ד', id: '12345678', sig: SIGB() }]).errors);
  check('more than ' + CTR_SIGN_MAX + ' workers in one send: refused, pointing to the new-worker link', (checkWorkers(Array.from({ length: CTR_SIGN_MAX + 1 }, (_, i) => ({ n: 'עובד א', id: String(100000 + i), sig: SIGB() }))).errors || [''])[0].indexOf('לעובד חדש') > 0);
  check('the description is required, at most 600 characters', !!checkCtrForm({ ...base, desc: '' }, files(['ins', 'hgtc', 'plat']), tP).errors && !!checkCtrForm({ ...base, desc: 'x'.repeat(601) }, files(['ins', 'hgtc', 'plat']), tP).errors);
  check('the signer\'s ID is required', !!checkCtrForm({ ...base, sid: '' }, files(['ins', 'hgtc', 'plat']), tP).errors);
  const each = [
    ['company', { company: 'x' }], ['company number of 8 digits', { cnum: '12345678' }], ['company number with letters', { cnum: '12345678a' }], ['mobile', { mobile: '031234567' }],
    ['email', { email: 'not-mail' }], ['no works', { works: [] }], ['unknown work', { works: ['hgt', 'drop'] }], ['signer', { signer: '' }],
    ['commitment not ticked', { commit: '' }], ['no signature', { sig: false }],
  ];
  for (const [l, p] of each) { const r = checkCtrForm({ ...base, ...p }, files(['ins', 'hgtc', 'plat']), tP); check('refused: ' + l, !!r.errors && r.errors.length >= 1, r.v ? 'passed' : null); }
  check('temp job: the place is required', !!checkCtrForm({ ...base, place: '' }, files(['hgtc', 'plat']), tT).errors);
  check('a file that is not PDF/JPG/PNG by its bytes: refused', !!checkCtrForm(base, [{ doc: 'ins', size: 100, type: null }].concat(files(['hgtc', 'plat'])), tP).errors);
  check('a file over 4MB: refused', !!checkCtrForm(base, [{ doc: 'ins', size: MAX_FILE + 1, type: ['big'] }].concat(files(['hgtc', 'plat'])), tP).errors);
  check('too many files: refused', !!checkCtrForm(base, files(Array(CTR_MAX_FILES + 1).fill('oth').concat(['ins', 'hgtc', 'plat'])), tP).errors);
  const extra = checkCtrForm({ ...base, works: ['hot'] }, files(['ins', 'hgtc']), tP);
  check('a file for a work that was unticked is not taken (not uploaded)', !!extra.v && extra.v.files.every((x) => x.doc !== 'hgtc'), extra.errors);
  // 16/11/2026, Michael: "בצע: אישור לכל עובד": each worker his own height certificate
  const pdf1 = (w) => ({ doc: 'hgtc', w, size: 2000, type: ['pdf', 'application/pdf'] });
  const one = checkCtrForm(base, files(['ins']).concat([pdf1(0)]), tP);
  check('height work, one certificate for two workers: passes, only the worker without one is named', !!one.v && one.v.noCert.join() === 'محمد علي', one.errors);
  const two = checkCtrForm(base, files(['ins']).concat([pdf1(0), pdf1(0), pdf1(1)]), tP);
  check('two files for one worker (front and back) and one for the other: passes, each named by its worker', !!two.v && two.v.files.filter((x) => x.wn === 'ישראל ישראלי').length === 2 && two.v.files.filter((x) => x.wn === 'محمد علي').length === 1, two.errors);
  const gen = checkCtrForm(base, files(['ins']).concat([{ doc: 'hgtc', size: 2000, type: ['pdf', 'application/pdf'] }]), tP);
  check('a height certificate not in a worker\'s row (the old general field): not taken, the workers stay with no certificate', !!gen.v && gen.v.files.every((x) => x.doc !== 'hgtc') && gen.v.noCert.length === 2, gen.errors);
  const ghost = checkCtrForm({ ...base, workers: W2.concat([{ n: '', id: '', sig: null }]) }, files(['ins']).concat([pdf1(0), pdf1(1), pdf1(2)]), tP);
  check('a certificate in an empty row is not taken (not uploaded)', !!ghost.v && ghost.v.files.filter((x) => x.doc === 'hgtc').length === 2, ghost.errors);
  const gap = checkCtrForm({ ...base, workers: [W2[0], { n: '', id: '', sig: null }, W2[1]] }, files(['ins']).concat([pdf1(0), pdf1(2)]), tP);
  check('an empty row between workers: the certificate stays with its own worker (the row, not the place in the list)', !!gap.v && gap.v.files.some((x) => x.w === 2 && x.wn === 'محمد علي'), gap.errors);
  const hot = checkCtrForm({ ...base, works: ['hot'] }, files(['ins']), tP);
  check('no height work: no certificate asked of the workers', !!hot.v, hot.errors);
  // 16/11/2026, Michael: "not every worker must have a height approval"
  const W2n = [W2[0], { ...W2[1], hgt: false }];
  const notH = checkCtrForm({ ...base, workers: W2n }, files(['ins']).concat([pdf1(0)]), tP);
  check('a worker not marked at height: no certificate needed, kept as not at height', !!notH.v && notH.v.workers[1].hgt === false && notH.v.hgtOn === true, notH.errors);
  const notHf = checkCtrForm({ ...base, workers: W2n }, files(['ins']).concat([pdf1(0), pdf1(1)]), tP);
  check('a certificate in the row of a worker not at height is not taken', !!notHf.v && notHf.v.files.filter((x) => x.doc === 'hgtc').length === 1, notHf.errors);
  const noneH = checkCtrForm({ ...base, workers: W2.map((w) => ({ ...w, hgt: false })) }, files(['ins']), tP);
  check('height work with no worker marked at height: passes (17/11/2026, no "at least one")', !!noneH.v && noneH.v.noCert.length === 0, noneH.errors);
  // 16/11/2026 (DECISIONS "חמש תוספות"): "valid until" for every document but "other"; the approval ends at the first
  check('the first to end: the second worker\'s certificate (90 days)', !!ok.v && ok.v.firstE.e === addD(today, 90) && ok.v.firstE.label.indexOf('محمد علي') > 0, ok.v && ok.v.firstE);
  check('each file carries its date', !!ok.v && ok.v.files.find((x) => x.doc === 'plat').e === addD(today, 150) && ok.v.files.find((x) => x.wn === 'ישראל ישראלי').e === E);
  check('the insurance date is kept for the register', !!ok.v && ok.v.docE.ins === E);
  const noD = checkCtrForm({ ...base, dates: { plat: E } }, files(['ins', 'hgtc', 'plat']), tP);
  check('a document without "valid until": refused, naming it', !!noD.errors && noD.errors.some((e) => e.indexOf(CTR_DOC_L.ins) === 0 && e.indexOf('בתוקף עד') > 0), noD.errors);
  const past = checkCtrForm({ ...base, dates: { ...base.dates, ins: addD(today, -1) } }, files(['ins', 'hgtc', 'plat']), tP);
  check('an expired document: refused, with its date', !!past.errors && past.errors.some((e) => e.indexOf('כבר לא בתוקף') > 0), past.errors);
  check('a date far away or not a day: refused', !!checkCtrForm({ ...base, dates: { ...base.dates, ins: addD(today, 4000) } }, files(['ins', 'hgtc', 'plat']), tP).errors && !!checkCtrForm({ ...base, dates: { ...base.dates, ins: '2026-02-31' } }, files(['ins', 'hgtc', 'plat']), tP).errors);
  check('a month 13: refused as a bad date, no crash', !!checkCtrForm({ ...base, dates: { ...base.dates, ins: '2026-13-01' } }, files(['ins', 'hgtc', 'plat']), tP).errors);
  const twin = checkCtrForm({ ...base, workers: [W2[0], { ...W2[1], n: W2[0].n }] }, files(['ins', 'hgtc', 'plat']), tP);
  check('two workers with the same name: each certificate keeps its own worker\'s date', !!twin.v && twin.v.files.filter((x) => x.doc === 'hgtc').map((x) => x.e).join() === E + ',' + addD(today, 90), twin.errors || twin.v.files.map((x) => x.e));
  check('ends today: still valid', !!checkCtrForm({ ...base, dates: { ...base.dates, ins: today } }, files(['ins', 'hgtc', 'plat']), tP, today).v);
  const wNoD = checkCtrForm({ ...base, workers: [W2[0], { ...W2[1], e: '' }] }, files(['ins', 'hgtc', 'plat']), tP);
  check('a worker at height without his certificate\'s date: refused, naming him', !!wNoD.errors && wNoD.errors.some((e) => e.indexOf('עובד 2') === 0 && e.indexOf('בתוקף עד') > 0), wNoD.errors);
  check('a worker not at height needs no date', !!checkCtrForm({ ...base, workers: [W2[0], { ...W2[1], hgt: false, e: '' }] }, files(['ins']).concat([pdf1(0)]), tP).v);
  check('an optional document not attached needs no date (no plat date, no plat file)', !!checkCtrForm({ ...base, dates: { ins: E } }, files(['ins', 'hgtc']), tP).v);
  check('"other" never needs a date', !!checkCtrForm(base, files(['ins', 'hgtc', 'oth']), tP).v);
  check('date refusals are keyboard characters only', [noD, past, wNoD].every((r) => r.errors.every((e) => !BAD.test(e))));
  check('files: more room than before (15) but within the free plan\'s 50 calls a run (about 27 fixed + one per file)', CTR_MAX_FILES > 15 && CTR_MAX_FILES + 27 <= 45);
  check('bytes: PDF, JPG, PNG known; a renamed EXE is not', fileType(PDF())[0] === 'pdf' && fileType(PNG())[0] === 'png' && fileType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))[0] === 'jpg' && fileType(new Uint8Array([0x4d, 0x5a, 0x90, 0, 0])) === null);
  check('every refusal is keyboard characters only', [noIns, noWk, noSig].every((r) => r.errors.every((e) => !BAD.test(e))));
}

console.log('\n5. the op ctr_link (validation)');
{
  check('field not allowed', /field not allowed: x/.test(ctrLinkCheck({ op: 'ctr_link', kind: 'perm', ins: true, x: 1 }, today).error));
  check('kind must be perm or temp', !!ctrLinkCheck({ kind: 'year', ins: true }, today).error);
  check('ins must be a real true/false (not "yes")', !!ctrLinkCheck({ kind: 'perm', ins: 'yes' }, today).error && !!ctrLinkCheck({ kind: 'perm' }, today).error);
  check('temp needs ds and de', !!ctrLinkCheck({ kind: 'temp', ins: false }, today).error && !!ctrLinkCheck({ kind: 'temp', ins: false, ds: today, de: addD(today, -1) }, today).error);
  check('temp: a job that ended is refused', !!ctrLinkCheck({ kind: 'temp', ins: false, ds: addD(today, -5), de: addD(today, -1) }, today).error);
  check('perm with dates is refused', /field not allowed: ds/.test(ctrLinkCheck({ kind: 'perm', ins: true, ds: today }, today).error));
  const v = ctrLinkCheck({ op: 'ctr_link', agent: 'wa', kind: 'temp', ins: false, ds: today, de: addD(today, 2), company: ' שלום  מערכות ' }, today).v;
  check('a good temp request', v && v.kind === 'temp' && v.ins === false && v.company === 'שלום מערכות', v);
  const txt = ctrLinkText(v, 'https://x/api/ctr-link?k=t', addD(today, 3), true);
  check('the text for Michael: kind, insurance, end date DD/MM/YYYY, the link, "forward it yourself", the missing instructions, keyboard only',
    txt.indexOf('https://x/api/ctr-link?k=t') > 0 && /\d{2}\/\d{2}\/\d{4}/.test(txt) && txt.indexOf('146.03') > 0 && !BAD.test(txt), txt);
}

console.log('\n6. the op through routine-db, the page and the form');
reset();
let link, rid;
{
  const r = await rdbRequest({ request: new Request('https://x/api/routine-db', { method: 'POST', headers: { 'x-routine-key': 'k-123', 'content-type': 'application/json' }, body: JSON.stringify({ op: 'ctr_link', kind: 'perm', ins: true, company: 'קבלן <b>טוב</b>' }) }), env: ENV });
  const j = await r.json();
  check('ctr_link: ok, a link, the text, instructions missing', j.ok === true && /\/api\/ctr-link\?k=/.test(j.url) && j.instructions_missing === true && j.text.indexOf(j.url) >= 0, j);
  link = j.url; rid = j.id;
  const talk = db.talks['ctr-' + rid];
  check('a draft talk of kind contractor, with the company, no body yet', talk && talk.kind === KIND_CTR && talk.s === 'טיוטה' && talk.dept === 'קבלן <b>טוב</b>' && talk.body === null, talk);
  const st = stateList(db.state[CTR_STATE] && db.state[CTR_STATE].value);
  check('the request in ctr_links: sent, kind, insurance, the talk', st.length === 1 && st[0].id === rid && st[0].status === 'sent' && st[0].ins === true && st[0].talk === 'ctr-' + rid, st);
  const bad = await (await rdbRequest({ request: new Request('https://x/api/routine-db', { method: 'POST', headers: { 'x-routine-key': 'k-123', 'content-type': 'application/json' }, body: JSON.stringify({ op: 'ctr_link', kind: 'perm', ins: true, to: '972500000000' }) }), env: ENV })).json();
  check('ctr_link: a field such as "to" is refused (the server never sends to the contractor)', bad.ok === false && /field not allowed: to/.test(bad.error), bad);
  const full = { value: JSON.stringify(Array.from({ length: 20 }, (_, i) => ({ id: 'cday' + String(i).padStart(5, '0'), created_at: new Date().toISOString(), status: 'sent' }))), updated_at: new Date().toISOString() };
  const keepSt = db.state[CTR_STATE]; db.state[CTR_STATE] = full;
  const capped = await ctrLinkCreate(ENV, SB, { apikey: 'srv' }, { kind: 'perm', ins: false, company: '' }, Date.now());
  check('at most 20 links a day', /max 20/.test(capped.error || ''), capped);
  db.state[CTR_STATE] = keepSt;
  // security review 15/11/2026: ctr_revoke raises link_v, so the year-long "new worker" link stops working
  { const call = async (b) => (await rdbRequest({ request: new Request('https://x/api/routine-db', { method: 'POST', headers: { 'x-routine-key': 'k-123', 'content-type': 'application/json' }, body: JSON.stringify(b) }), env: ENV })).json();
    const v0 = Number(db.talks['ctr-' + rid].link_v) || 0;
    const rv = await call({ op: 'ctr_revoke', agent: 'wa', id: rid });
    check('ctr_revoke: link_v raised by one', rv.ok === true && rv.link_v === v0 + 1 && Number(db.talks['ctr-' + rid].link_v) === v0 + 1, { rv, t: db.talks['ctr-' + rid] });
    const nx = await call({ op: 'ctr_revoke', id: 'nosuch1' });
    const bf = await call({ op: 'ctr_revoke', id: rid, x: 1 });
    check('ctr_revoke: an unknown id and an extra field are refused', nx.ok === false && bf.ok === false && /field not allowed: x/.test(bf.error || ''), { nx, bf });
    db.talks['ctr-' + rid].link_v = v0; }
  const rdb = fs.readFileSync(new URL('../../functions/api/routine-db.js', import.meta.url), 'utf8');
  check('ctr_instructions: Michael\'s text can be set and read; ctr_links can be read', /export const STATE_READ = \[[^\]]*'ctr_links', 'ctr_instructions'[^\]]*\];/.test(rdb) && /'agents_registry', 'ctr_instructions'\];/.test(rdb));

  const notReady = await onRequest({ request: new Request(link), env: ENV });
  check('instructions not in yet: the page says so (503), no form (the workers would sign on nothing)', notReady.status === 503 && (await notReady.text()).indexOf('name="wn"') < 0);
  db.state.ctr_instructions = { value: 'הוראות הבטיחות לקבלני חוץ: לבוש, היתרי עבודה, פינוי, דיווח על אירוע. <script>x</script>', updated_at: new Date().toISOString() };
  const page = await onRequest({ request: new Request(link), env: ENV });
  const html = await page.text();
  check('the page shows the instructions whole, escaped, before the workers sign', html.indexOf('לבוש, היתרי עבודה') > 0 && html.indexOf('&lt;script&gt;x') > 0 && html.indexOf('לבוש') < html.indexOf('id="wl"'));
  check('a row per worker: name, ID, signature; "add a worker"; the row is copied by the script (no link data in it)', ['name="wn"', 'name="wi"', 'name="ws"', '<canvas>'].every((x) => ROW_HTML.indexOf(x) >= 0) && html.indexOf('id="add"') > 0 && html.indexOf('id="wl"') > 0 && html.indexOf(JSON.stringify(ROW_HTML)) > 0);
  check('the description is a required field, 600 at most; the signer\'s ID is asked', /<textarea id="desc" name="desc" maxlength="600" required>/.test(html) && html.indexOf('name="sid"') > 0);
  check('document fields show only for the works ticked (a rule hides .doc that is not .on)', html.indexOf('.doc{display:none') > 0 && html.indexOf('.doc.on{display:block}') > 0);
  check('the page opens (200), the company escaped, no raw tag', page.status === 200 && html.indexOf('&lt;b&gt;') > 0 && html.indexOf('<b>טוב') < 0);
  check('the page asks for every field, the nine works and a file field per document', ['name="company"', 'name="cnum"', 'name="contact"', 'name="mobile"', 'name="email"', 'name="desc"', 'name="signer"', 'name="commit"', 'id="pad"'].every((x) => html.indexOf(x) >= 0) && html.indexOf('name="workers"') < 0
    && CTR_WORKS.every((w) => html.indexOf('value="' + w + '"') >= 0) && CTR_DOCS.every((d) => (d[0] === 'hgtc') === (html.indexOf('name="f_' + d[0] + '"') < 0)) && /class=\\?"wf\\?"/.test(html));
  check('the page reads no factory data (no employees list)', db.empReads === 0 && !/111111118/.test(html));
  check('the page: CSP with a nonce, no-store, not indexed, no frame', /script-src 'nonce-/.test(page.headers.get('content-security-policy')) && page.headers.get('cache-control') === 'no-store' && page.headers.get('x-frame-options') === 'DENY');
  check('the page text is keyboard characters only', !BAD.test(html.replace(/<script[\s\S]*?<\/script>/g, '')));
  const noTok = await onRequest({ request: new Request(ORIGIN + '/api/ctr-link?k=abc'), env: ENV });
  check('a bad token: 403', noTok.status === 403);
}
const post = async (fields, files) => {
  const fd = new FormData();
  fd.append('k', new URL(link).searchParams.get('k'));
  for (const [k, v] of Object.entries(fields)) for (const x of [].concat(v)) fd.append(k, x);
  for (const [k, list] of Object.entries(files || {})) for (const [name, u8] of list) fd.append(/^wf_\d+$/.test(k) ? k : 'f_' + k, new Blob([u8]), name);
  // as a browser sends it: the multipart body with its size stated
  const pre = new Request(ORIGIN + '/api/ctr-link', { method: 'POST', body: fd });
  const buf = new Uint8Array(await pre.arrayBuffer());
  const r = await onRequest({ request: new Request(ORIGIN + '/api/ctr-link', { method: 'POST', body: buf, headers: { 'cf-connecting-ip': '1.2.3.4', 'content-type': pre.headers.get('content-type'), 'content-length': String(buf.length) } }), env: ENV });
  return { status: r.status, html: await r.text() };
};
const good = { company: 'בונים בע"מ', cnum: '512345678', contact: 'דני', mobile: '0501234567', email: 'd@b.co.il', desc: 'התקנת מדפים במחסן <b>הצפוני</b>', signer: 'דני כהן', sid: '023456789', commit: '1', sig: SIG, works: ['hgt', 'frk'],
  wn: ['ישראל ישראלי', 'Ahmad Nasser', ''], wi: ['012345678', '223456785', ''], ws: [SIG, SIG, ''], wg: ['1', '1', ''], wd: [addD(today, 300), addD(today, 60), ''],
  d_ins: addD(today, 200), d_plat: addD(today, 200), d_frkl: addD(today, 200), d_elcl: addD(today, 200) };
{
  let r = await post(good, { ins: [['a.pdf', PDF()]], wf_0: [['b.pdf', PDF()]], wf_1: [['b2.pdf', PDF()]] });
  check('refused on the server: the forklift licence missing; the platform report (optional) is not asked for', r.status === 400 && r.html.indexOf(CTR_DOC_L.frkl) > 0 && r.html.indexOf('חסר מסמך: ' + CTR_DOC_L.plat) < 0, r.html.slice(0, 300));
  check('a refused form saves nothing and sends nothing', db.puts.length === 0 && db.mails.length === 0 && stateList(db.state[CTR_STATE].value)[0].status === 'sent');
  r = await post(good, { ins: [['a.pdf', PDF()]], wf_0: [['b.pdf', PDF()]], wf_1: [['b2.pdf', PDF()]], plat: [['c.pdf', PDF()]], frkl: [['d.exe', new Uint8Array([0x4d, 0x5a, 0x90, 0, 0, 0, 0])]] });
  check('a file named .pdf/.exe that is not a PDF/JPG/PNG by its bytes: refused', r.status === 400 && db.puts.length === 0);
  r = await post(good, { ins: [['a.pdf', PDF()]], wf_0: [['b.pdf', PDF()]], wf_1: [['b2.pdf', PDF()]], plat: [['c.png', PNG()]], frkl: [['d.pdf', PDF()]], oth: [['e.pdf', PDF()]] });
  // 16/11/2026 (DECISIONS "חמש תוספות"): the new-worker link only after Michael's "בצע"
  check('a complete form: 200, "waiting for approval", no new-worker link yet', r.status === 200 && !/\/api\/talk\?k=/.test(r.html) && r.html.indexOf('מחכה לאישור') > 0, r.html.slice(0, 300));
  const folder = ctrFolder('בונים בע"מ', today.slice(0, 4));
  const inFolder = db.puts.filter((p) => p.folder === folder);
  check('six files (a height certificate per worker), the summary PDF and form 146.03 (Word + PDF) into the contractor folder (company sanitized), never replacing a file', inFolder.length === 9 && db.puts.every((p) => p.conflict === 'rename') && inFolder.some((p) => /\.pdf$/.test(p.name) && p.type === 'application/pdf' && p.name.indexOf('טופס אישור') > 0), db.puts.map((p) => p.folder + '|' + p.name));
  const fW = inFolder.find((p) => /146\.03 חתום - .*\.docx$/.test(p.name)), fP = inFolder.find((p) => /146\.03 חתום - .*\.pdf$/.test(p.name));
  check('form 146.03: Word and PDF under one name, DD-MM-YYYY HH-MM - the form - the company', fW && fP && fW.name.replace(/\.docx$/, '') === fP.name.replace(/\.pdf$/, '') && /^\d{2}-\d{2}-\d{4} \d{2}-\d{2} - /.test(fW.name), inFolder.map((p) => p.name));
  check('file names: DD-MM-YYYY - the document - n.<type by bytes>', inFolder.some((p) => /^\d{2}-\d{2}-\d{4} - .+ - 1\.png$/.test(p.name)));
  const talk = db.talks['ctr-' + rid];
  check('the talk is published with the company and the instructions text', talk.s === 'פורסמה' && talk.dept === 'בונים בע"מ' && talk.body.indexOf('הוראות') === 0, talk);
  const rr = db.reads.filter((x) => x.talk_id === talk.id);
  check('each worker of the send is a signature of the talk: name, ID, the company, his signature in Storage, x:<ID>: key', rr.length === 2 && rr[0].emp_name === 'ישראל ישראלי' && rr[0].id_no === '012345678' && rr[0].emp_id === 'x:012345678:ישראל ישראלי' && rr[1].emp_id === 'x:223456785:ahmad nasser' && rr.every((x) => x.dept === 'בונים בע"מ' && /\/storage\/v1\/object\/public\/incidents-photos\/sig-ctr-/.test(x.sig_url) && x.text_hash && x.device === 'ctr-link'), rr);
  check('the send\'s workers at height: their row says so, with the date and the certificate', rr.every((x) => x.job === 'עבודה בגובה' && x.equip && x.equip.hgt === true && x.equip.files.length === 1) && rr[0].equip.e === addD(today, 300) && rr[1].equip.e === addD(today, 60), rr.map((x) => [x.job, x.equip]));
  const m = db.mails[0];
  check('one mail, to Michael only (the connected mailbox)', db.mails.length === 1 && m.to.join() === 'owner@example.test' && m.cc.length === 0);
  check('the mail subject names the company, never an ID number', m.subject.indexOf('בונים') > 0 && !/\d{5,}/.test(m.subject), m.subject);
  check('the mail lists the works, every document and what is optional and not given, the commitment', m.html.indexOf(workLabel('frk')) > 0 && m.html.indexOf(CTR_DOC_L.plat) > 0 && m.html.indexOf(CTR_DOC_L.oth) > 0 && m.html.indexOf('התחייבות') > 0 && m.html.indexOf('דני כהן') > 0);
  check('each worker\'s certificate is named by him in the folder', inFolder.some((p) => p.name.indexOf('אישור עבודה בגובה - ישראל ישראלי - 1.pdf') > 0) && inFolder.some((p) => p.name.indexOf('אישור עבודה בגובה - Ahmad Nasser - 1.pdf') > 0), inFolder.map((p) => p.name));
  check('the mail attaches form 146.03 first, then the summary and the files (small enough)', m.att.length === 8 && m.att[0].name.indexOf('146.03') > 0 && m.att[1].name.indexOf('טופס אישור') > 0 && m.att.every((a) => a.contentBytes && a['@odata.type'] === '#microsoft.graph.fileAttachment'), m.att.map((a) => a.name));
  check('the mail: the description (escaped), 2 workers signed, the form linked', m.html.indexOf('התקנת מדפים') > 0 && m.html.indexOf('&lt;b&gt;') > 0 && m.html.indexOf('עובדים שחתמו') > 0 && /<td[^>]*>2: /.test(m.html) && m.html.indexOf('146.03 חתום') > 0);
  check('the mail holds no full ID number of a worker', m.html.indexOf('012345678') < 0);
  check('the mail names each worker and whether he works at height', m.html.indexOf('ישראל ישראלי (בגובה)') > 0 && m.html.indexOf('Ahmad Nasser (בגובה)') > 0, m.html.slice(m.html.indexOf('עובדים'), m.html.indexOf('עובדים') + 200));
  const st = stateList(db.state[CTR_STATE].value)[0];
  check('the request keeps each document\'s date, the first to end and the insurance date', st.doc_e && st.doc_e.ins === addD(today, 200) && st.first_e === addD(today, 60) && st.first_doc.indexOf('Ahmad Nasser') > 0 && st.ins_e === addD(today, 200), st);
  check('the mail: "valid until" beside the documents, and the first to end', m.html.indexOf('בתוקף עד ' + addD(today, 200).split('-').reverse().join('/')) > 0 && m.html.indexOf('המסמך שפג ראשון') > 0, m.html.slice(m.html.indexOf('המסמכים'), m.html.indexOf('המסמכים') + 400));
  check('the page asks "valid until" for each document but "other"', /name="d_ins"/.test(formHtml({ kind: 'perm', ins: true }, { company: '' }, 'k', 'הוראות בטיחות לבדיקה בלבד')) && !/name="d_oth"/.test(formHtml({ kind: 'perm', ins: true }, { company: '' }, 'k', 'הוראות בטיחות לבדיקה בלבד')) && /name="wd"/.test(ROW_HTML));
  check('the mail is keyboard characters only, and RTL', !BAD.test(m.html.replace(/<[^>]+>/g, ' ')) && /^<div dir="rtl" style="direction:rtl;text-align:right/.test(m.html));
  const stD = stateList(db.state[CTR_STATE].value)[0];
  check('the request is marked filled, with the files, folder, mail, form and reads (no worker ID in state)', st.status === 'filled' && st.files === 6 && st.folder === folder && st.mail === 'sent' && st.workers === 2 && st.reads === 2 && /146\.03/.test(decodeURIComponent(st.form || '')) && !st.form_err && JSON.stringify(st).indexOf('012345678') < 0 && JSON.stringify(st).indexOf('023456789') < 0, stD);
  const again = await post(good, { ins: [['a.pdf', PDF()]], wf_0: [['b.pdf', PDF()]], wf_1: [['b2.pdf', PDF()]], plat: [['c.pdf', PDF()]], frkl: [['d.pdf', PDF()]] });
  check('sent once: a second send saves nothing more', again.status === 200 && db.puts.length === 9 + 1 /* summary html source */ && db.mails.length === 1, db.puts.length);
  // a cut send (security review 16/11/2026): filled, no files, claimed long ago = open again, and a send goes through
  const keepState = db.state[CTR_STATE];
  const cut = stateList(keepState.value).map((x) => (x.id === rid ? { ...x, files: undefined, at: new Date(Date.now() - CTR_STUCK_MS - 60000).toISOString() } : x));
  db.state[CTR_STATE] = { value: JSON.stringify(cut), updated_at: new Date().toISOString() };
  const reOpenCut = await onRequest({ request: new Request(link), env: ENV });
  check('a send cut more than 10 minutes ago: the form opens again', reOpenCut.status === 200 && (await reOpenCut.text()).indexOf('id="wl"') > 0);
  const p0 = db.puts.length, mm0 = db.mails.length;
  const resend = await post(good, { ins: [['a.pdf', PDF()]], wf_0: [['b.pdf', PDF()]], wf_1: [['b2.pdf', PDF()]], plat: [['c.pdf', PDF()]], frkl: [['d.pdf', PDF()]] });
  check('... and the send goes through: files, form, one more mail, files set', resend.status === 200 && db.puts.length > p0 && db.mails.length === mm0 + 1 && stateList(db.state[CTR_STATE].value)[0].files === 5, resend.html.slice(0, 200));
  check('... and the workers who signed before are kept, not a failure (no reads error)', !stateList(db.state[CTR_STATE].value)[0].reads_err, stateList(db.state[CTR_STATE].value)[0].reads_err);
  const fresh = stateList(keepState.value).map((x) => (x.id === rid ? { ...x, files: undefined, at: new Date().toISOString() } : x));
  db.state[CTR_STATE] = { value: JSON.stringify(fresh), updated_at: new Date().toISOString() };
  check('a send claimed a minute ago with no files yet (still running): "already sent", no second send', (await post(good, {})).status === 200 && db.mails.length === mm0 + 1);
  db.state[CTR_STATE] = keepState;
  const reopen = await onRequest({ request: new Request(link), env: ENV });
  const reT = await reopen.text();
  check('opening the link again before approval: "already sent", waiting, no new-worker link', reopen.status === 200 && !/\/api\/talk\?k=/.test(reT) && reT.indexOf('מחכה לאישור') > 0);
  db.state[CTR_STATE] = { value: JSON.stringify(stateList(keepState.value).map((x) => (x.id === rid ? { ...x, status: 'approved', until: addD(today, 30) } : x))), updated_at: new Date().toISOString() };
  const reA = await (await onRequest({ request: new Request(link), env: ENV })).text();
  check('after approval: the same link shows the new-worker link', /\/api\/talk\?k=/.test(reA), reA.slice(0, 200));
  const wk = new URL(/href="([^"]+\/api\/talk\?k=[^"]+)"/.exec(reA)[1].replace(/&amp;/g, '&'));
  const wtk = wk.searchParams.get('k');
  const in20 = await readPermToken(ENV, wtk, Date.parse(addD(today, 20) + 'T12:00:00Z')), in40 = await readPermToken(ENV, wtk, Date.parse(addD(today, 40) + 'T12:00:00Z'));
  check('... valid no longer than the approval (works in 20 days, not in 40; the approval ends in 30)', !in20.error && in40.error === 'expired', { in20, in40 });
  db.state[CTR_STATE] = keepState;
  check('attachments past the mail budget go as links', pickAttach([{ bytes: new Uint8Array(MAIL_BUDGET - 10) }, { bytes: new Uint8Array(100) }, { bytes: new Uint8Array(5) }]).length === 2);
  check('posts are counted per address (rate limit)', db.guess >= 4);
  db.guess = 1000;
  check('past the limit: 429', (await post(good, {})).status === 429);
  const fdx = new FormData(); fdx.append('k', new URL(link).searchParams.get('k'));
  const nolen = await onRequest({ request: new Request(ORIGIN + '/api/ctr-link', { method: 'POST', body: fdx }), env: ENV });
  check('a form without its size stated: refused before reading it (411)', nolen.status === 411);
  db.guess = 0;
}

console.log('\n7. the worker of the contractor signs (talk.js, kind contractor)');
{
  const talk = db.talks['ctr-' + rid];
  const st = stateList(db.state[CTR_STATE].value)[0];
  const tok = await makePermToken(ENV, talk.id, talk.link_v || 0, Date.parse(st.at), 365);
  db.empReads = 0;
  const pg = await talkRequest({ request: new Request(talkUrl(tok)), env: ENV });
  const html = await pg.text();
  check('the page: the instructions, the company, the declaration; no list of factory workers', pg.status === 200 && html.indexOf('לקבלני חוץ:') > 0 && html.indexOf('בונים') > 0 && html.indexOf(CTR_OK.slice(0, 20)) > 0 && db.empReads === 0 && html.indexOf('111111118') < 0);
  check('the page asks for the name and the ID (no department, no company to type)', /name="oname"[^>]*required/.test(html) && html.indexOf('name="oid"') > 0 && html.indexOf('name="idep"') < 0 && html.indexOf('name="ocomp"') < 0);
  check('no reading aloud on a contractor page (an outside link; the voice costs per call)', html.indexOf('id="say"') < 0);
  const say = await talkRequest({ request: new Request(ORIGIN + '/api/talk?op=say&k=' + encodeURIComponent(tok)), env: ENV });
  check('op=say on a contractor talk: refused', say.status === 404);
  const fd = new FormData();
  for (const [k, v] of Object.entries({ k: tok, l: 'he', emp: '__other', oname: 'Ahmad Saleh', oid: '123456782', ok: '1', sig: SIG })) fd.append(k, v);
  const mailsBefore = db.mails.length, putsBefore = db.puts.length;
  const sg = await talkRequest({ request: new Request(ORIGIN + '/api/talk', { method: 'POST', body: fd }), env: ENV });
  const row = db.reads[db.reads.length - 1];
  check('signed: a toolbox_reads row, the name as typed (any letters), the ID, the company as its department', sg.status === 200 && row && row.talk_id === talk.id && row.emp_name === 'Ahmad Saleh' && row.id_no === '123456782' && row.dept === 'בונים בע"מ', row);
  const filed = db.puts.slice(putsBefore).filter((p) => p.folder === ctrFolder('בונים בע"מ', today.slice(0, 4)));
  check('the signed confirmation is filed in the contractor folder: date, name, last 4 digits only', filed.length === 1 && /^\d{2}-\d{2}-\d{4} - Ahmad Saleh - 6782\.pdf$/.test(filed[0].name), db.puts.slice(putsBefore));
  const nm = db.mails[db.mails.length - 1];
  check('a short mail to Michael only; the ID is not in the subject, and only its last 4 digits in the body', db.mails.length === mailsBefore + 1 && nm.to.join() === 'owner@example.test' && !/\d{4,}/.test(nm.subject) && nm.html.indexOf('123456782') < 0 && nm.html.indexOf('6782') > 0, nm.subject);
  check('the read row is marked filed and mailed', !!row.doc_url && !!row.mailed_at);
  const fd2 = new FormData();
  for (const [k, v] of Object.entries({ k: tok, l: 'he', emp: '__other', oname: 'Ahmad Saleh', oid: '123456782', ok: '1', sig: SIG })) fd2.append(k, v);
  await talkRequest({ request: new Request(ORIGIN + '/api/talk', { method: 'POST', body: fd2 }), env: ENV });
  check('the same ID signs once', db.reads.filter((r) => r.talk_id === talk.id && r.id_no === '123456782').length === 1);
  const fd3 = new FormData();
  for (const [k, v] of Object.entries({ k: tok, l: 'he', emp: '__other', oname: 'ישראל ישראלי', oid: '012345678', ok: '1', sig: SIG })) fd3.append(k, v);
  const n0 = db.reads.length, m0 = db.mails.length;
  await talkRequest({ request: new Request(ORIGIN + '/api/talk', { method: 'POST', body: fd3 }), env: ENV });
  check('a worker who signed in the contractor\'s send is already signed on the new-worker link (no second row, no mail)', db.reads.length === n0 && db.mails.length === m0);
  // 16/11/2026 (DECISIONS "חמש תוספות"): a worker at height on the new-worker link: photos of his certificate and its date
  check('the page: "I work at height" with the photo box and the date', html.indexOf('name="hgt"') > 0 && html.indexOf('name="he"') > 0 && html.indexOf('id="dbox"') > 0);
  const JPG = 'data:image/jpeg;base64,' + Buffer.alloc(3000, 7).toString('base64');
  const hsign = async (o) => { const f = new FormData(); for (const [k, v] of Object.entries(Object.assign({ k: tok, l: 'he', emp: '__other', ok: '1', sig: SIG }, o))) [].concat(v).forEach((x) => f.append(k, x)); return talkRequest({ request: new Request(ORIGIN + '/api/talk', { method: 'POST', body: f }), env: ENV }); };
  const h0 = db.reads.length;
  // 17/11/2026, Michael: "must not stop the send": at height without a photo is saved, no date, red in the mail
  const hn = await hsign({ oname: 'Avi Hagobah', oid: '039337423', hgt: '1', he: addD(today, 100) });
  const hnrow = db.reads[db.reads.length - 1];
  check('at height without a photo: saved at height, no date, the mail says in red "no certificate attached"', hn.status === 200 && db.reads.length === h0 + 1 && hnrow.emp_name === 'Avi Hagobah' && hnrow.job === 'עבודה בגובה' && hnrow.equip && hnrow.equip.e === null && db.mails[db.mails.length - 1].html.indexOf('color:#b91c1c">לא צורף אישור') > 0, [hn.status, hnrow]);
  const hp = await hsign({ oname: 'Rami Levi', oid: '211111117', hgt: '1', he: addD(today, -1), doc: JPG });
  check('at height with an expired date: refused, nothing written', hp.status === 400 && db.reads.length === h0 + 1);
  const pb = db.puts.length;
  const hk = await hsign({ oname: 'Rami Levi', oid: '211111117', hgt: '1', he: addD(today, 100), doc: [JPG, JPG] });
  const hrow = db.reads[db.reads.length - 1];
  check('at height: signed, the row says so with the date and the two photos', hk.status === 200 && hrow.emp_name === 'Rami Levi' && hrow.job === 'עבודה בגובה' && hrow.equip && hrow.equip.e === addD(today, 100) && hrow.equip.files.length === 2, hrow);
  check('the photos are filed in the contractor folder by his name', db.puts.slice(pb).filter((x) => /אישור עבודה בגובה - Rami Levi - [12]\.jpg$/.test(x.name)).length === 2, db.puts.slice(pb).map((x) => x.name));
  check('the mail to Michael says at height, until when', db.mails[db.mails.length - 1].html.indexOf('עובד בגובה, אישור בתוקף עד') > 0);
  // security review 16/11/2026: one photo that fails to save does not stop the others or the mail
  let jn = 0; const sent = [];
  const fdeps = { accessToken: async () => ({ token: 't', email: 'owner@example.test' }), graphPdf: async () => null, sendMailTo: async (tk, to, cc, subj, h) => { sent.push(h); },
    putFile: async (tk, folder, name) => { if (/\.jpg$/.test(name) && ++jn === 1) throw new Error('graph 503'); return { webUrl: 'https://od.example/' + encodeURIComponent(name) }; } };
  const fo = await fileCtrSign(ENV, talk, { id: 'rowx', emp_name: 'Rami Levi', id_no: '211111117' }, PNG(), NOW, fdeps, { docs: [JPG.split(',')[1], JPG.split(',')[1]], e: addD(today, 100) });
  check('a photo that fails: the other is filed, the mail goes and says one was not saved', fo.mailed && jn === 2 && sent.length === 1 && sent[0].indexOf('1 צילומים לא נשמרו') > 0, { fo, jn });
  const hz = await hsign({ oname: 'Dana Cohen', oid: '322222226' });
  check('not at height: signed as before, no job and no photos', hz.status === 200 && !db.reads[db.reads.length - 1].job && !db.reads[db.reads.length - 1].equip);
  check('a name with digits or tags is not a name', ctrName('<b>x</b>') === null && ctrName('A1') === null && ctrName('محمد علي') === 'محمد علي');
  // the link is revocable: link_v raised = the old link stops
  talk.link_v = 1;
  const old = await talkRequest({ request: new Request(talkUrl(tok)), env: ENV });
  check('the new-worker link stops when the talk\'s link_v is raised (revoked)', old.status === 403);
  talk.link_v = 0;
  // a contractor talk with the placeholder text: no signing until the text is in
  db.talks['ctr-cph00001'] = { id: 'ctr-cph00001', kind: KIND_CTR, s: 'פורסמה', d: today, title: 't', dept: 'co', body: INSTR_MISSING, link_v: 0 };
  const tok2 = await makePermToken(ENV, 'ctr-cph00001', 0, NOW, 30);
  const keep = db.state.ctr_instructions; delete db.state.ctr_instructions;
  const nr = await talkRequest({ request: new Request(talkUrl(tok2)), env: ENV });
  check('instructions not in yet: the worker page says so (503), no form', nr.status === 503 && (await nr.text()).indexOf('name="oid"') < 0);
  db.state.ctr_instructions = keep;
  const fixed = await talkRequest({ request: new Request(talkUrl(tok2)), env: ENV });
  check('once Michael set the text: the talk takes it and the page opens', fixed.status === 200 && !isInstrMissing(db.talks['ctr-cph00001'].body));
}

console.log('\n8. never a factory training');
{
  check('contractor is a permanent kind, not a typed (annual / quality) one', PERM_KINDS.indexOf(KIND_CTR) >= 0 && TYPED_KINDS.indexOf(KIND_CTR) < 0);
  const PUB = 'פורסמה';
  const lt = latestTalk([{ id: 'w1', s: PUB, d: '2026-11-01', ts: '2026-11-01T08:00:00Z' }, { id: 'ctr-x', s: PUB, kind: KIND_CTR, d: '2026-11-15', ts: '2026-11-15T08:00:00Z' }]);
  check('the weekly digest\'s "latest talk" is never a contractor talk', lt && lt.id === 'w1', lt);
  const html = fs.readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  const fn = /function _tbtCtr\(t\)\{[^}]*\}/.exec(html);
  check('index.html: _tbtCtr exists', !!fn);
  const ctx = {}; vm.runInNewContext(fn ? fn[0] : '', ctx);
  check('_tbtCtr: true for a contractor talk only', ctx._tbtCtr && ctx._tbtCtr({ kind: 'contractor' }) === true && ctx._tbtCtr({ kind: 'annual' }) === false && ctx._tbtCtr(null) === false);
  // 16/11/2026 (DECISIONS "חמש תוספות", 5): the contractor's screen lists its workers, who is at height and until when
  const grab = (name) => { const a = html.indexOf('function ' + name + '('); return html.slice(a, html.indexOf('\n}', a) + 2); };
  const one1 = (name) => { const a = html.indexOf('function ' + name + '('); return html.slice(a, html.indexOf('\n', a)); };
  const ctx2 = { DB: { toolbox_talks: [{ id: 'ctr-cq1', kind: 'contractor', dept: 'גגות בע"מ' }, { id: 'ctr-cq2', kind: 'contractor', dept: 'גגות' }, { id: 'w1', kind: 'weekly', dept: 'גגות' }],
    toolbox_reads: [
      { id: 'r1', talk_id: 'ctr-cq1', emp_name: 'Rami Levi', id_no: '211111117', read_at: '2026-11-16T10:00:00Z', job: 'עבודה בגובה', equip: { hgt: true, e: '2027-01-01', files: ['https://od.example/a', 'javascript:alert(1)'] }, doc_url: 'https://od.example/f' },
      { id: 'r2', talk_id: 'ctr-cq2', emp_name: 'Dana <b>Cohen</b>', id_no: '322222226', read_at: '2026-11-17T10:00:00Z' },
      { id: 'r3', talk_id: 'ctr-cq2', emp_name: 'Rami Levi', id_no: '211111117', read_at: '2026-11-10T10:00:00Z' },
      { id: 'r4', talk_id: 'w1', emp_name: 'עובד מפעל', id_no: '1', read_at: '2026-11-17T10:00:00Z' },
      { id: 'r5', talk_id: 'ctr-cq1', emp_name: 'Old Cert', id_no: '9', read_at: '2026-11-15T10:00:00Z', job: 'עבודה בגובה', equip: { hgt: true, e: '2020-01-01', files: [] } }] } };
  vm.runInNewContext([one1('esc'), one1('escU'), one1('fd'), one1('du'), one1('_tbtCtr'), one1('_ctrNorm'), grab('_ctrWorkers'), grab('_ctrWorkersHtml')].join('\n'), ctx2);
  const wsl = ctx2._ctrWorkers({ id: 'ctr26-cq1', n: 'גגות' });
  check('screen: the workers of its talks (by request id and by the same name), not a factory talk; one row per ID, the newest', wsl.length === 3 && wsl.map((r) => r.id).join() === 'r2,r1,r5', wsl.map((r) => r.id));
  const wh = ctx2._ctrWorkersHtml({ id: 'ctr26-cq1', n: 'גגות' });
  check('screen: at height with the date and the certificate link; an expired one says so; others "not at height"', wh.indexOf('בגובה, אישור עד 01/01/2027') > 0 && wh.indexOf('href="https://od.example/a"') > 0 && wh.indexOf('(פג)') > 0 && wh.indexOf('לא בגובה') > 0 && wh.indexOf('טופס חתום') > 0, wh);
  check('screen: names escaped, a javascript: link dropped', wh.indexOf('<b>Cohen') < 0 && wh.indexOf('javascript:') < 0);
  // 17/11/2026, Michael: the certificate is not required: at height without one = "no certificate attached" in red
  ctx2.DB.toolbox_reads.push({ id: 'r6', talk_id: 'ctr-cq1', emp_name: 'No Cert', id_no: '8', read_at: '2026-11-17T09:00:00Z', job: 'עבודה בגובה', equip: { hgt: true, e: null, files: [] } });
  const whN = ctx2._ctrWorkersHtml({ id: 'ctr26-cq1', n: 'גגות' });
  check('screen: at height with no certificate says so in red', whN.indexOf('color:#b91c1c">בגובה, לא צורף אישור') > 0, whN.slice(0, 200));
  ctx2.DB.toolbox_reads.pop();
  const tk = fs.readFileSync(new URL('../../functions/api/talk.js', import.meta.url), 'utf8');
  check('new worker link: at height without a photo is saved (no refusal), the date only with a photo, the mail says in red', tk.indexOf('return hErr(CTR_HGT_ERR.docs)') < 0 && tk.indexOf('if (hd.length && !he) return hErr(CTR_HGT_ERR.date)') > 0 && tk.indexOf('e: hd.length ? he : null') > 0 && tk.indexOf('hgt && !hgt.e ?') > 0);
  check('new worker link page: no stop for a missing photo', tk.indexOf('if(document.querySelectorAll(\"#dbox input[name=doc]\").length&&!document') > 0);
  check('screen: no workers = says so', ctx2._ctrWorkersHtml({ id: 'ctr26-zz', n: 'אחר' }).indexOf('עוד לא חתמו') > 0);
  check('screen: shown on the contractor view', /if\(tbl==='ctr'\)html\+=_ctrWorkersHtml\(rec\);/.test(html));
  const rTbt = html.slice(html.indexOf('function rTbt()'), html.indexOf('function rTbt()') + 800);
  check('the trainings list (rTbt) leaves contractor talks out', /DB\.toolbox_talks\|\|\[\]\)\.filter\(function\(t\)\{return !_tbtCtr\(t\);\}\)/.test(rTbt));
  check('the worker card\'s trainings leave them out', /filter\(function\(t\)\{return t&&!_tbtCtr\(t\)&&\(mine\[t\.id\]/.test(html));
  check('the "last trainer" default skips them', /x&&x\.trainer&&!_tbtCtr\(x\)/.test(html));
  check('the annual plan counts only closed annual / quality talks (a contractor talk never matches)', /t\.kind!==a\[0\]\|\|!t\.closed_at/.test(html));
  const wd = fs.readFileSync(new URL('../../functions/api/weekly-digest.js', import.meta.url), 'utf8');
  check('the weekly digest\'s department talks and latest talk skip PERM_KINDS (contractor included)', (wd.match(/PERM_KINDS\.indexOf\(t\.kind\) < 0/g) || []).length >= 2);
}

console.log('\n9. text people read: keyboard characters only');
{
  const t = { kind: 'temp', ins: false, ds: today, de: addD(today, 2) };
  const v = { company: 'co', cnum: '123456789', contact: 'c', mobile: '0501234567', email: 'a@b.co', place: 'p', desc: 'd', works: CTR_WORKS, workers: [{ n: 'x y', id: '123456782', sig: SIGB() }], optMissing: ['ins'], signer: 's', sid: '023456789', files: [] };
  const all = [formHtml(t, { company: 'co' }, 'tok', 'instr'), summaryHtml(t, v, { day: today, hm: '10:00' }, 'AAA', [{ doc: 'plat', name: 'a.pdf' }]), mailHtml(t, v, [{ doc: 'plat', name: 'a.pdf', url: 'https://x' }], { name: 's.pdf', url: 'https://x' }, [], 'https://w', true, { err: 'x' }), MAIL_SUBJECT(t, v), CTR_OK, ROW_HTML];
  check('form, summary, mail, subject, declaration, the worker row', all.every((s) => !BAD.test(s.replace(/<[^>]+>/g, ' '))), all.map((s) => (BAD.exec(s) || [])[0]));
  const src = fs.readFileSync(new URL('../../functions/api/ctr-link.js', import.meta.url), 'utf8') + fs.readFileSync(new URL('../../functions/_ctr.js', import.meta.url), 'utf8') + fs.readFileSync(new URL('../../functions/_ctrform.js', import.meta.url), 'utf8');
  check('no raw Hebrew in the server code (\\uXXXX only)', !/[א-ת]/.test(src));
  check('state is written with stateCas only (no merge-duplicates on server_state)', src.indexOf('merge-duplicates') < 0 && /stateCas\(/.test(src));
  const s = stateAdd(Array.from({ length: CTR_STATE_MAX + 5 }, (_, i) => ({ id: 'c' + String(i).padStart(7, '0') })), { id: 'cnewone01' });
  check('ctr_links is capped, newest first', s.length === CTR_STATE_MAX && s[0].id === 'cnewone01');
  const T = Date.now(), old = new Date(T - CTR_STUCK_MS - 1000).toISOString(), now = new Date(T).toISOString();
  check('isStuck: filled, no files, claimed over 10 minutes ago; not when files were written, not when recent, not when sent', isStuck({ status: 'filled', at: old }, T) && !isStuck({ status: 'filled', at: old, files: 0 }, T) && !isStuck({ status: 'filled', at: now }, T) && !isStuck({ status: 'sent', at: old }, T));
  check('canSend: sent, or stuck', canSend({ status: 'sent' }, T) && canSend({ status: 'filled', at: old }, T) && !canSend({ status: 'filled', at: old, files: 3 }, T) && !canSend(null, T));
  check('statePatch: a function as the condition', !statePatch([{ id: 'cabc12345', status: 'filled', files: 2 }], 'cabc12345', {}, (e) => canSend(e, T)).list && !!statePatch([{ id: 'cabc12345', status: 'filled', at: old }], 'cabc12345', {}, (e) => canSend(e, T)).list);
  check('statePatch: only from the expected status', statePatch([{ id: 'cabc12345', status: 'filled' }], 'cabc12345', { x: 1 }, 'sent').error === 'state' && statePatch([], 'cabc12345', {}).error === 'missing');
}

console.log('\n10. form 146.03 filled (functions/_ctrform.js)');
{
  const ws = Array.from({ length: 11 }, (_, i) => ({ n: 'עובד ' + (i + 1), id: String(200000000 + i), sig: SIGB() }));
  const r = await fillCtrForm(TPL, { company: 'בונים <b>&</b>', cnum: '512345678', signer: 'דני כהן', sid: '023456789', contact: '0501234567', date: '16/11/2026', works: 'עבודה בגובה', desc: 'שורה 1\nשורה 2', job: '', mgrSig: SIGB(), workers: ws });
  const x = await docXml(r.bytes), z = readZip(r.bytes);
  check('every label found; 11 workers, 12 pictures (the workers and the manager)', r.report.missing.length === 0 && r.report.filled === 11 && r.report.pictures === 12, r.report);
  check('the declaration table: the company (escaped), the signer\'s ID, the company number, the date', x.indexOf('שם הקבלן: בונים &lt;b&gt;&amp;&lt;/b&gt;') > 0 && x.indexOf('ת.ז.: 023456789') > 0 && x.indexOf('ח.פ / עוסק מורשה: 512345678') > 0 && x.indexOf('תאריך: 16/11/2026') > 0);
  check('the lines after the declaration: the signer, the works, the description on one line; an empty one (job) left out', x.indexOf('דני כהן (0501234567)') > 0 && x.indexOf('עבודה בגובה') > 0 && x.indexOf('שורה 1 שורה 2') > 0 && x.indexOf('העבודה במפעל:') < 0);
  const t2 = /<w:tbl>(?:(?!<w:tbl>)[\s\S])*?שם העובד[\s\S]*?<\/w:tbl>/.exec(x)[0];
  check('the workers table: a row per worker past the template\'s 8, each with name, ID and his picture', (t2.match(/<w:tr>/g) || []).length === 12 && t2.indexOf('עובד 11') > 0 && t2.indexOf('200000010') > 0 && (t2.match(/<wp:inline/g) || []).length === 11);
  const few = await docXml((await fillCtrForm(TPL, { company: 'c', workers: ws.slice(0, 2) })).bytes);
  check('two workers: the template\'s 8 rows stay (6 empty)', (/<w:tbl>(?:(?!<w:tbl>)[\s\S])*?שם העובד[\s\S]*?<\/w:tbl>/.exec(few)[0].match(/<w:tr>/g) || []).length === 1 + FORM_ROWS);
  const rels = await entryText(z.find((e) => e.name === 'word/_rels/document.xml.rels'));
  check('the pictures: a part each, a relationship each, the template\'s own parts kept (the logo byte for byte)', z.filter((e) => /^word\/media\/ctrsig\d+\.png$/.test(e.name)).length === 12 && (rels.match(/rIdCtrSig\d+/g) || []).length === 12 && rels.indexOf('rId9') > 0 && z.some((e) => e.name === 'word/media/logo.png' && e.usize === 7));
  const ct = await entryText(z.find((e) => e.name === '[Content_Types].xml'));
  check('a template without the png type gets it', /Extension="png"/.test(ct));
  check('the workers table\'s heading row repeats on each page (w:tblHeader), once', (t2.match(/<w:tblHeader\/>/g) || []).length === 1 && t2.indexOf('<w:tblHeader/>') < t2.indexOf('שם העובד'));
  check('repeatHead: into an existing trPr, or a new one; never twice', repeatHead('<w:tbl><w:tr><w:trPr><w:jc/></w:trPr></w:tr></w:tbl>') === '<w:tbl><w:tr><w:trPr><w:tblHeader/><w:jc/></w:trPr></w:tr></w:tbl>' && repeatHead('<w:tbl><w:tr><w:tc/></w:tr></w:tbl>') === '<w:tbl><w:tr><w:trPr><w:tblHeader/></w:trPr><w:tc/></w:tr></w:tbl>' && repeatHead(repeatHead('<w:tbl><w:tr><w:tc/></w:tr></w:tbl>')) === repeatHead('<w:tbl><w:tr><w:tc/></w:tr></w:tbl>'));
  check('dates in the form with dots, as the form writes its own (slashes reversed in Word, 16/11/2026)', dotDay('2026-11-17') === '17.11.2026');
  check('the workers\' rows in the order typed', t2.indexOf('עובד 1<') < t2.indexOf('עובד 2<'));
  await check('not a docx: refused', await fillCtrForm(new Uint8Array([1, 2, 3]), {}).then(() => false, () => true));
  check('the template: the newest .docx whose name starts with "טופס 146.03"', pickTemplate([{ name: 'טופס 146.03 - a - 14.07.2024.docx', lastModifiedDateTime: '2024-07-14T00:00:00Z' }, { name: 'טופס 146.03 - b - 16.10.2026.docx', lastModifiedDateTime: '2026-10-16T00:00:00Z' }, { name: 'טופס 146.03 - c.pdf', lastModifiedDateTime: '2027-01-01T00:00:00Z' }, { name: 'x.docx' }]) === 'טופס 146.03 - b - 16.10.2026.docx' && pickTemplate([]) === null);
  // the form failed: the rest goes on, the mail says so
  db.tplFail = true; db.puts = [];
  const bf = await buildForm(ctrDeps, 'gt', 'f', { kind: 'perm' }, { company: 'c', works: ['hgt'], workers: [], desc: 'd', cnum: '1', signer: 's', sid: '1', mobile: '0' }, SIGB(), { day: today, hm: '10:00', stamp: '16-11-2026' });
  check('form 146.03 not in the folder: {err}, nothing filed, no throw', !!bf.err && /146\.03/.test(bf.err) && db.puts.length === 0, bf);
  const mh = mailHtml({ kind: 'perm', ins: true }, { company: 'c', cnum: '1', contact: 'c', mobile: '0', email: 'e', works: ['hgt'], workers: [], optMissing: [], signer: 's', desc: 'd' }, [], null, [], null, false, bf);
  check('the mail then says in red the form was not made, and the names are in the summary', mh.indexOf('לא נוצר') > 0 && mh.indexOf('בטופס המסכם') > 0);
  db.tplFail = false;
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
