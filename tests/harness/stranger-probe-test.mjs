// What does somebody who only has the URL actually see?
//
// Michael, 2026-09-21: «כל האפליקציה חשופה לעולם». Everything the self-test
// checked until now answers "what does the CALLER see" -- which is a different
// question, and the one he asked had never been measured at all. The Storage
// hole of September was exactly this case: four policies granted to
// `authenticated`, and the day the trustee kiosk began signing in anonymously,
// "authenticated" came to include every visitor off the street. It sat in
// production for weeks because nothing ever asked.
//
// The probe answers it from the server, where the network actually reaches
// Supabase. Which makes the probe itself a map of what is exposed -- so the
// first thing this suite checks is that the map is not handed to strangers.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

const build = path.join(HERE, '_build');
fs.mkdirSync(build, { recursive: true });
const out = path.join(build, 'stranger.mjs');
fs.writeFileSync(out, fs.readFileSync(path.join(ROOT, 'functions/api/_securityselftest.js'), 'utf8')
  .replace("from '../_shared.js'", 'from ' + JSON.stringify(path.join(ROOT, 'functions/_shared.js'))));
globalThis.atob = (b) => Buffer.from(b, 'base64').toString('binary');
const { onRequest } = await import(out);

// A token whose payload decodes to an email, so the endpoint cannot be fooled
// into trusting the decode instead of asking Supabase.
const jwt = (obj) => 'a.' + Buffer.from(JSON.stringify(obj)).toString('base64url') + '.c';

// o.user        what /auth/v1/user answers   ('named' | 'anonymous' | 'bad')
// o.readable    table names a stranger CAN read, with a row count
// o.listable    buckets a stranger CAN list
// o.signup      does anonymous sign-in work
function world(o) {
  const calls = [];
  globalThis.fetch = async (u, init) => {
    const url = String(u);
    const hdrs = (init && init.headers) || {};
    calls.push({ url, auth: hdrs.Authorization || null, apikey: hdrs.apikey || null });
    if (url.includes('/auth/v1/user')) {
      if (o.user === 'bad') return { ok: false, status: 401, json: async () => ({}) };
      // A linked anonymous account carries an email. Without one here the
      // suite passed for the wrong reason: removing the is_anonymous check
      // entirely still gave 403, because the missing email blocked it.
      return { ok: true, status: 200, json: async () => (o.user === 'anonymous'
        ? { id: 'a1', email: 'kiosk@anon.local', is_anonymous: true }
        : { id: 'u1', email: 'mishaf1988@gmail.com', is_anonymous: false }) };
    }
    if (url.includes('/auth/v1/signup')) {
      return o.signup === false
        ? { ok: false, status: 422, json: async () => ({}) }
        : { ok: true, status: 200, json: async () => ({ access_token: 'anon-tok' }) };
    }
    if (url.includes('/rest/v1/')) {
      const t = url.split('/rest/v1/')[1].split('?')[0];
      const n = (o.readable || {})[t];
      if (n === undefined) return { ok: false, status: 401, headers: new Headers({}), json: async () => ({}) };
      return { ok: true, status: 200, headers: new Headers({ 'content-range': '0-0/' + n }),
        json: async () => [{ id: 'r1', name: 'PRIVATE-ROW-CONTENT' }] };
    }
    if (url.includes('/storage/v1/object/list/')) {
      const b = url.split('/list/')[1];
      const okList = (o.listable || []).includes(b);
      return okList
        ? { ok: true, status: 200, json: async () => [{ name: 'a.jpg' }] }
        : { ok: false, status: 400, json: async () => ({}) };
    }
    // The header checks of the ordinary run, if it ever gets there.
    return { ok: true, status: 200, headers: new Headers({}), json: async () => [], text: async () => '' };
  };
  return calls;
}

const call = async (qs, token) => {
  const headers = { accept: 'application/json' };
  if (token) headers.authorization = 'Bearer ' + token;
  const r = await onRequest({ request: new Request('https://x.dev/api/_securityselftest' + qs, { headers }) });
  let body = null;
  try { body = JSON.parse(await r.text()); } catch (e) { body = null; }
  return { status: r.status, body };
};

const NAMED = jwt({ email: 'mishaf1988@gmail.com' });

console.log('\n1. the map of what is exposed is not handed to strangers');
{
  world({ user: 'named' });
  const anon = await call('?stranger=1', null);
  check('no login: refused', anon.status === 401, anon);
  check('...and nothing about the data comes back', !anon.body || !anon.body.checks, anon.body);

  world({ user: 'bad' });
  const forged = await call('?stranger=1', jwt({ email: 'admin@tfugen.local' }));
  // The old code decoded the JWT and believed it. Anyone can write a JWT.
  check('a forged token is refused, not decoded and trusted', forged.status === 403, forged);

  world({ user: 'anonymous' });
  const kiosk = await call('?stranger=1', jwt({}));
  // The kiosk holds a real session. It must not be able to ask what sessions
  // like its own can reach.
  check('an anonymous session cannot ask what anonymous sessions see', kiosk.status === 403, kiosk);
}

console.log('\n2. it asks as a stranger, not as the caller');
{
  const calls = world({ user: 'named', readable: {} });
  await call('?stranger=1', NAMED);
  const probes = calls.filter((c) => c.url.includes('/rest/v1/'));
  check('it probed the tables (' + probes.length + ')', probes.length >= 15, probes.length);
  // The whole point. Probing with the admin's own token would measure the
  // admin's view and call it the stranger's.
  check('...with no Authorization header at all', probes.every((c) => !c.auth), probes.filter((c) => c.auth).map((c) => c.url));
  check('...and with the publishable key, which is what a visitor has',
    probes.every((c) => c.apikey), probes.filter((c) => !c.apikey).length);
}

console.log('\n3. it says which way round the answer is');
{
  world({ user: 'named', readable: {} });
  const clean = await call('?stranger=1', NAMED);
  const byId = (b, id) => (b.checks || []).find((c) => c.id === id);
  check('a table a stranger cannot read passes', byId(clean.body, 'anon:app_users').verdict === '✓', byId(clean.body, 'anon:app_users'));
  check('...and a bucket it cannot list passes',
    byId(clean.body, 'anon:storage/incidents-photos').verdict === '✓', byId(clean.body, 'anon:storage/incidents-photos'));

  world({ user: 'named', readable: { app_users: 12, med: 40 }, listable: ['incidents-photos'] });
  const leaky = await call('?stranger=1', NAMED);
  check('a readable staff table FAILS', byId(leaky.body, 'anon:app_users').verdict === '✗', byId(leaky.body, 'anon:app_users'));
  check('...so does readable medical data', byId(leaky.body, 'anon:med').verdict === '✗', byId(leaky.body, 'anon:med'));
  // This is the September hole, restaged.
  check('...and a listable photo bucket FAILS',
    byId(leaky.body, 'anon:storage/incidents-photos').verdict === '✗', byId(leaky.body, 'anon:storage/incidents-photos'));
  check('the summary counts the failures', leaky.body.summary.fail >= 3, leaky.body.summary);

  // A table the trustee screen needs without a login is not a finding. Calling
  // it one would bury the real ones in noise that is there every single run.
  world({ user: 'named', readable: { trustees: 8, trustee_tasks: 8, trustee_reports: 3 } });
  const byDesign = await call('?stranger=1', NAMED);
  check('a trustee table reads as a question, not a failure',
    byId(byDesign.body, 'anon:trustees').verdict === '⚠' && byDesign.body.summary.fail === 0, byId(byDesign.body, 'anon:trustees'));
  check('...and the reply says to confirm it is still wanted',
    /confirm/i.test(byDesign.body.note || ''), byDesign.body.note);
}

console.log('\n4. it reads counts, never contents');
{
  // Both readable AND listable, or "no row appears" is a check against an
  // empty array -- which is how this passed against a build that echoed them.
  world({ user: 'named', readable: { ncr: 375, med: 40 }, listable: ['incidents-photos', 'backups'] });
  const r = await call('?stranger=1', NAMED);
  const text = JSON.stringify(r.body);
  check('the counts are reported', /375 rows/.test(text), text.slice(0, 200));
  // A diagnostics endpoint that echoes rows to prove they were readable would
  // be the disclosure it went looking for.
  check('...and no table row appears in the reply', !/PRIVATE-ROW-CONTENT/.test(text), text.slice(0, 300));
  check('...nor any file name', !/a\.jpg/.test(text), text.slice(0, 300));
}

console.log('\n5. the second stranger costs a user, so it is asked for');
{
  const calls = world({ user: 'named', readable: {} });
  const off = await call('?stranger=1', NAMED);
  check('by default no anonymous user is created',
    !calls.some((c) => c.url.includes('/auth/v1/signup')), calls.filter((c) => c.url.includes('signup')).length);
  const skipped = (off.body.checks || []).find((c) => c.id === 'anonymous_session');
  check('...and it says so rather than pretending it covered it', /skipped/i.test(skipped.got), skipped);

  const calls2 = world({ user: 'named', readable: { med: 3 } });
  const on = await call('?stranger=1&anon=1', NAMED);
  check('with anon=1 it signs in', calls2.some((c) => c.url.includes('/auth/v1/signup')), true);
  const sess = (on.body.checks || []).filter((c) => /^anonymous:/.test(c.id));
  check('...and probes again as that session (' + sess.length + ')', sess.length >= 10, sess.length);
  const sessProbes = calls2.filter((c) => c.url.includes('/rest/v1/') && c.auth);
  check('...this time WITH the session token', sessProbes.length >= 10, sessProbes.length);
  check('...and a leak found that way fails too',
    (on.body.checks || []).find((c) => c.id === 'anonymous:med').verdict === '✗',
    (on.body.checks || []).find((c) => c.id === 'anonymous:med'));

  world({ user: 'named', readable: {}, signup: false });
  const noSignup = await call('?stranger=1&anon=1', NAMED);
  const s = (noSignup.body.checks || []).find((c) => c.id === 'anonymous_session');
  check('anonymous sign-in being off is reported, not treated as a pass', s && s.verdict === '⚠', s);
}

console.log('\n6. it fits in one request');
{
  // Cloudflare gives a Worker 50 subrequests. A probe that dies two thirds of
  // the way through does not report "incomplete" -- it reports whatever it
  // managed, which reads exactly like a clean result.
  const calls = world({ user: 'named', readable: {} });
  await call('?stranger=1&anon=1', NAMED);
  check('both strangers together stay under the limit (' + calls.length + ' subrequests)',
    calls.length < 40, calls.length);
}

console.log('\n7. the ordinary self-test is untouched');
{
  world({ user: 'named', readable: {} });
  const plain = await call('', null);
  check('it still runs with no token', plain.status === 200, plain.status);
  check('...and still reports the header checks',
    (plain.body.checks || []).some((c) => c.id === 'csp_present'), (plain.body.checks || []).map((c) => c.id).slice(0, 5));
  check('...without probing any table', !(plain.body.checks || []).some((c) => /^anon:/.test(c.id)), 'probe leaked into the default run');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
