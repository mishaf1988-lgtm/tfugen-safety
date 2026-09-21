// "איך לדעת אם הוגש?"
//
// Michael pressed the submit button on 2026-09-21 and then asked how he could
// tell whether it worked. The only answer at the time was a toast that had
// already disappeared. Meta's own review state was one GET away the whole
// time -- wa-templates has always listed templates with their status -- so the
// settings screen reads it out instead of leaving him to guess.
//
// The states matter to a person: "not submitted" means press the button,
// "in review" means wait, "rejected" means the wording needs work. Getting
// those confused sends him to press a button that will not help.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' });
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.accept().catch(() => {}));
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);

  const run = (reply) => page.evaluate(async (rep) => {
    window.toast = function () {};
    window.fetch = function () {
      if (rep === null) return Promise.reject(new Error('offline'));
      return Promise.resolve({ ok: true, json: function () { return Promise.resolve(rep); } });
    };
    _waTemplateStatus();
    await new Promise((r) => setTimeout(r, 60));
    const el = document.getElementById('wa-tpl-status');
    return el ? el.textContent.trim() : 'NO ELEMENT';
  }, reply);

  const other = { name: 'tfugen_incident_alert', status: 'APPROVED' };

  console.log('\n1. the state a person needs to act on');
  {
    const none = await run({ data: [other] });
    check('not in the list at all: says it was never submitted, and what to press',
      /טרם הוגשה/.test(none) && /הגש תבנית/.test(none), none);
    // The old template being approved must not read as ours being approved.
    check('...and is not confused by the OLD template sitting there approved',
      !/מאושרת ופעילה/.test(none), none);

    const pending = await run({ data: [other, { name: 'tfugen_safety_report', status: 'PENDING' }] });
    check('in review: says to wait, not to press again',
      /ממתינה לאישור/.test(pending) && !/טרם הוגשה/.test(pending), pending);

    const ok = await run({ data: [{ name: 'tfugen_safety_report', status: 'APPROVED' }] });
    check('approved: says it is live', /מאושרת ופעילה/.test(ok), ok);

    const bad = await run({ data: [{ name: 'tfugen_safety_report', status: 'REJECTED' }] });
    check('rejected: says Meta refused and that the wording needs changing',
      /דחתה/.test(bad) && /שוב/.test(bad), bad);
  }

  console.log('\n2. lowercase and unknown states');
  {
    // Meta has returned lowercase in the past, and adds states over time.
    const lower = await run({ data: [{ name: 'tfugen_safety_report', status: 'approved' }] });
    check('a lowercase status is still understood', /מאושרת ופעילה/.test(lower), lower);
    const weird = await run({ data: [{ name: 'tfugen_safety_report', status: 'SOMETHING_NEW' }] });
    check('an unfamiliar status is shown rather than swallowed',
      /SOMETHING_NEW/.test(weird) && !/טרם הוגשה/.test(weird), weird);
  }

  console.log('\n3. when the question cannot be asked');
  {
    // "I could not check" and "it was never submitted" are different facts.
    // Reporting the first as the second sends him to press for nothing.
    const off = await run(null);
    check('a failed check says so, and does NOT claim it was never submitted',
      /לא הצלחתי לבדוק/.test(off) && !/טרם הוגשה/.test(off), off);
    const junk = await run({});
    check('a reply with no list is treated as not submitted, not as a crash',
      /טרם הוגשה/.test(junk), junk);
  }

  console.log('\n4. it is on the screen the button is on');
  {
    const wired = await page.evaluate(() => {
      const box = document.getElementById('wa-tpl-status');
      const btn = document.getElementById('wa-tpl-btn');
      return {
        box: !!box,
        btn: !!btn,
        sameModal: !!(box && btn && box.closest('.modal') === btn.closest('.modal')),
        opensWithScreen: /_waTemplateStatus/.test(String(window.openNotifSettings || '')),
      };
    });
    check('the status line and the button live on the same screen',
      wired.box && wired.btn && wired.sameModal, wired);
    check('...and the state is read when that screen opens, not only after pressing',
      wired.opensWithScreen, wired);
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
