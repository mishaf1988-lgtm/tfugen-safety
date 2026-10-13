// Redesign phase 3 (13/10/2026): the factory-sign language outside the home screen.
// On a register page (PPE) and in a form: square corners, ink lines, no shadows,
// blue primary action, red only for an expired badge, ink table header, and the
// NCR import / AI buttons are readable blue actions (they were grey text on blue).
// Phase 5 (13/10/2026): the same register row (name, badge, facts, buttons) on the phone.
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
  // goPage first: the data-label of each cell comes from a MutationObserver (TBL-1), one tick later.
  await page.evaluate(() => {
    document.getElementById('login').style.display = 'none'; document.getElementById('app').style.display = 'block';
    window.sdb = function () {}; window._currentUser = { username: 'admin' }; _isAdmin = true;
    const d = new Date(); d.setDate(d.getDate() - 3);
    DB.ppe = [{ id: 'p1', ty: 'x', w: 'y', m: 'z', d: null, e: d.toISOString().slice(0, 10) }];
    goPage('ppe');
  });
  await page.waitForTimeout(200);
  const r = await page.evaluate(() => {
    const cs = (el) => el ? getComputedStyle(el) : null;
    const pg = document.getElementById('pg-ppe');
    const btnP = cs(pg.querySelector('.btn-p')), card = cs(pg.querySelector('.card')), title = cs(pg.querySelector('.page-title'));
    const bad = cs(pg.querySelector('.b.bR')), th = cs(document.querySelector('th'));
    const topbar = cs(document.querySelector('.topbar'));
    const inp = cs(document.querySelector('.modal input:not([type=checkbox]):not([type=radio]):not([type=hidden])'));
    const ncr = document.getElementById('pg-ncr');
    const imp = cs(ncr.querySelector('[onclick="openXlModal()"]')), ai = cs(ncr.querySelector('[onclick="openNCRAgent()"]'));
    // Phase 5: the same row in every register (PPE here, any register without its own rules).
    const tr = pg.querySelector('.tbl-wrap tbody tr');
    const tds = tr ? [...tr.children] : [];
    const first = tds[0], badge = tds.find((t) => t.querySelector('.b')), act = tds.find((t) => !t.dataset.label);
    const fact = tds.find((t) => t !== first && t !== badge && t.dataset.label && t.textContent.trim());
    const row = {
      first: first && [cs(first).order, cs(first).fontWeight, getComputedStyle(first, '::before').display],
      badge: badge && cs(badge).order, act: act && cs(act).order,
      fact: fact && [cs(fact).order, cs(fact).fontSize, getComputedStyle(fact, '::before').content],
      rule: tr && getComputedStyle(tr, '::after').borderTopStyle,
    };
    return {
      row,
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
  const w = r.row;
  check('register row: the first field is the bold name without its label', w.first && w.first[0] === '1' && w.first[1] === '700' && w.first[2] === 'none', w.first);
  check('register row: the expiry badge sits next to the name', w.badge === '2', w.badge);
  check('register row: other fields are small inline "label:" facts', w.fact && w.fact[0] === '3' && w.fact[1] === '13px' && /:/.test(w.fact[2]), w.fact);
  check('register row: the buttons are last, under a rule', w.act === '9' && w.rule === 'solid', [w.act, w.rule]);
  // Stage 6 (13/10/2026, found in the trustee guide shot): the mouse-hover rule of .btn-s has the
  // same weight as the chosen verdict and came later, so a chosen "defect" under the mouse turned
  // grey with white text. Phones do not hover; a desktop and a tablet with a mouse do.
  await page.evaluate(() => {
    const d = document.createElement('div'); d.className = 'tru-vd'; d.style.cssText = 'position:fixed;top:300px;left:20px;z-index:99999';
    d.innerHTML = '<button type="button" class="btn btn-s on-ok" id="t-ok">ok</button><button type="button" class="btn btn-s on-bad" id="t-bad">bad</button>';
    document.body.appendChild(d);
  });
  const hov = [];
  for (const id of ['t-ok', 't-bad']) { await page.hover('#' + id); await page.waitForTimeout(300); hov.push(await page.evaluate((i) => getComputedStyle(document.getElementById(i)).backgroundColor, id)); }
  check('a chosen ok / defect keeps its colour under the mouse', hov[0] !== hov[1] && hov[1] === RED && !/rgb\((2[3-5]\d), \1, \1\)/.test(hov[0]), hov);
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
