// Form 08.01 for a big training, built in the manager's browser (15/10/2026, A1). On Cloudflare's free plan a
// request may make 50 calls out; the server loaded each signature with one, so from about 35 signers every
// load failed, storageB64 swallowed it, and the form came out with blank signature cells; a whole-factory
// annual training (600) could never get its form. Now: the server sends the form's HTML with a placeholder per
// signature (op form0801, shell), index.html loads the signatures from Storage with the manager's token, puts
// them in, and posts the finished HTML to /api/talk?op=form0801, which only files and mails it. Here the real
// talk.js and the real index.html, end to end, with 600 signers and one signature that cannot be loaded.
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
import { onRequest, form0801Html, F0801_MISS, F0801_MISS_HTML, F0801_SERVER_MAX, F0801_MAX_BYTES, F0801_BIG_MSG } from './_build/talk.mjs';

const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 400) : '')); } };
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const ORIGIN = 'https://tapugan-safety.pages.dev';
const GR = 'https://graph.microsoft.com/v1.0/';
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'srv', TRUSTEE_NOTIFY_SECRET: 'nsec' };
const N = 600, BAD = 'r317';
const TALK = { id: 'an6', d: '2026-10-20', title: 'הדרכה שנתית לכל המפעל', body: '', subjects: 'כיבוי אש\nמלגזות', s: 'פורסמה', kind: 'annual', link_v: 0, trainer: 'מיכאל פרייליך', trainer_qual: 'ממונה בטיחות', dur: 'שעתיים', trainer_signed_at: '2026-10-20T06:00:00Z', trainer_sig_url: SB + '/storage/v1/object/public/incidents-photos/sig-an6-trainer.png', eff_req: true, eff_ok: true, eff_by: 'מיכאל פרייליך', mail_cc: '' };
const READS = Array.from({ length: N }, (_, i) => ({ id: 'r' + i, emp_name: 'עובד ' + (i + 1), dept: 'אריזה', id_no: String(200000000 + i), sig_url: SB + '/storage/v1/object/public/incidents-photos/sig-an6-r' + i + '.png', read_at: '2026-10-20T07:' + String(i % 60).padStart(2, '0') + ':00Z' }));
const png = new Uint8Array(1024); png.set([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], 0);
let w;
const reset = (reads) => { w = { reads, puts: [], mails: [], patches: [], calls: 0, storage: 0 }; };
globalThis.fetch = async (url, init) => {
  const u = String(url), m = (init && init.method) || 'GET';
  w.calls++;
  const json = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { 'Content-Type': 'application/json' } });
  if (u.startsWith(SB + '/rest/v1/toolbox_talks') && m === 'PATCH') { w.patches.push(JSON.parse(init.body)); return new Response(null, { status: 204 }); }
  if (u.startsWith(SB + '/rest/v1/toolbox_talks')) return json(/id=eq\.an6/.test(u) ? [{ ...TALK }] : []);
  if (u.startsWith(SB + '/rest/v1/toolbox_reads')) return json(w.reads);
  if (u.startsWith(SB + '/storage/v1/object/')) { w.storage++; return new RegExp('-' + BAD + '\\.png').test(u) ? new Response('gone', { status: 404 }) : new Response(png, { status: 200 }); }
  if (u === SB + '/auth/v1/user') { const tok = init.headers.Authorization.replace('Bearer ', ''); return tok === 'good' ? json({ id: 'u1', email: 'michael@tfugen.local' }) : json({ id: 'u2', email: 'rep@tfugen.local' }); }
  if (u.startsWith(SB + '/rest/v1/app_users')) return json([u.includes('michael') ? { role: 'מנהל', active: true } : { role: 'צופה', active: true }]);
  if (u.startsWith(SB + '/rest/v1/oauth_tokens')) return json([{ user_email: 'sviva@tapugan.co.il', refresh_token: 'rt', access_token: 'at', expires_at: new Date(Date.now() + 3600e3).toISOString(), scope: 'Files.ReadWrite Mail.Send' }]);
  if (u.startsWith(GR + 'me/sendMail')) { w.mails.push(JSON.parse(init.body)); return new Response(null, { status: 202 }); }
  if (u.startsWith(GR) && m === 'PUT') { const b = init.body; w.puts.push({ path: decodeURIComponent(u), txt: /html/.test(init.headers['Content-Type']) ? new TextDecoder().decode(b) : '', n: b.length }); return json({ webUrl: 'https://od.example/' + w.puts.length }); }
  if (u.startsWith(GR) && u.includes('format=pdf')) { const b = new Uint8Array(1200); b.set([0x25, 0x50, 0x44, 0x46], 0); return new Response(b, { status: 200 }); }
  return json({ error: 'unexpected ' + u }, 599);
};
const srv = async (url, method, headers, body) => {
  const r = await onRequest({ request: new Request(ORIGIN + url, { method, headers: { Origin: ORIGIN, ...headers }, body: method === 'POST' ? body : undefined }), env: ENV });
  return { status: r.status, text: await r.text() };
};

(async () => {
  console.log('\n1. 600 signers, built in the browser, one signature that cannot be loaded');
  reset(READS);
  const browser = await pw.chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route('**/*', (r) => (r.request().url().startsWith('file://') ? r.continue() : r.abort()));
  const seen = { shell: null, post: null, uploadCalls: 0 };
  await page.exposeFunction('__srv', async (url, method, headers, body) => {
    const c0 = w.calls;
    const r = await srv(url, method, headers, body);
    if (/op=form0801/.test(url)) { seen.post = { url, ct: headers['Content-Type'], body, status: r.status, res: r.text }; seen.uploadCalls = w.calls - c0; }
    else { try { const j = JSON.parse(body); if (j.shell) seen.shell = { status: r.status, j: JSON.parse(r.text) }; } catch (e) { /* not JSON */ } }
    return r;
  });
  await page.goto('file://' + path.resolve(HERE, '../../index.html'), { waitUntil: 'load' });
  await page.waitForTimeout(700);
  const out = await page.evaluate(async ({ bad }) => {
    window.sdb = function () {}; window.addLog = function () {}; window.toast = function () {};
    window._sbToken = 'good'; _currentUser = { username: 'admin' };
    DB.toolbox_talks = [{ id: 'an6', title: 'x', s: 'פורסמה', kind: 'annual', d: '2026-10-20' }];
    const pngB = await new Promise((res) => { const c = document.createElement('canvas'); c.width = 520; c.height = 180; const x = c.getContext('2d'); x.lineWidth = 3; x.beginPath(); x.moveTo(20, 120); x.lineTo(300, 40); x.lineTo(480, 150); x.stroke(); c.toBlob(res, 'image/png'); });
    const st = { n: 0, bad: 0, auth: 0 };
    window.fetch = (u, init) => {
      u = String(u); init = init || {};
      if (u.indexOf('/storage/v1/object/authenticated/') >= 0) { st.n++; if ((init.headers || {}).Authorization === 'Bearer good') st.auth++; if (u.indexOf('-' + bad + '.png') >= 0) { st.bad++; return Promise.resolve(new Response('gone', { status: 404 })); } return Promise.resolve(new Response(pngB, { status: 200 })); }
      if (u.indexOf('/api/talk') === 0) return window.__srv(u, init.method || 'GET', init.headers || {}, init.body).then((r) => new Response(r.text, { status: r.status, headers: { 'Content-Type': 'application/json' } }));
      return Promise.reject(new Error('unexpected ' + u));
    };
    let asked = ''; window.confirm = (m) => { asked = m; return true; };
    const t0 = Date.now();
    const res = await tbtForm0801('an6');
    return { res, asked, st, ms: Date.now() - t0, formAt: DB.toolbox_talks[0].form_at || null };
  }, { bad: BAD });
  const sh = seen.shell, po = seen.post || {};
  check('the server sent the form with a placeholder per signature, loading none (' + N + ' signers + the trainer)', sh && sh.status === 200 && sh.j.sigs.length === N + 1 && (sh.j.html.match(/data:tap-sig,/g) || []).length === N + 2 && !/data:image\/png/.test(sh.j.html), sh && { st: sh.status, n: sh.j.sigs && sh.j.sigs.length });
  check('the browser loaded every signature from Storage with the manager\'s token, 8 at a time, the failed one tried twice', out.st.n === N + 1 + 1 && out.st.auth === out.st.n && out.st.bad === 2, out.st);
  check('the missing signature is reported before filing: "1 ... not loaded"', /^1 חתימות לא נטענו/.test(out.asked), out.asked);
  check('the finished HTML posted as text/html to /api/talk?op=form0801, with miss=1', /^text\/html/.test(po.ct || '') && /^\/api\/talk\?op=form0801&id=an6&miss=1$/.test(po.url || '') && po.status === 200, [po.ct, po.url, po.status]);
  const html = po.body || '';
  const imgs = html.match(/<img class="sig" alt="" src="data:image\/png;base64,[^"]+">/g) || [];
  check('no placeholder left; ' + (N - 1) + ' workers and the trainer (twice) with their signature image', !/data:tap-sig/.test(html) && imgs.length === N - 1 + 2, imgs.length);
  const rows = [...html.matchAll(/<tr><td style="text-align:center">(\d+)<\/td><td>[^<]*<\/td><td>[^<]*<\/td><td dir="ltr" style="text-align:right">[^<]*<\/td><td>(.*?)<\/td><\/tr>/g)];
  const blank = rows.filter((m) => !m[2]);
  check('every one of the ' + N + ' rows has its signature, or says it was not loaded: no blank cell', rows.length === N && blank.length === 0 && rows.filter((m) => m[2] === F0801_MISS_HTML).length === 1 && rows[318 - 1][2] === F0801_MISS_HTML, { rows: rows.length, blank: blank.length });
  // the same builder: talk.js form0801Html with the same signatures gives the very same page
  const srcs = imgs.map((t) => t.slice('<img class="sig" alt="" src="'.length, -2));
  const tr = srcs[0], bySig = {}; let k = 1;
  READS.forEach((x) => { bySig[x.id] = x.id === BAD ? F0801_MISS : srcs[k++]; });
  check('the page built in the browser is exactly talk.js form0801Html for the same signatures', html === form0801Html(TALK, READS, (x) => bySig[x.id], tr), html.length);
  const res = (() => { try { return JSON.parse(po.res); } catch (e) { return {}; } })();
  check('the server filed it (PDF) and mailed it, with the count of missing signatures', res.ok && res.pdf && res.mailed && res.n === N && res.miss === 1 && w.puts.some((p) => /11_הדרכות\/הדרכה שנתית\/2026\/20-10-2026 - הדרכה שנתית לכל המפעל - 08\.01\.pdf:\/content$/.test(p.path)) && w.mails.length === 1 && /חתימות שלא נטענו לטופס: 1/.test(w.mails[0].message.body.content), { res, puts: w.puts.map((p) => p.path), mails: w.mails.length });
  check('the source HTML in the app folder is the page as posted', w.puts.some((p) => /Apps\/Tapugan Safety\/טפסי הדרכה - מקור\//.test(p.path) && p.txt === html));
  check('filing it took ' + seen.uploadCalls + ' calls out on the server (the free plan allows 50), and no Storage read', seen.uploadCalls > 0 && seen.uploadCalls <= 15 && w.storage === 0, [seen.uploadCalls, w.storage]);
  check('the screen says filed, 600 signers, and the one not loaded; form_at on the row', out.res === 'ok' && out.formAt && w.patches.some((p) => p.form_at), out);
  check('no page errors', errors.length === 0, errors);
  console.log('    (600 signatures loaded and built in ' + out.ms + 'ms, ' + Math.round(html.length / 1024) + 'KB)');
  await browser.close();

  console.log('\n2. the upload endpoint: role, size, what it accepts');
  reset(READS);
  const up = (body, auth, extra) => srv('/api/talk?op=form0801&id=an6&miss=0', 'POST', { 'Content-Type': 'text/html; charset=utf-8', ...(auth ? { Authorization: 'Bearer ' + auth } : {}), ...(extra || {}) }, body);
  const ok = '<!doctype html><html lang="he" dir="rtl"><head><meta charset="UTF-8"><title>08.01</title></head><body>x</body></html>';
  check('a viewer is refused (403), nothing filed', (await up(ok, 'rep')).status === 403 && !w.puts.length);
  check('no token: refused', [401, 403].includes((await up(ok)).status));
  check('a page that is not form 08.01: 400, nothing filed', (await up('<html><title>x</title>hello</html>', 'good')).status === 400 && !w.puts.length);
  check('over ' + Math.round(F0801_MAX_BYTES / 1048576) + 'MB: 413, nothing filed', (await up(ok, 'good', { 'Content-Length': String(F0801_MAX_BYTES + 1) })).status === 413 && !w.puts.length);
  { const r = await up(ok, 'good'); const j = JSON.parse(r.text); check('the manager: filed and mailed as it came', r.status === 200 && j.ok && j.n === N && w.puts.some((p) => p.txt === ok) && w.mails.length === 1, j); }
  reset([]);
  check('nobody signed yet: 409, nothing filed', (await up(ok, 'good')).status === 409 && !w.puts.length);

  console.log('\n3. the old server path: small trainings only, never a blank cell');
  const json = (b, auth) => srv('/api/talk', 'POST', { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (auth || 'good') }, JSON.stringify(b));
  reset(READS);
  { const r = await json({ op: 'form0801', id: 'an6' }); check('over ' + F0801_SERVER_MAX + ' signers the server does not build it (413), nothing filed', r.status === 413 && !w.puts.length && w.storage === 0, r.status); }
  { const r = await json({ op: 'close', id: 'an6' }); const j = JSON.parse(r.text);
    check('an older app closing a big training: closed, and a clear message instead of a form with blank signatures', r.status === 200 && j.ok && j.filed === null && j.fileErr === F0801_BIG_MSG && !w.puts.length && w.storage === 0, j); }
  { const r = await json({ op: 'close', id: 'an6', file: false }); const j = JSON.parse(r.text); check('close with file:false (the new app): closed, the server files nothing', r.status === 200 && j.ok && j.filed === null && !j.fileErr && !w.puts.length, j); }
  reset([READS[0], READS[1], READS[317]].map((x) => ({ ...x })));
  { const r = await json({ op: 'form0801', id: 'an6' }); const j = JSON.parse(r.text); const src = (w.puts.find((p) => p.txt) || {}).txt || '';
    check('a small training: the server builds it, the signature it could not load marked in its cell and counted (miss 1)', r.status === 200 && j.ok && j.n === 3 && j.miss === 1 && src.split(F0801_MISS_HTML).length === 2 && (src.match(/<img class="sig" alt="" src="data:image\/png;base64,/g) || []).length === 2 + 2, j); }
  { const r = await json({ op: 'form0801', id: 'an6', preview: true }); const j = JSON.parse(r.text); check('...and its preview says how many are missing', r.status === 200 && j.miss === 1 && j.html.includes(F0801_MISS_HTML), j.miss); }

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('  ✗ crashed: ' + (e && e.stack)); process.exit(1); });
