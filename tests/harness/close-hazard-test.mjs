// "✅ סמן כטופל" from the hazard email (27/09). Runs the real close-hazard.js
// and _closelink.js with fetch mocked: Supabase REST + Storage, notification
// prefs, the Microsoft token endpoint and sendMail.
import { onRequest } from './_build/close-hazard.mjs';
import { makeCloseToken, readCloseToken } from './_build/_closelink.mjs';

let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const URL0 = 'https://tapugan-safety.pages.dev/api/close-hazard';
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'srv', ONEDRIVE_CLIENT_ID: 'cid', ONEDRIVE_CLIENT_SECRET: 'cs', TRUSTEE_NOTIFY_SECRET: 'nsec' };
const F1 = { id: 'mudmp1oysfpo', u: 'מוסא', t: 1, d: '2026-09-23', ok: false, s: 'פתוח', loc: 'חומר גלם · רחבת קירור', location_id: 'L1', f: 'פנס <b>תאורה</b>', tour: null };
// Minimal JPEG / PNG headers that imageInfo() accepts.
const JPG = new Uint8Array(3000); JPG.set([0xFF, 0xD8, 0xFF, 0xC0, 0x00, 0x11, 0x08, 0x00, 0x10, 0x00, 0x20, 0x03], 0);
const PNG = new Uint8Array(100); PNG.set([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 32, 0, 0, 0, 16], 0);

function world(o) {
  o = o || {};
  const w = { inserts: [], patches: [], uploads: [], mails: [], reports: JSON.parse(JSON.stringify(o.reports || [F1])) };
  globalThis.fetch = async (url, init) => {
    const u = String(url), m = (init && init.method) || 'GET', body = init && init.body;
    const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
    if (u.startsWith(SB + '/rest/v1/trustee_reports')) {
      if (m === 'POST') { w.inserts.push(JSON.parse(body)); return new Response(null, { status: o.insertFail ? 500 : 201 }); }
      if (m === 'PATCH') { w.patches.push({ u, body: JSON.parse(body) }); const id = decodeURIComponent(u.match(/id=eq\.([^&]+)/)[1]); const r = w.reports.find((x) => x.id === id); if (r) Object.assign(r, JSON.parse(body)); return new Response(null, { status: 204 }); }
      if (o.readFail) return new Response('x', { status: 503 });
      const id = decodeURIComponent((u.match(/id=eq\.([^&]+)/) || [])[1] || '');
      return json(w.reports.filter((r) => r.id === id));
    }
    if (u.startsWith(SB + '/rest/v1/notification_prefs')) return json([{ prefs: { trustee_hazard: { email: true, email_to: 'sviva@tapugan.co.il' } } }]);
    if (u.startsWith(SB + '/rest/v1/oauth_tokens')) return json([{ user_email: 'sviva@tapugan.co.il', refresh_token: 'rt', access_token: 'at', expires_at: new Date(Date.now() + 3600e3).toISOString(), scope: 'Files.ReadWrite Mail.Send' }]);
    if (u.startsWith(SB + '/rest/v1/server_state')) return json([]);
    if (u.startsWith(SB + '/storage/v1/object/incidents-photos/')) { w.uploads.push({ u, type: init.headers['Content-Type'], n: body.length }); return json({ Key: 'x' }); }
    if (u === 'https://graph.microsoft.com/v1.0/me/sendMail') { w.mails.push(JSON.parse(body)); return new Response(null, { status: 202 }); }
    if (u.startsWith('https://login.microsoftonline.com/')) return json({ access_token: 'at', refresh_token: 'rt2', expires_in: 3600 });
    return json({ error: 'unexpected ' + u }, 599);
  };
  return w;
}
const get = (k, env) => onRequest({ request: new Request(URL0 + '?k=' + encodeURIComponent(k)), env: env || ENV });
function post(fields, env) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return onRequest({ request: new Request(URL0, { method: 'POST', body: fd }), env: env || ENV });
}

(async () => {
  console.log('\n1. the token');
  const tok = await makeCloseToken(ENV, F1.id);
  check('made for a valid id', /^mudmp1oysfpo\.[0-9a-z]+\.[A-Za-z0-9_-]{43}$/.test(tok), tok);
  check('reads back to the same id', (await readCloseToken(ENV, tok)).id === F1.id);
  check('no secret -> no token (the mail gets no button)', (await makeCloseToken({}, F1.id)) === null);
  check('a bad id is never signed', (await makeCloseToken(ENV, 'a b')) === null && (await makeCloseToken(ENV, '')) === null);
  const [id0, exp0, sig0] = tok.split('.');
  check('another id with the same signature -> bad', (await readCloseToken(ENV, 'r2.' + exp0 + '.' + sig0)).error === 'bad');
  check('a later expiry with the same signature -> bad', (await readCloseToken(ENV, id0 + '.' + (parseInt(exp0, 36) + 999).toString(36) + '.' + sig0)).error === 'bad');
  check('another secret -> bad', (await readCloseToken({ TRUSTEE_NOTIFY_SECRET: 'other' }, tok)).error === 'bad');
  check('after 30 days -> expired', (await readCloseToken(ENV, tok, Date.now() + 31 * 24 * 3600e3)).error === 'expired');
  check('29 days -> still valid', (await readCloseToken(ENV, tok, Date.now() + 29 * 24 * 3600e3)).id === F1.id);
  check('garbage -> bad', (await readCloseToken(ENV, 'x')).error === 'bad' && (await readCloseToken(ENV, '')).error === 'bad');

  console.log('\n2. GET shows the form and writes nothing (link scanners open every link)');
  {
    const w = world();
    const r = await get(tok);
    const h = await r.text();
    check('200 with the form', r.status === 200 && /<form method="post" action="\/api\/close-hazard"/.test(h) && /name="who" required/.test(h), h.slice(0, 200));
    check('the finding is shown, escaped', h.includes('&lt;b&gt;') && !h.includes('<b>'), h);
    check('nothing written, nothing mailed', w.inserts.length === 0 && w.patches.length === 0 && w.mails.length === 0);
    check('token never leaks: no-referrer, no-store, noindex, no framing', r.headers.get('Referrer-Policy') === 'no-referrer' && r.headers.get('Cache-Control') === 'no-store' && /noindex/.test(r.headers.get('X-Robots-Tag')) && /frame-ancestors 'none'/.test(r.headers.get('Content-Security-Policy')));
    check('the page has no script at all (CSP default-src none)', !/<script/i.test(h) && /default-src 'none'/.test(r.headers.get('Content-Security-Policy')));
  }
  {
    world();
    let r = await get('mudmp1oysfpo.zzz.' + sig0);
    check('forged link -> 400 page, no form', r.status === 400 && !/<form/.test(await r.text()));
    r = await get(tok, { ...ENV, TRUSTEE_NOTIFY_SECRET: '' });
    check('secret removed from the env -> no form (never open)', r.status === 400 && !/<form/.test(await r.text()));
    const old = await makeCloseToken(ENV, F1.id, Date.now() - 31 * 24 * 3600e3);
    r = await get(old);
    check('expired link -> 410', r.status === 410);
  }
  {
    world({ reports: [{ ...F1, s: 'נסגר' }] });
    const r = await get(tok); const h = await r.text();
    check('already closed -> says so, no form', r.status === 200 && !/<form/.test(h) && h.includes('כבר נסגר'));
  }
  {
    world({ reports: [{ ...F1, ok: true }] });
    let r = await get(tok);
    check('a clean report is not a finding -> 404', r.status === 404);
    world({ reports: [{ ...F1, t: 8 }] });
    r = await get(tok);
    check('a closure report (task 8) is not a finding -> 404', r.status === 404);
    world({ reports: [] });
    r = await get(tok);
    check('unknown id -> 404', r.status === 404);
    world({ readFail: true });
    r = await get(tok);
    check('DB down -> 502, not a crash', r.status === 502);
  }
  {
    world();
    const r = await get(await makeCloseToken(ENV, 'test'));
    check('the settings-screen test mail: link opens a "test" page, no form', r.status === 200 && !/<form/.test(await r.text()));
  }

  console.log('\n3. POST closes');
  {
    const w = world();
    const r = await post({ k: tok, who: '  אבי   כהן ', note: 'הוחלף פנס', photo: new File([JPG], 'a.jpg', { type: 'image/jpeg' }) });
    const h = await r.text();
    const rep = w.inserts[0];
    check('200 success page', r.status === 200 && h.includes('הליקוי נסגר'), h.slice(0, 300));
    check('closure report: task 8, ref, ok, under the typed name (trimmed)', rep && rep.t === 8 && rep.ref === F1.id && rep.ok === true && rep.u === 'אבי כהן', rep);
    check('keeps location / location_id from the finding, note in f', rep.loc === F1.loc && rep.location_id === 'L1' && rep.f === 'הוחלף פנס');
    check('d is a date, mgr_note says it came from the mail link', /^\d{4}-\d{2}-\d{2}$/.test(rep.d) && rep.mgr_note === 'נסגר מקישור במייל');
    check('photo uploaded as JPEG and linked', w.uploads.length === 1 && w.uploads[0].type === 'image/jpeg' && /tru-link-mudmp1oysfpo-\d+\.jpg$/.test(w.uploads[0].u) && rep.photo_url === SB + '/storage/v1/object/public/incidents-photos/' + w.uploads[0].u.split('/').pop());
    check('finding marked closed, guarded by s=neq', w.patches.length === 1 && w.patches[0].body.s === 'נסגר' && /id=eq\.mudmp1oysfpo&s=neq\./.test(w.patches[0].u), w.patches);
    check('manager gets a confirmation with who handled it', w.mails.length === 1 && w.mails[0].message.toRecipients[0].emailAddress.address === 'sviva@tapugan.co.il' && w.mails[0].message.body.content.includes('אבי כהן'), w.mails);
    check('nothing deleted', !w.patches.some((p) => /delete/i.test(p.u)));
  }
  {
    const w = world();
    await post({ k: tok, who: 'דנה', photo: new File([PNG], 'a.png', { type: 'image/png' }) });
    check('PNG is kept as PNG', w.uploads.length === 1 && w.uploads[0].type === 'image/png' && /\.png$/.test(w.inserts[0].photo_url));
  }
  {
    const w = world();
    const r = await post({ k: tok, who: 'דנה', photo: new File([new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25])], 'a.heic', { type: 'image/heic' }) });
    const h = await r.text();
    check('not JPG/PNG: closed anyway, no upload, and the page says the photo was not kept', w.inserts.length === 1 && w.inserts[0].photo_url === null && w.uploads.length === 0 && h.includes('JPG'), h.slice(-400));
  }
  {
    const w = world();
    await post({ k: tok, who: 'דנה' });
    check('no photo: closed, photo_url null, f null', w.inserts.length === 1 && w.inserts[0].photo_url === null && w.inserts[0].f === null && w.patches.length === 1);
  }
  {
    const w = world();
    const r = await post({ k: tok, who: '   ', note: 'x' });
    const h = await r.text();
    check('no name: form again with an error and the note kept, nothing written', w.inserts.length === 0 && /<form/.test(h) && h.includes('צריך למלא') && />x<\/textarea>/.test(h));
  }
  {
    const w = world({ reports: [{ ...F1, s: 'נסגר' }] });
    const r = await post({ k: tok, who: 'דנה' });
    check('second submit (double tap) on a closed finding: nothing written', r.status === 200 && w.inserts.length === 0 && w.patches.length === 0);
  }
  {
    const w = world({ insertFail: true });
    const r = await post({ k: tok, who: 'דנה' });
    const h = await r.text();
    check('insert fails: not marked closed, form back with the error', w.patches.length === 0 && /<form/.test(h) && h.includes('500'));
  }
  {
    const w = world();
    const r = await post({ k: 'mudmp1oysfpo.zzz.' + sig0, who: 'דנה' });
    check('POST with a forged token: 400, nothing written', r.status === 400 && w.inserts.length === 0 && w.patches.length === 0);
    const r2 = await post({ k: await makeCloseToken(ENV, 'test'), who: 'דנה' });
    check('POST for the test mail: nothing written', r2.status === 200 && w.inserts.length === 0);
  }
  {
    world();
    const r = await onRequest({ request: new Request(URL0 + '?k=' + tok, { method: 'PUT' }), env: ENV });
    check('other methods -> 405', r.status === 405);
    const r2 = await onRequest({ request: new Request(URL0 + '?k=' + tok), env: { TRUSTEE_NOTIFY_SECRET: 'nsec' } });
    check('no service key -> 500 page', r2.status === 500);
  }

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
