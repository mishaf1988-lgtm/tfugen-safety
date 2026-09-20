// The worker's side of the app.
//
// 4.12 The ⛔ button on the worker's home opened the MANAGER's near-miss form:
//      severity, type, status, free-text notes and a 🤖 AI-classify button.
//      empReport was `openModal(m[type])` and nothing else — no emp-mode arm at
//      all. A worker who has to grade a hazard before reporting it mostly does
//      not report it. And the near-miss he did file never appeared on the
//      trustee screen, which lists trustee_reports only.
//
// 1.13 He then saw a green ✓ and silence. Nothing told him whether an NCR was
//      opened, whether anyone acted, or whether it closed — the panel's badge
//      was `✓ ' + when`, which answers «did the phone keep it», not «did
//      anything happen». After three of those people stop reporting, and the
//      near-miss:incident ratio on the dashboard falls for the worst reason.
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

  await page.evaluate(() => {
    document.getElementById('login').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    window.sdb = function () {}; window.addLog = function () {};
    window.sbIns = function () {}; window.sbUpd = function () {}; window.sbDel = function () {};
    window.__toasts = []; window.toast = function (m) { window.__toasts.push(String(m)); };
    window.rDash = function () {};
  });

  console.log('\n4.12 the worker gets the worker’s form');
  {
    const r = await page.evaluate(() => {
      document.body.classList.add('emp-mode');
      try { localStorage.setItem(TRU_ME_KEY, 'דני כהן'); } catch (e) {}
      // a value a manager left selected in an earlier session
      g('nm-sev').value = 'חמור'; g('nm-s').value = 'סגור'; g('nm-notes').value = 'הערת מנהל';
      empReport('nm');
      const vis = (id) => { const el = g(id); const f = el && el.closest('.field'); return !!(f && getComputedStyle(f).display !== 'none'); };
      return {
        desc: vis('nm-desc'), loc: vis('nm-location-id'), rep: vis('nm-rep'), d: vis('nm-d'),
        sev: vis('nm-sev'), typ: vis('nm-typ'), st: vis('nm-s'), notes: vis('nm-notes'),
        ai: getComputedStyle(g('nm-ai-btn')).display !== 'none',
        sevVal: g('nm-sev').value, stVal: g('nm-s').value, notesVal: g('nm-notes').value,
        repVal: g('nm-rep').value, dVal: g('nm-d').value,
      };
    });
    check('what happened, where and when stay on the form', r.desc && r.loc && r.d, r);
    check('grading the hazard is not asked of the worker', !r.sev && !r.typ, r);
    check('...nor is the status of the investigation', !r.st, r);
    check('...nor the manager’s notes field', !r.notes, r);
    check('the AI classify button is the manager’s tool, not the worker’s', !r.ai, r);
    check('a severity a manager left selected does not ride along', r.sevVal === '', r.sevVal);
    check('...and neither does a stale «closed»', r.stVal === 'פתוח', r.stVal);
    check('...and neither does a stale note', r.notesVal === '', r.notesVal);
    check('the report is filled in with who is holding the phone', r.repVal === 'דני כהן', r.repVal);
    check('...and with today, so it is one less thing to tap', /^\d{4}-\d{2}-\d{2}$/.test(r.dVal), r.dVal);

    const saved = await page.evaluate(() => {
      DB.near_miss = [];
      g('nm-desc').value = 'כבל חשמל חשוף ליד מסוע 3';
      svNm();
      const r = DB.near_miss[0] || {};
      return { n: DB.near_miss.length, sev: r.sev, s: r.s, descr: r.descr, rep: r.rep };
    });
    check('the report saves with the manager’s fields hidden', saved.n === 1 && /מסוע 3/.test(saved.descr || ''), saved);
    check('...with no severity invented for it', saved.sev === null, saved);
    check('...and open, not whatever the hidden select held', saved.s === 'פתוח', saved);

    // And if the select is not on a valid option at all — nothing selected,
    // for whatever reason — the report is still open rather than status-less.
    const noSel = await page.evaluate(() => {
      DB.near_miss = [];
      g('nm-s').selectedIndex = -1;
      g('nm-desc').value = 'אין סטטוס נבחר';
      svNm();
      return (DB.near_miss[0] || {}).s;
    });
    check('...even with no status selected at all', noSel === 'פתוח', noSel);

    // The manager must still get the full form.
    const mgr = await page.evaluate(() => {
      document.body.classList.remove('emp-mode');
      const vis = (id) => { const el = g(id); const f = el && el.closest('.field'); return !!(f && getComputedStyle(f).display !== 'none'); };
      return { sev: vis('nm-sev'), typ: vis('nm-typ'), st: vis('nm-s'), notes: vis('nm-notes'), ai: getComputedStyle(g('nm-ai-btn')).display !== 'none' };
    });
    check('the manager’s own form is untouched', mgr.sev && mgr.typ && mgr.st && mgr.notes && mgr.ai, mgr);
  }

  console.log('\n4.12 an ungraded report is a queue, not a blank');
  {
    const r = await page.evaluate(() => {
      DB.near_miss = [
        { id: 'a', d: '2026-09-01', descr: 'ישן וחמור', sev: 'חמור', s: 'פתוח', ts: '2026-09-01T06:00:00Z' },
        { id: 'b', d: '2026-09-02', descr: 'מהעובד, לא סווג', sev: null, s: 'פתוח', ts: '2026-09-02T06:00:00Z' },
        { id: 'c', d: '2026-09-03', descr: 'קטין', sev: 'קטין', s: 'פתוח', ts: '2026-09-03T06:00:00Z' },
      ];
      window._nmFilter = 'all'; window._nmLocFilter = ''; window._nmSvFilter = '';
      rNm();
      const tb = g('tb-nm');
      const order = Array.from(tb.querySelectorAll('tr')).map((tr) => (tr.children[2] || {}).textContent || '');
      return { order: order, html: tb.innerHTML };
    });
    check('a report nobody has graded sorts to the top, above even «חמור»', /לא סווג/.test(r.order[0] || ''), r.order);
    check('...and says so instead of showing a dash', /טרם סווג/.test(r.html), r.html.slice(0, 200));
    check('...in a colour that reads as «needs you», not «nothing here»', /bY[^]{0,40}טרם סווג|טרם סווג/.test(r.html) && !/bX[^]{0,30}טרם סווג/.test(r.html));
    check('«קטין» is graded, so it sorts below the ungraded one', r.order.indexOf('קטין') > r.order.findIndex((x) => /לא סווג/.test(x)), r.order);
  }

  console.log('\n1.13 the person who reported finds out what happened');
  {
    const r = await page.evaluate(() => {
      document.body.classList.add('emp-mode');
      // Deliberately NOT the same word as the near-miss's own status below:
      // otherwise «what is the NCR doing» passes without the NCR being read.
      DB.ncr = [{ id: 'n1', num: 'NCR-1000', d: 'כבל חשוף', s: 'סגור' }];
      DB.near_miss = [
        { id: 'm1', rep: 'דני כהן', descr: 'כבל חשמל חשוף', s: 'בטיפול', notes: 'נפתח NCR-1000 מהדיווח הזה', ts: '2026-09-19T06:00:00Z' },
        { id: 'm2', rep: 'דני כהן', descr: 'שלולית שמן', s: 'פתוח', ts: '2026-09-18T06:00:00Z' },
        { id: 'm3', rep: 'מישהו אחר', descr: 'לא שלי בכלל', s: 'סגור', ts: '2026-09-20T06:00:00Z' },
      ];
      DB.equip_inspections = []; DB.rounds = [];
      rEmpRecent();
      return { html: g('emp-recent-list').innerHTML, shown: g('emp-recent').style.display };
    });
    check('the panel shows what I reported', /כבל חשמל חשוף/.test(r.html) && /שלולית שמן/.test(r.html), r.html.slice(0, 300));
    check('...and not what somebody else reported', !/לא שלי בכלל/.test(r.html), r.html);
    check('a report that became an NCR says which one', /NCR-1000/.test(r.html), r.html);
    check('...and what that NCR is doing now', /NCR-1000 סגור/.test(r.html), r.html);
    check('a report nobody has picked up yet says «פתוח», not a green tick', /פתוח/.test(r.html), r.html);
    check('«✓ saved 2 hours ago» is no longer the answer to «what happened»', !/✓ \d+ (דקות|שעות|ימים)/.test(r.html) || !/כבל חשמל חשוף[^]{0,400}✓ \d+/.test(r.html), r.html);

    // The anonymous kiosk session cannot read ncr at all.
    const noNcr = await page.evaluate(() => {
      DB.ncr = [];
      rEmpRecent();
      return g('emp-recent-list').innerHTML;
    });
    check('with no access to the NCR table the number still shows — it lives in the text', /NCR-1000/.test(noNcr), noNcr.slice(0, 300));
    check('...without inventing a status for a record it cannot see', !/NCR-1000 [א-ת]/.test(noNcr), noNcr.slice(0, 300));

    // The id is local to whichever device did the chaining; the number in the
    // text is what actually syncs. Pin that the lookup uses the durable half.
    const byText = await page.evaluate(() => {
      DB.ncr = [{ id: 'n1', num: 'NCR-1000', d: 'x', s: 'סגור' }];
      const nm = { id: 'm1', notes: 'נפתח NCR-1000 מהדיווח הזה' };   // no ncr_id at all
      const found = _nmNcrOf(nm);
      return { id: found && found.id, ref: _nmNcrRef(nm) };
    });
    check('a row that never carried the id still finds its NCR by the number in the text', byText.id === 'n1', byText);

    const anon = await page.evaluate(() => {
      try { localStorage.removeItem(TRU_ME_KEY); } catch (e) {}
      DB.ncr = [{ id: 'n1', num: 'NCR-1000', d: 'x', s: 'בטיפול' }];
      rEmpRecent();
      return g('emp-recent-list').innerHTML;
    });
    check('a device that has not said who it belongs to still sees the device’s reports', /כבל חשמל חשוף/.test(anon) && /לא שלי בכלל/.test(anon), anon.slice(0, 300));
  }

  console.log('\n4.12 the near-miss shows up on the trustee screen too');
  {
    const r = await page.evaluate(() => {
      try { localStorage.setItem(TRU_ME_KEY, 'דני כהן'); } catch (e) {}
      const m = new Date().toISOString().substring(0, 7);
      DB.trustee_reports = [];
      DB.near_miss = [
        { id: 'm1', rep: 'דני כהן', descr: 'כבל חשמל חשוף', s: 'בטיפול', d: m + '-05', notes: 'נפתח NCR-1000 מהדיווח הזה', ts: m + '-05T06:00:00Z' },
        { id: 'm9', rep: 'דני כהן', descr: 'מחודש שעבר', s: 'פתוח', d: '2026-01-05', ts: '2026-01-05T06:00:00Z' },
        { id: 'm3', rep: 'אחר', descr: 'לא שלי', s: 'פתוח', d: m + '-06', ts: m + '-06T06:00:00Z' },
      ];
      _truRender();
      const box = g('tru-my-nm');
      return { has: !!box, text: box ? box.textContent : '', mine: g('tru-mine') ? g('tru-mine').textContent : '' };
    });
    check('the hazard reported outside a tour appears on the trustee’s own screen', r.has && /כבל חשמל חשוף/.test(r.text), r);
    check('...with what became of it', /NCR-1000/.test(r.text) && /בטיפול/.test(r.text), r.text);
    check('...only this month’s, like everything else on that screen', !/מחודש שעבר/.test(r.text), r.text);
    check('...and only mine', !/לא שלי/.test(r.text), r.text);
    check('it says plainly that it earns no points', /לא מזכה בנקודות/.test(r.text), r.text);
    check('the scored list stays trustee findings only', !/כבל חשמל חשוף/.test(r.mine), r.mine);

    const none = await page.evaluate(() => {
      DB.near_miss = [];
      _truRender();
      return !!g('tru-my-nm');
    });
    check('with nothing reported, no empty block is added to the screen', !none, none);
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
