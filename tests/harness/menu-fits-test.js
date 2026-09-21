// Do the pop-up menus stay on the screen?
//
// Michael sent a screenshot on 2026-09-21 with the header menu open on a
// 390px phone. Half of it was off the left edge: «סנכרון מלא (טעינה מהע…»,
// «חיבור OneDrive (סנכרון מסמכים אוטומטי)» cut mid-word, the ISO line
// unreadable. The menu is anchored by `right`, so anything wider than the
// screen overflows to the LEFT -- which in an RTL layout is exactly where the
// text is.
//
// _popMenu had a max-width and a clamp. The header menu and the task row menu
// did not, and nothing noticed because a desktop window is wide enough to
// hide it.
//
// So this measures, at phone widths, on the real page: every menu inside the
// viewport, and every label fully visible inside its own menu.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

// 320 is the narrowest phone still in use; 390 is what Michael holds.
const WIDTHS = [320, 390];

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'he-IL' });
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.accept().catch(() => {}));
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);

  const measure = (w, which) => page.evaluate(async (o) => {
    document.getElementById('login').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    window._currentUser = { username: 'admin' }; window._isAdmin = true;
    window.toast = function () {}; window.alert = function () {};
    window._role = function () { return 'admin'; };
    window._isAdminUser = function () { return true; };
    ['top-more-menu', 'tsk-action-menu'].forEach(function (id) {
      const e = document.getElementById(id); if (e) e.remove();
    });

    // The REAL button, not a synthetic one at the right edge. That distinction
    // is the whole bug: #more-menu-btn sits in the middle of the header row,
    // between the logo and the other icons, so the space left of it is much
    // narrower than the screen. Anchored from the right edge the menu has 374px
    // to grow into and never squeezes -- which is exactly why a first version
    // of this test passed against the broken code.
    let host = null, btn = document.getElementById('more-menu-btn');
    if (!btn || !btn.getBoundingClientRect().width) {
      host = document.createElement('div');
      host.style.cssText = 'position:fixed;top:56px;left:0;right:0;height:40px;z-index:5';
      btn = document.createElement('button');
      btn.textContent = '...';
      // Where the header actually puts it on a 390px phone.
      btn.style.cssText = 'position:absolute;right:120px;top:0;width:36px;height:36px';
      host.appendChild(btn); document.body.appendChild(host);
    }

    try {
      if (o.which === 'top') window._topMoreMenu(btn);
      else {
        DB.tasks = [{ id: 'T1', t: 'בדיקה', s: 'פתוח', due: '2026-10-01' }];
        window._tskMenu('T1', btn);
      }
    } catch (e) { return { error: String(e && e.message || e) }; }

    await new Promise((r) => setTimeout(r, 60));
    const menu = document.getElementById(o.which === 'top' ? 'top-more-menu' : 'tsk-action-menu');
    if (!menu) { if (host) host.remove(); return { error: 'no menu' }; }
    const mr = menu.getBoundingClientRect();
    // A label is clipped when its own box reaches past the menu's inner edge.
    const spans = [...menu.querySelectorAll('button > span:last-child')];
    const clipped = spans.filter((s) => {
      const r = s.getBoundingClientRect();
      return r.left < mr.left - 0.5 || r.right > mr.right + 0.5 || r.width < 1;
    }).map((s) => s.textContent.trim().slice(0, 28));
    // A label forced onto two lines is the symptom that the menu was squeezed:
    // it means the available width ran out, which on Michael's phone showed up
    // as text running into the screen edge.
    const oneLine = spans.length ? Math.min(...spans.map((s) => s.getBoundingClientRect().height)) : 0;
    const wrapped = spans.filter((s) => s.getBoundingClientRect().height > oneLine * 1.5)
      .map((s) => s.textContent.trim().slice(0, 30));
    const out = {
      n: spans.length,
      left: Math.round(mr.left), right: Math.round(mr.right), width: Math.round(mr.width),
      vw: window.innerWidth, clipped: clipped, wrapped: wrapped,
    };
    menu.remove(); if (host) host.remove();
    return out;
  }, { which });

  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: 844 });
    await page.waitForTimeout(120);
    console.log('\n' + w + 'px');
    for (const which of ['top', 'task']) {
      const r = await measure(w, which);
      const name = which === 'top' ? 'header ⋯' : 'task row ⋯';
      if (r.error) { check(name + ': the menu opens', false, r.error); continue; }
      check(name + ': it has items (' + r.n + ')', r.n >= 3, r);
      check(name + ': the whole menu is on screen', r.left >= 0 && r.right <= r.vw, r);
      // The measured difference. Before the fix the header menu sat flush at
      // left:0 -- no gutter at all, text touching the edge of the glass.
      check(name + ': it keeps a gutter from the edge', r.left >= 8, r);
      check(name + ': no label is cut off', r.clipped.length === 0, r.clipped);
      // 320px is genuinely tight; the guarantee there is only that nothing is
      // lost. At 390, which is the phone in Michael's hand, labels fit.
      if (w >= 390) check(name + ': and no label is squeezed onto two lines', r.wrapped.length === 0, r.wrapped);
    }
  }

  // The menu that was already correct must stay correct.
  await page.setViewportSize({ width: 390, height: 844 });
  console.log('\n_popMenu, which already clamped');
  {
    const r = await page.evaluate(async () => {
      const btn = document.createElement('button');
      btn.style.cssText = 'position:fixed;top:60px;right:8px;width:36px;height:36px';
      document.body.appendChild(btn);
      window._popMenu(btn, 'probe-menu', function (item) {
        item('📋', 'תווית ארוכה מאוד שנועדה לדחוף את התפריט אל מחוץ למסך בעברית');
        item('🔗', 'עוד שורה ארוכה בדיוק כמו הראשונה, כדי שיהיה רוחב');
      });
      await new Promise((r2) => setTimeout(r2, 60));
      const m = document.getElementById('probe-menu');
      const mr = m.getBoundingClientRect();
      const out = { left: Math.round(mr.left), right: Math.round(mr.right), vw: window.innerWidth };
      m.remove(); btn.remove();
      return out;
    });
    check('a deliberately long label still fits on screen', r.left >= 0 && r.right <= r.vw, r);
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
