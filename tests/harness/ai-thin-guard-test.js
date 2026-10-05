// The AI buttons that fill fields from a free-text description (05/10/2026,
// after #1185, lesson 55): a description that is only a label or a word or two
// is not sent, the prompt gives the model a way to say "not enough", and an
// empty answer fills nothing. Same for the law summary when there is no full
// text: the model may not invent what a law it does not know requires.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

(async () => {
  const browser = await pw.chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' })).newPage();
  const sent = [];
  let answer = '';
  await page.route('**/*', (r) => {
    const u = r.request().url();
    if (u.indexOf('/api/claude') >= 0) { sent.push(JSON.parse(r.request().postData())); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [{ type: 'text', text: answer }] }) }); }
    if (u.startsWith('file://')) return r.continue();
    return r.abort();
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    document.getElementById('login').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    _AI = 'http://tfugen.test/api/claude';
    window.sdb = function () {}; window.sbUpd = function () {};
    window._toasts = []; window.toast = (m) => window._toasts.push(m);
    window.prompt = () => null;
  });
  const lastPrompt = () => { const b = sent[sent.length - 1]; return (b && b.messages && b.messages[0].content) || ''; };
  // run one button: set fields, call, wait, return toasts and the fields after
  const run = async (setup, call, read, ans) => {
    answer = ans || '';
    return page.evaluate(async ({ setup, call, read }) => {
      window._toasts = [];
      new Function(setup)();
      new Function(call)();
      await new Promise((res) => setTimeout(res, 450));
      return { toasts: window._toasts.slice(), read: new Function('return ' + read)() };
    }, { setup, call, read });
  };
  const THIN = /אין פרטים/, ANS = /השלם את התיאור/;

  // [name, field setter for a description, call, fields read back, JSON answer that is empty, real answer]
  const buttons = [
    ['risk', (d) => "g('r-d').value=" + JSON.stringify(d) + ";g('r-p').value='';g('r-s').value='';g('r-ac').value='';", '_rskAI()', "[gv('r-ac')]", '{"p":0,"s":0,"ac":""}', '{"p":3,"s":2,"ac":"לגדר את הבור"}', /0 ב-p וב-s/],
    ['incident', (d) => "g('i-d').value=" + JSON.stringify(d) + ";g('i-dy').value='';", '_incAI()', "[gv('i-dy')]", '{"ty":"","sv":"","dy":null}', '{"ty":"Near Miss","sv":"קל","dy":0}', /null ב-dy/],
    ['near miss', (d) => "g('nm-desc').value=" + JSON.stringify(d) + ";g('nm-notes').value='';", '_nmAI()', "[gv('nm-notes')]", '{"sev":"","typ":"","notes":""}', '{"sev":"בינוני","typ":"נפילה","notes":"לסמן את המדרגה"}', /החזר את השדות ריקים/],
    ['NCR 5-Why', (d) => "g('ncr-d').value=" + JSON.stringify(d) + ";g('ncr-five-why').value='';", '_ncrFiveWhyAI()', "[gv('ncr-five-why')]", 'אין מספיק פרטים', '1. למה זה קרה?\n   המטף לא נבדק', /החזר רק את המילים: אין מספיק פרטים/],
  ];
  for (const [name, set, call, read, emptyAns, realAns, rule] of buttons) {
    console.log('\n' + name);
    const n0 = sent.length;
    const a = await run(set('ממצא בביקורת פנים (בטיחות):'), call, read, realAns);
    check('a label only: nothing is sent', sent.length === n0, sent.length - n0);
    check('a label only: the user is told to write what was found', a.toasts.some((m) => THIN.test(m)), a.toasts);
    const b = await run(set('בעיה במחסן'), call, read, emptyAns);
    check('a real description goes out', sent.length === n0 + 1, sent.length - n0);
    check('the prompt gives the model a way to say "not enough"', rule.test(lastPrompt()), lastPrompt().slice(-300));
    check('an empty answer fills nothing and asks for more detail', b.read.every((v) => !v) && b.toasts.some((m) => ANS.test(m)), b);
    const c = await run(set('מטף ליד חדר 17 לא נבדק מאז 2024'), call, read, realAns);
    check('a real answer still lands in the form', c.read.some((v) => !!v), c);
  }

  console.log('\nincident 5-Why (incident view and investigation)');
  await page.evaluate(() => { DB.inc = [{ id: 'i1', d: 'תאונה:' }, { id: 'i2', d: 'עובד החליק על שמן ליד מכונה 4' }]; window.showView = function () {}; });
  let n0 = sent.length;
  const v1 = await run('', "_incFiveWhyAI('i1')", "''");
  check('incident view, a label only: nothing is sent, the message is not "AI error"', sent.length === n0 && v1.toasts.some((m) => THIN.test(m) && !/שגיאת AI/.test(m)), v1.toasts);
  const v2 = await run("window._invCur=DB.inc[1];g('inv-fw').value='';g('inv-rc').value='';", '_invAI()', "[gv('inv-fw'),g('inv-err').textContent]", 'אין מספיק פרטים');
  check('investigation: a real description goes out with the way out in the prompt', sent.length === n0 + 1 && /החזר רק את המילים: אין מספיק פרטים/.test(lastPrompt()), lastPrompt().slice(-200));
  check('investigation: "not enough" fills nothing and says so', !v2.read[0] && ANS.test(v2.read[1]), v2.read);

  console.log('\nNCR agent panel (saves to ncr_ai history)');
  await page.evaluate(() => { _nad = [{ id: 'n1', num: 'NCR-1', d: 'ממצא בביקורת פנים (בטיחות):' }, { id: 'n2', num: 'NCR-2', d: 'מטף ליד חדר 17 לא נבדק' }]; window._ncrFbPrompt = () => ''; window._ncrRender = function () {}; window._ncrSel = function () {}; });
  n0 = sent.length;
  const p1 = await run('', "_ncrAI('n1')", '_naf.n1');
  check('a label only: nothing is sent and the panel says what is missing', sent.length === n0 && p1.read && p1.read.thin && THIN.test(p1.read.msg), p1.read);
  const p2 = await run('', "_ncrAI('n2')", '[_naf.n2, _naVer.n2||0]', '{"insufficient":true}');
  check('the prompt lets the model answer "insufficient"', /"insufficient":true/.test(lastPrompt()));
  check('"insufficient": no version is saved, the panel asks for more detail', p2.read[0] && p2.read[0].thin && ANS.test(p2.read[0].msg) && p2.read[1] === 0, p2.read);

  console.log('\nlaw summary');
  n0 = sent.length;
  const l1 = await run("g('leg-s').value='תקנות הבטיחות בעבודה (ציוד מגן אישי)';g('leg-full-text').value='';g('leg-summary').value='';g('leg-topic').value='';", '_legAI()', "[gv('leg-summary')]", '{"summary":"","topic":"","a":"כללי"}');
  check('without full text the model is told not to guess what the law requires', /אינך מכיר את החוק הזה בוודאות/.test(lastPrompt()), lastPrompt().slice(-300));
  check('an empty summary: the user is asked to paste the full text', !l1.read[0] && l1.toasts.some((m) => /הדבק את הטקסט המלא/.test(m)), l1);
  const l2 = await run("g('leg-full-text').value='סעיף 2: המעביד יספק ציוד מגן';g('leg-summary').value='';", '_legAI()', "[gv('leg-summary')]", '{"summary":"לספק ציוד מגן","topic":"ציוד מגן","a":"בטיחות בעבודה"}');
  check('with full text the "do not guess" line is not added and the summary lands', !/אינך מכיר את החוק/.test(lastPrompt()) && l2.read[0] === 'לספק ציוד מגן', [l2.read, lastPrompt().slice(-200)]);

  check('no page errors', errs.length === 0, errs);
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
