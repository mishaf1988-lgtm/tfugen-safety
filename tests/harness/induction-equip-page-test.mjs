// The equipment declaration on the induction page (08/11/2026, Michael sent the paper form "הצהרה על קבלת
// ציוד והחזרתו": HR fills the items and quantities, the worker signs; HR writes to whom it is returned).
// Rendered from the real talk.js with its own CSP, in Chromium at phone width: the HR table, the "to whom"
// typed by HR shows inside the declaration at once (the script runs under the CSP), the Russian page shows
// the declaration in Russian, and a weekly talk has no such block. A screenshot for the eye: EQ_SHOT=<path>.
import { createRequire } from 'module';
import { onRequest, makeTalkToken, makeCodeCookie, inductionHtml } from './_build/talk.mjs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 300) : '')); } };
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'srv', TRUSTEE_NOTIFY_SECRET: 'nsec', GEMINI_API_KEY: 'g' };
const T = {
  ind1: { id: 'ind1', d: null, title: 'הוראות כניסה למשמרת', body: '1. חירום', body_ru: '1. Тревога', s: 'פורסמה', kind: 'induction', link_v: 0 },
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
const ind = await render('ind1'), wk = await render('wk1');
const browser = await pw.chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 375, height: 800 }, deviceScaleFactor: 1 })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.route('https://x.test/p', (rt) => rt.fulfill({ status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': ind.csp }, body: ind.html }));
await page.goto('https://x.test/p');
check('the induction page has the equipment block with the five items and two free rows', await page.locator('#eqbox').count() === 1 && await page.locator('#eqbox input[name^="eqq"]').count() === 5 && await page.locator('#eqbox input[name^="eqn"]').count() === 2);
check('the block comes before the signature', await page.evaluate(() => document.getElementById('eqbox').compareDocumentPosition(document.getElementById('pad')) & 4) > 0);
check('"to whom" starts as HR, and the declaration says it', await page.inputValue('#eqr') === 'משאבי אנוש' && (await page.textContent('.eqret')) === 'משאבי אנוש');
await page.fill('#eqr', 'מחסן טכני');
check('HR types "מחסן טכני": the declaration shows it at once (the script runs under the CSP)', (await page.textContent('.eqret')) === 'מחסן טכני');
await page.fill('#eqr', '');
check('cleared: back to HR', (await page.textContent('.eqret')) === 'משאבי אנוש');
check('no quantity is required: the form still sends with an empty table', await page.evaluate(() => [...document.querySelectorAll('#eqbox input')].every((i) => !i.required)));
if (process.env.EQ_SHOT) { await page.fill('#eqq1', '1'); await page.fill('#eqq2', '2'); await page.locator('#eqbox').screenshot({ path: process.env.EQ_SHOT }); }
check('no page errors under the CSP', errs.length === 0, errs);
const ruK = await makeTalkToken(ENV, 'ind1');
const ru = await onRequest({ request: new Request('https://tapugan-safety.pages.dev/api/talk?k=' + encodeURIComponent(ruK) + '&l=ru', { headers: { cookie: 'tsind=' + (await makeCodeCookie(ENV, 'ind1', '246810')) } }), env: ENV });
const ruH = await ru.text();
check('a Russian page: the HR table stays Hebrew, the declaration is in Russian', /ממלאים משאבי אנוש/.test(ruH) && /Декларация о получении и возврате оборудования/.test(ruH), ruH.length);
check('a weekly talk has no equipment block', !wk.html.includes('id="eqbox"'));
if (process.env.EQ_PDF) {
  const h = inductionHtml(T.ind1, { id: 'r1', emp_name: 'דני כהן', id_no: '123456789', equip: { items: [{ n: 'נעלי עבודה', q: 1 }, { n: 'כלי עבודה', q: 1, d: 'מברג, פטיש' }], ret: 'משאבי אנוש' } }, 'iVBORw0KGgo=', 'he', { day: '2026-11-08', hm: '07:05' }, []);
  const p2 = await (await browser.newContext({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 1 })).newPage();
  await p2.setContent(h.slice(h.indexOf('<div style="page-break-before')).replace(/^/, '<html dir="rtl"><body style="font-family:Arial;font-size:13px;margin:24px">'));
  await p2.screenshot({ path: process.env.EQ_PDF, fullPage: true });
}
await browser.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
