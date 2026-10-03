// Weekly talk, stage 2 (03/10/2026): the worker's signed link. Runs the real
// talk.js and _closelink.js with fetch mocked (Supabase REST, Storage sign and
// upload, the auth/user and app_users role lookups).
import { onRequest, makeTalkToken, readTalkToken, sigBytes, deviceOf, TALK_TTL_DAYS } from './_build/talk.mjs';
import { makeCloseToken, readCloseToken } from './_build/_closelink.mjs';

let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const URL0 = 'https://tapugan-safety.pages.dev/api/talk';
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'srv', TRUSTEE_NOTIFY_SECRET: 'nsec' };
const PUB = { id: 'tt1', d: '2026-10-04', title: 'עבודה <b>בגובה</b>', body: 'רתמה\nעיגון', file_url: SB + '/storage/v1/object/public/incidents-photos/tb-1.pdf', s: 'פורסמה' };
const DRAFT = { id: 'tt2', d: '2026-10-11', title: 'טיוטה', body: 'x', s: 'טיוטה' };
const EMPS = [{ id: 'e1', n: 'אחמד כהן', dep: 'ייצור' }, { id: 'e2', n: 'דנה <לוי>', dep: 'אחזקה' }, { id: 'e3', n: 'בלי מחלקה', dep: null }];
// A real-looking PNG of 1KB: header + padding.
const png = new Uint8Array(1024); png.set([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], 0);
const SIG = 'data:image/png;base64,' + Buffer.from(png).toString('base64');

function world(o) {
  o = o || {};
  const w = { inserts: [], uploads: [], signs: 0, reads: (o.reads || []).slice() };
  globalThis.fetch = async (url, init) => {
    const u = String(url), m = (init && init.method) || 'GET', body = init && init.body;
    const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
    if (u.startsWith(SB + '/rest/v1/toolbox_talks')) { const id = decodeURIComponent((u.match(/id=eq\.([^&]+)/) || [])[1] || ''); return json([PUB, DRAFT].filter((t) => t.id === id)); }
    if (u.startsWith(SB + '/rest/v1/emp')) return o.empFail ? new Response('x', { status: 503 }) : json(EMPS);
    if (u.startsWith(SB + '/rest/v1/toolbox_reads')) {
      if (m === 'POST') { const r = JSON.parse(body); w.inserts.push(r); if (o.insert409) return new Response('dup', { status: 409 }); w.reads.push(r); return new Response(null, { status: 201 }); }
      const t = decodeURIComponent(u.match(/talk_id=eq\.([^&]+)/)[1]), e = decodeURIComponent(u.match(/emp_id=eq\.([^&]+)/)[1]);
      return json(w.reads.filter((r) => r.talk_id === t && r.emp_id === e).map((r) => ({ id: r.id })));
    }
    if (u.startsWith(SB + '/storage/v1/object/sign/incidents-photos/')) { w.signs++; return json({ signedURL: '/object/sign/incidents-photos/tb-1.pdf?token=abc' }); }
    if (u.startsWith(SB + '/storage/v1/object/incidents-photos/')) { w.uploads.push({ u, type: init.headers['Content-Type'], n: body.length, upsert: init.headers['x-upsert'] }); return o.uploadFail ? new Response('x', { status: 500 }) : json({ Key: 'x' }); }
    if (u === SB + '/auth/v1/user') { const tok = init.headers.Authorization.replace('Bearer ', ''); return tok === 'good' ? json({ id: 'u1', email: 'michael@tfugen.local' }) : tok === 'rep' ? json({ id: 'u2', email: 'rep@tfugen.local' }) : new Response('no', { status: 401 }); }
    if (u.startsWith(SB + '/rest/v1/app_users')) return json([u.includes('id=eq.michael') ? { role: 'מנהל', active: true } : { role: 'מדווח', active: true }]);
    return json({ error: 'unexpected ' + u }, 599);
  };
  return w;
}
const get = (k, env) => onRequest({ request: new Request(URL0 + '?k=' + encodeURIComponent(k)), env: env || ENV });
function post(fields, ua) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return onRequest({ request: new Request(URL0, { method: 'POST', body: fd, headers: { 'user-agent': ua || 'Mozilla/5.0 (iPhone) Mobile' } }), env: ENV });
}
const link = (body, auth, origin) => onRequest({ request: new Request(URL0, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json', Origin: origin || 'https://tapugan-safety.pages.dev', ...(auth ? { Authorization: 'Bearer ' + auth } : {}) } }), env: ENV });

console.log('\n1. the signed link');
{
  const tok = await makeTalkToken(ENV, 'tt1');
  check('a token reads back to its talk', (await readTalkToken(ENV, tok)).id === 'tt1');
  check('valid ' + TALK_TTL_DAYS + ' days, then expired', (await readTalkToken(ENV, tok, Date.now() + (TALK_TTL_DAYS + 1) * 864e5)).error === 'expired');
  const tampered = tok.replace(/^tt1/, 'tt2');
  check('another talk id with the same signature is refused', (await readTalkToken(ENV, tampered)).error === 'bad');
  const close = await makeCloseToken(ENV, 'tt1');
  check('a hazard-close token does not open a talk, and back', (await readTalkToken(ENV, close)).error === 'bad' && (await readCloseToken(ENV, tok)).error === 'bad');
  check('close tokens still work as before', (await readCloseToken(ENV, close)).id === 'tt1');
  check('no secret, no token', (await makeTalkToken({}, 'tt1')) === null);
}

console.log('\n2. the page');
{
  const w = world();
  const tok = await makeTalkToken(ENV, 'tt1');
  const r = await get(tok); const h = await r.text();
  check('200 for a published talk', r.status === 200, r.status);
  check('title and body escaped', h.includes('עבודה &lt;b&gt;בגובה&lt;/b&gt;') && h.includes('רתמה\nעיגון') && !h.includes('<b>בגובה'));
  check('names grouped by department, escaped; no-department under "אחר"', h.includes('<optgroup label="אחזקה"><option value="e2">דנה &lt;לוי&gt;</option>') && h.includes('<optgroup label="אחר"><option value="e3">'));
  check('date DD/MM/YYYY', h.includes('04/10/2026'));
  check('the file gets a signed link (private bucket)', w.signs === 1 && h.includes(SB + '/storage/v1/object/sign/incidents-photos/tb-1.pdf?token=abc'));
  check('script only with the nonce in the CSP', /script-src 'nonce-([a-z0-9]+)'/.test(r.headers.get('content-security-policy')) && h.includes('<script nonce="' + r.headers.get('content-security-policy').match(/nonce-([a-z0-9]+)/)[1] + '">'));
  check('no-store, no referrer, no index', r.headers.get('cache-control') === 'no-store' && r.headers.get('referrer-policy') === 'no-referrer' && /noindex/.test(r.headers.get('x-robots-tag')));
  check('the page reveals nothing about who signed', !/toolbox_reads|חתמו/.test(h));
  const d = await get(await makeTalkToken(ENV, 'tt2'));
  check('a draft is not shown', d.status === 404 && !(await d.text()).includes('טיוטה</h2>'));
  check('a bad token: 403', (await get('tt1.zzz.bad')).status === 403);
  check('an expired token: 410', (await get(await makeTalkToken(ENV, 'tt1', Date.now() - 20 * 864e5))).status === 410);
  world({ empFail: true });
  check('a DB error is a page, not a crash', (await get(tok)).status === 500);
}

console.log('\n3. signing');
{
  const tok = await makeTalkToken(ENV, 'tt1');
  let w = world();
  let r = await post({ k: tok, emp: 'e1', ok: '1', sig: SIG }); let h = await r.text();
  check('signed: 200 and the worker is thanked by name', r.status === 200 && h.includes('אחמד כהן'), r.status);
  check('one PNG upload, no upsert, named sig-<talk>-<emp>-', w.uploads.length === 1 && w.uploads[0].type === 'image/png' && w.uploads[0].upsert === 'false' && /\/sig-tt1-e1-[a-z0-9]+\.png$/.test(w.uploads[0].u), w.uploads);
  const row = w.inserts[0];
  check('one row in toolbox_reads with the worker from the DB, not from the form', row && row.talk_id === 'tt1' && row.emp_id === 'e1' && row.emp_name === 'אחמד כהן' && row.dept === 'ייצור' && row.lang === 'he', row);
  check('sig_url in the app\'s public-path form', row && row.sig_url.startsWith(SB + '/storage/v1/object/public/incidents-photos/sig-tt1-e1-'));
  check('device from the browser: phone', row && row.device === 'phone');
  check('"next worker" link back to the same talk (shared tablet)', h.includes('/api/talk?k=' + encodeURIComponent(tok)));
  r = await post({ k: tok, emp: 'e1', ok: '1', sig: SIG }); h = await r.text();
  check('second signature by the same worker: "already signed", nothing written', /כבר חתמת/.test(h) && w.uploads.length === 1 && w.inserts.length === 1);
  w = world({ insert409: true });
  r = await post({ k: tok, emp: 'e2', ok: '1', sig: SIG });
  check('a race caught by the unique index (409) is "already signed" too', /כבר חתמת/.test(await r.text()));
  w = world();
  check('no "read and understood": refused', (await post({ k: tok, emp: 'e1', sig: SIG })).status === 400 && w.inserts.length === 0);
  check('a name that is not on the list: refused', (await post({ k: tok, emp: 'zz', ok: '1', sig: SIG })).status === 400 && w.inserts.length === 0);
  check('no signature: refused', (await post({ k: tok, emp: 'e1', ok: '1', sig: '' })).status === 400 && w.uploads.length === 0);
  check('a draft cannot be signed', (await post({ k: await makeTalkToken(ENV, 'tt2'), emp: 'e1', ok: '1', sig: SIG })).status === 404);
  check('a forged token cannot sign', (await post({ k: 'tt1.zzz.bad', emp: 'e1', ok: '1', sig: SIG })).status === 403 && w.inserts.length === 0);
  w = world({ uploadFail: true });
  check('upload failed: 502 and no row', (await post({ k: tok, emp: 'e1', ok: '1', sig: SIG })).status === 502 && w.inserts.length === 0);
  check('tablet detected', deviceOf('Mozilla/5.0 (iPad; CPU OS 17_0)') === 'tablet' && deviceOf('Mozilla/5.0 (Linux; Android 13; SM-X200)') === 'tablet' && deviceOf('Mozilla/5.0 (Linux; Android 13; Pixel) Mobile') === 'phone');
}

console.log('\n4. the signature check');
{
  check('a JPEG is not a signature', sigBytes('data:image/jpeg;base64,' + Buffer.from(png).toString('base64')) === null);
  check('too small (an empty canvas) is not a signature', sigBytes('data:image/png;base64,' + Buffer.from(png.slice(0, 100)).toString('base64')) === null);
  const big = new Uint8Array(400 * 1024); big.set([0x89, 0x50, 0x4E, 0x47], 0);
  check('over 300KB is refused', sigBytes('data:image/png;base64,' + Buffer.from(big).toString('base64')) === null);
  const notPng = new Uint8Array(1024);
  check('PNG content type with other bytes is refused', sigBytes('data:image/png;base64,' + Buffer.from(notPng).toString('base64')) === null);
  check('a real-looking PNG passes', sigBytes(SIG) instanceof Uint8Array);
}

console.log('\n5. the manager\'s link');
{
  world();
  let r = await link({ op: 'link', id: 'tt1' }, 'good'); let j = await r.json();
  check('manager gets a link for a published talk', r.status === 200 && /^https:\/\/tapugan-safety\.pages\.dev\/api\/talk\?k=tt1\./.test(j.url) && j.days === TALK_TTL_DAYS, j);
  check('the link opens that talk', (await readTalkToken(ENV, decodeURIComponent(j.url.split('k=')[1]))).id === 'tt1');
  check('no session: 401', (await link({ op: 'link', id: 'tt1' })).status === 401);
  check('a reporter: 403', (await link({ op: 'link', id: 'tt1' }, 'rep')).status === 403);
  check('a draft: 409', (await link({ op: 'link', id: 'tt2' }, 'good')).status === 409);
  check('another site: 403', (await link({ op: 'link', id: 'tt1' }, 'good', 'https://evil.example')).status === 403);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
