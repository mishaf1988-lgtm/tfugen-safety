// The "system state" screen.
//
// Four things broke on 2026-09-21 and every one of them was silent. The email
// had been refused by Resend since the day it was configured; the WhatsApp
// alert went out on a template written for road accidents; a Vercel project
// had been serving a second public copy of the app for four months; and no
// notification recipient had ever been filled in. In each case the app looked
// completely fine, and each was found by accident.
//
// So the value of this screen is not that it renders. It is that it is honest:
// it must not report a problem that is already over, and it must never show a
// tick for something it could not actually check. Both of those are the
// checks below.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

const DAY = 86400000;
const ago = (d) => new Date(Date.now() - d * DAY).toISOString();

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' });
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.accept().catch(() => {}));
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);

  // world(): everything the screen reads, in one place.
  const run = (w) => page.evaluate(async (o) => {
    window.toast = function () {}; window.sdb = function () {}; window.addLog = function () {};
    window.openModal = function () {}; window.closeModal = function () {};
    window._sbToken = o.token === false ? '' : 'tok';
    window._svUser = function () { return 'admin@tfugen.local'; };
    window._obGet = function () { return new Array(o.outbox || 0).fill({}); };

    DB.notification_prefs = o.prefs ? [{ id: 'admin@tfugen.local', prefs: o.prefs }] : [];
    DB.notifications_log = o.log || [];
    DB.trustees = (o.trustees === undefined ? 3 : o.trustees) ? [{ n: 'a', active: true }, { n: 'b', active: true }, { n: 'c', active: true }] : [];
    DB.trustee_tasks = (o.tasks === undefined ? 5 : o.tasks) ? [1, 2, 3, 4, 5].map((n) => ({ n: n, active: true })) : [];
    DB.locations = (o.locs === undefined ? 4 : o.locs) ? [1, 2, 3, 4].map((i) => ({ id: 'L' + i, name: 'X' })) : [];

    window.fetch = function (u) {
      const s = String(u);
      if (s.indexOf('/api/wa-templates') >= 0) {
        if (o.tplFail) return Promise.reject(new Error('offline'));
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: o.templates || [] }) });
      }
      if (s.indexOf('/storage/v1/object/list/backups') >= 0) {
        if (o.backupFail) return Promise.resolve({ ok: false, status: 403, json: () => Promise.resolve({}) });
        return Promise.resolve({ ok: true, json: () => Promise.resolve(o.backups || []) });
      }
      return Promise.reject(new Error('unexpected ' + s));
    };

    _sysStateRun();
    await new Promise((r) => setTimeout(r, 120));
    return document.getElementById('sys-list').textContent.replace(/\s+/g, ' ').trim();
  }, w);

  const GOOD = {
    prefs: { trustee_hazard: { whatsapp: true, whatsapp_to: '972547940073', email: true, email_to: 'a@b.c' } },
    log: [{ channel: 'whatsapp', ts: ago(1) }],
    templates: [{ name: 'tfugen_safety_report', status: 'APPROVED' }],
    backups: [{ name: 'tapugan-backup-' + new Date().toISOString().substring(0, 10) + '_03-00-00.json' }],
  };

  console.log('\n1. everything in order');
  {
    const t = await run(GOOD);
    check('it says so, once, at the top', /הכל תקין/.test(t), t.slice(0, 120));
    check('...the recipient is named', /972547940073/.test(t), t);
    check('...and nothing is presented as needing action', !/מה לעשות/.test(t), t);
  }

  console.log('\n2. nobody to notify');
  {
    const t = await run({ ...GOOD, prefs: null });
    // This was the real state for months, while the pipeline was perfect.
    check('flagged, and says what the consequence is', /לא מוגדר אף נמען/.test(t) && /לא יגיע לאיש/.test(t), t);
    check('...and where to fix it', /הגדרות התראות/.test(t), t);
    // One problem, so the header says so in the singular. "1 דברים" reads
    // like a machine talking, and this screen is read by a person in a hurry.
    check('...and the header counts it, in Hebrew that reads', /דבר אחד דורש טיפול/.test(t), t.slice(0, 120));
  }

  console.log('\n3. the log holds old errors -- the exact situation today');
  {
    // Michael fixed the email address; the failures from before are still in
    // the log. Reporting those as a live problem would send him to debug
    // something that is already over.
    const t = await run({ ...GOOD, log: [{ channel: 'whatsapp', ts: ago(1) }, { channel: 'email_error', ts: ago(5), payload: { detail: 'Resend 403' } }] });
    check('an error OLDER than the last success is not a live failure', !/הכשל האחרון חדש יותר/.test(t), t);
    check('...and delivery reads as healthy', /נשלחה בהצלחה/.test(t), t);
  }
  {
    const t = await run({ ...GOOD, log: [{ channel: 'email_error', ts: ago(1), payload: { detail: 'Resend 403 no verified domain' } }, { channel: 'whatsapp', ts: ago(6) }] });
    check('an error NEWER than the last success is flagged', /הכשל האחרון חדש יותר/.test(t), t);
    check('...carrying what the far end actually said', /Resend 403/.test(t), t);
  }

  console.log('\n4. the WhatsApp template');
  {
    const none = await run({ ...GOOD, templates: [{ name: 'tfugen_incident_alert', status: 'APPROVED' }] });
    // The OLD template sits in the same list and is approved. Reading the
    // wrong row would say the problem is solved while every alert still
    // opens with a siren.
    check('the old approved template is not mistaken for ours',
      /טרם הוגשה/.test(none) && !/מאושרת ופעילה/.test(none), none);
    const pend = await run({ ...GOOD, templates: [{ name: 'tfugen_safety_report', status: 'PENDING' }] });
    check('pending says to wait, not to act', /ממתינה ל-Meta/.test(pend), pend);
    const rej = await run({ ...GOOD, templates: [{ name: 'tfugen_safety_report', status: 'REJECTED' }] });
    check('rejected says the wording needs work', /דחתה/.test(rej), rej);
  }

  console.log('\n5. the nightly backup');
  {
    const old = await run({ ...GOOD, backups: [{ name: 'tapugan-backup-' + new Date(Date.now() - 5 * DAY).toISOString().substring(0, 10) + '_03-00-00.json' }] });
    check('five days without a snapshot is a problem, and it says how old', /גיבוי/.test(old) && /5 ימים/.test(old), old);
    const none = await run({ ...GOOD, backups: [] });
    check('no snapshots at all is a problem', /אין אף קובץ גיבוי/.test(none), none);
  }

  console.log('\n6. it never ticks something it could not check');
  {
    // The whole point. A green light nobody earned is worse than a gap,
    // because it stops anyone looking.
    const t1 = await run({ ...GOOD, tplFail: true });
    check('a template check that could not run is a warning, not a tick',
      !/תבנית ההודעה בוואטסאפ מאושרת/.test(t1) && /לא הצלחתי לבדוק מול Meta/.test(t1), t1);
    const t2 = await run({ ...GOOD, backupFail: true });
    check('a backup listing that was refused is a warning, not a tick',
      /לא הצלחתי לקרוא את רשימת הגיבויים/.test(t2), t2);
    const t3 = await run({ ...GOOD, token: false });
    check('with no server session it says it cannot check the backup', /אין חיבור לשרת/.test(t3), t3);
  }

  console.log('\n7. what it admits it cannot see');
  {
    const t = await run(GOOD);
    check('the unchecked items are listed apart', /לא נבדק אוטומטית/.test(t), t);
    check('...including leaked-password protection', /סיסמאות שדלפו/.test(t), t);
    check('...and the mail domain', /דומיין מאומת/.test(t), t);
  }

  console.log('\n8. the rest of the setup');
  {
    const t = await run({ ...GOOD, trustees: 0 });
    check('no active trustees is flagged', /אין אף נאמן פעיל/.test(t), t);
    const k = await run({ ...GOOD, tasks: 0 });
    check('a roster with no monthly tasks is flagged', /אין אף משימה חודשית/.test(k), k);
    const o = await run({ ...GOOD, outbox: 9 });
    check('a stuck outbox is flagged with its size', /9 פעולות/.test(o), o);
    const ok = await run({ ...GOOD, outbox: 0 });
    check('an empty outbox reads as fine', /ריק, הכל נשלח/.test(ok), ok);
  }

  console.log('\n9. reachable from the header menu');
  {
    const wired = await page.evaluate(() => {
      const labels = [];
      const orig = window._popMenu;
      window._popMenu = function (a, id, build) { try { build(function (i, l, cb) { labels.push({ l: l, cb: cb }); }, function () {}); } catch (e) {} };
      try { document.querySelector('[onclick*="_hdrMenu"], #hdr-more, .hdr-more')?.click(); } catch (e) {}
      window._popMenu = orig;
      return { labels: labels.map((x) => x.l), hasFn: typeof window._sysStateOpen === 'function', modal: !!document.getElementById('m-sys') };
    });
    check('the screen exists in the page', wired.modal && wired.hasFn, wired);
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
