// /api/routine-db (09/10/2026, Michael: "בצע: דרך האתר שלנו", "בצע: בלי טבלת רפואה"):
// the Routines' way to the database without the Supabase connector. One key, a fixed
// list of tables, medical tables expiry only, trustee reports without text or names,
// four server_state keys to write, nothing deleted.
import fs from 'fs';
import { SITE } from './_build/_shared.mjs';
import { devEta, TOUR_CLOSE_KEY, tourRefOf, OD_AUTO, OD_AUTO_DIRS, overlapReply, OVERLAP_MS, draftTrashCheck, draftSubj, draftMadeLine, OD_DRAFT_TRASH, DRAFTS_MADE_KEY, DRAFTS_TRASHED_KEY, draftSentGate, asksOwnerToDelete, staleRefuses, staleReply, STALE_GAP_MS, asksApprovalNoButtons, devInboxTold, DEV_REF, calMoveCheck, OD_CAL_MOVE, CAL_MOVED_KEY, STATE_READ, odDedupeCheck, odDedupeVerdict, OD_TRIGGER_DIRS, sourceUrl, htmlText, skillPath, SKILL_BASE, onRequest, cleanQuery, keyOk, TABLES, COLUMNS, STATE_WRITE, STAMP_AT, stampAt, AGENT_LOG_MAX, expiryPatch, EXPIRY_TABLES, FILE_URL_PREFIX, odMoveCheck, odMkdirCheck, OD_MKDIR_DEPTH, skipNameOk, OD_ROOT, OD_INBOX, OD_SKIP, OD_REQ, OD_DRAFT, MAIL_REQ_ID, draftAttach, odPutPdfCheck, OD_PUT_MAX, odArchiveCheck, OD_ARCHIVE_DIR, devInboxAdd, devInboxDone, DEV_INBOX_MAX, POSTMAN_TRIGGER, RELAY_FIRE_GAP_S, skipMovedAdd, SKIP_MOVED_DAYS, SKIP_MOVED_MAX, CLAIM_KEY, CLAIM_HOURS, claimApply, claimItem, claimSession, pdfReadCheck, PDF_READ_MAX, waPhoneBody, WA_PHONE_STEPS, ocrTxtCheck, ocrLines, OD_OCR_DIR, pdfJpegs, OCR_MODELS, odTrashCheck, OD_TRASH_DIR, odPullCheck, OD_DESKTOP } from './_build/routine-db.mjs';

let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 400) : '')); } };
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const ENV = { ROUTINE_KEY: 'k-123', SUPABASE_SERVICE_ROLE_KEY: 'srv' };
let calls = [], state = {}, fires = [], fireSession = 'cse_01POSTMAN';
let ghCalls = [], mediaMeta = null, claudeReads = [];
globalThis.fetch = async (url, opt = {}) => {
  if (String(url).startsWith('https://www.nevo.co.il/law_html/')) { const b = new TextEncoder().encode('<html><head><meta charset="utf-8"><script>x()</script></head><body><p>75. (\u05d0) \u05dc\u05e4\u05d7\u05d5\u05ea \u05d0\u05d7\u05ea \u05dc\u05e9\u05e9\u05d4 \u05d7\u05d3\u05e9\u05d9\u05dd</p></body></html>'); const res = new Response(b, { status: 200, headers: { 'content-type': 'text/html' } }); Object.defineProperty(res, 'url', { value: String(url) }); return res; }
  if (String(url).startsWith('https://graph.facebook.com/v25.0/90000001')) return new Response(JSON.stringify(mediaMeta), { status: 200 });
  if (String(url).startsWith('https://lookaside.fbsbx.com/') || String(url).startsWith('https://evil.example/')) return new Response(new Uint8Array([0xff, 0xd8, 0xff, 0x01]), { status: 200 });
  if (String(url).startsWith('https://api.github.com/repos/mishaf1988-lgtm/michael-skills/contents/')) { ghCalls.push({ url: String(url), auth: (opt.headers || {}).Authorization }); return new Response('# law\nsection 81: 14 months', { status: 200 }); }
  calls.push({ url, method: opt.method || 'GET', body: opt.body });
  if (url.startsWith(SB + '/rest/v1/server_state')) {
    if ((opt.method || 'GET') === 'POST') { JSON.parse(opt.body).forEach((r) => { state[r.key] = r.value; }); return new Response('', { status: 201 }); }
    const keys = decodeURIComponent((/key=(?:in\.\(([^)]*)\)|eq\.(.*))/.exec(url) || []).slice(1).filter(Boolean)[0] || '').split(',');
    return new Response(JSON.stringify(keys.filter((k) => k in state).map((k) => ({ key: k, value: state[k], updated_at: 'now' }))), { status: 200 });
  }
  if (url.startsWith(SB + '/rest/v1/notifications_log') && /id=eq\.ch/.test(url)) return new Response(JSON.stringify(chatLine(url)), { status: 200 });
  if (url.startsWith(SB + '/rest/v1/oauth_tokens')) return new Response(JSON.stringify([{ user_email: 'm', refresh_token: 'r', access_token: 'at', expires_at: new Date(Date.now() + 3600e3).toISOString(), scope: 'Files.ReadWrite' }]), { status: 200 });
  if (url.startsWith('https://graph.microsoft.com/')) return graph(url, opt);
  if (url === 'https://api.anthropic.com/v1/messages') { const b = JSON.parse(opt.body); claudeReads.push({ key: opt.headers['x-api-key'], b }); if (b.messages[0].content[1].text === 'make it fail') return new Response(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'Your credit balance is too low' } }), { status: 400 }); return new Response(JSON.stringify({ content: [{ type: 'text', text: 'not written: only work at height. TEXT: ...' }] }), { status: 200 }); }
  if (url.startsWith('https://api.anthropic.com/')) { fires.push({ url, auth: opt.headers.Authorization, body: JSON.parse(opt.body) }); return new Response(JSON.stringify({ claude_code_session_id: fireSession }), { status: 200 }); }
  // expiry_set: a small docs / equip_inspections table (rows[table] = [...])
  const m = /\/rest\/v1\/(docs|equip_inspections|tour_hazards)\?(.*)$/.exec(url);
  if (m && rows[m[1]]) {
    const id = decodeURIComponent((/id=eq\.([^&]*)/.exec(m[2]) || [])[1] || '');
    const hit = rows[m[1]].filter((r) => String(r.id) === id);
    if ((opt.method || 'GET') === 'PATCH') { hit.forEach((r) => Object.assign(r, JSON.parse(opt.body))); return new Response(JSON.stringify(hit), { status: 200 }); }
    return new Response(JSON.stringify(hit.map((r) => ({ ...r }))), { status: 200 });
  }
  return new Response(JSON.stringify([{ id: 1 }]), { status: 200 });
};
let rows = {};
let graph = async () => new Response('{}', { status: 500 });
let chatLine = () => [];
const call = async (body, key = 'k-123', method = 'POST', env = ENV) => {
  const r = await onRequest({ request: new Request('https://x/api/routine-db', { method, headers: { 'x-routine-key': key, 'content-type': 'application/json' }, body: method === 'POST' ? JSON.stringify(body) : undefined }), env });
  return { status: r.status, json: await r.json() };
};

(async () => {
  console.log('\n1. the key');
  calls = [];
  check('no key: 403, nothing fetched', (await call({ op: 'select', table: 'docs' }, '')).status === 403 && !calls.length);
  check('wrong key: 403', (await call({ op: 'select', table: 'docs' }, 'nope')).status === 403 && !calls.length);
  check('no ROUTINE_KEY in Cloudflare: every call refused', (await call({ op: 'select', table: 'docs' }, '', 'POST', { SUPABASE_SERVICE_ROLE_KEY: 'srv' })).status === 403);
  check('GET: 405', (await call(null, 'k-123', 'GET')).status === 405);
  check('keyOk: same / different', (await keyOk('a', 'a')) && !(await keyOk('a', 'b')) && !(await keyOk('', '')));

  console.log('\n2. select: only the listed tables, no embedding');
  let r = await call({ op: 'select', table: 'docs', query: 'select=id,n,e&e=lte.2026-12-31' });
  check('docs: read, the query passed on', r.json.ok && calls.some((c) => c.url === SB + '/rest/v1/docs?select=id%2Cn%2Ce&e=lte.2026-12-31'), calls.map((c) => c.url));
  check('app_users: refused', (await call({ op: 'select', table: 'app_users', query: 'select=*' })).status === 400);
  check('server_state through select: refused', (await call({ op: 'select', table: 'server_state' })).status === 400);
  check('embedding another table: refused', cleanQuery('select=id,app_users(*)', 'docs') === null);
  check('in.() filter on a plain table: allowed', cleanQuery('select=id&s=in.(a,b)', 'tasks') !== null);
  check('the table list has no users / auth / backup table', !TABLES.some((t) => /user|auth|backup|server_state/.test(t)));

  console.log('\n3. medical tables: expiry only; trustee reports: no text, no names');
  check('toolbox_reads: counts per talk and department allowed (23/10/2026)', cleanQuery('select=id,talk_id,dept&talk_id=eq.w20261018', 'toolbox_reads') !== null);
  check('toolbox_reads: name, ID number, phone, signature refused', ['emp_name', 'id_no', 'phone', 'sig_url', 'emp_no', 'emp_id'].every((c) => cleanQuery('select=' + c, 'toolbox_reads') === null) && cleanQuery('select=*', 'toolbox_reads') === null && cleanQuery('select=id&emp_name=eq.x', 'toolbox_reads') === null);
  check('med select=e: allowed', cleanQuery('select=e&e=lte.2026-12-31', 'med') !== null);
  check('med select=*: refused', cleanQuery('select=*', 'med') === null);
  check('med without select: refused', cleanQuery('e=lte.2026-12-31', 'med') === null);
  check('med select=w,e (the worker): refused', cleanQuery('select=w,e', 'med') === null);
  check('med alias of a hidden column: refused', cleanQuery('select=x:d', 'med') === null);
  check('med filter on a hidden column: refused', cleanQuery('select=e&w=eq.x', 'med') === null);
  check('med or=(): refused', cleanQuery('select=e&or=(w.eq.x,e.is.null)', 'med') === null);
  check('med order by a hidden column: refused', cleanQuery('select=e&order=w.asc', 'med') === null);
  check('hearing_tests: expiry only', cleanQuery('select=e', 'hearing_tests') !== null && cleanQuery('select=emp_name,e', 'hearing_tests') === null);
  check('trustee_reports: place, status, dates', cleanQuery('select=loc,s,ts,closed_d&ts=gte.2026-07-01', 'trustee_reports') !== null);
  check('trustee_reports: free text and names refused', ['d', 'm', 'f', 'u', 'mgr_note', 'verified_by', 'photo_url'].every((c) => cleanQuery('select=' + c, 'trustee_reports') === null));
  check('the medical lists hold nothing but id and e', ['med', 'hearing_tests'].every((t) => COLUMNS[t].every((c) => c === 'id' || c === 'e')));
  calls = [];
  r = await call({ op: 'select', table: 'med', query: 'select=*' });
  check('med select=* through the endpoint: 400, nothing fetched', r.status === 400 && !calls.length, r);

  console.log('\n4. server_state: four keys to write, read back');
  state = { quote_track: '{}', weekly_digest: 'x' };
  r = await call({ op: 'state_get', keys: ['quote_track', 'weekly_digest'] });
  check('state_get: only the allowed key comes back', r.json.ok && r.json.rows.length === 1 && r.json.rows[0].key === 'quote_track', r.json);
  r = await call({ op: 'state_set', key: 'quote_track', value: { 'Q-eq-1-261101': { stage: 'sent', sent: '2026-10-11' } } });
  check('state_set: written and read back equal', r.json.ok && JSON.parse(state.quote_track)['Q-eq-1-261101'].stage === 'sent', r.json);
  check('state_set of another key (weekly_digest): refused, untouched', (await call({ op: 'state_set', key: 'weekly_digest', value: 'y' })).status === 400 && state.weekly_digest === 'x');
  check('wa_phone: SMS in Hebrew, a 6-digit code only, the PIN from the secret first, else the request (24/10/2026)', WA_PHONE_STEPS.join() === 'request_code,verify_code,register,deregister' && JSON.stringify(waPhoneBody('deregister', {}).body) === '{}' && waPhoneBody('request_code', {}).body.code_method === 'SMS' && waPhoneBody('request_code', {}).body.language === 'he' && waPhoneBody('verify_code', { code: '123-456' }).body.code === '123456' && !!waPhoneBody('verify_code', { code: '12345' }).error && waPhoneBody('register', { pin: '111111' }, undefined).body.pin === '111111' && !!waPhoneBody('register', {}, undefined).error && waPhoneBody('register', { pin: '111111' }, '654321').body.pin === '654321');
  check('ocr_txt: PDFs only, txt named after the PDF, lines joined page by page; the answer never carries the text (24/10/2026)', (() => {
    const ok = ocrTxtCheck({ paths: ['_\u05e0\u05db\u05e0\u05e1 \u05de\u05d4\u05de\u05d9\u05d9\u05dc/2026-10-22 0532 - a.pdf'] });
    const lines = ocrLines({ analyzeResult: { readResults: [{ lines: [{ text: 'x' }, { text: 'y' }] }, { lines: [{ text: 'z' }] }] } });
    return ok.files && ok.files[0].txt === '2026-10-22 0532 - a.txt' && !!ocrTxtCheck({ paths: ['a.docx'] }).error && !!ocrTxtCheck({}).error && lines === 'x\ny\n\nz' && OD_OCR_DIR.length > 3
      && !/text: text|answer: text/.test(fs.readFileSync(new URL('../../functions/api/routine-db.js', import.meta.url), 'utf8').split("body.op === 'ocr_txt'")[1].split("body.op === 'pdf_read'")[0]);
  })());
  check('pdfJpegs: finds each JPEG (FFD8FF..FFD9) in a PDF body, skips tiny ones, stops at max (24/10/2026)', (() => {
    const jpg = (n) => [0xFF, 0xD8, 0xFF].concat(new Array(n).fill(7), [0xFF, 0xD9]);
    const buf = Uint8Array.from([].concat([37, 80, 68, 70], jpg(3000), [10, 10], jpg(10), [1], jpg(2500), jpg(2600)));
    const got = pdfJpegs(buf, 2);
    return got.length === 2 && got[0].length === 3005 && got[1].length === 2505 && pdfJpegs(Uint8Array.from([1, 2, 3]), 3).length === 0 && OCR_MODELS.length >= 2;
  })());
  check('od_pull never into the mail-flow folders (draft, file request, inbox, calendar queue, OCR text): those take files through mail_draft / mail_request only (25/10/2026 retro)', (() => {
    const t = (d) => odPullCheck({ agent: 'dev', why: 'to a flow folder', from: 'x/a.txt', dir: d });
    return OD_TRIGGER_DIRS.length === 8 && OD_TRIGGER_DIRS.every((d) => !!t(d).error) && !!t(OD_DRAFT + '/sub').error && !t('22_x/09_y').error;
  })());
  check('od_pull: one file from the desktop INTO a folder of the safety folder; never from inside it, never into old versions, never above the desktop (24/10/2026)', (() => {
    const ok = odPullCheck({ agent: 'dev', why: 'to the binder', from: 'תקני ISO/2026/a.docx', dir: '22_x/09_y' });
    return ok.from === OD_DESKTOP + 'תקני ISO/2026/a.docx' && ok.to === OD_ROOT + '22_x/09_y' && ok.name === 'a.docx'
      && !odPullCheck({ agent: 'dev', why: 'to delete', from: 'x/a.pdf', dir: OD_TRASH_DIR }).error
      && !!odPullCheck({ agent: 'dev', why: 'inside', from: 'ניהול בטיחות/a.pdf', dir: '22_x' }).error
      && !!odPullCheck({ agent: 'dev', why: 'old versions', from: 'x/a.pdf', dir: '22_x/_גרסאות קודמות' }).error
      && !!odPullCheck({ agent: 'dev', why: 'climb up', from: '../a.pdf', dir: '22_x' }).error && !!odPullCheck({ agent: 'dev', why: 'a folder', from: 'x/folder', dir: '22_x' }).error
      && !!odPullCheck({ agent: 'dev', why: 'climb', from: 'x/a.pdf', dir: '../y' }).error && !!odPullCheck({ agent: 'dev', why: 'x', from: 'x/a.pdf', dir: '22_x' }).error;
  })());
  check('od_pull dest desktop: between folders outside the safety folder, never into it, never into old versions (24/10/2026)', (() => {
    const ok = odPullCheck({ agent: 'dev', why: 'tidy old iso', from: 'iso9001/a/x.pdf', dir: 'iso9001/b', dest: 'desktop' });
    return ok.to === OD_DESKTOP + 'iso9001/b' && ok.from === OD_DESKTOP + 'iso9001/a/x.pdf'
      && !!odPullCheck({ agent: 'dev', why: 'into safety', from: 'iso9001/x.pdf', dir: '\u05e0\u05d9\u05d4\u05d5\u05dc \u05d1\u05d8\u05d9\u05d7\u05d5\u05ea/22_x', dest: 'desktop' }).error
      && !!odPullCheck({ agent: 'dev', why: 'old versions', from: 'iso9001/x.pdf', dir: 'iso9001/_\u05d2\u05e8\u05e1\u05d0\u05d5\u05ea \u05e7\u05d5\u05d3\u05de\u05d5\u05ea', dest: 'desktop' }).error
      && !!odPullCheck({ agent: 'dev', why: 'climb up', from: 'iso9001/x.pdf', dir: '../b', dest: 'desktop' }).error
      && !!odPullCheck({ agent: 'dev', why: 'bad dest', from: 'iso9001/x.pdf', dir: 'b', dest: 'drive' }).error;
  })());
  check('od_put_pdf: an old .doc / .xls as it is, by the OLE signature; a zip or PDF named .doc is refused (24/10/2026)', (() => {
    const ole = Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1, 1, 2]).toString('base64'), zip = Buffer.from('PK\x03\x04abcd').toString('base64');
    const P = { agent: 'dev', why: 'file as it is', dir: '22_x' };
    return odPutPdfCheck({ ...P, name: 'a.doc', b64: ole }).type === 'application/msword' && odPutPdfCheck({ ...P, name: 'a.xls', b64: ole }).type === 'application/vnd.ms-excel'
      && !!odPutPdfCheck({ ...P, name: 'a.doc', b64: zip }).error && !!odPutPdfCheck({ ...P, name: 'a.docx', b64: ole }).error && !!odPutPdfCheck({ ...P, name: 'a.exe', b64: ole }).error;
  })());
  check('od_dedupe: two clean paths inside the safety folder, not the same file (25/10/2026)', (() => {
    const ok = odDedupeCheck({ agent: 'routine-wa-assistant', why: 'duplicate of the form', path: '02_x/a (1).pdf', keep: '02_x/a.pdf' });
    return ok.del === OD_ROOT + '02_x/a (1).pdf' && ok.keep === OD_ROOT + '02_x/a.pdf'
      && odDedupeCheck({ agent: 'a1', why: 'duplicate', path: '02_x/a.pdf', keep: '02_x/a.pdf' }).error === 'path and keep are the same file'
      && odDedupeCheck({ agent: 'a1', why: 'duplicate', path: '02_x/a.pdf', keep: '../a.pdf' }).error === 'bad keep path'
      && !!odDedupeCheck({ agent: 'a1', why: 'x', path: '02_x/a.pdf', keep: '02_x/b.pdf' }).error;
  })());
  {
    const f = (id, app, hash, size) => ({ id, size, file: { hashes: { quickXorHash: hash } }, createdBy: app ? { application: { id: app } } : { user: { displayName: 'M' } } });
    const V = odDedupeVerdict;
    check('od_dedupe: goes only when this server made it and the kept file has the same size and hash',
      V(f('1', 'APP', 'h', 10), f('2', null, 'h', 10), 'APP') === null
      && V(f('1', null, 'h', 10), f('2', 'APP', 'h', 10), 'APP') === 'not created by the server'
      && V(f('1', 'FLOW', 'h', 10), f('2', null, 'h', 10), 'APP') === 'not created by the server'
      && V(f('1', 'APP', 'h', 10), f('2', null, 'g', 10), 'APP') === 'content differs'
      && V(f('1', 'APP', 'h', 10), f('2', null, 'h', 11), 'APP') === 'content differs'
      && V(f('1', 'APP', '', 10), f('2', null, '', 10), 'APP') === 'content differs'
      && V(f('1', 'APP', 'h', 10), f('1', null, 'h', 10), 'APP') === 'same item'
      && V(f('1', 'APP', 'h', 10), f('2', null, 'h', 10), undefined) === 'not created by the server'
      && V({ id: '1' }, f('2', null, 'h', 10), 'APP') === 'not a file');
  }
  check('od_trash: one file to the to-delete folder named after its folder; never from inside it or old versions, never a folder (24/10/2026)', (() => {
    const ok = odTrashCheck({ agent: 'dev', why: 'a test file', path: '18_x/2026 - a.pdf' });
    return ok.to === OD_ROOT + OD_TRASH_DIR && ok.name === '18_x - 2026 - a.pdf' && !!odTrashCheck({ agent: 'dev', why: 'x', path: '18_x/a.pdf' }).error
      && !!odTrashCheck({ agent: 'dev', why: 'a test', path: OD_TRASH_DIR + '/a.pdf' }).error && !!odTrashCheck({ agent: 'dev', why: 'a test', path: '18_x/_\u05d2\u05e8\u05e1\u05d0\u05d5\u05ea \u05e7\u05d5\u05d3\u05de\u05d5\u05ea/a.pdf' }).error
      && !!odTrashCheck({ agent: 'dev', why: 'a test', path: 'a.pdf' }).error && !!odTrashCheck({ agent: 'dev', why: 'a test', path: '18_x/folder' }).error;
  })());
  check('the write list is exactly the eight keys (mail_filing, validity_run 11/10/2026; iso_tasks 24/10/2026; mail_triage 25/10/2026)', STATE_WRITE.join() === 'quote_track,nevo_versions,od_raw_token,od_raw_exp,mail_filing,validity_run,iso_tasks,mail_triage');
  const t0 = Date.now();
  r = await call({ op: 'state_set', key: 'mail_filing', value: [{ at: '2020-01-01T00:00:00Z', got: 1 }, { at: '2026-10-11T15:05:00Z', got: 0 }] });
  const mf = JSON.parse(state.mail_filing);
  check('state_set mail_filing: the server stamps "at" of the last entry, not a guessed one', r.json.ok && Math.abs(Date.parse(mf[1].at) - t0) < 60000 && mf[0].at === '2020-01-01T00:00:00Z', mf);
  r = await call({ op: 'state_set', key: 'validity_run', value: { at: 'x', checked: 3 } });
  check('state_set validity_run: "at" stamped by the server', r.json.ok && Math.abs(Date.parse(JSON.parse(state.validity_run).at) - t0) < 60000, state.validity_run);
  r = await call({ op: 'state_set', key: 'quote_track', value: { at: 'keep' } });
  check('state_set of a key outside STAMP_AT: "at" kept as sent', JSON.parse(state.quote_track).at === 'keep' && STAMP_AT.join() === 'mail_filing,validity_run', state.quote_track);
  check('stampAt: an empty list and a string stay as they are', stampAt([], 'T').length === 0 && stampAt('s', 'T') === 's');
  calls = [];
  await call({ op: 'delete', table: 'docs' });
  check('no delete op: nothing sent', !calls.length);
  {
    // 11/10/2026: two PATCHes, one in expiry_set (docs / equip_inspections by id) and one in
    // od_move (a OneDrive item, conflictBehavior=fail). Still no DELETE.
    const src = fs.readFileSync(new URL('../../functions/api/routine-db.js', import.meta.url), 'utf8');
    const patches = src.match(/method:\s*'PATCH'/g) || [];
    // each PATCH belongs to the op block it sits in (the nearest "body.op === '...'" above it)
    const ops = [...src.matchAll(/body\.op === '([a-z_]+)'/g)].map((m) => ({ op: m[1], at: m.index }));
    const owner = (p) => ops.filter((o) => o.at < p).pop();
    const own = [...src.matchAll(/method:\s*'PATCH'/g)].map((m) => (owner(m.index) || {}).op).sort().join();
    // 20/10/2026: hazard_choice, one note column on trustee_reports / near_miss (Michael: "only record").
    // 20/10/2026: od_archive, a move of an old form version into "_גרסאות קודמות" (Michael: "to the archive").
    // 25/10/2026: the one DELETE, od_dedupe (Michael in the questionnaire: "do it: to the recycle bin"); only there, and only of a Graph item
    const dels = [...src.matchAll(/method:\s*'DELETE'/g)].map((m) => (owner(m.index) || {}).op);
    check('one DELETE, in od_dedupe only, of a OneDrive item (to the recycle bin); never a table row', dels.join() === 'od_dedupe' && /graph\.microsoft\.com\/v1\.0\/me\/drive\/items\/' \+ encodeURIComponent\(item\.id\), \{ method: 'DELETE'/.test(src), dels);
    check('no other DELETE; one PATCH each in expiry_set, hazard_choice, od_archive, od_move, od_pull and od_trash (24/10/2026, moves, not deletes) and talk_field', dels.length === 1 && patches.length === 7 && own === 'expiry_set,hazard_choice,od_archive,od_move,od_pull,od_trash,talk_field', own);
  }

  console.log('\n4b. agent_report: append-only run log');
  state = {};
  r = await call({ op: 'agent_report', agent: 'routine-quotes', ok: true, line: 'אין שינוי', learned: 'אין' });
  check('first report: written, one entry with a server time', r.json.ok && JSON.parse(state.agent_log).length === 1 && /^\d{4}-\d\d-\d\dT/.test(JSON.parse(state.agent_log)[0].at), r.json);
  await call({ op: 'agent_report', agent: 'retro', ok: false, line: 'push נדחה', learned: 'x'.repeat(500) });
  let lg = JSON.parse(state.agent_log);
  check('second report: appended, not replacing; ok false kept; text cut to 300', lg.length === 2 && lg[0].agent === 'routine-quotes' && lg[1].ok === false && lg[1].learned.length === 300, lg);
  check('ok that is not exactly true counts as a failure', (await call({ op: 'agent_report', agent: 'retro', ok: 'yes', line: 'x' })).json.entry.ok === false);
  // 21/10/2026: {status, did} instead of {ok, line} left empty ok:false rows that read as failed runs.
  check('an empty report (no line, no for_michael): refused, log untouched', (await call({ op: 'agent_report', agent: 'routine-wa-assistant', status: 'done', did: 'x' })).status === 400 && JSON.parse(state.agent_log).length === 3);
  check('a bad agent name: refused, log untouched', (await call({ op: 'agent_report', agent: 'Bad Name; drop' })).status === 400 && JSON.parse(state.agent_log).length === 3);
  state.agent_log = JSON.stringify(Array.from({ length: AGENT_LOG_MAX }, (_, i) => ({ agent: 'a', at: String(i) })));
  await call({ op: 'agent_report', agent: 'retro', ok: true, line: 'x' });
  lg = JSON.parse(state.agent_log);
  check('the log keeps the last ' + AGENT_LOG_MAX, lg.length === AGENT_LOG_MAX && lg[0].at === '1' && lg[lg.length - 1].agent === 'retro');
  state.wa_last_out = JSON.stringify({ at: '2026-10-20T18:00:00Z', text: 'x'.repeat(3000) });
  check('agent_report for_michael: kept (cut to 300), absent when empty', (await call({ op: 'agent_report', agent: 'routine-coa', ok: true, for_michael: 'z'.repeat(400) })).json.entry.for_michael.length === 300 && !('for_michael' in (await call({ op: 'agent_report', agent: 'routine-coa', ok: true, line: 'x' })).json.entry));
  // 20/10/2026: dev_inbox, requests to development (the office board refused the assistant's write)
  {
    let r = await call({ op: 'dev_request', agent: 'routine-wa-assistant', text: 'צריך צעד חודשי חדש לדוח המים' });
    const inbox = JSON.parse(state.dev_inbox || '[]');
    check('dev_request: kept open with an id, the agent and the text', r.json.ok && /^dev-\d{14}-/.test(r.json.id) && inbox.length === 1 && inbox[0].status === 'open' && inbox[0].agent === 'routine-wa-assistant', { r: r.json, inbox });
    check('dev_inbox is readable through state_get, not writable through state_set', (await call({ op: 'state_get', keys: ['dev_inbox'] })).json.rows.length === 1 && (await call({ op: 'state_set', key: 'dev_inbox', value: '[]' })).status === 400);
    r = await call({ op: 'dev_done', id: inbox[0].id, note: 'מוזג #1789' });
    check('dev_done with a note: a for_michael line from "dev" in agent_log', JSON.parse(state.agent_log).some((x) => x.agent === 'dev' && x.for_michael === 'מוזג #1789'), state.agent_log);
    check('dev_done: closed with the note; an unknown id refused', r.json.ok && r.json.open === 0 && JSON.parse(state.dev_inbox)[0].status === 'done' && (await call({ op: 'dev_done', id: 'dev-x' })).status === 400, r.json);
    check('a short text, a bad agent: refused', (await call({ op: 'dev_request', agent: 'routine-wa-assistant', text: 'קצר' })).status === 400 && (await call({ op: 'dev_request', agent: 'Bad Name', text: 'x'.repeat(20) })).status === 400);
    let raw = JSON.stringify([{ id: 'o', status: 'open' }].concat(Array.from({ length: DEV_INBOX_MAX }, (_, i) => ({ id: 'd' + i, status: 'done' }))));
    const full = devInboxAdd(raw, { agent: 'dev', text: 'x'.repeat(20) }, '2026-10-20T20:00:00Z');
    check('at most ' + DEV_INBOX_MAX + ': the oldest done one goes, an open one stays', full.list.length === DEV_INBOX_MAX && full.list[0].id === 'o' && !full.list.some((x) => x.id === 'd0'), full.list.length);
    const dup = devInboxAdd(JSON.stringify([{ id: 'o1', agent: 'dev', text: 'x'.repeat(20), status: 'open' }]), { agent: 'dev', text: 'x'.repeat(20) }, '2026-10-21T05:00:00Z');
    check('the same open request again: the same id, not a second row (21/10/2026 retro)', dup.id === 'o1' && dup.list.length === 1, dup);
    const allOpen = devInboxAdd(JSON.stringify(Array.from({ length: DEV_INBOX_MAX }, (_, i) => ({ id: 'p' + i, agent: 'dev', text: 'q' + i + 'x'.repeat(20), status: 'open' }))), { agent: 'dev', text: 'new ' + 'y'.repeat(20) }, '2026-10-21T05:00:00Z');
    check('all open and full: refused, the oldest open one is not dropped', allOpen.error === 'inbox full' && !allOpen.list, allOpen);
  }
  // 21/10/2026: a new request fires the immediate-development Routine, once, only with the token
  {
    { const { officeFireText, OFFICE_ROW } = await import('./_build/routine-db.mjs');
      const t = officeFireText('abc123XYZ', 'תבדוק\nמה עם טופס 16', '2026-10-22T05:00:00.000Z');
      check('office_ask: the head names the office and the row, the text is one line, the answer goes to WhatsApp', t.split('\n')[0].indexOf('מהמשרד של מיכאל') >= 0 && t.includes('abc123XYZ') && t.includes('text: תבדוק / מה') && t.includes('wa_me') && t.includes('doc_id ans-abc123XYZ') && t.includes('reply_to: "abc123XYZ"'), t);
      const tr = officeFireText('abc123XYZ', 'וגם את הגז', '2026-10-23T15:00:00.000Z', '18:36 מיכאל: מתי פג אישור הכבאות');
      check('office_ask: the conversation so far rides along as recent, and only when there is one (23/10/2026)', tr.split('\n').pop().startsWith('recent (') && tr.includes('אישור הכבאות') && !t.includes('recent ('), tr);
      check('office_ask: a row id is a db id, not free text', OFFICE_ROW.test('k9Xz_12-ab') && !OFFICE_ROW.test('a b') && !OFFICE_ROW.test('x')); }
    { const { devFireTarget, RUNNER_TRIGGER, DEV_TRIGGER } = await import('./_build/routine-db.mjs');
      const a = devFireTarget({ RUNNER_FIRE_TOKEN: 'r', DEV_FIRE_TOKEN: 'd' }), b = devFireTarget({ DEV_FIRE_TOKEN: 'd' });
      check('dev_request: the runner token does not change the target (an API fire opens a new session, 22/10/2026)', a.which === 'dev' && !a.url.includes(RUNNER_TRIGGER), a);
      check('dev_request: without it, the immediate-development Routine as before; no token at all = no fire', b.which === 'dev' && b.url.includes(DEV_TRIGGER) && b.body === null && devFireTarget({}) === null, b); }
    check('wa_me: a sign* ref is the server\'s own (22/10/2026), refused before anything is sent', (await call({ op: 'wa_me', agent: 'routine-wa-assistant', text: 'x', ref: 'signmail' })).status === 400);
    { const { signRequestCheck } = await import('./_build/routine-db.mjs');
      const c = signRequestCheck({ agent: 'routine-wa-assistant', why: 'test test', path: '99_x/a.pdf', page: 2, x: 225, y: 342, w: 90 });
      check('sign_request / sign_offer: a set spot with its width passes, a width out of range does not', c.page === 2 && c.w === 90 && !!signRequestCheck({ agent: 'routine-wa-assistant', why: 'test test', path: '99_x/a.pdf', page: 2, x: 1, y: 1, w: 500 }).error, c);
      check('a second signed copy "(2)" is never offered for signing', !!signRequestCheck({ agent: 'routine-wa-assistant', why: 'test test', path: '99_x/a - \u05d7\u05ea\u05d5\u05dd (2).pdf' }).error); }
    { const { permitSpot } = await import('./_build/routine-db.mjs');
      check('a scanned 2-page safety permit gets the safety officer row, anything else nothing (23/10/2026)', permitSpot('2026-10-22 0943 - \u05d4\u05e8\u05e9\u05d0\u05ea \u05d1\u05d8\u05d9\u05d7\u05d5\u05ea \u05e0\u05d2\u05d1.pdf', 2).page === 2 && permitSpot('\u05d4\u05e8\u05e9\u05d0\u05ea \u05e2\u05d1\u05d5\u05d3\u05d4 x.pdf', 2).x === 225 && permitSpot('\u05d4\u05e8\u05e9\u05d0\u05ea \u05d1\u05d8\u05d9\u05d7\u05d5\u05ea.pdf', 3) === null && permitSpot('\u05d4\u05e6\u05e2\u05ea \u05de\u05d7\u05d9\u05e8.pdf', 2) === null); }
    { const { claimGate } = await import('./_build/routine-db.mjs');
      check('claim gate: "missing" / "expired" / "waits for you" needs where it was checked (23/10/2026)', !!claimGate('\u05d0\u05d9\u05e9\u05d5\u05e8 \u05d4\u05d2\u05d6 \u05e4\u05d2.') && !!claimGate('\u05de\u05d7\u05db\u05d4 \u05dc\u05da: \u05d4\u05d8\u05d9\u05d5\u05d8\u05d4') && claimGate('\u05d0\u05d9\u05e9\u05d5\u05e8 \u05d4\u05d2\u05d6 \u05e4\u05d2.', 'outlook Sent Items + docs row 12') === null);
      check('claim gate: "I prepared 2 drafts" / "the draft is ready" needs checked naming Drafts; "will appear in Drafts" passes (26/10/2026)',
        !!claimGate('\u05d4\u05db\u05e0\u05ea\u05d9 2 \u05d8\u05d9\u05d5\u05d8\u05d5\u05ea, \u05db\u05dc \u05d0\u05d7\u05ea \u05d1\u05e9\u05e8\u05e9\u05d5\u05e8') && !!claimGate('\u05d4\u05d8\u05d9\u05d5\u05d8\u05d4 \u05de\u05d5\u05db\u05e0\u05d4 \u05dc\u05e9\u05dc\u05d9\u05d7\u05d4') && !!claimGate('\u05d4\u05db\u05e0\u05ea\u05d9 \u05d8\u05d9\u05d5\u05d8\u05d4', 'Sent Items x')
        && claimGate('\u05d4\u05db\u05e0\u05ea\u05d9 2 \u05d8\u05d9\u05d5\u05d8\u05d5\u05ea', 'Drafts \u05d4\u05e0\u05d7\u05d4 13:02') === null && claimGate('\u05d1\u05d9\u05e7\u05e9\u05ea\u05d9 \u05d8\u05d9\u05d5\u05d8\u05d4, \u05ea\u05d5\u05e4\u05d9\u05e2 \u05d1-Drafts \u05ea\u05d5\u05da \u05d3\u05e7\u05d4') === null);
      check('claim gate: words that only contain the letters pass (a meeting, a lack in a sentence about something else)', claimGate('\u05e4\u05d2\u05d9\u05e9\u05d4 \u05de\u05d7\u05e8 \u05d1-10') === null && claimGate('\u05d1\u05d3\u05e7\u05ea\u05d9, \u05d4\u05db\u05dc \u05ea\u05e7\u05d9\u05df') === null);
      check('claim gate: "I sent the mail" is refused even with checked; a draft found in Drafts is fine', !!claimGate('\u05e9\u05dc\u05d7\u05ea\u05d9 \u05d0\u05ea \u05d4\u05de\u05d9\u05d9\u05dc \u05dc\u05d0\u05d9\u05dc', 'Sent Items') && claimGate('\u05d4\u05db\u05e0\u05ea\u05d9 \u05d8\u05d9\u05d5\u05d8\u05d4 \u05dc\u05d0\u05d9\u05dc', 'Drafts \u05d2\u05d6 10:02') === null); }
    // wa_file (22/10/2026): the paths follow draftAttach; nothing is read or sent before they pass
    { const before = calls.length;
      check('wa_file: a path out of the safety folder, a .exe, or too many: 400', (await call({ op: 'wa_file', agent: 'routine-wa-assistant', paths: ['../x.pdf'] })).status === 400
        && (await call({ op: 'wa_file', agent: 'routine-wa-assistant', paths: ['a/b.exe'] })).status === 400
        && (await call({ op: 'wa_file', agent: 'routine-wa-assistant', paths: ['a/1.pdf', 'a/2.pdf', 'a/3.pdf', 'a/4.pdf', 'a/5.pdf', 'a/6.pdf'] })).status === 400);
      check('wa_file: an unknown field (a recipient) is refused', (await call({ op: 'wa_file', agent: 'routine-wa-assistant', paths: ['a/b.pdf'], to: '972500000000' })).status === 400);
      check('wa_file: nothing fetched for a refused call', calls.length === before, calls.slice(before)); }
    { const { workerJobAdd, workerJobDone, workerFireText, WORKERS, WORKER_FIRE_HEAD } = await import('./_build/routine-db.mjs');
      const now = '2026-10-21T16:00:00.000Z', task = '\u05dc\u05d1\u05d3\u05d5\u05e7 \u05d4\u05e6\u05e2\u05ea \u05de\u05d7\u05d9\u05e8 \u05de\u05d0\u05dc\u05e2\u05d3';
      const a = workerJobAdd('[]', { agent: 'routine-wa-assistant', worker: WORKERS[2], task }, now);
      check('worker_now: a job for a known worker is created', a.created && a.list.length === 1 && a.list[0].status === 'open' && /^job-\d{14}-/.test(a.id), a);
      check('worker_now: the same open task again is the same job', workerJobAdd(JSON.stringify(a.list), { agent: 'routine-wa-assistant', worker: WORKERS[2], task }, now).created !== true);
      check('worker_now: an unknown worker is refused', !!workerJobAdd('[]', { agent: 'routine-wa-assistant', worker: 'x', task }, now).error);
      const d = workerJobDone(JSON.stringify(a.list), a.id, '\u05e0\u05d1\u05d3\u05e7, \u05d4\u05d4\u05e6\u05e2\u05d4 \u05d1\u05ea\u05d5\u05e7\u05e3', now);
      check('worker_done: closes once, with the note; a second close is refused', d.job && d.job.status === 'done' && !!workerJobDone(JSON.stringify(d.list), a.id, '\u05e9\u05d5\u05d1 \u05e9\u05d5\u05d1', now).error, d);
      check('worker fire text: the exact head line, then id and worker', workerFireText(a.list[0]).split('\n')[0] === WORKER_FIRE_HEAD && workerFireText(a.list[0]).indexOf('worker: ' + WORKERS[2]) > 0); }
    { const { greetByHour } = await import('./_build/routine-db.mjs');
      const gm = '\u05d1\u05d5\u05e7\u05e8 \u05d8\u05d5\u05d1 \u05d0\u05dc\u05d9\u05e0\u05d4,\n\u05e9\u05dc\u05d5\u05dd';
      check('greeting: good morning kept at 10:30 Israel', greetByHour(gm, Date.parse('2026-10-21T07:30:00Z')) === gm);
      check('greeting: good morning becomes hi at 11:57 Israel', greetByHour(gm, Date.parse('2026-10-21T08:57:00Z')) === '\u05d4\u05d9\u05d9 \u05d0\u05dc\u05d9\u05e0\u05d4,\n\u05e9\u05dc\u05d5\u05dd', greetByHour(gm, Date.parse('2026-10-21T08:57:00Z')));
      // 25/10/2026: the draft to the supply chain manager was made at 10:26 Israel (winter time, UTC+2) and opened with "hi"
      const hi = '\u05d4\u05d9\u05d9 \u05d0\u05dc\u05d9\u05e0\u05d4,\n\u05e9\u05dc\u05d5\u05dd';
      check('greeting: hi becomes good morning at 10:26 Israel, winter time', greetByHour(hi, Date.parse('2026-10-25T08:26:00Z')) === gm, greetByHour(hi, Date.parse('2026-10-25T08:26:00Z')));
      check('greeting: hi kept at 11:05 Israel and at 03:00 Israel', greetByHour(hi, Date.parse('2026-10-25T09:05:00Z')) === hi && greetByHour(hi, Date.parse('2026-10-25T01:00:00Z')) === hi);
      const was = '\u05d4\u05d9\u05d9\u05ea\u05d9 \u05d1\u05de\u05e4\u05e2\u05dc';
      check('greeting: a word that starts like hi is not touched', greetByHour(was, Date.parse('2026-10-25T07:00:00Z')) === was); }
    const { DEV_TRIGGER, DEV_FIRE_HEAD } = await import('./_build/routine-db.mjs');
    state.dev_inbox = '[]'; const f0 = fires.length;
    let r = await call({ op: 'dev_request', agent: 'routine-wa-assistant', text: 'בלי טוקן לא מפעילים כלום' });
    check('dev fire: no DEV_FIRE_TOKEN, no fire', r.json.ok && fires.length === f0 && r.json.fired === null, r.json);
    const E = Object.assign({}, ENV, { DEV_FIRE_TOKEN: 'dt' });
    r = await call({ op: 'dev_request', agent: 'routine-wa-assistant', text: 'בקשה חדשה עם טוקן: לבנות משהו' }, 'k-123', 'POST', E);
    const last = fires[fires.length - 1];
    check('dev fire: a new request fires the dev Routine with its id and text, the server line first', fires.length === f0 + 1 && last.url.indexOf(DEV_TRIGGER) > 0 && last.auth === 'Bearer dt' && last.body.text.split('\n')[0] === DEV_FIRE_HEAD && last.body.text.indexOf('id: ' + r.json.id) >= 0 && last.body.text.indexOf('לבנות משהו') > 0, last);
    check('dev fire: the session is kept on the request (the postman skips it)', JSON.parse(state.dev_inbox).find((x) => x.id === r.json.id).fired_session === r.json.fired.session && !!r.json.fired.session, state.dev_inbox);
    await call({ op: 'dev_request', agent: 'routine-wa-assistant', text: 'בקשה חדשה עם טוקן: לבנות משהו' }, 'k-123', 'POST', E);
    check('dev fire: the same open request again does not fire twice', fires.length === f0 + 1);
    state.dev_inbox = '[]'; fires.length = f0;
  }
  check('wa_last_out (the assistant\'s last answer, 20/10/2026) is readable, not writable', (await call({ op: 'state_get', keys: ['wa_last_out'] })).json.rows.length === 1 && (await call({ op: 'state_set', key: 'wa_last_out', value: '{}' })).status === 400);
  check('agent_log is readable through state_get, not writable through state_set', (await call({ op: 'state_get', keys: ['agent_log'] })).json.rows.length === 1 && (await call({ op: 'state_set', key: 'agent_log', value: '[]' })).status === 400);

  console.log('\n4g. claim: one session takes an open item (12/10/2026, lesson 10)');
  {
    const A = 'cse_012U83ozxzQjH8BcQ2AvykSf', B = 'session_01OtherSessionAbcdef';
    let c = await call({ op: 'claim', item: 'Status-Lo-Letiyuk', session: A, note: 'skip_seen' });
    check('first claim: mine, stored under session_ (cse_ is the same session), item lower-cased', c.json.ok && c.json.mine && JSON.parse(state[CLAIM_KEY])['status-lo-letiyuk'].session === 'session_012U83ozxzQjH8BcQ2AvykSf', c.json);
    c = await call({ op: 'claim', item: 'status-lo-letiyuk', session: B });
    check('another session: not mine, told who holds it, nothing written', c.json.ok && c.json.mine === false && c.json.holder.session === 'session_012U83ozxzQjH8BcQ2AvykSf' && JSON.parse(state[CLAIM_KEY])['status-lo-letiyuk'].session.startsWith('session_012U'), c.json);
    check('the same session again: still mine', (await call({ op: 'claim', item: 'status-lo-letiyuk', session: 'session_012U83ozxzQjH8BcQ2AvykSf' })).json.mine === true);
    const cl = await call({ op: 'claims' });
    check('claims: the fresh list', cl.json.ok && Object.keys(cl.json.claims).join() === 'status-lo-letiyuk', cl.json);
    check('release by another session: refused (not mine)', (await call({ op: 'claim', item: 'status-lo-letiyuk', session: B, release: true })).json.mine === false && !!JSON.parse(state[CLAIM_KEY])['status-lo-letiyuk']);
    c = await call({ op: 'claim', item: 'status-lo-letiyuk', session: A, release: true });
    check('release by the holder: gone, then the other one can take it', c.json.released && !JSON.parse(state[CLAIM_KEY])['status-lo-letiyuk'] && (await call({ op: 'claim', item: 'status-lo-letiyuk', session: B })).json.mine === true);
    const old = new Date(Date.now() - (CLAIM_HOURS + 1) * 3600e3).toISOString();
    const r = claimApply({ x1: { session: 'session_zzzzzzzzzz', at: old } }, { item: 'x1', session: A }, new Date().toISOString());
    check('a claim older than ' + CLAIM_HOURS + ' hours: expired, taken over', r.ans.mine === true && !!r.map.x1 && r.map.x1.session.startsWith('session_012U'), r);
    check('one key per BACKLOG number: prefix and part suffix dropped', ['backlog-13.21b', 'BACKLOG-13.21', '13.21b', '13.21-modals', '13.21'].every((x) => claimItem(x) === '13.21') && claimItem('c10') === 'c10' && claimItem('status-lo-letiyuk') === 'status-lo-letiyuk' && claimItem('9.31') === '9.31');
    check('bad item or session: 400, nothing written', (await call({ op: 'claim', item: 'a b; drop', session: A })).status === 400 && (await call({ op: 'claim', item: 'ok-item', session: 'x' })).status === 400 && claimSession('cse_abcdefgh') === 'session_abcdefgh');
  }

  console.log('\n4d. expiry_set: one row, after a document was read, with the reason in the note');
  {
    const U = FILE_URL_PREFIX + 'Documents/x.pdf';
    rows = { docs: [{ id: 'd1', e: '2026-05-01', nt: 'old note', file_url: null, s: '\u05e4\u05d2 \u05ea\u05d5\u05e7\u05e3' }, { id: 'd2', e: null, nt: null, file_url: null, s: null }],
      equip_inspections: [{ id: 'q1', e: '2026-12-01', notes: null, file_url: null, d: '2025-12-01' }] };
    const base = { op: 'expiry_set', table: 'docs', id: 'd1', agent: 'routine-mail-filing', why: '\u05d3\u05d5\u05d7 \u05d1\u05d3\u05d9\u05e7\u05d4 \u05e9\u05e0\u05ea\u05d9' };
    let x = await call({ ...base, e: '2027-05-01' });
    check('later e without doc: refused, row untouched', x.status === 400 && /doc required/.test(x.json.error) && rows.docs[0].e === '2026-05-01', x.json);
    calls = [];
    x = await call({ ...base, e: '2027-05-01', doc: 'report.pdf', file_url: U, s: '\u05d1\u05ea\u05d5\u05e7\u05e3' });
    check('later e with doc: written, one PATCH by id', x.json.ok && x.json.changed && rows.docs[0].e === '2027-05-01' && rows.docs[0].file_url === U && calls.filter((c) => c.method === 'PATCH').length === 1 && calls.some((c) => c.method === 'PATCH' && /docs\?id=eq\.d1$/.test(c.url)), x.json);
    check('the note keeps the old one and adds old -> new, why and the document', /^old note \| \d\d\/\d\d\/\d{4} Claude \(routine-mail-filing\): /.test(rows.docs[0].nt) && rows.docs[0].nt.indexOf('01/05/2026 -> 01/05/2027') > 0 && rows.docs[0].nt.indexOf('report.pdf') > 0, rows.docs[0].nt);
    x = await call({ ...base, e: '2027-01-01' });
    check('earlier e: allowed without doc (careful)', x.json.ok && rows.docs[0].e === '2027-01-01', x.json);
    calls = [];
    x = await call({ ...base, e: '2027-01-01' });
    check('same value: ok, nothing written', x.json.ok && x.json.changed === false && !calls.some((c) => c.method === 'PATCH'), x.json);
    check('no e yet: a first e needs doc', (await call({ ...base, id: 'd2', e: '2027-01-01' })).status === 400);
    check('why missing: refused', (await call({ ...base, why: '', e: '2026-01-01' })).status === 400);
    check('file_url with spaces (plain OneDrive path): written', (await call({ ...base, file_url: 'https://tapugancoil-my.sharepoint.com/personal/sviva_tapugan_co_il/Documents/a b/c d.pdf' })).json.ok === true);
    check('file_url with a newline: refused', (await call({ ...base, file_url: 'https://tapugancoil-my.sharepoint.com/personal/sviva_tapugan_co_il/a\nb.pdf' })).status === 400);
    check('file_url outside the OneDrive: refused', (await call({ ...base, file_url: 'https://evil.example/x.pdf' })).status === 400);
    check('s not in the list: refused', (await call({ ...base, s: 'x' })).status === 400);
    check('a field outside the list (n): refused', (await call({ ...base, n: 'renamed', e: '2026-01-01' })).status === 400 && rows.docs[0].e === '2027-01-01');
    check('bad date / 30 years ahead: refused', (await call({ ...base, e: '2027-02-30', doc: 'r' })).status === 400 && (await call({ ...base, e: '2056-01-01', doc: 'r' })).status === 400);
    check('another table (tasks): refused', (await call({ ...base, table: 'tasks', e: '2026-01-01' })).status === 400);
    check('id with a filter in it: refused', (await call({ ...base, id: 'd1&e=gte.2000-01-01', e: '2026-01-01' })).status === 400);
    x = await call({ ...base, id: 'nope', e: '2026-01-01' });
    check('unknown id: ok false, row not found', !x.json.ok && /not found/.test(x.json.error), x.json);
    x = await call({ op: 'expiry_set', table: 'equip_inspections', id: 'q1', agent: 'routine-validity', why: 'tasqir 2026', doc: 't.pdf', e: '2027-06-01', d: '2026-06-01' });
    check('equip_inspections: e and d, note in notes', x.json.ok && rows.equip_inspections[0].e === '2027-06-01' && rows.equip_inspections[0].d === '2026-06-01' && /routine-validity/.test(rows.equip_inspections[0].notes), x.json);
    check('equipment d in the future: refused', (await call({ op: 'expiry_set', table: 'equip_inspections', id: 'q1', agent: 'a-b', why: 'xxxxx', d: '2099-01-01' })).status === 400);
    check('expiryPatch: docs cannot set d, equipment cannot set s', !!expiryPatch({ ...base, d: '2026-01-01' }, rows.docs[0], '2026-10-11').error && !!expiryPatch({ ...base, table: 'equip_inspections', s: 'x' }, rows.equip_inspections[0], '2026-10-11').error);
    // 18/10/2026 (Michael: "בצע: לעשות את הצעות 1 עד 5"): equipment may go out of tracking, nothing else about s
    const OUT = '\u05dc\u05d0 \u05e8\u05dc\u05d5\u05d5\u05e0\u05d8\u05d9';
    const eq = { op: 'expiry_set', table: 'equip_inspections', id: 'q1', agent: 'routine-validity', why: 'out of tracking by decision' };
    check('equipment s: another value refused', (await call({ ...eq, doc: 'q.txt', e: null, s: '\u05ea\u05e7\u05d9\u05df' })).status === 400);
    check('equipment s without e null: refused', (await call({ ...eq, doc: 'q.txt', s: OUT })).status === 400);
    check('equipment s without a document: refused', (await call({ ...eq, e: null, s: OUT })).status === 400);
    check('equipment e null without s: refused', (await call({ ...eq, doc: 'q.txt', e: null })).status === 400);
    check('docs: e null with s refused', (await call({ ...base, e: null, s: OUT, doc: 'q.txt' })).status === 400);
    x = await call({ ...eq, doc: 'questionnaire 18/10/2026', e: null, s: OUT });
    check('equipment out of tracking: e null, s set, note says so, one row', x.json.ok && x.json.changed && rows.equip_inspections[0].e === null && rows.equip_inspections[0].s === OUT && /Claude \(routine-validity\)/.test(rows.equip_inspections[0].notes) && rows.equip_inspections[0].notes.indexOf('questionnaire 18/10/2026') > 0, x.json);
    // 21/10/2026 (dev request from the assistant): a new e moves s between valid and expired; s given or "needs checking" wins
    const VAL = '\u05d1\u05ea\u05d5\u05e7\u05e3', EXP = '\u05e4\u05d2 \u05ea\u05d5\u05e7\u05e3', CHK = '\u05d8\u05e2\u05d5\u05df \u05d0\u05d9\u05de\u05d5\u05ea';
    const sp = (row, extra) => expiryPatch({ ...base, doc: 'form 16.pdf', ...extra }, row, '2026-10-21').patch || {};
    check('docs: a later e on an expired row makes it valid', sp({ e: '2026-09-01', s: EXP, nt: '' }, { e: '2026-11-01' }).s === VAL);
    check('docs: an earlier e on a valid row makes it expired', sp({ e: '2026-12-01', s: VAL, nt: '' }, { e: '2026-10-01' }).s === EXP);
    check('docs: s given in the call wins', sp({ e: '2026-09-01', s: EXP, nt: '' }, { e: '2026-11-01', s: CHK }).s === CHK);
    check('docs: "needs checking" is not overwritten', sp({ e: '2026-09-01', s: CHK, nt: '' }, { e: '2026-11-01' }).s === undefined);
    check('docs: the note says the state moved', /\u05d1\u05ea\u05d5\u05e7\u05e3/.test(sp({ e: '2026-09-01', s: EXP, nt: '' }, { e: '2026-11-01' }).nt));
    check('only docs and equip_inspections', Object.keys(EXPIRY_TABLES).join() === 'docs,equip_inspections');
    check('without the key: 403, nothing written', (await call({ ...base, e: '2026-01-01' }, 'nope')).status === 403 && rows.docs[0].e === '2027-01-01');
    rows = {};
  }

  console.log('\n4e. od_move: from the mail inbox folder to an existing folder, never replacing');
  {
    const IN = OD_ROOT + OD_INBOX + '/';
    const DIR = '01_fire/2026/pumps';
    // a tiny drive: paths -> items
    let drive = {};
    const reset = () => { drive = { [IN + 'a.pdf']: { id: 'f1', size: 10, file: {} }, [OD_ROOT + DIR]: { id: 'd1', folder: {} }, [OD_ROOT + DIR + '/old.pdf']: { id: 'f0', size: 9, file: {} } }; };
    graph = async (url, opt = {}) => {
      const m = /\/root:\/([^?]*)/.exec(url);
      if (m) { const path = m[1].split('/').map(decodeURIComponent).join('/'); const it = drive[path]; return it ? new Response(JSON.stringify(it), { status: 200 }) : new Response('{}', { status: 404 }); }
      const i = /\/items\/([^?]+)\?@microsoft\.graph\.conflictBehavior=fail$/.exec(url);
      if (i && opt.method === 'PATCH') {
        const b = JSON.parse(opt.body), key = Object.keys(drive).find((k) => drive[k].id === decodeURIComponent(i[1]));
        const dir = Object.keys(drive).find((k) => drive[k].id === b.parentReference.id);
        const it = drive[key]; delete drive[key]; drive[dir + '/' + b.name] = it;
        return new Response(JSON.stringify({ ...it, webUrl: 'https://x/' + b.name }), { status: 200 });
      }
      return new Response('{}', { status: 400 });
    };
    const base = { op: 'od_move', agent: 'routine-mail-filing', from: 'a.pdf', to_dir: DIR, name: 'report 09.02.2026.pdf', why: 'monthly pump report' };
    reset(); calls = [];
    let x = await call(base);
    check('moved: the file is in the folder under the new name, gone from the inbox', x.json.ok && drive[OD_ROOT + DIR + '/report 09.02.2026.pdf'] && !drive[IN + 'a.pdf'], x.json);
    check('one PATCH with conflictBehavior=fail, no PUT, no DELETE', calls.filter((c) => c.method === 'PATCH').length === 1 && calls.some((c) => /conflictBehavior=fail$/.test(c.url)) && !calls.some((c) => c.method === 'PUT' || c.method === 'DELETE'));
    reset(); calls = [];
    x = await call({ ...base, name: 'old.pdf' });
    check('name taken: refused before any move', !x.json.ok && x.json.error === 'name taken' && !calls.some((c) => c.method === 'PATCH') && drive[IN + 'a.pdf'], x.json);
    reset();
    x = await call({ ...base, to_dir: '01_fire/2027/pumps' });
    check('folder that does not exist: refused, nothing created', !x.json.ok && /folder 404/.test(x.json.error) && Object.keys(drive).length === 3, x.json);
    x = await call({ ...base, from: 'nope.pdf' });
    check('source missing: refused', !x.json.ok && /source 404/.test(x.json.error), x.json);
    check('from outside the inbox (a path): refused', (await call({ ...base, from: '../x.pdf' })).status === 400 && (await call({ ...base, from: 'sub/a.pdf' })).status === 400);
    check('to_dir with .. or into the inbox: refused', (await call({ ...base, to_dir: '../../x' })).status === 400 && (await call({ ...base, to_dir: OD_INBOX })).status === 400);
    check('a csv (the data file of a lab certificate, 18/10/2026) goes to a document folder; an exe still does not', !odMoveCheck({ ...base, from: '2026-09-06 0918 - CSVSO1_1.csv', to_dir: 'a/b', name: '2026-08 CSVSO1_1.csv' }).error && !!odMoveCheck({ ...base, from: 'x.exe', to_dir: 'a/b', name: 'x.exe' }).error);
    check('the not-filed folder inside the inbox: allowed; any other folder inside it, or deeper: refused', !odMoveCheck({ ...base, to_dir: OD_INBOX + '/' + OD_SKIP, name: 'a.pdf' }).error && !!odMoveCheck({ ...base, to_dir: OD_INBOX + '/x' }).error && !!odMoveCheck({ ...base, to_dir: OD_INBOX + '/' + OD_SKIP + '/x' }).error);
    check('to the old-versions or to-delete folders, or ARCHIVE: refused', ['a/_גרסאות קודמות', 'a/למחיקה/b', 'ARCHIVE/2020'].every((d) => !!odMoveCheck({ ...base, to_dir: d }).error));
    check('into not filed: any file type, same name only', !odMoveCheck({ ...base, from: 'ad.mp4', to_dir: OD_INBOX + '/' + OD_SKIP, name: 'ad.mp4' }).error && !!odMoveCheck({ ...base, from: 'ad.mp4', to_dir: OD_INBOX + '/' + OD_SKIP, name: 'other.mp4' }).error && !!odMoveCheck({ ...base, from: 'ad.mp4', name: 'ad.mp4' }).error);
    check('into not filed: a file with no extension too (RAW, 12/10/2026); into a document folder: refused', !odMoveCheck({ ...base, from: '2026-10-12 1046 - RAW', to_dir: OD_INBOX + '/' + OD_SKIP, name: '2026-10-12 1046 - RAW' }).error && !!odMoveCheck({ ...base, from: '2026-10-12 1046 - RAW' }).error && !!odMoveCheck({ ...base, from: '../x', to_dir: OD_INBOX + '/' + OD_SKIP, name: '../x' }).error);
    check('into not filed: the reason in parentheses before the extension (13/10/2026)', !odMoveCheck({ ...base, from: '2026-10-13 0751 - Doc.pdf', to_dir: OD_INBOX + '/' + OD_SKIP, name: '2026-10-13 0751 - Doc (\u05d7\u05e9\u05d1\u05d5\u05e0\u05d9\u05ea).pdf' }).error && skipNameOk('RAW', 'RAW (\u05e7\u05d5\u05d1\u05e5 \u05e8\u05d9\u05e7)') && skipNameOk('a.b.pdf', 'a.b (x y).pdf'));
    check('into not filed: another name, a changed extension, an empty, nested or too long reason: refused', [['a.pdf', 'b (x y).pdf'], ['a.pdf', 'a (x y).exe'], ['a.pdf', 'a ().pdf'], ['a.pdf', 'a (x (y)).pdf'], ['a.pdf', 'a (' + 'x'.repeat(61) + ').pdf'], ['a.pdf', 'a (x y)/.pdf']].every(([f, n]) => !skipNameOk(f, n) || !!odMoveCheck({ ...base, from: f, to_dir: OD_INBOX + '/' + OD_SKIP, name: n }).error));
    const RN = { ...base, from: OD_SKIP + '/RAW', to_dir: OD_INBOX + '/' + OD_SKIP };
    check('a file already in not filed: only the reason added, in place, not recorded (13/10/2026)', !odMoveCheck({ ...RN, name: 'RAW (x y)' }).error && odMoveCheck({ ...RN, name: 'RAW (x y)' }).skip === false && odMoveCheck({ ...RN, name: 'RAW (x y)' }).from === OD_ROOT + OD_INBOX + '/' + OD_SKIP + '/RAW');
    check('a reason already in the name: replaced, not stacked, base kept', !odMoveCheck({ ...RN, from: OD_SKIP + '/S (a b).pdf', name: 'S (c d).pdf' }).error && !!odMoveCheck({ ...RN, from: OD_SKIP + '/S (a b).pdf', name: 'S (a b) (c d).pdf' }).error && !!odMoveCheck({ ...RN, from: OD_SKIP + '/S (a b).pdf', name: 'T (c d).pdf' }).error);
    check('a file already in not filed: the same name, another name, another folder or a deeper path: refused', !!odMoveCheck({ ...RN, name: 'RAW' }).error && !!odMoveCheck({ ...RN, name: 'other (x y)' }).error && !!odMoveCheck({ ...RN, to_dir: DIR, name: 'RAW (x y)' }).error && !!odMoveCheck({ ...RN, from: OD_SKIP + '/a/RAW', name: 'RAW (x y)' }).error && !!odMoveCheck({ ...RN, from: 'x/RAW', name: 'RAW (x y)' }).error);
    check('a name with a slash or a script type: refused', !!odMoveCheck({ ...base, name: 'a/b.pdf' }).error && !!odMoveCheck({ ...base, name: 'x.exe' }).error && !!odMoveCheck({ ...base, from: 'x.js' }).error);
    check('why missing: refused', !!odMoveCheck({ ...base, why: '' }).error);
    check('the paths stay inside the safety folder', odMoveCheck(base).toDir === OD_ROOT + DIR && odMoveCheck(base).from === OD_ROOT + OD_INBOX + '/a.pdf');
    // 12/10/2026: a move into "not filed" is recorded with its time; backup-od counts 30 days from it
    drive[IN + 'v.mp4'] = { id: 'f9', size: 5, file: {} }; drive[OD_ROOT + OD_INBOX + '/' + OD_SKIP] = { id: 'dskip', folder: {} };
    delete state.skip_moved;
    x = await call({ ...base, from: 'v.mp4', to_dir: OD_INBOX + '/' + OD_SKIP, name: 'v.mp4' });
    let sm = {}; try { sm = JSON.parse(state.skip_moved || '{}'); } catch (e) {}
    check('into not filed: the move is recorded in server_state.skip_moved by item id', x.json.ok && x.json.recorded === true && !isNaN(Date.parse(sm.f9)) && Date.now() - Date.parse(sm.f9) < 60e3, [x.json, state.skip_moved]);
    const before = state.skip_moved; reset(); x = await call(base);
    check('to any other folder: nothing recorded', x.json.ok && x.json.recorded === null && state.skip_moved === before, x.json);
    const now = Date.parse('2026-10-12T10:00:00Z'), D = 864e5;
    const old = JSON.stringify({ a: new Date(now - (SKIP_MOVED_DAYS + 1) * D).toISOString(), b: new Date(now - D).toISOString() });
    const kept = JSON.parse(skipMovedAdd(old, 'c', new Date(now).toISOString(), now));
    check('the record drops entries older than ' + SKIP_MOVED_DAYS + ' days, keeps the rest', !kept.a && kept.b && kept.c, kept);
    const big = {}; for (let i = 0; i < SKIP_MOVED_MAX + 10; i++) big['i' + i] = new Date(now - (i % 50) * D).toISOString();
    check('at most ' + SKIP_MOVED_MAX + ' entries, broken JSON starts over', Object.keys(JSON.parse(skipMovedAdd(JSON.stringify(big), 'n', new Date(now).toISOString(), now))).length === SKIP_MOVED_MAX && Object.keys(JSON.parse(skipMovedAdd('{x', 'n', new Date(now).toISOString(), now))).length === 1);
    check('without the key: 403, nothing moved', (await call(base, 'nope')).status === 403);
    graph = async () => new Response('{}', { status: 500 });
  }

  console.log('\n4e2. od_mkdir: one new empty folder inside an existing one, never replacing (18/10/2026)');
  {
    const PAR = '07_env/water';
    let drive = {};
    const reset = () => { drive = { [OD_ROOT + PAR]: { id: 'p1', folder: {} }, [OD_ROOT + PAR + '/old']: { id: 'o1', folder: {} }, [OD_ROOT + PAR + '/a.pdf']: { id: 'f1', file: {} } }; };
    graph = async (url, opt = {}) => {
      const m = /\/root:\/([^?]*)/.exec(url);
      if (m) { const path = m[1].split('/').map(decodeURIComponent).join('/'); const it = drive[path]; return it ? new Response(JSON.stringify(it), { status: 200 }) : new Response('{}', { status: 404 }); }
      const c = /\/items\/([^/]+)\/children$/.exec(url);
      if (c && opt.method === 'POST') {
        const b = JSON.parse(opt.body), dir = Object.keys(drive).find((k) => drive[k].id === decodeURIComponent(c[1]));
        if (!dir || drive[dir + '/' + b.name]) return new Response('{}', { status: 409 });
        drive[dir + '/' + b.name] = { id: 'n' + Object.keys(drive).length, folder: {} };
        return new Response(JSON.stringify({ webUrl: 'https://x/' + b.name }), { status: 201 });
      }
      return new Response('{}', { status: 400 });
    };
    const base = { op: 'od_mkdir', agent: 'ops-manager', parent: PAR, name: 'analyses', why: 'COA folders for the monthly report' };
    reset(); calls = [];
    let x = await call(base);
    check('created: an empty folder under the parent, one POST with conflictBehavior=fail, nothing else written', x.json.ok && x.json.created === true && !!drive[OD_ROOT + PAR + '/analyses'] && calls.filter((c) => c.method === 'POST' && /\/children$/.test(c.url)).length === 1 && /conflictBehavior/.test(calls.find((c) => /\/children$/.test(c.url)).body) && !calls.some((c) => ['PUT', 'PATCH', 'DELETE'].includes(c.method) && c.url.startsWith('https://graph')), x.json);
    reset(); calls = [];
    x = await call({ ...base, name: 'old' });
    check('a folder with that name already there: nothing created, nothing changed, ok with created=false', x.json.ok && x.json.created === false && x.json.exists === true && !calls.some((c) => c.method === 'POST' && /\/children$/.test(c.url)), x.json);
    x = await call({ ...base, name: 'a.pdf' });
    check('a FILE with that name: nothing created, exists=false so the caller sees it is not a folder', x.json.ok && x.json.created === false && x.json.exists === false, x.json);
    reset();
    x = await call({ ...base, parent: '07_env/missing' });
    check('parent that does not exist: refused, nothing created', !x.json.ok && /parent 404/.test(x.json.error) && Object.keys(drive).length === 3, x.json);
    x = await call({ ...base, parent: PAR + '/a.pdf' });
    check('parent that is a file: refused', !x.json.ok && x.json.error === 'parent is not a folder', x.json);
    check('parent with .., empty, too deep, in the old-versions / to-delete / ARCHIVE folders, the mail inbox or the request folder: refused',
      ['../x', '', 'a/b/c/d/e/f', '_גרסאות קודמות', 'x/למחיקה/y', 'ARCHIVE/z', OD_INBOX, OD_INBOX + '/' + OD_SKIP, OD_REQ].every((pp) => !!odMkdirCheck({ ...base, parent: pp }).error) && OD_MKDIR_DEPTH === 5);
    check('name with a slash, .., a dot start, a forbidden character, a protected folder name, spaces at the edge or too long: refused',
      ['a/b', '..', '.hidden', 'a:b', 'a*', 'למחיקה', 'ARCHIVE', '_גרסאות קודמות', OD_INBOX, OD_REQ, ' x', 'x ', 'x'.repeat(121), ''].every((n) => !!odMkdirCheck({ ...base, name: n }).error));
    check('a normal Hebrew name with spaces: allowed, the paths stay inside the safety folder', odMkdirCheck({ ...base, name: '\u05d0\u05e0\u05dc\u05d9\u05d6\u05d5\u05ea \u05dc\u05d3\u05d9\u05d5\u05d5\u05d7' }).parent === OD_ROOT + PAR && !odMkdirCheck({ ...base, name: '\u05d0\u05e0\u05dc\u05d9\u05d6\u05d5\u05ea \u05dc\u05d3\u05d9\u05d5\u05d5\u05d7' }).error);
    check('why missing, a bad agent name, or an extra field: refused, nothing created', (await call({ ...base, why: '' })).status === 400 && (await call({ ...base, agent: 'Bad' })).status === 400 && (await call({ ...base, extra: 1 })).status === 400 && !Object.keys(drive).some((k) => k.endsWith('/analyses')));
    check('without the key: 403, nothing created', (await call(base, 'nope')).status === 403 && !Object.keys(drive).some((k) => k.endsWith('/analyses')));
    graph = async () => new Response('{}', { status: 500 });
    // od_dedupe through the handler (25/10/2026): Graph answers for two files, one made by this server's app
    {
      const E = { ...ENV, ONEDRIVE_CLIENT_ID: 'APP' };
      let items, deleted;
      const mk = () => { deleted = []; items = { 'a (1).pdf': { id: 'i1', size: 10, file: { hashes: { quickXorHash: 'h' } }, createdBy: { application: { id: 'APP' } } },
        'a.pdf': { id: 'i2', size: 10, file: { hashes: { quickXorHash: 'h' } }, createdBy: { user: { displayName: 'M' } } } }; };
      graph = async (url, opt) => {
        if ((opt.method || 'GET') === 'DELETE') { deleted.push(decodeURIComponent(url.split('/items/')[1])); return new Response(null, { status: 204 }); }
        const name = decodeURIComponent(url.split('?')[0].split('/').pop());
        return items[name] ? new Response(JSON.stringify(items[name]), { status: 200 }) : new Response('{}', { status: 404 });
      };
      const D = { op: 'od_dedupe', agent: 'routine-wa-assistant', why: 'the same form saved twice', path: '02_x/a (1).pdf', keep: '02_x/a.pdf' };
      mk(); delete state.od_deleted;
      let x = await call(D, 'k-123', 'POST', E);
      const log = JSON.parse(state.od_deleted || '[]');
      check('od_dedupe: the copy this server made, same hash and size: one DELETE of that item (recycle bin), and a line in od_deleted', x.json.ok && x.json.bin && deleted.join() === 'i1'
        && log.length === 1 && log[0].path === '02_x/a (1).pdf' && log[0].kept === '02_x/a.pdf' && log[0].agent === 'routine-wa-assistant', { j: x.json, deleted, log });
      mk(); items['a (1).pdf'].createdBy = { user: { displayName: 'M' } };
      x = await call(D, 'k-123', 'POST', E);
      check('od_dedupe: a file Michael made: refused, nothing deleted', !x.json.ok && x.json.error === 'not created by the server' && deleted.length === 0, x.json);
      mk(); items['a.pdf'].file.hashes.quickXorHash = 'g';
      x = await call(D, 'k-123', 'POST', E);
      check('od_dedupe: different content: refused, nothing deleted', !x.json.ok && x.json.error === 'content differs' && deleted.length === 0, x.json);
      mk(); delete items['a.pdf'];
      x = await call(D, 'k-123', 'POST', E);
      check('od_dedupe: the kept file is not there: refused, nothing deleted', !x.json.ok && /^keep 404/.test(x.json.error) && deleted.length === 0, x.json);
      mk();
      x = await call(D, 'k-123', 'POST', ENV);
      check('od_dedupe: no app id in the environment: refused, nothing deleted', !x.json.ok && x.json.error === 'not created by the server' && deleted.length === 0, x.json);
      check('od_dedupe: an extra field or no key: refused', (await call({ ...D, force: true }, 'k-123', 'POST', E)).status === 400 && (await call(D, 'nope', 'POST', E)).status === 403 && deleted.length === 0);
      graph = async () => new Response('{}', { status: 500 });
    }
  }

  console.log('\n4f2. mail_draft: one request file for the draft flow (20/10/2026: the 365 connector is read only)');
  {
    let puts = [];
    graph = async (url, opt = {}) => {
      if (opt.method === 'PUT') { puts.push({ url: decodeURIComponent(url), body: opt.body }); return new Response(JSON.stringify({ size: String(opt.body).length }), { status: 201 }); }
      return new Response('{}', { status: 400 });
    };
    const D = { op: 'mail_draft', agent: 'dev', why: 'gas controller cert', to: 'tammybeg@gazit.co.il', subject: 'תעודת כיול', body: 'שלום,\nשורה <b>2</b>' };
    let x = await call(D);
    const fj = puts[0] ? JSON.parse(puts[0].body) : {};
    check('one PUT into the draft folder, JSON with to, subject, body and an RTL html (dir and style, 20/10/2026: a thread reply keeps only the style; Arial, 26/10/2026) with <br> and escaped tags', x.json.ok && puts.length === 1 && puts[0].url.indexOf('/root:/' + OD_ROOT + OD_DRAFT + '/') > 0 && fj.to === D.to && fj.subject === D.subject && fj.body === D.body && /^<div dir="rtl" style="direction:rtl;text-align:right;font-family:Arial,sans-serif;font-size:14px">.*<br>.*&lt;b&gt;2&lt;\/b&gt;<div style=/.test(fj.html), { x: x.json, puts });
    { const made = JSON.parse(state.drafts_made || '[]'); check('the draft is recorded in drafts_made (recipients, subject), so draft_trash can later replace it (26/10/2026)', made[0] && made[0].to === 'tammybeg@gazit.co.il' && made[0].subject === 'תעודת כיול' && made[0].reply === false, made[0]); }
    puts = []; await call(D); await call(D); await call({ ...D, subject: 'אחר' });
    check('the same draft twice (a retry after a timeout) goes to the same file name; another draft to another', puts.length === 3 && puts[0].url === puts[1].url && puts[0].url !== puts[2].url && /\/\d{8}-[0-9a-f]{16}\.txt:\/content$/.test(puts[0].url), puts.map((x) => x.url.slice(-40)));
    puts = [];
    puts = []; await call({ ...D, to: 'a@tapugan.co.il, b@tapugan.co.il' });
    const g5 = puts[0] ? JSON.parse(puts[0].body) : {};
    check('two recipients: joined with ";" for the flow', g5.to === 'a@tapugan.co.il;b@tapugan.co.il', g5.to);
    puts = [];
    check('six recipients or one bad address among two: refused', (await call({ ...D, to: 'a@x.co;b@x.co;c@x.co;d@x.co;e@x.co;f@x.co' })).status === 400 && (await call({ ...D, to: 'a@x.co;nope' })).status === 400 && !puts.length);
    check('devEta: the runner\'s next wake in Israel time (Sun-Thu 07:17-19:17, odd hours; 26/10/2026)', devEta(Date.parse('2026-10-26T12:40:00Z')) === '26/10 15:17' && devEta(Date.parse('2026-10-26T17:20:00Z')) === '27/10 07:17' && devEta(Date.parse('2026-10-29T17:30:00Z')) === '01/11 07:17' && devEta(Date.parse('2026-10-30T09:00:00Z')) === '01/11 07:17');
    { const ours = (n) => Array.from({ length: n }, (_, i) => 'm' + i + '@tapugan.co.il').join(';');
      puts = []; await call({ ...D, to: ours(24), cc: 'stav@tapugan.co.il' });
      const g24 = puts[0] ? JSON.parse(puts[0].body) : {};
      check('24 managers, all @tapugan.co.il: one draft with all of them (26/10/2026, hearing tests notice)', puts.length === 1 && g24.to.split(';').length === 24 && g24.cc === 'stav@tapugan.co.il', g24.to);
      puts = [];
      check('31 of ours, or six with one outside address: refused, nothing written', (await call({ ...D, to: ours(31) })).status === 400 && (await call({ ...D, to: ours(5) + ';out@gmail.com' })).status === 400 && (await call({ ...D, cc: ours(5) + ';out@gmail.com' })).status === 400 && !puts.length); }
    check('the logo under the signature, from the site', /<img src="https:\/\/tapugan-safety\.pages\.dev\/logo\.jpg" width="120" height="80"/.test(fj.html), fj.html.slice(-300));
    check('his Outlook signature (SITE.signature) is added once at the end', fj.html.endsWith(SITE.signature + '</div>') && fj.html.split('0547940073').length === 2, fj.html.slice(-200));
    puts = [];
    await call({ ...D, body: 'שלום,\nאבקש תעודה.\n\nתודה,\n' + SITE.owner + '\nממונה בטיחות, תעשיות תפוגן' });
    const g = puts[0] ? JSON.parse(puts[0].body) : {};
    check('a typed sign-off (his name, the role line and the closing "thanks") is dropped, the signature replaces it', g.body === 'שלום,\nאבקש תעודה.' && g.html.split(SITE.owner).length === 2, g);
    puts = [];
    await call({ ...D, body: 'שלום,\nנא לתאם.\nבברכה,\n' + SITE.owner });
    const g2 = puts[0] ? JSON.parse(puts[0].body) : {};
    check('a "regards" line before his name goes too (the signature opens with it)', g2.body === 'שלום,\nנא לתאם.', g2.body);
    // 21/10/2026, the form 16 draft to the maintenance coordinator: "...? תודה, מיכאל." on the last line, then the signature.
    puts = [];
    await call({ ...D, body: 'היי,\nאפשר לתאם איתם מועד? תודה, מיכאל.' });
    const sg1 = puts[0] ? JSON.parse(puts[0].body) : {};
    // the opening line follows the clock (greetByHour, "hi" or "good morning"); only the end is checked here
    check('an inline "thanks, <first name>." at the end of the last line is cut', typeof sg1.body === 'string' && sg1.body.split('\n').length === 2 && sg1.body.split('\n')[1] === 'אפשר לתאם איתם מועד?', sg1.body);
    puts = [];
    await call({ ...D, body: 'שלום,\nנא לתאם.\nתודה,\nמיכאל' });
    const sg2 = puts[0] ? JSON.parse(puts[0].body) : {};
    check('the first name alone on its own line goes too', sg2.body === 'שלום,\nנא לתאם.', sg2.body);
    puts = [];
    await call({ ...D, body: 'שלום,\nמיכאל מהבטיחות ביקש תעודה.' });
    const sg3 = puts[0] ? JSON.parse(puts[0].body) : {};
    check('his name inside a sentence stays', sg3.body === 'שלום,\nמיכאל מהבטיחות ביקש תעודה.', sg3.body);
    puts = [];
    await call({ ...D, body: SITE.owner + ' ביקש לבדוק את הבקר.\nשורה 2\nשורה 3\nשורה 4\nשורה 5' });
    const g3 = puts[0] ? JSON.parse(puts[0].body) : {};
    puts = []; await call({ ...D, body: 'שלום,\nתודה על המענה המהיר.\nתודה,\n' });
    const g4 = puts[0] ? JSON.parse(puts[0].body) : {};
    check('a closing "thanks," without his name goes too; "thanks" inside a sentence stays', g4.body === 'שלום,\nתודה על המענה המהיר.', g4.body);
    check('his name early in the text (not in the last 4 lines) stays', g3.body.indexOf(SITE.owner) === 0, g3.body);
    puts = [];
    check('a bad address, an empty subject or body, a bad cc (cc allowed since 20/10/2026), or an extra field (send): refused, nothing written',
      (await call({ ...D, to: 'x@y' })).status === 400 && (await call({ ...D, subject: '' })).status === 400 && (await call({ ...D, body: '' })).status === 400
      && (await call({ ...D, cc: 'not-an-address' })).status === 400 && (await call({ ...D, send: true })).status === 400 && !puts.length);
    check('without the key: 403', (await call(D, 'nope')).status === 403 && !puts.length);
  }

  console.log('\n4e1. devInboxTold (25/10/2026): a wa_me with ref "dev <id>" marks the request told');
  {
    const L = JSON.stringify([{ id: 'dev-20261025104303-0jox', status: 'open' }, { id: 'dev-20261025090000-aaaa', status: 'done' }]);
    const t = devInboxTold(L, 'dev dev-20261025104303-0jox', '2026-10-25T12:00:00Z');
    check('told: the open one gets told_at', t && t[0].told_at === '2026-10-25T12:00:00Z' && !t[1].told_at, t);
    check('told: a done one, an unknown id, another ref or bad state = null', devInboxTold(L, 'dev dev-20261025090000-aaaa', 'x') === null && devInboxTold(L, 'dev dev-20261025000000-zzzz', 'x') === null && devInboxTold(L, 'mail-triage', 'x') === null && devInboxTold('x', 'dev dev-20261025104303-0jox', 'x') === null && !DEV_REF.test('dev x'));
  }

  console.log('\n4e0. approval needs buttons; dev_request times in Israel (25/10/2026)');
  {
    const B = '\u05d1\u05e6\u05e2';
    check('a question offering ' + B + ' with no choices = blocked; with choices, or no question, or another word = passes',
      asksApprovalNoButtons('\u05dc\u05d4\u05d6\u05d9\u05d6?\n1. ' + B + '\n2. \u05dc\u05d0', null) && !asksApprovalNoButtons('\u05dc\u05d4\u05d6\u05d9\u05d6?\n1. ' + B, [B, '\u05dc\u05d0'])
      && !asksApprovalNoButtons('\u05d0\u05d7\u05e8\u05d9 ' + B + ' \u05e9\u05dc\u05da \u05d4\u05d6\u05d6\u05ea\u05d9.', null) && !asksApprovalNoButtons('\u05de\u05d1\u05e6\u05e2\u05d9\u05dd \u05d4\u05e9\u05d1\u05d5\u05e2?', null));
    check('"\u05dc\u05d1\u05e6\u05e2?" with no buttons is blocked too (26/10/2026: a calendar move hung on it)', asksApprovalNoButtons('\u05dc\u05d4\u05d6\u05d9\u05d6 \u05dc\u05e8\u05d1\u05d9\u05e2\u05d9. \u05dc\u05d1\u05e6\u05e2?', null) && asksApprovalNoButtons('\u05e9\u05d0\u05d1\u05e6\u05e2?', undefined) && !asksApprovalNoButtons('\u05de\u05d1\u05e6\u05e2\u05d9\u05dd?', null));
    check('mail_draft of the assistant to someone else needs "checked" with Sent Items; to Michael himself or another agent: no', !!draftSentGate({ agent: 'routine-wa-assistant', to: 'igal@x.co.il' }) && draftSentGate({ agent: 'routine-wa-assistant', to: 'igal@x.co.il', checked: 'Sent Items RE: x, 06:01 UTC' }) === null && draftSentGate({ agent: 'routine-mail-filing', to: 'igal@x.co.il' }) === null);
    check('"\u05dc\u05de\u05d7\u05d5\u05e7 \u05d0\u05d5\u05ea\u05d4" to Michael is refused; "\u05d0\u05e1\u05d5\u05e8 \u05dc\u05de\u05d7\u05d5\u05e7." and "\u05e0\u05de\u05d7\u05e7" are not', asksOwnerToDelete('\u05dc\u05de\u05d7\u05d5\u05e7 \u05d0\u05d5\u05ea\u05d4 \u05d5\u05dc\u05d0 \u05dc\u05e9\u05dc\u05d5\u05d7') && asksOwnerToDelete('\u05ea\u05de\u05d7\u05e7 \u05d0\u05ea \u05d4\u05d8\u05d9\u05d5\u05d8\u05d4') && !asksOwnerToDelete('\u05d0\u05e1\u05d5\u05e8 \u05dc\u05de\u05d7\u05d5\u05e7.') && !asksOwnerToDelete('\u05d4\u05e7\u05d5\u05d1\u05e5 \u05e0\u05de\u05d7\u05e7'));
    const st0 = staleReply('2026-10-25T15:28:05Z', [{ ts: '2026-10-25T15:28:35Z', payload: { text: '1. \u05e8\u05d1\u05d9\u05e2\u05d9 28/10 08:00' } }]);
    check('stale: a newer tap of his = the reply says which message (Israel time) and loses its buttons', st0 && /^\u05dc\u05d2\u05d1\u05d9 \u05d4\u05d4\u05d5\u05d3\u05e2\u05d4 \u05e9\u05dc\u05da \u05de-17:28:\n$/.test(st0.prefix) && st0.dropChoices === true, st0);
    const st1 = staleReply('2026-10-25T15:27:18Z', [{ ts: '2026-10-25T15:28:05Z', payload: { text: '\u05dc\u05d0 \u05d4\u05d1\u05e0\u05ea \u05d0\u05d5\u05ea\u05d9' } }]);
    check('stale: a newer typed line = labelled, buttons kept; nothing newer or no answers = untouched', st1 && st1.dropChoices === false && staleReply('2026-10-25T15:27:18Z', []) === null && staleReply('', [{ ts: 'x', payload: {} }]) === null && STALE_GAP_MS === 5000);
    // 26/10/2026: two runs answered the same thing (a photo, then "check the picture" 17 s later; the assistant and the dev session)
    const ovRows = [{ ts: '2026-10-24T21:44:56Z', text: 'photo answer from the first run', answers: '2026-10-24T21:43:51Z' }];
    const ov = overlapReply('2026-10-24T21:44:08Z', null, ovRows);
    check('overlap: another run replied after the message this run answers = stopped once, with its time (Israel) and text', ov && ov.hm === '00:44' && /photo answer/.test(ov.text), ov);
    check('overlap: the same run (same answers) is not stopped; a reply before the message is not; no answers and no dev ref = not checked',
      overlapReply('2026-10-24T21:43:51Z', null, ovRows) === null && overlapReply('2026-10-24T21:45:00Z', null, ovRows) === null && overlapReply(null, 'hazard', ovRows) === null);
    check('overlap: a dev session message (ref "dev ...", no answers) is stopped by any assistant reply in the window', !!overlapReply(null, 'dev dev-123', ovRows) && OVERLAP_MS === 180000);
    const before = state.dev_inbox;
    const d = new Date(); d.setUTCHours(10, 43, 0, 0);
    const IL1043 = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
    const r = await call({ op: 'dev_request', agent: 'routine-wa-assistant', text: 'Michael at 10:43 UTC asked to move an event, test only' });
    const got = JSON.parse(state.dev_inbox || '[]').find((x) => x && x.id === (r.json && r.json.id));
    check('dev_request: "10:43 UTC" is written as Israel time (12:43 in winter, 13:43 in summer)', got && got.text.indexOf(IL1043) >= 0 && !/UTC/.test(got.text), { r: r.json, got });
    state.dev_inbox = before;
  }

  console.log('\n4e2. cal_move (25/10/2026): one JSON file for the flow that moves an event');
  {
    let puts = [];
    graph = async (url, opt = {}) => {
      if (opt.method === 'PUT') { puts.push({ url: decodeURIComponent(url), body: opt.body }); return new Response(JSON.stringify({ size: 10 }), { status: 201 }); }
      return new Response('{}', { status: 400 });
    };
    const ID = 'AAkALgAAAAAAHYQDEapmEc2byACqAC-EWg0AzWOnlEnvT0Cf1PLfXWwjNwAH4Yc40gAA';
    const D = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const ok = { op: 'cal_move', agent: 'routine-wa-assistant', why: 'course day moved', id: ID, subject: 'x course', start: D + 'T08:00', end: D + 'T15:00', approved: '\u05d1\u05e6\u05e2' };
    delete state[CAL_MOVED_KEY];
    const x = await call(ok);
    const f = puts[0] && JSON.parse(puts[0].body);
    check('written: one PUT into the move folder, id and Israel wall clock with seconds', x.json.ok && puts.length === 1 && puts[0].url.indexOf('/root:/' + OD_ROOT + OD_CAL_MOVE + '/') > 0 && f.id === ID && f.start === D + 'T08:00:00' && f.end === D + 'T15:00:00' && f.tz === 'Israel Standard Time', { x: x.json, puts });
    check('the file is plain JSON text, no BOM (the flow parses it with json(trim(string(...))), which keeps a BOM)', typeof puts[0].body === 'string' && puts[0].body.charCodeAt(0) === 123, puts[0] && puts[0].body);
    check('logged in cal_moved, readable by state_get', String(state[CAL_MOVED_KEY] || '').indexOf(D + 'T08:00') >= 0 && STATE_READ.indexOf(CAL_MOVED_KEY) >= 0, state[CAL_MOVED_KEY]);
    puts = [];
    const bad = async (o) => (await call(Object.assign({}, ok, o))).status === 400;
    check('refused, nothing written: no "\u05d1\u05e6\u05e2", end before start, a past day, a bad time, a bad id, an extra field', await bad({ approved: 'ok' }) && await bad({ end: D + 'T07:00' }) && await bad({ start: '2020-01-01T08:00', end: '2020-01-01T09:00' }) && await bad({ start: D + ' 08:00' }) && await bad({ id: ID + '?x' }) && await bad({ attendees: 'a@b' }) && !puts.length);
    check('pure: "today" is the Israel date: 00:30 Israel on 02/11 refuses 01/11 (a UTC date let it through; 26/10/2026 retro)', calMoveCheck(Object.assign({}, ok, { start: '2099-11-01T08:00', end: '2099-11-01T09:00' }), Date.parse('2099-11-01T22:30:00Z')).error === 'start in the past' && !calMoveCheck(Object.assign({}, ok, { start: '2099-11-02T08:00', end: '2099-11-02T09:00' }), Date.parse('2099-11-01T22:30:00Z')).error);
    const rsrc = (await import('node:fs')).readFileSync(new URL('../../functions/api/routine-db.js', import.meta.url), 'utf8');
    check('wa_me refuses a stale approval question before it changes the text, and od_dedupe reads the copy to keep again right before the delete (source checks: the handlers are not run here; 26/10/2026 retro)', /if \(stale && staleRefuses\(stale, body\.text\)\) return jsonResp\([\s\S]{0,400}if \(stale\) \{ body\.text = stale\.prefix/.test(rsrc) && /const keptNow = await meta\(c\.keep\);[\s\S]{0,200}keptNow\.id !== kept\.id[\s\S]{0,400}method: 'DELETE'/.test(rsrc));
    check('a stale approval question is refused (not sent, buttons would go or an old button would approve); another stale reply just loses its buttons (26/10/2026 retro)', staleRefuses({ dropChoices: true }, '\u05dc\u05d4\u05d6\u05d9\u05d6?\n1. ' + '\u05d1\u05e6\u05e2') === true && staleRefuses({ dropChoices: true }, '\u05e8\u05d1\u05d9\u05e2\u05d9 08:00') === false && staleRefuses(null, '\u05dc\u05d4\u05d6\u05d9\u05d6? \u05d1\u05e6\u05e2') === false);
    check('pure: over 14 days or over a year ahead = refused', !!calMoveCheck(Object.assign({}, ok, { start: '2099-11-23T08:00', end: '2099-12-23T08:00' }), Date.parse('2099-11-01T00:00:00Z')).error && !!calMoveCheck(Object.assign({}, ok, { start: '2099-11-23T08:00', end: '2099-11-23T09:00' }), Date.now()).error && !calMoveCheck(Object.assign({}, ok, { start: '2026-11-23T08:00', end: '2026-11-23T15:00' }), Date.parse('2026-10-25T10:00:00Z')).error);
  }

  console.log('\n4e3. draft_trash (26/10/2026, Michael: "a draft replaced by a new one is deleted from the drafts")');
  {
    let puts = [];
    graph = async (url, opt = {}) => {
      if (opt.method === 'PUT') { puts.push({ url: decodeURIComponent(url), body: opt.body }); return new Response(JSON.stringify({ size: 10 }), { status: 201 }); }
      return new Response('{}', { status: 400 });
    };
    const ID = 'AAMkAGI2TG93AAA-draft-id-AAAAAAEPAAAiIsqMbYjsT5e-T7KzowPTAAAQoAAA';
    const now = new Date().toISOString();
    state[DRAFTS_MADE_KEY] = JSON.stringify([draftMadeLine({ to: 'Tzahi@x.co.il;yana@x.co.il', subject: 'hearing tests quote' }, now), draftMadeLine({ to: 'shlomi@x.co.il', subject: 'lift', reply_to: 'r' }, now)]);
    delete state[DRAFTS_TRASHED_KEY];
    const ok = { op: 'draft_trash', agent: 'routine-wa-assistant', why: 'replaced by the 10:15 draft', id: ID, subject: 'RE: Hearing  tests quote', to: 'yana@x.co.il; tzahi@x.co.il' };
    const x = await call(ok);
    const f = puts[0] && JSON.parse(puts[0].body);
    check('a draft the server made (same recipients in any order and case, RE: and spaces ignored): one PUT into the trash folder with id and subject', x.json.ok && puts.length === 1 && puts[0].url.indexOf('/root:/' + OD_ROOT + OD_DRAFT_TRASH + '/') > 0 && f.id === ID && f.subject === 'RE: Hearing tests quote', { x: x.json, puts });
    check('logged in drafts_trashed, both keys readable by state_get', String(state[DRAFTS_TRASHED_KEY] || '').indexOf('Hearing tests quote') >= 0 && STATE_READ.indexOf(DRAFTS_MADE_KEY) >= 0 && STATE_READ.indexOf(DRAFTS_TRASHED_KEY) >= 0, state[DRAFTS_TRASHED_KEY]);
    puts = [];
    const bad = async (o) => (await call(Object.assign({}, ok, o))).status === 400;
    check('refused, nothing written: other recipients, another subject, no why, a bad id, an extra field (Michael\'s own drafts are never touched)',
      await bad({ to: 'tzahi@x.co.il' }) && await bad({ subject: 'another thing' }) && await bad({ why: '' }) && await bad({ id: 'x' }) && await bad({ body: 'x' }) && puts.length === 0);
    check('a reply draft the server made: matched by its recipients whatever the subject', !draftTrashCheck(Object.assign({}, ok, { to: 'shlomi@x.co.il', subject: 'RE: anything' }), JSON.parse(state[DRAFTS_MADE_KEY]), Date.now()).error);
    check('older than 30 days = refused; draftSubj strips RE:, FW: and the Hebrew prefixes', !!draftTrashCheck(ok, JSON.parse(state[DRAFTS_MADE_KEY]), Date.now() + 31 * 864e5).error
      && draftSubj('\u05d4\u05e9\u05d1: FW: A  b') === 'a b');
    // 26/10/2026: mail_draft with replaces = the server moves the replaced drafts (the assistant's own draft_trash is
    // stopped by its session's permission classifier)
    puts = [];
    const md = { op: 'mail_draft', agent: 'routine-wa-assistant', why: 'with the quote attached', to: 'tzahi@x.co.il;yana@x.co.il', subject: 'hearing tests quote', body: 'x', checked: 'Sent Items hearing 13:00' };
    const y = await call(Object.assign({}, md, { replaces: [{ id: ID, subject: 'RE: hearing tests quote', to: 'yana@x.co.il;tzahi@x.co.il' }] }));
    const tp = puts.filter((x) => x.url.indexOf(OD_DRAFT_TRASH + '/') > 0);
    check('mail_draft replaces: the draft request, then one trash request for the replaced draft, logged', y.json.ok && y.json.replaced && y.json.replaced.length === 1 && tp.length === 1 && JSON.parse(tp[0].body).id === ID && String(state[DRAFTS_TRASHED_KEY] || '').indexOf('replaced by') >= 0, { y: y.json, n: puts.length });
    puts = [];
    const z = await call(Object.assign({}, md, { replaces: [{ id: ID, subject: 'another thing', to: 'tzahi@x.co.il' }] }));
    check('mail_draft replaces a draft the server did not make: refused, nothing written at all', z.status === 400 && /replaces/.test(z.json.error) && puts.length === 0, z.json);
    delete state[DRAFTS_MADE_KEY]; delete state[DRAFTS_TRASHED_KEY];
  }

  console.log('\n4e4. one folder for the flows (26/10/2026, Michael: "every automatic action from now on goes into this folder")');
  {
    const fsm = await import('node:fs'), pth = await import('node:path');
    const root = new URL('../../functions/', import.meta.url).pathname;
    const files = [];
    const walk = (d) => fsm.readdirSync(d, { withFileTypes: true }).forEach((e) => e.isDirectory() ? walk(pth.join(d, e.name)) : /\.js$/.test(e.name) && files.push(pth.join(d, e.name)));
    walk(root);
    // a folder straight under the safety folder whose name starts with "_" = a constant here, and only these four
    const ALLOWED = ['OD_INBOX', 'OD_AUTO', 'OD_ARCHIVE_DIR', 'OD_OCR_DIR'];
    const tops = [], direct = [];
    for (const f of files) {
      const src = fsm.readFileSync(f, 'utf8');
      for (const m of src.matchAll(/export const (OD_[A-Z_]+) = '_/g)) if (ALLOWED.indexOf(m[1]) < 0) tops.push(pth.basename(f) + ' ' + m[1]);
      for (const m of src.matchAll(/(OD_ROOT \+ '_|\\u05d1\\u05d8\\u05d9\\u05d7\\u05d5\\u05ea\/_(?!\\u05d0\\u05d5\\u05d8\\u05d5|\\u05e0\\u05db\\u05e0\\u05e1|\\u05d8\\u05e7\\u05e1\\u05d8|\\u05d2\\u05e8\\u05e1))/g)) direct.push(pth.basename(f));
    }
    check('no new "_" folder straight under the safety folder: a folder a flow reads is OD_AUTO + "/" + its name (add it to OD_AUTO_DIRS)', tops.length === 0 && direct.length === 0, { tops, direct });
    check('the five flow folders are inside OD_AUTO', [OD_REQ, OD_DRAFT, OD_CAL_MOVE, OD_DRAFT_TRASH].every((x) => x.indexOf(OD_AUTO + '/') === 0) && OD_AUTO_DIRS.length === 5);
  }

  console.log('\n4e4b. a promise check-in waits while Michael is in a conversation (26/10/2026)');
  {
    const src = (await import('node:fs')).readFileSync(new URL('../../functions/api/routine-db.js', import.meta.url), 'utf8');
    const { HOLD_REF, HOLD_MS } = await import('./_build/routine-db.mjs');
    check('promise: and watch refs are held 5 minutes after an owner message, without answers only; overlap_ok lets an urgent one through', HOLD_REF.test('promise:p-1') && HOLD_REF.test('watch') && !HOLD_REF.test('dev 1') && !HOLD_REF.test('none') && HOLD_MS === 300000
      && /if \(!body\.answers && HOLD_REF\.test/.test(src) && src.indexOf("if (body.overlap_ok !== true) {") < src.indexOf('HOLD_REF.test(String(body.ref'));
    // the mock answers every notifications_log read with one row: an owner message "in the last 5 minutes"
    const held = await call({ op: 'wa_me', ref: 'promise:p-1', text: 'בדיקות שמיעה: תזכורת על השריון' });
    const urgent = await call({ op: 'wa_me', ref: 'promise:p-1', text: 'בדיקות שמיעה: תזכורת על השריון', overlap_ok: true });
    check('wa_me: a promise check-in is held while he talks; overlap_ok passes it on (here to "whatsapp not configured")', held.status === 400 && /held/.test(held.json.error) && urgent.json.error === 'whatsapp not configured', { held: held.json, urgent: urgent.json });
  }

  console.log('\n4e5. tour_close_ask (26/10/2026, Michael: "do it: only after my do-it")');
  {
    rows.tour_hazards = [{ id: 'th-12', n: 12, descr: 'נקודות צביטה חשופות', loc: 'מסוע אריזה', s: 'פתוח' }, { id: 'th-3', n: 3, descr: 'x', s: 'סגור' }];
    delete state[TOUR_CLOSE_KEY];
    const a = await call({ op: 'tour_close_ask', agent: 'routine-wa-assistant', id: 'th-12', note: 'נבדק במקום, המגנים הותקנו' });
    const st = state[TOUR_CLOSE_KEY] && JSON.parse(state[TOUR_CLOSE_KEY]);
    check('an open finding: the request kept (id, note), then the question goes out as wa_me (here: WhatsApp not configured)', st && st.id === 'th-12' && /המגנים/.test(st.note) && a.json.error === 'whatsapp not configured' && rows.tour_hazards[0].s === 'פתוח', { a: a.json, st });
    const b = await call({ op: 'tour_close_ask', agent: 'routine-wa-assistant', id: 'th-3', note: 'נבדק במקום, תקין' });
    check('a closed finding, a bad id, a short note, an extra field: refused; nothing closed by the ask itself', !b.json.ok && /already closed/.test(b.json.error)
      && (await call({ op: 'tour_close_ask', agent: 'a-b', id: '12', note: 'נבדק במקום' })).status === 400 && (await call({ op: 'tour_close_ask', agent: 'a-b', id: 'th-12', note: 'x' })).status === 400
      && (await call({ op: 'tour_close_ask', agent: 'a-b', id: 'th-12', note: 'נבדק במקום', s: 'סגור' })).status === 400);
    check('tourRefOf: the reply line or the last message, only tourclose:th-N', tourRefOf('x | ref tourclose:th-12 | y', null) === 'th-12' && tourRefOf('', { ref: 'tourclose:th-7' }) === 'th-7' && tourRefOf('', { ref: 'sign:s123456' }) === null && tourRefOf('x | ref dev 1 |', { ref: 'tourclose:th-7' }) === null);
    delete rows.tour_hazards; delete state[TOUR_CLOSE_KEY];
  }

  console.log('\n4f. mail_request: one text file with the message id, for the second flow');
  {
    let puts = [];
    graph = async (url, opt = {}) => {
      if (opt.method === 'PUT') { puts.push({ url: decodeURIComponent(url), body: opt.body }); return new Response(JSON.stringify({ size: String(opt.body).length, webUrl: 'https://x' }), { status: 201 }); }
      return new Response('{}', { status: 400 });
    };
    const ID = 'AAMkADNmMjhjNWNiLTk4ZTItNDA4Ny1hYTM4LWM3MWJjMTc2MzUyMwBGAAAAAACvmdaXkAHZSoM_lWbFdKqPBwDNY6eUSe9PQJ-U8t9dbCM3AAAAAAEMAAA=';
    calls = [];
    let x = await call({ op: 'mail_request', agent: 'routine-mail-filing', message_id: ID, why: 'pump report 2/26' });
    check('written: one PUT into the request folder, the id as the content, a .txt name', x.json.ok && puts.length === 1 && puts[0].url.indexOf('/root:/' + OD_ROOT + OD_REQ + '/') > 0 && /\.txt:\/content$/.test(puts[0].url) && puts[0].body === ID, { x: x.json, puts });
    await call({ op: 'mail_request', agent: 'routine-mail-filing', message_id: ID, why: 'pump report 2/26' });
    check('a second request: a new file, not the same name', puts.length === 2 && puts[0].url !== puts[1].url);
    puts = [];
    check('bad ids: short, with a space or a query: refused, nothing written', (await call({ op: 'mail_request', agent: 'a-b', message_id: 'abc', why: 'xxxxx' })).status === 400 && (await call({ op: 'mail_request', agent: 'a-b', message_id: ID + ' x', why: 'xxxxx' })).status === 400 && (await call({ op: 'mail_request', agent: 'a-b', message_id: ID + '?x=1', why: 'xxxxx' })).status === 400 && !puts.length);
    check('why missing or a bad agent: refused', (await call({ op: 'mail_request', agent: 'a-b', message_id: ID })).status === 400 && (await call({ op: 'mail_request', agent: 'Bad', message_id: ID, why: 'xxxxx' })).status === 400 && !puts.length);
    check('without the key: 403', (await call({ op: 'mail_request', agent: 'a-b', message_id: ID, why: 'xxxxx' }, 'nope')).status === 403 && !puts.length);
    check('the id pattern has no dot (no ../ in a name)', !MAIL_REQ_ID.test('a'.repeat(40) + '.'));
    graph = async () => new Response('{}', { status: 500 });
  }

  console.log('\n4c. live: the deployed commit and the hash of the served index.html');
  {
    const html = '<html>tapugan</html>';
    const want = (await import('crypto')).createHash('sha256').update(html).digest('hex');
    const ENVL = { ...ENV, CF_PAGES_COMMIT_SHA: 'abc123', CF_PAGES_BRANCH: 'main', ASSETS: { fetch: async (req) => new Response(new URL(req.url).pathname === '/index.html' ? html : 'x', { status: 200 }) } };
    let l = await call({ op: 'live' }, 'k-123', 'POST', ENVL);
    check('live: ok, the commit, and the sha256 of the served index.html', l.json.ok && l.json.commit === 'abc123' && l.json.index_sha256 === want && l.json.bytes === html.length, l.json);
    check('live without the key: 403', (await call({ op: 'live' }, 'nope', 'POST', ENVL)).status === 403);
    l = await call({ op: 'live' }, 'k-123', 'POST', ENV);
    check('live with no ASSETS binding: ok false, says why', !l.json.ok && /ASSETS/.test(l.json.error), l.json);
  }

  console.log('\n4f3. mail_draft with attachments, od_put_pdf (20/10/2026: "attach the unsigned draft")');
  {
    const DIR = '21_x/boilers', have = { [OD_ROOT + DIR]: { id: 'D', folder: {} }, [OD_ROOT + DIR + '/a.pdf']: { id: 'A', file: {} } };
    let puts = [];
    graph = async (url, opt = {}) => {
      const u = decodeURIComponent(url);
      if (opt.method === 'PUT') { puts.push({ url: u, body: opt.body }); return new Response(JSON.stringify({ size: 9, webUrl: 'https://od/x' }), { status: 201 }); }
      const m = /\/root:\/(.+?)\?select=/.exec(u);
      if (m) { const it = have[m[1]]; return it ? new Response(JSON.stringify(it), { status: 200 }) : new Response('{}', { status: 404 }); }
      return new Response('{}', { status: 400 });
    };
    const D = { op: 'mail_draft', agent: 'dev', why: 'certificates to HR', to: 'Geny@tapugan.co.il;tzachi@tapugan.co.il', subject: 'הסמכות', body: 'מצורפות ההסמכות' };
    let x = await call({ ...D, attach: [DIR + '/a.pdf'] });
    const fj = puts[0] ? JSON.parse(puts[0].body) : {};
    check('an attachment that exists: in the request as its full path and name', x.json.ok && x.json.attachments === 1 && fj.attachments.length === 1 && fj.attachments[0].path === '/' + OD_ROOT + DIR + '/a.pdf' && fj.attachments[0].name === 'a.pdf', { x: x.json, fj });
    puts = [];
    x = await call({ ...D, attach: [DIR + '/missing.pdf'] });
    check('an attachment that is not there: refused, no request file (the flow would make no draft)', !x.json.ok && /attach missing/.test(x.json.error) && !puts.length, x.json);
    x = await call(D);
    check('no attach: no attachments key, as before', x.json.ok && !('attachments' in JSON.parse(puts[0].body)));
    // 20/10/2026 (Michael: "this is a mail in a thread, so it goes in the thread")
    puts = [];
    const RID = 'AAMkADNmMjhjNWNiLTk4ZTItNDA4Ny1hYTM4LWM3MWJjMTc2MzUyMwBGAAAAAACvmdaXkAHZSoM_lWbFdKqPBwDNY6eUSe9PQJ-U8t9dbCM3AAAAAAEJAA=';
    x = await call({ ...D, reply_to: RID });
    const rj = puts[0] ? JSON.parse(puts[0].body) : {}, rb = rj.reply_body ? JSON.parse(rj.reply_body) : {};
    check('reply_to: the id and a createReply body with our recipients and our text above the thread', x.json.ok && rj.reply_to === RID && rb.message.toRecipients.length === 2 && rb.message.toRecipients[1].emailAddress.address === 'tzachi@tapugan.co.il' && rb.comment === rj.html && /font-family:Arial/.test(rb.comment.slice(0, 120)), rj);
    puts = [];
    check('a bad reply_to (short, a path, a quote): refused, nothing written', (await Promise.all(['abc', '../x/' + RID, RID + '"'].map((r) => call({ ...D, reply_to: r })))).every((r) => r.status === 400) && !puts.length);
    x = await call(D);
    // 20/10/2026: cc, the monthly water report (one inspector, three in copy)
    puts = [];
    x = await call({ ...D, cc: 'a@tapugan.co.il; b@x.co', reply_to: RID });
    const cj = puts[0] ? JSON.parse(puts[0].body) : {}, cb = cj.reply_body ? JSON.parse(cj.reply_body) : {};
    check('cc: in the request for the flow, and as ccRecipients of a thread reply', x.json.ok && cj.cc === 'a@tapugan.co.il;b@x.co' && cb.message.ccRecipients.length === 2 && cb.message.ccRecipients[1].emailAddress.address === 'b@x.co', cj);
    puts = [];
    check('a bad cc or more than 5: refused, nothing written', (await call({ ...D, cc: 'nope' })).status === 400 && (await call({ ...D, cc: 'a@x.co;b@x.co;c@x.co;d@x.co;e@x.co;f@x.co' })).status === 400 && !puts.length);
    x = await call(D);
    check('no cc: no cc key', x.json.ok && !('cc' in JSON.parse(puts[0].body)));
    puts = []; x = await call(D);
    check('no reply_to: a new mail as before, no reply keys', x.json.ok && !('reply_to' in JSON.parse(puts[0].body)) && !('reply_body' in JSON.parse(puts[0].body)));
    check('attach: .., a protected folder, the draft or request folder, a non-document, empty or more than 5: refused',
      [['../a.pdf'], ['x/למחיקה/a.pdf'], ['ARCHIVE/a.pdf'], [OD_DRAFT + '/a.pdf'], [OD_REQ + '/a.pdf'], ['a.exe'], [], ['1.pdf', '2.pdf', '3.pdf', '4.pdf', '5.pdf', '6.pdf'], 'a.pdf'].every((a) => !!draftAttach(a).error));
    puts = [];
    const pdf = Buffer.from('%PDF-1.7 test').toString('base64');
    const P = { op: 'od_put_pdf', agent: 'dev', why: 'merged letter and certificate', dir: DIR, name: 'b.pdf', b64: pdf };
    x = await call(P);
    check('od_put_pdf: one PUT with conflictBehavior=fail, into the folder, the bytes as sent', x.json.ok && puts.length === 1 && puts[0].url.indexOf(OD_ROOT + DIR + '/b.pdf:/content?@microsoft.graph.conflictBehavior=fail') > 0 && String.fromCharCode(...puts[0].body.slice(0, 5)) === '%PDF-', { x: x.json, u: puts[0] && puts[0].url });
    puts = [];
    x = await call({ ...P, name: 'a.pdf' });
    check('a name that is taken: refused, nothing written', !x.json.ok && x.json.error === 'name taken' && !puts.length, x.json);
    x = await call({ ...P, dir: '21_x/none' });
    check('a folder that is not there: refused', !x.json.ok && /^dir 404/.test(x.json.error) && !puts.length, x.json);
    check('not a PDF, not .pdf, too big, a protected folder, a bad b64, or an extra field: refused',
      [{ b64: Buffer.from('hello').toString('base64') }, { name: 'b.docx' }, { dir: 'x/למחיקה' }, { b64: '***' }].every((o) => !!odPutPdfCheck({ ...P, ...o }).error) && !!odPutPdfCheck({ ...P, b64: Buffer.alloc(OD_PUT_MAX + 1, 37).toString('base64') }).error && (await call({ ...P, overwrite: true })).status === 400 && !puts.length);
    { const zip = Buffer.concat([Buffer.from([0x50, 0x4b, 3, 4]), Buffer.alloc(20, 1)]).toString('base64');
      const w = odPutPdfCheck({ ...P, name: 'b.docx', b64: zip }), x2 = odPutPdfCheck({ ...P, name: 'b.xlsx', b64: zip });
      check('od_put_pdf takes Word and Excel too, each by its own signature and type (24/10/2026)', !w.error && /wordprocessingml/.test(w.type) && !x2.error && /spreadsheetml/.test(x2.type) && !!odPutPdfCheck({ ...P, name: 'b.doc', b64: zip }).error && !!odPutPdfCheck({ ...P, name: 'b.pdf', b64: zip }).error, [w.error, x2.error]); }
    graph = async () => new Response('{}', { status: 500 });
  }

  console.log('\n4f3b. od_archive: the old form moves to "_גרסאות קודמות" (20/10/2026, Michael: "צריך להעביר לארכיון")');
  {
    const DIR = '11_x/07_forms', have = { [OD_ROOT + DIR]: { id: 'D', folder: {} }, [OD_ROOT + DIR + '/old.pdf']: { id: 'O', file: {} }, [OD_ROOT + DIR + '/new.pdf']: { id: 'N', file: {} } };
    let posts = [], patches = [];
    graph = async (url, opt = {}) => {
      const u = decodeURIComponent(url);
      if (opt.method === 'POST') { posts.push({ url: u, body: JSON.parse(opt.body) }); have[OD_ROOT + DIR + '/' + OD_ARCHIVE_DIR] = { id: 'AR', folder: {} }; return new Response(JSON.stringify({ id: 'AR', folder: {} }), { status: 201 }); }
      if (opt.method === 'PATCH') { patches.push({ url: u, body: JSON.parse(opt.body) }); return new Response('{}', { status: 200 }); }
      const m = /\/root:\/(.+?)\?select=/.exec(u);
      if (m) { const it = have[m[1]]; return it ? new Response(JSON.stringify(it), { status: 200 }) : new Response('{}', { status: 404 }); }
      return new Response('{}', { status: 400 });
    };
    const A = { op: 'od_archive', agent: 'routine-wa-assistant', why: 'new version of the form', path: DIR + '/old.pdf', replaced_by: 'new.pdf' };
    let x = await call(A);
    check('od_archive: the archive folder is created once, then the old file moves into it, same name', x.json.ok && posts.length === 1 && posts[0].body.name === OD_ARCHIVE_DIR && posts[0].body['@microsoft.graph.conflictBehavior'] === 'fail' && patches.length === 1 && patches[0].url.indexOf('/items/O?') > 0 && patches[0].body.parentReference.id === 'AR' && !('name' in patches[0].body) && x.json.path === DIR + '/' + OD_ARCHIVE_DIR + '/old.pdf', { x: x.json, posts, patches });
    posts = []; patches = [];
    have[OD_ROOT + DIR + '/' + OD_ARCHIVE_DIR + '/old.pdf'] = { id: 'X', file: {} };
    x = await call(A);
    check('the same name already in the archive: refused, nothing moved, no second folder', !x.json.ok && /name taken/.test(x.json.error) && !patches.length && !posts.length, x.json);
    x = await call({ ...A, replaced_by: 'missing.pdf' });
    check('no new file beside it: refused (archiving never hides the only copy)', !x.json.ok && /^replaced_by 404/.test(x.json.error) && !patches.length, x.json);
    check('from the inbox, the drafts, an archive folder, a folder path, itself as replaced_by, a path in replaced_by, no why, or an extra field: refused',
      [{ path: OD_INBOX + '/a.pdf' }, { path: OD_DRAFT + '/a.pdf' }, { path: DIR + '/' + OD_ARCHIVE_DIR + '/a.pdf' }, { path: 'x/ARCHIVE/a.pdf' }, { path: 'a.pdf' }, { path: DIR + '/../a.pdf' }, { replaced_by: 'old.pdf' }, { replaced_by: 'x/new.pdf' }, { why: '' }, { path: DIR + '/a.exe' }].every((o) => !!odArchiveCheck({ ...A, ...o }).error) && (await call({ ...A, delete: true })).status === 400 && !patches.length);
    graph = async () => new Response('{}', { status: 500 });
  }

  console.log('\n4f4. relay_fire: wake the postman now, without text (20/10/2026, Michael: "בצע: טוקן לדוור")');
  {
    let x = await call({ op: 'relay_fire', agent: 'routine-wa-assistant' });
    check('no POSTMAN_FIRE_TOKEN: nothing fired, said so', !x.json.ok && x.json.error === 'no postman token' && !fires.length, x.json);
    const E2 = { ...ENV, POSTMAN_FIRE_TOKEN: 'pt-1' };
    delete state.relay_fire_at;
    x = await call({ op: 'relay_fire', agent: 'routine-wa-assistant', expect_session: 'session_01POSTMAN' }, 'k-123', 'POST', E2);
    check('fired once at the postman trigger, its own token, no text (so it lands in its own session), landed true', x.json.fired && fires.length === 1 && fires[0].url.indexOf('/routines/' + POSTMAN_TRIGGER + '/fire') > 0 && fires[0].auth === 'Bearer pt-1' && !('text' in fires[0].body) && x.json.landed === true, { x: x.json, f: fires[0] });
    x = await call({ op: 'relay_fire', agent: 'routine-wa-assistant' }, 'k-123', 'POST', E2);
    check('again within ' + RELAY_FIRE_GAP_S + 's: not fired (a loop cannot wake it over and over)', x.json.ok && !x.json.fired && fires.length === 1, x.json);
    state.relay_fire_at = new Date(Date.now() - (RELAY_FIRE_GAP_S + 5) * 1000).toISOString(); fireSession = 'cse_01FRESH';
    x = await call({ op: 'relay_fire', agent: 'routine-wa-assistant', expect_session: 'session_01POSTMAN' }, 'k-123', 'POST', E2);
    check('after the gap: fired again; a fire that went to another session says landed false', x.json.fired && fires.length === 2 && x.json.landed === false, x.json);
    check('an extra field (text): refused, nothing fired', (await call({ op: 'relay_fire', agent: 'x', text: 'hi' }, 'k-123', 'POST', E2)).status === 400 && fires.length === 2);
  }

  console.log('\n5. the country gate lets it through (the cloud is not in Israel)');
  const mw = fs.readFileSync(new URL('../../functions/_middleware.js', import.meta.url), 'utf8');
  // 21/10/2026: the WhatsApp assistant reads its knowledge through the server (the private repo is closed to it)
  {
    check('skill_read: only SKILL.md and references/*.md, never the exam or a path out', skillPath('SKILL.md') === 'SKILL.md' && skillPath('references/law.md') === 'references/law.md' && !skillPath('references/exam.md') && !skillPath('../../README.md') && !skillPath('references/x.json') && !skillPath('archive/old.md'));
    let x = await call({ op: 'skill_read', path: 'references/law.md' }, 'k-123', 'POST', { ...ENV, GH_SKILLS_TOKEN: 'gh-t' });
    check('skill_read: the file text, read with the skills token', x.json.ok && /section 81/.test(x.json.text) && ghCalls.length === 1 && ghCalls[0].auth === 'Bearer gh-t' && ghCalls[0].url === SKILL_BASE + 'references/law.md', { j: x.json, ghCalls });
    x = await call({ op: 'skill_read', path: 'references/exam.md' }, 'k-123', 'POST', { ...ENV, GH_SKILLS_TOKEN: 'gh-t' });
    check('skill_read: the exam is refused, nothing fetched', x.status === 400 && ghCalls.length === 1);
    x = await call({ op: 'skill_read', path: 'SKILL.md' });
    check('skill_read without the token: a clear error', x.json.ok === false && /GH_SKILLS_TOKEN/.test(x.json.error));
  }
  // 21/10/2026: Nevo and gov.il read from the server for the assistant
  {
    check('source_read: only https nevo.co.il / gov.il', !!sourceUrl('https://www.nevo.co.il/law_html/law00/74793.htm') && !!sourceUrl('https://www.gov.il/he/service/x') && !sourceUrl('http://www.nevo.co.il/x') && !sourceUrl('https://nevo.co.il.evil.com/x') && !sourceUrl('https://evil.com/?nevo.co.il') && !sourceUrl('https://user@gov.il/x'));
    check('htmlText: scripts out, text and lines kept', htmlText('<script>bad()</script><p>a&amp;b</p><p>c</p>') === 'a&b\nc');
    const x = await call({ op: 'source_read', url: 'https://www.nevo.co.il/law_html/law00/74793.htm' });
    check('source_read: the page text, word for word', x.json.ok && /75\. \(\u05d0\) \u05dc\u05e4\u05d7\u05d5\u05ea \u05d0\u05d7\u05ea \u05dc\u05e9\u05e9\u05d4/.test(x.json.text) && !/x\(\)/.test(x.json.text), x.json);
    check('source_read: another site refused', (await call({ op: 'source_read', url: 'https://example.com/' })).status === 400);
  }
  // 22/10/2026: a scanned PDF read on the server (the assistant: read_resource has no text, od-read is blocked)
  {
    check('pdf_read check: 1-5 PDFs, a question, no path out, no Word file', !pdfReadCheck({ paths: ['_\u05e0\u05db\u05e0\u05e1 \u05de\u05d4\u05de\u05d9\u05d9\u05dc/a.pdf'], question: 'is it there?' }).error
      && /question/.test(pdfReadCheck({ paths: ['a/b.pdf'], question: 'x' }).error) && pdfReadCheck({ paths: ['../b.pdf'], question: 'is it there?' }).error
      && /PDF/.test(pdfReadCheck({ paths: ['a/b.docx'], question: 'is it there?' }).error) && pdfReadCheck({ paths: [], question: 'is it there?' }).error);
    const E = { ...ENV, ANTHROPIC_KEY: 'ak' };
    graph = async (u) => /:\/content$/.test(u) ? new Response(/big\.pdf/.test(decodeURIComponent(u)) ? new Uint8Array(PDF_READ_MAX + 1) : new Uint8Array([0x25, 0x50, 0x44, 0x46]), { status: 200 }) : new Response('{}', { status: 404 });
    let x = await call({ op: 'pdf_read', agent: 'routine-wa-assistant', why: 'test', paths: ['a/one.pdf', 'a/big.pdf'], question: 'is confined space written?' }, 'k-123', 'POST', E);
    const one = x.json.files && x.json.files.find((f) => f.name === 'one.pdf'), big = x.json.files && x.json.files.find((f) => f.name === 'big.pdf');
    check('pdf_read: the PDF goes to Claude as a document with the question, the answer comes back', one && one.ok && /not written/.test(one.answer) && claudeReads.length === 1 && claudeReads[0].key === 'ak'
      && claudeReads[0].b.messages[0].content[0].type === 'document' && claudeReads[0].b.messages[0].content[0].source.data === 'JVBERg==' && claudeReads[0].b.messages[0].content[1].text === 'is confined space written?', { j: x.json, c: claudeReads.length });
    check('pdf_read: a file over the cap is not sent, and ok is false', big && !big.ok && /too big/.test(big.error) && x.json.ok === false && claudeReads.length === 1);
    x = await call({ op: 'pdf_read', agent: 'a-b', why: 'test', paths: ['a/one.pdf'], question: 'make it fail' }, 'k-123', 'POST', E);
    check('pdf_read: a refusal from Claude carries its message', x.json.files && /claude 400 Your credit balance is too low/.test(x.json.files[0].error), x.json);
    check('pdf_read: an extra field refused', (await call({ op: 'pdf_read', agent: 'a-b', why: 'test', paths: ['a/one.pdf'], question: 'is it there?', model: 'x' }, 'k-123', 'POST', E)).status === 400);
    x = await call({ op: 'pdf_read', agent: 'a-b', why: 'test', paths: ['a/one.pdf'], question: 'is it there?' });
    check('pdf_read without ANTHROPIC_KEY: a clear error', x.json.ok === false && /ANTHROPIC_KEY/.test(x.json.error));
    graph = async () => new Response('{}', { status: 500 });
  }
  // 21/10/2026: a photo Michael sent on WhatsApp reaches the assistant
  {
    const E = { ...ENV, META_ACCESS_TOKEN: 'mt' };
    mediaMeta = { url: 'https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=1', mime_type: 'image/jpeg', file_size: 4 };
    let x = await call({ op: 'wa_media', id: '90000001' }, 'k-123', 'POST', E);
    check('wa_media: the image as base64 with its type', x.json.ok && x.json.mime === 'image/jpeg' && x.json.bytes === 4 && x.json.b64 === '/9j/AQ==', x.json);
    mediaMeta = { url: 'https://lookaside.fbsbx.com/x', mime_type: 'video/mp4', file_size: 4 };
    x = await call({ op: 'wa_media', id: '90000001' }, 'k-123', 'POST', E);
    check('wa_media: a video is not read', x.json.ok === false && /type not read/.test(x.json.error));
    mediaMeta = { url: 'https://evil.example/a', mime_type: 'image/png', file_size: 4 };
    x = await call({ op: 'wa_media', id: '90000001' }, 'k-123', 'POST', E);
    check('wa_media: a download host that is not Meta is refused (the token is not sent there)', x.json.ok === false && /host/.test(x.json.error));
    mediaMeta = { url: 'https://lookaside.fbsbx.com/x', mime_type: 'application/pdf', file_size: 99999999 };
    x = await call({ op: 'wa_media', id: '90000001' }, 'k-123', 'POST', E);
    check('wa_media: too big is refused before download', x.json.ok === false && /too big/.test(x.json.error));
    check('wa_media: an id with a path in it is refused', (await call({ op: 'wa_media', id: '1/../me' }, 'k-123', 'POST', E)).status === 400);
    // 25/10/2026: a photo he sent from /chat: the id of his chat line, the file read from the safety folder
    const CD = '\u05e9\u05d5\u05dc\u05d7\u05df \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4/\u05e0\u05d9\u05d4\u05d5\u05dc \u05d1\u05d8\u05d9\u05d7\u05d5\u05ea/\u05de\u05d4\u05e6\u0027\u05d0\u05d8/';
    chatLine = () => [{ file: CD + '25-10-2026 08.00.00 - x.jpg' }];
    let gurl = '';
    graph = async (u) => { gurl = u; return new Response(new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 1, 2, 3, 4]), { status: 200 }); };
    x = await call({ op: 'wa_media', id: 'chabc12345' }, 'k-123', 'POST', E);
    check('wa_media ch...: his photo from the chat, read from the chat folder, as base64 with its type', x.json.ok && x.json.mime === 'image/jpeg' && x.json.from === 'chat' && decodeURIComponent(gurl).indexOf(CD) > 0, x.json);
    chatLine = () => [{ file: '\u05e9\u05d5\u05dc\u05d7\u05df \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4/other/x.jpg' }];
    x = await call({ op: 'wa_media', id: 'chabc12345' }, 'k-123', 'POST', E);
    check('wa_media ch...: a line whose file is outside the chat folder is not read', x.json.ok === false && /no file/.test(x.json.error));
    chatLine = () => []; graph = async () => new Response('{}', { status: 500 });
  }
  check('/api/routine-db is a machine path', /const MACHINE_PATHS = \[[^\]]*'\/api\/routine-db'/.test(mw));

  console.log('\nsign_offer (21/10/2026: the assistant offers PDFs as buttons, signs nothing)');
  { const E = { ...ENV, META_PHONE_NUMBER_ID: 'P', META_ACCESS_TOKEN: 'm' };
    const six = await call({ op: 'sign_offer', agent: 'routine-wa-assistant', why: 'test offer', paths: ['a/1.pdf', 'a/2.pdf', 'a/3.pdf', 'a/4.pdf', 'a/5.pdf', 'a/6.pdf'] }, 'k-123', 'POST', E);
    check('sign_offer: more than 5 = refused', six.status === 400 && /1-5/.test(six.json.error), six);
    const prot = await call({ op: 'sign_offer', agent: 'routine-wa-assistant', why: 'test offer', paths: ['a/1.pdf', '_\u05d8\u05d9\u05d5\u05d8\u05d5\u05ea \u05dc\u05de\u05d9\u05d9\u05dc/2.pdf'] }, 'k-123', 'POST', E);
    check('sign_offer: a protected folder = refused, by its number', prot.status === 400 && /^path 2:/.test(prot.json.error), prot);
    const extra = await call({ op: 'sign_offer', agent: 'routine-wa-assistant', why: 'test offer', paths: ['a/1.pdf'], page: 2 }, 'k-123', 'POST', E);
    check('sign_offer: page alone is refused (page, x and y together, one file; 22/10/2026)', extra.status === 400 && /together/.test(extra.json.error), extra);
    delete state.sign_pick;
    const noOwner = await call({ op: 'sign_offer', agent: 'routine-wa-assistant', why: 'test offer', paths: ['a/1.pdf', '_\u05e0\u05db\u05e0\u05e1 \u05de\u05d4\u05de\u05d9\u05d9\u05dc/q.pdf'] }, 'k-123', 'POST', E);
    check('sign_offer: valid paths (the mail inbox too) pass the checks; no owner number = nothing saved', noOwner.json.ok === false && /owner/.test(noOwner.json.error) && !('sign_pick' in state), noOwner); }
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('HARNESS ERROR: ' + (e && e.stack || e)); process.exit(1); });
