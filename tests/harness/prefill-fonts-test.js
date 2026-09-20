// Two small things that cost real time and one that could cost the whole page.
//   * turning a trustee finding into a task blanked the due date openTskModal
//     had just derived, so the iOS date wheel opened for a value already known
//   * the assignee was prefilled with the trustee who REPORTED the finding.
//     That was this file's own doing, and it was wrong: a trustee is a
//     volunteer representative, not the department that owns the machine, so
//     routing without looking handed the repair back to the person who raised
//     it — who then appeared in בפיגור for not fixing it. Reversed here;
//     trustees-batch-test.js holds the full case.
//   * the Google Fonts stylesheet was render-blocking: when a network
//     BLACK-HOLES it (drops packets rather than refusing — what a content
//     filter does) the page never painted at all
const path = require('path');
const http = require('http');
const fs = require('fs');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const ROOT = path.resolve(__dirname, '../..');
const HTML = 'file://' + path.join(ROOT, 'index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };
const iso = (days) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + days); return d.toISOString().substring(0, 10); };

(async () => {
  const browser = await pw.chromium.launch();

  console.log('\n1. the source no longer lets the font block the first paint');
  {
    const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    // Strip the <noscript> block first: the copy inside it is SUPPOSED to be
    // render-blocking, and it never runs when scripting is on.
    const outside = src.replace(/<noscript>[\s\S]*?<\/noscript>/g, '');
    const link = (outside.match(/<link[^>]*fonts\.googleapis\.com\/css2[^>]*>/g) || []);
    check('exactly one Heebo stylesheet outside <noscript>', link.length === 1, link);
    check('it is loaded with media="print", so it cannot block the paint', /media=["']print["']/.test(link[0] || ''), link[0]);
    check('and it promotes itself to all once it arrives', /this\.media=['"]all['"]/.test(link[0] || ''), link[0]);
    check('a <noscript> copy still keeps the font for no-JS', /<noscript><link[^>]*fonts\.googleapis/.test(src));
  }

  console.log('\n2. and the page paints even when the font request is black-holed');
  {
    const TYPES = { '.html': 'text/html; charset=utf-8', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
    const srv = http.createServer((rq, rs) => {
      let p = rq.url.split('?')[0]; if (p === '/') p = '/index.html';
      const f = path.join(ROOT, p);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rs.writeHead(404); return rs.end(); }
      rs.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
      rs.end(fs.readFileSync(f));
    });
    await new Promise((r) => srv.listen(0, '127.0.0.1', r));
    const BASE = 'http://127.0.0.1:' + srv.address().port + '/';
    for (const [label, hang] of [['reachable', false], ['BLACK-HOLED', true]]) {
      const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' });
      const page = await ctx.newPage();
      await page.route('**/*', (r) => {
        const u = r.request().url();
        if (u.startsWith(BASE)) return r.continue();
        if (/fonts\.(googleapis|gstatic)\.com/.test(u)) {
          if (!hang) return r.fulfill({ status: 200, contentType: 'text/css', body: '' });
          return new Promise(() => {});              // never resolves
        }
        return r.abort();
      });
      let paint = null;
      try {
        await page.goto(BASE, { waitUntil: 'commit', timeout: 15000 });
        await page.waitForFunction(() => !!performance.getEntriesByType('paint')[0], null, { timeout: 8000 });
        paint = await page.evaluate(() => Math.round(performance.getEntriesByType('paint')[0].startTime));
      } catch (e) { paint = null; }
      const txt = paint === null ? '' : await page.evaluate(() => (document.body.innerText || '').trim().slice(0, 30));
      check('fonts ' + label + ': the page paints (' + paint + 'ms) and shows content', paint !== null && paint < 4000 && txt.length > 5, { paint: paint, txt: txt });
      await ctx.close();
    }
    srv.close();
  }

  console.log('\n3. a trustee finding becomes a task without retyping what the app knows');
  {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' });
    const page = await ctx.newPage();
    await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
    await page.goto(HTML, { waitUntil: 'load' });
    await page.waitForTimeout(700);
    const r = await page.evaluate((reportedOn) => {
      document.getElementById('login').style.display = 'none';
      document.getElementById('app').style.display = 'block';
      window.sbIns = function () {}; window.sbUpd = function () {}; window.sdb = function () {};
      DB.trustee_reports = [{ id: 'x1', u: 'מוסא', m: reportedOn.substring(0, 7), t: 5, d: reportedOn, loc: 'מחסן · מטף מזרחי', ok: false, f: 'חסרה פלומבה', s: 'פתוח', ts: new Date().toISOString() }];
      DB.trustees = [{ id: 'r1', n: 'מוסא', dep: 'חומר גלם', active: true }];
      DB.tasks = [];
      window._currentUser = { username: 'admin' }; _isAdmin = true;
      _applyRoleGates(); goPage('trustees');
      _truMgrSpawnTask('x1');
      return {
        due: document.getElementById('tsk-due').value,
        assignee: document.getElementById('tsk-assignee').value,
        title: document.getElementById('tsk-title').value,
        srcTbl: document.getElementById('tsk-src-tbl').value,
      };
    }, iso(-3));
    const expected = iso(-3 + 30);
    check('the due date is filled, not blanked', !!r.due, r);
    check('it is 30 days from the day it was reported (' + expected + ')', r.due === expected, r);
    check('the assignee is left for the manager — it is NOT the reporting trustee', r.assignee === '', r);
    check('the title and source link still work as before', /נאמן בטיחות/.test(r.title) && r.srcTbl === 'trustee_reports', r);

    const typed = await page.evaluate(() => {
      closeModal('m-tsk');
      _truMgrSpawnTask('x1');
      document.getElementById('tsk-assignee').value = 'לב';
      // reopening must not stamp over what was typed for THIS record
      const kept = document.getElementById('tsk-assignee').value;
      closeModal('m-tsk');
      return kept;
    });
    check('a name typed by hand is what stays in the box', typed === 'לב', typed);
    await ctx.close();
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
