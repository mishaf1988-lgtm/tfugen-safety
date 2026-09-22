// The shared code on the trustee screen -- the server half.
//
// Michael, 2026-09-21: one code for everybody, chosen knowing it is a
// curtain and not a lock. What this suite holds it to is everything that
// makes the difference between a curtain and a bead curtain: the code is
// never in the page, a wrong guess is slow, an unset code is a closed door,
// and it is compared for real rather than with an ==.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

const build = path.join(HERE, '_build');
fs.mkdirSync(build, { recursive: true });
const out = path.join(build, 'trustee-gate.mjs');
fs.writeFileSync(out, fs.readFileSync(path.join(ROOT, 'functions/api/trustee-gate.js'), 'utf8')
  .replace("from '../_shared.js'", 'from ' + JSON.stringify(path.join(ROOT, 'functions/_shared.js'))));
const { onRequest } = await import(out);

const ORIGIN = 'https://tapugan-safety.pages.dev';
const call = async (o) => {
  const headers = { 'Content-Type': 'application/json' };
  if (o.origin !== null) headers.origin = o.origin || ORIGIN;
  const req = new Request(ORIGIN + '/api/trustee-gate', {
    method: o.method || 'POST', headers,
    body: o.method === 'GET' ? undefined : (o.raw !== undefined ? o.raw : JSON.stringify({ code: o.code })),
  });
  const t0 = Date.now();
  const r = await onRequest({ request: req, env: o.env || { TRUSTEE_CODE: '482913' } });
  let body = null; try { body = JSON.parse(await r.text()); } catch (e) { body = null; }
  return { status: r.status, body, ms: Date.now() - t0 };
};

console.log('\n1. the right code opens the door');
{
  const r = await call({ code: '482913' });
  check('a correct code is accepted', r.status === 200 && r.body && r.body.ok === true, r);
  check('...quickly, with no punishment delay', r.ms < 300, r.ms);
  const spaced = await call({ code: '  482913 ' });
  check('...and a code typed with stray spaces still works', spaced.status === 200, spaced);
  // Whether the phone may keep the code is a plant policy, so the server says
  // so rather than each phone deciding. Michael asked for every open to ask.
  // 2026-09-22: the default flipped. Remembering used to be a plant policy that
  // defaulted to off; Michael asked for the trustee to choose with a tick box, so
  // the server now answers 'permitted' unless TRUSTEE_REMEMBER=0 forbids it. The
  // phone still stores nothing unless the box was ticked — see the client suite.
  check('...and by default the phone is PERMITTED to remember, the box decides', r.body.remember === true && r.body.allowRemember === true, r.body);
  const keep = await call({ code: '482913', env: { TRUSTEE_CODE: '482913', TRUSTEE_REMEMBER: '1' } });
  check('TRUSTEE_REMEMBER=1 turns it back on without a code change', keep.body.remember === true, keep.body);
  const other = await call({ code: '482913', env: { TRUSTEE_CODE: '482913', TRUSTEE_REMEMBER: 'yes' } });
  const forbidden = await call({ code: '482913', env: { TRUSTEE_CODE: '482913', TRUSTEE_REMEMBER: '0' } });
  check('...and a stray value does not forbid it', other.body.remember === true && other.body.allowRemember === true, other.body);
  check('...while TRUSTEE_REMEMBER=0 does, and the box is not offered', forbidden.body.remember === false && forbidden.body.allowRemember === false, forbidden.body);
}

console.log('\n2. a wrong code is refused, and slowly');
{
  const r = await call({ code: '000000' });
  check('it is refused', r.status === 403, r);
  // Not a rate limit -- a Worker keeps no state without KV -- but one guess
  // per second per connection instead of one per millisecond.
  check('...after a wait (' + r.ms + 'ms)', r.ms >= 700, r.ms);
  check('...with a message in Hebrew, not a stack trace', /קוד שגוי/.test((r.body && r.body.message) || ''), r.body);
  const near = await call({ code: '482914' });
  check('one digit off is still wrong', near.status === 403, near);
  const prefix = await call({ code: '4829' });
  check('...and so is a prefix of the real code', prefix.status === 403, prefix);
  const longer = await call({ code: '4829130' });
  check('...and the real code with something appended', longer.status === 403, longer);
}

console.log('\n3. nothing to guess is not the same as anything goes');
{
  const empty = await call({ code: '' });
  check('an empty code is refused', empty.status === 403, empty);
  const missing = await call({ raw: '{}' });
  check('...and so is a body with no code at all', missing.status === 403, missing);
  const junk = await call({ raw: 'not json' });
  check('...and a body that is not JSON', junk.status === 403, junk);
}

console.log('\n4. an unset code is a closed door');
{
  // A lock that defaults to open is not a lock. Nobody is using the trustee
  // screen yet, so closed costs nothing and says exactly what to do.
  const r = await call({ code: 'anything', env: {} });
  check('with TRUSTEE_CODE unset, nothing gets in', r.status === 503, r);
  check('...and it says the code was not set up', /לא הוגדר/.test((r.body && r.body.message) || ''), r.body);
  const blank = await call({ code: '', env: { TRUSTEE_CODE: '   ' } });
  check('a code that is only spaces counts as unset', blank.status === 503, blank);
}

console.log('\n5. the usual gates');
{
  const get = await call({ method: 'GET' });
  check('GET is not a way to ask', get.status === 405, get.status);
  const elsewhere = await call({ code: '482913', origin: 'https://evil.example' });
  check('a call from another site is refused', elsewhere.status === 403, elsewhere);
  const none = await call({ code: '482913', origin: null });
  check('...and so is one with no origin at all', none.status === 403, none);
}

console.log('\n6. the code is not in the page');
{
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  check('index.html never mentions TRUSTEE_CODE', html.indexOf('TRUSTEE_CODE') < 0, 'it does');
  check('...and only ever asks the server', /\/api\/trustee-gate/.test(html), 'no call to the gate');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
