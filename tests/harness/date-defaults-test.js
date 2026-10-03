// Every date field in the app, and whether a new form fills it with today
// (03/10/2026, Michael: "yes" to a check of all date fields). openModal fills
// each EMPTY date input with today. The save code reads `gv(x)||null`, so for
// an expiry, a target, a closing date, an approval or a "last review" an empty
// field was meant to mean "none" - but it never reached the save empty: a new
// training without an expiry was saved as expiring today, a new tour hazard got
// today as its target instead of the one by severity (_thzDueFor), and PTW
// approvals and "MSDS updated" read as done today (false ISO evidence). Such a
// field carries data-nodefault. A NEW date field fails here until it is put in
// one of the two lists: the choice is made once, on purpose.
const path = require('path');
const fs = require('fs');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
const SRC = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

// When something happened: today is the likely answer.
const TODAY = ['a-d', 'd-u', 'drl-d', 'env-d', 'eqi-d', 'eqi-pdf-date', 'ins-d', 'leg-u', 'mf-due', 'mtg-ref', 'ncr-sd', 'nm-d', 'ppe-d', 'prj-start', 'ptw-de', 'ptw-ds', 'round-d', 't-d', 'tb-d', 'tbt-d', 'thz-d', 'tru-d', 'wst-d'];
// Empty means none / not yet / unknown.
const NONE = {
  expiry: ['ctr-e', 'd-e', 'eqi-e', 'eqi-pdf-expiry', 'eqi-pdf-next', 'ppe-e', 't-e'],
  target: ['ea-review', 'itp-next-due', 'ncr-u', 'prj-end', 'thz-due', 'tru-route-due', 'tsk-due', 'drl-fu', 'mrs-u'],
  closed: ['ncr-cd', 'thz-closed'],
  approval: ['ptw-sg1d', 'ptw-sg2d', 'ptw-sg3d', 'ptw-sg4d'],
  claim: ['hzm-ms', 'leg-c-date', 'leg-last-review', 'r-last_review'],
  person: ['e-left', 'e-s'],
};
const NONE_ALL = [].concat(...Object.values(NONE));

(async () => {
  console.log('\n1. every date field is classified, and carries the mark that says so');
  const tags = [];
  for (const m of SRC.matchAll(/<input[^>]*type=\\?"date\\?"[^>]*>/g)) {
    const t = m[0], id = (t.match(/id=\\?"([^"\\]+)/) || [])[1] || (t.match(/class=\\?"([^"\\ ]+)/) || [])[1];
    tags.push({ id, nodef: /data-nodefault/.test(t) });
  }
  const unknown = tags.filter((t) => !TODAY.includes(t.id) && !NONE_ALL.includes(t.id)).map((t) => t.id);
  check('no date field left unclassified (a new one: put it in TODAY or NONE)', tags.length >= 50 && unknown.length === 0, { n: tags.length, unknown });
  const wrong = tags.filter((t) => t.nodef !== NONE_ALL.includes(t.id)).map((t) => t.id + (t.nodef ? ' has' : ' lacks') + ' data-nodefault');
  check('data-nodefault exactly on the "empty means none" fields', wrong.length === 0, wrong);
  check('openModal skips data-nodefault', /querySelectorAll\('input\[type=date\]:not\(\[data-nodefault\]\)'\)/.test(SRC));

  console.log('\n2. a new form, as Michael opens it');
  const browser = await pw.chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);
  const got = await page.evaluate(() => {
    window._role = () => 'admin'; window._isAdminUser = () => true;
    const out = {}, today = new Date().toISOString().split('T')[0];
    const mods = [...new Set([...document.querySelectorAll('.modal input[type=date]')].map((i) => i.closest('.modal').id))];
    for (const m of mods) {
      document.querySelectorAll('#' + m + ' input[type=date]').forEach((i) => { i.value = ''; });
      try { openModal(m); } catch (e) { out['!' + m] = String(e); continue; }
      document.querySelectorAll('#' + m + ' input[type=date]').forEach((i) => { out[i.id || i.className] = i.value === today ? 'today' : (i.value || ''); });
      try { closeModal(m); } catch (e) {}
    }
    toast('\u05e0\u05e9\u05de\u05e8 &#10003;');
    const last = [...document.querySelectorAll('.toast')].pop();
    out._toast = last ? [last.textContent, last.className] : null;
    return out;
  });
  const filled = NONE_ALL.filter((id) => got[id] === 'today');
  check('no "empty means none" field starts as today', filled.length === 0, filled);
  const seen = NONE_ALL.filter((id) => id in got).length;
  check('the run reached most of them (open each modal)', seen >= 20, seen);
  const notToday = TODAY.filter((id) => id in got && got[id] !== 'today');
  check('event dates still start as today', notToday.length === 0, notToday);
  check('a toast with &#10003; shows the check mark, and is green', got._toast && got._toast[0] === 'נשמר ✓' && /\bok\b/.test(got._toast[1]), got._toast);
  check('no page errors', errors.length === 0, errors);
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
