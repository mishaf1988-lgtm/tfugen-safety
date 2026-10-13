// Redesign phase 5c (13/10/2026): short forms. In the eight common forms the secondary fields
// are folded under "more details": the starred fields, the expiry and the file stay in view,
// the folded fields keep their ids (the save reads them as before), and an edit says how many
// of them hold something.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

(async () => {
  const browser = await pw.chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'he-IL' })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);
  const r = await page.evaluate(async () => {
    document.getElementById('login').style.display = 'none'; document.getElementById('app').style.display = 'block';
    window.sdb = function () {}; window._currentUser = { username: 'admin', role: 'אדמין' }; _isAdmin = true;
    const out = {};
    for (const id of Object.keys(_SHORT_FORMS)) {
      openModal(id);
      const m = document.getElementById(id), det = m.querySelector('details.more-f');
      const folded = _SHORT_FORMS[id].filter((x) => document.getElementById(x) && det && det.contains(document.getElementById(x)));
      const visible = [...m.querySelectorAll('.field')].filter((f) => !(det && det.contains(f)) && f.style.display !== 'none');
      const starOut = [...m.querySelectorAll('.field')].filter((f) => /\*/.test((f.querySelector('label') || {}).textContent || '') && det && det.contains(f)).length;
      const keyOut = [...m.querySelectorAll('[id$="-e"],[id$="-attach-area"],[id$="-photo-area"]')].filter((x) => det && det.contains(x)).length;
      out[id] = { det: !!det, closed: det && !det.open, folded: folded.length, listed: _SHORT_FORMS[id].filter((x) => document.getElementById(x)).length, visible: visible.length, starOut, keyOut, dets: m.querySelectorAll('details.more-f').length };
      closeModal(id);
    }
    openModal('m-doc'); closeModal('m-doc'); openModal('m-doc');
    out.once = document.getElementById('m-doc').querySelectorAll('details.more-f').length;
    document.getElementById('d-nt').value = 'x'; document.getElementById('d-i').value = 'ISO 45001';
    closeModal('m-doc'); _genEditOpening = true; openModal('m-doc'); _genEditOpening = false;
    document.getElementById('d-nt').value = 'x'; document.getElementById('d-i').value = 'ISO 45001'; document.getElementById('d-o').value = ''; document.getElementById('d-v').value = ''; document.getElementById('d-u').value = '';
    await new Promise((res) => setTimeout(res, 30));
    out.summary = document.querySelector('#m-doc details.more-f summary').textContent;
    out.readable = document.getElementById('d-i').value === 'ISO 45001';
    return out;
  });
  for (const [id, x] of Object.entries(r)) {
    if (typeof x !== 'object' || !x || !('det' in x)) continue;
    check(id + ': the secondary fields are folded, closed', x.det && x.closed && x.folded === x.listed && x.folded > 0, x);
    check(id + ': starred fields, the expiry and the file stay in view', x.starOut === 0 && x.keyOut === 0 && x.visible > 0, x);
  }
  check('opening a form again does not fold it twice', r.once === 1, r.once);
  check('an edit says how many folded fields hold something', /\(2 /.test(r.summary), r.summary);
  check('a folded field is still read by its id', r.readable);
  check('no page error', errs.length === 0, errs.slice(0, 3));
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
