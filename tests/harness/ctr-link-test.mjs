// The contractor approval link (15/11/2026, phase 1): the assistant's op ctr_link makes a request and a draft
// contractor talk; the contractor's page asks for the details, the works and the documents those works need (refused on
// the server, one message per missing item), the commitment and a finger signature; the files go to the contractor's
// folder and a copy to Michael's mail; every worker of the contractor signs the safety instructions in talk.js (kind
// 'contractor'), which no list of factory trainings shows. Mocked network, nothing leaves.
import fs from 'fs';
import vm from 'vm';
import { onRequest, ctrDeps, makeCtrToken, readCtrToken, ctrLinkCheck, ctrLinkCreate, ctrLinkText, checkCtrForm, parseWorkers, mailHtml, summaryHtml, formHtml,
  pickAttach, MAIL_BUDGET, CTR_MAX_FILES, workLabel, MAIL_SUBJECT } from './_build/ctr-link.mjs';
import { KIND_CTR, CTR_PREFIX, CTR_STATE, CTR_WORKS, CTR_DOCS, CTR_DOC_L, requiredDocs, optionalDocs, missingDocs, missingMsg, ctrLinkId, parseCtrLinkId, linkTtlDays, workerTtlDays,
  safeName, ctrFolder, CTR_DIR, stateAdd, statePatch, stateList, CTR_STATE_MAX, INSTR_MISSING, isInstrMissing, CTR_OK } from './_build/_ctr.mjs';
import { onRequest as talkRequest, PERM_KINDS, TYPED_KINDS, makePermToken, talkUrl, ctrSignDeps, ctrName, fileCtrSign } from './_build/talk.mjs';
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
    if (m === 'PATCH') { db.patches.push({ id, body: JSON.parse(init.body) }); if (t && (!kind || t.kind === kind.slice(3))) Object.assign(t, JSON.parse(init.body)); return new Response(null, { status: 204 }); }
    return json(t ? [{ ...t }] : []);
  }
  if (u.startsWith(SB + '/rest/v1/toolbox_reads')) {
    if (m === 'POST') { const r = JSON.parse(init.body); db.reads.push(r); return new Response(null, { status: 201 }); }
    if (m === 'PATCH') { const id = q(u, 'id').slice(3); const r = db.reads.find((x) => x.id === id); if (r) Object.assign(r, JSON.parse(init.body)); return new Response(null, { status: 204 }); }
    const tid = (q(u, 'talk_id') || '').slice(3), like = q(u, 'emp_id');
    return json(db.reads.filter((r) => r.talk_id === tid && (!like || (like.startsWith('like.') ? r.emp_id.startsWith(like.slice(5).replace(/\*$/, '')) : r.emp_id === like.slice(3)))).map((r) => ({ id: r.id })));
  }
  if (u.startsWith(SB + '/rest/v1/emp')) { db.empReads++; return json([{ id: 'e1', n: 'עובד המפעל', dep: 'ייצור', eid: '111111118' }]); }
  if (u.startsWith(SB + '/storage/v1/object/')) { db.storage++; return json({ Key: 'x' }); }
  return json([]);
};
// Graph: never called; the deps record what would be sent.
const fakeDeps = {
  accessToken: async () => ({ token: 'gt', email: 'owner@example.test' }),
  putFile: async (token, folder, name, bytes, type, conflict) => { db.puts.push({ folder, name, size: bytes.length, type, conflict }); return { webUrl: 'https://od.example/' + encodeURIComponent(name) }; },
  sendMailTo: async (token, to, cc, subject, html, att) => { db.mails.push({ to, cc, subject, html, att: att || [] }); return true; },
  graphPdf: async () => { const u = new Uint8Array(900); u.set([0x25, 0x50, 0x44, 0x46]); return u; },
};
Object.assign(ctrDeps, fakeDeps);
Object.assign(ctrSignDeps, fakeDeps);

const PDF = () => { const u = new Uint8Array(2000); u.set([0x25, 0x50, 0x44, 0x46, 0x2d]); return u; };
const PNG = () => { const u = new Uint8Array(600); u.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); return u; };
const SIG = 'data:image/png;base64,' + Buffer.from(PNG()).toString('base64');

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
  const want = { hot: [], eng: [], hgt: ['hgtc', 'plat'], rof: ['hgtc', 'plat'], elc: ['elcl'], lft: ['crane', 'oper'], chm: ['sds'], cnf: ['cnft'], frk: ['frkl'] };
  for (const w of CTR_WORKS) {
    for (const ins of [false, true]) {
      const got = requiredDocs([w], ins);
      const exp = ['wkr'].concat(ins ? ['ins'] : []).concat(want[w]);
      check(w + (ins ? ' with' : ' without') + ' insurance: ' + got.join(','), got.length === exp.length && exp.every((k) => got.indexOf(k) >= 0), got);
    }
  }
  check('nine works: the eight of the works list and the forklift', CTR_WORKS.join() === 'hot,hgt,elc,eng,lft,chm,cnf,rof,frk' && workLabel('frk') && workLabel('hot') !== 'hot');
  check('two works that need the same document ask for it once', requiredDocs(['hgt', 'rof'], false).filter((k) => k === 'hgtc').length === 1);
  check('without insurance it is optional; with it, only "other" is', optionalDocs(false).join() === 'ins,oth' && optionalDocs(true).join() === 'oth');
  check('missing: each item by itself', missingDocs(['wkr', 'ins', 'plat'], { plat: 1 }, false).join() === 'wkr,ins');
  check('missing: the workers list typed counts as the document', missingDocs(['wkr', 'ins'], { ins: 1 }, true).length === 0);
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
  const base = { company: 'אחים בע"מ', cnum: '51-234567-8', contact: 'דני', mobile: '050-1234567', email: 'a@b.co.il', place: 'אולם 2', workers: 'ישראל ישראלי 012345678\nמוחמד עלי, 987654321', signer: 'דני כהן', commit: '1', sig: true, works: ['hgt'] };
  const files = (docs) => docs.map((doc) => ({ doc, size: 2000, type: ['pdf', 'application/pdf'] }));
  const ok = checkCtrForm(base, files(['ins', 'hgtc', 'plat']), tP);
  check('a complete form passes', !!ok.v && ok.v.workers.length === 2 && ok.v.cnum === '512345678' && ok.v.mobile === '0501234567', ok.errors);
  const miss = checkCtrForm(base, files(['ins']), tP);
  check('height work without the height certificate and the platform report: two messages, one per item', miss.errors && miss.errors.filter((e) => /^חסר מסמך/.test(e)).length === 2, miss.errors);
  const noIns = checkCtrForm(base, files(['hgtc', 'plat']), tP);
  check('insurance required by the link and not attached: refused', noIns.errors && noIns.errors.some((e) => e.indexOf(CTR_DOC_L.ins) > 0));
  const optIns = checkCtrForm({ ...base, place: 'x2' }, files(['hgtc', 'plat']), tT);
  check('insurance not required: passes, and noted as optional and not given', !!optIns.v && optIns.v.optMissing.indexOf('ins') >= 0, optIns.errors);
  const noWk = checkCtrForm({ ...base, workers: '' }, files(['ins', 'hgtc', 'plat']), tP);
  check('no workers list typed and no file: refused', noWk.errors && noWk.errors.some((e) => e.indexOf(CTR_DOC_L.wkr) > 0));
  check('the workers list as a file instead: passes', !!checkCtrForm({ ...base, workers: '' }, files(['wkr', 'ins', 'hgtc', 'plat']), tP).v);
  check('a workers line without an ID: refused naming the line', (checkCtrForm({ ...base, workers: 'ישראל ישראלי\n' }, files(['ins', 'hgtc', 'plat']), tP).errors || []).some((e) => /2|1/.test(e) && e.indexOf('שורה') > 0));
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
  check('bytes: PDF, JPG, PNG known; a renamed EXE is not', fileType(PDF())[0] === 'pdf' && fileType(PNG())[0] === 'png' && fileType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))[0] === 'jpg' && fileType(new Uint8Array([0x4d, 0x5a, 0x90, 0, 0])) === null);
  check('parseWorkers: name + ID per line', parseWorkers('א ב 123456789\n').list.length === 1 && !!parseWorkers('just a name').error);
  check('every refusal is keyboard characters only', [miss, noIns, noWk].every((r) => r.errors.every((e) => !BAD.test(e))));
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
  const rdb = fs.readFileSync(new URL('../../functions/api/routine-db.js', import.meta.url), 'utf8');
  check('ctr_instructions: Michael\'s text can be set and read; ctr_links can be read', /'ctr_links', 'ctr_instructions'\];/.test(rdb) && /'agents_registry', 'ctr_instructions'\];/.test(rdb));

  const page = await onRequest({ request: new Request(link), env: ENV });
  const html = await page.text();
  check('the page opens (200), the company escaped, no raw tag', page.status === 200 && html.indexOf('&lt;b&gt;') > 0 && html.indexOf('<b>טוב') < 0);
  check('the page asks for every field, the nine works and a file field per document', ['name="company"', 'name="cnum"', 'name="contact"', 'name="mobile"', 'name="email"', 'name="workers"', 'name="signer"', 'name="commit"', 'id="pad"'].every((x) => html.indexOf(x) >= 0)
    && CTR_WORKS.every((w) => html.indexOf('value="' + w + '"') >= 0) && CTR_DOCS.every((d) => html.indexOf('name="f_' + d[0] + '"') >= 0));
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
  for (const [k, list] of Object.entries(files || {})) for (const [name, u8] of list) fd.append('f_' + k, new Blob([u8]), name);
  // as a browser sends it: the multipart body with its size stated
  const pre = new Request(ORIGIN + '/api/ctr-link', { method: 'POST', body: fd });
  const buf = new Uint8Array(await pre.arrayBuffer());
  const r = await onRequest({ request: new Request(ORIGIN + '/api/ctr-link', { method: 'POST', body: buf, headers: { 'cf-connecting-ip': '1.2.3.4', 'content-type': pre.headers.get('content-type'), 'content-length': String(buf.length) } }), env: ENV });
  return { status: r.status, html: await r.text() };
};
const good = { company: 'בונים בע"מ', cnum: '512345678', contact: 'דני', mobile: '0501234567', email: 'd@b.co.il', workers: 'ישראל ישראלי 012345678', signer: 'דני כהן', commit: '1', sig: SIG, works: ['hgt', 'frk'] };
{
  let r = await post(good, { ins: [['a.pdf', PDF()]], hgtc: [['b.pdf', PDF()]] });
  check('refused on the server: the platform report and the forklift licence missing, one line each', r.status === 400 && r.html.indexOf(CTR_DOC_L.plat) > 0 && r.html.indexOf(CTR_DOC_L.frkl) > 0, r.html.slice(0, 300));
  check('a refused form saves nothing and sends nothing', db.puts.length === 0 && db.mails.length === 0 && stateList(db.state[CTR_STATE].value)[0].status === 'sent');
  r = await post(good, { ins: [['a.pdf', PDF()]], hgtc: [['b.pdf', PDF()]], plat: [['c.pdf', PDF()]], frkl: [['d.exe', new Uint8Array([0x4d, 0x5a, 0x90, 0, 0, 0, 0])]] });
  check('a file named .pdf/.exe that is not a PDF/JPG/PNG by its bytes: refused', r.status === 400 && db.puts.length === 0);
  db.state.ctr_instructions = { value: 'הוראות הבטיחות לקבלני חוץ: לבוש, היתרי עבודה, פינוי, דיווח על אירוע.', updated_at: new Date().toISOString() };
  r = await post(good, { ins: [['a.pdf', PDF()]], hgtc: [['b.pdf', PDF()]], plat: [['c.png', PNG()]], frkl: [['d.pdf', PDF()]], oth: [['e.pdf', PDF()]] });
  check('a complete form: 200, the new-worker link on the page', r.status === 200 && /\/api\/talk\?k=/.test(r.html), r.html.slice(0, 300));
  const folder = ctrFolder('בונים בע"מ', today.slice(0, 4));
  const inFolder = db.puts.filter((p) => p.folder === folder);
  check('five files and the summary PDF into the contractor folder (company sanitized), never replacing a file', inFolder.length === 6 && db.puts.every((p) => p.conflict === 'rename') && inFolder.some((p) => /\.pdf$/.test(p.name) && p.type === 'application/pdf' && p.name.indexOf('טופס') > 0), db.puts.map((p) => p.folder + '|' + p.name));
  check('file names: DD-MM-YYYY - the document - n.<type by bytes>', inFolder.some((p) => /^\d{2}-\d{2}-\d{4} - .+ - 1\.png$/.test(p.name)));
  const talk = db.talks['ctr-' + rid];
  check('the talk is published with the company and the instructions text', talk.s === 'פורסמה' && talk.dept === 'בונים בע"מ' && talk.body.indexOf('הוראות') === 0, talk);
  const m = db.mails[0];
  check('one mail, to Michael only (the connected mailbox)', db.mails.length === 1 && m.to.join() === 'owner@example.test' && m.cc.length === 0);
  check('the mail subject names the company, never an ID number', m.subject.indexOf('בונים') > 0 && !/\d{5,}/.test(m.subject), m.subject);
  check('the mail lists the works, every document and what is optional and not given, the commitment', m.html.indexOf(workLabel('frk')) > 0 && m.html.indexOf(CTR_DOC_L.plat) > 0 && m.html.indexOf(CTR_DOC_L.oth) > 0 && m.html.indexOf('התחייבות') > 0 && m.html.indexOf('דני כהן') > 0);
  check('the mail attaches the summary and the files (small enough)', m.att.length === 6 && m.att[0].name.indexOf('טופס') > 0 && m.att.every((a) => a.contentBytes && a['@odata.type'] === '#microsoft.graph.fileAttachment'));
  check('the mail holds no full ID number of a worker', m.html.indexOf('012345678') < 0);
  check('the mail is keyboard characters only, and RTL', !BAD.test(m.html.replace(/<[^>]+>/g, ' ')) && /^<div dir="rtl" style="direction:rtl;text-align:right/.test(m.html));
  const st = stateList(db.state[CTR_STATE].value)[0];
  check('the request is marked filled, with the files, folder and mail state (no worker ID in state)', st.status === 'filled' && st.files === 5 && st.folder === folder && st.mail === 'sent' && JSON.stringify(st).indexOf('012345678') < 0, st);
  const again = await post(good, { ins: [['a.pdf', PDF()]], hgtc: [['b.pdf', PDF()]], plat: [['c.pdf', PDF()]], frkl: [['d.pdf', PDF()]] });
  check('sent once: a second send saves nothing more', again.status === 200 && db.puts.length === 6 + 1 /* summary html source */ && db.mails.length === 1, db.puts.length);
  const reopen = await onRequest({ request: new Request(link), env: ENV });
  check('opening the link again: "already sent" and the new-worker link', reopen.status === 200 && /\/api\/talk\?k=/.test(await reopen.text()));
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
  check('the same ID signs once', db.reads.filter((r) => r.talk_id === talk.id).length === 1);
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
  const v = { company: 'co', cnum: '123456789', contact: 'c', mobile: '0501234567', email: 'a@b.co', place: 'p', works: CTR_WORKS, workers: [{ n: 'x y', id: '123456782' }], optMissing: ['ins'], signer: 's', files: [] };
  const all = [formHtml(t, { company: 'co' }, 'tok'), summaryHtml(t, v, { day: today, hm: '10:00' }, 'AAA', [{ doc: 'plat', name: 'a.pdf' }]), mailHtml(t, v, [{ doc: 'plat', name: 'a.pdf', url: 'https://x' }], { name: 's.pdf', url: 'https://x' }, [], 'https://w', true), MAIL_SUBJECT(t, v), CTR_OK];
  check('form, summary, mail, subject, declaration', all.every((s) => !BAD.test(s.replace(/<[^>]+>/g, ' '))), all.map((s) => (BAD.exec(s) || [])[0]));
  const src = fs.readFileSync(new URL('../../functions/api/ctr-link.js', import.meta.url), 'utf8') + fs.readFileSync(new URL('../../functions/_ctr.js', import.meta.url), 'utf8');
  check('no raw Hebrew in the server code (\\uXXXX only)', !/[א-ת]/.test(src));
  check('state is written with stateCas only (no merge-duplicates on server_state)', src.indexOf('merge-duplicates') < 0 && /stateCas\(/.test(src));
  const s = stateAdd(Array.from({ length: CTR_STATE_MAX + 5 }, (_, i) => ({ id: 'c' + String(i).padStart(7, '0') })), { id: 'cnewone01' });
  check('ctr_links is capped, newest first', s.length === CTR_STATE_MAX && s[0].id === 'cnewone01');
  check('statePatch: only from the expected status', statePatch([{ id: 'cabc12345', status: 'filled' }], 'cabc12345', { x: 1 }, 'sent').error === 'state' && statePatch([], 'cabc12345', {}).error === 'missing');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
