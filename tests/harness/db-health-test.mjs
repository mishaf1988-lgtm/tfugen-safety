// /api/db-health (24/11/2026, Michael: "do it: build a mail alert"): the server's own database check that
// site-up.yml calls from GitHub. One word out, never the reason; the probe uses the service key the way every server
// function does (apikey only for a new-style sb_secret_ key); the answer is kept CACHE_MS so a flood of calls is one
// database read a minute. fetch is mocked.
import fs from 'fs';
import { onRequest, probe, resetCache, CACHE_MS } from './_build/db-health.mjs';

let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 300) : '')); } };
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const req = (m = 'GET') => new Request('https://tapugan-safety.pages.dev/api/db-health', { method: m });
const env = { SUPABASE_SERVICE_ROLE_KEY: 'eyJ.test.key' };
let calls = [];
const fetchOk = async (u, o) => { calls.push([u, o.headers]); return new Response('[]', { status: 200 }); };
const fetch401 = async (u, o) => { calls.push([u, o.headers]); return new Response('{"message":"Invalid API key"}', { status: 401 }); };
const fetchThrow = async () => { throw new Error('timeout'); };

resetCache(); calls = [];
let r = await onRequest({ request: req(), env }, fetchOk, 1000);
check('database answers: 200 "db ok"', r.status === 200 && (await r.text()) === 'db ok');
check('the probe reads the live database with the service key (apikey and Bearer for a JWT key)',
  calls.length === 1 && calls[0][0].startsWith(SB + '/rest/v1/') && calls[0][1].apikey === env.SUPABASE_SERVICE_ROLE_KEY && calls[0][1].Authorization === 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY, calls);

resetCache();
r = await onRequest({ request: req(), env }, fetch401, 1000);
const t = await r.text();
check('wrong key (401): 503 "db fail", and the Supabase message never leaves the server', r.status === 503 && t === 'db fail', t);

resetCache(); calls = [];
await onRequest({ request: req(), env }, fetchOk, 1000);
await onRequest({ request: req(), env }, fetchOk, 1000 + CACHE_MS - 1);
check('two calls inside CACHE_MS: one database read', calls.length === 1, calls.length);
await onRequest({ request: req(), env }, fetchOk, 1000 + CACHE_MS);
check('after CACHE_MS: a new read', calls.length === 2, calls.length);

check('a network error or timeout: false', (await probe(env, fetchThrow)) === false);
check('no key at all: false, no request', (calls = [], (await probe({}, fetchOk)) === false && calls.length === 0));
calls = [];
await probe({ SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_abc' }, fetchOk);
check('a new-style sb_secret_ key goes as apikey only (Supabase refuses it as Bearer)', calls.length === 1 && calls[0][1].apikey === 'sb_secret_abc' && !('Authorization' in calls[0][1]), calls);

resetCache(); calls = [];
let release; const slow = async (u, o) => { calls.push([u, o.headers]); await new Promise((res) => { release = res; }); return new Response('[]', { status: 200 }); };
const ps = [onRequest({ request: req(), env }, slow, 5000), onRequest({ request: req(), env }, slow, 5000), onRequest({ request: req(), env }, slow, 5000)];
await new Promise((res) => setTimeout(res, 10)); release();
const rs = await Promise.all(ps);
check('three calls while the cache is empty: one database read, all answer "db ok"', calls.length === 1 && rs.every((x) => x.status === 200), calls.length);

// pairs (02/11/2026): the sb_secret_ test decides the headers. Three real shapes that must go as apikey only, three
// that must keep the Bearer header.
for (const [k, apikeyOnly] of [['sb_secret_N2ihyyjKabc', true], ['sb_secret_XYZ123', true], ['sb_secret_a-b_c', true],
  ['eyJhbGciOiJIUzI1NiJ9.x.y', false], ['sb_publishable_N2ihyyjK', false], [' sb_secret_leadingspace', false]]) {
  calls = [];
  await probe({ SUPABASE_SERVICE_ROLE_KEY: k }, fetchOk);
  check('key shape ' + k.slice(0, 16) + ': ' + (apikeyOnly ? 'apikey only' : 'apikey and Bearer'), calls.length === 1 && (('Authorization' in calls[0][1]) === !apikeyOnly), calls);
}

resetCache();
r = await onRequest({ request: req('POST'), env }, fetchOk, 1000);
check('POST: 405, no database read', r.status === 405);

const mw = fs.readFileSync(new URL('../../functions/_middleware.js', import.meta.url), 'utf8');
check('a machine path in the country gate, so GitHub can call it', /MACHINE_PATHS = \[[^\]]*'\/api\/db-health'/.test(mw));
const wf = fs.readFileSync(new URL('../../.github/workflows/site-up.yml', import.meta.url), 'utf8');
check('site-up.yml calls it and fails the run on "db fail"', wf.includes('/api/db-health') && /steps\.probe\.outputs\.db == 'fail'/.test(wf));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
