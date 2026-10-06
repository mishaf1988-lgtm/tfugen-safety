// The prompt behind "suggest cause and action" in the NCR form. Michael
// (02/10/2026) got "update the CAPA procedures" for two different findings:
// the prompt now carries the rules of a usable root cause and action, and the
// context names the category, the priority and the location.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

(async () => {
  const browser = await pw.chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' })).newPage();
  const sent = [];
  let empty = false;
  await page.route('**/*', (r) => {
    const u = r.request().url();
    // _AI is '/api/claude', relative: under file:// fetch refuses it before the
    // route sees it, so the test points _AI at an http host.
    if (u.indexOf('/api/claude') >= 0) { sent.push(JSON.parse(r.request().postData())); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [{ type: 'text', text: empty ? '{"rc":"","c":""}' : '{"rc":"אין נוהל פינוי","c":"לקבוע פינוי יומי"}' }] }) }); }
    if (u.startsWith('file://')) return r.continue();
    return r.abort();
  });
  // Wait for a condition, not a fixed time (06/10/2026: 500 ms passed here and failed
  // on GitHub's slower runner, 4 shards at once; lesson 2).
  const until = async (fn, ms = 5000) => { const t0 = Date.now(); while (!fn() && Date.now() - t0 < ms) await page.waitForTimeout(50); };
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    document.getElementById('login').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    _AI = 'http://tfugen.test/api/claude';
    DB.ncr = []; window.toast = function () {}; window.sdb = function () {};
    window._currentUser = { username: 'admin' }; _isAdmin = true;
    openNewNcrModal();
    g('ncr-d').value = 'שפך חומר ועובד ללא אוזניות';
    g('ncr-rc-cat').value = 'אדם'; g('ncr-p').value = 'גבוהה'; g('ncr-o').value = 'יוסי';
    _ncrAIRcAction();
  });
  await until(() => sent.length >= 1);
  await page.waitForFunction(() => gv('ncr-rc') !== '', null, { timeout: 5000 }).catch(() => {});

  console.log('\n1. what the model is asked');
  const body = sent[0];
  const prompt = body && body.messages && body.messages[0].content || '';
  check('one request went out', sent.length === 1, sent.length);
  check('the root cause must explain how the system allowed it, not restate or blame', /נוהל חסר, הדרכה, פיקוח, ציוד, תכנון/.test(prompt) && /לא מאשימה עובד/.test(prompt), prompt.slice(0, 300));
  check('the action must name the items in the description, with who and until when', /בשמם/.test(prompt) && /מי, ועד מתי/.test(prompt), prompt.slice(0, 300));
  check('generic phrasings are named as forbidden', /לעדכן נהלים/.test(prompt) && /לחזק מודעות/.test(prompt));
  check('several findings in one description are handled separately', /יותר מממצא אחד/.test(prompt));
  check('no invented numbers, standards or dates', /בלי להמציא/.test(prompt));
  check('keyboard characters only, no long dash', /בלי מקף ארוך/.test(prompt) && prompt.indexOf('—') < 0, prompt.indexOf('—'));
  check('the context carries the category, the priority and the responsible', /קטגוריית סיבה שנבחרה: אדם/.test(prompt) && /עדיפות: גבוהה/.test(prompt) && /אחראי: יוסי/.test(prompt), prompt.slice(-300));

  console.log('\n2. the answer still lands in the fields');
  const r = await page.evaluate(() => ({ rc: gv('ncr-rc'), c: gv('ncr-c') }));
  check('rc and c filled from the JSON', r.rc === 'אין נוהל פינוי' && r.c === 'לקבוע פינוי יומי', r);

  check('the model is told to return empty fields instead of guessing', /אין מספיק פרטים/.test(prompt) && /ואל תנחש/.test(prompt), prompt.slice(-400));

  // 05/10/2026, Chrome on the live NCR-0001: the description was only the label
  // "ממצא בביקורת פנים (בטיחות):" and the model invented a waste-management finding.
  console.log('\n3. a description that is only a label');
  const t = await page.evaluate(() => {
    const toasts = []; window.toast = (m) => toasts.push(m);
    g('ncr-rc').value = ''; g('ncr-c').value = '';
    g('ncr-d').value = 'ממצא בביקורת פנים (בטיחות):';
    _ncrAIRcAction();
    return toasts;
  });
  await page.waitForTimeout(300);
  check('no request is sent for a label with nothing after it', sent.length === 1, sent.length);
  check('the user is told to write what was found', t.some((m) => /אין פרטים/.test(m)), t);
  const t2 = await page.evaluate(() => {
    const toasts = []; window.toast = (m) => toasts.push(m);
    g('ncr-d').value = 'ממצא בביקורת פנים (בטיחות): מטף ליד חדר 17 לא נבדק מאז 2024';
    _ncrAIRcAction();
    return toasts;
  });
  await until(() => sent.length >= 2);
  check('a label followed by a real finding still goes out', sent.length === 2, [sent.length, t2]);

  console.log('\n4. the model answers with empty fields');
  empty = true;
  const r4 = await page.evaluate(async () => {
    const toasts = []; window.toast = (m) => toasts.push(m);
    g('ncr-rc').value = ''; g('ncr-c').value = '';
    g('ncr-d').value = 'בעיה במחסן';
    _ncrAIRcAction();
    for (let i = 0; i < 100 && !toasts.length; i++) await new Promise((res) => setTimeout(res, 50));
    return { toasts, rc: gv('ncr-rc'), c: gv('ncr-c') };
  });
  check('empty answer: fields stay empty and the user is asked for more detail', r4.rc === '' && r4.c === '' && r4.toasts.some((m) => /השלם את התיאור/.test(m)), r4);

  check('no page errors', errs.length === 0, errs);
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
