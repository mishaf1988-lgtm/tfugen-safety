// Redesign phase 3 (13/10/2026): the factory-sign language outside the home screen.
// On a register page (PPE) and in a form: square corners, ink lines, no shadows,
// blue primary action, red only for an expired badge, ink table header, and the
// NCR import / AI buttons are readable blue actions (they were grey text on blue).
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };
const BLUE = 'rgb(21, 72, 137)', INK = 'rgb(43, 43, 44)', RED = 'rgb(167, 41, 32)', PAPER = 'rgb(255, 255, 255)';

(async () => {
  const browser = await pw.chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'he-IL' })).newPage();
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);
  const r = await page.evaluate(() => {
    document.getElementById('login').style.display = 'none'; document.getElementById('app').style.display = 'block';
    window.sdb = function () {}; window._currentUser = { username: 'admin' }; _isAdmin = true;
    const d = new Date(); d.setDate(d.getDate() - 3);
    DB.ppe = [{ id: 'p1', ty: 'x', w: 'y', d: null, e: d.toISOString().slice(0, 10) }];
    goPage('ppe');
    const cs = (el) => el ? getComputedStyle(el) : null;
    const pg = document.getElementById('pg-ppe');
    const btnP = cs(pg.querySelector('.btn-p')), card = cs(pg.querySelector('.card')), title = cs(pg.querySelector('.page-title'));
    const bad = cs(pg.querySelector('.b.bR')), th = cs(document.querySelector('th'));
    const topbar = cs(document.querySelector('.topbar'));
    const inp = cs(document.querySelector('.modal input:not([type=checkbox]):not([type=radio]):not([type=hidden])'));
    const ncr = document.getElementById('pg-ncr');
    const imp = cs(ncr.querySelector('[onclick="openXlModal()"]')), ai = cs(ncr.querySelector('[onclick="openNCRAgent()"]'));
    return {
      btnP: btnP && [btnP.backgroundColor, btnP.borderRadius, btnP.boxShadow],
      card: card && [card.borderTopColor, card.borderRadius, card.boxShadow],
      title: title && [title.borderBottomColor, title.borderBottomWidth],
      bad: bad && [bad.backgroundColor, bad.color],
      th: th && th.backgroundColor,
      topbar: topbar && [topbar.borderBottomColor, topbar.boxShadow],
      inp: inp && [inp.borderRadius, inp.backgroundColor],
      imp: imp && [imp.backgroundColor, imp.color], ai: ai && [ai.backgroundColor, ai.color],
    };
  });
  check('the primary button is sign blue, square, no shadow', r.btnP && r.btnP[0] === BLUE && r.btnP[1] === '0px' && r.btnP[2] === 'none', r.btnP);
  check('a card has an ink line, square corners, no shadow', r.card && r.card[0] === INK && r.card[1] === '0px' && r.card[2] === 'none', r.card);
  check('the page title is ruled in ink', r.title && r.title[0] === INK && r.title[1] === '3px', r.title);
  check('an expired badge is sign red with white text', r.bad && r.bad[0] === RED && r.bad[1] === PAPER, r.bad);
  check('a table header is ink, not a red gradient', r.th === INK, r.th);
  check('the top bar is ruled in ink without a shadow', r.topbar && r.topbar[0] === INK && r.topbar[1] === 'none', r.topbar);
  check('a form input is square on white', r.inp && r.inp[0] === '0px' && r.inp[1] === PAPER, r.inp);
  check('NCR import and AI buttons are blue with white text', r.imp && r.ai && r.imp[0] === BLUE && r.imp[1] === PAPER && r.ai[0] === BLUE && r.ai[1] === PAPER, [r.imp, r.ai]);
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
