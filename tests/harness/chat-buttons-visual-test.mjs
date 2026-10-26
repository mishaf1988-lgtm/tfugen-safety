// The choice buttons of /chat stay tappable while the page keeps pulling (26/10/2026, Michael, a screenshot:
// "again I cannot tap a choice"). Every pull (20 s) passes all the rows again, and add() called done() for each
// line of his before the seen check, so 20 seconds after an answer its buttons were closed. A real Chromium,
// a fake clock and a fake /api/chat: the buttons of the newest answer stay open over three pulls, and a new line
// of his still closes them (an old "1." must not be read against a newer question).
import { createRequire } from 'module';
import { CHAT_PAGE } from './_build/chat-page.mjs';

const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 300) : '')); } };

(async () => {
  const html = CHAT_PAGE.replace('__PLAYER__', 'window.tapSay=function(){}').replace('__SITE__', JSON.stringify({ supabaseUrl: 'https://sb.test', supabaseKey: 'k', loginDomain: 'x.test' }));
  const b = await pw.chromium.launch();
  const p = await b.newPage();
  await p.clock.install();
  const rows = [{ who: 'me', text: 'שאלה', ts: '2026-10-26T03:40:00Z' }, { who: 'bot', text: 'מה הצעד הבא?', ts: '2026-10-26T03:49:00Z', choices: ['א', 'ב'] }];
  await p.route('https://app.test/api/chat**', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(r.request().method() === 'GET' ? { rows } : { ok: true }) }));
  await p.route('https://app.test/chat', (r) => r.fulfill({ contentType: 'text/html', body: html }));
  await p.addInitScript(() => localStorage.setItem('chat_sess', JSON.stringify({ a: 't', r: 'r', x: Date.now() + 3600e3 })));
  await p.goto('https://app.test/chat');
  await p.waitForSelector('.ch button[data-c]');
  const st = () => p.$$eval('.ch button[data-c]', (bs) => bs.map((x) => x.disabled));
  check('loaded: the newest answer\'s buttons are open', (await st()).every((x) => !x), await st());
  for (let i = 0; i < 3; i++) { await p.clock.runFor(21000); await p.waitForTimeout(30); }
  check('three pulls later (the rows come again): still open', (await st()).every((x) => !x), await st());
  rows.push({ who: 'me', text: 'תשובה חדשה', ts: '2026-10-26T03:55:00Z' });
  await p.clock.runFor(21000); await p.waitForTimeout(30);
  check('a new line of his: the buttons above it close', (await st()).every((x) => x), await st());
  await b.close();
  console.log(pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('HARNESS ERROR: ' + (e && e.stack || e)); process.exit(1); });
