// What a worker typed survives a failed send (15/10/2026, Michael: "no stops and no data that
// disappears", review of the outside pages). Before this, every error page and every lost POST
// came back to an empty form: the name, the ID, the tick and the drawn signature were gone, and
// at the induction the photographed documents too. Now the page keeps a draft in sessionStorage
// (15 minutes, cleared by the "saved" page so the next worker on the same phone starts empty).
// Also: Hebrew job/agency with digits are kept as typed (heText), every fetch has a time limit,
// and the annual/induction pages do not read the workers table.
import { createRequire } from 'module';
import { onRequest, makeTalkToken, heText, FETCH_MS } from './_build/talk.mjs';
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
  return j({}, 404);
};

console.log('\n1. free text in Hebrew, and the time limit');
check('heText keeps a Hebrew job with a digit, a slash, a comma', heText('מפעיל קו 3') === 'מפעיל קו 3' && heText('ייצור/אריזה, משמרת ב') === 'ייצור/אריזה, משמרת ב' && heText('כ"א 2000') === 'כ"א 2000');
check('heText refuses Latin letters, digits only, tags and over 60', heText('operator 3') === null && heText('2000') === null && heText('<b>שם</b>') === null && heText('א'.repeat(61)) === null);
check('job, agency and company try heText before the assistant', /heText\(f\.v\.job\) \|\| await nameHe/.test(src) && /heText\(f\.v\.agency\) \|\| await nameHe/.test(src) && /heText\(comp\) \|\| await nameHe/.test(src));

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
    await route.fulfill({ status: r.status, headers: Object.fromEntries(r.headers), body: Buffer.from(await r.arrayBuffer()) });
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
  await page.fill('#oid', '987654321');
  await page.waitForTimeout(100);
  await page.evaluate(() => { const k = Object.keys(sessionStorage).find((x) => /^tlkd:/.test(x)); const o = JSON.parse(sessionStorage.getItem(k)); o.at -= 16 * 60000; sessionStorage.setItem(k, JSON.stringify(o)); });
  await page.goto(url);
  await page.waitForTimeout(300);
  check('a draft older than 15 minutes is not restored (a phone passed on in a hall)', (await page.evaluate(() => document.getElementById('oid').value)) === '');
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('  ✗ crashed: ' + (e && e.stack)); process.exit(1); });
