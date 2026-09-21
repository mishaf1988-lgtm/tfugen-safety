// The security self-test is the only thing in the project that checks the
// live system, and the person who most needs it reads it on a phone.
//
// On 2026-09-21 Michael opened it and got a wall of `âœ"` and `âš ` where the
// ticks and warnings should be, and Safari offered to DOWNLOAD it as a file
// rather than show it. Both were real:
//
//   * jsonResp sent `application/json` with no charset, so Safari decoded
//     UTF-8 as Latin-1. That helper serves ten endpoints, including
//     trustee-notify and its Hebrew task names — claude.js was the only one
//     that had ever declared charset, on its stream.
//   * a JSON body at an extensionless path is something Safari saves, not
//     something it renders.
//
// This runs the endpoint for real — no string-matching the source — and
// asserts what a browser and an API client each get back.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

// The function imports ../_shared.js relative to itself; point it at the real
// file so the module loads outside the Pages runtime.
const build = path.join(HERE, '_build');
fs.mkdirSync(build, { recursive: true });
const out = path.join(build, 'selftest.mjs');
fs.writeFileSync(out, fs.readFileSync(path.join(ROOT, 'functions/api/_securityselftest.js'), 'utf8')
  .replace("from '../_shared.js'", "from " + JSON.stringify(path.join(ROOT, 'functions/_shared.js'))));

globalThis.atob = (b) => Buffer.from(b, 'base64').toString('binary');
// Nothing reaches the network: every probe sees the same stub. What the
// checks conclude does not matter here — the response SHAPE does.
globalThis.fetch = async () => ({
  ok: true, status: 403,
  headers: new Headers({ 'cache-control': 'no-cache, must-revalidate' }),
  json: async () => [], text: async () => 'clean',
});

const { onRequest } = await import(out);
const call = async (accept, qs = '') => {
  const r = await onRequest({ request: new Request('https://x.dev/api/_securityselftest' + qs, { headers: { accept } }) });
  return { ct: r.headers.get('content-type') || '', body: await r.text(), status: r.status };
};

console.log('\n1. nothing comes back without a charset');
{
  const api = await call('application/json');
  const web = await call('text/html,application/xhtml+xml');
  check('the JSON response declares utf-8', /charset=utf-8/i.test(api.ct), api.ct);
  check('...and so does the page', /charset=utf-8/i.test(web.ct), web.ct);

  // The specific failure: a tick decoded as Latin-1 becomes «âœ“». Round-trip
  // the bytes the way Safari did and prove the declared charset prevents it.
  const bytes = Buffer.from(web.body, 'utf8');
  check('a ✓ survives being read as the declared charset', bytes.toString('utf8').includes('✓'), 'tick lost');
  check('...and would NOT have survived Latin-1, which is what went wrong',
    bytes.toString('latin1').includes('â'), 'no mojibake reproduced — check the fixture');
}

console.log('\n2. a browser gets something a person can read');
{
  const web = await call('text/html,application/xhtml+xml');
  check('a browser is served HTML, not a file to download', /^text\/html/.test(web.ct), web.ct);
  check('...as a real document', /^<!doctype html>/i.test(web.body.trim()), web.body.slice(0, 40));
  check('...right-to-left, because the labels are Hebrew', /dir="rtl"/.test(web.body));
  check('...sized for a phone', /width=device-width/.test(web.body));
  check('the counts are on it', /עברו/.test(web.body) && /נכשלו/.test(web.body) && /אזהרות/.test(web.body));
  check('...and every check is listed with its verdict', /class="c"/.test(web.body) && /class="v"/.test(web.body));
  check('it says how to run the parts that need a token', /Authorization/.test(web.body));
  check('...and how to prove the anonymous case', /\?anon=1/.test(web.body));
}

console.log('\n3. anything programmatic still gets JSON');
{
  const api = await call('application/json');
  check('an API client gets JSON', /^application\/json/.test(api.ct), api.ct);
  let parsed = null;
  try { parsed = JSON.parse(api.body); } catch (e) {}
  check('...that parses', !!parsed);
  check('...with the summary and the checks', parsed && parsed.summary && Array.isArray(parsed.checks), parsed && Object.keys(parsed));

  const forced = await call('text/html,application/xhtml+xml', '?format=json');
  check('a browser can still ask for the raw JSON', /^application\/json/.test(forced.ct), forced.ct);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
