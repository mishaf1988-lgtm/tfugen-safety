// Only from Israel.
//
// Michael, 2026-09-21: «צריך שהמערכת תהיה נגישה רק מישראל בלבד ולא מכל
// העולם». Every request to the site now passes through the middleware and is
// answered by the country Cloudflare resolved for the caller.
//
// Two things this suite cares about more than the blocking itself, because
// they are the ways a geo rule does harm rather than good:
//
//   * It must not break the alert pipeline. Supabase calls /api/trustee-notify
//     from Supabase's own servers, which are not in Israel. Block that and a
//     trustee's hazard report saves and nobody is ever told -- the failure is
//     silent and it is the exact failure the whole system exists to prevent.
//   * It must not lock the plant out. A country Cloudflare could not resolve
//     is allowed through on purpose, and the list lives in an environment
//     variable so a lockout is fixed from a phone in thirty seconds.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

const { onRequest } = await import(path.join(ROOT, 'functions/_middleware.js'));

// o.country  what Cloudflare resolved, or null for "could not tell"
// o.env      Pages environment variables
// o.path     the path asked for
const call = async (o) => {
  let served = 0;
  const req = new Request('https://tapugan-safety.pages.dev' + (o.path || '/'));
  if (o.country !== null) Object.defineProperty(req, 'cf', { value: { country: o.country } });
  const res = await onRequest({
    request: req,
    env: o.env || {},
    next: async () => { served++; return new Response('THE APP', { headers: { 'Content-Type': 'text/html' } }); }
  });
  return { served, status: res.status, body: await res.text(), headers: res.headers };
};

console.log('\n1. from Israel, nothing changes');
{
  const r = await call({ country: 'IL' });
  check('the app is served', r.served === 1 && r.body === 'THE APP', r);
  check('...with a normal status', r.status === 200, r.status);
}

console.log('\n2. from anywhere else, the door is shut');
{
  const r = await call({ country: 'US' });
  check('the app is never reached', r.served === 0, r.served);
  check('...and the answer is a refusal', r.status === 403, r.status);
  check('...in Hebrew, so the person in front of it understands', /ישראל בלבד/.test(r.body), r.body.slice(0, 120));
  // A refusal page is a page a stranger sees. It should not describe the
  // system, and it should not end up in a search result either.
  check('...saying nothing about what is behind it',
    !/supabase|tapugan-safety|admin|login/i.test(r.body), r.body.slice(0, 400));
  check('...and not indexable', /noindex/.test(r.body), 'no robots meta');
  const ru = await call({ country: 'RU' });
  check('another country, same answer', ru.status === 403 && ru.served === 0, ru.status);
}

console.log('\n3. Tor is named, not left to the general rule');
{
  // T1 is Cloudflare's label for a Tor exit.
  const r = await call({ country: 'T1' });
  check('a Tor exit is blocked', r.status === 403 && r.served === 0, r);
  // The general rule already refuses T1, so that check alone passes against a
  // build with no Tor handling at all -- it did. What the explicit line buys
  // is this: a list widened carelessly still does not let Tor in.
  const widened = await call({ country: 'T1', env: { ALLOWED_COUNTRIES: 'IL,T1' } });
  check('...even if somebody puts T1 in the allowed list', widened.status === 403 && widened.served === 0, widened);
}

console.log('\n4. a country that could not be resolved is let through');
{
  // Deliberate, and the weaker choice. Locking the safety manager out of a
  // hazard report because a geo lookup hiccuped is worse than a stranger
  // reaching a password prompt.
  const r = await call({ country: null });
  check('no cf object at all: served', r.served === 1, r);
  const r2 = await call({ country: undefined });
  check('cf present but country missing: served', r2.served === 1, r2);
}

console.log('\n5. the alert pipeline is not geo-blocked');
{
  // Supabase calls this from its own servers, which are not in Israel. This
  // is the case where a geo rule does real damage: the report saves, the
  // alert never goes out, and nothing says so.
  const r = await call({ country: 'US', path: '/api/trustee-notify' });
  check('Supabase can still reach the notifier from abroad', r.served === 1 && r.status === 200, r);
  const d = await call({ country: 'DE', path: '/api/trustee-notify' });
  check('...from any country, since the region is not ours to choose', d.served === 1, d);
  // Everything else under /api is called by a browser and stays behind the gate.
  const other = await call({ country: 'US', path: '/api/wa-send' });
  check('but the browser endpoints stay behind the gate', other.status === 403 && other.served === 0, other);
}

console.log('\n6. the list is changeable without a deploy');
{
  const r = await call({ country: 'US', env: { ALLOWED_COUNTRIES: 'IL,US' } });
  check('adding a country in Cloudflare lets it in', r.served === 1, r);
  const messy = await call({ country: 'US', env: { ALLOWED_COUNTRIES: ' il , us ' } });
  check('...spacing and case do not matter', messy.served === 1, messy);
  const narrowed = await call({ country: 'IL', env: { ALLOWED_COUNTRIES: 'US' } });
  check('...and it really is the list, not a hardcoded IL', narrowed.status === 403, narrowed);
  const empty = await call({ country: 'US', env: { ALLOWED_COUNTRIES: '' } });
  check('an empty value falls back to Israel rather than opening up', empty.status === 403, empty);
}

console.log('\n7. the May hardening survives the new route');
{
  // Everything now goes through a Function. Headers from _headers apply to
  // static assets, and a response handed back through next() should keep
  // them -- but the security review put them there and this does not rely on
  // finding out later that they went missing.
  const ok = await call({ country: 'IL' });
  ['X-Content-Type-Options', 'X-Robots-Tag', 'X-Frame-Options', 'Referrer-Policy',
    'Strict-Transport-Security'].forEach(function (h) {
    check('served pages carry ' + h, !!ok.headers.get(h), h + ' missing');
  });
  const no = await call({ country: 'US' });
  check('and so does the refusal page', !!no.headers.get('X-Content-Type-Options') && !!no.headers.get('X-Robots-Tag'), 'missing on 403');
  check('...which is never cached', /no-store/.test(no.headers.get('Cache-Control') || ''), no.headers.get('Cache-Control'));
}

console.log('\n8. the router sends everything here, and nothing is swallowed');
{
  const routes = JSON.parse(fs.readFileSync(path.join(ROOT, '_routes.json'), 'utf8'));
  // The gate is worthless if index.html is served without passing through it.
  check('every path is routed through Functions', (routes.include || []).indexOf('/*') >= 0, routes.include);
  // Which is only safe because the middleware hands static files on. The old
  // worry -- that the router would swallow robots.txt -- becomes this check.
  const rb = await call({ country: 'IL', path: '/robots.txt' });
  check('robots.txt is still served', rb.served === 1 && rb.status === 200, rb);
  const sw = await call({ country: 'IL', path: '/sw.js' });
  check('...and so is the service worker', sw.served === 1, sw);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
