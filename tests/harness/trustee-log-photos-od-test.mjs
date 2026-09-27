// Trustee photos copied to OneDrive (27/09, Michael: "everything automatic end
// to end"): each photo once, into נאמני בטיחות/תמונות; the Excel link points to
// the OneDrive copy; photos from before this change are copied even when the
// log is unchanged; more than one write's worth continues by itself; a photo
// gone from Storage is not retried forever. Real runLog/onRequest, fetch mocked.
import { runLog, onRequest, PHOTO_FOLDER } from './_build/trustee-log.mjs';

let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const JPG = new Uint8Array(Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAeACgDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFgEBAQEAAAAAAAAAAAAAAAAAAAMG/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AmgItaAAAAAAAAAA//9k=', 'base64'));
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'srv', ONEDRIVE_CLIENT_ID: 'cid', ONEDRIVE_CLIENT_SECRET: 'cs', TRUSTEE_NOTIFY_SECRET: 'nsec' };
const pub = (n) => SB + '/storage/v1/object/public/incidents-photos/' + n;
const photoDir = encodeURIComponent('תמונות');

function world(reports, o) {
  o = o || {};
  const w = { state: Object.assign({}, o.state || {}), photoPuts: [], logPuts: 0, gets: [], self: [] };
  globalThis.fetch = async (url, init) => {
    const u = String(url), m = (init && init.method) || 'GET', body = init && init.body;
    const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
    if (u.startsWith(SB + '/rest/v1/trustee_reports')) return json(/offset=0/.test(u) ? reports : []);
    if (u.startsWith(SB + '/rest/v1/trustee_tasks') || u.startsWith(SB + '/rest/v1/locations')) return json([]);
    if (u.startsWith(SB + '/rest/v1/server_state')) {
      if (m === 'POST') { JSON.parse(body).forEach((r) => { w.state[r.key] = r.value; }); return new Response(null, { status: 201 }); }
      return json(Object.keys(w.state).map((k) => ({ key: k, value: w.state[k], updated_at: 'x' })));
    }
    if (u.startsWith(SB + '/rest/v1/oauth_tokens')) {
      if (m === 'POST') return new Response(null, { status: 201 });
      return json([{ user_email: 'sviva@tapugan.co.il', refresh_token: 'rt', access_token: null, expires_at: null, scope: 'Files.ReadWrite' }]);
    }
    if (u.startsWith('https://login.microsoftonline.com/')) return json({ access_token: 'at', refresh_token: 'rt2', expires_in: 3600, scope: 'Files.ReadWrite' });
    if (u.startsWith(SB + '/storage/v1/object/sign/')) return json(JSON.parse(body).paths.map((p) => ({ path: p, signedURL: '/object/sign/incidents-photos/' + p + '?token=t' })));
    if (u.startsWith(SB + '/storage/v1/render/image/')) return new Response('no', { status: 400 });
    if (u.startsWith(SB + '/storage/v1/object/authenticated/')) {
      const n = u.split('/').pop(); w.gets.push(n);
      if (n === 'gone.jpg') return new Response('not found', { status: 404 });
      return new Response(JPG, { status: 200 });
    }
    if (u.startsWith('https://graph.microsoft.com/v1.0/me/drive/root:/')) {
      if (m === 'PUT' && u.indexOf(photoDir) > 0) {
        const name = decodeURIComponent(u.split('/').slice(-1)[0].replace(':', '').replace('/content', ''));
        w.photoPuts.push({ u, type: init.headers['Content-Type'] });
        return json({ webUrl: 'https://tapugancoil-my.sharepoint.com/p/' + w.photoPuts.length });
      }
      if (m === 'PUT') { w.logPuts++; w.lastLog = Buffer.from(body).toString('latin1'); return json({ webUrl: 'https://tapugancoil-my.sharepoint.com/log.xlsx' }); }
      if (m === 'GET') { w.folderGet = u; return json({ webUrl: 'https://tapugancoil-my.sharepoint.com/folder' }); }
    }
    if (u === 'https://tapugan-safety.pages.dev/api/trustee-log') { w.self.push({ headers: init.headers }); return json({ ok: true }); }
    return json({ error: 'unexpected ' + u }, 599);
  };
  return w;
}
const rep = (id, d, extra) => Object.assign({ id, u: 'a', t: 1, d, ts: d + 'T08:00:00Z', ok: false, s: 'פתוח', f: 'x', photo_url: pub(id + '.jpg') }, extra || {});

console.log('\n1. first write copies the photos and links them');
{
  const reps = [rep('p1', '2026-09-23'), rep('p2', '2026-09-24'), rep('gone', '2026-09-25', { photo_url: pub('gone.jpg') }), rep('nophoto', '2026-09-26', { photo_url: null })];
  const w = world(reps);
  const r = await runLog(ENV, false);
  check('pushed', r.pushed === true, r);
  check('2 photos uploaded to the photos folder', w.photoPuts.length === 2, w.photoPuts.map((p) => p.u));
  check('into Apps/Tapugan Safety/נאמני בטיחות/תמונות', w.photoPuts.every((p) => p.u.indexOf(PHOTO_FOLDER.split('/').map(encodeURIComponent).join('/')) > 0));
  check('file named date_id.jpg, image/jpeg', w.photoPuts.some((p) => p.u.indexOf('2026-09-23_p1.jpg') > 0) && w.photoPuts[0].type === 'image/jpeg', w.photoPuts);
  const copied = JSON.parse(w.state.trustee_photos || '{}');
  check('copied map saved; the 404 photo remembered as empty', copied.p1 && copied.p2 && copied.gone === '' && !('nophoto' in copied), copied);
  check('Excel links point to OneDrive copies', w.lastLog.indexOf('https://tapugancoil-my.sharepoint.com/p/1') >= 0 && w.lastLog.indexOf('https://tapugancoil-my.sharepoint.com/p/2') >= 0);
  check('the gone photo keeps the Storage link', w.lastLog.indexOf('gone.jpg?token=t') >= 0);
  check('photos folder URL saved for the home card', w.state.trustee_photos_url === 'https://tapugancoil-my.sharepoint.com/folder', w.state);
  check('each photo downloaded once (copy bytes reused as thumbnail)', w.gets.filter((n) => n === 'p1.jpg').length === 1, w.gets);
  check('thumbnails embedded', (w.lastLog.match(/xl\/media\/image\d+\.jpeg/g) || []).length === 4, (w.lastLog.match(/xl\/media\/image\d+\.jpeg/g) || []).length);
  check('signature saved (nothing pending)', !!w.state.trustee_log_sig && r.photos_pending === 0, r);

  console.log('\n2. next trigger, nothing changed: no rewrite, no re-upload');
  const w2 = world(reps, { state: w.state });
  const r2 = await runLog(ENV, false);
  check('unchanged', r2.pushed === false && r2.reason === 'unchanged', r2);
  check('no uploads, gone photo not retried', w2.photoPuts.length === 0 && w2.gets.length === 0, w2.gets);
}

console.log('\n3. photos from before this change: copied although the log is unchanged');
{
  const reps = [rep('old1', '2026-09-20')];
  const w = world(reps);
  await runLog(ENV, false); // establishes a signature
  const st = Object.assign({}, w.state); delete st.trustee_photos; delete st.trustee_photos_url; // as before 27/09
  const w2 = world(reps, { state: st });
  const r = await runLog(ENV, false);
  check('writes anyway and copies', r.pushed === true && w2.photoPuts.length === 1, r);
}

console.log('\n4. more than 6 photos: pending, continues by itself');
{
  const reps = []; for (let i = 1; i <= 8; i++) reps.push(rep('m' + i, '2026-09-' + String(10 + i)));
  const w = world(reps);
  const req = new Request('https://tapugan-safety.pages.dev/api/trustee-log', { method: 'POST', headers: { 'x-notify-secret': 'nsec', 'Content-Type': 'application/json' }, body: '{}' });
  const waits = [];
  const resp = await onRequest({ request: req, env: ENV, waitUntil: (p) => waits.push(p) });
  const j = await resp.json();
  await Promise.all(waits);
  check('6 copied, 2 pending', w.photoPuts.length === 6 && j.photos_pending === 2, j);
  check('signature not saved while pending', !w.state.trustee_log_sig);
  check('calls itself once, with the secret', w.self.length === 1 && w.self[0].headers['x-notify-secret'] === 'nsec' && j.continued === true, w.self);
  const w2 = world(reps, { state: w.state });
  const r2 = await runLog(ENV, false);
  check('the follow-up copies the last 2 and saves the signature', w2.photoPuts.length === 2 && r2.photos_pending === 0 && !!w2.state.trustee_log_sig, r2);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
