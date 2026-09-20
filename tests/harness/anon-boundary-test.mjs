// Security review 2026-09-20. The May audit (H1) made wa-send require a JWT.
// In September the app gained a no-password trustee screen that signs in
// ANONYMOUSLY — and Supabase anonymous sign-in produces a real user, so
// /auth/v1/user answers 200 for it and the H1 gate stopped meaning anything.
// Any visitor to the public site could then send WhatsApp from the factory's
// verified Meta number. /api/claude had no auth at all.
//
// Runs the REAL function modules with fetch mocked, so the guard is tested
// rather than described.
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

// Load a function module with its ../_shared.js import rewritten to a real path.
const load = async (rel) => {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8')
    // a data: module resolves specifiers as URLs, so this must be file://
    .replace(/from '\.\.\/_shared\.js'/, "from '" + pathToFileURL(path.join(ROOT, 'functions/_shared.js')).href + "'");
  return import('data:text/javascript;charset=utf-8,' + encodeURIComponent(src));
};

const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const ORIGIN = 'https://tapugan-safety.pages.dev';
const ENV = {
  SUPABASE_SERVICE_ROLE_KEY: 'svc', META_PHONE_NUMBER_ID: 'pn', META_ACCESS_TOKEN: 'tok',
  RESEND_KEY: 'rk', AI: { run: async () => ({ response: 'ok' }) },
};

// user kind -> what /auth/v1/user answers
const USERS = {
  admin: { status: 200, body: { id: 'u1', email: 'admin@tfugen.local', is_anonymous: false } },
  anonymous: { status: 200, body: { id: 'a1', is_anonymous: true } },
  // a session that is anonymous but whose response omits the flag
  anonNoFlag: { status: 200, body: { id: 'a2' } },
  invalid: { status: 401, body: { error: 'bad jwt' } },
};

function world(kind) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    calls.push(u);
    if (u.startsWith(SB + '/auth/v1/user')) {
      const w = USERS[kind];
      return new Response(JSON.stringify(w.body), { status: w.status, headers: { 'Content-Type': 'application/json' } });
    }
    if (u.includes('graph.facebook.com')) return new Response(JSON.stringify({ messages: [{ id: 'wamid.1' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (u.includes('api.resend.com')) return new Response(JSON.stringify({ id: 'em_1' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (u.includes('api.anthropic.com')) return new Response(JSON.stringify({ content: [{ text: 'hi' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (u.startsWith(SB + '/rest/v1/')) return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
    throw new Error('unexpected fetch ' + u);
  };
  return calls;
}
const req = (body, token) => new Request(ORIGIN + '/api/x', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', origin: ORIGIN, ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body),
});

(async () => {
  const waSend = await load('functions/api/wa-send.js');
  const notify = await load('functions/api/trustee-notify.js');
  const ai = await load('functions/api/claude.js');

  console.log('\n1. wa-send — the factory’s verified WhatsApp number');
  {
    let calls = world('anonymous');
    let r = await waSend.onRequest({ request: req({ to: '972500000000', text: 'x' }, 'anon.jwt'), env: ENV });
    check('an ANONYMOUS session is refused with 403', r.status === 403, { status: r.status, body: await r.clone().json() });
    check('...and nothing reached Meta', !calls.some((u) => u.includes('graph.facebook.com')), calls);

    calls = world('anonNoFlag');
    r = await waSend.onRequest({ request: req({ to: '972500000000', text: 'x' }, 'anon2.jwt'), env: ENV });
    check('a session with no email is refused too, even without the is_anonymous flag', r.status === 403, r.status);

    calls = world('invalid');
    r = await waSend.onRequest({ request: req({ to: '972500000000', text: 'x' }, 'junk'), env: ENV });
    check('an invalid token is still 401', r.status === 401, r.status);

    r = await waSend.onRequest({ request: req({ to: '972500000000', text: 'x' }, null), env: ENV });
    check('no token at all is still 401', r.status === 401, r.status);

    calls = world('admin');
    r = await waSend.onRequest({ request: req({ to: '972500000000', text: 'x' }, 'admin.jwt'), env: ENV });
    check('a real signed-in user still gets through', r.status === 200, { status: r.status });
    check('...and the message did go to Meta', calls.some((u) => u.includes('graph.facebook.com')), calls);
  }

  console.log('\n2. trustee-notify — the test path takes an attacker-chosen recipient');
  {
    let calls = world('anonymous');
    let r = await notify.onRequest({ request: req({ test: true, whatsapp_to: '972500000000', email_to: 'x@y.z' }, 'anon.jwt'), env: ENV });
    check('an anonymous session is refused', r.status === 403, { status: r.status });
    check('...nothing sent through Meta or Resend', !calls.some((u) => /facebook|resend/.test(u)), calls);

    calls = world('admin');
    r = await notify.onRequest({ request: req({ test: true, whatsapp_to: '972500000000' }, 'admin.jwt'), env: ENV });
    check('the manager’s own test message still works', r.status === 200, { status: r.status });
  }

  console.log('\n3. /api/claude — was an open LLM proxy');
  {
    const body = { model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', max_tokens: 50, messages: [{ role: 'user', content: 'hi' }] };
    let calls = world('invalid');
    let r = await ai.onRequest({ request: req(body, null), env: ENV });
    check('an unauthenticated call is refused (it used to be answered)', r.status === 401, { status: r.status });

    calls = world('anonymous');
    r = await ai.onRequest({ request: req(body, 'anon.jwt'), env: ENV });
    check('an anonymous session is refused — the trustee screen has no AI controls', r.status === 403, { status: r.status });

    calls = world('admin');
    r = await ai.onRequest({ request: req(body, 'admin.jwt'), env: ENV });
    check('a signed-in user still reaches the model', r.status === 200, { status: r.status });
  }

  console.log('\n4. the client sends the token on every AI call');
  {
    const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const sites = src.match(/fetch\(_AI,\s*\{[\s\S]{0,200}?\}/g) || [];
    const withAuth = sites.filter((x) => /Authorization/.test(x));
    check('all ' + sites.length + ' fetch(_AI, ...) sites carry an Authorization header', sites.length > 0 && withAuth.length === sites.length, { total: sites.length, withAuth: withAuth.length });
  }

  console.log('\n5. the ownership migration is written, and says it has not been run');
  {
    const f = path.join(ROOT, 'migrations/2026-09-20_trustee_close_ownership.sql');
    check('the migration file exists', fs.existsSync(f));
    const sql = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
    check('it adds the ownership condition', /IS NOT DISTINCT FROM NEW\.u/.test(sql));
    check('it is marked NOT YET RUN, so nobody ticks it off by mistake', /NOT YET RUN/.test(sql));
    check('it carries a verification block to paste after running', /has_ownership_check/.test(sql));
  }

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
