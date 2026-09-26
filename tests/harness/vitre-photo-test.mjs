// The finding's photo inside the Vitre notification form (26/09).
//
// Swagger, read through op=swagger the same day: POST /file/uploadImage takes
// multipart/form-data with one field `file` and answers a plain string (the
// stored path); /review/submit's data is { questionDataKey: string }, so that
// string is the answer to the form's image question. The DataKey comes from
// VITRE_PHOTO_KEY in Cloudflare. Nothing on this path may stop the SMS.
//
// Runs the real module with fetch mocked.
import { onRequest } from './_build/vitre.mjs';
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const BASE = { VITRE_API_KEY_ID: 'kid', VITRE_API_KEY_SECRET: 'ksecret', SUPABASE_SERVICE_ROLE_KEY: 'srv', VITRE_NOTIFY_ENABLED: '1' };
const PHOTO = SB + '/storage/v1/object/public/incidents-photos/tru/abc.jpg';
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);

// o.storageStatus  what our Storage answers for the photo (default 200, a jpeg)
// o.uploadStatus   what Vitre's uploadImage answers (default 200)
// o.uploadBody     the raw body uploadImage answers (default a JSON-quoted string)
// o.storageType    content-type our Storage answers (default image/jpeg)
function world(o) {
  o = o || {};
  const w = { calls: [] };
  globalThis.fetch = async (url, init) => {
    const u = String(url); const h = (init && init.headers) || {};
    const rec = { u, method: (init && init.method) || 'GET', headers: h, body: init && init.body };
    w.calls.push(rec);
    const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
    if (u.startsWith(SB + '/auth/v1/user')) return json({ id: 'u1', email: 'manager@tfugen.local', is_anonymous: false });
    if (u.startsWith(SB + '/rest/v1/app_users')) return json([{ role: 'מנהל', active: true }]);
    if (u.startsWith(SB + '/storage/v1/object/')) {
      const st = o.storageStatus || 200;
      if (st !== 200) return new Response('nope', { status: st });
      const big = o.storageBytes || JPEG;
      return new Response(big, { status: 200, headers: { 'Content-Type': o.storageType || 'image/jpeg' } });
    }
    if (u.includes('/file/uploadImage')) {
      const st = o.uploadStatus || 200;
      const body = o.uploadBody !== undefined ? o.uploadBody : JSON.stringify('reviews/2026/abc.jpg');
      return new Response(body, { status: st, headers: { 'Content-Type': st === 200 ? 'text/plain' : 'application/json' } });
    }
    if (u.includes('/review/submit')) return json({ id: 777, status: 'Draft', previewUrl: 'https://app.vitre.io/formResults/x' });
    return json({ message: 'unexpected ' + u }, 404);
  };
  return w;
}
const run = async (body, env) => {
  const r = await onRequest({ request: new Request('https://tapugan-safety.pages.dev/api/vitre?op=notify', {
    method: 'POST', headers: { origin: 'https://tapugan-safety.pages.dev', authorization: 'Bearer tok', 'content-type': 'application/json' },
    body: JSON.stringify(body) }), env: env || BASE });
  let j = null; try { j = await r.json(); } catch (e) {}
  return { status: r.status, json: j };
};
const NOTE = { to: '599', title: 'ליקוי: x', details: 'd', photo: PHOTO };
const submitted = (w) => { const c = w.calls.find(c => c.u.includes('/review/submit')); return c ? JSON.parse(c.body) : null; };
const uploads = (w) => w.calls.filter(c => c.u.includes('/file/uploadImage'));
const storageGets = (w) => w.calls.filter(c => c.u.startsWith(SB + '/storage/v1/object/'));
const WITH_KEY = Object.assign({}, BASE, { VITRE_PHOTO_KEY: 'photo' });

console.log('\n1. VITRE_PHOTO_KEY unset: the photo is left out, the SMS still goes');
{
  const w = world();
  const r = await run(NOTE);
  check('submission went out, 200', r.status === 200 && r.json.ok && r.json.appointmentId === 777, r.json);
  check('data has no photo answer', submitted(w) && !('photo' in submitted(w).data) && submitted(w).data.to === '599', submitted(w));
  check('nothing was fetched from Storage or uploaded', storageGets(w).length === 0 && uploads(w).length === 0, w.calls.map(c => c.u));
  check('the response says the photo was skipped and why', r.json.photo && r.json.photo.skipped === true && /VITRE_PHOTO_KEY/.test(r.json.photo.error), r.json.photo);
  const r2 = await run({ to: '599', title: 't' });
  check('no photo in the body: photo is null, nothing else changes', r2.status === 200 && r2.json.photo === null, r2.json);
}

console.log('\n2. key set: Storage -> uploadImage (multipart, field `file`) -> data[key] = the string');
{
  const w = world();
  const r = await run(NOTE, WITH_KEY);
  check('200 and the photo is reported ok', r.status === 200 && r.json.photo && r.json.photo.ok === true, r.json);
  const sg = storageGets(w)[0];
  check('the photo is read from OUR Storage with the service key', sg && sg.u === SB + '/storage/v1/object/incidents-photos/tru/abc.jpg' && sg.headers.Authorization === 'Bearer srv', sg && sg.u);
  const up = uploads(w)[0];
  check('one upload to /file/uploadImage', uploads(w).length === 1 && up.method === 'POST', uploads(w).length);
  check('with the Vitre keys and no hand-written Content-Type (boundary is fetch\'s)', up && up.headers['X-api-key-id'] === 'kid' && !up.headers['Content-Type'], up && up.headers);
  const file = up && up.body instanceof FormData ? up.body.get('file') : null;
  check('the body is multipart with one field `file`', !!file && [...up.body.keys()].join(',') === 'file', up && [...(up.body.keys ? up.body.keys() : [])]);
  check('the file keeps its name and type', file && file.name === 'abc.jpg' && file.type === 'image/jpeg' && file.size === JPEG.length, file && { n: file.name, t: file.type, s: file.size });
  const d = submitted(w).data;
  check('data[photo] is the string Vitre answered (JSON-quoted)', d.photo === 'reviews/2026/abc.jpg', d);
  check('the rest of data is unchanged', d.to === '599' && d.title === 'ליקוי: x' && d.details === 'd', d);
  check('the submission comes after the upload', w.calls.findIndex(c => c.u.includes('/review/submit')) > w.calls.findIndex(c => c.u.includes('/file/uploadImage')));
  check('the response echoes key, value and size', r.json.photo.key === 'photo' && r.json.photo.value === 'reviews/2026/abc.jpg' && r.json.photo.bytes === JPEG.length, r.json.photo);
  check('the keys are never in the response', !JSON.stringify(r.json).includes('ksecret') && !JSON.stringify(r.json).includes('srv'));
}

console.log('\n3. uploadImage answering bare text, a different key name');
{
  const w = world({ uploadBody: 'files/x.jpg' });
  const r = await run(NOTE, Object.assign({}, BASE, { VITRE_PHOTO_KEY: 'q_photo-1' }));
  check('a bare-text answer is taken as is', submitted(w).data['q_photo-1'] === 'files/x.jpg' && r.json.photo.ok, submitted(w).data);
  const w2 = world({ uploadBody: '' });
  const r2 = await run(NOTE, WITH_KEY);
  check('an empty 200 answer is a failure, the SMS still goes', r2.status === 200 && r2.json.photo.ok === false && /empty/.test(r2.json.photo.error) && !('photo' in submitted(w2).data), r2.json.photo);
}

console.log('\n4. failures never stop the SMS');
{
  let w = world({ uploadStatus: 500, uploadBody: JSON.stringify({ message: 'disk full' }) });
  let r = await run(NOTE, WITH_KEY);
  check('Vitre 500 on upload: submitted without the photo, error reported', r.status === 200 && r.json.ok && r.json.photo.ok === false && /500/.test(r.json.photo.error) && /disk full/.test(r.json.photo.error) && !('photo' in submitted(w).data), r.json.photo);
  w = world({ storageStatus: 404 });
  r = await run(NOTE, WITH_KEY);
  check('Storage 404: submitted without the photo, no upload attempted', r.status === 200 && r.json.photo.ok === false && /storage 404/.test(r.json.photo.error) && uploads(w).length === 0, r.json.photo);
  w = world({ storageType: 'text/html' });
  r = await run(NOTE, WITH_KEY);
  check('a non-image object is not uploaded', r.json.photo.ok === false && /not an image/.test(r.json.photo.error) && uploads(w).length === 0, r.json.photo);
  w = world({ storageBytes: new Uint8Array(8 * 1024 * 1024 + 1) });
  r = await run(NOTE, WITH_KEY);
  check('over 8MB is not uploaded', r.json.photo.ok === false && /8MB/.test(r.json.photo.error) && uploads(w).length === 0, r.json.photo);
  w = world();
  r = await run(NOTE, Object.assign({}, WITH_KEY, { SUPABASE_SERVICE_ROLE_KEY: '' }));
  check('no service key: refused before Vitre (requireUser needs it)', r.status === 500 && /SUPABASE_SERVICE_ROLE_KEY/.test(r.json.error) && storageGets(w).length === 0, r);
}

console.log('\n5. only OUR Storage may be fetched: the service key goes nowhere else');
{
  for (const bad of ['https://evil.example/x.jpg', 'https://znhjtpcltrxxyfjczgvw.supabase.co.evil.example/storage/v1/object/public/b/x.jpg',
    SB + '/rest/v1/app_users', 'http://znhjtpcltrxxyfjczgvw.supabase.co/storage/v1/object/public/b/x.jpg', 'not a url']) {
    const w = world();
    const r = await run(Object.assign({}, NOTE, { photo: bad }), WITH_KEY);
    check('refused 400: ' + bad, r.status === 400 && /Storage/.test(r.json.error) && w.calls.every(c => !c.u.includes(bad.replace(/^https?:\/\//, '')) || c.u.startsWith(SB + '/auth') || c.u.startsWith(SB + '/rest/v1/app_users')), r);
    check('...nothing submitted to Vitre', !w.calls.some(c => c.u.includes('hbinov')));
  }
  const w = world();
  const r = await run(Object.assign({}, NOTE, { photo: SB + '/storage/v1/object/sign/incidents-photos/tru/abc.jpg?token=abc' }), WITH_KEY);
  check('a signed link to our Storage is accepted (token dropped, fetched with the service key)', r.status === 200 && r.json.photo.ok && storageGets(w)[0].u === SB + '/storage/v1/object/incidents-photos/tru/abc.jpg', storageGets(w).map(c => c.u));
}

console.log('\n6. a photo link cannot make a bad DataKey');
{
  const w = world();
  const r = await run(NOTE, Object.assign({}, BASE, { VITRE_PHOTO_KEY: 'to' }));
  // A wrong key is Michael's configuration, not the caller's: the server still
  // honours it (Vitre decides). What it must not do is let the caller pick the key.
  check('the key comes from the env, never from the body', submitted(w).data.to === 'reviews/2026/abc.jpg' && r.json.photo.key === 'to', submitted(w).data);
  const w2 = world();
  await run(Object.assign({}, NOTE, { photoKey: 'link' }), WITH_KEY);
  check('a photoKey in the body is ignored', submitted(w2).data.photo === 'reviews/2026/abc.jpg' && !('link' in submitted(w2).data), submitted(w2).data);
  const w3 = world();
  const r3 = await run(NOTE, Object.assign({}, BASE, { VITRE_PHOTO_KEY: 'bad key!' }));
  check('an invalid key name is treated as unset', r3.json.photo.skipped === true && uploads(w3).length === 0, r3.json.photo);
}

console.log('\n7. client sends the finding\'s photo link (index.html)');
{
  const fs = await import('node:fs');
  const html = fs.readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  const from = html.indexOf('function _truRouteVitre('), to = html.indexOf('function _truRoutePdfHtml');
  const src = html.slice(from, to);
  check('the notify body carries photo=_truRoutePhoto(r) when there is one', /var ph=_truRoutePhoto\(r\);if\(ph\)body\.photo=ph;/.test(src));
  check('a dropped photo is shown to the user (not a skipped one)', /pho\.ok===false&&!pho\.skipped/.test(src) && /\\u05d4\\u05ea\\u05de\\u05d5\\u05e0\\u05d4 \\u05dc\\u05d0 \\u05e6\\u05d5\\u05e8\\u05e4\\u05d4/.test(src));
  check('a pending: upload is never sent (photo helper filters it)', /function _truRoutePhoto\(r\)\{var p=String\(r\.photo_url\|\|''\);return \(p&&p\.indexOf\('pending:'\)!==0\)\?p:'';\}/.test(html));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
