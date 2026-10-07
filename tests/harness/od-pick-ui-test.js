// "בחר מתיקיית הבטיחות" (07/10/2026, Michael: "all the files in one place, not uploaded
// twice"). Drives the real buttons, the real picker and the real views; /api/od-pick is
// answered here (its server side is od-pick-test.mjs).
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 400) : '')); } };
const AREAS = ['doc-attach-area', 'tr-attach-area', 'ppe-attach-area', 'ctr-attach-area', 'hzm-attach-area', 'ea-attach-area'];

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' });
  const page = await ctx.newPage();
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(900);

  await page.evaluate(() => {
    const lg = document.getElementById('login'); if (lg) lg.style.display = 'none';
    const app = document.getElementById('app'); if (app) app.style.display = 'block';
    window.__calls = [];
    window._sbAuth = () => Promise.resolve(); window._sbToken = 'tok';
    const real = window.fetch;
    window.fetch = (u, init) => {
      if (String(u).indexOf('/api/od-pick') < 0) return real(u, init);
      const b = JSON.parse((init && init.body) || '{}'); window.__calls.push({ b, auth: init.headers.Authorization });
      const ok = (x) => Promise.resolve(new Response(JSON.stringify(Object.assign({ ok: true }, x)), { status: 200 }));
      if (b.op === 'list' && !b.path) return ok({ path: '', items: [{ id: 'D1', name: '03_נהלים', dir: true, n: 2 }, { id: 'F0', name: 'תמונה.jpg', dir: false }] });
      if (b.op === 'list') return ok({ path: b.path, items: [{ id: 'F1abc', name: 'נוהל עבודה בגובה.pdf', dir: false }] });
      if (b.op === 'search') return ok({ items: [{ id: 'S1abc', name: 'SDS כלור.pdf', dir: false, where: '07_חומרים/SDS' }] });
      if (b.op === 'url') return ok({ url: 'https://tapugan-my.sharepoint.com/f/' + b.id, name: 'x' });
      return Promise.resolve(new Response('{}', { status: 400 }));
    };
  });

  console.log('\n1. the button, for a manager only');
  const btn = await page.evaluate((A) => {
    window._currentUser = { username: 'avi', role: 'מדווח' }; _odPickBtns();
    const rep = A.filter((a) => document.querySelector('#' + a + ' [data-od-pick]')).length;
    window._currentUser = { username: 'avi', role: 'מנהל' }; _odPickBtns(); _odPickBtns();
    return { rep, mgr: A.map((a) => document.querySelectorAll('#' + a + ' [data-od-pick]').length), text: (document.querySelector('#doc-attach-area [data-od-pick]') || {}).textContent };
  }, AREAS);
  check('a reporter gets no button', btn.rep === 0, btn);
  check('a manager: one button in each of the 6 forms (twice called, still one)', btn.mgr.every((n) => n === 1), btn.mgr);
  check('...labelled "בחר מתיקיית הבטיחות"', /בחר מתיקיית הבטיחות/.test(btn.text || ''), btn.text);

  console.log('\n2. browse, pick, and the form keeps a link');
  await page.evaluate(() => document.querySelector('#doc-attach-area [data-od-pick]').click());
  await page.waitForTimeout(150);
  const s1 = await page.evaluate(() => ({ shown: getComputedStyle(document.getElementById('m-od-pick')).display !== 'none', rows: [...document.querySelectorAll('#od-pick-list .od-pick-row')].map((r) => r.textContent.trim()), path: document.getElementById('od-pick-path').textContent }));
  check('the picker opens on the safety folder, its rows shown', s1.shown && s1.rows.length === 2 && /03_נהלים/.test(s1.rows[0]) && /ניהול בטיחות/.test(s1.path), s1);
  await page.evaluate(() => document.querySelectorAll('#od-pick-list .od-pick-row')[0].click());
  await page.waitForTimeout(150);
  const s2 = await page.evaluate(() => ({ last: window.__calls[window.__calls.length - 1], rows: [...document.querySelectorAll('#od-pick-list .od-pick-row')].map((r) => r.textContent.trim()), path: document.getElementById('od-pick-path').textContent }));
  check('a folder opens that folder (with the session)', s2.last.b.op === 'list' && s2.last.b.path === '03_נהלים' && s2.last.auth === 'Bearer tok' && /03_נהלים/.test(s2.path), s2);
  await page.evaluate(() => document.querySelectorAll('#od-pick-list .od-pick-row')[0].click());
  await page.waitForTimeout(300);
  const s3 = await page.evaluate(() => ({ v: _attachUrls['doc-attach-area'], closed: getComputedStyle(document.getElementById('m-od-pick')).display === 'none', html: document.getElementById('doc-attach-area').innerHTML, a: (document.querySelector('#doc-attach-area a') || {}).href || '' }));
  check('a file: the form keeps od:<id>|<name>, the picker closes', s3.v === 'od:F1abc|נוהל עבודה בגובה.pdf' && s3.closed, s3);
  check('...shown as a link with its name, no image, opening its current address', /נוהל עבודה בגובה\.pdf/.test(s3.html) && !/<img/.test(s3.html) && s3.a === 'https://tapugan-my.sharepoint.com/f/F1abc', s3);

  console.log('\n3. search');
  await page.evaluate(() => { _odPickOpen('hzm-attach-area'); document.getElementById('od-pick-q').value = 'כלור'; _odPickSearch(); });
  await page.waitForTimeout(150);
  const s4 = await page.evaluate(() => ({ last: window.__calls[window.__calls.length - 1], rows: [...document.querySelectorAll('#od-pick-list .od-pick-row')].map((r) => r.textContent.trim()) }));
  check('search sends the words, rows show where each file sits', s4.last.b.op === 'search' && s4.last.b.q === 'כלור' && /SDS כלור\.pdf/.test(s4.rows[0]) && /07_חומרים\/SDS/.test(s4.rows[0]), s4);
  await page.evaluate(() => document.querySelectorAll('#od-pick-list .od-pick-row')[0].click());
  await page.waitForTimeout(200);
  check('...picked into the SDS form', await page.evaluate(() => _attachUrls['hzm-attach-area']) === 'od:S1abc|SDS כלור.pdf');
  // Chrome check 07/10/2026: clearing the search box left "no files found" on screen.
  const s4b = await page.evaluate(() => new Promise((res) => { _odPickOpen('tr-attach-area'); const q = document.getElementById('od-pick-q'); q.value = 'כלור'; _odPickSearch(); setTimeout(() => { const n = window.__calls.length; q.value = ''; q.dispatchEvent(new Event('input')); setTimeout(() => { res({ last: window.__calls[window.__calls.length - 1].b, more: window.__calls.length > n, path: document.getElementById('od-pick-path').textContent }); _odPickClose(); }, 150); }, 150); }));
  check('clearing the search box goes back to the folder list', s4b.more && s4b.last.op === 'list' && /ניהול בטיחות/.test(s4b.path), s4b);

  console.log('\n4. a picked image name is still a link; clearing brings the button back');
  const s5 = await page.evaluate(() => { _attachRender('ppe-attach-area', 'od:F0abcd|תמונה.jpg', ''); const h = document.getElementById('ppe-attach-area').innerHTML; _attachClear('ppe-attach-area'); return { h, back: !!document.querySelector('#ppe-attach-area [data-od-pick]') }; });
  check('od: value named .jpg: no <img>, the name shown', !/<img/.test(s5.h) && /תמונה\.jpg/.test(s5.h), s5.h);
  check('after "הסר" the picker button is back', s5.back, s5);

  console.log('\n5. the record view');
  const v = await page.evaluate(() => {
    DB.docs = DB.docs || []; DB.docs.push({ id: 'dz1', n: 'נוהל גובה', c: 'נוהל', v: '1.0', s: 'בתוקף', file_url: 'od:F1abc|נוהל עבודה בגובה.pdf' });
    showView('docs', 'dz1');
    return new Promise((res) => setTimeout(() => { const m = document.querySelector('#m-view') || document.body; res({ img: [...m.querySelectorAll('img')].some((i) => /od:|sharepoint/.test(i.getAttribute('src') || i.getAttribute('data-sign') || '')), txt: m.textContent, href: [...m.querySelectorAll('a')].map((a) => a.href).filter((h) => /sharepoint/.test(h)) }); }, 300));
  });
  check('no image tag for the picked file, its name and its current link shown', !v.img && /נוהל עבודה בגובה\.pdf/.test(v.txt) && v.href.length >= 1, { img: v.img, href: v.href });

  // Chrome check 07/10/2026: saving a record tried to copy the picked file into the app's OneDrive folder.
  const mir = await page.evaluate(() => new Promise((res) => {
    const pushed = []; window._odIsConnected = () => true; window._odPushFile = (b, f, n) => { pushed.push(n); return Promise.resolve(); };
    const signed = []; const s0 = window._sign; window._sign = (u, cb, sec) => { signed.push(u); cb(''); };
    try { _odMirrorRecord('docs', { id: 'dz2', n: 'x', file_url: 'od:F1abc|a.pdf' }); } catch (e) {}
    setTimeout(() => { window._sign = s0; res({ signed, pushed }); }, 400);
  }));
  check('the record mirror does not try to copy a picked file', !mir.signed.some((u) => /^od:/.test(u)), mir);
  check('no page errors', errs.length === 0, errs);
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
