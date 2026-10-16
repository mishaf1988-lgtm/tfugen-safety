// A preview build runs against the test database and reaches nothing real (16/10/2026,
// Michael: "a development and test environment"; project-files/staging/README.md).
// Michael added STAGING_SUPABASE_URL and STAGING_SUPABASE_SERVICE_ROLE_KEY to the shared
// variable table (the Preview selector did not show on his phone), so the middleware swaps
// them in for preview hosts only. What must hold:
//   * production is untouched: same env, same geo rule, the machine paths still open;
//   * a preview with the STAGING_ variables: env points at the test database, every secret
//     that reaches the outside world is empty, and US (Claude's cloud) may test it;
//   * a preview WITHOUT them answers /api/* with 503: never the live database.
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };
const { onRequest, PREVIEW_STRIP } = await import(path.join(ROOT, 'functions/_middleware.js'));

const LIVE = 'https://znhjtpcltrxxyfjczgvw.supabase.co', TEST = 'https://ldzbjbsumzqjyvtpiwqo.supabase.co';
const realEnv = () => ({
  SUPABASE_URL: LIVE, SUPABASE_SERVICE_ROLE_KEY: 'live-key', ALLOWED_COUNTRIES: 'IL',
  STAGING_SUPABASE_URL: TEST, STAGING_SUPABASE_SERVICE_ROLE_KEY: 'test-key',
  META_ACCESS_TOKEN: 'wa', META_PHONE_NUMBER_ID: '1', META_WABA_ID: '2', RESEND_KEY: 'rs', VITRE_API_KEY_ID: 'v', VITRE_API_KEY_SECRET: 'vs',
  VITRE_PHOTO_KEY: 'vp', ONEDRIVE_CLIENT_ID: 'od', ONEDRIVE_CLIENT_SECRET: 'ods', ONEDRIVE_TENANT_ID: 'odt', GH_SKILLS_TOKEN: 'gh',
  ROUTINE_KEY: 'rk', TRUSTEE_NOTIFY_SECRET: 'tn', GEMINI_API_KEY: 'g',
});
const call = async (host, p, country, env) => {
  let seen = null;
  const req = new Request('https://' + host + p, { method: 'GET' });
  if (country) Object.defineProperty(req, 'cf', { value: { country } });
  const res = await onRequest({ request: req, env, next: async () => { seen = Object.assign({}, env); return new Response('OK', { headers: { 'Content-Type': 'text/plain' } }); } });
  return { status: res.status, seen, body: await res.text() };
};

console.log('\n1. production: nothing changes');
{
  const env = realEnv();
  const r = await call('tapugan-safety.pages.dev', '/api/hazard-report', 'IL', env);
  check('the live database and the live key reach the Function', r.status === 200 && r.seen.SUPABASE_URL === LIVE && r.seen.SUPABASE_SERVICE_ROLE_KEY === 'live-key', r.seen && r.seen.SUPABASE_URL);
  check('outside secrets untouched', r.seen && r.seen.META_ACCESS_TOKEN === 'wa' && r.seen.RESEND_KEY === 'rs' && r.seen.ONEDRIVE_CLIENT_SECRET === 'ods');
  check('from the US: still blocked', (await call('tapugan-safety.pages.dev', '/', 'US', realEnv())).status === 403);
  check('machine path (pg_net from Supabase, outside Israel): still open', (await call('tapugan-safety.pages.dev', '/api/trustee-notify', 'US', realEnv())).status === 200);
}

console.log('\n2. a preview with the STAGING_ variables');
{
  const env = realEnv();
  const r = await call('a1b2c3.tapugan-safety.pages.dev', '/api/hazard-report', 'IL', env);
  check('the Function sees the test database and the test key', r.status === 200 && r.seen.SUPABASE_URL === TEST && r.seen.SUPABASE_SERVICE_ROLE_KEY === 'test-key', r.seen && r.seen.SUPABASE_URL);
  check('every outside secret is empty (' + PREVIEW_STRIP.length + ')', r.seen && PREVIEW_STRIP.every((k) => !r.seen[k]), r.seen && PREVIEW_STRIP.filter((k) => r.seen[k]));
  check('the AI key stays (a test may call Gemini)', r.seen && r.seen.GEMINI_API_KEY === 'g');
  check('Claude from the US may test it', (await call('a1b2c3.tapugan-safety.pages.dev', '/', 'US', realEnv())).status === 200);
  check('a Tor exit still may not', (await call('a1b2c3.tapugan-safety.pages.dev', '/', 'T1', realEnv())).status === 403);
  check('a machine path on a preview is not a bypass: it runs against the test database, with its secret emptied', (await call('a1b2c3.tapugan-safety.pages.dev', '/api/trustee-notify', 'US', realEnv())).seen.TRUSTEE_NOTIFY_SECRET === '');
}

console.log('\n3. a preview that cannot be made safe answers nothing');
{
  const noVars = realEnv(); delete noVars.STAGING_SUPABASE_URL;
  let r = await call('a1b2c3.tapugan-safety.pages.dev', '/api/hazard-report', 'IL', noVars);
  check('no STAGING_SUPABASE_URL: /api/* 503, the Function never runs', r.status === 503 && r.seen === null, r.status);
  check('...the 503 names what is missing, no value', /missing: STAGING_SUPABASE_URL/.test(r.body) && !/test-key|live-key/.test(r.body), r.body);
  const liveAsTest = realEnv(); liveAsTest.STAGING_SUPABASE_URL = LIVE;
  r = await call('a1b2c3.tapugan-safety.pages.dev', '/api/hazard-report', 'IL', liveAsTest);
  check('STAGING_SUPABASE_URL set to the LIVE project by mistake: 503', r.status === 503 && r.seen === null, r.status);
  const frozen = Object.freeze(realEnv());
  r = await call('a1b2c3.tapugan-safety.pages.dev', '/api/hazard-report', 'IL', frozen);
  check('env that cannot be changed: 503, not the live database', r.status === 503 && r.seen === null, r.status);
  check('...and says why', /env is read-only/.test(r.body), r.body);
  check('...and from the US that preview stays blocked (no US without staging)', (await call('a1b2c3.tapugan-safety.pages.dev', '/', 'US', noVars)).status === 403);
}

console.log('\n4. look-alike hosts are production rules, not preview');
{
  const r = await call('tapugan-safety.pages.dev.evil.com', '/', 'US', realEnv());
  check('"tapugan-safety.pages.dev.evil.com" from the US: blocked like production', r.status === 403, r.status);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
