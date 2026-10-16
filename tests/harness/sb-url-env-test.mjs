// Server functions talk to the database in env.SUPABASE_URL (16/10/2026, BACKLOG 14.13;
// Michael in the questionnaire: "בצע: כתובת המסד מההגדרות"). On a preview build the
// middleware puts the test project there; a file that kept the live address as a constant
// skipped it, so close-hazard, codes, talk and nine more could not be tried on the test
// database (they hit the live address with the test key and got 401: safe, but untestable).
// What must hold:
//   * every live-address constant in functions/api is either a fallback after
//     env.SUPABASE_URL, or a `let` that onRequest sets from sbFrom(env) first thing;
//   * run for real: close-hazard and codes, given a test env, call only the test host.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };
const LIVE_HOST = 'znhjtpcltrxxyfjczgvw.supabase.co', TEST = 'https://ldzbjbsumzqjyvtpiwqo.supabase.co';
const LIVE_LIT = "'https://" + LIVE_HOST + "'";
// The self-test page checks production on purpose, with the live publishable key beside it.
const ON_PURPOSE = { '_securityselftest.js': 'SBU' };

console.log('\n1. no constant skips env.SUPABASE_URL');
const dir = path.join(ROOT, 'functions/api');
const bad = [];
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js'))) {
  const s = fs.readFileSync(path.join(dir, f), 'utf8');
  const re = new RegExp('^(const|let) (\\w+) = ' + LIVE_LIT.replace(/[.]/g, '\\.') + ';', 'gm');
  let m;
  while ((m = re.exec(s))) {
    const [, kind, name] = m;
    if (ON_PURPOSE[f] === name) continue;
    const uses = (s.match(new RegExp('\\b' + name + '\\b', 'g')) || []).length - 1;
    const fallbackOnly = (s.match(new RegExp('SUPABASE_URL\\s*\\|\\|\\s*' + name + '\\b', 'g')) || []).length;
    if (uses === 0 || uses === fallbackOnly) continue;          // unused, or only ever `env.SUPABASE_URL || NAME`
    const entry = s.indexOf('export async function onRequest(');
    const head = entry >= 0 ? s.substring(entry, s.indexOf('\n', s.indexOf('\n', entry) + 1)) : '';
    const set = new RegExp('\\b' + name + ' = sbFrom\\((context\\.)?env\\);').test(head);
    if (kind !== 'let' || !set) bad.push(f + ': ' + name + (kind !== 'let' ? ' is const' : ' not set at the top of onRequest'));
  }
}
check('every live-address constant is set from env per request (or only a fallback)', bad.length === 0, bad);
const shared = fs.readFileSync(path.join(ROOT, 'functions/_shared.js'), 'utf8');
check('_shared.js: sbFrom(env) = env.SUPABASE_URL, else the live project', /export const sbFrom = \(env\) => \(env && env\.SUPABASE_URL\) \|\| SB_LIVE;/.test(shared));

console.log('\n2. run for real with a test env: only the test host is called');
const hosts = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url) => { hosts.push(new URL(String(url)).host); return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } }); };
{
  const { onRequest } = await import('./_build/close-hazard.mjs');
  const { makeCloseToken } = await import('./_build/_closelink.mjs');
  const env = { SUPABASE_URL: TEST, SUPABASE_SERVICE_ROLE_KEY: 'test-key', TRUSTEE_NOTIFY_SECRET: 'nsec' };
  const tok = await makeCloseToken(env, 'th-abc123');
  hosts.length = 0;
  await onRequest({ request: new Request('https://a1b2.tapugan-safety.pages.dev/api/close-hazard?k=' + encodeURIComponent(tok)), env });
  check('close-hazard: read the hazard from the test project', hosts.length >= 1 && hosts.every((h) => h === new URL(TEST).host), hosts);
  hosts.length = 0;
  await onRequest({ request: new Request('https://tapugan-safety.pages.dev/api/close-hazard?k=' + encodeURIComponent(await makeCloseToken({ TRUSTEE_NOTIFY_SECRET: 'nsec' }, 'th-abc123'))), env: { SUPABASE_SERVICE_ROLE_KEY: 'live-key', TRUSTEE_NOTIFY_SECRET: 'nsec' } });
  check('close-hazard: with no SUPABASE_URL (production), the live project as before', hosts.length >= 1 && hosts.every((h) => h === LIVE_HOST), hosts);
}
globalThis.fetch = realFetch;

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
