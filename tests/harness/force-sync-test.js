// "סנכרון מלא" used to do the opposite of what it said. Its own confirm read
// "יטען מחדש את כל הטבלאות מהענן" — a read — while the code upserted every
// locally cached row to the server first. A device that had been offline for
// days would overwrite everyone else's edits from a button described as a pull.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' });
  const page = await ctx.newPage();
  let prompts = [], answer = true;
  page.on('dialog', (d) => { prompts.push(d.message()); (answer ? d.accept() : d.dismiss()).catch(() => {}); });
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);

  // Record every request the page would make, and never let one leave.
  const boot = () => page.evaluate(() => {
    document.getElementById('login').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    window.__posts = []; window.__synced = 0;
    window.fetch = function (url, init) {
      window.__posts.push({ url: String(url), method: (init && init.method) || 'GET', rows: init && init.body ? (JSON.parse(init.body) || []).length : 0 });
      return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve([]); }, text: function () { return Promise.resolve('[]'); } });
    };
    window.sbSync = function () { window.__synced++; return Promise.resolve(); };
    window._sbAuth = function () { return Promise.resolve(); };
    DB.ncr = [{ id: 'n1', num: 'NCR-0001', d: 'רשומה מקומית ישנה' }, { id: 'n2', num: 'NCR-0002', d: 'עוד אחת' }];
    DB.tasks = [{ id: 't1', title: 'משימה' }];
    localStorage.removeItem('tfgn_outbox');
    if (typeof _obMem !== 'undefined') _obMem.length = 0;
    window._currentUser = { username: 'admin' }; _isAdmin = true;
    _applyRoleGates(); goPage('dash');
  });

  console.log('\n1. "סנכרון מלא" is a pull, and says so');
  {
    await boot(); prompts = []; answer = true;
    await page.evaluate(() => forceSync());
    await page.waitForTimeout(250);
    const r = await page.evaluate(() => ({ posts: window.__posts.filter((p) => p.method === 'POST'), synced: window.__synced }));
    check('the prompt promises a load from the cloud and says nothing is uploaded', /מהענן/.test(prompts[0] || '') && /לא מעלה/.test(prompts[0] || ''), prompts[0]);
    check('NOT ONE row is posted to the server', r.posts.length === 0, r.posts);
    check('it does pull — sbSync ran', r.synced === 1, r);
  }

  console.log('\n2. declining it does nothing at all');
  {
    await boot(); prompts = []; answer = false;
    await page.evaluate(() => forceSync());
    await page.waitForTimeout(250);
    const r = await page.evaluate(() => ({ posts: window.__posts.length, synced: window.__synced }));
    check('cancel means cancel', r.posts === 0 && r.synced === 0, r);
  }

  console.log('\n3. with unsent work, the prompt warns that a pull can overwrite it');
  {
    await boot(); prompts = []; answer = false;
    await page.evaluate(() => { _obPush({ op: 'ins', tbl: 'ncr', row: { id: 'x', num: 'NCR-9', d: 'לא נשלח' } }); });
    await page.evaluate(() => forceSync());
    await page.waitForTimeout(200);
    check('it names the number of unsent operations', /1 פעולות/.test(prompts[0] || ''), prompts[0]);
    check('and warns they could be overwritten', /לדרוס/.test(prompts[0] || ''), prompts[0]);
  }

  console.log('\n4. the upload still exists — as its own action, warning in the right direction');
  {
    await boot(); prompts = []; answer = true;
    await page.evaluate(() => _forceUpload());
    await page.waitForTimeout(400);
    const r = await page.evaluate(() => ({ posts: window.__posts.filter((p) => p.method === 'POST'), synced: window.__synced }));
    check('it warns that the server version will be overwritten', /ייכתבו על הגרסה שבשרת/.test(prompts[0] || ''), prompts[0]);
    check('and that another device’s edits can be lost', /יאבדו/.test(prompts[0] || ''), prompts[0]);
    check('it states how many rows: 3', /3 רשומות/.test(prompts[0] || ''), prompts[0]);
    check('only then does it post — ncr and tasks', r.posts.length === 2 && r.posts.some((p) => /\/ncr/.test(p.url)) && r.posts.some((p) => /\/tasks/.test(p.url)), r.posts);
  }

  console.log('\n5. declining the upload posts nothing');
  {
    await boot(); prompts = []; answer = false;
    await page.evaluate(() => _forceUpload());
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => window.__posts.filter((p) => p.method === 'POST').length);
    check('cancel means cancel here too', r === 0, r);
  }

  console.log('\n6. the two are separate entries in the ⋯ menu');
  {
    await boot();
    const r = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('.topbar button')).find((b) => /⋯|…/.test(b.textContent));
      btn.click();
      const items = Array.from(document.querySelectorAll('div[style*="z-index:9999"] button, div[style*="z-index: 9999"] button')).map((b) => b.textContent.trim());
      document.body.click();
      return items;
    });
    check('one reads "סנכרון מלא (טעינה מהענן)"', r.some((t) => /סנכרון מלא \(טעינה מהענן\)/.test(t)), r);
    check('the other reads "העלה מהמכשיר הזה לשרת"', r.some((t) => /העלה מהמכשיר הזה לשרת/.test(t)), r);
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
