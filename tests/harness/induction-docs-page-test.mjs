// The induction page (form 08.02.01): photographing documents (13/10/2026, Michael: "a place to
// photograph the documents for a new worker, it can be several"; questionnaire: embedded in the
// PDF, free photos). Rendered from the real talk.js with its own CSP header, in Chromium at phone
// width: the camera button, each photo shrunk to a JPEG in a hidden "doc" field, remove, the count,
// and no camera button on a weekly talk. The buttons are <label>s around the inputs (13/10/2026, Michael:
// "it does not let me open the camera"): a script click on a hidden input does nothing in some
// in-app browsers, a label opens the picker natively. A second label without capture: the gallery.
// On a Chrome tablet the gallery opened and the camera did not (13/10/2026), so the camera button
// opens a live camera inside the page (getUserMedia, a fake camera here), with a clear message when
// the browser blocks it; without mediaDevices the label still opens the file input.
import { createRequire } from 'module';
import { onRequest, makeTalkToken, makeCodeCookie, MAX_DOCS } from './_build/talk.mjs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 300) : '')); } };
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'srv', TRUSTEE_NOTIFY_SECRET: 'nsec', GEMINI_API_KEY: 'g' };
const T = {
  ind1: { id: 'ind1', d: null, title: 'הוראות כניסה למשמרת', body: '1. חירום', s: 'פורסמה', kind: 'induction', link_v: 0 },
  wk1: { id: 'wk1', d: '2026-10-11', title: 'סולמות', body: 'x', s: 'פורסמה', kind: null, link_v: 0 },
};
globalThis.fetch = async (u) => {
  u = String(u);
  const j = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });
  if (u.includes('/rest/v1/toolbox_talks')) { const id = decodeURIComponent((u.match(/id=eq\.([^&]+)/) || [])[1] || ''); return j(Object.values(T).filter((t) => t.id === id)); }
  if (u.includes('/rest/v1/emp')) return j([{ id: 'e1', n: 'דנה כהן', dep: 'ייצור' }]);
  if (u.includes('/rest/v1/server_state')) return j([{ value: '246810' }]);
  if (u.includes('/rest/v1/toolbox_reads')) return j([]);
  return j({}, 599);
};
const render = async (id) => {
  const k = await makeTalkToken(ENV, id);
  const r = await onRequest({ request: new Request('https://tapugan-safety.pages.dev/api/talk?k=' + encodeURIComponent(k) + '&l=he', { headers: { cookie: 'tsind=' + (await makeCodeCookie(ENV, id, '246810')) } }), env: ENV });
  return { html: await r.text(), csp: r.headers.get('Content-Security-Policy') };
};
// A real JPEG made by the browser itself, 3000x2000 (a phone photo is bigger than the 1400px kept).
const ind = await render('ind1'), wk = await render('wk1');
const browser = await pw.chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
const ctx = await browser.newContext({ viewport: { width: 375, height: 800 } });
await ctx.grantPermissions(['camera'], { origin: 'https://x.test' });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
await page.route('https://x.test/p', (rt) => rt.fulfill({ status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': ind.csp }, body: ind.html }));
await page.goto('https://x.test/p');
check('the induction page has the camera button and the section title', await page.locator('#dadd').count() === 1 && /צילום מסמכים/.test(await page.textContent('body')));
const photo = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 3000; c.height = 2000; const x = c.getContext('2d'); x.fillStyle = '#c00'; x.fillRect(0, 0, 3000, 2000); x.fillStyle = '#fff'; x.fillRect(100, 100, 800, 400); return c.toDataURL('image/jpeg', 0.95).split(',')[1]; });
check('the camera button is a <label> holding the capture input (no script click)', await page.evaluate(() => { const l = document.getElementById('dadd'), f = document.getElementById('dfile'); return l.tagName === 'LABEL' && l.contains(f) && f.getAttribute('capture') === 'environment' && getComputedStyle(f).display !== 'none'; }) && !/\.click\(\)/.test(ind.html));
check('a gallery label with an input without capture', await page.evaluate(() => { const l = document.getElementById('dgal'), f = document.getElementById('dfile2'); return !!l && l.tagName === 'LABEL' && l.contains(f) && !f.hasAttribute('capture'); }));
const chooser = async (sel) => { const p = page.waitForEvent('filechooser', { timeout: 3000 }).then(() => true, () => false); await page.click(sel); return p; };
check('tapping the gallery button opens the picker', await chooser('#dgal'));
const add = async () => { await page.setInputFiles('#dfile', { name: 'p.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(photo, 'base64') }); await page.waitForTimeout(400); };
await add(); await page.setInputFiles('#dfile2', { name: 'g.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(photo, 'base64') }); await page.waitForTimeout(400);
const st = await page.evaluate(() => { const h = [...document.querySelectorAll('input[name="doc"]')]; const im = new Image(); return { n: h.length, jpeg: h.every((x) => /^data:image\/jpeg;base64,/.test(x.value)), kb: h.map((x) => Math.round(x.value.length * 0.75 / 1024)), cnt: document.getElementById('dcnt').textContent, inForm: h.every((x) => x.form && x.form.id === 'f') }; });
check('a photo from the camera and one from the gallery: two hidden "doc" fields inside the form, JPEG', st.n === 2 && st.jpeg && st.inForm, st);
check('each shrunk well under the 900KB limit', st.kb.every((k) => k > 2 && k < 900), st.kb);
check('the count says 2', /2/.test(st.cnt), st.cnt);
const w = await page.evaluate(() => { const im = document.querySelector('#dbox img'); return new Promise((res) => { const i = new Image(); i.onload = () => res(i.naturalWidth); i.src = im.src; }); });
check('shrunk to 1400px on the long side', w === 1400, w);
await page.click('#dbox button');
check('remove takes one away', await page.locator('input[name="doc"]').count() === 1 && /1/.test(await page.textContent('#dcnt')));
check('no page error (CSP allows the data: images)', errs.length === 0, errs);
// The live camera: tap, the picture, shutter adds a photo, done closes it and stops the camera.
await page.click('#dadd');
await page.waitForSelector('#camov video', { timeout: 3000 }).catch(() => {});
await page.waitForFunction(() => { const b = document.getElementById('camshot'), v = document.querySelector('#camov video'); return b && !b.disabled && v && v.videoWidth > 0; }, null, { timeout: 5000 }).catch(() => {});
check('tapping the camera button opens a live camera in the page', await page.evaluate(() => { const v = document.querySelector('#camov video'); return !!v && v.videoWidth > 0 && !document.getElementById('camshot').disabled; }), await page.evaluate(() => ({ ov: !!document.getElementById('camov'), msg: (document.getElementById('cammsg') || {}).textContent, vw: (document.querySelector('video') || {}).videoWidth })));
await page.click('#camshot', { timeout: 3000 }).catch(() => {}); await page.waitForTimeout(500);
check('the shutter adds a photo (2 now) and the camera stays open for the next one', await page.locator('input[name="doc"]').count() === 2 && await page.locator('#camov').count() === 1 && /2/.test(await page.textContent('#dcnt')));
await page.click('#camdone', { timeout: 3000 }).catch(() => {});
check('done closes the camera and stops it', await page.locator('#camov').count() === 0 && await page.evaluate(() => !document.querySelector('video')));
const pp = async (perm, init) => { const c = await browser.newContext({ viewport: { width: 375, height: 800 } }); if (perm) await c.grantPermissions(['camera'], { origin: 'https://x.test' }); if (init) await c.addInitScript(init); const p = await c.newPage(); await p.route('https://x.test/p', (rt) => rt.fulfill({ status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': ind.csp }, body: ind.html })); await p.goto('https://x.test/p'); return p; };
const den = await pp(true, () => { navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('denied', 'NotAllowedError')); });
await den.click('#dadd'); await den.waitForFunction(() => { const m = document.getElementById('cammsg'); return m && m.textContent.length > 5; }, null, { timeout: 5000 }).catch(() => {});
check('camera blocked: a message saying how to allow it, no shutter', await den.evaluate(() => { const m = document.getElementById('cammsg'); return !!m && /חוסם את המצלמה/.test(m.textContent) && /הרשאות/.test(m.textContent) && document.getElementById('camshot').style.display === 'none'; }), await den.evaluate(() => (document.getElementById('cammsg') || {}).textContent));
const old = await pp(false, () => { Object.defineProperty(navigator, 'mediaDevices', { value: undefined }); });
const fc = old.waitForEvent('filechooser', { timeout: 3000 }).then(() => true, () => false); await old.click('#dadd');
check('a browser without mediaDevices: the button opens the file input with capture', await fc);
check('a weekly talk has no camera button', !/id="dadd"/.test(wk.html));
check('the limit is in the page', ind.html.includes('>=' + MAX_DOCS + ')'));
await browser.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
