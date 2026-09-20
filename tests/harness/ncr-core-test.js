// Four things about the NCR module, all confirmed by reading the code, all
// small, and all of them quietly wrong for a long time.
//
// 1.1  svNcr has always saved `p: gv('ncr-p')||'בינונית'` — and there was no
//      element with that id. gv() returns '' for a missing element, so EVERY
//      NCR in the system is "בינונית": from the form, from the Excel import,
//      and from a severe near-miss. The `ncr_critical` notification could
//      never fire, and the management review's "top 5 critical or high open"
//      was permanently empty. Editing an existing NCR also reset its priority.
//
// 1.2  VIEW_CONFIG.ncr wired the label "סיבה" to `p` (the priority) and
//      "פעולה מתקנת" to `o` (the owner) — and rc, c, sd, cd and u appeared
//      nowhere. printReport shares that config, so the PDF handed to an
//      auditor said "Cause: בינונית" and "Corrective action: דני".
//
// 1.4  _reopen cleared s and cd but left verified_by, so a reopened NCR kept
//      its green "✅ verified" badge and was skipped by _capaDue() for ever.
//
// 1.5  Four places read `r.d` as a date. On an NCR, `d` is the DESCRIPTION.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' });
  const page = await ctx.newPage();
  const prompts = [];
  page.on('dialog', async (d) => { prompts.push(d.message()); await d.accept('נפתח בגלל תקלה חוזרת').catch(() => {}); });
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);

  await page.evaluate(() => {
    document.getElementById('login').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    window._currentUser = { username: 'admin' }; _isAdmin = true; _applyRoleGates();
    window.__ins = []; window.__upd = []; window.__events = [];
    window.sbIns = function (t, r) { window.__ins.push(r); };
    window.sbUpd = function (t, r) { window.__upd.push(r); };
    window.sdb = function () {}; window.addLog = function () {};
    window.__toasts = []; window.toast = function (m) { window.__toasts.push(String(m)); };
    window._notifyEvent = function (ev, payload) { window.__events.push({ ev: ev, payload: payload }); };
    window.__iso = (d) => new Date(Date.now() + d * 864e5).toISOString().split('T')[0];
  });

  console.log('\n1.1 the priority field exists, and every path through it works');
  {
    const r = await page.evaluate(() => {
      openModal('m-ncr');
      const el = g('ncr-p');
      return {
        exists: !!el, tag: el && el.tagName,
        options: el ? [...el.options].map((o) => o.value) : [],
        deflt: el && el.value,
      };
    });
    check('the form has a priority control', r.exists && r.tag === 'SELECT', r);
    check('its options are exactly the values the code compares against', r.options.join() === 'נמוכה,בינונית,גבוהה,קריטי', r.options);
    check('it defaults to בינונית, which is what every record used to get', r.deflt === 'בינונית', r.deflt);

    const saved = await page.evaluate(() => {
      DB.ncr = []; window.__ins = []; window.__events = [];
      openModal('m-ncr');
      g('ncr-d').value = 'ארון חשמל פתוח'; g('ncr-p').value = 'קריטי'; g('ncr-sd').value = __iso(-1);
      svNcr();
      return { rows: DB.ncr.length, p: DB.ncr[0] && DB.ncr[0].p, events: window.__events.map((e) => e.ev) };
    });
    check('a critical NCR saves as קריטי, not as בינונית', saved.p === 'קריטי', saved);
    check('...and the ncr_critical notification fires — it never could before', saved.events.indexOf('ncr_critical') >= 0, saved.events);

    const edited = await page.evaluate(() => {
      DB.ncr = [{ id: 'n1', num: 'NCR-1', d: 'מעקה חסר', p: 'גבוהה', s: 'פתוח', o: 'דני', sd: __iso(-5) }];
      editNcr('n1');
      const shown = g('ncr-p').value;
      g('ncr-d').value = 'מעקה חסר — עודכן';
      svNcr();
      return { shown: shown, after: DB.ncr[0].p };
    });
    check('editing an existing NCR shows its real priority', edited.shown === 'גבוהה', edited);
    check('...and saving keeps it — it used to be reset to בינונית on every edit', edited.after === 'גבוהה', edited);

    const blank = await page.evaluate(() => {
      DB.ncr = [{ id: 'n2', num: 'NCR-2', d: 'x', p: 'קריטי', s: 'פתוח' }];
      editNcr('n2');
      openNewNcrModal ? openNewNcrModal() : openModal('m-ncr');
      return g('ncr-p').value;
    });
    check('opening a blank form resets it, rather than inheriting the last record', blank === 'בינונית', blank);
  }

  console.log('\n1.2 the view and the PDF name what they show');
  {
    const r = await page.evaluate(() => {
      DB.ncr = [{ id: 'v1', num: 'NCR-9', d: 'שמן על הרצפה', a: 'בטיחות', p: 'גבוהה',
        loc: 'מחסן', rc: 'צינור סדוק', c: 'להחליף אטם', o: 'דני', u: __iso(10),
        s: 'סגור', cd: __iso(-2), sd: __iso(-30), five_why: '1. ...', notes: 'הערה' }];
      showView('ncr', 'v1');
      const t = (g('view-body') || {}).textContent || '';
      const pairs = VIEW_CONFIG.ncr.fields.map((f) => f[0] + '=' + f[1]);
      return { text: t, pairs: pairs };
    });
    check('"סיבה" no longer points at the priority', r.pairs.indexOf('סיבה=p') < 0, r.pairs);
    check('"פעולה מתקנת" no longer points at the owner', r.pairs.indexOf('פעולה מתקנת=o') < 0, r.pairs);
    check('the real root cause is shown under its own label', /סיבת שורש/.test(r.text) && /צינור סדוק/.test(r.text), r.text.slice(0, 300));
    check('the real corrective action is shown under its own label', /להחליף אטם/.test(r.text));
    check('the owner is labelled אחראי', r.pairs.indexOf('אחראי=o') >= 0, r.pairs);
    check('discovery and closing dates are on the sheet at all — they were missing', /תאריך גילוי/.test(r.text) && /תאריך סגירה/.test(r.text));
    check('and the target date', /יעד לביצוע/.test(r.text));
  }

  console.log('\n1.4 reopening an NCR sends it back to the verification queue');
  {
    const r = await page.evaluate(() => {
      DB.ncr = [{ id: 'r1', num: 'NCR-7', d: 'דליפה', s: 'סגור', cd: __iso(-90),
        verified_by: 'admin', verified_at: new Date(Date.now() - 60 * 864e5).toISOString(),
        verification_notes: 'נבדק בשטח', notes: '' }];
      const before = _capaDue().map((x) => x.id);
      _reopen('ncr', 'r1');
      const rec = DB.ncr[0];
      // close it again, 40 days ago, so it is due
      rec.s = 'סגור'; rec.cd = __iso(-40);
      return {
        before: before, verified_by: rec.verified_by, verified_at: rec.verified_at,
        notes: rec.notes, after: _capaDue().map((x) => x.id),
      };
    });
    check('before reopening it was NOT in the queue — it counted as verified', r.before.length === 0, r.before);
    check('reopening clears the verification', r.verified_by === null && r.verified_at === null, r);
    check('...and says so in the notes, naming who had verified it and when', /אימות אפקטיביות בוטל/.test(r.notes) && /admin/.test(r.notes), r.notes);
    check('so once closed again it comes back to the queue', r.after.join() === 'r1', r.after);
  }

  console.log('\n1.5 the four places that read the description as a date');
  {
    const r = await page.evaluate(() => {
      const iso = __iso;
      DB.ncr = [
        { id: 'a', num: 'NCR-1', d: 'אי-התאמה השבוע', s: 'פתוח', sd: iso(-2), ts: new Date().toISOString() },
        { id: 'b', num: 'NCR-2', d: 'אי-התאמה השבוע', s: 'פתוח', sd: iso(-4), ts: new Date().toISOString() },
        { id: 'c', num: 'NCR-3', d: 'אי-התאמה שבוע שעבר', s: 'פתוח', sd: iso(-10), ts: new Date().toISOString() },
        { id: 'd', num: 'NCR-4', d: '01/01/2020', s: 'פתוח', sd: iso(-3), ts: new Date().toISOString() },
      ];
      DB.inc = []; DB.near_miss = []; DB.rounds = [];
      goPage('dash');
      const wk = (g('dash-wow') || g('dash-weekly') || {}).textContent || '';
      const mo = (g('dash-month') || {}).textContent || '';
      return { wk: wk, mo: mo, body: document.getElementById('pg-dash').textContent };
    });
    // three NCRs in the last 7 days, one of them with a date-shaped description
    check('the week-vs-week card counts this week’s NCRs instead of showing 0', /3/.test(r.wk) || /3/.test(r.body), r.wk.slice(0, 160));
    check('a description that looks like a date does not become the record’s date', !/2020/.test(r.wk), r.wk.slice(0, 160));

    const src = await page.evaluate(() => [...document.querySelectorAll('script')].map((s) => s.textContent).join(''));
    check('no NCR filter reads r.d as a date any more', !/\(DB\.ncr\|\|\[\]\)\.filter\(function\(r\)\{return in(Range|Month|Last7)\(r\.d[,)]/.test(src.replace(/\s+/g, '')),
      (src.match(/in(Range|Month|Last7)\(r\.d[,)]/g) || []).slice(0, 4));
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
