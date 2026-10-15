// Induction photos kept until the form is filed (15/10/2026, Michael: "בצע: גם ב-Storage הפרטי עד שתויק").
// The photos go to the private bucket (backups/induction-docs/<row id>/<n>.jpg) during the worker's request,
// before the filing runs in waitUntil. Filed and mailed: deleted. Not: kept, and the row says so. The manager
// sends the form again from "who signed" (op refile), rebuilt from the row, the signature and the kept photos.
import { onRequest, makeTalkToken, makeCodeCookie, DOCS_BUCKET, DOCS_KEPT_NOTE } from './_build/talk.mjs';
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const URL0 = 'https://tapugan-safety.pages.dev/api/talk';
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'srv', SUPABASE_URL: SB, TRUSTEE_NOTIFY_SECRET: 'nsec', GEMINI_API_KEY: 'g' };
const GR = 'https://graph.microsoft.com/v1.0/me';
const T = {
  ind: { id: 'ind1', d: null, title: 'הוראות כניסה למשמרת', body: '1. חירום\n2. כללי', s: 'פורסמה', kind: 'induction', link_v: 0, trainer: 'מיכאל' },
  wk: { id: 'wk1', d: '2026-10-11', title: 'סולמות', body: 'x', s: 'פורסמה', kind: null, link_v: 0 },
};
const store = {}; // "<bucket>/<path>" -> bytes
let w;
const reset = (o) => { w = { puts: [], mails: [], patches: [], inserts: [], dels: [], seq: [], ...o }; };
const rows = {};
globalThis.fetch = async (url, init) => {
  const u = String(url), m = (init && init.method) || 'GET';
  const json = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { 'Content-Type': 'application/json' } });
  if (u.startsWith('https://generativelanguage.googleapis.com/')) return json({ candidates: [{ content: { parts: [{ text: 'איוון פטרוב' }] } }] });
  if (u.startsWith(SB + '/rest/v1/toolbox_talks')) { const id = decodeURIComponent((u.match(/id=eq\.([^&]+)/) || [])[1] || ''); return json(Object.values(T).filter((t) => t.id === id)); }
  if (u.startsWith(SB + '/rest/v1/emp')) return m === 'PATCH' ? new Response(null, { status: 204 }) : json([{ id: 'e1', n: 'אחמד כהן', dep: 'ייצור', eid: '7777777' }]);
  if (u.startsWith(SB + '/rest/v1/toolbox_reads')) {
    if (m === 'POST') { const r = JSON.parse(init.body); w.inserts.push(r); rows[r.id] = { ...r }; return new Response(null, { status: 201 }); }
    const id = decodeURIComponent((u.match(/[?&]id=eq\.([^&]+)/) || [])[1] || '');
    if (m === 'PATCH') { const b = JSON.parse(init.body); w.patches.push({ u, b }); if (rows[id]) Object.assign(rows[id], b); return new Response(null, { status: 204 }); }
    return json(id && rows[id] ? [rows[id]] : []);
  }
  if (u === SB + '/auth/v1/user') { const tok = init.headers.Authorization.replace('Bearer ', ''); return tok === 'good' ? json({ id: 'u1', email: 'michael@tfugen.local' }) : json({ id: 'u2', email: 'rep@tfugen.local' }); }
  if (u.startsWith(SB + '/rest/v1/app_users')) return json([u.includes('michael') ? { role: 'מנהל', active: true } : { role: 'צופה', active: true }]);
  if (u.startsWith(SB + '/storage/v1/object/list/')) {
    const bucket = u.slice((SB + '/storage/v1/object/list/').length), b = JSON.parse(init.body), pre = bucket + '/' + b.prefix;
    w.listed = b;
    return json(Object.keys(store).filter((k) => k.startsWith(pre)).map((k) => ({ name: k.slice(pre.length) })).concat([{ name: '.emptyFolderPlaceholder' }]));
  }
  if (u.startsWith(SB + '/storage/v1/object/')) {
    const key = decodeURIComponent(u.slice((SB + '/storage/v1/object/').length));
    if (m === 'DELETE') { const b = JSON.parse(init.body); w.dels.push({ bucket: key, prefixes: b.prefixes }); b.prefixes.forEach((p) => delete store[key + '/' + p]); return json([]); }
    if (m === 'POST') {
      if (key.startsWith(DOCS_BUCKET + '/')) { w.seq.push('keep'); await new Promise((ok) => setTimeout(ok, 5)); if (w.keepFail) throw new Error('network'); if (init.headers['Content-Type'] !== 'image/jpeg' || init.headers['x-upsert'] !== 'true' || init.headers.Authorization !== 'Bearer srv') return json({ error: 'headers' }, 400); }
      store[key] = new Uint8Array(init.body); return json({ Key: key });
    }
    return store[key] ? new Response(store[key], { status: 200 }) : json({ error: 'not found' }, 404);
  }
  if (u.startsWith(SB + '/rest/v1/server_state')) return json([{ value: '246810' }]);
  if (u.startsWith(SB + '/rest/v1/oauth_tokens')) return json([{ user_email: 'sviva@tapugan.co.il', refresh_token: 'r', access_token: 'at', expires_at: new Date(Date.now() + 3600e3).toISOString(), scope: 'Files.ReadWrite Mail.Send' }]);
  if (u.startsWith(GR + '/drive/root:/') && m === 'PUT') {
    const path = decodeURIComponent(u.slice((GR + '/drive/root:/').length).replace(/:\/content$/, ''));
    w.seq.push('put');
    w.puts.push({ path, txt: /html/.test(init.headers['Content-Type']) ? new TextDecoder().decode(init.body) : '' });
    if (w.putFail && !/Apps\//.test(path)) return json({ error: { message: 'disk full' } }, 507);
    return json({ webUrl: 'https://od.example/' + encodeURIComponent(path) });
  }
  if (u.startsWith(GR + '/drive/root:/') && /\?format=pdf$/.test(u)) { const b = new Uint8Array(2000); b.set([0x25, 0x50, 0x44, 0x46], 0); return new Response(b, { status: 200 }); }
  if (u === GR + '/sendMail') { w.mails.push(JSON.parse(init.body)); return w.mailFail ? json({ error: { message: 'quota' } }, 429) : new Response(null, { status: 202 }); }
  return json({ error: 'unexpected ' + u }, 599);
};
const png = new Uint8Array(1024); png.set([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], 0);
const SIG = 'data:image/png;base64,' + Buffer.from(png).toString('base64');
const jpg = (n, fill) => { const b = new Uint8Array(n).fill(fill || 7); b.set([0xFF, 0xD8, 0xFF], 0); return 'data:image/jpeg;base64,' + Buffer.from(b).toString('base64'); };
// ctx with waitUntil: the filing is collected, not awaited, so "before the answer" can be checked.
const sign = async (id, extra) => {
  const k = await makeTalkToken(ENV, id);
  const fd = new FormData();
  for (const [a, b] of Object.entries({ k, l: 'he', emp: '__other', oname: 'Ivan Petrov', ocomp: 'כוח אדם', oid: '334455667', ok: '1', sig: SIG, qa: '0:1', ino: '1234', idep: 'טוגנים', iph: '052-1234567', ijob: 'מפעיל קו', ...extra })) (Array.isArray(b) ? b : [b]).forEach((v) => fd.append(a, v));
  const jobs = [], before = Object.keys(store).filter((x) => x.startsWith(DOCS_BUCKET + '/')).length;
  const r = await onRequest({ request: new Request(URL0, { method: 'POST', body: fd, headers: { 'user-agent': 'iPhone Mobile', cookie: 'tsind=' + (await makeCodeCookie(ENV, id, '246810')) } }), env: ENV, waitUntil: (p) => jobs.push(p) });
  const at = { keeps: Object.keys(store).filter((x) => x.startsWith(DOCS_BUCKET + '/')).length - before, puts: w.puts.length };
  await Promise.all(jobs);
  return { st: r.status, at, row: w.inserts[0] };
};
const post = async (body, auth) => { const r = await onRequest({ request: new Request(URL0, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json', Origin: 'https://tapugan-safety.pages.dev', ...(auth ? { Authorization: 'Bearer ' + auth } : {}) } }), env: ENV }); let j = null; try { j = await r.json(); } catch (e) { j = null; } return { st: r.status, j }; };
const kept = (id) => Object.keys(store).filter((k) => k.startsWith(DOCS_BUCKET + '/induction-docs/' + id + '/')).sort();
const pages = (p) => (p && p.txt.match(/page-break-before:always/g) || []).length;

console.log('\n1. the photos are kept before the filing, and deleted once it is filed and mailed');
{
  reset();
  const r = await sign('ind1', { doc: [jpg(6000, 1), jpg(6000, 2)] });
  check('signed (200); when the answer left, both photos were already stored (uploads finished) and nothing was filed yet', r.st === 200 && r.at.keeps === 2 && r.at.puts === 0, r.at);
  check('the private bucket, one folder per signature: backups/induction-docs/<row id>/1.jpg, 2.jpg', DOCS_BUCKET === 'backups' && w.seq.indexOf('keep') < w.seq.indexOf('put'), w.seq);
  const src = w.puts.find((p) => p.path.startsWith('Apps/Tapugan Safety/'));
  check('the form has both photos, and it was mailed', pages(src) === 2 && w.mails.length === 1);
  check('filed and mailed: the kept photos are deleted (one call, the exact paths)', w.dels.length === 1 && w.dels[0].bucket === 'backups' && JSON.stringify(w.dels[0].prefixes) === JSON.stringify(['induction-docs/' + r.row.id + '/1.jpg', 'induction-docs/' + r.row.id + '/2.jpg']) && kept(r.row.id).length === 0, w.dels);
  check('the row says nothing about kept photos', w.patches[w.patches.length - 1].b.doc_err === null, w.patches[w.patches.length - 1].b);
  reset();
  await sign('ind1');
  check('no photos: nothing kept, nothing deleted', !w.seq.includes('keep') && !w.dels.length);
}

console.log('\n2. the filing fails: the photos stay, and the row says so');
let failedId;
{
  reset({ putFail: true });
  const r = await sign('ind1', { doc: [jpg(6000, 3), jpg(6000, 4)] });
  failedId = r.row.id;
  const e = w.patches[w.patches.length - 1].b.doc_err || '';
  check('not filed: both photos still in Storage, nothing deleted', kept(r.row.id).length === 2 && !w.dels.length, kept(r.row.id));
  check('doc_err: the reason, and "2 ' + DOCS_KEPT_NOTE + '"', /onedrive 507/.test(e) && e.includes('2 ' + DOCS_KEPT_NOTE), e);
  reset({ mailFail: true });
  const r2 = await sign('ind1', { doc: [jpg(6000, 5)] });
  const e2 = w.patches[w.patches.length - 1].b.doc_err || '';
  check('filed but the mail failed: kept too (the form did not reach HR)', kept(r2.row.id).length === 1 && !w.dels.length && e2.includes('1 ' + DOCS_KEPT_NOTE), e2);
}

console.log('\n3. Storage refuses the photos: the signature is still saved and the form still has them');
{
  reset({ keepFail: true });
  const r = await sign('ind1', { doc: [jpg(6000, 6), jpg(6000, 7)] });
  const src = w.puts.find((p) => p.path.startsWith('Apps/Tapugan Safety/'));
  check('signed (200), the row inserted, the form filed with both photos and mailed', r.st === 200 && w.inserts.length === 1 && pages(src) === 2 && w.mails.length === 1);
  check('nothing to delete, and no "kept" note', !w.dels.length && !String(w.patches[w.patches.length - 1].b.doc_err || '').includes(DOCS_KEPT_NOTE));
  reset({ keepFail: true, putFail: true });
  await sign('ind1', { doc: [jpg(6000, 8)] });
  check('nothing kept and the filing failed: the row does not promise kept photos', !String(w.patches[w.patches.length - 1].b.doc_err || '').includes(DOCS_KEPT_NOTE), w.patches[w.patches.length - 1].b);
}

console.log('\n4. "send again" from "who signed" (op refile)');
{
  reset();
  const none = await post({ op: 'refile', id: failedId });
  const viewer = await post({ op: 'refile', id: failedId }, 'bad');
  check('manager only: no login 401, a viewer 403, nothing filed or deleted', none.st === 401 && viewer.st === 403 && !w.puts.length && !w.mails.length && !w.dels.length && kept(failedId).length === 2, [none.st, viewer.st]);
  const lost = await post({ op: 'refile', id: 'nope' }, 'good');
  check('an unknown row: 404', lost.st === 404, lost);
  reset({ putFail: true });
  const again = await post({ op: 'refile', id: failedId }, 'good');
  check('still failing: 502 with the reason, the photos stay', again.st === 502 && again.j && again.j.ok === false && /onedrive 507/.test(again.j.error || '') && kept(failedId).length === 2 && !w.dels.length, again);
  reset();
  const ok = await post({ op: 'refile', id: failedId }, 'good');
  const src = w.puts.find((p) => p.path.startsWith('Apps/Tapugan Safety/'));
  check('the form rebuilt with the 2 kept photos and the signature, filed and mailed', ok.st === 200 && ok.j.ok === true && ok.j.mailed === true && ok.j.docs === 2 && /od\.example/.test(ok.j.url || '') && pages(src) === 2 && src.txt.includes('data:image/png;base64,' + Buffer.from(png).toString('base64')) && w.mails.length === 1, ok.j);
  check('the listing asked for the row folder', w.listed && w.listed.prefix === 'induction-docs/' + failedId + '/', w.listed);
  check('then the kept photos are deleted, and the row is clean', kept(failedId).length === 0 && w.dels.length === 1 && rows[failedId].mailed_at && rows[failedId].doc_err === null, rows[failedId]);
  reset();
  await sign('wk1');
  const wid = Object.keys(rows).find((k) => rows[k].talk_id === 'wk1');
  const wk = await post({ op: 'refile', id: wid }, 'good');
  check('a weekly talk row: 409, nothing sent', wk.st === 409 && !w.mails.length, wk);
}

console.log('\n5. the app: a "send again" button where the form was not sent');
{
  const html = (await import('fs')).readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  const tag = html.slice(html.indexOf('function _tbtDocTag('), html.indexOf('function _tbtQuizTag('));
  check('the not-sent line carries the button, and it posts op refile with the row id', /\\u05dc\\u05d0 \\u05e0\\u05e9\\u05dc\\u05d7: '\+esc\(String\(x\.doc_err\)\.substring\(0,80\)\)\+'<\/div>'\+_tbtRefileBtn\(x\)/.test(tag) && /_tbtMissPost\(\{op:'refile',id:id\}\)/.test(tag) && /onclick="tbtRefile\(this\.dataset\.id,this\)"/.test(tag));
  check('a viewer is blocked before any call', /function tbtRefile\(id,btn\)\{\s*if\(_viewOnly\(\)\)\{_viewBlock\(\);/.test(tag));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
