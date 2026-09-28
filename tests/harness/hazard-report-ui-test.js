// The department report screen (stage 4, 28/09): what the manager sees before
// sending, and what is sent. _truApi stubbed with the server's shape.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

(async () => {
  const browser = await pw.chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('dialog', (d) => { page._dlg = d.message(); d.accept().catch(() => {}); });
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    window.addLog = function () {}; window._calls = [];
    const rep = (dept, count, to, old) => ({ dept, title: 't', to, cc: ['sviva@tapugan.co.il'], count, old: old || 0, rows: Array.from({ length: count }, (_, i) => ({ n: i + 1, descr: 'מפגע ' + i, resp: 'אחזקה', status: i < (old || 0) ? 'פתוח - מסיור קודם!' : 'פתוח', due: '01/10/2026', old: i < (old || 0) })) });
    window._truApi = function (p, b) {
      window._calls.push([p, b]);
      if (b.op === 'preview') return Promise.resolve({ ok: true, canSend: true, reports: [rep('מעצבים', 2, ['Roman@tapugan.co.il'], 1), rep('תוצג', 0, ['Igal@tapugan.co.il']), rep('מעבדות', 1, [])] });
      return Promise.resolve({ ok: true, sent: [{ dept: 'מעצבים', to: ['Roman@tapugan.co.il'], cc: [], count: 2 }], skipped: [], failed: [] });
    };
    goPage('thz');
  });
  const btn = await page.$('#pg-thz [onclick="hzrOpen()"]');
  check('a "דוח למחלקות" button on the tours screen', !!btn);
  await page.evaluate(() => hzrOpen());
  await page.waitForTimeout(100);
  const v = await page.evaluate(() => {
    const picks = Array.from(document.querySelectorAll('#hzr .hz-pick')).map((x) => ({ d: x.dataset.d, on: x.checked, dis: x.disabled }));
    return { picks, text: document.getElementById('hzr').textContent, calls: window._calls.slice(), wide: document.getElementById('hzr').scrollWidth };
  });
  check('asks the server for the preview', v.calls[0][0] === '/api/hazard-report' && v.calls[0][1].op === 'preview', v.calls);
  check('a department with open hazards and a recipient: ticked', v.picks[0].d === 'מעצבים' && v.picks[0].on && !v.picks[0].dis, v.picks);
  check('nothing open, or no recipient: cannot be ticked', v.picks[1].dis && v.picks[2].dis && !v.picks[1].on, v.picks);
  check('shows אל / עותק, the count and "מסיור קודם"', /אל: Roman@tapugan\.co\.il/.test(v.text) && /עותק: sviva@tapugan\.co\.il/.test(v.text) && /2 פתוחים \(1 מסיור קודם\)/.test(v.text) && /אין נמען בגיליון נמענים/.test(v.text), v.text.slice(0, 300));
  check('fits a phone', v.wide <= 375, v.wide);
  await page.evaluate(() => hzrSend());
  await page.waitForTimeout(100);
  const s = await page.evaluate(() => ({ calls: window._calls.slice(), text: document.getElementById('hzr').textContent }));
  check('asks before sending, naming the departments', /לשלוח את הדוח ל-1 מחלקות: מעצבים/.test(page._dlg || ''), page._dlg);
  check('sends only the ticked departments', s.calls[1] && s.calls[1][1].op === 'send' && s.calls[1][1].depts.join() === 'מעצבים', s.calls);
  check('shows what was sent', /מעצבים: נשלח ל-1 נמענים \(2 מפגעים\)/.test(s.text), s.text.slice(0, 200));
  check('no page errors', errors.length === 0, errors);
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
