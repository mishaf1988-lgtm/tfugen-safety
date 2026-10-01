// Every endpoint has a gate, unless it is on the public list (BACKLOG 9.29, 01/10/2026).
//
// Until now each gate had its own suite (endpoint-role, vitre-gate, trustee-gate,
// stranger-probe...), so a NEW file in functions/api/ with no gate at all would
// pass every test in green. This suite does not read the code for a gate: it
// imports every functions/api/*.js that exists, calls it the way a stranger
// would (allowed origin, every method, no token / an anonymous session / no
// secret), and watches what the module does with the network. A gated module
// answers 4xx and touches nothing but the "who are you" lookup. Anything else
// (a write, a mail, a WhatsApp, an AI call, a read with the service key of a
// table that is not app_users) fails here by file name.
//
// The public list is explicit and each entry says why. A file on the list that
// no longer exists, or that stopped carrying the check its reason names, fails
// too, so the list cannot rot into a blanket exception.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const API = path.join(ROOT, 'functions/api');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

// name -> [why it may answer a stranger, a regex the source must still match]
const PUBLIC = {
  '_securityselftest': ['the public self-test page: read-only, counts and headers only, no secrets', /Read-only\. No state changes/],
  'close-hazard': ['a signed link from the alert mail; the token is the gate', /tokenError|verifyLink|tokenRow/],
  'trustee-gate': ['the trustee kiosk code is checked here; it is the gate itself', /TRUSTEE_CODE/],
  'self-recovery': ['"forgot password": queues a request, generic 200, rate limited, admin approves', /RATE_LIMIT_SECONDS/],
  'wa-templates': ['GET lists template names for the settings screen; POST needs a user', /requireUser/],
};

const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const ORIGIN = 'https://tapugan-safety.pages.dev';
const SRV = 'srv-key-xyz';
const ENV = {
  SUPABASE_SERVICE_ROLE_KEY: SRV, TRUSTEE_NOTIFY_SECRET: 'the-secret', CRON_SECRET: 'the-secret',
  META_PHONE_NUMBER_ID: 'pid', META_ACCESS_TOKEN: 'mtok', RESEND_API_KEY: 'rk', ANTHROPIC_API_KEY: 'ak',
  MS_CLIENT_ID: 'c', MS_CLIENT_SECRET: 's', MS_TENANT_ID: 't', TRUSTEE_CODE: '1234', VITRE_API_KEY: 'v',
  AI: { run: async () => { touched.push('AI binding'); return { response: 'x' }; } },
};

// Build: copy functions/ to a scratch folder as .mjs, rewriting relative imports.
const build = path.join(HERE, '_build', 'inventory');
fs.mkdirSync(path.join(build, 'api'), { recursive: true });
const toMjs = (src) => src.replace(/(from\s+['"])(\.{1,2}\/[^'"]+?)\.js(['"])/g, '$1$2.mjs$3');
for (const f of fs.readdirSync(path.join(ROOT, 'functions'))) {
  if (f.endsWith('.js')) fs.writeFileSync(path.join(build, f.replace(/\.js$/, '.mjs')), toMjs(fs.readFileSync(path.join(ROOT, 'functions', f), 'utf8')));
}
const files = fs.readdirSync(API).filter((f) => f.endsWith('.js'));
for (const f of files) fs.writeFileSync(path.join(build, 'api', f.replace(/\.js$/, '.mjs')), toMjs(fs.readFileSync(path.join(API, f), 'utf8')));
globalThis.atob = globalThis.atob || ((b) => Buffer.from(b, 'base64').toString('binary'));

// The network. The only thing a gate may do before refusing is ask Supabase who
// the caller is (and read their app_users row for the role). Everything else is
// recorded as a privileged touch.
let touched = [];
let who = 'none';
globalThis.fetch = async (u, init) => {
  const url = String(u && u.url ? u.url : u);
  const method = String((init && init.method) || (u && u.method) || 'GET').toUpperCase();
  const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });
  if (url.startsWith(SB + '/auth/v1/user')) {
    if (who === 'anon') return json({ id: 'anon-1', is_anonymous: true, email: '' });
    return json({ msg: 'invalid JWT' }, 401);
  }
  if (url.startsWith(SB + '/rest/v1/app_users') && method === 'GET') return json([]);
  touched.push(method + ' ' + url.replace(SB, 'SB').slice(0, 90));
  return json({}, 200);
};

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const CALLERS = { none: {}, anon: { Authorization: 'Bearer anon.jwt.token' } };

async function probe(handler, method, caller) {
  touched = [];
  who = caller;
  const headers = Object.assign({ Origin: ORIGIN, Referer: ORIGIN + '/', 'Content-Type': 'application/json' }, CALLERS[caller]);
  const body = method === 'GET' ? undefined : JSON.stringify({ op: 'test', username: 'someone', old_username: 'someone', new_username: 'other', to: '972500000000', text: 'x', messages: [{ role: 'user', content: 'x' }] });
  const request = new Request(ORIGIN + '/api/x?op=test', { method, headers, body });
  const ctx = { request, env: ENV, waitUntil: () => {}, params: {}, next: async () => new Response('next') };
  let status;
  try { status = (await handler(ctx)).status; } catch (e) { status = 'throw: ' + String(e && e.message || e).slice(0, 80); }
  return { status, touched: touched.slice() };
}

const gated = [];
for (const f of files) {
  const name = f.replace(/\.js$/, '');
  const mod = await import(path.join(build, 'api', name + '.mjs'));
  const handlers = Object.keys(mod).filter((k) => /^onRequest/.test(k));
  if (!handlers.length) { check(name + ': exports a handler', false, Object.keys(mod)); continue; }
  if (PUBLIC[name]) continue;
  gated.push(name);
  const bad = [];
  for (const h of handlers) for (const m of METHODS) for (const c of Object.keys(CALLERS)) {
    const r = await probe(mod[h], m, c);
    // 4xx, or a redirect that sends the browser back with an error (ms-auth's
    // OAuth callback without a signed state). Never 2xx, never 5xx, never a touch.
    const ok = typeof r.status === 'number' && r.status >= 300 && r.status < 500 && r.touched.length === 0;
    if (!ok) bad.push({ h, m, c, status: r.status, touched: r.touched.slice(0, 3) });
  }
  check(name + ': a stranger is refused and nothing is sent (' + handlers.join(',') + ' x ' + METHODS.length + ' methods x no token / anonymous)', bad.length === 0, bad.slice(0, 2));
}

// The public list stays honest.
for (const [name, [why, mark]] of Object.entries(PUBLIC)) {
  const p = path.join(API, name + '.js');
  const exists = fs.existsSync(p);
  check('public list: ' + name + ' exists (' + why + ')', exists);
  if (exists) check('public list: ' + name + ' still carries the check its reason names', mark.test(fs.readFileSync(p, 'utf8')));
}
check('at least 15 endpoints probed (a broken build that imports nothing is not a pass)', gated.length >= 15, gated.length);

// The suite can tell: an endpoint with no gate at all is caught.
{
  const naked = path.join(build, 'api', 'zz-naked.mjs');
  fs.writeFileSync(naked, `export async function onRequest({ env }) { await fetch('${SB}/rest/v1/ncr', { method: 'POST', headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY } }); return new Response('{}'); }`);
  const r = await probe((await import(naked)).onRequest, 'POST', 'none');
  check('control: an endpoint with no gate is caught (sent a write as a stranger)', r.touched.length > 0, r);
}

fs.rmSync(build, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
