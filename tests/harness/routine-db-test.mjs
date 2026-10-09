// /api/routine-db (09/10/2026, Michael: "בצע: דרך האתר שלנו", "בצע: בלי טבלת רפואה"):
// the Routines' way to the database without the Supabase connector. One key, a fixed
// list of tables, medical tables expiry only, trustee reports without text or names,
// four server_state keys to write, nothing deleted.
import fs from 'fs';
import { onRequest, cleanQuery, keyOk, TABLES, COLUMNS, STATE_WRITE } from './_build/routine-db.mjs';

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
  return new Response(JSON.stringify([{ id: 1 }]), { status: 200 });
};
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
  check('the write list is exactly the four keys', STATE_WRITE.join() === 'quote_track,nevo_versions,od_raw_token,od_raw_exp');
  calls = [];
  await call({ op: 'delete', table: 'docs' });
  check('no delete op: nothing sent', !calls.length);
  check('no DELETE or PATCH anywhere in the source', !/method:\s*'(DELETE|PATCH)'/.test(fs.readFileSync(new URL('../../functions/api/routine-db.js', import.meta.url), 'utf8')));

  console.log('\n5. the country gate lets it through (the cloud is not in Israel)');
  const mw = fs.readFileSync(new URL('../../functions/_middleware.js', import.meta.url), 'utf8');
  check('/api/routine-db is a machine path', /const MACHINE_PATHS = \[[^\]]*'\/api\/routine-db'/.test(mw));

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('HARNESS ERROR: ' + (e && e.stack || e)); process.exit(1); });
