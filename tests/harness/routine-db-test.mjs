// /api/routine-db (09/10/2026, Michael: "בצע: דרך האתר שלנו", "בצע: בלי טבלת רפואה"):
// the Routines' way to the database without the Supabase connector. One key, a fixed
// list of tables, medical tables expiry only, trustee reports without text or names,
// four server_state keys to write, nothing deleted.
import fs from 'fs';
import { onRequest, cleanQuery, keyOk, TABLES, COLUMNS, STATE_WRITE, STAMP_AT, stampAt, AGENT_LOG_MAX, expiryPatch, EXPIRY_TABLES, FILE_URL_PREFIX, odMoveCheck, skipNameOk, OD_ROOT, OD_INBOX, OD_SKIP, OD_REQ, MAIL_REQ_ID, skipMovedAdd, SKIP_MOVED_DAYS, SKIP_MOVED_MAX, CLAIM_KEY, CLAIM_HOURS, claimApply, claimItem, claimSession } from './_build/routine-db.mjs';

let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 400) : '')); } };
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const ENV = { ROUTINE_KEY: 'k-123', SUPABASE_SERVICE_ROLE_KEY: 'srv' };
let calls = [], state = {};
globalThis.fetch = async (url, opt = {}) => {
  calls.push({ url, method: opt.method || 'GET', body: opt.body });
  if (url.startsWith(SB + '/rest/v1/server_state')) {
    if ((opt.method || 'GET') === 'POST') { JSON.parse(opt.body).forEach((r) => { state[r.key] = r.value; }); return new Response('', { status: 201 }); }
    const keys = decodeURIComponent((/key=(?:in\.\(([^)]*)\)|eq\.(.*))/.exec(url) || []).slice(1).filter(Boolean)[0] || '').split(',');
    return new Response(JSON.stringify(keys.filter((k) => k in state).map((k) => ({ key: k, value: state[k], updated_at: 'now' }))), { status: 200 });
  }
  if (url.startsWith(SB + '/rest/v1/oauth_tokens')) return new Response(JSON.stringify([{ user_email: 'm', refresh_token: 'r', access_token: 'at', expires_at: new Date(Date.now() + 3600e3).toISOString(), scope: 'Files.ReadWrite' }]), { status: 200 });
  if (url.startsWith('https://graph.microsoft.com/')) return graph(url, opt);
  // expiry_set: a small docs / equip_inspections table (rows[table] = [...])
  const m = /\/rest\/v1\/(docs|equip_inspections)\?(.*)$/.exec(url);
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
  check('the write list is exactly the six keys (mail_filing, validity_run 11/10/2026)', STATE_WRITE.join() === 'quote_track,nevo_versions,od_raw_token,od_raw_exp,mail_filing,validity_run');
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
    check('no DELETE anywhere; one PATCH each in expiry_set, od_move and talk_field (15/10/2026)', !/method:\s*'DELETE'/.test(src) && patches.length === 3 && own === 'expiry_set,od_move,talk_field', own);
  }

  console.log('\n4b. agent_report: append-only run log');
  state = {};
  r = await call({ op: 'agent_report', agent: 'routine-quotes', ok: true, line: 'אין שינוי', learned: 'אין' });
  check('first report: written, one entry with a server time', r.json.ok && JSON.parse(state.agent_log).length === 1 && /^\d{4}-\d\d-\d\dT/.test(JSON.parse(state.agent_log)[0].at), r.json);
  await call({ op: 'agent_report', agent: 'retro', ok: false, line: 'push נדחה', learned: 'x'.repeat(500) });
  let lg = JSON.parse(state.agent_log);
  check('second report: appended, not replacing; ok false kept; text cut to 300', lg.length === 2 && lg[0].agent === 'routine-quotes' && lg[1].ok === false && lg[1].learned.length === 300, lg);
  check('ok that is not exactly true counts as a failure', (await call({ op: 'agent_report', agent: 'retro', ok: 'yes' })).json.entry.ok === false);
  check('a bad agent name: refused, log untouched', (await call({ op: 'agent_report', agent: 'Bad Name; drop' })).status === 400 && JSON.parse(state.agent_log).length === 3);
  state.agent_log = JSON.stringify(Array.from({ length: AGENT_LOG_MAX }, (_, i) => ({ agent: 'a', at: String(i) })));
  await call({ op: 'agent_report', agent: 'retro', ok: true });
  lg = JSON.parse(state.agent_log);
  check('the log keeps the last ' + AGENT_LOG_MAX, lg.length === AGENT_LOG_MAX && lg[0].at === '1' && lg[lg.length - 1].agent === 'retro');
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

  console.log('\n5. the country gate lets it through (the cloud is not in Israel)');
  const mw = fs.readFileSync(new URL('../../functions/_middleware.js', import.meta.url), 'utf8');
  check('/api/routine-db is a machine path', /const MACHINE_PATHS = \[[^\]]*'\/api\/routine-db'/.test(mw));

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('HARNESS ERROR: ' + (e && e.stack || e)); process.exit(1); });
