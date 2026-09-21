// Captures the screenshots for the trustee guide.
//
//   NODE_PATH=$(npm root -g) node tools/guide-shots.js
//   NODE_PATH=$(npm root -g) node tools/guide-shots.js 01-login 01b-code
//
// The first version of this script was never committed -- it lived in a
// scratch directory and went with it. When the trustee screen gained a code
// on 2026-09-21 the guide could not be rebuilt without writing it again, so
// this time it lives here.
//
// Every shot is the real app at 390x844 (iPhone width) at 2x, seeded with
// plausible Hebrew data. The red ring and the number inside it are drawn by
// this script and not by the app: the number is the step number in the guide,
// so somebody reading on one screen with a phone in the other hand is looking
// at the same thing.
//
// The ring is measured AFTER the page has settled. An earlier version measured
// first and scrolled after, and the ring came out around empty space further
// up the page. A shot whose ring is in the wrong place is worse than no shot,
// so a ring that lands outside the frame refuses to be written.
const fs = require('fs');
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'project-files', 'guide-trustees');
const HTML = 'file://' + path.join(ROOT, 'index.html');

// Plausible, and obviously not real: a guide screenshot is seen by everyone
// in the plant and should not carry a real person's finding.
const ME = 'דני לוי';
const SEED = {
  trustees: [
    { id: 't1', n: ME, dep: 'אולם ייצור', active: true },
    { id: 't2', n: 'רונית כהן', dep: 'מחסן', active: true },
    { id: 't3', n: 'אבי מזרחי', dep: 'אריזה', active: true },
  ],
  trustee_tasks: [
    { id: 'k1', n: 1, t: 'עמדות כיבוי אש', d: 'מטפים במקומם, לחץ תקין, גישה פנויה', active: true },
    { id: 'k2', n: 2, t: 'יציאות חירום', d: 'דלתות נפתחות, שילוט דולק, מעבר פנוי', active: true },
    { id: 'k3', n: 3, t: 'מגני מכונות', d: 'מגנים במקומם ומחוברים', active: true },
    { id: 'k4', n: 4, t: 'ציוד מגן אישי', d: 'זמין, תקין, בגודל הנכון', active: true },
    { id: 'k5', n: 5, t: 'ארונות חשמל', d: 'סגורים, משולטים, ללא חסימה', active: true },
    { id: 'k6', n: 6, t: 'מעברים ומדרגות', d: 'פנויים, מוארים, ללא מכשולים', active: true },
    { id: 'k7', n: 7, t: 'ערכות עזרה ראשונה', d: 'מלאות ובתוקף', active: true },
    { id: 'k8', n: 8, t: 'שפכים וחומרים מסוכנים', d: 'מאוחסנים נכון, ללא דליפה', active: true },
  ],
};

// label -> how to reach the screen, and what to ring.
// ring: { sel, n }  -- n null draws the ring with no number in it.
const SHOTS = {
  '01-login': {
    // The login screen as it opens. The button lost its "(no password)"
    // promise when the code landed, which is why this one is being retaken.
    prepare: async () => {},
    ring: { sel: '#login-emp-btn', n: 1 },
  },
  '01b-code': {
    // New on 2026-09-21: the shared code. One field and one button, so the
    // ring carries no number -- there is nothing to tell apart.
    prepare: async (page) => {
      await page.click('#login-emp-btn');
      await page.waitForSelector('#m-emp-gate', { state: 'visible', timeout: 5000 });
      await page.waitForTimeout(350);
      // A code screen showing somebody's real code would be an odd thing to
      // print in a guide. Dots, the length of nothing in particular.
      await page.fill('#emp-gate-code', '••••••');
    },
    ring: { sel: '#emp-gate-code', n: null },
  },
};

async function seed(page) {
  await page.evaluate((s) => {
    try {
      localStorage.setItem('tfgn2', JSON.stringify(s.db));
      localStorage.setItem('tfgn_trustee_name', s.me);
      localStorage.removeItem('tfgn_emp_mode');
      localStorage.removeItem('tfgn_emp_code');
    } catch (e) {}
  }, { db: SEED, me: ME });
}

// Drawn in the page so it is part of the capture. Fixed to the viewport,
// which is what the earlier bug was about: measured against the document and
// then the page moved.
async function ring(page, sel, n) {
  return page.evaluate((a) => {
    const el = document.querySelector(a.sel);
    if (!el) return { ok: false, why: 'no element ' + a.sel };
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return { ok: false, why: 'element has no size' };
    const pad = 7;
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;'
      + 'border:4px solid #ff3b30;border-radius:14px;box-shadow:0 0 0 3px rgba(255,59,48,.22);'
      + 'top:' + (r.top - pad) + 'px;left:' + (r.left - pad) + 'px;'
      + 'width:' + (r.width + pad * 2) + 'px;height:' + (r.height + pad * 2) + 'px';
    document.body.appendChild(box);
    if (a.n !== null) {
      const b = document.createElement('div');
      b.textContent = String(a.n);
      b.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;'
        + 'width:30px;height:30px;border-radius:50%;background:#ff3b30;color:#fff;'
        + 'font:700 17px/30px Arial,sans-serif;text-align:center;'
        + 'box-shadow:0 2px 6px rgba(0,0,0,.3);'
        + 'top:' + (r.top - pad - 15) + 'px;left:' + (r.right + pad - 15) + 'px';
      document.body.appendChild(b);
    }
    // Off the top or off the side means the ring is not around the thing it
    // is meant to be around, and the shot would mislead rather than help.
    const fits = r.top - pad - 15 >= 0 && r.left - pad >= 0
      && r.bottom + pad <= innerHeight && r.right + pad <= innerWidth;
    return { ok: fits, why: fits ? '' : 'ring falls outside the frame', rect: { t: Math.round(r.top), l: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height) } };
  }, { sel, n });
}

(async () => {
  const want = process.argv.slice(2);
  const names = want.length ? want : Object.keys(SHOTS);
  const unknown = names.filter((n) => !SHOTS[n]);
  if (unknown.length) { console.error('unknown shot: ' + unknown.join(', ')); process.exit(1); }

  const browser = await pw.chromium.launch();
  let failed = 0;

  for (const name of names) {
    const spec = SHOTS[name];
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'he-IL',
    });
    const page = await ctx.newPage();
    page.on('dialog', (d) => d.accept().catch(() => {}));
    // Nothing but the repo itself: no CDN, no Supabase, no network at all.
    //
    // The app asks for its logo at /logo.jpg, an absolute path, which under
    // file:// resolves to the root of the filesystem and comes back broken.
    // A guide whose first picture has a broken-image icon where the company
    // logo belongs is not one anybody would forward, so root-absolute assets
    // are served out of the repo.
    await page.route('**/*', (r) => {
      const u = r.request().url();
      if (!u.startsWith('file://')) return r.abort();
      const p = decodeURIComponent(new URL(u).pathname);
      if (fs.existsSync(p)) return r.continue();
      const inRepo = path.join(ROOT, path.basename(p));
      if (fs.existsSync(inRepo)) return r.fulfill({ path: inRepo });
      return r.continue();
    });
    await page.goto(HTML, { waitUntil: 'load' });
    await seed(page);
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(1200);

    await spec.prepare(page);
    // showLogin focuses the password box after 100ms, and a focused field
    // wears a red ring that reads, in a printed guide, as an error nobody
    // made. Take the focus off whatever has it before the shutter.
    await page.evaluate(() => { try { document.activeElement && document.activeElement.blur(); } catch (e) {} });
    await page.waitForTimeout(250);

    let placed = { ok: true };
    if (spec.ring) placed = await ring(page, spec.ring.sel, spec.ring.n);
    if (!placed.ok) {
      console.error('  ✗ ' + name + ': ' + placed.why);
      failed++;
      await ctx.close();
      continue;
    }
    const file = path.join(OUT, name + '.png');
    await page.screenshot({ path: file });
    console.log('  ✓ ' + name + '.png  (' + Math.round(fs.statSync(file).size / 1024) + ' KB)'
      + (placed.rect ? '  ring at ' + JSON.stringify(placed.rect) : ''));
    await ctx.close();
  }

  await browser.close();
  process.exit(failed ? 1 : 0);
})();
