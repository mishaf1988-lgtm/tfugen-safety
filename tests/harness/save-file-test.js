// Getting a file out of the app.
//
// Michael, 2026-09-21: the print button did nothing once the app was on his
// home screen, because iOS gives a standalone web app no print dialog and
// window.print() fails silently. The eight exports were the same bug waiting:
// every one of them ended in a.download + click, which in that context also
// does nothing, also silently. He had simply not pressed them yet.
//
// The share sheet is the route that exists there, and on a phone it is better
// anyway -- the file goes straight to WhatsApp, Mail or Files instead of into
// a Downloads folder nobody opens. On a desktop nothing changes.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'he-IL' });
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.accept().catch(() => {}));
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);

  // o.standalone  running from the home screen
  // o.canShare    the browser is willing to share files
  // o.shareErr    what navigator.share rejects with, if anything
  const run = (o) => page.evaluate(async (opt) => {
    const toasts = [];
    window.toast = function (m) { toasts.push(String(m)); };
    const realMM = window.matchMedia;
    if (opt.standalone) {
      window.matchMedia = function (q) {
        if (String(q).indexOf('display-mode: standalone') >= 0) return { matches: true, media: q };
        return realMM.call(window, q);
      };
    }
    let shared = null, clicked = null;
    navigator.canShare = opt.canShare ? function () { return true; } : function () { return false; };
    navigator.share = function (d) {
      shared = { name: d.files && d.files[0] && d.files[0].name, type: d.files && d.files[0] && d.files[0].type, title: d.title };
      return opt.shareErr
        ? Promise.reject(Object.assign(new Error('x'), { name: opt.shareErr }))
        : Promise.resolve();
    };
    const realClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { clicked = this.download; };

    const blob = new Blob(['a,b\n1,2'], { type: 'text/csv;charset=utf-8' });
    const ret = _saveFile(blob, 'x.csv', 'כותרת');
    await new Promise((r) => setTimeout(r, 80));

    HTMLAnchorElement.prototype.click = realClick;
    window.matchMedia = realMM;
    return { ret: ret, shared: shared, clicked: clicked, toasts: toasts };
  }, o);

  console.log('\n1. on a desktop, nothing changes');
  {
    const r = await run({ standalone: false, canShare: true });
    // Not standalone: the plain download, even where sharing is offered. A
    // manager at a computer expects a file in Downloads.
    check('it downloads', r.clicked === 'x.csv', r);
    check('...and does not open a share sheet', !r.shared, r);
  }

  console.log('\n2. from the home screen, where a download does nothing');
  {
    const r = await run({ standalone: true, canShare: true });
    check('it shares instead of downloading', !!r.shared && !r.clicked, r);
    check('...the real file, with its name and type', r.shared.name === 'x.csv' && /text\/csv/.test(r.shared.type), r.shared);
    check('...and a title for the sheet', r.shared.title === 'כותרת', r.shared);
  }

  console.log('\n3. when sharing is not available there');
  {
    // An older iOS, or a file type the platform will not take. Falling back
    // to the download is no worse than before.
    const r = await run({ standalone: true, canShare: false });
    check('it falls back to the download', r.clicked === 'x.csv' && !r.shared, r);
  }

  console.log('\n4. cancelling is not failing');
  {
    // The user opened the sheet and changed their mind. Downloading behind
    // their back would be the wrong answer.
    const r = await run({ standalone: true, canShare: true, shareErr: 'AbortError' });
    check('a cancelled share does not then download anything', !!r.shared && !r.clicked, r);
    check('...and says nothing alarming', r.toasts.length === 0, r.toasts);
  }
  {
    const r = await run({ standalone: true, canShare: true, shareErr: 'NotAllowedError' });
    check('a real share failure falls back to the download', !!r.shared && r.clicked === 'x.csv', r);
  }

  console.log('\n5. every export goes through it');
  {
    let src = require('fs').readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
    // The script injected into each generated report carries its own tiny
    // download, for the PDF it builds there. That is a different document and
    // a different code path; strip it before counting the app's own.
    src = src.replace(/<script>function _rptMsg[\s\S]*?<\\\/script>/g, '');
    // One a.download is allowed: the one inside _saveFileDownload itself.
    const left = (src.match(/a\.download=/g) || []).length;
    check('no export still builds its own download link (' + left + ' left, the helper)', left === 1, left);
    const via = (src.match(/_saveFile\(/g) || []).length;
    check('and they all call the helper (' + via + ')', via >= 9, via);
  }

  console.log('\n6. the exports still produce what they produced');
  {
    const r = await page.evaluate(async () => {
      window.toast = function () {};
      let got = null;
      window._saveFile = function (blob, name) { got = { name: name, size: blob.size, type: blob.type }; return true; };
      DB.trustees = [{ id: 't1', n: 'דני', active: true }];
      DB.trustee_tasks = [{ id: 'k5', n: 5, t: 'עמדות כיבוי אש', active: true }];
      const m = new Date().toISOString().substring(0, 7);
      DB.trustee_reports = [{ id: 'r1', u: 'דני', t: 5, m: m, d: m + '-04', loc: 'מחסן', f: 'מטף', ok: false, s: 'פתוח', ts: m + '-04T07:00:00Z' }];
      try { _truExportCsv(); } catch (e) { return { error: String(e && e.message) }; }
      return got;
    });
    check('the trustee CSV still builds a file, and hands it over', r && /tapugan-trustees-/.test(r.name || '') && r.size > 50, r);
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
