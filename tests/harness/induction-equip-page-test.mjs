// The equipment declaration on the induction page (08/11/2026, Michael sent the paper form "הצהרה על קבלת
// ציוד והחזרתו": HR fills the items and quantities, the worker signs; HR writes to whom it is returned).
// Rendered from the real talk.js with its own CSP, in Chromium at phone width: the HR table, the "to whom"
// typed by HR shows inside the declaration at once (the script runs under the CSP), the Russian page shows
// the declaration in Russian, and a weekly talk has no such block. A screenshot for the eye: EQ_SHOT=<path>.
import { createRequire } from 'module';
import { onRequest, makeTalkToken, makeCodeCookie, inductionHtml, equipAlertText, equipAlert, equipCheck } from './_build/talk.mjs';
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
check('no quantity is required, only the given/none choice (09/11/2026)', await page.evaluate(() => [...document.querySelectorAll('#eqbox input')].every((i) => !i.required || (i.type === 'radio' && i.name === 'eqc')) && document.querySelectorAll('#eqbox input[name=eqc][required]').length === 2));
if (process.env.EQ_SHOT) { await page.fill('#eqq1', '1'); await page.fill('#eqq2', '2'); await page.locator('#eqbox').screenshot({ path: process.env.EQ_SHOT }); }
check('no page errors under the CSP', errs.length === 0, errs);
const ruK = await makeTalkToken(ENV, 'ind1');
const ru = await onRequest({ request: new Request('https://tapugan-safety.pages.dev/api/talk?k=' + encodeURIComponent(ruK) + '&l=ru', { headers: { cookie: 'tsind=' + (await makeCodeCookie(ENV, 'ind1', '246810')) } }), env: ENV });
const ruH = await ru.text();
check('a Russian page: the HR table stays Hebrew, the declaration is in Russian', /ממלאים משאבי אנוש/.test(ruH) && /Декларация о получении и возврате оборудования/.test(ruH), ruH.length);
check('a weekly talk has no equipment block', !wk.html.includes('id="eqbox"'));

// 09/11/2026: the WhatsApp alert when an induction with equipment did not go out whole.
{
  const R = { id: 'r1', emp_name: 'דני כהן', equip: { items: [{ n: 'נעלי עבודה', q: 1 }], ret: 'משאבי אנוש' } };
  const good = { mailed: true, attached: true, pdf: true, err: null };
  check('alert: all well = no message', equipAlertText(R, good, 900) === null);
  check('alert: no equipment = no message, even when the mail failed', equipAlertText({ id: 'r2', emp_name: 'x', equip: null }, { mailed: false }, 0) === null);
  const big = equipAlertText(R, Object.assign({}, good, { attached: false }), 900);
  check('alert: PDF too big to attach is named, with the worker', /לא צורף למייל/.test(big) && /דני כהן/.test(big) && !/שלח שוב/.test(big), big);
  const nomail = equipAlertText(R, { mailed: false, attached: false, pdf: false, err: 'mail 503' }, 900);
  check('alert: mail not sent says why and offers "send again"', /המייל לא יצא \(mail 503\)/.test(nomail) && /שלח שוב/.test(nomail) && !/HTML/.test(nomail), nomail);
  check('alert: no signature and HTML instead of PDF', /אין חתימה/.test(equipAlertText(R, good, 0)) && /HTML/.test(equipAlertText(R, Object.assign({}, good, { pdf: false }), 900)));
}
{
  // the hourly cap (review 09/11/2026): a message an hour ago or less = no WhatsApp call at all
  const save = globalThis.fetch; const calls = [];
  const now = Date.parse('2026-11-09T08:00:00Z');
  globalThis.fetch = async (u, o) => { u = String(u); calls.push(u + ' ' + ((o && o.method) || 'GET'));
    if (u.includes('key=eq.induction_equip_alert')) return new Response(JSON.stringify([{ value: new Date(now - 600000).toISOString() }]), { status: 200 });
    return new Response('{}', { status: 599 }); };
  const r = await equipAlert(Object.assign({}, ENV, { META_PHONE_NUMBER_ID: 'p', META_ACCESS_TOKEN: 't' }), 'טקסט', 'induction r1', now);
  check('alert: a second one within the hour is skipped, nothing sent', r && r.skipped === 'hour' && calls.length === 1, { r, calls });
  globalThis.fetch = save;
}
{
  // retro 09/11/2026: a send that did not go out must not use up the hour; the worker's name has keyboard characters only;
  // a resend from Michael's button raises no WhatsApp
  const save = globalThis.fetch;
  const now = Date.parse('2026-11-09T08:00:00Z');
  const E2 = Object.assign({}, ENV, { META_PHONE_NUMBER_ID: 'p', META_ACCESS_TOKEN: 't' });
  const run = async (metaOk, times) => {
    const st = new Map(); let meta = 0;
    globalThis.fetch = async (u, o) => { u = String(u); const m = (o && o.method) || 'GET';
      if (u.includes('graph.facebook.com')) { meta++; await new Promise((r) => setTimeout(r, 20)); return metaOk ? new Response(JSON.stringify({ messages: [{ id: 'wamid.1' }] }), { status: 200 }) : new Response('{"error":{"code":1}}', { status: 400 }); }
      if (u.includes('notification_prefs')) return new Response(JSON.stringify([{ prefs: { trustee_hazard: { whatsapp_to: '972501234567' } } }]), { status: 200 });
      if (u.includes('server_state')) {
        const key = (/key=eq\.([^&]+)/.exec(u) || [])[1];
        if (m === 'GET') { await new Promise((r) => setTimeout(r, 5)); const v = st.get(key); return new Response(JSON.stringify(v ? [{ value: v.value, updated_at: v.at }] : []), { status: 200 }); }
        const body = JSON.parse((o && o.body) || '[]'); const rec = Array.isArray(body) ? body[0] : body;
        if (m === 'POST') { if (st.has(rec.key)) return new Response('[]', { status: 200 }); st.set(rec.key, { value: rec.value, at: rec.updated_at }); return new Response(JSON.stringify([rec]), { status: 201 }); }
        if (m === 'PATCH') { const cur = st.get(key); const want = decodeURIComponent((/updated_at=eq\.([^&]+)/.exec(u) || [])[1] || ''); if (!cur || cur.at !== want) return new Response('[]', { status: 200 }); st.set(key, { value: rec.value, at: rec.updated_at }); return new Response(JSON.stringify([rec]), { status: 200 }); }
      }
      return new Response('[]', { status: 200 }); };
    const rs = []; for (let i = 0; i < times; i++) rs.push(equipAlert(E2, 'טקסט ' + i, 'induction r' + i, now));
    const out = await Promise.all(rs);
    return { meta, state: st.get('induction_equip_alert'), out };
  };
  const bad = await run(false, 1);
  check('alert: a send that failed gives the hour back (the stored time is not "now")', bad.meta === 1 && (!bad.state || Date.parse(bad.state.value) < now), bad);
  const good = await run(true, 1);
  check('alert: a send that went out uses the hour (the stored time is now)', good.meta === 1 && good.state && Date.parse(good.state.value) === now, good);
  const par = await run(true, 4);
  check('alert: four signings at once send one message (the hour is taken atomically)', par.meta === 1, par);
  globalThis.fetch = save;
  const dash = equipAlertText({ id: 'r3', emp_name: 'דני \u2014 כהן \u201cx\u201d\n- המייל יצא תקין', equip: { items: [{ n: 'נעלי עבודה', q: 1 }] } }, { mailed: false, err: 'שגיאה \u2014 503' }, 900);
  check('alert: no long dash, no curly quotes and no injected line from a name', dash && !/[\u2013\u2014\u201c\u201d]/.test(dash) && !/\n- \u05d4\u05de\u05d9\u05d9\u05dc \u05d9\u05e6\u05d0 \u05ea\u05e7\u05d9\u05df/.test(dash), dash);
  const src = (await import('node:fs')).readFileSync(new URL('../../functions/api/talk.js', import.meta.url), 'utf8');
  check('alert: only the signing path sends it, not the resend button', (src.match(/await equipAlert\(/g) || []).length === 1, (src.match(/await equipAlert\(/g) || []).length);
}
// 09/11/2026: HR must choose "equipment given" or "none" (Michael: "מאשר")
{
  const it = { items: [{ n: 'נעלי עבודה', q: 1 }], ret: 'משאבי אנוש' };
  check('choice: yes with items, no without, and an old page without the choice all pass', equipCheck('yes', it) === null && equipCheck('no', null) === null && equipCheck('', null) === null && equipCheck(null, it) === null);
  check('choice: "given" with no quantity is refused', /לא נרשמה כמות/.test(equipCheck('yes', null) || ''));
  check('choice: "none" with quantities is refused', /נרשמו כמויות/.test(equipCheck('no', it) || ''));
  check('choice: a forged value is refused', !!equipCheck('maybe', null));
}
if (process.env.EQ_PDF) {
  const h = inductionHtml(T.ind1, { id: 'r1', emp_name: 'דני כהן', id_no: '123456789', equip: { items: [{ n: 'נעלי עבודה', q: 1 }, { n: 'כלי עבודה', q: 1, d: 'מברג, פטיש' }], ret: 'משאבי אנוש' } }, 'iVBORw0KGgo=', 'he', { day: '2026-11-08', hm: '07:05' }, []);
  const p2 = await (await browser.newContext({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 1 })).newPage();
  await p2.setContent(h.slice(h.indexOf('<div style="page-break-before')).replace(/^/, '<html dir="rtl"><body style="font-family:Arial;font-size:13px;margin:24px">'));
  await p2.screenshot({ path: process.env.EQ_PDF, fullPage: true });
}
await browser.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
