// The owner's signature screen (21/10/2026, /api/owner-sig): only the owner account (SITE.adminEmail) reads
// the status or saves a drawn PNG, into the private bucket at backups/owner-signature/sig.png; any other user,
// admin or not, gets 403. fetch is mocked; the PNG below is made up.
import fs from 'fs';
import { onRequest, sigCheck, isOwner, SIG_PATH, SIG_MIN } from './_build/owner-sig.mjs';
import { SITE } from './_build/_site.mjs';

let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 300) : '')); } };
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co', ORIGIN = 'https://tapugan-safety.pages.dev';
const png = (n) => { const b = Buffer.alloc(n, 7); Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b); return 'data:image/png;base64,' + b.toString('base64'); };

let who = 'owner', uploads = [], logs = [], info = 404;
globalThis.fetch = async (u, o = {}) => {
  const json = (j, s) => new Response(JSON.stringify(j), { status: s || 200 });
  if (u.startsWith(SB + '/auth/v1/user')) return who === 'owner' ? json({ id: 'u0', email: SITE.adminEmail }) : json({ id: 'u1', email: 'someone@' + SITE.loginDomain });
  if (u.startsWith(SB + '/storage/v1/object/info/')) return info === 200 ? json({ updated_at: '2026-10-21T18:00:00Z' }) : json({ error: 'not found' }, info);
  if (u.startsWith(SB + '/storage/v1/object/')) { uploads.push({ u, h: o.headers, n: o.body.length }); return json({ Key: SIG_PATH }); }
  if (u.startsWith(SB + '/rest/v1/notifications_log')) { logs.push(JSON.parse(o.body)); return new Response('', { status: 201 }); }
  return json({ error: 'unexpected ' + u }, 500);
};
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'srv' };
const req = (method, op, body) => new Request('https://tapugan-safety.pages.dev/api/owner-sig?op=' + op, { method,
  headers: { Origin: ORIGIN, Authorization: 'Bearer t', 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
const call = async (method, op, body) => { const r = await onRequest({ request: req(method, op, body), env: ENV }); return { st: r.status, j: await r.json() }; };

(async () => {
  console.log('1. the PNG check');
  check('a real PNG passes', !!sigCheck(png(2000)).bytes);
  check('not a data URL, a JPEG, too small or too large: refused', !!sigCheck('abc').error && !!sigCheck(png(2000).replace('image/png', 'image/jpeg')).error && !!sigCheck(png(SIG_MIN - 1)).error && !!sigCheck(png(400 * 1024)).error);
  check('PNG header required', !!sigCheck('data:image/png;base64,' + Buffer.alloc(2000, 1).toString('base64')).error);

  console.log('2. only the owner account');
  check('isOwner: the owner email, any case', isOwner({ email: SITE.adminEmail.toUpperCase() }) && !isOwner({ email: 'x@' + SITE.loginDomain }));
  who = 'other';
  const r1 = await call('POST', 'set', { png: png(2000) });
  check('another user (an admin too) cannot save: 403, nothing uploaded', r1.st === 403 && uploads.length === 0, r1);
  const r2 = await call('GET', 'status');
  check('another user cannot read the status either', r2.st === 403, r2);

  console.log('3. the owner');
  who = 'owner';
  const s0 = await call('GET', 'status');
  check('no signature yet: set false', s0.st === 200 && s0.j.set === false, s0);
  const r3 = await call('POST', 'set', { png: png(3000) });
  check('saved to the private path, PNG, upsert', r3.st === 200 && r3.j.ok && uploads.length === 1 && uploads[0].u.endsWith('/storage/v1/object/' + SIG_PATH) && uploads[0].h['Content-Type'] === 'image/png' && uploads[0].h['x-upsert'] === 'true' && uploads[0].n === 3000, { r3, uploads });
  check('the path is in the private bucket that _sign.js reads', SIG_PATH === 'backups/owner-signature/sig.png');
  check('one log line, without the image', logs.length === 1 && logs[0][0].event_type === 'owner_sign' && !JSON.stringify(logs[0]).includes('base64'), logs);
  info = 200;
  const s1 = await call('GET', 'status');
  check('after saving: set true with a date', s1.j.set === true && !!s1.j.at, s1);
  const r4 = await call('POST', 'set', { png: 'nope' });
  check('a bad image: 400, nothing more uploaded', r4.st === 400 && uploads.length === 1, r4);

  console.log('4. the app');
  const html = fs.readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  check('the card, hidden by default, with a canvas and a save button', /id="osig-card" style="display:none/.test(html) && /id="osig-pad"/.test(html) && /onclick="_osigSave\(\)"/.test(html));
  check('the app calls /api/owner-sig and shows the card only to the owner', html.includes("'/api/owner-sig?op='") && /function _osigIsOwner\(\)[^\n]*ADMIN_EMAIL/.test(html));
  check('the users page loads it', /_codesLoad\(\);\n\s*_osigLoad\(\);/.test(html));

  console.log('\nowner-sig-test: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
