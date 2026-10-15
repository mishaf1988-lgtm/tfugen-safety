// What a worker typed survives a failed send (15/10/2026, Michael: "no stops and no data that
// disappears", review of the outside pages). Before this, every error page and every lost POST
// came back to an empty form: the name, the ID, the tick and the drawn signature were gone, and
// at the induction the photographed documents too. Now the page keeps a draft in sessionStorage
// (15 minutes, cleared by the "saved" page so the next worker on the same phone starts empty).
// Also: Hebrew job/agency with digits are kept as typed (heText), every fetch has a time limit,
// and the annual/induction pages do not read the workers table.
import { createRequire } from 'module';
import { onRequest, makeTalkToken, makeGroupToken, makeCodeCookie, heText, FETCH_MS } from './_build/talk.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 400) : '')); } };
const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../../functions/api/talk.js'), 'utf8');
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'srv', TRUSTEE_NOTIFY_SECRET: 'nsec', GEMINI_API_KEY: 'g' };
const TALK = { id: 't1', d: '2026-10-15', s: 'פורסמה', title: 'עבודה בגובה', body: 'לבדוק רתמה.' };
const EMPS = [{ id: 'e1', n: 'דנה כהן', dep: 'ייצור', eid: '123456789' }];
let insertOk = false, inserts = 0, empReads = 0, talkRow = TALK, signals = 0, calls = 0;
globalThis.fetch = async (u, o) => {
  u = String(u); calls++; if (o && o.signal instanceof AbortSignal) signals++;
  const j = (x, s = 200) => new Response(JSON.stringify(x), { status: s, headers: { 'Content-Type': 'application/json' } });
  const m = (o && o.method) || 'GET';
  if (u.includes('/rest/v1/toolbox_talks')) return j([talkRow]);
  if (u.includes('/rest/v1/emp')) { empReads++; return j(EMPS); }
  if (u.includes('/storage/v1/object/')) return j({ Key: 'x' });
  if (u.includes('/rest/v1/toolbox_reads') && m === 'POST') { inserts++; return insertOk ? j([], 201) : j({ message: 'down' }, 503); }
  if (u.includes('/rest/v1/toolbox_reads')) return j([]);
  if (u.includes('/rest/v1/rpc/')) return j(1);
  if (u.includes('/rest/v1/server_state')) return j([{ value: '246810' }]);
  return j({}, 404);
};

console.log('\n1. free text in Hebrew, and the time limit');
check('heText keeps a Hebrew job with a digit, a slash, a comma', heText('מפעיל קו 3') === 'מפעיל קו 3' && heText('ייצור/אריזה, משמרת ב') === 'ייצור/אריזה, משמרת ב' && heText('כ"א 2000') === 'כ"א 2000');
check('heText refuses Latin letters, digits only, tags and over 60', heText('operator 3') === null && heText('2000') === null && heText('<b>שם</b>') === null && heText('א'.repeat(61)) === null);
check('job, agency and company go through textHe (heText first, then the assistant checked as text)', /textHe\(env, request, f\.v\.job\)/.test(src) && /textHe\(env, request, f\.v\.agency\)/.test(src) && /textHe\(env, request, comp\)/.test(src) && /export async function textHe[\s\S]{0,120}const direct = heText\(raw\)/.test(src));

(async () => {
  const tok = await makeTalkToken(ENV, 't1');
  calls = 0; signals = 0;
  await onRequest({ request: new Request('https://tapugan-safety.pages.dev/api/talk?k=' + encodeURIComponent(tok)), env: ENV });
  check('every fetch of a page view carries a time limit (AbortSignal), ' + FETCH_MS / 1000 + 's', calls > 0 && signals === calls && FETCH_MS === 20000, [calls, signals]);
  for (const kind of ['annual', 'induction']) {
    talkRow = { ...TALK, kind, subjects: ['ריתוך'] }; empReads = 0;
    const r = await onRequest({ request: new Request('https://tapugan-safety.pages.dev/api/talk?k=' + encodeURIComponent(await makeTalkToken(ENV, 't1'))), env: ENV });
    check(kind + ' page: no read of the workers table (the name is typed)', empReads === 0 && r.status !== 500, [empReads, r.status]);
  }
  talkRow = TALK;

  console.log('\n2. the draft in a real browser');
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  await ctx.route('https://tapugan-safety.pages.dev/**', async (route) => {
    const q = route.request();
    const r = await onRequest({ request: new Request(q.url(), { method: q.method(), headers: q.headers(), body: q.method() === 'POST' ? q.postDataBuffer() : undefined }), env: ENV, waitUntil: () => {} });
    try { await route.fulfill({ status: r.status, headers: Object.fromEntries(r.headers), body: Buffer.from(await r.arrayBuffer()) }); } catch (e) { /* the page was closed first */ }
  });
  const page = await ctx.newPage();
  const url = 'https://tapugan-safety.pages.dev/api/talk?k=' + encodeURIComponent(tok);
  await page.goto(url);
  await page.selectOption('#emp', 'e1');
  await page.fill('#oid', '123456789');
  await page.check('input[name=ok]');
  const pad = await page.locator('#pad').boundingBox();
  await page.mouse.move(pad.x + 30, pad.y + 40); await page.mouse.down(); await page.mouse.move(pad.x + 200, pad.y + 120, { steps: 8 }); await page.mouse.up();
  insertOk = false;
  await Promise.all([page.waitForNavigation(), page.click('#go')]);
  const errText = await page.textContent('body');
  check('the database refuses: an error page, nothing saved', inserts >= 1 && !/תודה/.test(errText), errText.slice(0, 120));
  await page.goto(url);
  await page.waitForTimeout(300);
  const st = await page.evaluate(() => ({ emp: document.getElementById('emp').value, oid: document.getElementById('oid').value, ok: document.querySelector('input[name=ok]').checked,
    ink: (() => { const c = document.getElementById('pad'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n; })() }));
  check('back to the form: the name, the ID, the tick and the drawn signature are all there', st.emp === 'e1' && st.oid === '123456789' && st.ok && st.ink > 50, st);
  insertOk = true;
  await Promise.all([page.waitForNavigation(), page.click('#go')]);
  check('...and it is sent as is, without drawing again', /תודה/.test(await page.textContent('body')), (await page.textContent('body')).slice(0, 120));
  const left = await page.evaluate(() => Object.keys(sessionStorage).filter((k) => /^tlkd:/.test(k)).length);
  check('the "saved" page clears the draft', left === 0, left);
  await page.goto(url);
  await page.waitForTimeout(300);
  const st2 = await page.evaluate(() => ({ emp: document.getElementById('emp').value, oid: document.getElementById('oid').value }));
  check('the next worker on the same phone starts empty', st2.emp === '' && st2.oid === '', st2);
  // 15/10/2026 (C3): saved half a second after typing stops, not on every key
  await page.fill('#oid', '987654321');
  await page.waitForTimeout(100);
  const early = await page.evaluate(() => Object.keys(sessionStorage).filter((x) => /^tlkd:/.test(x)).length);
  await page.waitForTimeout(700);
  const late = await page.evaluate(() => Object.keys(sessionStorage).filter((x) => /^tlkd:/.test(x)).length);
  check('the draft is saved ~500ms after typing stops, not on every key (C3)', early === 0 && late === 1, [early, late]);
  const age = (min) => page.evaluate((m) => { Object.keys(sessionStorage).filter((x) => /^tlkd:/.test(x) && !/:d$/.test(x)).forEach((k) => { const o = JSON.parse(sessionStorage.getItem(k)); o.at -= m * 60000; sessionStorage.setItem(k, JSON.stringify(o)); }); }, min);
  // 15/10/2026 (C1): a personal link keeps the draft 90 minutes; group mode (the phone passed on) 15
  await age(16);
  await page.goto(url);
  await page.waitForTimeout(300);
  check('a personal link: a draft 16 minutes old is still restored (C1: 90 minutes)', (await page.evaluate(() => document.getElementById('oid').value)) === '987654321');
  await page.waitForTimeout(700);
  await age(91);
  await page.goto(url);
  await page.waitForTimeout(300);
  check('...and one older than 90 minutes is not', (await page.evaluate(() => document.getElementById('oid').value)) === '');
  const gurl = 'https://tapugan-safety.pages.dev/api/talk?k=' + encodeURIComponent(await makeGroupToken(ENV, 't1')) + '&g=1';
  await page.goto(gurl);
  await page.fill('#oid', '555666777');
  await page.waitForTimeout(700);
  await age(16);
  await page.goto(gurl);
  await page.waitForTimeout(300);
  check('group mode: a draft older than 15 minutes is not restored (a phone passed on in a hall)', (await page.evaluate(() => document.getElementById('oid').value)) === '');

  console.log('\n3. a restore keeps everything, also after two reloads (C2, C4), and the agency (B1)');
  const ink = () => page.evaluate(() => { const c = document.getElementById('pad'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n; });
  const draw = async () => { const b = await page.locator('#pad').boundingBox(); await page.mouse.move(b.x + 30, b.y + 40); await page.mouse.down(); await page.mouse.move(b.x + 220, b.y + 130, { steps: 8 }); await page.mouse.up(); };
  talkRow = { ...TALK, quiz: [{ q: 'שאלה', a: ['לא נכון', 'נכון'], c: 1 }, { q: 'שנייה', a: ['כן', 'לא'], c: 0 }] };
  await page.goto(url);
  await page.click('fieldset[data-q="0"] input[value="0"]');   // first answer: wrong
  await page.click('fieldset[data-q="0"] input[value="1"]');   // then changed to the right one
  await page.click('fieldset[data-q="1"] input[value="0"]');
  await page.selectOption('#emp', 'e1'); await page.fill('#oid', '123456789'); await page.check('input[name=ok]');
  await draw();
  await page.waitForTimeout(700);
  for (let i = 0; i < 2; i++) { await page.reload(); await page.waitForTimeout(500); }
  const q = await page.evaluate(() => ({ qa: document.getElementById('qa').value, t0: (document.querySelector('fieldset[data-q="0"] input:checked') || {}).value, t1: (document.querySelector('fieldset[data-q="1"] input:checked') || {}).value, r0: document.querySelector('fieldset[data-q="0"] .qr').textContent, emp: document.getElementById('emp').value }));
  const k2 = await ink();
  check('after two reloads: the ticked answers, the first-answer record ("0:0", the score stays honest) and the name', q.qa === '0:0,1:0' && q.t0 === '1' && q.t1 === '0' && /✓/.test(q.r0) && q.emp === 'e1', q);
  check('after two reloads: the signature is still there (C4: a restore no longer saves an empty one)', k2 > 50, k2);
  talkRow = TALK;

  // The induction page: an agency worker, no worker number (B1), a photo (C5), the HR code cookie
  talkRow = { ...TALK, id: 't1', kind: 'induction', title: 'קליטה' };
  await ctx.addCookies([{ name: 'tsind', value: await makeCodeCookie(ENV, 't1', '246810'), domain: 'tapugan-safety.pages.dev', path: '/api/talk', secure: true, httpOnly: true }]);
  await page.goto(url);
  await page.fill('#oname', 'דני חדש'); await page.fill('#oid', '123456789'); await page.selectOption('#idep', { index: 1 });
  await page.fill('#iph', '0521234567'); await page.fill('#ijob', 'מפעיל'); await page.fill('#iagn', 'כוח אדם בע"מ');
  await page.check('input[name=ok]'); await draw();
  const jpg0 = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 300; c.height = 200; const x = c.getContext('2d'); x.fillStyle = '#c33'; x.fillRect(0, 0, 300, 200); x.fillStyle = '#fff'; x.fillRect(40, 40, 120, 60); return c.toDataURL('image/jpeg', 0.8); });
  await page.evaluate((d) => window.__tlkAdd(d), jpg0);
  await page.waitForTimeout(800);
  const stored = await page.evaluate(() => document.querySelector('input[name=doc]').value);
  for (let i = 0; i < 2; i++) { await page.reload(); await page.waitForTimeout(600); }
  const ind = await page.evaluate(() => ({ ag: document.getElementById('iagn').value, req: document.getElementById('ino').required, docs: Array.prototype.map.call(document.querySelectorAll('input[name=doc]'), (h) => h.value) }));
  check('agency restored, and the worker number no longer required (B1: the restore fires "change" only)', ind.ag === 'כוח אדם בע"מ' && ind.req === false, ind.ag + ' ' + ind.req);
  check('the photo restored exactly as it was, not shrunk again (C5)', ind.docs.length === 1 && ind.docs[0] === stored, [ind.docs.length, stored.length, ind.docs[0] && ind.docs[0].length]);
  check('the signature restored on the induction page too', (await ink()) > 50);
  insertOk = true; inserts = 0;
  await Promise.all([page.waitForNavigation(), page.click('#go')]);
  check('...and the browser lets it be sent (no empty "worker number" refusal)', inserts === 1 && /תודה/.test(await page.textContent('body')), [inserts, (await page.textContent('body')).slice(0, 80)]);

  console.log('\n4. photos over the limit are shrunk, or refused with a message (A2)');
  await page.goto(url);
  const alerts = []; page.on('dialog', (d) => { alerts.push(d.message()); d.dismiss().catch(() => {}); });
  const noise = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 2000; c.height = 2000; const x = c.getContext("2d"); const im = x.createImageData(2000, 2000); for (let i = 0; i < im.data.length; i++) im.data[i] = (Math.random() * 256) | 0; x.putImageData(im, 0, 0); return c.toDataURL('image/jpeg', 0.95); });
  await page.evaluate((d) => window.__tlkAdd(d), noise);
  for (let k = 0; k < 150 && !alerts.length && !(await page.evaluate(() => document.querySelectorAll('input[name=doc]').length)); k++) await page.waitForTimeout(100);
  const sz = await page.evaluate(() => { const v = (document.querySelector('input[name=doc]') || {}).value || ''; return v ? Math.floor((v.length - v.indexOf(',') - 1) * 3 / 4) : -1; });
  check('a photo of ' + Math.round(noise.length * 3 / 4 / 1024) + 'KB is shrunk to ' + Math.round(sz / 1024) + 'KB, under 600KB (the server takes up to 900KB)', sz <= 600 * 1024 && sz > 50 * 1024 && noise.length * 3 / 4 > 900 * 1024, sz);
  for (let i = 0; i < 7; i++) {
    const n0 = await page.evaluate(() => document.querySelectorAll('input[name=doc]').length), a0 = alerts.length;
    await page.evaluate((d) => window.__tlkAdd(d), noise);
    for (let k = 0; k < 200; k++) { await page.waitForTimeout(100); if (alerts.length > a0 || (await page.evaluate(() => document.querySelectorAll('input[name=doc]').length)) > n0) break; }
  }
  const after = await page.evaluate(() => { let t = 0; const l = document.querySelectorAll('input[name=doc]'); l.forEach((h) => { t += Math.floor((h.value.length - h.value.indexOf(',') - 1) * 3 / 4); }); return { n: l.length, t }; });
  check('past ~3.8MB in all: the photo is refused on the phone with a message, the total stays under the server\'s 4MB', after.t <= 3.8 * 1024 * 1024 && after.n < 8 && alerts.some((m) => /אין מקום לעוד תמונה/.test(m)), { after, alerts });
  page.removeAllListeners('dialog');
  talkRow = TALK;

  console.log('\n5. Arabic-Indic digits (B5), a send that never answers (B8), group mode back from the cache (C6)');
  await page.goto(url);
  await page.fill('#oid', '١٢٣٤٥٦٧٨٩');
  check('Arabic-Indic digits in the ID box become 0-9 as they are typed', (await page.evaluate(() => document.getElementById('oid').value)) === '123456789');
  await page.goto(gurl);
  await page.selectOption('#emp', 'e1'); await page.fill('#oid', '123456789'); await page.check('input[name=ok]'); await draw();
  await page.waitForTimeout(700);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  const gs = await page.evaluate(() => ({ emp: document.getElementById('emp').value, oid: document.getElementById('oid').value, ok: document.querySelector('input[name=ok]').checked, d: Object.keys(sessionStorage).filter((k) => /^tlkd:g:/.test(k)).length }));
  const gi = await ink();
  check('group mode, a page back from the cache: name, ID, tick, signature and draft all cleared for the next worker', gs.emp === '' && gs.oid === '' && !gs.ok && gi === 0 && gs.d === 0, [gs, gi]);
  const p2 = await ctx.newPage();
  await p2.clock.install();
  // a send that never gets an answer: the form's own handler runs, the browser never leaves the page
  await p2.goto(url); await p2.evaluate(() => document.addEventListener('submit', (e) => e.preventDefault()));
  await p2.selectOption('#emp', 'e1'); await p2.fill('#oid', '123456789'); await p2.check('input[name=ok]');
  { const b = await p2.locator('#pad').boundingBox(); await p2.mouse.move(b.x + 30, b.y + 40); await p2.mouse.down(); await p2.mouse.move(b.x + 200, b.y + 120, { steps: 6 }); await p2.mouse.up(); }
  await p2.click('#go', { noWaitAfter: true });
  await p2.waitForTimeout(200);
  const s1 = await p2.evaluate(() => ({ d: document.getElementById('go').disabled, t: document.getElementById('go').textContent }));
  await p2.clock.runFor(46000);
  const s2 = await p2.evaluate(() => ({ d: document.getElementById('go').disabled, t: document.getElementById('go').textContent }));
  check('no answer: "saving..." for a while, then the button works again after ~45s (B8)', s1.d === true && s2.d === false && s2.t !== s1.t, [s1, s2]);
  await p2.close();

  console.log('\n6. a phone without pointer events signs with touch (B10)');
  const tctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true });
  await tctx.addInitScript(() => { delete window.PointerEvent; });
  await tctx.route('https://tapugan-safety.pages.dev/**', async (route) => {
    const q2 = route.request();
    const r = await onRequest({ request: new Request(q2.url(), { method: q2.method(), headers: q2.headers() }), env: ENV, waitUntil: () => {} });
    await route.fulfill({ status: r.status, headers: Object.fromEntries(r.headers), body: Buffer.from(await r.arrayBuffer()) });
  });
  const tp = await tctx.newPage();
  await tp.goto(url);
  const tink = await tp.evaluate(() => { const c = document.getElementById('pad'), r = c.getBoundingClientRect();
    const t = (type, x, y) => { const touch = new Touch({ identifier: 1, target: c, clientX: r.left + x, clientY: r.top + y }); c.dispatchEvent(new TouchEvent(type, { touches: type === 'touchend' ? [] : [touch], changedTouches: [touch], bubbles: true, cancelable: true })); };
    t('touchstart', 20, 20); for (let i = 1; i < 10; i++) t('touchmove', 20 + i * 20, 20 + i * 12); t('touchend', 200, 128);
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return { n, pe: typeof window.PointerEvent }; });
  check('no PointerEvent: a finger still draws the signature', tink.pe === 'undefined' && tink.n > 50, tink);
  await tctx.close();
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('  ✗ crashed: ' + (e && e.stack)); process.exit(1); });
