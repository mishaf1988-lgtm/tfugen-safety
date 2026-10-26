// A file in /chat opens through its OneDrive link (26/10/2026, Michael: "through OneDrive, with the original name"); until that
// link comes, or when OneDrive does not answer, a tap on a Word or Excel file hands the file to the phone (26/10/2026, Michael, a screenshot: the
// home-screen icon's in-app viewer showed a white page for a .xlsx). A real Chromium with navigator.share faked:
// the .xlsx tap shares the file's bytes and opens no page; a .pdf still opens as a link.
import { createRequire } from 'module';
import { CHAT_PAGE } from './_build/chat-page.mjs';

const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 300) : '')); } };

(async () => {
  const html = CHAT_PAGE.replace('__PLAYER__', 'window.tapSay=function(){}').replace('__SITE__', JSON.stringify({ supabaseUrl: 'https://sb.test', supabaseKey: 'k', loginDomain: 'x.test' }));
  const b = await pw.chromium.launch();
  const ctx = await b.newContext();
  const p = await ctx.newPage();
  const rows = [
    { who: 'bot', text: '📎 a.xlsx', ts: '2026-10-26T04:06:00Z', doc: 'a.xlsx', url: '/api/chat-file/a.xlsx?f=x1' },
    { who: 'bot', text: '📎 b.pdf', ts: '2026-10-26T04:07:00Z', doc: 'b.pdf', url: '/api/chat-file/b.pdf?f=x2' }];
  let odOk = false;
  await p.route('https://app.test/api/chat-file/**', (r) => (/od=1/.test(r.request().url())
    ? r.fulfill({ contentType: 'application/json', body: JSON.stringify(odOk ? { ok: true, webUrl: 'https://tapugancoil-my.sharepoint.com/x/Doc.aspx?sourcedoc=1&mobileredirect=true' } : { ok: false, error: 'drive' }) })
    : r.fulfill({ contentType: 'application/octet-stream', body: 'PK-bytes' })));
  await p.route(/\/api\/chat(\?|$)/, (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ rows }) }));
  await p.route('https://app.test/chat', (r) => r.fulfill({ contentType: 'text/html', body: html }));
  await p.addInitScript(() => {
    localStorage.setItem('chat_sess', JSON.stringify({ a: 't', r: 'r', x: Date.now() + 3600e3 }));
    window.__shared = []; navigator.canShare = () => true;
    navigator.share = (d) => { window.__shared.push(d.files && d.files[0] && d.files[0].name); return Promise.resolve(); };
  });
  await p.goto('https://app.test/chat');
  await p.waitForSelector('a.doc');
  const pages0 = ctx.pages().length;
  const docs = await p.$$('a.doc');
  check('the file line says it opens in OneDrive', /OneDrive/.test(await docs[0].innerText()), await docs[0].innerText());
  await docs[0].click(); await p.waitForTimeout(300);
  check('.xlsx tap: the file goes to the share sheet, no new page', (await p.evaluate(() => window.__shared)).join() === 'a.xlsx' && ctx.pages().length === pages0, { shared: await p.evaluate(() => window.__shared), pages: ctx.pages().length });
  const [np] = await Promise.all([ctx.waitForEvent('page', { timeout: 3000 }).catch(() => null), docs[1].click()]);
  check('.pdf tap: still opens as a link', !!np && (await p.evaluate(() => window.__shared)).length === 1);
  // OneDrive answers: the line becomes the file's own OneDrive link (the Office app opens it)
  odOk = true; await p.reload(); await p.waitForSelector('a.doc'); await p.waitForTimeout(300);
  const hrefs = await p.$$eval('a.doc', (as) => as.map((a) => a.href));
  check('OneDrive answered: every file line is its OneDrive link', hrefs.every((h) => /sharepoint\.com\/.*mobileredirect=true/.test(h)), hrefs);
  await b.close();
  console.log(pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('HARNESS ERROR: ' + (e && e.stack || e)); process.exit(1); });
