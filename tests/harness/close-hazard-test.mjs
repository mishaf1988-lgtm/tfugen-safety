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
const H1 = { id: 'th-mumiomsmjz43', n: 51, d: '2026-09-29', tour_no: 3, dept: 'מעצבים', loc: 'קו 2', descr: 'כבל <i>חשוף</i>', s: 'פתוח' };
// Minimal JPEG / PNG headers that imageInfo() accepts.
const JPG = new Uint8Array(3000); JPG.set([0xFF, 0xD8, 0xFF, 0xC0, 0x00, 0x11, 0x08, 0x00, 0x10, 0x00, 0x20, 0x03], 0);
const PNG = new Uint8Array(100); PNG.set([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 32, 0, 0, 0, 16], 0);

function world(o) {
  o = o || {};
  const w = { inserts: [], patches: [], hpatches: [], uploads: [], mails: [], ignored: 0, insertReqs: [], readsSeen: 0, waiting: [], patchFails: o.patchFails || 0, reports: JSON.parse(JSON.stringify(o.reports || [F1])), hazards: JSON.parse(JSON.stringify(o.hazards || [H1])) };
  globalThis.fetch = async (url, init) => {
    const u = String(url), m = (init && init.method) || 'GET', body = init && init.body;
    const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
    const prefer = String((init && init.headers && init.headers.Prefer) || '');
    if (u.startsWith(SB + '/rest/v1/trustee_reports')) {
      // PostgREST: a POST whose id exists is 409, or a no-op 201 with
      // resolution=ignore-duplicates (the closure row's fixed id, 15/10/2026).
      if (m === 'POST') {
        const row = JSON.parse(body); w.inserts.push(row); w.insertReqs.push({ u, prefer });
        if (o.insertFail) return new Response(null, { status: 500 });
        if (w.reports.some((x) => x.id === row.id)) { if (/resolution=ignore-duplicates/.test(prefer)) { w.ignored++; return new Response(null, { status: 201 }); } return json({ code: '23505' }, 409); }
        w.reports.push({ ...row, s: 'תקין' }); return new Response(null, { status: 201 });
      }
      // PATCH as PostgREST does it: the s=neq guard, and the changed rows back with return=representation
      if (m === 'PATCH') {
        w.patches.push({ u, body: JSON.parse(body), prefer }); if (w.patchFails > 0) { w.patchFails--; return new Response('x', { status: 503 }); }
        const id = decodeURIComponent(u.match(/id=eq\.([^&]+)/)[1]), neq = (u.match(/s=neq\.([^&]+)/) || [])[1];
        const r = w.reports.find((x) => x.id === id && (neq === undefined || x.s !== decodeURIComponent(neq))); if (r) Object.assign(r, JSON.parse(body));
        return /return=representation/.test(prefer) ? json(r ? [r] : []) : new Response(null, { status: 204 });
      }
      if (o.readFail) return new Response('x', { status: 503 });
      const id = decodeURIComponent((u.match(/id=eq\.([^&]+)/) || [])[1] || '');
      const out = JSON.parse(JSON.stringify(w.reports.filter((r) => r.id === id)));
      // the race: hold every read until o.raceReads of them arrived, so all see "open" before any write
      if (o.raceReads) { w.readsSeen++; await new Promise((res) => { w.waiting.push(res); if (w.readsSeen >= o.raceReads) w.waiting.splice(0).forEach((f) => f()); }); }
      return json(out);
    }
    if (u.startsWith(SB + '/rest/v1/tour_hazards')) {
      const id = decodeURIComponent((u.match(/id=eq\.([^&]+)/) || [])[1] || '');
      if (m === 'PATCH') {
        const b = JSON.parse(body); w.hpatches.push({ u, body: b, prefer }); if (o.hPatchFail) return new Response('x', { status: 500 });
        const r = w.hazards.find((x) => x.id === id && x.s !== 'סגור'); if (r) Object.assign(r, b);
        return /return=representation/.test(prefer) ? json(r ? [r] : []) : new Response(null, { status: 204 });
      }
      const out = JSON.parse(JSON.stringify(w.hazards.filter((r) => r.id === id)));
      // closed in the app right after this read, before the PATCH
      if (o.hClosedAfterRead) w.hazards.forEach((r) => { if (r.id === id) Object.assign(r, { s: 'סגור', closed_by: 'מנהל', after_photo_url: null }); });
      return json(out);
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
function post(fields, env, waitUntil) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return onRequest(Object.assign({ request: new Request(URL0, { method: 'POST', body: fd }), env: env || ENV }, waitUntil ? { waitUntil } : {}));
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

  console.log('\n4. a tour hazard (upgrade review 13, 30/09/2026): the link in the department report');
  {
    const htok = await makeCloseToken(ENV, H1.id);
    check('a th- id is signed', !!htok && htok.indexOf(H1.id + '.') === 0, htok);
    let w = world();
    let r = await get(htok); let h = await r.text();
    check('GET: the form, for a hazard (מפגע), escaped, nothing written', r.status === 200 && /name="who" required/.test(h) && h.includes('\u05e1\u05d2\u05d9\u05e8\u05ea \u05de\u05e4\u05d2\u05e2') && h.includes('&lt;i&gt;') && w.hpatches.length === 0 && w.inserts.length === 0, h.slice(0, 300));
    check('the photo is optional on the form', /name="photo"/.test(h) && !/name="photo"[^>]*required/.test(h));
    r = await post({ k: htok, who: '', note: 'x' }); h = await r.text();
    check('POST without a name: the form again, nothing written', /name="who"/.test(h) && w.hpatches.length === 0);
    r = await post({ k: htok, who: 'ויטלי', note: 'הוחלף הכבל', photo: new File([JPG], 'a.jpg', { type: 'image/jpeg' }) }); h = await r.text();
    const p = w.hpatches[0];
    check('POST: one PATCH of tour_hazards, guarded by s != סגור', w.hpatches.length === 1 && /s=neq\./.test(p.u) && p.body.s === 'סגור', w.hpatches);
    check('closed_d today, closed_by, close_note, after_photo_url stored', /^\d{4}-\d{2}-\d{2}$/.test(p.body.closed_d) && p.body.closed_by === 'ויטלי' && p.body.close_note === 'הוחלף הכבל' && /\/incidents-photos\/thz-link-th-mumiomsmjz43-/.test(p.body.after_photo_url || ''), p.body);
    check('no trustee report row is written for a hazard', w.inserts.length === 0 && w.patches.length === 0);
    check('the manager gets the confirmation mail', w.mails.length === 1);
    r = await get(htok); h = await r.text();
    check('opened again: "already closed", no form', !/<form/.test(h) && h.includes('\u05d4\u05de\u05e4\u05d2\u05e2 \u05db\u05d1\u05e8 \u05e0\u05e1\u05d2\u05e8'), h.slice(0, 300));
    w = world();
    await post({ k: htok, who: 'ויטלי', note: '' });
    check('without a photo or a note: closed, both null', w.hpatches.length === 1 && w.hpatches[0].body.after_photo_url === null && w.hpatches[0].body.close_note === null, w.hpatches);
    w = world({ hazards: [] });
    r = await get(htok);
    check('a hazard that is gone: 404, no form', r.status === 404 && !/<form/.test(await r.text()));
    w = world({ hPatchFail: true });
    r = await post({ k: htok, who: 'ויטלי' }); h = await r.text();
    check('the PATCH fails: the form again with the error, no mail', /name="who"/.test(h) && w.mails.length === 0);
  }

  console.log('\n5. one closure per finding (15/10/2026): double tap, retry, closed in between');
  const closures = (w) => w.reports.filter((r) => r.t === 8 && r.ref === F1.id);
  {
    // both POSTs read the finding as open before either one writes
    const w = world({ raceReads: 2 });
    const [r1, r2] = await Promise.all([post({ k: tok, who: 'דנה' }), post({ k: tok, who: 'דנה' })]);
    const [h1, h2] = [await r1.text(), await r2.text()];
    check('the race happened: both reads saw "open", two inserts were sent', w.readsSeen === 2 && w.inserts.length === 2, { reads: w.readsSeen, inserts: w.inserts.length });
    check('double tap: exactly one closure row (the second insert is ignored)', closures(w).length === 1 && w.ignored === 1, closures(w));
    check('the closure row id is fixed: cl- + the finding id + the day', w.inserts[0].id === w.inserts[1].id && /^cl-mudmp1oysfpo-\d{8}$/.test(w.inserts[0].id), w.inserts.map((x) => x.id));
    check('the id is valid for a link and never a tour hazard id', /^[A-Za-z0-9_-]{1,64}$/.test(w.inserts[0].id) && !/^th-/.test(w.inserts[0].id));
    check('insert uses on_conflict=id with resolution=ignore-duplicates', w.insertReqs.every((q) => /\?on_conflict=id$/.test(q.u) && /resolution=ignore-duplicates/.test(q.prefer)), w.insertReqs);
    // 15/10/2026: the PATCH asks for the changed row, so only one of the two
    // may say "closed" and mail the manager; the other says "already closed".
    const done = [h1, h2].filter((h) => h.includes('\u2705 \u05d4\u05dc\u05d9\u05e7\u05d5\u05d9 \u05e0\u05e1\u05d2\u05e8')), already = [h1, h2].filter((h) => h.includes('\u05d4\u05dc\u05d9\u05e7\u05d5\u05d9 \u05db\u05d1\u05e8 \u05e0\u05e1\u05d2\u05e8'));
    check('double tap: one page says closed, the other says already closed; the finding is closed', r1.status === 200 && r2.status === 200 && done.length === 1 && already.length === 1 && w.reports[0].s === 'נסגר', [h1.slice(0, 200), h2.slice(0, 200)]);
    check('double tap: ONE "closed" mail to the manager, not two', w.mails.length === 1, w.mails.length);
    check('the finding PATCH asks for return=representation', w.patches.length === 2 && w.patches.every((p) => /return=representation/.test(p.prefer)), w.patches.map((p) => p.prefer));
  }
  {
    // the page does not wait on Graph: the mail goes to waitUntil
    const w = world(); const held = [];
    const r = await post({ k: tok, who: 'דנה' }, ENV, (p) => held.push(p)); const h = await r.text();
    check('with waitUntil: the page answers before the mail is sent, the mail is handed to waitUntil', h.includes('\u2705 \u05d4\u05dc\u05d9\u05e7\u05d5\u05d9 \u05e0\u05e1\u05d2\u05e8') && held.length === 1, held.length);
    await Promise.all(held);
    check('...and waitUntil sends it', w.mails.length === 1, w.mails.length);
    const w2 = world(); const held2 = [];
    const htok = await makeCloseToken(ENV, H1.id);
    await post({ k: htok, who: 'ויטלי' }, ENV, (p) => held2.push(p)); await Promise.all(held2);
    check('the tour hazard mail goes the same way', held2.length === 1 && w2.mails.length === 1, [held2.length, w2.mails.length]);
  }
  {
    const w = world({ patchFails: 1 });
    let r = await post({ k: tok, who: 'דנה', note: 'נוקה' }); let h = await r.text();
    check('PATCH fails: "partly saved" (502), finding still open', r.status === 502 && h.includes('נשמר חלקית') && w.reports[0].s === 'פתוח', h.slice(0, 300));
    r = await post({ k: tok, who: 'דנה', note: 'נוקה' }); h = await r.text();
    check('retry: success page, finding closed', r.status === 200 && h.includes('הליקוי נסגר') && w.reports[0].s === 'נסגר', h.slice(0, 300));
    check('retry: still one closure row (second insert ignored)', closures(w).length === 1 && w.ignored === 1 && w.inserts.length === 2, closures(w));
  }
  {
    const w = world({ hClosedAfterRead: true });
    const htok = await makeCloseToken(ENV, H1.id);
    const r = await post({ k: htok, who: 'ויטלי', note: 'הוחלף', photo: new File([JPG], 'a.jpg', { type: 'image/jpeg' }) }); const h = await r.text();
    check('hazard PATCH asks for return=representation', w.hpatches.length === 1 && /return=representation/.test(w.hpatches[0].prefer), w.hpatches);
    check('closed in between: the page says already closed, not closed now', h.includes('\u05d4\u05de\u05e4\u05d2\u05e2 \u05db\u05d1\u05e8 \u05e0\u05e1\u05d2\u05e8') && !h.includes('\u2705 \u05d4\u05de\u05e4\u05d2\u05e2 \u05e0\u05e1\u05d2\u05e8'), h.slice(0, 400));
    check('closed in between: the earlier closure is kept, no mail for this one', w.hazards[0].closed_by === 'מנהל' && w.mails.length === 0);
  }

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
